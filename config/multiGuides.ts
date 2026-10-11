/**
 * Multi-guides : activation explicite après création des attributs et recette.
 * Trois champs techniques indépendants par guide : demande / livraison / inscription.
 * Aucun achat de stockage supplémentaire ; aucun compteur modifié par le navigateur.
 */
import { LEAD_MAGNETS, getLeadMagnet } from "@/config/leadMagnets";

type Env = Record<string, string | undefined>;
export function multiGuidesEnabled(email: string, env: Env = process.env): boolean {
  if (env.ALTHOCE_MULTI_GUIDES === "on") return true;
  return env.ALTHOCE_MULTI_GUIDES === "qa" && (env.ALTHOCE_SEQUENCE_QA_EMAILS ?? "")
    .split(/[,;\s]+/).map((v) => v.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}
export const GUIDE_RECENCY_DAYS = 30;
export const GUIDE_FOLLOWUP_INTERVAL_HOURS = 48;
export const GUIDE_DELIVERY_MAX_AGE_HOURS = 72;
export const MULTI_GUIDE_LAST_FOLLOWUP = "MG_LAST_FOLLOWUP_AT";

export function guideStateFields(slug: string) {
  const lm = getLeadMagnet(slug);
  if (!lm) throw new Error("Guide inconnu pour le suivi multi-guides");
  return { request: `MG_REQ_${lm.brevoListId}`, sent: `MG_SENT_${lm.brevoListId}`, enrolled: `MG_ENROLLED_${lm.brevoListId}` };
}

export const MULTI_GUIDE_ATTRIBUTES: { name: string; type: "text" | "float" | "date"; description: string }[] = [
  ...Object.values(LEAD_MAGNETS).flatMap((lm) => {
    const fields = guideStateFields(lm.slug);
    return [
      { name: fields.request, type: "text" as const, description: `Technique : dernière demande validée ${lm.slug}, date et provenance` },
      { name: fields.sent, type: "text" as const, description: `Technique : reçu de livraison ${lm.slug}, séparé des autres guides` },
      { name: fields.enrolled, type: "text" as const, description: `Technique : inscription n8n confirmée ou arrêtée pour ${lm.slug}` },
    ];
  }),
  { name: "GUIDES_COUNT", type: "float", description: "Nombre de guides distincts associés (pas nombre de lectures)" },
  { name: "GUIDES_NAMES", type: "text", description: "Titres des guides associés" },
  { name: "GUIDES_THEMES", type: "text", description: "Thèmes des guides, sans déduire le métier de la personne" },
  { name: "GUIDES_RECENT_30D", type: "float", description: "Guides distincts demandés dans les 30 derniers jours, dates prouvées seulement" },
  { name: "LAST_GUIDE_REQUEST_AT", type: "date", description: "Date de la dernière demande horodatée par le nouveau suivi" },
  { name: "GUIDE_INTEREST_LEVEL", type: "text", description: "SINGLE / MULTI_KNOWN / MULTI_RECENT : aide au tri, pas un nouveau consentement ni un score" },
  { name: MULTI_GUIDE_LAST_FOLLOWUP, type: "text", description: "Horodatage ISO du dernier suivi marketing guides envoyé par le nouveau moteur" },
];
