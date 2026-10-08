/**
 * Valeurs de référence partagées (formulaire, serveur, scripts Brevo).
 *
 * Les CODES sont ceux écrits dans Brevo : ne jamais les renommer une fois
 * en production (les segments Brevo filtrent sur ces valeurs exactes).
 * Les LIBELLÉS sont ceux affichés aux prospects : modifiables librement.
 */

/* ── Verticales / sous-secteurs (qui est le contact) ─────────────────── */

export const VERTICALS = [
  "FINANCE",
  "MARKETING",
  "SALES",
  "RH",
  "CUSTOMER_CARE",
  "LEGAL",
  "GENERAL",
] as const;
export type Vertical = (typeof VERTICALS)[number];

/** Liste extensible : ajouter un code ici suffit (pas de migration Brevo, attribut texte). */
export const SUBSECTORS = [
  "EXPERTISE_COMPTABLE",
  "AUDIT_CAC",
  "DAF_FINANCE",
  "PRIVATE_EQUITY_VC",
  "BANQUE",
  "ASSURANCE",
  "M_AND_A",
  "ASSET_MANAGEMENT",
  "ECOMMERCE",
  "AGENCE_MARKETING",
] as const;
export type Subsector = (typeof SUBSECTORS)[number];

/* ── Questions du formulaire ─────────────────────────────────────────── */

export const BESOINS = [
  { code: "AUTOMATISER_PROCESS", label: "Automatiser des tâches ou processus" },
  { code: "DEPLOYER_AGENT_IA", label: "Déployer un agent IA" },
  { code: "FORMER_EQUIPES", label: "Former mes équipes" },
  {
    code: "DIAGNOSTIC_STRATEGIE",
    label: "Identifier les opportunités IA dans mon entreprise",
  },
  { code: "VEILLE_IA", label: "Mieux comprendre / suivre l’IA" },
  { code: "AUTRE", label: "Autre" },
] as const;
export type Besoin = (typeof BESOINS)[number]["code"];
export const BESOIN_CODES = BESOINS.map((b) => b.code) as [Besoin, ...Besoin[]];

export const HORIZONS = [
  { code: "IMMEDIAT", label: "Dès maintenant" },
  { code: "MOINS_3_MOIS", label: "Dans les 3 prochains mois" },
  { code: "TROIS_SIX_MOIS", label: "Dans 3 à 6 mois" },
  { code: "SIX_DOUZE_MOIS", label: "Dans 6 à 12 mois" },
  { code: "PAS_DE_PROJET", label: "Je n’ai pas encore de projet défini" },
] as const;
export type Horizon = (typeof HORIZONS)[number]["code"];
export const HORIZON_CODES = HORIZONS.map((h) => h.code) as [Horizon, ...Horizon[]];

export const LABEL_BESOIN = "Quel est votre principal objectif avec l’IA ?";
export const LABEL_HORIZON = "À quel horizon souhaitez-vous avancer ?";

/* ── Cycle de vie / qualité de données ───────────────────────────────── */

/** Ordre = progression. Un nouveau lead entre en LEAD. */
export const LIFECYCLE_STAGES = [
  "SUBSCRIBER",
  "LEAD",
  "MQL",
  "HOT_LEAD",
  "CONTACTED",
  "MEETING_BOOKED",
  "OPPORTUNITY",
  "CLIENT",
  "LOST",
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const EMAIL_STATUSES = [
  "PENDING",
  "VERIFIED",
  "INVALID",
  "DISPOSABLE",
  "BOUNCED",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** VERIFIED est posé UNIQUEMENT par un commercial après un appel abouti. */
export const PHONE_STATUSES = [
  "VALID_FORMAT",
  "SUSPECT",
  "INVALID",
  "VERIFIED",
] as const;
export type PhoneStatus = (typeof PHONE_STATUSES)[number];

/* ── Pays proposés pour le téléphone ─────────────────────────────────── */

/** France + pays où Althoce a déjà des leads. `iso` sert au parsing libphonenumber. */
export const PHONE_COUNTRIES = [
  { iso: "FR", dial: "33", label: "France", flag: "🇫🇷" },
  { iso: "BE", dial: "32", label: "Belgique", flag: "🇧🇪" },
  { iso: "CH", dial: "41", label: "Suisse", flag: "🇨🇭" },
  { iso: "LU", dial: "352", label: "Luxembourg", flag: "🇱🇺" },
  { iso: "CA", dial: "1", label: "Canada / États-Unis", flag: "🇨🇦" },
  { iso: "MA", dial: "212", label: "Maroc", flag: "🇲🇦" },
  { iso: "DZ", dial: "213", label: "Algérie", flag: "🇩🇿" },
  { iso: "TN", dial: "216", label: "Tunisie", flag: "🇹🇳" },
  { iso: "CI", dial: "225", label: "Côte d'Ivoire", flag: "🇨🇮" },
  { iso: "SN", dial: "221", label: "Sénégal", flag: "🇸🇳" },
  { iso: "CM", dial: "237", label: "Cameroun", flag: "🇨🇲" },
  { iso: "GB", dial: "44", label: "Royaume-Uni", flag: "🇬🇧" },
  { iso: "DE", dial: "49", label: "Allemagne", flag: "🇩🇪" },
  { iso: "ES", dial: "34", label: "Espagne", flag: "🇪🇸" },
  { iso: "IT", dial: "39", label: "Italie", flag: "🇮🇹" },
  { iso: "PT", dial: "351", label: "Portugal", flag: "🇵🇹" },
] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["iso"];
export const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((c) => c.iso) as [
  PhoneCountry,
  ...PhoneCountry[],
];
