/**
 * Moteur de séquences — logique PURE (tests/sequences.test.ts) : dates des
 * étapes, étape suivante, décision d'envoi. Aucun appel réseau.
 */

import type { BrevoContact } from "@/lib/brevo/api";
import { mayReceiveMarketing } from "@/lib/marketing/status";
import {
  MEETING_ATTRIBUTES,
  STEP_STALE_AFTER_HOURS,
  STOP_LIFECYCLE_STAGES,
  type SequenceConfig,
  type SequenceStep,
} from "@/config/sequences";
import type { Enrollment } from "@/lib/sequences/enrollment";

const HOUR = 3_600_000;

/** Date prévue d'une étape, ou null si son ancre manque (webinar sans date) */
export function stepAt(enr: Enrollment, step: SequenceStep): number | null {
  const base = step.anchor === "event" ? enr.e : enr.t;
  return base === undefined ? null : base + (step.offsetHours * HOUR) / (enr.k ?? 1);
}

/**
 * Prochaine étape à attendre après `afterStepId` (ou la première), en
 * sautant celles dont la date est dépassée de plus de STEP_STALE_AFTER_HOURS
 * (inscription tardive à un webinar : pas de rappel J-1 envoyé après coup).
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
    if (at < now - STEP_STALE_AFTER_HOURS * HOUR) continue;
    return { step, at };
  }
  return null;
}

export type StepDecision =
  | { send: true }
  | { send: false; reason: "contact_absent" | "email_unusable" | "marketing_not_allowed" | "commercial_cycle" };

const UNUSABLE = ["INVALID", "DISPOSABLE", "BOUNCED"];

export function inCommercialCycle(contact: Pick<BrevoContact, "attributes">): boolean {
  const a = contact.attributes;
  if ((STOP_LIFECYCLE_STAGES as readonly string[]).includes(String(a.LIFECYCLE_STAGE ?? ""))) return true;
  return MEETING_ATTRIBUTES.some((k) => String(a[k] ?? "").trim() !== "");
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
