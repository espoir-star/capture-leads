/**
 * États commerciaux lus dans Brevo (écrits par l'équipe / le CRM), classés
 * EXPLICITEMENT. Valeurs relevées dans Brevo le 12/10/2026 (1 796 contacts).
 * Une valeur non reconnue n'est jamais interprétée : état UNKNOWN (prudence).
 *
 * Contrat commun : docs/INTEGRATION_CRM.md. Les projections CRM versionnées
 * priment sur les anciens libellés, sauf les refus qui restent prioritaires.
 */

export type CommercialState =
  | "NONE" // aucune donnée commerciale
  | "IMPORTED" // fiche importée / à traiter : ni contact, ni RDV
  | "ATTEMPTED" // tentative sans échange abouti (à rappeler, à relancer)
  | "REACHED" // échange abouti
  | "MEETING_TBD" // RDV évoqué, non confirmé (« À préciser », type de RDV seul)
  | "MEETING_CONFIRMED" // RDV confirmé
  | "MEETING_CANCELLED" // RDV annulé, reporté ou absence
  | "OPPORTUNITY" // négociation, devis, closing
  | "DEFERRED" // projet reporté, suivi commercial
  | "CLIENT"
  | "ARCHIVED"
  | "LOST"
  | "DISQUALIFIED" // non qualifié par l'équipe
  | "DO_NOT_CALL" // refus d'être appelé : aucune sollicitation contraire
  | "UNKNOWN"; // valeur non reconnue

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");

/** Correspondances par attribut (clés normalisées : minuscules, sans accents) */
export const COMMERCIAL_VALUE_MAP: Readonly<Record<string, Readonly<Record<string, CommercialState>>>> = {
  STATUT_APPEL: {
    "a appeler": "IMPORTED",
    "a rappeler": "ATTEMPTED",
    "a relancer": "ATTEMPTED",
    contacte: "REACHED",
    "rdv planifie": "MEETING_TBD",
    "rdv booke": "MEETING_TBD",
    "ne plus appeler": "DO_NOT_CALL",
    "non qualifie": "DISQUALIFIED",
  },
  ETAT_RDV: {
    prevu: "MEETING_TBD",
    confirme: "MEETING_CONFIRMED",
    "a preciser": "MEETING_TBD",
    annule: "MEETING_CANCELLED",
    reporte: "MEETING_CANCELLED",
    absent: "MEETING_CANCELLED",
    "non venu": "MEETING_CANCELLED",
  },
  ETAPE_COMMERCIALE: {
    negociation: "OPPORTUNITY",
    "devis envoye": "OPPORTUNITY",
    "r2 — rendez-vous de closing": "OPPORTUNITY",
    "projet reporte — a suivre": "DEFERRED",
  },
  LIFECYCLE_STAGE: {
    subscriber: "NONE",
    lead: "NONE",
    mql: "NONE",
    hot_lead: "NONE",
    contacted: "REACHED",
    meeting_booked: "MEETING_CONFIRMED",
    opportunity: "OPPORTUNITY",
    client: "CLIENT",
    lost: "LOST",
  },
};

/** Ordre de priorité : l'état le plus engageant (ou le refus) l'emporte. */
export const COMMERCIAL_PRECEDENCE: readonly CommercialState[] = [
  "DO_NOT_CALL",
  "CLIENT",
  "ARCHIVED",
  "LOST",
  "OPPORTUNITY",
  "MEETING_CANCELLED",
  "MEETING_CONFIRMED",
  "MEETING_TBD",
  "DISQUALIFIED",
  "DEFERRED",
  "REACHED",
  "ATTEMPTED",
  "UNKNOWN",
  "IMPORTED",
  "NONE",
];

/**
 * Relance marketing des guides autorisée seulement AVANT toute prise en charge
 * réelle (aucune donnée, ou fiche importée à traiter). La livraison d'un guide
 * explicitement demandé n'en dépend jamais. Voir le contrat commun.
 */
export const GUIDE_FOLLOWUP_ALLOWED: ReadonlySet<CommercialState> = new Set(["NONE", "IMPORTED"]);

/** Alerte « lead chaud » (= à appeler) : jamais pour une personne déjà prise en charge ou refusant l'appel. */
export const HOT_ALERT_ALLOWED: ReadonlySet<CommercialState> = new Set(["NONE", "IMPORTED"]);

export { norm as normalizeCommercialValue };

/** Valeurs exactes émises par le CRM ; MEETING_BOOKED reste un alias de transition non confirmé. */
export const CRM_SALES_STATES: Readonly<Record<string, CommercialState>> = {
  RECEIVED: "IMPORTED", ASSIGNED: "IMPORTED", TAKEN_IN_CHARGE: "ATTEMPTED",
  NO_ANSWER: "ATTEMPTED", CONTACTED: "REACHED", MEETING_PENDING: "MEETING_TBD",
  MEETING_BOOKED: "MEETING_TBD", MEETING_CONFIRMED: "MEETING_CONFIRMED",
  MEETING_CANCELLED: "MEETING_CANCELLED", OPPORTUNITY: "OPPORTUNITY", CLIENT: "CLIENT",
  LOST: "LOST", DISQUALIFIED: "DISQUALIFIED", ARCHIVED: "ARCHIVED",
  DO_NOT_CALL: "DO_NOT_CALL", OPPOSED: "DO_NOT_CALL",
};
