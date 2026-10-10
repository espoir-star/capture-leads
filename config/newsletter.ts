/**
 * Newsletter-as-code : expéditeur, tags, audiences, segments Brevo.
 *
 * Les segments se créent À LA MAIN dans Brevo (l'API officielle ne permet que
 * de les lire) : docs/BREVO_SETUP.md § 5. Chaque segment est référencé par son
 * NOM EXACT ; `npm run brevo:segments` affiche les IDs réels trouvés dans
 * Brevo. Recopier ici les IDs (`id`) pour figer la référence ; tant qu'un ID
 * est null, les scripts le résolvent par le nom exact et refusent s'il est
 * introuvable. Aucun ID fictif.
 */

import { REPLY_TO, SENDERS } from "@/config/senders";

/** Althoce <newsletter@althoce.fr>, réponses sur espoir@contact.althoce.com (config/senders.ts) */
export const NEWSLETTER_SENDER = SENDERS.newsletter;

export const NEWSLETTER_REPLY_TO = REPLY_TO;

export const CAMPAIGN_TAGS = [
  "NL_FINANCE",
  "NL_EXPERT_COMPTABLE",
  "NL_MARKETING",
  "WEBINAR_FINANCE",
  "CASE_STUDY",
  "COMMERCIAL",
] as const;
export type CampaignTag = (typeof CAMPAIGN_TAGS)[number];

export interface SegmentRef {
  /** Nom exact du segment dans Brevo */
  name: string;
  /** ID réel (Brevo → Contacts → Segments), null tant qu'il n'est pas recopié. Créés le 09/10/2026. */
  id: number | null;
  /** Conditions à saisir dans Brevo */
  conditions: string;
}

const EMAIL_OK = "EMAIL_STATUS ≠ INVALID ET ≠ DISPOSABLE ET ≠ BOUNCED";
const MARKETING_OK = "(MARKETING_STATUS = CONSENT OU MARKETING_STATUS = B2B_ELIGIBLE) ET MARKETING_STATUS ≠ OPPOSED";

export const SEGMENTS = {
  financeAll: { name: "FINANCE — ALL", id: 1, conditions: "VERTICAL = FINANCE" },
  financeEc: {
    name: "FINANCE — EXPERTISE COMPTABLE",
    id: 2,
    conditions: "VERTICAL = FINANCE ET SUBSECTOR = EXPERTISE_COMPTABLE",
  },
  financeDaf: { name: "FINANCE — DAF", id: 3, conditions: "VERTICAL = FINANCE ET SUBSECTOR = DAF_FINANCE" },
  dqReview: { name: "DATA QUALITY — REVIEW", id: 4, conditions: "EMAIL_STATUS = PENDING OU PHONE_STATUS = SUSPECT" },
  dqRejected: {
    name: "DATA QUALITY — REJECTED",
    id: 5,
    conditions: "EMAIL_STATUS = INVALID OU = DISPOSABLE OU = BOUNCED",
  },
  leadsHot: {
    name: "LEADS — HOT",
    id: 6,
    conditions: `LEAD_SCORE ≥ 25 ET LIFECYCLE_STAGE ≠ CLIENT ET ≠ LOST ET ${EMAIL_OK} ET PHONE_STATUS ≠ INVALID`,
  },
  newsletterFinance: {
    name: "NEWSLETTER — FINANCE",
    id: 7,
    conditions: `VERTICAL = FINANCE ET ${MARKETING_OK} ET ${EMAIL_OK} (blocklistés exclus d'office par Brevo)`,
  },
  newsletterEc: {
    name: "NEWSLETTER — EXPERTISE COMPTABLE",
    id: 8,
    conditions: `VERTICAL = FINANCE ET SUBSECTOR = EXPERTISE_COMPTABLE ET ${MARKETING_OK} ET ${EMAIL_OK}`,
  },
  newsletterDaf: {
    name: "NEWSLETTER — DAF",
    id: 9,
    conditions: `VERTICAL = FINANCE ET SUBSECTOR = DAF_FINANCE ET ${MARKETING_OK} ET ${EMAIL_OK}`,
  },
} satisfies Record<string, SegmentRef>;

export interface Audience {
  label: string;
  /** Segment destinataire */
  segment: SegmentRef;
  /** Segments exclus (sécurité supplémentaire) */
  exclude: SegmentRef[];
}

/**
 * Newsletter : consentement ancien OU B2B éligible, jamais un opposant.
 * EMAIL_STATUS n'est jamais utilisé comme substitut de consentement.
 */
export const AUDIENCES: Record<string, Audience> = {
  finance: { label: "Newsletter Finance", segment: SEGMENTS.newsletterFinance, exclude: [SEGMENTS.dqRejected] },
  "expertise-comptable": {
    label: "Newsletter Expertise comptable",
    segment: SEGMENTS.newsletterEc,
    exclude: [SEGMENTS.dqRejected],
  },
  daf: { label: "Newsletter DAF", segment: SEGMENTS.newsletterDaf, exclude: [SEGMENTS.dqRejected] },
};

/** Fuseau d'affichage des dates en dry run */
export const NEWSLETTER_TIMEZONE = "Europe/Paris";
