/**
 * Livraison du guide : tâche DURABLE.
 *
 * La tâche est écrite sur la fiche Brevo du contact dans la MÊME écriture que le
 * contact, avant la réponse au navigateur :
 *   GUIDE_DELIVERY_STATUS = PENDING   GUIDE_DELIVERY_REF = <séquence>|<guide>|<date ISO>
 * puis after() envoie l'email (lib/sequences/run.ts → sendOnce) et passe à SENT.
 *
 * Si after() est interrompu (fonction coupée, Brevo indisponible), la tâche
 * horaire (/api/marketing/maintenance, déclenchée par n8n) reprend les tâches
 * PENDING de plus de 10 minutes. Le journal Brevo empêche tout doublon : un email
 * déjà parti n'est jamais renvoyé. Une tâche de plus de 72 h n'est plus envoyée
 * (EXPIRED) : le guide reste accessible sur la page de remerciement.
 */

import { getSequence } from "@/config/sequences";
import { brevoRequest, type AttributeValue, type BrevoContact } from "@/lib/brevo/api";
import { deliverGuide } from "@/lib/sequences/run";

export type DeliveryStatus = "PENDING" | "SENT" | "FAILED" | "EXPIRED";

const STATUS = "GUIDE_DELIVERY_STATUS";
const REF = "GUIDE_DELIVERY_REF";
const MIN_AGE_MS = 10 * 60_000;
const MAX_AGE_MS = 72 * 3_600_000;

export function pendingDeliveryAttributes(sequenceId: string, slug: string, now: Date): Record<string, AttributeValue> {
  return { [STATUS]: "PENDING", [REF]: `${sequenceId}|${slug}|${now.toISOString()}` };
}

export function parseDeliveryRef(ref: unknown): { sequenceId: string; slug: string; at: Date } | null {
  if (typeof ref !== "string") return null;
  const [sequenceId, slug, iso] = ref.split("|");
  const t = Date.parse(iso ?? "");
  return sequenceId && slug && Number.isFinite(t) ? { sequenceId, slug, at: new Date(t) } : null;
}

async function mark(contactId: number, status: DeliveryStatus): Promise<void> {
  await brevoRequest(`/contacts/${contactId}?identifierType=contact_id`, { method: "PUT", body: { attributes: { [STATUS]: status } }, retries: 1 });
}

/** Après l'envoi immédiat (after()) : SENT si l'email est parti ou l'était déjà ; sinon la tâche reste PENDING */
export async function markDelivery(contactId: number, result: { status: "sent" | "duplicate" | "error" }): Promise<void> {
  if (result.status !== "error") await mark(contactId, "SENT");
}

export interface DeliveryRetryReport {
  checked: number;
  sent: number;
  alreadySent: number;
  stillPending: number;
  expired: number;
  invalid: number;
}

/** Reprise des livraisons restées PENDING (tâche horaire). */
export async function retryPendingDeliveries(now: Date = new Date()): Promise<DeliveryRetryReport> {
  const report: DeliveryRetryReport = { checked: 0, sent: 0, alreadySent: 0, stillPending: 0, expired: 0, invalid: 0 };
  const filter = encodeURIComponent(`equals(${STATUS},"PENDING")`);
  const res = await brevoRequest<{ contacts?: BrevoContact[] }>(`/contacts?limit=100&filter=${filter}`, { method: "GET" });
  if (!res.ok) throw new Error(`Lecture des livraisons en attente impossible (${res.status})`);
  for (const c of res.data?.contacts ?? []) {
    if (c.attributes[STATUS] !== "PENDING") continue; // filtre revérifié
    report.checked++;
    const ref = parseDeliveryRef(c.attributes[REF]);
    const seq = ref ? getSequence(ref.sequenceId) : undefined;
    if (!ref || !seq) {
      report.invalid++;
      await mark(c.id, "FAILED");
      continue;
    }
    const age = now.getTime() - ref.at.getTime();
    if (age < MIN_AGE_MS) continue; // l'envoi immédiat est peut-être encore en cours
    if (age > MAX_AGE_MS) {
      report.expired++;
      await mark(c.id, "EXPIRED");
      continue;
    }
    const result = await deliverGuide({
      seq,
      contactId: c.id,
      email: c.email,
      slug: ref.slug,
      emailStatus: c.attributes.EMAIL_STATUS,
      now,
      requestedAt: ref.at,
    });
    if (result.status === "error") {
      report.stillPending++;
      continue;
    }
    if (result.status === "sent") report.sent++;
    else report.alreadySent++;
    await mark(c.id, "SENT");
  }
  return report;
}
