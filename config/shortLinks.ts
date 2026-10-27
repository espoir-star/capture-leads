/**
 * Liens courts de diffusion (LinkedIn) : /l/<code> → page du guide avec ses UTM.
 * Le post affiche un lien propre ; la page lit les UTM dans l'adresse après la
 * redirection (lib/tracking/firstTouch.ts), le suivi est donc identique.
 *
 * Un code = UNE publication (utm_content LI_[CODE]_[AAAAMMJJ]_[NN], voir
 * config/sourceRegistry.ts). Pour un nouveau post : ajouter une entrée.
 */
import { getLeadMagnet } from "@/config/leadMagnets";
import { getWebinar } from "@/config/webinars";

export interface ShortLink {
  /** Page cible : guide (/r/<slug>, défaut) ou webinar ouvert (/w/<slug>) */
  kind?: "guide" | "webinar";
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
    // Date de publication confirmée par Espoir : 13/10/2026.
    utm_content: "LI_EC_20261013_01",
  },
  sk1: {
    slug: "12-skills-claude-finance",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "12_skills_claude_finance",
    // Post annoncé par Espoir pour le 16/10/2026 (nouvelle version du guide, lecteur /g/).
    utm_content: "LI_FIN_20261016_01",
  },
  pl1: {
    slug: "guide-claude-pennylane",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "claude_pennylane_10_usages",
    // Post « 10 usages Claude × Pennylane » publié le vendredi 16/10/2026 (date donnée par Espoir).
    utm_content: "LI_EC_20261016_01",
  },
  sv1: {
    slug: "agent-surveillance-cabinets",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "agent_surveillance_cabinets",
    // Post « agent Surveillance » publié le 27/10/2026 (date donnée par Espoir).
    utm_content: "LI_EC_20261027_01",
  },
  ec1: {
    slug: "12-cas-usage-experts-comptables",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "12_cas_usage_experts_comptables",
    utm_content: "LI_EC_20261012_01",
  },
  wb1: {
    kind: "webinar",
    slug: "connecteurs-mcp-cabinets",
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "webinar_connecteurs_mcp_20261105",
    // Post « Commentez WEBINAIRE » (webinar du 05/11), publié le 28/10/2026 (date donnée par Espoir) :
    // lien envoyé en message privé.
    utm_content: "LI_EC_20261028_01",
  },
};

/** Chemin cible (relatif) d'un code, ou null s'il est inconnu */
export function shortLinkTarget(code: string): string | null {
  if (!Object.hasOwn(SHORT_LINKS, code)) return null;
  const l = SHORT_LINKS[code];
  if (!l.utm_content) return null;
  const webinar = l.kind === "webinar";
  if (webinar ? getWebinar(l.slug)?.status !== "open" : !getLeadMagnet(l.slug)) return null;
  const q = new URLSearchParams({ utm_source: l.utm_source, utm_medium: l.utm_medium, utm_campaign: l.utm_campaign, utm_content: l.utm_content });
  return `/${webinar ? "w" : "r"}/${l.slug}?${q}`;
}
