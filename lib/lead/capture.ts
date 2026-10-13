/**
 * Capture serveur : validation → upsert Brevo → référence de capture.
 * Guide sur nouveau moteur : livraison transactionnelle + n8n.
 * Guide historique : automation Brevo, sauf opposant (livraison directe).
 * Multi-guides (flag explicite) : demande/tâche écrite PAR GUIDE avec le
 * contact ; reprise durable sans écraser un autre guide demandé simultanément.
 */
import "server-only";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
import { getWebinar } from "@/config/webinars";
import { multiGuidesEnabled } from "@/config/multiGuides";
import { checkEmail, emailErrorMessage } from "@/lib/data-quality/email";
import { checkPhone, PHONE_ERROR_MESSAGE } from "@/lib/data-quality/phone";
import { getApiKey } from "@/lib/brevo/api";
import { BREVO_EVENTS, BrevoWriteError, getContactByEmail, sendBrevoEvent, upsertContact } from "@/lib/brevo/server";
import { buildContactUpdate, withoutRejectedSms, type CaptureSource } from "@/lib/lead/contactUpdate";
import { logLead, maskEmail, maskIp, maskPhone } from "@/lib/lead/log";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { createMarketingOptoutToken } from "@/lib/marketing/token";
import { markDelivery, pendingDeliveryAttributes } from "@/lib/sequences/delivery";
import { deliverGuide, enrollInSequence } from "@/lib/sequences/run";
import { activeGuideSequence, webinarSequence } from "@/lib/sequences/switch";
import { buildGuideRequest } from "@/lib/guides/requests";
import { processGuideRequest, refreshGuideSummary } from "@/lib/guides/store";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { makeEvent } from "@/lib/scoring/behavior";
import { ledgerConfigured, recordEvents } from "@/lib/scoring/ledger";
import { signLeadRef } from "@/lib/security/leadToken";
import { cleanTouch, resolveAttribution } from "@/lib/tracking/utm";
import type { LeadInput } from "@/lib/validation/leadSchema";

export type CaptureOutcome =
  | { ok: true; leadRef?: string; marketingOpposed?: boolean; followUp?: () => Promise<unknown> }
  | { ok: false; status: number; field?: string; message: string };

export function resolveCaptureSource(kind: LeadInput["kind"], slug: string): CaptureSource | undefined {
  if (kind === "webinar") { const w = getWebinar(slug); return w && w.status === "open" ? w : undefined; }
  return getLeadMagnet(slug);
}

export async function captureLead(
  input: LeadInput,
  ctx: { ip: string; now?: Date; degraded?: boolean }
): Promise<CaptureOutcome> {
  const now = ctx.now ?? new Date();
  const log = { slug: input.slug, sessionId: input.sessionId, ip: maskIp(ctx.ip) };
  const source = resolveCaptureSource(input.kind, input.slug);
  if (!source) return { ok: false, status: 404, message: "Ressource inconnue." };
  const isWebinar = input.kind === "webinar";
  const email = await checkEmail(input.email);
  if (!email.accepted) {
    logLead("rejet", { ...log, motif: `email_${email.reason}`, valeur: maskEmail(email.email) });
    return { ok: false, status: 400, field: "email", message: emailErrorMessage(email) };
  }
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
  const lm = isWebinar ? undefined : getLeadMagnet(source.slug);
  const active = lm ? activeGuideSequence(lm, process.env, email.email) : null;
  // Les nouveaux guides n'ont aucun ancien moteur en repli : un flag absent ou
  // un visiteur hors QA ne doit jamais créer un lead en promettant un email absent.
  if (lm && !lm.legacy.automationId && !active) {
    return { ok: false, status: 503, message: "Ce guide sera bientôt disponible. Merci de réessayer plus tard." };
  }
  try {
    const existing = await getContactByEmail(email.email);
    const update = buildContactUpdate(existing, {
      kind: input.kind, prenom: input.prenom, nom: input.nom,
      besoin: input.besoin, horizon: input.horizon,
      marketingOpposition: input.marketingOpposition,
      marketingOptoutToken: createMarketingOptoutToken(email.email),
      confirmToken: createEmailConfirmToken(email.email), phone, attribution, source, now,
    });
    const webinar = isWebinar ? getWebinar(source.slug) : undefined;
    const sequence = active?.seq ?? (lm ? null : webinarSequence(webinar));
    const opposed = update.marketingStatus === "OPPOSED";
    const legacyOpposed = !!lm && !sequence && opposed;
    const wasInList = existing?.listIds?.includes(source.brevoListId) ?? false;
    const skipList = legacyOpposed || (!!active && !active.addToList) || !!ctx.degraded;
    // Repli opposant : identité propre au guide, mêmes modèles génériques.
    const deliverySequence = sequence ?? (legacyOpposed && lm ? getSequence(lm.sequence) : undefined);
    const trackedGuide = !!lm && !ctx.degraded && multiGuidesEnabled(email.email);
    if (trackedGuide) {
      const request = buildGuideRequest(existing, {
        slug: source.slug, now,
        queued: !!deliverySequence,
        enroll: !!sequence && !opposed && !wasInList,
        timeScale: active?.qa ? active.timeScale : undefined,
        // Attribution de CETTE visite ; ne pas recopier le first touch sur une visite directe.
        touch: currentTouch,
      });
      Object.assign(update.attributes, request.attributes);
    } else if (deliverySequence && !ctx.degraded) {
      Object.assign(update.attributes, pendingDeliveryAttributes(deliverySequence.id, source.slug, now));
    }
    const result = await upsertContact(
      email.email, update.attributes, skipList ? [] : [source.brevoListId], existing,
      (attrs) => withoutRejectedSms(attrs, existing), input.marketingOpposition
    );
    logLead("succes", {
      ...log, nouveau: update.isNew, score: update.leadScore,
      tel: result.phoneRejected ? "non_stocke" : update.phoneStatus,
      tel_brevo: result.phoneRejected, first_touch: update.firstTouchWritten,
      marketing_status: update.marketingStatus, utm_source: attribution.utm_source, utm_content: attribution.utm_content,
    });
    const touch = currentTouch?.utm_source ? currentTouch : attribution;
    const identifiers = result.contactId ? { contact_id: result.contactId } : { email_id: email.email };
    const followUp = async () => {
      if (ctx.degraded) {
        logLead("succes", { ...log, motif: "turnstile_degrade", statut: "sans_email", valeur: maskEmail(email.email) });
      } else if (trackedGuide && result.contactId) {
        try {
          const progress = await processGuideRequest(result.contactId, source.slug, now);
          logLead(progress.delivery === "pending" ? "erreur" : "succes", { ...log, motif: "livraison_multi_guide", statut: progress.delivery });
        } catch {
          // La demande reste sur son champ propre ; la maintenance la reprendra.
          logLead("erreur", { ...log, motif: "livraison_multi_guide_a_reprendre" });
        }
        try { await refreshGuideSummary(result.contactId, now); }
        catch { logLead("erreur", { ...log, motif: "synthese_multi_guide_a_reprendre" }); }
      } else if (deliverySequence && result.contactId) {
        const delivery = await deliverGuide({ seq: deliverySequence, contactId: result.contactId, email: email.email, slug: source.slug, emailStatus: update.emailStatus, now });
        await markDelivery(result.contactId, delivery);
        logLead(delivery.status === "error" ? "erreur" : "succes", { ...log, motif: "livraison_guide", statut: delivery.status, sequence: deliverySequence.id, valeur: maskEmail(email.email) });
        if (sequence && (!opposed || webinar) && !wasInList) {
          await enrollInSequence({ seq: sequence, contactId: result.contactId, slug: source.slug, now,
            ...(webinar && { eventAt: new Date(webinar.startsAt) }), ...(active?.qa && { timeScale: active.timeScale }) });
        }
      }
      if (isWebinar && result.contactId && !ctx.degraded && ledgerConfigured()) {
        const r = await recordEvents([makeEvent("webinar_registered", result.contactId, source.slug, "capture", now)]);
        if (r.ok) await applyBehaviorScores(r.rows, now).catch(() => undefined);
        else logLead("erreur", { ...log, motif: "scoring_webinar", code: r.reason });
      }
      return sendBrevoEvent(isWebinar ? BREVO_EVENTS.WEBINAR_REGISTERED : BREVO_EVENTS.LEAD_MAGNET_SUBMITTED, identifiers, {
        resource: source.resource, vertical: source.vertical, subsector: source.subsector,
        besoin: input.besoin, horizon: input.horizon, form_score: update.formScore, lead_score: update.leadScore,
        is_new_contact: update.isNew, marketing_status: update.marketingStatus,
        phone_status: result.phoneRejected ? undefined : update.phoneStatus,
        utm_source: touch.utm_source, utm_medium: touch.utm_medium, utm_campaign: touch.utm_campaign, utm_content: touch.utm_content,
        landing_page: touch.landing_page ?? `/${isWebinar ? "w" : "r"}/${source.slug}`,
        ...(ctx.degraded && { turnstile: "unverified" }),
      }, now);
    };
    return { ok: true, leadRef: result.contactId ? signLeadRef(result.contactId, source.slug) : undefined, marketingOpposed: opposed, followUp };
  } catch (e) {
    const status = e instanceof BrevoWriteError ? e.status : 0;
    logLead("erreur", { ...log, motif: "brevo", status, code: e instanceof BrevoWriteError ? e.code : String(e).slice(0, 120), valeur: maskEmail(email.email) });
    return { ok: false, status: 502, message: "Impossible d’enregistrer votre inscription pour le moment. Réessayez dans un instant." };
  }
}
