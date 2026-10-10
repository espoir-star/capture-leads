/**
 * Scoring comportemental — barème et classification des clics.
 *
 * SEUL fichier à modifier pour changer un poids ou ajouter une URL d'offre.
 * Règles (lib/scoring/behavior.ts) :
 *   - chaque événement compte UNE fois (clé unique, voir eventKey) ;
 *   - score final = min(SCORE_CAP, score formulaire + score comportemental),
 *     jamais en dessous du LEAD_SCORE existant (aucune baisse automatique) ;
 *   - ouvertures d'email : 0 point (non fiables : Apple Mail Privacy, antivirus).
 */

import { HOT_LEAD_THRESHOLD } from "@/lib/scoring";
import { CTA_URL } from "@/lib/sequences/links";

export { HOT_LEAD_THRESHOLD };

export const BEHAVIOR_POINTS = {
  /** Clic sur un contenu de newsletter ou d'email (article, post, page…) */
  content_click: 3,
  /** Clic vers un guide (page Notion ou page de capture /r/…) */
  guide_click: 5,
  /** Clic vers une offre commerciale / prise de rendez-vous */
  offer_click: 10,
  webinar_registered: 8,
  webinar_attended: 15,
  /** RDV confirmé (voir MEETING_CONFIRMED) */
  meeting_booked: 25,
} as const;

export type BehaviorCategory = keyof typeof BEHAVIOR_POINTS;

export const CLICK_CATEGORIES: ReadonlySet<BehaviorCategory> = new Set(["content_click", "guide_click", "offer_click"]);

export const SCORE_CAP = 100;

/** Préfixe de la page de prise de RDV (cal.com/althoce-…) */
const CTA_PREFIX = CTA_URL.replace(/\/[^/]*$/, "/");

/** Clic « offre commerciale ». Ajouter ici les pages d'offre du site althoce.com quand elles seront définies. */
export const OFFER_URL_PREFIXES: readonly string[] = [CTA_PREFIX];

/** Clic « guide » : pages Notion des guides et pages de capture du site */
export const GUIDE_URL_PATTERNS: readonly RegExp[] = [
  /^https:\/\/espoir-metareglage\.notion\.site\//i,
  /^https:\/\/[^/]+\/r\/[a-z0-9-]+/i,
];

/** Liens jamais comptés : désinscription, confirmation d'adresse, mentions, réseaux, mailto */
export const IGNORED_URL_PATTERNS: readonly RegExp[] = [
  /^(mailto|tel):/i,
  /\/desinscription\b/i,
  /\/api\/marketing\/unsubscribe\b/i,
  /\/confirmer-email\b/i,
  /\/(mentions-legales|confidentialite|politique-de-confidentialite)\b/i,
  /unsubscribe|optout|opt-out/i,
];

/**
 * « Prise de RDV confirmée » = une de ces valeurs, renseignée par l'équipe
 * commerciale (valeurs relevées dans Brevo le 10/10/2026). À VALIDER.
 */
export const MEETING_CONFIRMED: Readonly<Record<string, readonly string[]>> = {
  ETAT_RDV: ["Prévu"],
  STATUT_APPEL: ["RDV planifié", "RDV booke"],
  LIFECYCLE_STAGE: ["MEETING_BOOKED"],
};

/**
 * Clic moins de N secondes après l'envoi : robot (antivirus de messagerie,
 * Microsoft Safe Links… qui testent tous les liens à la réception) → non compté.
 * Relevé réel du 10/10/2026 : un clic 14 s après l'envoi d'un guide.
 */
export const BOT_CLICK_SECONDS = 15;

/** Statut d'appel qui bloque l'alerte « lead chaud » (le score reste calculé) */
export const NO_CALL_STATUSES: readonly string[] = ["Ne plus appeler"];

/** Tags d'emails internes jamais scorés (alertes envoyées à l'équipe) */
export const INTERNAL_EMAIL_TAGS: readonly string[] = ["alerte-sequences", "alerte-lead-chaud", "alerte-quota"];

/** Quota d'envoi Brevo (offre Free) et seuil d'alerte (emails restants dans la journée) */
export const BREVO_DAILY_LIMIT = 300;
export const QUOTA_ALERT_REMAINING = 60;
