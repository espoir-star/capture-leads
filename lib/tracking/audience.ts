/**
 * Mesure d'audience Vercel (Web Analytics) : sans cookie, sans donnée personnelle.
 * Module PUR (testé dans tests/audience.test.ts).
 *
 * L'offre gratuite de Vercel ne lit pas les UTM : seul le chemin de la page est
 * compté. Pour savoir de quel post vient une visite, on range l'identifiant du
 * post dans le chemin envoyé à Vercel (jamais dans la vraie adresse) :
 *
 *   /rdv/agent-pieces?utm_content=LI_EC_20261112_01  →  /rdv/agent-pieces/via-LI_EC_20261112_01
 *   /g/10-prompts?utm_campaign=nl_finance_20261117   →  /g/10-prompts/via-nl_finance_20261117
 *
 * Tout le reste de l'adresse (paramètres, jetons des liens d'email) est retiré.
 */
import { cleanUtmValue } from "@/lib/tracking/utm";

/** Pages publiques dont on veut la provenance (ressources, rendez-vous, webinaires). */
const LABELLED = /^\/(g|r|rdv|w)\/[a-z0-9-]+$/;

/** Identifiant du post (utm_content), sinon la campagne (newsletters). */
export function audienceLabel(params: URLSearchParams): string | undefined {
  const content = cleanUtmValue("utm_content", params.get("utm_content"));
  if (content) return content;
  const campaign = params.get("utm_campaign")?.trim() ?? "";
  return /^[\w-]{1,80}$/.test(campaign) ? campaign : undefined;
}

/** Adresse transmise à Vercel : chemin seul, plus « /via-<post> » sur les pages suivies. */
export function audienceUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const label = LABELLED.test(path) ? audienceLabel(url.searchParams) : undefined;
  return url.origin + (label ? `${path}/via-${label}` : path);
}
