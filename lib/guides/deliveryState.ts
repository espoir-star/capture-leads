/**
 * État PUBLIC de l'envoi d'un guide, affiché sur la page merci.
 * Seuls des faits enregistrés sont exposés : « accepted » = Brevo a accepté
 * l'email (pas une preuve de réception). Aucune donnée personnelle renvoyée.
 *   pending   demande enregistrée, envoi pas encore confirmé (< 10 min)
 *   delayed   pas d'acceptation après 10 min (reprise ou blocage possible)
 *   failed    envoi abandonné (expiré ou refusé)
 *   unknown   état non observable (automation Brevo historique, mode dégradé…)
 */
import { getLeadMagnet } from "@/config/leadMagnets";
import { guideStateFields } from "@/config/multiGuides";
import type { BrevoContact } from "@/lib/brevo/api";
import { guideDeliveryKey, parseGuideRequest } from "@/lib/guides/requests";
import { readGuideReceipt } from "@/lib/guides/store";
import { parseDeliveryRef } from "@/lib/sequences/delivery";

export type PublicDeliveryState = "accepted" | "pending" | "delayed" | "failed" | "unknown";
const DELAYED_AFTER_MS = 10 * 60_000;

export function publicDeliveryState(contact: Pick<BrevoContact, "id" | "attributes">, slug: string, now: Date): PublicDeliveryState {
  if (!getLeadMagnet(slug)) return "unknown";
  const age = (at: number) => (now.getTime() - at > DELAYED_AFTER_MS ? "delayed" : "pending");
  const fields = guideStateFields(slug);
  const request = parseGuideRequest(contact.attributes[fields.request], slug);
  if (request) {
    if (!request.queued) return "unknown";
    const receipt = readGuideReceipt(contact.attributes[fields.sent]);
    if (receipt?.key === guideDeliveryKey(contact.id, request)) {
      if (receipt.status === "SENT") return "accepted";
      if (receipt.status === "EXPIRED") return "failed";
    }
    return age(Date.parse(request.requestedAt));
  }
  const ref = parseDeliveryRef(contact.attributes.GUIDE_DELIVERY_REF);
  if (!ref || ref.slug !== slug) return "unknown";
  switch (contact.attributes.GUIDE_DELIVERY_STATUS) {
    case "SENT": return "accepted";
    case "PENDING": return age(ref.at.getTime());
    case "FAILED":
    case "EXPIRED": return "failed";
    default: return "unknown";
  }
}
