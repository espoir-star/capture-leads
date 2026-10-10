/** Vérification d'un jeton Bearer partagé, en temps constant. */

import { timingSafeEqual } from "node:crypto";

/** Format strict « Bearer <jeton> » (en-tête Authorization) ; aucun autre emplacement accepté. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  const expected = secret?.trim();
  if (!expected) return false;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
