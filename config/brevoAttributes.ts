/**
 * Attributs de contact Brevo utilisés par le système.
 *
 * EXISTING : déjà présents dans le compte (vérifiés le 08/10/2026), réutilisés
 *            tels quels. Ne pas créer d'équivalents (FIRSTNAME, LASTNAME,
 *            COMPANY, PHONE…).
 * NEW      : créés par `npm run brevo:attributes -- --apply` s'ils manquent.
 *
 * Les énumérations sont en type TEXTE (comme tous les attributs existants du
 * compte) : valeurs contrôlées dans config/taxonomy.ts, filtrables en
 * segment avec « est égal à ».
 */

export const EXISTING_ATTRIBUTES = [
  "NOM",
  "PRENOM",
  "SMS",
  "ENTREPRISE",
  "JOB_TITLE",
  "LINKEDIN",
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "SOURCE_INSCRIPTION",
  "RESSOURCE",
  "DATE_OPTIN",
  "OPT_IN",
  "TEL_DOUBLON",
] as const;

export interface NewAttribute {
  name: string;
  type: "text" | "float" | "date";
  description: string;
}

export const NEW_ATTRIBUTES: NewAttribute[] = [
  { name: "VERTICAL", type: "text", description: "Verticale métier (FINANCE, MARKETING…)" },
  { name: "SUBSECTOR", type: "text", description: "Sous-secteur (EXPERTISE_COMPTABLE, DAF_FINANCE…)" },
  { name: "BESOIN_PRIORITAIRE", type: "text", description: "Objectif IA déclaré au formulaire" },
  { name: "HORIZON_PROJET", type: "text", description: "Horizon projet déclaré au formulaire" },
  { name: "UTM_CONTENT", type: "text", description: "Identifiant du contenu source (first touch)" },
  { name: "SOURCE_CONTENT_URL", type: "text", description: "URL du post source si connue (first touch)" },
  { name: "LIFECYCLE_STAGE", type: "text", description: "SUBSCRIBER → … → CLIENT / LOST" },
  { name: "LEAD_SCORE", type: "float", description: "Score d'intention, ne diminue jamais automatiquement" },
  { name: "EMAIL_STATUS", type: "text", description: "PENDING / VERIFIED / INVALID / DISPOSABLE / BOUNCED" },
  { name: "PHONE_STATUS", type: "text", description: "VALID_FORMAT / SUSPECT / INVALID / VERIFIED (humain)" },
  { name: "MARKETING_STATUS", type: "text", description: "CONSENT / B2B_ELIGIBLE / OPPOSED / TO_REVIEW" },
  { name: "MARKETING_OPTOUT_TOKEN", type: "text", description: "Jeton chiffré pour désinscription marketing n8n" },
  { name: "FORM_SCORE", type: "float", description: "Meilleur score formulaire (0 à 15)" },
  { name: "BEHAVIOR_SCORE", type: "float", description: "Score comportemental cumulé (clics, webinars, RDV), ne diminue jamais" },
  { name: "LAST_EMAIL_CLICK_AT", type: "date", description: "Dernier clic compté dans un email" },
  { name: "LAST_ENGAGEMENT_AT", type: "date", description: "Dernier signal comportemental compté" },
  { name: "SCORE_UPDATED_AT", type: "date", description: "Dernière hausse de LEAD_SCORE par le scoring" },
  { name: "HOT_ALERT_SENT_AT", type: "date", description: "Alerte « lead chaud » envoyée (une seule fois)" },
  { name: "GUIDE_DELIVERY_STATUS", type: "text", description: "Livraison du guide par le moteur : PENDING / SENT / FAILED / EXPIRED" },
  { name: "GUIDE_DELIVERY_REF", type: "text", description: "Livraison en cours : séquence|guide|date (reprise automatique)" },
  {
    name: "EMAIL_CONFIRM_TOKEN",
    type: "text",
    description: "Jeton chiffré du lien « Confirmer mon adresse » (email de bienvenue)",
  },
];

/** Attributs first touch : jamais écrasés s'ils sont déjà renseignés. */
export const FIRST_TOUCH_ATTRIBUTES = [
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "UTM_CONTENT",
] as const;
