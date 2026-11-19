/**
 * n8n → Vercel : entrée d'un visiteur du test de maturité IA dans la base
 * marketing Brevo (POST /api/intake/test-maturite). Logique complète ici,
 * testable sans Next (tests/intake-test-maturite.test.ts) ; la route ne fait
 * que répondre et programmer l'événement après la réponse.
 *
 * Ordre des contrôles :
 *   secret absent (404) → Bearer SEQUENCE_API_SECRET (401) → débit (429)
 *   → bascule fermée ou liste absente (503) → corps borné (413)
 *   → JSON + schéma strict (400) → mode qa hors adresse QA (200 skipped)
 *   → opposition (200 ignored, aucune lecture Brevo) → qualité email (422)
 *   → contact existant (200 existing, AUCUNE écriture)
 *   → création seule, liste dédiée (200 created) ; Brevo en erreur → 502.
 *
 * Un contact créé reçoit exactement les attributs d'une nouvelle capture
 * (lib/lead/contactUpdate.ts) : statut marketing par les règles existantes
 * (mention métier affichée et opposition proposée par le test), EMAIL_STATUS,
 * LIFECYCLE_STAGE, jetons et horodatages. Le score du test n'entre jamais dans
 * LEAD_SCORE / FORM_SCORE. Aucun email, aucune séquence, aucun appel n8n.
 */

import { z } from "zod";
import {
  isQaEmail, SECTEUR_SLUGS, TAILLES, TEST_MATURITE, TEST_MATURITE_SECTEURS,
  testMaturiteIntakeMode, testMaturiteListId,
} from "@/config/testMaturite";
import { getApiKey, getContactByEmail, type AttributeValue } from "@/lib/brevo/api";
import { BrevoWriteError, createContactIfAbsent } from "@/lib/brevo/contacts";
import { BREVO_EVENTS, sendBrevoEvent } from "@/lib/brevo/events";
import { checkEmail, type EmailCheck } from "@/lib/data-quality/email";
import type { PhoneCheck } from "@/lib/data-quality/phone";
import { buildContactUpdate, type CaptureSource } from "@/lib/lead/contactUpdate";
import { logLead, maskEmail } from "@/lib/lead/log";
import { createMarketingOptoutToken } from "@/lib/marketing/token";
import { bearerMatches } from "@/lib/security/bearer";
import { readBodyLimited } from "@/lib/security/body";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { INTAKE_LIMITS, isRateLimited } from "@/lib/security/rateLimit";
import { normalizeEmail } from "@/lib/validation/email";

type Env = Record<string, string | undefined>;

const MAX_BODY_BYTES = 8_000;
/** Aucun numéro demandé par le test : rien n'est écrit dans SMS. */
const NO_PHONE: PhoneCheck = { status: "INVALID", reason: "empty" };

const stripControls = (s: string) => s.replace(/[\u0000-\u001F\u007F]/g, "").trim();
/** Texte court recopié dans Brevo : ni balise, ni lien, ni adresse email. */
const plainText = (min: number, max: number) =>
  z.string().max(max * 2).transform(stripControls).pipe(
    z.string().min(min).max(max).refine((v) => /\p{L}/u.test(v) && !/[<>@]|:\/\/|www\./i.test(v))
  );
/** Saisie libre du visiteur (« Autre activité »), gardée seulement dans l'événement : sans balise. */
const optionalText = (max: number) =>
  z.string().max(max * 2).transform(stripControls)
    .pipe(z.string().max(max).refine((v) => !/[<>]/.test(v)))
    .transform((v) => v || undefined);

const RESULT_CODE = /^[A-Za-z0-9._-]{1,80}$/;
const isWebUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/** Contrat du corps (docs/INTAKE_TEST_MATURITE.md) : toute clé inconnue est refusée. */
export const intakeSchema = z.strictObject({
  email: z.string().max(254),
  prenom: plainText(1, 100),
  secteur_slug: z.enum(SECTEUR_SLUGS),
  secteur_personnalise: optionalText(80).optional(),
  taille: z.enum(TAILLES),
  /** Libellé affiché par le test (« Dirigeant ou associé »…), écrit dans JOB_TITLE */
  role: plainText(2, 80),
  score: z.number().int().min(0).max(100).nullable(),
  stade: z.number().int().min(1).max(4).nullable(),
  stade_nom: plainText(1, 60).nullable(),
  offre_recommandee: plainText(1, 120),
  lien_resultat: z.string().max(200).refine(
    (v) => v.startsWith(TEST_MATURITE.resultPrefix) && RESULT_CODE.test(v.slice(TEST_MATURITE.resultPrefix.length))
  ),
  opposition_marketing: z.boolean(),
  source_url: z.string().max(500).refine((v) => v === "" || isWebUrl(v)),
});
export type IntakeInput = z.infer<typeof intakeSchema>;

export type IntakeStatus =
  | "created" | "existing" | "ignored" | "skipped"
  | "invalid_body" | "invalid_email" | "disabled" | "misconfigured" | "rate_limited" | "error";

export interface IntakeOutcome {
  status: number;
  /** Absent : réponse sans corps (404, 401) */
  body?: { status: IntakeStatus } & Record<string, unknown>;
  /** Événement Brevo à envoyer après la réponse (contact créé seulement) */
  followUp?: () => Promise<unknown>;
}

export interface IntakeOptions {
  env?: Env;
  now?: Date;
  /** Remplaçable en test (DNS) ; par défaut la vérification de la capture */
  checkEmail?: (raw: unknown) => Promise<EmailCheck>;
}

const LOG_SLUG = TEST_MATURITE.source;

function firstField(error: z.ZodError): string | undefined {
  const issue = error.issues[0];
  const path = issue?.path?.[0];
  if (typeof path === "string") return path;
  return issue?.code === "unrecognized_keys" ? "unknown_keys" : undefined;
}

export async function intakeTestMaturite(req: Request, opts: IntakeOptions = {}): Promise<IntakeOutcome> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? new Date();

  /* 1. Authentification n8n (même secret et même contrôle que /api/sequences/step) */
  if (!env.SEQUENCE_API_SECRET?.trim()) return { status: 404 };
  if (!bearerMatches(req.headers.get("authorization"), env.SEQUENCE_API_SECRET)) return { status: 401 };
  if (isRateLimited("intake_test_maturite", "n8n", INTAKE_LIMITS)) {
    logLead("rejet", { slug: LOG_SLUG, motif: "intake_rate_limit" });
    return { status: 429, body: { status: "rate_limited" } };
  }

  /* 2. Bascule et configuration : rien n'est lu ni écrit tant que la route est fermée */
  const mode = testMaturiteIntakeMode(env);
  if (mode === "off") return { status: 503, body: { status: "disabled" } };
  const listId = testMaturiteListId(env);
  if (!listId || !getApiKey()) {
    logLead("erreur", { slug: LOG_SLUG, motif: listId ? "brevo_api_key_absente" : "liste_test_maturite_absente" });
    return { status: 503, body: { status: "misconfigured" } };
  }

  /* 3. Corps : borné, JSON, schéma strict */
  const read = await readBodyLimited(req, MAX_BODY_BYTES);
  if (!read.ok) return { status: 413, body: { status: "invalid_body", reason: "size" } };
  let raw: unknown;
  try {
    raw = JSON.parse(read.text);
  } catch {
    return { status: 400, body: { status: "invalid_body", reason: "json" } };
  }
  const parsed = intakeSchema.safeParse(raw);
  if (!parsed.success) {
    const field = firstField(parsed.error);
    logLead("rejet", { slug: LOG_SLUG, motif: `intake_schema_${field ?? "inconnu"}` });
    return { status: 400, body: { status: "invalid_body", ...(field && { field }) } };
  }
  const input = parsed.data;

  /* 4. Mode QA : seules les adresses de recette entrent, les autres sont ignorées sans erreur */
  if (mode === "qa" && !isQaEmail(normalizeEmail(input.email), env)) {
    return { status: 200, body: { status: "skipped", reason: "qa" } };
  }

  /* 5. Opposition : n8n ne devrait pas l'envoyer ; par prudence, aucun appel Brevo */
  if (input.opposition_marketing) {
    logLead("succes", { slug: LOG_SLUG, motif: "intake", statut: "ignored_opposition" });
    return { status: 200, body: { status: "ignored" } };
  }

  /* 6. Qualité email : mêmes contrôles que la capture (syntaxe, factice, jetable, DNS/MX) */
  const email = await (opts.checkEmail ?? checkEmail)(input.email);
  if (!email.accepted) {
    logLead("rejet", { slug: LOG_SLUG, motif: `email_${email.reason}`, valeur: maskEmail(email.email) });
    return { status: 422, body: { status: "invalid_email", reason: email.reason } };
  }

  const mapping = TEST_MATURITE_SECTEURS[input.secteur_slug];
  const source: CaptureSource = {
    slug: TEST_MATURITE.source, resource: TEST_MATURITE.resource, brevoListId: listId,
    vertical: mapping.vertical, subsector: mapping.subsector,
  };
  const log = { slug: LOG_SLUG, motif: "intake", valeur: maskEmail(email.email) };

  try {
    /* 7. Contact déjà connu : rien ne change (ni attribut, ni liste) */
    const existing = await getContactByEmail(email.email);
    if (existing) {
      logLead("succes", { ...log, statut: "existing" });
      return { status: 200, body: { status: "existing" } };
    }

    /* 8. Nouveau contact : attributs d'une nouvelle capture, sans nom ni téléphone ni intention */
    const update = buildContactUpdate(null, {
      prenom: input.prenom, nom: "",
      marketingOpposition: false,
      marketingOptoutToken: createMarketingOptoutToken(email.email),
      confirmToken: createEmailConfirmToken(email.email),
      phone: NO_PHONE, attribution: {}, source, now,
    });
    const attributes: Record<string, AttributeValue> = { ...update.attributes };
    delete attributes.NOM; // le test ne demande pas le nom
    // Contact neuf : la règle « renseigné si vide » de SOURCE_INSCRIPTION est respectée.
    attributes.SOURCE_INSCRIPTION = TEST_MATURITE.source;
    attributes.JOB_TITLE = input.role;
    // Recette : exclu des files commerciales et des annonces, comme les webinars de test.
    if (isQaEmail(email.email, env)) attributes.IS_QA = true;

    const created = await createContactIfAbsent(email.email, attributes, [listId]);
    if (!created.created) {
      // Créé entre la lecture et l'écriture (autre formulaire) : Brevo a refusé, rien n'a changé.
      logLead("succes", { ...log, statut: "existing_concurrent" });
      return { status: 200, body: { status: "existing" } };
    }
    logLead("succes", { ...log, statut: "created", nouveau: true, marketing_status: update.marketingStatus, vertical: mapping.vertical });

    const identifiers = created.contactId ? { contact_id: created.contactId } : { email_id: email.email };
    // Même événement qu'une capture de guide (liste blanche BREVO_EVENTS) : aucune
    // automation ne l'écoute ; il garde sur la fiche les données propres au test.
    const followUp = () => sendBrevoEvent(BREVO_EVENTS.LEAD_MAGNET_SUBMITTED, identifiers, {
      resource: TEST_MATURITE.resource, vertical: mapping.vertical, subsector: mapping.subsector,
      secteur: input.secteur_slug, secteur_personnalise: input.secteur_personnalise,
      taille: input.taille, role: input.role,
      score: input.score, stade: input.stade, stade_nom: input.stade_nom,
      offre_recommandee: input.offre_recommandee, lien_resultat: input.lien_resultat,
      is_new_contact: true, marketing_status: update.marketingStatus,
      landing_page: input.source_url || TEST_MATURITE.pageUrl,
    }, now);
    return { status: 200, body: { status: "created", marketingStatus: update.marketingStatus }, followUp };
  } catch (e) {
    const status = e instanceof BrevoWriteError ? e.status : 0;
    logLead("erreur", { ...log, motif: "intake_brevo", status, code: e instanceof BrevoWriteError ? e.code : String(e).slice(0, 120) });
    return { status: 502, body: { status: "error" } };
  }
}
