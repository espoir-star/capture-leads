/**
 * Moteur de séquences — logique PURE (tests/sequences.test.ts) : dates des
 * étapes, étape suivante, décision d'envoi. Aucun appel réseau.
 */

import type { BrevoContact } from "@/lib/brevo/api";
import { mayReceiveMarketing } from "@/lib/marketing/status";
import { STEP_STALE_AFTER_HOURS, type SequenceConfig, type SequenceStep } from "@/config/sequences";
import { GUIDE_FOLLOWUP_ALLOWED } from "@/config/commercialStates";
import { readCommercialState } from "@/lib/sequences/commercial";
import type { Enrollment } from "@/lib/sequences/enrollment";

const HOUR = 3_600_000;

/** Date prévue d'une étape, ou null si son ancre manque (webinar sans date) */
export function stepAt(enr: Enrollment, step: SequenceStep): number | null {
  // Livraison tardive (d > t) : le délai de relance court depuis la livraison réelle.
  const base = step.anchor === "event" ? enr.e : Math.max(enr.t, enr.d ?? enr.t);
  return base === undefined ? null : base + (step.offsetHours * HOUR) / (enr.k ?? 1);
}

/** Rappel avant l'événement (J-1, H-1) : il n'a de sens qu'avant le direct. */
export function isPreEventReminder(step: Pick<SequenceStep, "anchor" | "offsetHours">): boolean {
  return step.anchor === "event" && step.offsetHours < 0;
}

/**
 * Étapes ancrées sur le webinar : même date pour tous les inscrits. Le 04/11/2026, le J-1
 * envoyé à tous à la même seconde a vu la plupart des lectures du journal Brevo refusées :
 * envois étalés sur trois reprises de 30 min. Chaque inscrit a donc son créneau, stable,
 * dans les 5 minutes qui suivent (le H-1 reste toléré 30 min).
 */
export const EVENT_STEP_SPREAD_SECONDS = 300;
export function spreadMs(enr: Enrollment, step: Pick<SequenceStep, "anchor">): number {
  return step.anchor === "event" ? ((enr.c % EVENT_STEP_SPREAD_SECONDS) * 1000) / (enr.k ?? 1) : 0;
}

/** Délai des nouveaux essais de n8n après une erreur (n8n/althoce-sequences.json, retryDelayMinutes). */
export const N8N_RETRY_MINUTES = 30;
/** Rappel dont l'essai de n8n arriverait hors délai (H-1, J-1 tard le soir) : nouvel essai rapproché, décidé ici. */
export const SHORT_REMINDER_RETRY_MINUTES = 2;

/** Date du nouvel essai rapproché d'un rappel après une panne Brevo, ou null : n8n reprend dans 30 min. */
export function quickRetryAt(seq: SequenceConfig, enr: Enrollment, step: SequenceStep, now: number): number | null {
  const at = stepAt(enr, step);
  if (!isPreEventReminder(step) || at === null) return null;
  const deadline = at + staleAfterMs(seq, enr, step);
  if (now + N8N_RETRY_MINUTES * 60_000 <= deadline) return null;
  const retryAt = now + (SHORT_REMINDER_RETRY_MINUTES * 60_000) / (enr.k ?? 1);
  return retryAt <= deadline ? retryAt : null;
}

/** Pas de nouvel essai du replay plus souvent que toutes les 3 heures (avant compression QA). */
export const REPLAY_RETRY_HOURS = 3;
/** Sans étape suivante, attendre la publication du replay au plus 14 jours. */
const REPLAY_WAIT_MAX_HOURS = 14 * 24;

/**
 * Retard toléré avant de renoncer à une étape :
 *  - rappel avant l'événement : la moitié de son avance, au plus 12 h
 *    (J-1 jusqu'à la veille au soir, H-1 jusqu'à 30 min avant ; jamais après le début) ;
 *  - replay : jusqu'à l'étape suivante (suivi J+3), le temps que l'enregistrement soit publié ;
 *  - autres étapes : STEP_STALE_AFTER_HOURS.
 */
export function staleAfterMs(seq: SequenceConfig, enr: Enrollment, step: SequenceStep): number {
  const k = enr.k ?? 1;
  if (isPreEventReminder(step)) return Math.min(STEP_STALE_AFTER_HOURS * HOUR, (-step.offsetHours * HOUR) / 2) / k;
  if (step.requires === "replayUrl") {
    const at = stepAt(enr, step);
    const following = seq.steps.slice(seq.steps.indexOf(step) + 1).map((s) => stepAt(enr, s)).find((v) => v !== null);
    if (at !== null && following !== undefined && following !== null) return Math.max(STEP_STALE_AFTER_HOURS * HOUR, following - at);
    return (REPLAY_WAIT_MAX_HOURS * HOUR) / k;
  }
  return STEP_STALE_AFTER_HOURS * HOUR;
}

/**
 * Rappel inutile pour CET inscrit : son moment était déjà passé à l'inscription
 * (inscription la veille au soir : pas de « C'est demain » juste après la confirmation).
 */
export function registeredAfter(enr: Enrollment, step: SequenceStep): boolean {
  const at = stepAt(enr, step);
  return isPreEventReminder(step) && at !== null && at < enr.t;
}

/**
 * Prochaine étape à attendre après `afterStepId` (ou la première), en sautant
 * les étapes trop en retard (staleAfterMs) et les rappels antérieurs à
 * l'inscription (inscription tardive à un webinar).
 */
export function nextStep(
  seq: SequenceConfig,
  enr: Enrollment,
  afterStepId: string | null,
  now: number,
  opts: { transactionalOnly?: boolean } = {}
): { step: SequenceStep; at: number } | null {
  const start = afterStepId === null ? 0 : seq.steps.findIndex((s) => s.id === afterStepId) + 1;
  if (afterStepId !== null && start === 0) return null;
  for (const step of seq.steps.slice(start)) {
    if (opts.transactionalOnly && step.category !== "transactional") continue;
    const at = stepAt(enr, step);
    if (at === null) continue;
    if (at < now - staleAfterMs(seq, enr, step)) continue;
    if (registeredAfter(enr, step)) continue;
    return { step, at };
  }
  return null;
}

export type StepDecision =
  | { send: true }
  | { send: false; reason: "contact_absent" | "email_unusable" | "marketing_not_allowed" | "commercial_cycle" };

const UNUSABLE = ["INVALID", "DISPOSABLE", "BOUNCED"];

/**
 * Prise en charge commerciale (ou refus) : les relances marketing des guides
 * sont suspendues. Seuls « aucune donnée » et « fiche importée à traiter »
 * laissent passer la relance (config/commercialStates.ts). Une valeur inconnue
 * suspend par prudence. La livraison d'un guide demandé n'est pas concernée.
 */
export function inCommercialCycle(contact: Pick<BrevoContact, "attributes">): boolean {
  return !GUIDE_FOLLOWUP_ALLOWED.has(readCommercialState(contact.attributes).state);
}

/**
 * Décision au moment d'envoyer une étape (état Brevo relu à cet instant :
 * une désinscription survenue pendant l'attente est toujours respectée).
 */
export function decideStep(
  contact: Pick<BrevoContact, "attributes" | "emailBlacklisted"> | null,
  step: Pick<SequenceStep, "category">
): StepDecision {
  if (!contact) return { send: false, reason: "contact_absent" };
  if (UNUSABLE.includes(String(contact.attributes.EMAIL_STATUS ?? ""))) return { send: false, reason: "email_unusable" };
  if (step.category === "transactional") return { send: true };
  if (!mayReceiveMarketing(contact)) return { send: false, reason: "marketing_not_allowed" };
  if (inCommercialCycle(contact)) return { send: false, reason: "commercial_cycle" };
  return { send: true };
}
