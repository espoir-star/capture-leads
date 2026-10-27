/**
 * ═══════════════════════════════════════════════════════════════
 *  WEBINARS → BREVO  (premier webinar réel : 5 novembre 2026)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Parcours (docs/WEBINAIRES.md) :
 *    landing /w/[slug] → webinar_registered → moteur de séquences (confirmation,
 *    J-1, H-1, replay, suivi ; modèles 45-49) → lien personnel /rejoindre
 *    (webinar_attended, activité qualifiante pour le CRM) → replay personnel
 *
 *  Ajouter un webinar = ajouter un bloc ci-dessous UNIQUEMENT quand le titre,
 *  la date, l'intervenant et la liste Brevo sont réellement connus (ne rien
 *  inventer). Procédure et checklist : docs/WEBINAIRES.md.
 *
 *  ⚠ Dépôt PUBLIC : la salle Google Meet et l'enregistrement ne sont JAMAIS
 *  écrits ici. Ils vivent dans les variables Vercel WEBINAR_JOIN_URL__<SLUG>
 *  et WEBINAR_REPLAY_URL__<SLUG> (lib/webinar/urls.ts).
 */

import type { SequenceId } from "@/config/sequences";
import { SENDERS, type Sender } from "@/config/senders";
import type { Subsector, Vertical } from "@/config/taxonomy";

/**
 * Expéditeur des emails webinar (confirmation, J-1, H-1, replay, suivi) dans
 * les automations Brevo : Althoce <bonjour@althoce.fr>, réponses sur
 * REPLY_TO. Un webinar peut en déclarer un autre via `sender`.
 */
export const WEBINAR_DEFAULT_SENDER: Sender = SENDERS.resources;

export interface WebinarConfig {
  slug: string;
  /** Valeur des propriétés d'événement `resource` (ex. "webinar-ia-cabinet-2026-11") */
  resource: string;
  /** Liste Brevo « WB - … » dédiée (déclenche confirmation + rappels) */
  brevoListId: number;
  brevoListName: string;
  vertical: Vertical | null;
  subsector: Subsector | null;
  note: string;
  title: string;
  /** Sous-titre affiché sur la landing */
  description: string;
  /** Public visé, affiché sur la landing (ex. « Experts-comptables et collaborateurs de cabinet ») */
  audience?: string;
  /** Programme : 3 à 5 points concrets */
  agenda?: string[];
  /** Intervenant affiché sur la landing */
  /** `photo` : image publique du dossier public/, ex. "/webinar/espoir-mwami.jpg" */
  speaker?: { name: string; role: string; photo?: string };
  /** Date ISO avec fuseau, ex. "2026-11-20T12:30:00+01:00" (heure de Paris) */
  startsAt: string;
  /** Durée totale annoncée : 60 = 45 min de présentation + 15 min de questions-réponses */
  durationMin: number;
  platform: "zoom" | "livestorm" | "teams" | "google_meet" | "autre";
  /**
   * Ressources annoncées, envoyées avec le replay (support, guide…). Liens PUBLICS uniquement :
   * un document privé passe par un partage Drive vérifié, comme le replay.
   */
  resources?: { title: string; url: string }[];
  /** Expéditeur des emails de ce webinar (défaut : WEBINAR_DEFAULT_SENDER) */
  sender?: Sender;
  /** Parcours email du moteur (ex. "webinar-standard-v1") ; absent = automation Brevo sur la liste */
  sequence?: SequenceId;
  status: "draft" | "open" | "closed" | "done";
  /**
   * Recette interne : inscriptions réservées aux adresses Althoce (et ALTHOCE_SEQUENCE_QA_EMAILS),
   * contacts marqués IS_QA (exclus du CRM), page non indexée et bandeau « recette ».
   */
  internalTest?: boolean;
}

/** Domaines autorisés à s'inscrire à un webinar de recette interne. */
export const INTERNAL_TEST_DOMAINS = ["contact.althoce.com", "althoce.fr", "althoce.com"] as const;

export function isInternalTester(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1] ?? "";
  const qa = new Set((env.ALTHOCE_SEQUENCE_QA_EMAILS ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean));
  return (INTERNAL_TEST_DOMAINS as readonly string[]).includes(domain) || qa.has(e);
}

export const WEBINARS: Record<string, WebinarConfig> = {
  /* Recette interne du parcours complet (22 → 26/10/2026), demandée par Espoir le 22/10.
   * Salle Meet : variable Vercel WEBINAR_JOIN_URL__TEST_PARCOURS_WEBINAIRE (jamais ici). */
  "test-parcours-webinaire": {
    slug: "test-parcours-webinaire",
    resource: "test-parcours-webinaire",
    brevoListId: 20,
    brevoListName: "WB - TEST Parcours webinaire (recette interne)",
    vertical: "FINANCE",
    subsector: null,
    note: "Recette interne : inscriptions réservées aux adresses Althoce, contacts IS_QA.",
    title: "TEST — Parcours webinaire Althoce",
    description: "Recette interne du parcours : inscription, rappels, salle Meet par lien personnel, présence, replay et suivi.",
    audience: "Équipe Althoce (recette interne)",
    agenda: ["Inscription et confirmation", "Rappels la veille et une heure avant", "Connexion par le lien personnel", "Sondage de présence, replay et suivi"],
    speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce" },
    startsAt: "2026-10-23T17:00:00+02:00",
    durationMin: 30,
    platform: "google_meet",
    resources: [{ title: "Guide Claude × Pennylane (ressource d'exemple)", url: "https://guide-gratuit-pi.vercel.app/g/claude-pennylane" }],
    sequence: "webinar-standard-v1",
    status: "open",
    internalTest: true,
  },
  /* Recette n° 2 (26/10/2026, demandée par Espoir le 24/10) : la n° 1 a validé inscription et rappels,
   * mais personne n'est entré pendant la fenêtre. Celle-ci couvre salle, sondage de présence et replay.
   * Salle Meet : variable Vercel WEBINAR_JOIN_URL__TEST_PARCOURS_WEBINAIRE_2 (jamais ici). */
  "test-parcours-webinaire-2": {
    slug: "test-parcours-webinaire-2",
    resource: "test-parcours-webinaire-2",
    brevoListId: 21,
    brevoListName: "WB - TEST Parcours webinaire 2 (recette interne)",
    vertical: "FINANCE",
    subsector: null,
    note: "Recette interne n° 2 : inscriptions réservées aux adresses Althoce, contacts IS_QA.",
    title: "TEST 2 — Parcours webinaire Althoce",
    description: "Recette interne n° 2 : entrée dans la salle Meet par le lien personnel, sondage de présence, replay et suivi.",
    audience: "Équipe Althoce (recette interne)",
    agenda: ["Connexion par le lien personnel dès 9 h 00", "Enregistrement avec accord des participants", "Sondage de présence non anonyme", "Replay et suivi"],
    speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce" },
    startsAt: "2026-10-26T09:15:00+01:00",
    durationMin: 15,
    platform: "google_meet",
    resources: [{ title: "Guide Claude × Pennylane (ressource d'exemple)", url: "https://guide-gratuit-pi.vercel.app/g/claude-pennylane" }],
    sequence: "webinar-standard-v1",
    status: "open",
    internalTest: true,
  },
  /* Premier webinar réel, demandé par Espoir le 27/10/2026 à partir de son post LinkedIn
   * (« Commentez WEBINAIRE », lien d'inscription envoyé en privé : lien court wb1).
   * Événement Agenda espoir@contact.althoce.com avec Meet ; salle dans la variable Vercel
   * WEBINAR_JOIN_URL__CONNECTEURS_MCP_CABINETS (jamais ici). */
  "connecteurs-mcp-cabinets": {
    slug: "connecteurs-mcp-cabinets",
    resource: "webinar-connecteurs-mcp-2026-11",
    brevoListId: 23,
    brevoListName: "WB - Connecteurs MCP en écriture (05/11/2026)",
    vertical: "FINANCE",
    subsector: "EXPERTISE_COMPTABLE",
    note: "Webinar du 05/11/2026 : connecteurs MCP sur mesure (ACD, Cegid Quadra, Cegid Loop, Sage, AGIRIS), lecture et écriture.",
    title: "Connecteurs MCP\u00a0: votre IA lit et agit dans vos logiciels",
    description:
      "Votre logiciel de production n'a pas de connecteur IA officiel, ou seulement en lecture\u00a0? On vous montre comment le brancher, en écriture.",
    audience: "Experts-comptables, collaborateurs et dirigeants de cabinets",
    agenda: [
      "Démo en direct\u00a0: Claude dans un dossier, en lecture et en écriture",
      "Brancher ACD, Cegid Quadra, Cegid Loop, Sage et AGIRIS",
      "Ce que votre IA peut lire et faire, et les premiers usages au cabinet",
      "Ce qui ne marche pas encore, et les règles sur les données clients",
    ],
    speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce, cabinet de conseil et d'intégration IA", photo: "/webinar/espoir-mwami.jpg" },
    startsAt: "2026-11-05T11:00:00+01:00",
    durationMin: 60,
    platform: "google_meet",
    sequence: "webinar-standard-v1",
    status: "open",
  },
};

/**
 * Démonstration du gabarit, visible seulement hors Production (Preview Vercel, local).
 * Statut « draft » : la page s'affiche avec le formulaire désactivé et la capture
 * refuse toute inscription (seuls les webinars « open » sont acceptés).
 */
export const DEMO_WEBINAR: WebinarConfig = {
  slug: "demonstration-webinar",
  resource: "demonstration-webinar",
  brevoListId: 0,
  brevoListName: "",
  vertical: null,
  subsector: null,
  note: "Démonstration du gabarit : aucune inscription possible, jamais publiée en Production.",
  title: "Démonstration : votre premier webinaire IA",
  description: "Exemple de mise en page. Le vrai sujet, la date et l'intervenant seront renseignés à la création du webinar.",
  audience: "Experts-comptables, DAF et dirigeants",
  agenda: ["Exemple de point 1", "Exemple de point 2", "Exemple de point 3", "Questions-réponses en direct (15 min)"],
  speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce" },
  startsAt: "2026-12-03T12:30:00+01:00",
  durationMin: 60,
  platform: "google_meet",
  status: "draft",
};

type Env = Record<string, string | undefined>;
const isProduction = (env: Env) => env.VERCEL_ENV === "production";

/**
 * Webinar de recette automatique (tests E2E) : JAMAIS en Production, et seulement
 * si WEBINAR_E2E_STARTS_AT (date du direct simulé) est défini. Liste 9999 du faux Brevo.
 */
export const E2E_WEBINAR_SLUG = "webinar-e2e";
function e2eWebinar(env: Env): WebinarConfig | undefined {
  const startsAt = env.WEBINAR_E2E_STARTS_AT?.trim();
  if (isProduction(env) || !startsAt) return undefined;
  return {
    ...DEMO_WEBINAR, slug: E2E_WEBINAR_SLUG, resource: E2E_WEBINAR_SLUG, brevoListId: 9_999, brevoListName: "WB - Recette E2E",
    vertical: "FINANCE", subsector: "EXPERTISE_COMPTABLE", note: "Recette automatique, jamais en Production.",
    title: "Recette E2E", startsAt, status: "open", sequence: "webinar-standard-v1",
  };
}

export function getWebinar(slug: string, env: Env = process.env): WebinarConfig | undefined {
  if (Object.prototype.hasOwnProperty.call(WEBINARS, slug)) return WEBINARS[slug];
  if (slug === E2E_WEBINAR_SLUG) return e2eWebinar(env);
  return !isProduction(env) && slug === DEMO_WEBINAR.slug ? DEMO_WEBINAR : undefined;
}

/** Webinars ouverts aux inscriptions (pages générées) */
export function getOpenWebinarSlugs(): string[] {
  return Object.values(WEBINARS)
    .filter((w) => w.status === "open")
    .map((w) => w.slug);
}

/** Pages générées : webinars ouverts, plus la démonstration hors Production. */
export function getWebinarPageSlugs(env: Env = process.env): string[] {
  return [...getOpenWebinarSlugs(), ...(isProduction(env) ? [] : [DEMO_WEBINAR.slug]), ...(e2eWebinar(env) ? [E2E_WEBINAR_SLUG] : [])];
}
