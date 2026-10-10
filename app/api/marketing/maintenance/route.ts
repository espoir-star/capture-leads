/**
 * n8n → Vercel : tâches horaires (workflow « ALTHOCE | Marketing | Quota et RDV — v1 »).
 *
 *   POST {}   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * 1. Quota d'envoi Brevo : crédits restants du jour (GET /account). Sous
 *    QUOTA_ALERT_REMAINING, un email d'alerte part UNE fois par jour.
 * 2. RDV confirmés : contacts modifiés depuis 3 h dont ETAT_RDV / STATUT_APPEL
 *    indique un RDV (config/scoring.ts) → événement « meeting_booked » (+25,
 *    une seule fois par contact) dans le journal, puis score.
 * 3. Livraisons de guide restées en attente (after() interrompu, Brevo
 *    indisponible) : reprises sans doublon (lib/sequences/delivery.ts).
 * 4. Clics transactionnels d'hier et d'aujourd'hui relus dans le journal Brevo :
 *    rattrape les webhooks abandonnés par Brevo, sans double comptage (clé unique).
 */

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { brevoRequest, type BrevoContact } from "@/lib/brevo/api";
import { isIdempotencyDuplicate } from "@/lib/brevo/transactional";
import { BREVO_DAILY_LIMIT, QUOTA_ALERT_REMAINING } from "@/config/scoring";
import { REPLY_TO, SENDERS } from "@/config/senders";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { retryPendingDeliveries } from "@/lib/sequences/delivery";
import { reconcileTransactionalClicks } from "@/lib/scoring/clicks";
import { hasConfirmedMeeting, makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { bearerMatches } from "@/lib/security/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MEETING_WINDOW_MS = 3 * 3_600_000;
const MAX_CONTACTS = 2000;

interface Quota {
  remaining: number | null;
  limit: number;
  alert: "none" | "sent" | "failed";
}

async function checkQuota(now: Date): Promise<Quota> {
  const res = await brevoRequest<{ plan?: { type?: string; credits?: number; creditsType?: string }[] }>("/account", { method: "GET" });
  const plan = res.data?.plan?.find((p) => p.creditsType === "sendLimit");
  const remaining = typeof plan?.credits === "number" ? plan.credits : null;
  if (remaining === null || remaining > QUOTA_ALERT_REMAINING) return { remaining, limit: BREVO_DAILY_LIMIT, alert: "none" };
  const day = now.toISOString().slice(0, 10);
  const sent = await brevoRequest("/smtp/email", {
    method: "POST",
    body: {
      sender: SENDERS.resources,
      to: [{ email: REPLY_TO }],
      subject: `[Alerte quota Brevo] ${remaining} emails restants aujourd'hui`,
      htmlContent: `<p>Il reste <strong>${remaining}</strong> envois sur ${BREVO_DAILY_LIMIT} aujourd'hui (offre Brevo Free).</p>
<p>Au-delà, Brevo refuse les envois : les livraisons de guides et relances sont réessayées automatiquement (n8n, toutes les 30 min pendant 24 h). Éviter toute campagne aujourd'hui.</p>`,
      tags: ["alerte-quota"],
      headers: { idempotencyKey: `quota.${createHash("sha256").update(`quota:${day}`).digest("hex").slice(0, 24)}` },
    },
    retries: 1,
  }).catch(() => null);
  const ok = !!sent && (sent.ok || isIdempotencyDuplicate(sent.status, sent.message));
  return { remaining, limit: BREVO_DAILY_LIMIT, alert: ok ? "sent" : "failed" };
}

async function syncMeetings(now: Date) {
  const since = new Date(now.getTime() - MEETING_WINDOW_MS).toISOString();
  const found: BrevoContact[] = [];
  let checked = 0;
  for (let offset = 0; offset < MAX_CONTACTS; offset += 500) {
    const res = await brevoRequest<{ contacts?: BrevoContact[]; count?: number }>(
      `/contacts?limit=500&offset=${offset}&modifiedSince=${encodeURIComponent(since)}`,
      { method: "GET" }
    );
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
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  const now = new Date();
  try {
    const quota = await checkQuota(now);
    const deliveries = await retryPendingDeliveries(now);
    const meetings = ledgerConfigured() ? await syncMeetings(now) : "journal_non_configure";
    const clicks = ledgerConfigured() ? await reconcileTransactionalClicks(now) : "journal_non_configure";
    return NextResponse.json({ ok: true, quota, deliveries, meetings, clicks });
  } catch (e) {
    console.error("Maintenance marketing :", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
