/** Vérification d'un jeton Bearer partagé, en temps constant. */

import { timingSafeEqual } from "node:crypto";

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim();
  if (!expected) return false;
  const given = (header ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
