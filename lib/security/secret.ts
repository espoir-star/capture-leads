/**
 * Clés dérivées du secret de signature, par usage (séparation des domaines).
 *
 * SIGNING_SECRET : obligatoire en Production (garde-fou de build), stable
 * dans le temps — le changer invalide les liens de confirmation déjà envoyés.
 * À défaut (dev / Preview) : dérivé de BREVO_API_KEY.
 */

import { createHash } from "node:crypto";

export function deriveKey(purpose: string): Buffer | null {
  const base = process.env.SIGNING_SECRET?.trim() || process.env.BREVO_API_KEY?.trim();
  if (!base) return null;
  return createHash("sha256").update(`althoce:${purpose}:${base}`).digest();
}
