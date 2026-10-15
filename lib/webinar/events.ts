/**
 * Événements webinar : présence (scoring + activité qualifiante, lue par le CRM)
 * et clic replay (événement Brevo). Au mieux : un échec n'empêche jamais
 * l'inscrit de rejoindre la salle ou de voir le replay.
 */
import { BREVO_EVENTS, sendBrevoEvent } from "@/lib/brevo/events";
import { makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";

export async function recordWebinarAttendance(contactId: number, slug: string, now: Date): Promise<void> {
  try {
    // Clé déterministe (contact, webinar) : plusieurs clics = une seule présence.
    if (ledgerConfigured()) await recordEvents([makeEvent("webinar_attended", contactId, slug, "webinar", now)]);
    await sendBrevoEvent(BREVO_EVENTS.WEBINAR_ATTENDED, { contact_id: contactId }, { resource: slug }, now);
  } catch (err) {
    console.warn(JSON.stringify({ evt: "webinar", etape: "presence", slug, code: (err as Error).name }));
  }
}

export async function recordWebinarReplay(contactId: number, slug: string, now: Date): Promise<void> {
  try {
    await sendBrevoEvent(BREVO_EVENTS.WEBINAR_REPLAY_CLICKED, { contact_id: contactId }, { resource: slug }, now);
  } catch (err) {
    console.warn(JSON.stringify({ evt: "webinar", etape: "replay", slug, code: (err as Error).name }));
  }
}
