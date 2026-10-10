/** Lien chiffré d'opposition marketing. Aucun effet sur une simple visite GET. */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deriveKey } from "@/lib/security/secret";
const PREFIX = "m1.";

export function createMarketingOptoutToken(email: string): string | undefined {
  const key = deriveKey("marketing-optout:v1");
  if (!key) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(email.toLowerCase(), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}

export function readMarketingOptoutToken(token: unknown): string | null {
  const key = deriveKey("marketing-optout:v1");
  if (!key || typeof token !== "string" || !token.startsWith(PREFIX) || token.length > 700) return null;
  try {
    const raw = Buffer.from(token.slice(PREFIX.length), "base64url");
    if (raw.length < 31) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const email = Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
