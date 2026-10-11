/**
 * États commerciaux lus dans Brevo (écrits par l'équipe / le CRM), classés
 * EXPLICITEMENT. Valeurs relevées dans Brevo le 12/10/2026 (1 796 contacts).
 * Une valeur non reconnue n'est jamais interprétée : état UNKNOWN (prudence).
 *
 * Le contrat Codex (docs/integrations/brevo-crm-v1.md) pourra ajouter des
 * champs CRM_* : les raccorder ICI après relecture du contrat, pas avant.
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
    "rdv planifie": "MEETING_CONFIRMED",
    "rdv booke": "MEETING_CONFIRMED",
    "ne plus appeler": "DO_NOT_CALL",
    "non qualifie": "DISQUALIFIED",
  },
  ETAT_RDV: {
    prevu: "MEETING_CONFIRMED",
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
  "LOST",
  "OPPORTUNITY",
  "MEETING_CONFIRMED",
  "MEETING_TBD",
  "MEETING_CANCELLED",
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
 * explicitement demandé n'en dépend jamais. À VALIDER avec le contrat Codex.
 */
export const GUIDE_FOLLOWUP_ALLOWED: ReadonlySet<CommercialState> = new Set(["NONE", "IMPORTED"]);

/** Alerte « lead chaud » (= à appeler) : jamais pour une personne déjà prise en charge ou refusant l'appel. */
export const HOT_ALERT_ALLOWED: ReadonlySet<CommercialState> = new Set(["NONE", "IMPORTED"]);

export { norm as normalizeCommercialValue };
