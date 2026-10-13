/**
 * Liens courts de diffusion (LinkedIn) : /l/<code> → page du guide avec ses UTM.
 * Le post affiche un lien propre ; la page lit les UTM dans l'adresse après la
 * redirection (lib/tracking/firstTouch.ts), le suivi est donc identique.
 *
 * Un code = UNE publication (utm_content LI_[CODE]_[AAAAMMJJ]_[NN], voir
 * config/sourceRegistry.ts). Pour un nouveau post : ajouter une entrée.
 */
import { getLeadMagnet } from "@/config/leadMagnets";

export interface ShortLink {
  slug: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  /** null réserve un code, sans le diffuser tant que la date du post n'est pas confirmée. */
  utm_content: string | null;
}

export const SHORT_LINKS: Readonly<Record<string, ShortLink>> = {
  db1: {
    slug: "tableaux-de-bord-claude-cabinets",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "guide_claude_dashboards_cabinets",
    // TODO date réelle du post demandée à Espoir : LI_EC_AAAAMMJJ_01.
    // Ne pas confondre la date de création du guide avec sa publication LinkedIn.
    utm_content: null,
  },
  ec1: {
    slug: "12-cas-usage-experts-comptables",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "12_cas_usage_experts_comptables",
    utm_content: "LI_EC_20261012_01",
  },
};

/** Chemin cible (relatif) d'un code, ou null s'il est inconnu */
export function shortLinkTarget(code: string): string | null {
  if (!Object.hasOwn(SHORT_LINKS, code)) return null;
  const l = SHORT_LINKS[code];
  if (!l.utm_content) return null;
  if (!getLeadMagnet(l.slug)) return null;
  const q = new URLSearchParams({ utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign, utm_content: l.utm_content });
  return `/r/${l.slug}?${q}`;
}
