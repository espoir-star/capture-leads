/**
 * ═══════════════════════════════════════════════════════════════
 *  WEBINARS → BREVO  (fondation, aucun webinar réel défini)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Parcours cible :
 *    landing /w/[slug] → webinar_registered → email de confirmation (automation
 *    Brevo sur la liste) → J-1 → H-1 → webinar → présent / absent
 *    → replay (webinar_replay_clicked) → CTA (webinar_cta_clicked) → scoring
 *
 *  Ajouter un webinar = ajouter un bloc ci-dessous UNIQUEMENT quand la date,
 *  la plateforme et l'URL sont réellement connues (ne rien inventer).
 *  Étapes complètes : docs/BREVO_SETUP.md § Webinars.
 */

import type { Subsector, Vertical } from "@/config/taxonomy";

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
  /** Date ISO avec fuseau, ex. "2026-11-20T12:30:00+01:00" */
  startsAt: string;
  durationMin: number;
  platform: "zoom" | "livestorm" | "teams" | "google_meet" | "autre";
  /** Lien de connexion : envoyé par email uniquement, jamais affiché sur la page */
  joinUrl?: string;
  replayUrl?: string;
  status: "draft" | "open" | "closed" | "done";
}

export const WEBINARS: Record<string, WebinarConfig> = {};

export function getWebinar(slug: string): WebinarConfig | undefined {
  return Object.prototype.hasOwnProperty.call(WEBINARS, slug) ? WEBINARS[slug] : undefined;
}

/** Webinars ouverts aux inscriptions (pages générées) */
export function getOpenWebinarSlugs(): string[] {
  return Object.values(WEBINARS)
    .filter((w) => w.status === "open")
    .map((w) => w.slug);
}
