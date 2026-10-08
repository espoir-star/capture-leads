/**
 * Point d'entrée UNIQUE des traceurs non essentiels — CLIENT.
 *
 * initializeMarketingTrackers() : appelée seulement après « Tout accepter »
 *   → Google Analytics 4, Meta Pixel, tracker Brevo (s'ils sont configurés).
 * disableMarketingTrackers()    : passage à « Essentiels uniquement »
 *   → plus aucun envoi pour la suite, cookies non essentiels de notre domaine supprimés.
 *
 * Aucun script n'est chargé avant le choix : rien à « nettoyer après coup »
 * pour un visiteur qui n'a jamais accepté.
 */

import { initializeAnalytics, revokeAnalytics } from "@/lib/analytics";
import { loadBrevoTracker, revokeBrevoTracker } from "@/lib/tracking/brevoTracker";
import { hasMarketingConsent } from "@/lib/tracking/consent";
import { loadMetaPixel, revokeMetaPixel } from "@/lib/tracking/metaPixel";

/** Cookies non essentiels déposés sur notre domaine par ces outils */
const NON_ESSENTIAL_COOKIE = /^(_ga|_gid|_gat|_fbp|_fbc|sib_|brevo)/;

export function initializeMarketingTrackers(): void {
  if (!hasMarketingConsent()) return; // garde-fou : jamais sans « Tout accepter »
  for (const init of [initializeAnalytics, loadMetaPixel, loadBrevoTracker]) {
    try {
      init();
    } catch (e) {
      // une panne d'un outil tiers ne doit jamais casser la page ni le formulaire
      console.warn("Traceur non initialisé :", e instanceof Error ? e.message : e);
    }
  }
}

export function removeNonEssentialCookies(): void {
  const names = document.cookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => NON_ESSENTIAL_COOKIE.test(n));
  const parts = location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => "." + parts.slice(i).join("."))];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ""} SameSite=Lax`;
    }
  }
}

export function disableMarketingTrackers(): void {
  for (const revoke of [revokeAnalytics, revokeMetaPixel, revokeBrevoTracker]) {
    try {
      revoke();
    } catch {
      /* best effort */
    }
  }
  removeNonEssentialCookies();
}
