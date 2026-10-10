/**
 * Identifiant d'inscription à une séquence, SIGNÉ (HMAC-SHA256, clé dérivée
 * de SIGNING_SECRET). Il porte tout ce qu'il faut pour planifier les étapes
 * (séquence, contact, date d'inscription, date d'événement) : aucun état à
 * stocker côté Vercel, et n8n ne peut ni le fabriquer ni le modifier.
 *
 * Il sert aussi de base aux clés d'idempotence Brevo (`stepIdempotencyKey`) :
 * une étape d'une inscription n'est envoyée qu'une fois, même si n8n rejoue.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deriveKey } from "@/lib/security/secret";

export interface Enrollment {
  /** sequenceId */
  s: string;
  /** contact id Brevo */
  c: number;
  /** date d'inscription (ms epoch) */
  t: number;
  /** début de l'événement (webinar), ms epoch */
  e?: number;
  /** slug de la ressource (paramètres des modèles) */
  r?: string;
  /** accélération du temps (mode QA uniquement) : délais divisés par k */
  k?: number;
}

const PREFIX = "e1.";
const key = () => deriveKey("sequence-enrollment:v1");
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signEnrollment(enr: Enrollment): string | undefined {
  const k = key();
  if (!k) return undefined;
  const body = b64(JSON.stringify(enr));
  return `${PREFIX}${body}.${b64(createHmac("sha256", k).update(body).digest())}`;
}

export function verifyEnrollment(id: unknown): Enrollment | null {
  const k = key();
  if (!k || typeof id !== "string" || !id.startsWith(PREFIX) || id.length > 600) return null;
  const [body, sig] = id.slice(PREFIX.length).split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", k).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const enr = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Enrollment;
    const ok =
      typeof enr.s === "string" &&
      Number.isInteger(enr.c) &&
      Number.isFinite(enr.t) &&
      (enr.e === undefined || Number.isFinite(enr.e)) &&
      (enr.r === undefined || typeof enr.r === "string") &&
      (enr.k === undefined || (Number.isFinite(enr.k) && enr.k >= 1 && enr.k <= 1440));
    return ok ? enr : null;
  } catch {
    return null;
  }
}

/** Empreinte courte, sans donnée personnelle (Brevo l'expose dans les en-têtes de l'email) */
const digest = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);

export function stepIdempotencyKey(enrollmentId: string, stepId: string): string {
  return `seq.${digest(enrollmentId)}.${stepId}`;
}

/** Livraison : une seule par contact, séquence et jour (double soumission, rechargement) */
export function deliveryIdempotencyKey(sequenceId: string, contactId: number, now: Date): string {
  return `dlv.${digest(`${sequenceId}:${contactId}`)}.${now.toISOString().slice(0, 10)}`;
}
