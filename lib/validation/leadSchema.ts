/**
 * Schéma de la requête POST /api/lead. Le serveur ne fait confiance à
 * AUCUNE valeur du navigateur : tout est revalidé ici, puis l'email et le
 * téléphone passent par lib/data-quality (DNS, jetables, libphonenumber).
 *
 * Les UTM ne bloquent jamais une inscription : une valeur absurde est
 * simplement ignorée (lib/tracking/utm.ts).
 *
 * Guides : téléphone, besoin et horizon obligatoires (inchangé), sauf variante
 * propre au guide (config/leadMagnets.ts, `form`) : entreprise obligatoire,
 * horizon ni demandé ni enregistré.
 * Webinars (`kind: "webinar"`) : formulaire court prénom, nom, email et
 * entreprise facultative. Téléphone, besoin et horizon y sont ignorés : une
 * inscription ne fabrique jamais de déclaration de projet.
 */

import { z } from "zod";
import { BESOIN_CODES, HORIZON_CODES, PHONE_COUNTRY_CODES } from "@/config/taxonomy";
import { guideFormOptions } from "@/config/leadMagnets";

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

/** Entreprise facultative : texte libre court, sans balise ni lien ; vide = non renseignée. */
const companyName = z
  .string()
  .max(200)
  .transform(stripControls)
  .pipe(z.string().max(120).refine((v) => !/[<>]|:\/\/|www\./i.test(v)))
  .transform((v) => v || undefined);

const GUIDE_ONLY = ["tel", "pays", "besoin", "horizon"] as const;

export const leadSchema = z.object({
  kind: z.enum(["guide", "webinar"]).optional().default("guide"),
  slug: z.string().max(80).regex(/^[a-z0-9-]+$/),
  prenom: personName,
  nom: personName,
  email: z.string().max(254),
  tel: z.string().max(40).optional(),
  pays: z.enum(PHONE_COUNTRY_CODES).optional(),
  besoin: z.enum(BESOIN_CODES).optional(),
  horizon: z.enum(HORIZON_CODES).optional(),
  entreprise: companyName.optional(),
  /** Opposition explicite aux emails marketing, indépendante des cookies. */
  marketingOpposition: z.boolean().optional().default(false),
  website: z.string().max(200).optional().default(""), // honeypot
  turnstileToken: z.string().max(2048).optional(),
  firstTouch: z.unknown().optional(),
  currentTouch: z.unknown().optional(),
  sessionId: z
    .string()
    .max(60)
    .regex(/^[\w-]*$/)
    .optional(),
}).superRefine((v, ctx) => {
  if (v.kind === "webinar") return;
  const form = guideFormOptions(v.slug);
  for (const field of GUIDE_ONLY) {
    if (field === "horizon" && form.sansHorizon) continue;
    if (v[field] === undefined) ctx.addIssue({ code: "custom", path: [field], message: "required" });
  }
  if (form.entrepriseRequise && !v.entreprise) ctx.addIssue({ code: "custom", path: ["entreprise"], message: "required" });
}).transform((v) => {
  if (v.kind === "webinar") return { ...v, tel: undefined, pays: undefined, besoin: undefined, horizon: undefined };
  return guideFormOptions(v.slug).sansHorizon ? { ...v, horizon: undefined } : v;
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
  entreprise: "Merci de vérifier le nom de l’entreprise.",
};
