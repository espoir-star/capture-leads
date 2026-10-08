/**
 * Tracker Brevo — CLIENT. Chargé une seule fois via initializeMarketingTrackers()
 * (lib/tracking/marketing.ts), et UNIQUEMENT si :
 *   - NEXT_PUBLIC_BREVO_CLIENT_KEY est défini (Brevo > Automation > Paramètres)
 *   - le visiteur a choisi « Tout accepter » (le tracker dépose un cookie)
 *
 * Syntaxe officielle (developers.brevo.com, « Getting started with JS
 * implementation » et « Identify users ») : script sdk-loader.js + file
 * `window.Brevo` avec ["init", { client_key }] puis ["identify", { identifiers }].
 *
 * Les événements métier (lead_magnet_submitted…) sont envoyés côté serveur
 * (lib/brevo/events.ts) : fiables, indépendants des bloqueurs et du consentement
 * cookies. Le tracker sert aux pages vues des contacts identifiés.
 */

import { hasMarketingConsent } from "@/lib/tracking/consent";

export const BREVO_CLIENT_KEY = process.env.NEXT_PUBLIC_BREVO_CLIENT_KEY?.trim() ?? "";
const SDK_URL = "https://cdn.brevo.com/js/sdk-loader.js";

type BrevoQueue = unknown[] & { push: (...items: unknown[]) => number };
type BrevoWindow = Window & { Brevo?: BrevoQueue };

let initialized = false;

export function loadBrevoTracker(): boolean {
  if (typeof window === "undefined" || !BREVO_CLIENT_KEY || !hasMarketingConsent()) return false;
  if (initialized) return true;
  const w = window as BrevoWindow;
  w.Brevo = w.Brevo || ([] as unknown as BrevoQueue);
  w.Brevo.push(["init", { client_key: BREVO_CLIENT_KEY }]);
  if (!document.getElementById("althoce-brevo-sdk")) {
    const s = document.createElement("script");
    s.id = "althoce-brevo-sdk";
    s.async = true;
    s.src = SDK_URL;
    document.head.appendChild(s);
  }
  initialized = true;
  return true;
}

/** Associe le cookie Brevo du visiteur à son email, après une soumission réussie. */
export function identifyBrevoContact(email: string): void {
  if (!loadBrevoTracker()) return;
  (window as BrevoWindow).Brevo!.push(["identify", { identifiers: { email_id: email } }]);
}

/**
 * Passage à « Essentiels uniquement » : le SDK déjà chargé ne peut pas être
 * déchargé ; la file `window.Brevo` est neutralisée pour que plus rien ne
 * parte depuis notre code, et le SDK n'est plus chargé aux pages suivantes.
 */
export function revokeBrevoTracker(): void {
  if (typeof window === "undefined") return;
  const noop = Object.assign([] as unknown[], { push: () => 0 }) as BrevoQueue;
  (window as BrevoWindow).Brevo = noop;
  initialized = false;
}
