/**
 * Jeton opaque signé (HMAC-SHA256) renvoyé après une capture réussie.
 * Il permet à la page merci de signaler « guide ouvert » (lead_magnet_downloaded)
 * sans exposer d'email ni laisser le navigateur choisir le contact.
 *
 * Contenu : identifiant de contact Brevo + slug + expiration (24 h).
 * Clé : dérivée de SIGNING_SECRET (lib/security/secret.ts).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { deriveKey } from "@/lib/security/secret";

const TTL_MS = 24 * 60 * 60 * 1000;

interface Payload {
  c: number; // contact id Brevo
  s: string; // slug
  x: number; // expiration (ms)
}

const key = () => deriveKey("lead-ref:v1");

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signLeadRef(contactId: number, slug: string, now = Date.now()): string | undefined {
  const k = key();
  if (!k || !Number.isInteger(contactId)) return undefined;
  const body = b64(JSON.stringify({ c: contactId, s: slug, x: now + TTL_MS } satisfies Payload));
  return `${body}.${b64(createHmac("sha256", k).update(body).digest())}`;
}

export function verifyLeadRef(token: unknown, now = Date.now()): Payload | null {
  const k = key();
  if (!k || typeof token !== "string" || token.length > 600) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", k).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (!Number.isInteger(p.c) || typeof p.s !== "string" || !(p.x > now)) return null;
    return p;
  } catch {
    return null;
  }
}
