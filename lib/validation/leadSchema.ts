/**
 * Schéma de la requête POST /api/lead. Le serveur ne fait confiance à
 * AUCUNE valeur du navigateur : tout est revalidé ici, puis l'email et le
 * téléphone passent par lib/data-quality (DNS, jetables, libphonenumber).
 *
 * Les UTM ne bloquent jamais une inscription : une valeur absurde est
 * simplement ignorée (lib/tracking/utm.ts).
 */

import { z } from "zod";
import { BESOIN_CODES, HORIZON_CODES, PHONE_COUNTRY_CODES } from "@/config/taxonomy";

const stripControls = (s: string) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim();

const personName = z
  .string()
  .transform(stripControls)
  .pipe(
    z
      .string()
      .min(2)
      .max(60)
      .refine((v) => /\p{L}/u.test(v) && !/[@<>]|:\/\//.test(v))
  );

export const leadSchema = z.object({
  kind: z.enum(["guide", "webinar"]).optional().default("guide"),
  slug: z.string().max(80).regex(/^[a-z0-9-]+$/),
  prenom: personName,
  nom: personName,
  email: z.string().max(254),
  tel: z.string().max(40),
  pays: z.enum(PHONE_COUNTRY_CODES),
  besoin: z.enum(BESOIN_CODES),
  horizon: z.enum(HORIZON_CODES),
  /** Case newsletter : contrôle uniquement OPT_IN (jamais les cookies) */
  optIn: z.boolean().optional().default(false),
  website: z.string().max(200).optional().default(""), // honeypot
  turnstileToken: z.string().max(2048).optional(),
  firstTouch: z.unknown().optional(),
  currentTouch: z.unknown().optional(),
  sessionId: z
    .string()
    .max(60)
    .regex(/^[\w-]*$/)
    .optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Champ du formulaire concerné par la première erreur (pour l'affichage). */
export function firstInvalidField(error: z.ZodError): string | undefined {
  const path = error.issues[0]?.path?.[0];
  return typeof path === "string" ? path : undefined;
}

export const FIELD_MESSAGES: Record<string, string> = {
  prenom: "Merci d’indiquer votre prénom.",
  nom: "Merci d’indiquer votre nom.",
  email: "Veuillez vérifier votre adresse email.",
  tel: "Ce numéro ne semble pas valide. Vérifiez la saisie.",
  pays: "Merci de choisir un indicatif.",
  besoin: "Merci de choisir votre objectif.",
  horizon: "Merci de choisir un horizon.",
};
