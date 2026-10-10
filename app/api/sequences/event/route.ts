/**
 * n8n → Vercel : point d'extension « scoring comportemental ».
 *
 *   POST { email, event, properties? }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Enregistre un événement Brevo de la liste blanche ci-dessous (participation
 * webinar, replay, pages commerciales…) sur la fiche du contact. Aucun score
 * n'est modifié tant que EVENT_SCORING_ENABLED est faux (lib/scoring) : les
 * données s'accumulent d'abord, les règles viendront quand elles seront fiables.
 */

import { NextRequest, NextResponse } from "next/server";
import { BREVO_EVENTS, sendBrevoEvent, type BrevoEventName, type EventProperties } from "@/lib/brevo/events";
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
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
