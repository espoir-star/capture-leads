/**
 * Pipeline de capture d'un lead (serveur). Ordre de priorité :
 *   1. anti-bot (honeypot, rate limit, Turnstile)   ← dans la route
 *   2. validation essentielle (schéma, email DNS/MX/jetable, téléphone)
 *   3. création / mise à jour du contact Brevo (dédoublonné par email)
 *   4. délivrance du guide (réponse OK → page merci)
 *   5. après la réponse : livraison email + séquence (moteur Althoce, si le
 *      guide a basculé), puis événement Brevo
 *
 * Livraison par email :
 *   - guide basculé (ALTHOCE_SEQUENCE_GUIDES) : email transactionnel envoyé
 *     ici, puis inscription à la séquence n8n si le contact n'était pas déjà
 *     dans la liste de ce guide (re-téléchargement ou ancienne séquence Brevo
 *     en cours : pas de nouvelle séquence complète) ;
 *   - guide encore sur son automation Brevo : l'automation livre, SAUF pour un
 *     opposant (constaté le 10/10 : une automation Brevo envoie même à un
 *     contact bloqué, relances comprises) → pas d'ajout à la liste, livraison
 *     transactionnelle par le modèle générique.
 */

import "server-only";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
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
import { logLead, maskEmail, maskIp, maskPhone } from "@/lib/lead/log";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { createMarketingOptoutToken } from "@/lib/marketing/token";
import { markDelivery, pendingDeliveryAttributes } from "@/lib/sequences/delivery";
import { deliverGuide, enrollInSequence } from "@/lib/sequences/run";
import { activeGuideSequence, webinarSequence } from "@/lib/sequences/switch";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { signLeadRef } from "@/lib/security/leadToken";
import { cleanTouch, resolveAttribution } from "@/lib/tracking/utm";
import type { LeadInput } from "@/lib/validation/leadSchema";

export type CaptureOutcome =
  | {
      ok: true;
      leadRef?: string;
      /** Opposition marketing enregistrée par cette soumission (affichée sur la page merci) */
      marketingOpposed?: boolean;
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
  ctx: { ip: string; now?: Date; /** Turnstile non vérifié (Cloudflare injoignable) : aucun email automatique */ degraded?: boolean }
): Promise<CaptureOutcome> {
  const now = ctx.now ?? new Date();
  const log = { slug: input.slug, sessionId: input.sessionId, ip: maskIp(ctx.ip) };

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
    const lm = isWebinar ? undefined : getLeadMagnet(source.slug);
    const webinar = isWebinar ? getWebinar(source.slug) : undefined;
    const active = lm ? activeGuideSequence(lm, process.env, email.email) : null;
    const sequence = active?.seq ?? (lm ? null : webinarSequence(webinar));
    const opposed = update.marketingStatus === "OPPOSED";
    const legacyOpposed = !!lm && !sequence && opposed;
    const wasInList = existing?.listIds?.includes(source.brevoListId) ?? false;
    // Mode QA : l'automation historique reste active → pas d'ajout à la liste pour l'adresse QA.
    // Mode dégradé (Turnstile non vérifié) : pas de liste non plus, sinon l'automation Brevo enverrait un email.
    const skipList = legacyOpposed || !!active?.qa || !!ctx.degraded;
    // Livraison par le moteur : tâche durable écrite AVEC le contact, avant la réponse (lib/sequences/delivery.ts)
    const deliverySequence = sequence ?? (legacyOpposed ? getSequence("guide-generique-v1") : undefined);
    if (deliverySequence && !ctx.degraded) Object.assign(update.attributes, pendingDeliveryAttributes(deliverySequence.id, source.slug, now));

    const result = await upsertContact(
      email.email, update.attributes, skipList ? [] : [source.brevoListId], existing,
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
    const followUp = async () => {
      if (ctx.degraded) {
        // Le guide reste affiché sur la page merci ; l'email peut être renvoyé à la main après contrôle
        logLead("succes", { ...log, motif: "turnstile_degrade", statut: "sans_email", valeur: maskEmail(email.email) });
      } else if (deliverySequence && result.contactId) {
        const delivery = await deliverGuide({
          seq: deliverySequence,
          contactId: result.contactId,
          email: email.email,
          slug: source.slug,
          emailStatus: update.emailStatus,
          now,
        });
        await markDelivery(result.contactId, delivery);
        logLead(delivery.status === "error" ? "erreur" : "succes", {
          ...log,
          motif: "livraison_guide",
          statut: delivery.status,
          sequence: deliverySequence.id,
          valeur: maskEmail(email.email),
        });
        // Webinar : les rappels pratiques restent dus à un opposant inscrit (seul le suivi marketing est filtré)
        if (sequence && (!opposed || webinar) && !wasInList) {
          await enrollInSequence({
            seq: sequence,
            contactId: result.contactId,
            slug: source.slug,
            now,
            ...(webinar && { eventAt: new Date(webinar.startsAt) }),
            ...(active?.qa && { timeScale: active.timeScale }),
          });
        }
      }
      if (isWebinar && result.contactId && !ctx.degraded && ledgerConfigured()) {
        // Scoring : inscription webinar (+8, une fois par webinar). Jamais bloquant pour la capture.
        const r = await recordEvents([makeEvent("webinar_registered", result.contactId, source.slug, "capture", now)]);
        if (r.ok) await applyBehaviorScores(r.rows, now).catch(() => undefined);
        else logLead("erreur", { ...log, motif: "scoring_webinar", code: r.reason });
      }
      return sendBrevoEvent(
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
          ...(ctx.degraded && { turnstile: "unverified" }),
        },
        now
      );
    };

    return {
      ok: true,
      leadRef: result.contactId ? signLeadRef(result.contactId, source.slug) : undefined,
      marketingOpposed: opposed,
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
