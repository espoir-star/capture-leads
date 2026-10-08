/**
 * Consentement cookies — CLIENT. Source unique de vérité.
 *
 *   localStorage["althoce_cookie_consent"] = { version: 1, choice: "ALL" | "ESSENTIAL", timestamp }
 *
 * - Avant toute décision : ESSENTIAL (aucun traceur non essentiel chargé).
 * - Choix mémorisé ~6 mois, puis la bannière réapparaît.
 * - "ALL" autorise Google Analytics, Meta Pixel et le tracker Brevo
 *   (lib/tracking/marketing.ts). "ESSENTIAL" n'autorise aucun d'eux.
 *
 * Indépendant de la case newsletter (OPT_IN) et de Turnstile.
 */

export const COOKIE_CONSENT_KEY = "althoce_cookie_consent";
export const CONSENT_VERSION = 1;
/** ~6 mois */
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;

/** Événements navigateur : choix modifié / demande de réouverture de la bannière */
export const CONSENT_EVENT = "althoce:cookie-consent";
export const OPEN_PREFERENCES_EVENT = "althoce:open-cookie-preferences";

/** Anciennes clés (case cookies du formulaire, sept.–oct. 2026), nettoyées au chargement */
const LEGACY_KEYS = ["althoce-analytics-consent", "althoce-marketing-consent"];

export type CookieChoice = "ALL" | "ESSENTIAL";

export interface StoredConsent {
  version: typeof CONSENT_VERSION;
  choice: CookieChoice;
  timestamp: string;
}

/** Consentement valide (bonne version, choix connu, non expiré), sinon null. */
export function parseConsent(raw: string | null, now = Date.now()): StoredConsent | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<StoredConsent>;
    if (o.version !== CONSENT_VERSION) return null;
    if (o.choice !== "ALL" && o.choice !== "ESSENTIAL") return null;
    const t = Date.parse(String(o.timestamp));
    if (!Number.isFinite(t) || t > now + 60_000 || now - t > CONSENT_MAX_AGE_MS) return null;
    return { version: CONSENT_VERSION, choice: o.choice, timestamp: String(o.timestamp) };
  } catch {
    return null;
  }
}

export function readConsent(): StoredConsent | null {
  try {
    return parseConsent(localStorage.getItem(COOKIE_CONSENT_KEY));
  } catch {
    return null;
  }
}

/** Choix effectif : ESSENTIAL tant qu'aucune décision valide n'existe. */
export function getCookieChoice(): CookieChoice {
  return readConsent()?.choice ?? "ESSENTIAL";
}

/** Traceurs non essentiels autorisés uniquement sur choix explicite "ALL". */
export function hasMarketingConsent(): boolean {
  return typeof window !== "undefined" && getCookieChoice() === "ALL";
}

export function saveConsent(choice: CookieChoice, now = new Date()): StoredConsent {
  const consent: StoredConsent = { version: CONSENT_VERSION, choice, timestamp: now.toISOString() };
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
  } catch {
    /* stockage bloqué : le choix vaut pour la page en cours uniquement */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export function cleanupLegacyConsent(): void {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignoré */
  }
}
