/**
 * Scoring et cycle de vie — volontairement simple et lisible.
 *
 * Score formulaire = horizon + besoin (max 15), conservé dans FORM_SCORE.
 * LEAD_SCORE = max(existant, formulaire + comportement), plafonné à 100.
 * Le score ne diminue jamais automatiquement.
 */

import type { Besoin, EmailStatus, Horizon, LifecycleStage, PhoneStatus } from "@/config/taxonomy";
import { LIFECYCLE_STAGES } from "@/config/taxonomy";

export const HORIZON_SCORES: Record<Horizon, number> = {
  IMMEDIAT: 10,
  MOINS_3_MOIS: 7,
  TROIS_SIX_MOIS: 4,
  SIX_DOUZE_MOIS: 2,
  PAS_DE_PROJET: 0,
};

export const BESOIN_SCORES: Record<Besoin, number> = {
  DEPLOYER_AGENT_IA: 5,
  AUTOMATISER_PROCESS: 5,
  DIAGNOSTIC_STRATEGIE: 4,
  FORMER_EQUIPES: 3,
  VEILLE_IA: 1,
  AUTRE: 1,
};

export const MAX_FORM_SCORE = 15;

/** Seuil du segment « leads chauds » et de la promotion HOT_LEAD */
export const HOT_LEAD_THRESHOLD = 25;

/* Scoring comportemental (clics, webinars, RDV) : config/scoring.ts et lib/scoring/behavior.ts */

export function formIntentScore(besoin: Besoin, horizon: Horizon): number {
  return Math.min(MAX_FORM_SCORE, (HORIZON_SCORES[horizon] ?? 0) + (BESOIN_SCORES[besoin] ?? 0));
}

export function toScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function mergeScore(existing: unknown, formScore: number): number {
  return Math.max(toScore(existing), formScore);
}

/* ── Éligibilités (data quality) ─────────────────────────────────────── */

const EMAIL_EXCLUDED: ReadonlySet<string> = new Set(["INVALID", "DISPOSABLE", "BOUNCED"]);

/** Un email INVALID / DISPOSABLE / BOUNCED ne génère jamais de HOT_LEAD ni de marketing. */
export function isEmailMarketable(status: EmailStatus | string | undefined): boolean {
  return !EMAIL_EXCLUDED.has(String(status ?? ""));
}

/** PHONE_STATUS = INVALID ne génère jamais de tâche d'appel. SUSPECT reste appelable mais signalé. */
export function isCallable(status: PhoneStatus | string | undefined): boolean {
  return !!status && status !== "INVALID";
}

/* ── Cycle de vie ────────────────────────────────────────────────────── */

const STAGE_INDEX = new Map<string, number>(LIFECYCLE_STAGES.map((s, i) => [s, i]));

/**
 * Étape après une capture. Ne rétrograde jamais, ne touche pas aux étapes
 * commerciales (CONTACTED et au-delà) ni à une valeur inconnue saisie à la main.
 */
export function nextLifecycleStage(
  current: string | undefined,
  ctx: { score: number; emailStatus: EmailStatus }
): LifecycleStage | string {
  const cur = (current ?? "").trim();
  if (cur && !STAGE_INDEX.has(cur)) return cur;

  let stage: LifecycleStage = !cur || cur === "SUBSCRIBER" ? "LEAD" : (cur as LifecycleStage);
  if (
    (stage === "LEAD" || stage === "MQL") &&
    ctx.score >= HOT_LEAD_THRESHOLD &&
    isEmailMarketable(ctx.emailStatus)
  ) {
    stage = "HOT_LEAD";
  }
  return stage;
}
