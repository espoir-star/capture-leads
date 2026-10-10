/**
 * Pipeline de capture d'un lead (serveur). Ordre de priorité :
 *   1. anti-bot (honeypot, rate limit, Turnstile)   ← dans la route
 *   2. validation essentielle (schéma, email DNS/MX/jetable, téléphone)
 *   3. création / mise à jour du contact Brevo (dédoublonné par email)
 *   4. délivrance du guide (réponse OK → page merci)
 *   5. tracking secondaire (événement Brevo, après la réponse)
 */

import "server-only";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getWebinar } from "@/config/webinars";
import { checkEmail, emailErrorMessage } from "@/lib/data-quality/email";
import { checkPhone, PHONE_ERROR_MESSAGE } from "@/lib/data-quality/phone";
import { getApiKey } from "@/lib/brevo/api";
import {
  BREVO_EVENTS,
  BrevoWriteError,
  getContactByEmail,
  sendBrevoEvent,
  upsertContact,
} from "@/lib/brevo/server";
import { buildContactUpdate, withoutRejectedSms, type CaptureSource } from "@/lib/lead/contactUpdate";
import { logLead, maskEmail, maskPhone } from "@/lib/lead/log";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { createMarketingOptoutToken } from "@/lib/marketing/token";
import { signLeadRef } from "@/lib/security/leadToken";
import { cleanTouch, resolveAttribution } from "@/lib/tracking/utm";
import type { LeadInput } from "@/lib/validation/leadSchema";

export type CaptureOutcome =
  | {
      ok: true;
      leadRef?: string;
      /** Tâche à exécuter après la réponse (événement Brevo) */
      followUp?: () => Promise<unknown>;
    }
  | { ok: false; status: number; field?: string; message: string };

/** Le slug est traduit côté serveur : le navigateur ne choisit jamais la liste Brevo. */
export function resolveCaptureSource(kind: LeadInput["kind"], slug: string): CaptureSource | undefined {
  if (kind === "webinar") {
    const w = getWebinar(slug);
    return w && w.status === "open" ? w : undefined;
  }
  return getLeadMagnet(slug);
}

export async function captureLead(
  input: LeadInput,
  ctx: { ip: string; now?: Date }
): Promise<CaptureOutcome> {
  const now = ctx.now ?? new Date();
  const log = { slug: input.slug, sessionId: input.sessionId, ip: ctx.ip };

  const source = resolveCaptureSource(input.kind, input.slug);
  if (!source) return { ok: false, status: 404, message: "Ressource inconnue." };
  const isWebinar = input.kind === "webinar";

  /* Email : syntaxe, factice, jetable, DNS/MX */
  const email = await checkEmail(input.email);
  if (!email.accepted) {
    logLead("rejet", { ...log, motif: `email_${email.reason}`, valeur: maskEmail(email.email) });
    return { ok: false, status: 400, field: "email", message: emailErrorMessage(email) };
  }

  /* Téléphone : INVALID refusé (le formulaire impose un numéro), SUSPECT accepté et signalé */
  const phone = checkPhone(input.tel, input.pays);
  if (phone.status === "INVALID") {
    logLead("rejet", { ...log, motif: `tel_${phone.reason}`, valeur: maskPhone(input.tel) });
    return { ok: false, status: 400, field: "tel", message: PHONE_ERROR_MESSAGE };
  }

  if (!getApiKey()) {
    logLead("erreur", { ...log, motif: "brevo_api_key_absente" });
    return { ok: false, status: 500, message: "Configuration serveur incomplète." };
  }

  const firstTouch = cleanTouch(input.firstTouch);
  const currentTouch = cleanTouch(input.currentTouch);
  const attribution = resolveAttribution(firstTouch, currentTouch);

  try {
    const existing = await getContactByEmail(email.email);
    const update = buildContactUpdate(existing, {
      kind: input.kind,
      prenom: input.prenom,
      nom: input.nom,
      besoin: input.besoin,
      horizon: input.horizon,
      marketingOpposition: input.marketingOpposition,
      marketingOptoutToken: createMarketingOptoutToken(email.email),
      confirmToken: createEmailConfirmToken(email.email),
      phone,
      attribution,
      source,
      now,
    });
    const result = await upsertContact(
      email.email, update.attributes, [source.brevoListId], existing,
      (attrs) => withoutRejectedSms(attrs, existing),
      input.marketingOpposition
    );

    logLead("succes", {
      ...log,
      nouveau: update.isNew,
      score: update.leadScore,
      tel: result.phoneRejected ? "non_stocke" : update.phoneStatus,
      tel_brevo: result.phoneRejected,
      first_touch: update.firstTouchWritten,
      marketing_status: update.marketingStatus,
      utm_source: attribution.utm_source,
      utm_content: attribution.utm_content,
    });

    // Interaction de CETTE visite (la provenance initiale reste dans les attributs)
    const touch = currentTouch?.utm_source ? currentTouch : attribution;
    const identifiers = result.contactId ? { contact_id: result.contactId } : { email_id: email.email };
    const followUp = () =>
      sendBrevoEvent(
        isWebinar ? BREVO_EVENTS.WEBINAR_REGISTERED : BREVO_EVENTS.LEAD_MAGNET_SUBMITTED,
        identifiers,
        {
          resource: source.resource,
          vertical: source.vertical,
          subsector: source.subsector,
          besoin: input.besoin,
          horizon: input.horizon,
          form_score: update.formScore,
          lead_score: update.leadScore,
          is_new_contact: update.isNew,
          marketing_status: update.marketingStatus,
          phone_status: result.phoneRejected ? undefined : update.phoneStatus,
          utm_source: touch.utm_source,
          utm_medium: touch.utm_medium,
          utm_campaign: touch.utm_campaign,
          utm_content: touch.utm_content,
          landing_page: touch.landing_page ?? `/${isWebinar ? "w" : "r"}/${source.slug}`,
        },
        now
      );

    return {
      ok: true,
      leadRef: result.contactId ? signLeadRef(result.contactId, source.slug) : undefined,
      followUp,
    };
  } catch (e) {
    const status = e instanceof BrevoWriteError ? e.status : 0;
    logLead("erreur", {
      ...log,
      motif: "brevo",
      status,
      code: e instanceof BrevoWriteError ? e.code : String(e).slice(0, 120),
      valeur: maskEmail(email.email),
    });
    return {
      ok: false,
      status: 502,
      message: "Impossible d’enregistrer votre inscription pour le moment. Réessayez dans un instant.",
    };
  }
}
