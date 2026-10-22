/**
 * Liens et paramètres injectés dans les modèles du moteur de séquences.
 * Calculés à l'envoi : aucun attribut Brevo n'est nécessaire.
 */

import { getWebinar } from "@/config/webinars";
import { googleCalendarUrl, personalWebinarLinks } from "@/lib/webinar/access";
import { readWebinarActivity } from "@/lib/webinar/activity";
import { webinarReplayUrl } from "@/lib/webinar/urls";
import type { AttributeValue } from "@/lib/brevo/api";
import { getRessource } from "@/lib/ressources";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { createMarketingOptoutToken } from "@/lib/marketing/token";

type Env = Record<string, string | undefined>;

export const CTA_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";
const PRODUCTION_URL = "https://guide-gratuit-pi.vercel.app";

/** Domaine des liens : SITE_URL, sinon l'URL de branche en Preview, sinon la Production */
export function siteUrl(env: Env = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  return PRODUCTION_URL;
}

export interface UnsubscribeLinks {
  /** Page /desinscription (confirmation par bouton) */
  page: string;
  /** POST en un clic (List-Unsubscribe, RFC 8058) */
  oneClick: string;
}

export function unsubscribeLinks(email: string): UnsubscribeLinks | null {
  const t = createMarketingOptoutToken(email);
  if (!t) return null;
  const base = siteUrl();
  return { page: `${base}/desinscription?t=${t}`, oneClick: `${base}/api/marketing/unsubscribe?t=${t}` };
}

/** Lien de confirmation d'adresse, absent si l'adresse est déjà confirmée */
export function confirmUrl(email: string, emailStatus: unknown): string | undefined {
  if (emailStatus === "VERIFIED") return undefined;
  const t = createEmailConfirmToken(email);
  return t ? `${siteUrl()}/confirmer-email?t=${t}` : undefined;
}

/**
 * Titre, date et heure (Europe/Paris), ressources et liens d'un webinar (config/webinars.ts).
 * JOIN_URL et REPLAY_URL sont TOUJOURS des liens personnels /w/<slug>/… (avec
 * `contactId`) : la salle Meet et l'enregistrement ne figurent jamais dans un email.
 * REPLAY_AVAILABLE indique que l'enregistrement est publié (variable Vercel).
 */
export function webinarParams(slug: string | undefined, contactId?: number): Record<string, string> | null {
  const w = slug ? getWebinar(slug) : undefined;
  if (!w) return null;
  const start = new Date(w.startsAt);
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(start);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(start);
  const base = siteUrl();
  const resources = Object.fromEntries((w.resources ?? []).slice(0, 2).flatMap((r, i) => [
    [`RESOURCE_${i + 1}_TITLE`, r.title], [`RESOURCE_${i + 1}_URL`, r.url],
  ]));
  return {
    WEBINAR_TITLE: w.title,
    WEBINAR_DATE: date,
    WEBINAR_TIME: time.replace(":", " h "),
    WEBINAR_DURATION: `${w.durationMin} min`,
    WEBINAR_PAGE_URL: `${base}/w/${w.slug}`,
    CALENDAR_GOOGLE_URL: googleCalendarUrl(w, base),
    CALENDAR_ICS_URL: `${base}/w/${w.slug}/agenda.ics`,
    ...(webinarReplayUrl(w.slug) && { REPLAY_AVAILABLE: "true" }),
    ...resources,
    ...(contactId && personalWebinarLinks(w, contactId, base)),
  };
}

/** Projet à court terme déclaré (formulaire guide) : met en avant un échange adapté. */
const SHORT_TERM = new Set(["IMMEDIAT", "MOINS_3_MOIS", "TROIS_SIX_MOIS"]);

/**
 * Variantes des emails replay et suivi, lues sur la fiche AU MOMENT de l'envoi :
 * ATTENDED seulement si la présence est CONFIRMÉE pour ce webinar (jamais
 * « vous avez manqué » sans preuve) ; HAS_PROJECT si un projet à court terme est déclaré.
 */
export function webinarContactParams(
  attributes: Record<string, AttributeValue | undefined>, slug: string | undefined
): Record<string, string> {
  if (!slug || !getWebinar(slug)) return {};
  const activity = readWebinarActivity(attributes);
  const attended = activity?.slug === slug && activity.attendance === "CONFIRMED";
  const project = SHORT_TERM.has(String(attributes.HORIZON_PROJET ?? ""));
  return { ...(attended && { ATTENDED: "true" }), ...(project && { HAS_PROJECT: "true" }) };
}

/** Paramètres de la ressource (guide ou webinar) ; liens personnels si le contact est connu */
export function resourceParams(slug: string | undefined, contactId?: number): Record<string, string> {
  return guideParams(slug) ?? webinarParams(slug, contactId) ?? {};
}

/** Titre et lien du guide (modèles génériques) depuis lib/ressources.ts */
export function guideParams(slug: string | undefined): { GUIDE_TITLE: string; GUIDE_URL: string } | null {
  const r = slug ? getRessource(slug) : undefined;
  if (!r) return null;
  const title = (r.resourceCard?.titre ?? r.titre).replace(/<\/?accent>/g, "").trim();
  return { GUIDE_TITLE: title, GUIDE_URL: new URL(r.urlRessource, siteUrl()).href };
}
