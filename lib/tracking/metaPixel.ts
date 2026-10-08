/**
 * Meta Pixel — CLIENT. Chargé uniquement via initializeMarketingTrackers()
 * après « Tout accepter » (bannière cookies). Même pixel et même PageView
 * qu'avant ; il n'est plus chargé sans consentement.
 */

import { hasMarketingConsent } from "@/lib/tracking/consent";

/** Identifiant public du pixel (vide = Meta désactivé) */
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1102300042365707").trim();

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};
type MetaWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

let loaded = false;

export function loadMetaPixel(): void {
  if (typeof window === "undefined" || loaded || !META_PIXEL_ID || !hasMarketingConsent()) return;
  const w = window as MetaWindow;
  if (!w.fbq) {
    // Snippet officiel Meta, inchangé
    const n = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    } as Fbq;
    w.fbq = n;
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  w.fbq!("consent", "grant");
  w.fbq!("init", META_PIXEL_ID);
  w.fbq!("track", "PageView");
  loaded = true;
}

/** Retrait du consentement : plus aucun envoi (cookies supprimés par marketing.ts). */
export function revokeMetaPixel(): void {
  if (typeof window === "undefined") return;
  (window as MetaWindow).fbq?.("consent", "revoke");
  loaded = false;
}
