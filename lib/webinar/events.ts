/**
 * Événements webinar, au mieux : un échec n'empêche jamais l'inscrit de
 * rejoindre la salle ou de voir le replay.
 *
 *   lien ouvert        webinar_join_clicked + WEBINAR_ACTIVITY.joinOpenedAt
 *                      — AUCUN point : un clic (antivirus, lien transféré) ne prouve
 *                      pas l'entrée dans Meet (Business Standard n'a pas de rapport de présence).
 *   replay consulté    webinar_replay_clicked + WEBINAR_ACTIVITY.replayViewedAt
 *   présence confirmée confirmWebinarAttendance() — seule source de webinar_attended
 *                      (+15, une fois par contact et par webinar), avec sa preuve.
 */
import type { WebinarConfig } from "@/config/webinars";
import { BREVO_EVENTS, sendBrevoEvent } from "@/lib/brevo/events";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { writeWebinarActivity, type AttendanceProof } from "@/lib/webinar/activity";

type W = Pick<WebinarConfig, "slug" | "title" | "startsAt">;

export async function recordWebinarJoinOpened(contactId: number, w: W, now: Date): Promise<void> {
  try {
    await sendBrevoEvent(BREVO_EVENTS.WEBINAR_JOIN_CLICKED, { contact_id: contactId }, { resource: w.slug, certified: false }, now);
    await writeWebinarActivity(contactId, w, { joinOpenedAt: now }, now);
  } catch (err) {
    console.warn(JSON.stringify({ evt: "webinar", etape: "lien_ouvert", slug: w.slug, code: (err as Error).name }));
  }
}

export async function recordWebinarReplay(contactId: number, w: W, now: Date): Promise<void> {
  try {
    await sendBrevoEvent(BREVO_EVENTS.WEBINAR_REPLAY_CLICKED, { contact_id: contactId }, { resource: w.slug }, now);
    await writeWebinarActivity(contactId, w, { replayViewedAt: now }, now);
  } catch (err) {
    console.warn(JSON.stringify({ evt: "webinar", etape: "replay", slug: w.slug, code: (err as Error).name }));
  }
}

export type AttendanceOutcome = { ok: true; scored: boolean } | { ok: false; reason: "journal" | "brevo" };

/**
 * Présence confirmée par une preuve (rapport de sondage / Q&R Meet nominatif,
 * ou constat humain de l'organisateur). Idempotent : la clé du journal est
 * (contact, webinar), un second appel ne rajoute aucun point.
 */
export async function confirmWebinarAttendance(
  contactId: number, w: W, proof: AttendanceProof, now: Date
): Promise<AttendanceOutcome> {
  let scored = false;
  if (ledgerConfigured()) {
    const r = await recordEvents([makeEvent("webinar_attended", contactId, w.slug, "webinar", now)]);
    if (!r.ok) return { ok: false, reason: "journal" };
    await applyBehaviorScores(r.rows, now).catch((e) => console.error("Scoring présence : écriture différée :", e instanceof Error ? e.message : e));
    scored = true;
  }
  const sent = await sendBrevoEvent(BREVO_EVENTS.WEBINAR_ATTENDED, { contact_id: contactId }, { resource: w.slug, proof }, now);
  const written = await writeWebinarActivity(contactId, w, { attended: { at: now, proof } }, now);
  return sent && written ? { ok: true, scored } : { ok: false, reason: "brevo" };
}
