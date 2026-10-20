/**
 * Salle Google Meet et enregistrement d'un webinar : JAMAIS dans le dépôt
 * (public), jamais sur une page publique. Ils vivent dans les variables
 * d'environnement Vercel (Production), lues côté serveur uniquement :
 *
 *   WEBINAR_JOIN_URL__<SLUG>    https://meet.google.com/abc-defg-hij
 *   WEBINAR_REPLAY_URL__<SLUG>  https://drive.google.com/file/d/…/view
 *
 * <SLUG> = slug en majuscules, tirets remplacés par « _ »
 * (ia-cabinet-2026-11 → WEBINAR_JOIN_URL__IA_CABINET_2026_11).
 *
 * Une valeur au mauvais format est ignorée (traitée comme absente) : un
 * lien mal collé ne redirige jamais un inscrit ailleurs que sur Meet / Drive.
 * Le replay est « publié » quand sa variable existe : c'est la mise à
 * disposition contrôlée (permissions Drive vérifiées avant, voir
 * docs/WEBINAIRES.md et `npm run webinar:check`).
 */

type Env = Record<string, string | undefined>;

const envKey = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
export const joinEnvName = (slug: string) => `WEBINAR_JOIN_URL__${envKey(slug)}`;
export const replayEnvName = (slug: string) => `WEBINAR_REPLAY_URL__${envKey(slug)}`;

/** Salle Meet planifiée depuis Google Agenda (code xxx-xxxx-xxx). */
export const MEET_URL_RE = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?[\w=&-]*)?$/;
/** Fichier Drive partagé, ou vidéo YouTube non répertoriée. */
export const REPLAY_URL_RE =
  /^https:\/\/(?:drive\.google\.com\/(?:file\/d\/[\w-]{10,}\/(?:view|preview)(?:\?[\w=&-]*)?|open\?id=[\w-]{10,})|(?:www\.)?youtube\.com\/watch\?v=[\w-]{6,}|youtu\.be\/[\w-]{6,})$/;

function read(name: string, re: RegExp, env: Env): string | undefined {
  const v = env[name]?.trim();
  if (!v) return undefined;
  if (re.test(v)) return v;
  console.warn(JSON.stringify({ evt: "webinar", etape: "url_invalide", variable: name }));
  return undefined;
}

export function webinarJoinUrl(slug: string, env: Env = process.env): string | undefined {
  return read(joinEnvName(slug), MEET_URL_RE, env);
}

export function webinarReplayUrl(slug: string, env: Env = process.env): string | undefined {
  return read(replayEnvName(slug), REPLAY_URL_RE, env);
}
