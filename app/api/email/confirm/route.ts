/**
 * Confirmation d'adresse email : POST { t, optIn? } depuis la page
 * /confirmer-email (clic sur le bouton, pas simple ouverture du lien).
 *
 *   EMAIL_STATUS → VERIFIED (sauf BOUNCED / DISPOSABLE) + événement email_confirmed
 *   optIn = true → OPT_IN = true (case newsletter de la page, jamais l'inverse)
 *
 * Idempotent : une 2e confirmation ne réécrit rien et ne renvoie pas d'événement.
 */

import { NextRequest, NextResponse } from "next/server";
import { BREVO_EVENTS, getContactByEmail, sendBrevoEvent, updateContactAttributes } from "@/lib/brevo/server";
import { logLead, maskEmail } from "@/lib/lead/log";
import { emailStatusAfterConfirmation, readEmailConfirmToken } from "@/lib/security/emailConfirm";
import { clientIp, EVENT_LIMITS, isRateLimited } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (isRateLimited("confirm", clientIp(req.headers), EVENT_LIMITS)) {
    return json({ message: "Trop de tentatives. Réessayez dans une minute." }, 429);
  }
  let body: { t?: unknown; optIn?: unknown };
  try {
    const text = await req.text();
    if (text.length > 2000) return json({ message: "Requête invalide." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ message: "Requête invalide." }, 400);
  }

  const email = readEmailConfirmToken(body.t);
  if (!email) return json({ message: "Ce lien de confirmation n’est pas valide." }, 400);

  try {
    const contact = await getContactByEmail(email);
    if (!contact) return json({ message: "Ce lien de confirmation n’est plus valide." }, 404);

    const nextStatus = emailStatusAfterConfirmation(String(contact.attributes.EMAIL_STATUS ?? ""));
    const wantsOptIn = body.optIn === true && contact.attributes.OPT_IN !== true;
    const attributes: Record<string, string | boolean> = {};
    if (nextStatus) attributes.EMAIL_STATUS = nextStatus;
    if (wantsOptIn) attributes.OPT_IN = true;

    if (Object.keys(attributes).length) {
      await updateContactAttributes({ id: contact.id }, attributes);
      if (nextStatus) await sendBrevoEvent(BREVO_EVENTS.EMAIL_CONFIRMED, { contact_id: contact.id }, { opt_in: wantsOptIn });
      logLead("succes", { motif: "email_confirme", statut: nextStatus ?? "inchange", opt_in: wantsOptIn, valeur: maskEmail(email) });
    }
    const status = contact.attributes.EMAIL_STATUS === "VERIFIED" ? "already_verified" : nextStatus ? "verified" : "not_applicable";
    return json({ ok: true, status, optIn: wantsOptIn || contact.attributes.OPT_IN === true });
  } catch (e) {
    logLead("erreur", { motif: "email_confirm_brevo", code: String(e).slice(0, 120), valeur: maskEmail(email) });
    return json({ message: "Confirmation impossible pour le moment. Réessayez dans un instant." }, 502);
  }
}
