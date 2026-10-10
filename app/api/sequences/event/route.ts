/**
 * n8n → Vercel : point d'extension « scoring comportemental ».
 *
 *   POST { email, event, properties? }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Enregistre un événement Brevo de la liste blanche ci-dessous (participation
 * webinar, replay, pages commerciales…) sur la fiche du contact.
 *
 * `webinar_attended` avec `properties.webinar` (slug) alimente aussi le
 * scoring comportemental (+15, une fois par webinar et par contact).
 */

import { NextRequest, NextResponse } from "next/server";
import { getContactByEmail } from "@/lib/brevo/api";
import { BREVO_EVENTS, sendBrevoEvent, type BrevoEventName, type EventProperties } from "@/lib/brevo/events";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { bearerMatches } from "@/lib/security/bearer";
import { isValidEmailSyntax, normalizeEmail } from "@/lib/validation/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<BrevoEventName>([
  BREVO_EVENTS.WEBINAR_ATTENDED,
  BREVO_EVENTS.WEBINAR_NO_SHOW,
  BREVO_EVENTS.WEBINAR_REPLAY_CLICKED,
  BREVO_EVENTS.WEBINAR_CTA_CLICKED,
  BREVO_EVENTS.SERVICE_PAGE_VIEWED,
  BREVO_EVENTS.CASE_STUDY_VIEWED,
  BREVO_EVENTS.BOOKING_PAGE_VIEWED,
]);

export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  let body: { email?: unknown; event?: unknown; properties?: unknown };
  try {
    const text = await req.text();
    if (text.length > 4000) return NextResponse.json({ ok: false }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const event = body.event as BrevoEventName;
  if (!isValidEmailSyntax(email) || !ALLOWED.has(event)) return NextResponse.json({ ok: false }, { status: 400 });

  const props: EventProperties = {};
  if (body.properties && typeof body.properties === "object" && !Array.isArray(body.properties)) {
    for (const [k, v] of Object.entries(body.properties as Record<string, unknown>)) {
      if (["string", "number", "boolean"].includes(typeof v)) props[k] = v as string | number | boolean;
    }
  }
  const ok = await sendBrevoEvent(event, { email_id: email }, props);
  if (!ok) return NextResponse.json({ ok }, { status: 502 });

  const slug = typeof props.webinar === "string" && /^[a-z0-9-]{1,80}$/.test(props.webinar) ? props.webinar : "";
  if (event === BREVO_EVENTS.WEBINAR_ATTENDED && slug && ledgerConfigured()) {
    try {
      const contact = await getContactByEmail(email);
      if (contact) {
        const r = await recordEvents([makeEvent("webinar_attended", contact.id, slug, "webinar", new Date())]);
        if (!r.ok) return NextResponse.json({ ok: false, reason: "journal" }, { status: 502 });
        await applyBehaviorScores(r.rows).catch((e) => console.error("Scoring présence : écriture différée :", e instanceof Error ? e.message : e));
      }
    } catch (e) {
      console.error("Scoring présence :", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, reason: "brevo" }, { status: 502 });
    }
  }
  return NextResponse.json({ ok });
}
