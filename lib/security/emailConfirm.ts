/**
 * Lien de confirmation d'adresse email (EMAIL_STATUS → VERIFIED).
 *
 * Le jeton contient l'email CHIFFRÉ (AES-256-GCM) : aucune donnée personnelle
 * lisible dans l'URL, infalsifiable sans le secret. Il est écrit dans
 * l'attribut Brevo EMAIL_CONFIRM_TOKEN à la capture, pour être inséré dans
 * l'email de bienvenue :
 *   https://<domaine>/confirmer-email?t={{ contact.EMAIL_CONFIRM_TOKEN }}
 *
 * La page affiche un bouton : seul ce clic (POST) confirme. Une simple
 * ouverture du lien (aperçu, antivirus de messagerie) ne vérifie rien.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deriveKey } from "@/lib/security/secret";

const PREFIX = "v1.";

export function createEmailConfirmToken(email: string): string | undefined {
  const key = deriveKey("email-confirm:v1");
  if (!key) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64url");
}

/** Email contenu dans le jeton, ou null si jeton absent, altéré ou d'un autre secret. */
export function readEmailConfirmToken(token: unknown): string | null {
  const key = deriveKey("email-confirm:v1");
  if (!key || typeof token !== "string" || !token.startsWith(PREFIX) || token.length > 600) return null;
  try {
    const raw = Buffer.from(token.slice(PREFIX.length), "base64url");
    if (raw.length < 12 + 16 + 3) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const email = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/** Effet d'une confirmation sur EMAIL_STATUS (null = rien à écrire). Idempotent. */
export function emailStatusAfterConfirmation(current: string | undefined): "VERIFIED" | null {
  const cur = String(current ?? "");
  // BOUNCED : Brevo bloque l'adresse ; DISPOSABLE : jamais promu. VERIFIED : déjà fait.
  if (cur === "VERIFIED" || cur === "BOUNCED" || cur === "DISPOSABLE") return null;
  return "VERIFIED";
}
