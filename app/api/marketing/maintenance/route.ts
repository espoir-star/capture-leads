/** Tâches horaires authentifiées : quota, livraisons, RDV, clics et suivi multi-guides. */
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { brevoRequest, type BrevoContact } from "@/lib/brevo/api";
import { sendInternalAlert } from "@/lib/brevo/internalAlert";
import { BREVO_DAILY_LIMIT, QUOTA_ALERT_REMAINING } from "@/config/scoring";
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
interface Quota { remaining: number | null; limit: number; alert: "none" | "sent" | "failed" }
async function checkQuota(now: Date): Promise<Quota> {
  const res = await brevoRequest<{ plan?: { type?: string; credits?: number; creditsType?: string }[] }>("/account", { method: "GET" });
  const plan = res.data?.plan?.find((p) => p.creditsType === "sendLimit");
  const remaining = typeof plan?.credits === "number" ? plan.credits : null;
  if (remaining === null || remaining > QUOTA_ALERT_REMAINING) return { remaining, limit: BREVO_DAILY_LIMIT, alert: "none" };
  const day = now.toISOString().slice(0, 10);
  const ok = await sendInternalAlert({
    subject: `[Alerte quota Brevo] ${remaining} emails restants aujourd'hui`,
    title: `Il reste ${remaining} envois sur ${BREVO_DAILY_LIMIT} aujourd'hui (offre Brevo Free)`,
    intro: "Les livraisons et relances peuvent être retardées. Les tâches en attente sont reprises par la maintenance et n8n ; éviter toute campagne aujourd'hui.",
    tag: "alerte-quota",
    idempotencyKey: `quota.${createHash("sha256").update(`quota:${day}`).digest("hex").slice(0, 24)}`,
  });
  return { remaining, limit: BREVO_DAILY_LIMIT, alert: ok ? "sent" : "failed" };
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
export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) return new NextResponse(null, { status: 401 });
  const now = new Date();
  const started = Date.now();
  try {
    const quota = await checkQuota(now);
    const deliveries = await retryPendingDeliveries(now);
    const meetings = ledgerConfigured() ? await syncMeetings(now) : "journal_non_configure";
    const clicks = ledgerConfigured() ? await reconcileTransactionalClicks(now) : "journal_non_configure";
    const budgetMs = Math.min(25_000, Math.max(0, 42_000 - (Date.now() - started)));
    const multiGuides = budgetMs >= 5000
      ? await maintainMultiGuides(now, { budgetMs, maxJobs: 6 })
      : { deferred: true, reason: "maintenance_budget" };
    if (("failed" in multiGuides && multiGuides.failed > 0) || ("budgetExceeded" in multiGuides && multiGuides.budgetExceeded)) {
      console.warn(JSON.stringify({ type: "multi_guides_maintenance_incomplete", report: multiGuides }));
    }
    return NextResponse.json({ ok: true, quota, deliveries, meetings, clicks, multiGuides });
  } catch (e) {
    console.error("Maintenance marketing :", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
