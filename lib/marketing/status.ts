/** Règles marketing B2B — aucun re-opt-in implicite des anciens contacts. */
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
  if (a.OPT_IN === false || a.MARKETING_STATUS === "TO_REVIEW") return "TO_REVIEW";
  if (a.MARKETING_STATUS === "B2B_ELIGIBLE") return "B2B_ELIGIBLE";
  return data.vertical && data.vertical !== "GENERAL" ? "B2B_ELIGIBLE" : "TO_REVIEW";
}

export function mayReceiveMarketing(contact: Pick<BrevoContact, "attributes" | "emailBlacklisted">): boolean {
  if (contact.emailBlacklisted) return false;
  const a = contact.attributes;
  if (["INVALID", "DISPOSABLE", "BOUNCED"].includes(String(a.EMAIL_STATUS ?? ""))) return false;
  return a.MARKETING_STATUS === "CONSENT" || a.MARKETING_STATUS === "B2B_ELIGIBLE";
}
