/**
 * Registre des contenus sources (posts LinkedIn, etc.), indexé par UTM_CONTENT.
 *
 * UTM_CONTENT identifie le post : convention LinkedIn  LI_[CODE]_[AAAAMMJJ]_[NN]
 *   ex. LI_EC_20261008_01 = 1er post du 08/10/2026 ciblant les experts-comptables.
 *
 * Renseigner ici l'URL du post quand on la connaît : elle est copiée dans
 * SOURCE_CONTENT_URL (premier contact uniquement) et servira à n8n pour
 * retrouver les profils LinkedIn des leads chauds.
 * N'ajouter que des URL réelles (aucune URL inventée).
 */

export interface SourceContent {
  platform: "linkedin" | "newsletter" | "webinar" | "site" | "autre";
  /** URL publique du contenu (post LinkedIn…) */
  url?: string;
  campaign?: string;
  /** Slug de la ressource promue */
  resource?: string;
  publishedAt?: string;
}

export const SOURCE_REGISTRY: Record<string, SourceContent> = {
  // "LI_EC_20261008_01": {
  //   platform: "linkedin",
  //   url: "https://www.linkedin.com/posts/…",
  //   campaign: "guide_experts_comptables",
  //   resource: "12-cas-usage-experts-comptables",
  //   publishedAt: "2026-10-08",
  // },
};

/** Codes courts utilisés dans UTM_CONTENT (LI_[CODE]_…) */
export const CONTENT_CODES: Record<string, string> = {
  EC: "Experts-comptables",
  DAF: "Direction financière",
  FIN: "Finance (général)",
  DRT: "Droit",
  MKT: "Marketing",
  GEN: "Général",
};

export const LINKEDIN_UTM_CONTENT_PATTERN = /^LI_[A-Z0-9]{2,6}_\d{8}_\d{2}$/;

export function getSourceContent(utmContent: string | undefined): SourceContent | undefined {
  if (!utmContent) return undefined;
  return Object.prototype.hasOwnProperty.call(SOURCE_REGISTRY, utmContent)
    ? SOURCE_REGISTRY[utmContent]
    : undefined;
}
