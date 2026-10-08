/**
 * UTM : lecture, nettoyage, attribution. Module PUR (client + serveur).
 *
 *   utm_source   canal       linkedin
 *   utm_medium   type        organic
 *   utm_campaign campagne    guide_experts_comptables
 *   utm_content  contenu     LI_EC_20261008_01  (identifiant du post)
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/** Touche marketing : UTM + page d'arrivée + horodatage (ms) */
export interface Touch extends Utm {
  landing_page?: string;
  ts?: number;
}

/** Valeur UTM nettoyée : jamais bloquante, une valeur absurde est simplement ignorée. */
export function cleanUtmValue(key: UtmKey, raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  // utm_content est un identifiant : format strict, sinon ignoré (jamais « réparé »)
  if (key === "utm_content") {
    const id = raw.trim();
    return /^[\w.:-]{1,100}$/.test(id) ? id : undefined;
  }
  let v = raw.replace(/[\u0000-\u001F\u007F<>"'`]/g, "").trim().slice(0, 120);
  if (!v) return undefined;
  if (key === "utm_source" || key === "utm_medium") v = v.toLowerCase();
  return v;
}

export function cleanUtm(input: unknown): Utm {
  const out: Utm = {};
  if (!input || typeof input !== "object") return out;
  for (const key of UTM_KEYS) {
    const v = cleanUtmValue(key, (input as Record<string, unknown>)[key]);
    if (v) out[key] = v;
  }
  return out;
}

export function hasUtm(u: Utm | undefined): boolean {
  return !!u && UTM_KEYS.some((k) => !!u[k]);
}

export function utmFromSearchParams(params: URLSearchParams): Utm {
  const raw: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) raw[k] = v;
  }
  return cleanUtm(raw);
}

/** Chemin seul, sans query ni fragment (aucune donnée personnelle dans les URL stockées). */
export function cleanPath(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.startsWith("/")) return undefined;
  const path = raw.split(/[?#]/)[0].slice(0, 200);
  return /^\/[\w\-./]*$/.test(path) ? path : undefined;
}

export function cleanTouch(input: unknown): Touch | undefined {
  if (!input || typeof input !== "object") return undefined;
  const o = input as Record<string, unknown>;
  const touch: Touch = { ...cleanUtm(o) };
  const lp = cleanPath(o.landing_page);
  if (lp) touch.landing_page = lp;
  const ts = Number(o.ts);
  if (Number.isFinite(ts) && ts > 1.6e12 && ts < Date.now() + 864e5) touch.ts = ts;
  return hasUtm(touch) || touch.landing_page ? touch : undefined;
}

/**
 * Attribution d'une soumission : le first touch mémorisé (90 j) prime sur la
 * visite courante. Si aucun first touch, on prend les UTM de la visite.
 */
export function resolveAttribution(firstTouch: Touch | undefined, current: Touch | undefined): Touch {
  if (firstTouch && hasUtm(firstTouch)) return firstTouch;
  return current ?? {};
}

/**
 * Ajoute des UTM à un lien (emails Brevo) sans jamais doubler un paramètre
 * déjà présent. Ne touche pas aux liens non http(s) ni aux balises Brevo.
 */
export function addUtmToUrl(url: string, utm: Utm): string {
  if (!/^https?:\/\//i.test(url) || url.includes("{{")) return url;
  try {
    const u = new URL(url);
    for (const key of UTM_KEYS) {
      const v = utm[key];
      if (v && !u.searchParams.has(key)) u.searchParams.set(key, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}
