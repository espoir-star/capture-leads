/**
 * Test de maturité IA (site althoce.com) → base marketing Brevo.
 *
 * Le site envoie le lead à n8n, qui livre le résultat en PDF (Brevo
 * transactionnel, hors de ce dépôt) puis appelle POST /api/intake/test-maturite
 * pour les visiteurs sans demande de rappel ni opposition. Contrat, rollout et
 * appel n8n : docs/INTAKE_TEST_MATURITE.md.
 *
 *   ALTHOCE_INTAKE_TEST_MATURITE  vide / off = route fermée (503) ;
 *                                 « qa » = seules les adresses de
 *                                 ALTHOCE_SEQUENCE_QA_EMAILS entrent dans Brevo,
 *                                 les autres sont ignorées (200 skipped) ;
 *                                 « on » = tous les visiteurs.
 *   BREVO_LIST_TEST_MATURITE      ID réel de la liste « LM - Test de maturité IA »,
 *                                 obligatoire dès que la route est ouverte.
 */
import type { Subsector, Vertical } from "@/config/taxonomy";

type Env = Record<string, string | undefined>;

export const TEST_MATURITE = {
  /** SOURCE_INSCRIPTION du contact créé, et identifiant dans les journaux */
  source: "test-maturite-ia",
  /** RESSOURCE du contact créé */
  resource: "Test de maturité IA",
  brevoListName: "LM - Test de maturité IA",
  pageUrl: "https://althoce.com/test-maturite-ia/",
  /** Lien de partage du résultat, construit par le site (lib/maturite/lead.ts) */
  resultPrefix: "https://althoce.com/test-maturite-ia/#resultat=",
} as const;

export interface SecteurMapping {
  /** Libellé affiché par le test (lib/maturite/questions.ts du site) */
  label: string;
  vertical: Vertical;
  subsector: Subsector | null;
  note?: string;
}

const GENERAL = (label: string): SecteurMapping => ({ label, vertical: "GENERAL", subsector: null });

/**
 * Secteurs du test → VERTICAL / SUBSECTOR (codes de config/taxonomy.ts).
 * Même règle que config/leadMagnets.ts : un sous-secteur ambigu reste null,
 * jamais deviné (il est ensuite conservé sur le contact). La verticale pilote
 * MARKETING_STATUS : GENERAL → TO_REVIEW, sinon B2B_ELIGIBLE.
 */
export const TEST_MATURITE_SECTEURS = {
  finance: {
    label: "Finance", vertical: "FINANCE", subsector: null,
    note: "Page secteur du site : « Établissements financiers · Fintech · Directions financières ». DAF_FINANCE n'en couvre qu'une partie : sous-secteur non prouvé.",
  },
  comptabilite: { label: "Expertise comptable", vertical: "FINANCE", subsector: "EXPERTISE_COMPTABLE" },
  droit: {
    label: "Droit & professions juridiques", vertical: "LEGAL", subsector: null,
    note: "Aucun code SUBSECTOR juridique (comme claude-droit-10-cas-usage).",
  },
  medical: GENERAL("Santé & médical"),
  "assurance-patrimoine": {
    label: "Assurance, courtage & patrimoine", vertical: "FINANCE", subsector: "ASSURANCE",
    note: "Correspondance proposée par Espoir (19/11/2026). Le conseil en patrimoine n'est pas strictement de l'assurance : à revoir si un code dédié est créé.",
  },
  immobilier: GENERAL("Immobilier"),
  "commerce-distribution": GENERAL("Commerce"),
  hotellerie: GENERAL("Hôtellerie"),
  "retail-luxe": GENERAL("Retail & luxe"),
  industrie: GENERAL("Industrie"),
  "marketing-communication": { label: "Agences marketing & communication", vertical: "MARKETING", subsector: "AGENCE_MARKETING" },
  associations: GENERAL("Associations & fédérations"),
  "secteur-public": GENERAL("Secteur public & collectivités"),
  autre: GENERAL("Autre activité"),
} satisfies Record<string, SecteurMapping>;

export type SecteurSlug = keyof typeof TEST_MATURITE_SECTEURS;
export const SECTEUR_SLUGS = Object.keys(TEST_MATURITE_SECTEURS) as [SecteurSlug, ...SecteurSlug[]];

/** Tranches d'effectif du test (identifiants, pas les libellés) */
export const TAILLES = ["solo", "2-9", "10-49", "50-199", "200+"] as const;
export type Taille = (typeof TAILLES)[number];

export type IntakeMode = "off" | "qa" | "on";

export function testMaturiteIntakeMode(env: Env = process.env): IntakeMode {
  const v = env.ALTHOCE_INTAKE_TEST_MATURITE?.trim().toLowerCase();
  return v === "on" ? "on" : v === "qa" ? "qa" : "off";
}

/** Adresse de recette (ALTHOCE_SEQUENCE_QA_EMAILS, même liste que les autres bascules). */
export function isQaEmail(email: string, env: Env = process.env): boolean {
  return (env.ALTHOCE_SEQUENCE_QA_EMAILS ?? "")
    .split(/[,;\s]+/).map((v) => v.trim().toLowerCase()).filter(Boolean)
    .includes(email.trim().toLowerCase());
}

/** ID de la liste dédiée, ou null si absent / invalide (la route refuse alors d'écrire). */
export function testMaturiteListId(env: Env = process.env): number | null {
  const raw = env.BREVO_LIST_TEST_MATURITE?.trim() ?? "";
  if (!/^[1-9]\d{0,8}$/.test(raw)) return null;
  return Number(raw);
}
