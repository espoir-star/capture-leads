/**
 * Moteur de séquences — exécution SERVEUR (Brevo + n8n).
 *
 *   deliverGuide      livraison immédiate, transactionnelle (capture)
 *   enrollInSequence  inscription : identifiant signé → webhook n8n (capture)
 *   runStep           exécution d'une étape à la demande de n8n (/api/sequences/step)
 *
 * Idempotence durable : chaque envoi porte une clé Brevo (`idempotencyKey`)
 * dérivée de l'inscription et de l'étape ; un rejeu n8n, une reprise réseau
 * ou une double inscription ne produisent jamais un second email.
 * Historique : événements Brevo sur la fiche du contact (guide_delivered,
 * sequence_enrolled, sequence_step_sent / _skipped, sequence_enroll_failed).
 */

import { templateId } from "@/config/emailTemplates";
import { getSequence, type SequenceConfig } from "@/config/sequences";
import { getContactById } from "@/lib/brevo/api";
import { BREVO_EVENTS, sendBrevoEvent } from "@/lib/brevo/events";
import { sendTransactionalEmail, type SendResult } from "@/lib/brevo/transactional";
import {
  deliveryIdempotencyKey,
  signEnrollment,
  stepIdempotencyKey,
  verifyEnrollment,
  type Enrollment,
} from "@/lib/sequences/enrollment";
import { confirmUrl, CTA_URL, resourceParams, unsubscribeLinks } from "@/lib/sequences/links";
import { notifyN8n } from "@/lib/sequences/n8n";
import { decideStep, nextStep, stepAt } from "@/lib/sequences/plan";
import { sequencesPaused } from "@/lib/sequences/switch";
import { STEP_STALE_AFTER_HOURS } from "@/config/sequences";

const HOUR = 3_600_000;

export class SequenceSendError extends Error {
  constructor(public readonly httpStatus: number, public readonly code?: string) {
    super(`Envoi Brevo refusé (${httpStatus} ${code ?? ""})`);
  }
}

function baseParams(email: string, slug: string | undefined): Record<string, string> {
  const links = unsubscribeLinks(email);
  return {
    ...resourceParams(slug),
    CTA_URL,
    ...(links && { UNSUBSCRIBE_URL: links.page }),
  };
}

/* ── Livraison ─────────────────────────────────────────────────────── */

export async function deliverGuide(opts: {
  seq: SequenceConfig;
  contactId: number;
  email: string;
  slug: string;
  emailStatus: unknown;
  now: Date;
}): Promise<SendResult> {
  const { seq, contactId, email, slug, now } = opts;
  const id = templateId(seq.delivery);
  if (id === null) return { status: "error", httpStatus: 0, code: "template_missing" };
  const confirm = confirmUrl(email, opts.emailStatus);
  const result = await sendTransactionalEmail({
    to: { email },
    templateId: id,
    params: { ...baseParams(email, slug), ...(confirm && { CONFIRM_URL: confirm }) },
    tags: [`seq:${seq.id}`, `seq:${seq.id}:delivery`, `guide:${slug}`],
    idempotencyKey: deliveryIdempotencyKey(seq.id, contactId, now),
    oneClickUnsubscribeUrl: unsubscribeLinks(email)?.oneClick,
  });
  await sendBrevoEvent(
    BREVO_EVENTS.GUIDE_DELIVERED,
    { contact_id: contactId },
    { resource: slug, sequence_id: seq.id, status: result.status },
    now
  );
  return result;
}

/* ── Inscription ───────────────────────────────────────────────────── */

export type EnrollOutcome = "enrolled" | "no_steps" | "n8n_not_configured" | "failed";

export async function enrollInSequence(opts: {
  seq: SequenceConfig;
  contactId: number;
  slug: string;
  now: Date;
  eventAt?: Date;
  /** mode QA uniquement */
  timeScale?: number;
}): Promise<EnrollOutcome> {
  const { seq, contactId, slug, now } = opts;
  const enr: Enrollment = {
    s: seq.id,
    c: contactId,
    t: now.getTime(),
    r: slug,
    ...(opts.eventAt && { e: opts.eventAt.getTime() }),
    ...(opts.timeScale && opts.timeScale > 1 && { k: opts.timeScale }),
  };
  const first = nextStep(seq, enr, null, now.getTime());
  if (!first) return "no_steps";
  const enrollmentId = signEnrollment(enr);
  if (!enrollmentId) return "failed";

  const res = await notifyN8n({ enrollmentId, sequenceId: seq.id, stepId: first.step.id, at: new Date(first.at).toISOString() });
  const outcome: EnrollOutcome = res.ok ? "enrolled" : res.reason === "not_configured" ? "n8n_not_configured" : "failed";
  await sendBrevoEvent(
    res.ok ? BREVO_EVENTS.SEQUENCE_ENROLLED : BREVO_EVENTS.SEQUENCE_ENROLL_FAILED,
    { contact_id: contactId },
    {
      sequence_id: seq.id,
      resource: slug,
      first_step: first.step.id,
      first_step_at: new Date(first.at).toISOString(),
      // permet de rejouer l'inscription à la main dans n8n si celui-ci était indisponible
      ...(!res.ok && { enrollment_id: enrollmentId, reason: res.reason }),
    },
    now
  );
  console.log(JSON.stringify({ type: "sequence_enroll", sequence: seq.id, contact: contactId, outcome }));
  return outcome;
}

/* ── Étape (appelée par n8n) ───────────────────────────────────────── */

export type StepResponse =
  | { action: "wait"; stepId: string; at: string }
  | { action: "done"; reason: string }
  | { action: "invalid"; reason: string };

const wait = (stepId: string, at: number): StepResponse => ({ action: "wait", stepId, at: new Date(at).toISOString() });

export async function runStep(enrollmentId: unknown, stepId: unknown, now = new Date()): Promise<StepResponse> {
  const enr = verifyEnrollment(enrollmentId);
  if (!enr || typeof enrollmentId !== "string") return { action: "invalid", reason: "enrollment" };
  const seq = getSequence(enr.s);
  if (!seq) return { action: "done", reason: "unknown_sequence" };
  const step = seq.steps.find((s) => s.id === stepId);
  if (!step) return { action: "done", reason: "unknown_step" };

  const t = now.getTime();
  if (sequencesPaused()) return wait(step.id, t + 6 * HOUR);
  const at = stepAt(enr, step);
  if (at === null) return { action: "done", reason: "no_anchor" };
  if (t < at - 5 * 60_000) return wait(step.id, at); // appel prématuré : on reprogramme

  let sent = false;
  let skipReason: string | undefined;
  const resource = resourceParams(enr.r);
  if (t > at + STEP_STALE_AFTER_HOURS * HOUR) {
    skipReason = "stale";
  } else if (step.requires === "replayUrl" && !resource.REPLAY_URL) {
    skipReason = "missing_replay";
  } else {
    const contact = await getContactById(enr.c);
    const decision = decideStep(contact, step);
    if (!decision.send) {
      skipReason = decision.reason;
      if (decision.reason === "contact_absent" || decision.reason === "email_unusable") {
        await recordSkip(enr, step.id, decision.reason, now);
        return { action: "done", reason: decision.reason };
      }
    } else {
      const id = templateId(step.template);
      if (id === null) return { action: "done", reason: "template_missing" };
      const email = contact!.email;
      const links = unsubscribeLinks(email);
      const result = await sendTransactionalEmail({
        to: { email },
        templateId: id,
        params: baseParams(email, enr.r),
        tags: [`seq:${seq.id}`, `seq:${seq.id}:${step.id}`, ...(enr.r ? [`guide:${enr.r}`] : [])],
        idempotencyKey: stepIdempotencyKey(enrollmentId, step.id),
        oneClickUnsubscribeUrl: links?.oneClick,
      });
      if (result.status === "error") throw new SequenceSendError(result.httpStatus, result.code);
      sent = result.status === "sent";
      if (sent) {
        await sendBrevoEvent(BREVO_EVENTS.SEQUENCE_STEP_SENT, { contact_id: enr.c }, { sequence_id: seq.id, step: step.id }, now);
      }
    }
  }
  if (skipReason) await recordSkip(enr, step.id, skipReason, now);

  // Après un refus marketing, seules les étapes transactionnelles (rappels pratiques) restent possibles
  const marketingBlocked = skipReason === "marketing_not_allowed" || skipReason === "commercial_cycle";
  const next = nextStep(seq, enr, step.id, t, { transactionalOnly: marketingBlocked });
  if (next) return wait(next.step.id, next.at);
  return { action: "done", reason: skipReason ?? (sent ? "completed" : "already_sent") };
}

async function recordSkip(enr: Enrollment, stepId: string, reason: string, now: Date) {
  await sendBrevoEvent(BREVO_EVENTS.SEQUENCE_STEP_SKIPPED, { contact_id: enr.c }, { sequence_id: enr.s, step: stepId, reason }, now);
}
