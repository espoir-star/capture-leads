/**
 * ═══════════════════════════════════════════════════════════════
 *  WEBINARS → BREVO  (mécanique en place, aucun webinar réel défini)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Parcours (docs/WEBINAIRES.md) :
 *    landing /w/[slug] → webinar_registered → moteur de séquences (confirmation,
 *    J-1, H-1, replay, suivi ; modèles 45-49) → lien personnel /rejoindre
 *    (webinar_attended, activité qualifiante pour le CRM) → replay personnel
 *
 *  Ajouter un webinar = ajouter un bloc ci-dessous UNIQUEMENT quand la date,
 *  la plateforme et l'URL sont réellement connues (ne rien inventer).
 *  Étapes complètes : docs/BREVO_SETUP.md § Webinars.
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
  speaker?: { name: string; role: string };
  /** Date ISO avec fuseau, ex. "2026-11-20T12:30:00+01:00" */
  startsAt: string;
  durationMin: number;
  platform: "zoom" | "livestorm" | "teams" | "google_meet" | "autre";
  /**
   * Salle Google Meet : jamais affichée ni envoyée telle quelle. Chaque inscrit reçoit un lien
   * personnel /w/<slug>/rejoindre qui enregistre sa présence puis redirige ici (lib/webinar/access.ts).
   */
  joinUrl?: string;
  /** Enregistrement Meet (Drive, accès « tous les utilisateurs disposant du lien ») ; même principe de lien personnel */
  replayUrl?: string;
  /** Expéditeur des emails de ce webinar (défaut : WEBINAR_DEFAULT_SENDER) */
  sender?: Sender;
  /** Parcours email du moteur (ex. "webinar-standard-v1") ; absent = automation Brevo sur la liste */
  sequence?: SequenceId;
  status: "draft" | "open" | "closed" | "done";
}

export const WEBINARS: Record<string, WebinarConfig> = {};

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
  agenda: ["Exemple de point 1", "Exemple de point 2", "Exemple de point 3", "Questions-réponses en direct"],
  speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce" },
  startsAt: "2026-12-03T12:30:00+01:00",
  durationMin: 45,
  platform: "google_meet",
  status: "draft",
};

type Env = Record<string, string | undefined>;
const isProduction = (env: Env) => env.VERCEL_ENV === "production";

export function getWebinar(slug: string, env: Env = process.env): WebinarConfig | undefined {
  if (Object.prototype.hasOwnProperty.call(WEBINARS, slug)) return WEBINARS[slug];
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
  return [...getOpenWebinarSlugs(), ...(isProduction(env) ? [] : [DEMO_WEBINAR.slug])];
}
