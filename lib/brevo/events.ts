/**
 * Événements comportementaux Brevo (POST /v3/events), envoyés côté SERVEUR.
 * Ils alimentent l'historique du contact, les segments et les automations.
 *
 * Importé côté serveur via lib/brevo/server.ts (garde `server-only`).
 *
 * Principe : LISTE = provenance, ATTRIBUTS = qui est le contact,
 * ÉVÉNEMENTS = ce qu'il fait. Un échec d'envoi n'est jamais bloquant.
 */

import { brevoRequest } from "@/lib/brevo/api";

export const BREVO_EVENTS = {
  /* Connectés */
  LEAD_MAGNET_SUBMITTED: "lead_magnet_submitted",
  LEAD_MAGNET_DOWNLOADED: "lead_magnet_downloaded",
  EMAIL_CONFIRMED: "email_confirmed",
  /* Préparés : site althoce.com (tracker) */
  SERVICE_PAGE_VIEWED: "service_page_viewed",
  CASE_STUDY_VIEWED: "case_study_viewed",
  BOOKING_PAGE_VIEWED: "booking_page_viewed",
  /* Préparés : webinars (plateforme à définir, via n8n) */
  WEBINAR_REGISTERED: "webinar_registered",
  WEBINAR_ATTENDED: "webinar_attended",
  WEBINAR_NO_SHOW: "webinar_no_show",
  WEBINAR_REPLAY_CLICKED: "webinar_replay_clicked",
  WEBINAR_CTA_CLICKED: "webinar_cta_clicked",
} as const;

export type BrevoEventName = (typeof BREVO_EVENTS)[keyof typeof BREVO_EVENTS];

/** Événements qu'un navigateur peut déclencher via /api/events (avec jeton signé). */
export const CLIENT_EVENTS: ReadonlySet<string> = new Set([BREVO_EVENTS.LEAD_MAGNET_DOWNLOADED]);

export type EventProperties = Record<string, string | number | boolean | null | undefined>;

export type ContactIdentifier = { contact_id: number } | { email_id: string };

function cleanProperties(props: EventProperties): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === "") continue;
    if (!/^[\w-]{1,255}$/.test(k)) continue;
    out[k] = typeof v === "string" ? v.slice(0, 500) : v;
  }
  return out;
}

export async function sendBrevoEvent(
  name: BrevoEventName,
  identifiers: ContactIdentifier,
  properties: EventProperties = {},
  date: Date = new Date()
): Promise<boolean> {
  try {
    const res = await brevoRequest("/events", {
      method: "POST",
      body: {
        event_name: name,
        event_date: date.toISOString(),
        identifiers,
        event_properties: cleanProperties(properties),
      },
      retries: 1,
      timeoutMs: 5000,
    });
    if (!res.ok) {
      console.error(JSON.stringify({ type: "brevo_event", name, ok: false, status: res.status, code: res.code }));
    }
    return res.ok;
  } catch (e) {
    console.error(JSON.stringify({ type: "brevo_event", name, ok: false, error: String(e) }));
    return false;
  }
}
