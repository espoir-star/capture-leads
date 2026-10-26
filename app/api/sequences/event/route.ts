/**
 * n8n → Vercel : point d'extension « scoring comportemental ».
 *
 *   POST { email, event, properties? }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Enregistre un événement Brevo de la liste blanche ci-dessous (participation
 * webinar, replay, pages commerciales…) sur la fiche du contact.
 *
 * `webinar_attended` avec `properties.webinar` (slug d'un webinar connu) est
 * une PRÉSENCE CONFIRMÉE (rapport de sondage / Q&R Meet, constat humain) :
 * scoring +15 une fois par webinar et par contact, WEBINAR_ACTIVITY pour le CRM.
 * `properties.proof` : poll | qa | manual (défaut manual). Un clic sur le lien
 * de connexion n'arrive jamais ici (lib/webinar/events.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { getContactByEmail } from "@/lib/brevo/api";
import { BREVO_EVENTS, sendBrevoEvent, type BrevoEventName, type EventProperties } from "@/lib/brevo/events";
import { bearerMatches } from "@/lib/security/bearer";
import { confirmWebinarAttendance } from "@/lib/webinar/events";
import type { AttendanceProof } from "@/lib/webinar/activity";
import { isValidEmailSyntax, normalizeEmail } from "@/lib/validation/email";
import { readBodyLimited } from "@/lib/security/body";

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
    const read = await readBodyLimited(req, 4000);
    if (!read.ok) return NextResponse.json({ ok: false }, { status: 413 });
    const text = read.text;
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
  const slug = typeof props.webinar === "string" && /^[a-z0-9-]{1,80}$/.test(props.webinar) ? props.webinar : "";
  const webinar = slug ? getWebinar(slug) : undefined;
  if (event === BREVO_EVENTS.WEBINAR_ATTENDED && webinar && webinar.status !== "draft") {
    const proof: AttendanceProof = props.proof === "poll" || props.proof === "qa" ? props.proof : "manual";
    try {
      const contact = await getContactByEmail(email);
      if (!contact) return NextResponse.json({ ok: false, reason: "contact_absent" }, { status: 404 });
      // Seul un inscrit peut être présent : une adresse mal recopiée ne donne jamais +15 à un autre contact.
      if (!contact.listIds?.includes(webinar.brevoListId)) return NextResponse.json({ ok: false, reason: "non_inscrit" }, { status: 404 });
      const r = await confirmWebinarAttendance(contact.id, webinar, proof, new Date());
      return r.ok ? NextResponse.json({ ok: true, scored: r.scored }) : NextResponse.json({ ok: false, reason: r.reason }, { status: 502 });
    } catch (e) {
      console.error("Présence webinar :", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, reason: "brevo" }, { status: 502 });
    }
  }
  const ok = await sendBrevoEvent(event, { email_id: email }, props);
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
