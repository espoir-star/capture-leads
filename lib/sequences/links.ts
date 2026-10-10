/**
 * Liens et paramètres injectés dans les modèles du moteur de séquences.
 * Calculés à l'envoi : aucun attribut Brevo n'est nécessaire.
 */

import { getRessource } from "@/lib/ressources";
import { createEmailConfirmToken } from "@/lib/security/emailConfirm";
import { createMarketingOptoutToken } from "@/lib/marketing/token";

type Env = Record<string, string | undefined>;

export const CTA_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";
const PRODUCTION_URL = "https://guide-gratuit-pi.vercel.app";

/** Domaine des liens : SITE_URL, sinon l'URL de branche en Preview, sinon la Production */
export function siteUrl(env: Env = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) return `https://${env.VERCEL_BRANCH_URL}`;
  return PRODUCTION_URL;
}

export interface UnsubscribeLinks {
  /** Page /desinscription (confirmation par bouton) */
  page: string;
  /** POST en un clic (List-Unsubscribe, RFC 8058) */
  oneClick: string;
}

export function unsubscribeLinks(email: string): UnsubscribeLinks | null {
  const t = createMarketingOptoutToken(email);
  if (!t) return null;
  const base = siteUrl();
  return { page: `${base}/desinscription?t=${t}`, oneClick: `${base}/api/marketing/unsubscribe?t=${t}` };
}

/** Lien de confirmation d'adresse, absent si l'adresse est déjà confirmée */
export function confirmUrl(email: string, emailStatus: unknown): string | undefined {
  if (emailStatus === "VERIFIED") return undefined;
  const t = createEmailConfirmToken(email);
  return t ? `${siteUrl()}/confirmer-email?t=${t}` : undefined;
}

/** Titre et lien du guide (modèles génériques) depuis lib/ressources.ts */
export function guideParams(slug: string | undefined): { GUIDE_TITLE: string; GUIDE_URL: string } | null {
  const r = slug ? getRessource(slug) : undefined;
  if (!r) return null;
  const title = (r.resourceCard?.titre ?? r.titre).replace(/<\/?accent>/g, "").trim();
  return { GUIDE_TITLE: title, GUIDE_URL: r.urlRessource };
}
