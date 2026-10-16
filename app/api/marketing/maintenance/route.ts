/** Tâches horaires authentifiées : quota, livraisons, RDV, clics et suivi multi-guides. */
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { brevoRequest, type BrevoContact } from "@/lib/brevo/api";
import { sendInternalAlert } from "@/lib/brevo/internalAlert";
import { QUOTA_ALERT_REMAINING } from "@/config/scoring";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { retryPendingDeliveries } from "@/lib/sequences/delivery";
import { maintainMultiGuides } from "@/lib/guides/store";
import { reconcileTransactionalClicks } from "@/lib/scoring/clicks";
import { hasConfirmedMeeting, makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { bearerMatches } from "@/lib/security/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MEETING_WINDOW_MS = 3 * 3_600_000;
const MAX_CONTACTS = 2000;
interface Quota { remaining: number | null; threshold: number; alert: "none" | "sent" | "failed" }
async function checkQuota(now: Date): Promise<Quota> {
  const res = await brevoRequest<{ plan?: { type?: string; credits?: number; creditsType?: string }[] }>("/account", { method: "GET" });
  const plan = res.data?.plan?.find((p) => p.creditsType === "sendLimit");
  const remaining = typeof plan?.credits === "number" ? plan.credits : null;
  if (remaining === null || remaining > QUOTA_ALERT_REMAINING) return { remaining, threshold: QUOTA_ALERT_REMAINING, alert: "none" };
  const day = now.toISOString().slice(0, 10);
  const ok = await sendInternalAlert({
    subject: `[Alerte crédits Brevo] ${remaining} envois restants`,
    title: `Il reste ${remaining} crédits d'envoi sur l'offre Brevo`,
    intro: `Sous ${QUOTA_ALERT_REMAINING} crédits, une newsletter complète risque de ne pas partir entièrement. Recharger ou attendre le renouvellement avant toute campagne ; les livraisons de guides restent prioritaires.`,
    tag: "alerte-quota",
    idempotencyKey: `quota.${createHash("sha256").update(`quota:${day}`).digest("hex").slice(0, 24)}`,
  });
  return { remaining, threshold: QUOTA_ALERT_REMAINING, alert: ok ? "sent" : "failed" };
}
async function syncMeetings(now: Date) {
  const since = new Date(now.getTime() - MEETING_WINDOW_MS).toISOString();
  const found: BrevoContact[] = [];
  let checked = 0;
  for (let offset = 0; offset < MAX_CONTACTS; offset += 500) {
    const res = await brevoRequest<{ contacts?: BrevoContact[]; count?: number }>(`/contacts?limit=500&offset=${offset}&modifiedSince=${encodeURIComponent(since)}`, { method: "GET" });
    if (!res.ok) throw new Error(`Lecture des contacts modifiés impossible (${res.status})`);
    const page = res.data?.contacts ?? [];
    checked += page.length;
    found.push(...page.filter((c) => hasConfirmedMeeting(c.attributes)));
    if (page.length < 500) break;
  }
  if (!found.length) return { checked, events: 0, inserted: 0 };
  const r = await recordEvents(found.map((c) => makeEvent("meeting_booked", c.id, "crm", "crm", now)));
  if (!r.ok) throw new Error(`Journal n8n indisponible (${r.reason})`);
  await applyBehaviorScores(r.rows, now);
  return { checked, events: found.length, inserted: r.inserted };
}
/**
 * Chaque tâche est isolée : une panne du scoring (journal n8n, RDV, clics) ne
 * bloque jamais la reprise des livraisons de guides, et inversement. Ordre :
 * livraisons d'abord, scoring ensuite. Une tâche en échec rend la réponse 502
 * (n8n alerte) mais les autres ont été exécutées et leur rapport est renvoyé.
 */
export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  const started = Date.now();
  const failed: string[] = [];
  const task = async <T>(name: string, fn: () => Promise<T>): Promise<T | { error: true }> => {
    try {
      return await fn();
    } catch (e) {
      failed.push(name);
      console.error(JSON.stringify({ type: "maintenance_task_failed", task: name, message: (e instanceof Error ? e.message : String(e)).slice(0, 200) }));
      return { error: true };
    }
  };
  const quota = await task("quota", () => checkQuota(now));
  const deliveries = await task("deliveries", () => retryPendingDeliveries(now));
  const budgetMs = Math.min(25_000, Math.max(0, 42_000 - (Date.now() - started)));
  const multiGuides = budgetMs >= 5000
    ? await task("multiGuides", () => maintainMultiGuides(now, { budgetMs, maxJobs: 6 }))
    : { deferred: true, reason: "maintenance_budget" };
  if (("failed" in multiGuides && multiGuides.failed > 0) || ("budgetExceeded" in multiGuides && multiGuides.budgetExceeded)) {
    console.warn(JSON.stringify({ type: "multi_guides_maintenance_incomplete", report: multiGuides }));
  }
  const meetings = ledgerConfigured() ? await task("meetings", () => syncMeetings(now)) : "journal_non_configure";
  // Marge sous maxDuration (60 s) : les clics restants attendent la passe suivante (clé unique, rien de perdu).
  const clicks = ledgerConfigured() ? await task("clicks", () => reconcileTransactionalClicks(now, { deadline: started + 48_000 })) : "journal_non_configure";
  const report = { ok: failed.length === 0, failed, quota, deliveries, meetings, clicks, multiGuides };
  return NextResponse.json(report, { status: failed.length ? 502 : 200 });
}
