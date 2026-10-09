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
  /** ID réel (Brevo → Contacts → Segments), null tant qu'il n'est pas recopié */
  id: number | null;
  /** Conditions à saisir dans Brevo */
  conditions: string;
}

const EMAIL_OK = "EMAIL_STATUS ≠ INVALID ET ≠ DISPOSABLE ET ≠ BOUNCED";

export const SEGMENTS = {
  financeAll: { name: "FINANCE — ALL", id: null, conditions: "VERTICAL = FINANCE" },
  financeEc: {
    name: "FINANCE — EXPERTISE COMPTABLE",
    id: null,
    conditions: "VERTICAL = FINANCE ET SUBSECTOR = EXPERTISE_COMPTABLE",
  },
  financeDaf: { name: "FINANCE — DAF", id: null, conditions: "VERTICAL = FINANCE ET SUBSECTOR = DAF_FINANCE" },
  dqReview: { name: "DATA QUALITY — REVIEW", id: null, conditions: "EMAIL_STATUS = PENDING OU PHONE_STATUS = SUSPECT" },
  dqRejected: {
    name: "DATA QUALITY — REJECTED",
    id: null,
    conditions: "EMAIL_STATUS = INVALID OU = DISPOSABLE OU = BOUNCED",
  },
  leadsHot: {
    name: "LEADS — HOT",
    id: null,
    conditions: `LEAD_SCORE ≥ 25 ET LIFECYCLE_STAGE ≠ CLIENT ET ≠ LOST ET ${EMAIL_OK} ET PHONE_STATUS ≠ INVALID`,
  },
  newsletterFinance: {
    name: "NEWSLETTER — FINANCE",
    id: null,
    conditions: `VERTICAL = FINANCE ET OPT_IN = Oui (true) ET ${EMAIL_OK} (désabonnés/blocklistés exclus d'office par Brevo)`,
  },
  newsletterEc: {
    name: "NEWSLETTER — EXPERTISE COMPTABLE",
    id: null,
    conditions: `VERTICAL = FINANCE ET SUBSECTOR = EXPERTISE_COMPTABLE ET OPT_IN = Oui (true) ET ${EMAIL_OK}`,
  },
  newsletterDaf: {
    name: "NEWSLETTER — DAF",
    id: null,
    conditions: `VERTICAL = FINANCE ET SUBSECTOR = DAF_FINANCE ET OPT_IN = Oui (true) ET ${EMAIL_OK}`,
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
 * Audiences newsletter : OPT_IN = true est obligatoire (consentement explicite).
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
