/**
 * Statut marketing B2B (attribut Brevo MARKETING_STATUS) — aucun re-opt-in
 * implicite.
 *
 *   OPPOSED       opposition (formulaire, /desinscription, désinscription
 *                 Brevo, contact bloqué) : définitive, jamais levée par une
 *                 nouvelle capture
 *   CONSENT       ancien consentement explicite (OPT_IN = true), conservé
 *   TO_REVIEW     à vérifier : ancien refus (OPT_IN = false, jamais converti),
 *                 ou capture sans verticale professionnelle connue
 *   B2B_ELIGIBLE  capture sur un guide métier, informée (mention + opposition
 *                 proposée sur le formulaire), sans opposition
 *
 * Une capture métier informée qualifie un contact TO_REVIEW sans refus
 * historique : il a vu la mention et ne s'est pas opposé.
 */
import type { BrevoContact } from "@/lib/brevo/api";
import type { Vertical } from "@/config/taxonomy";

export type MarketingStatus = "CONSENT" | "B2B_ELIGIBLE" | "OPPOSED" | "TO_REVIEW";

export function marketingStatusForCapture(
  existing: Pick<BrevoContact, "attributes" | "emailBlacklisted"> | null,
  data: { explicitOpposition: boolean; vertical: Vertical | null }
): MarketingStatus {
  const a = existing?.attributes ?? {};
  if (data.explicitOpposition || existing?.emailBlacklisted || a.MARKETING_STATUS === "OPPOSED") return "OPPOSED";
  if (a.OPT_IN === true || a.MARKETING_STATUS === "CONSENT") return "CONSENT";
  if (a.OPT_IN === false) return "TO_REVIEW";
  if (a.MARKETING_STATUS === "B2B_ELIGIBLE") return "B2B_ELIGIBLE";
  return data.vertical && data.vertical !== "GENERAL" ? "B2B_ELIGIBLE" : "TO_REVIEW";
}

export function mayReceiveMarketing(contact: Pick<BrevoContact, "attributes" | "emailBlacklisted">): boolean {
  if (contact.emailBlacklisted) return false;
  const a = contact.attributes;
  if (["INVALID", "DISPOSABLE", "BOUNCED"].includes(String(a.EMAIL_STATUS ?? ""))) return false;
  return a.MARKETING_STATUS === "CONSENT" || a.MARKETING_STATUS === "B2B_ELIGIBLE";
}
