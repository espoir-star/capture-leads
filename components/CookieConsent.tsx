"use client";

/**
 * Bannière cookies + lien « Gérer mes cookies » + point d'entrée des traceurs.
 *
 * - Aucun choix (ou choix expiré après ~6 mois) : bannière affichée, mode ESSENTIAL.
 * - « Tout accepter » : initializeMarketingTrackers() (GA4, Meta Pixel, tracker Brevo).
 * - « Essentiels uniquement » : aucun traceur ; s'ils tournaient, ils sont coupés.
 * - Le formulaire, Turnstile, les UTM et le first touch fonctionnent dans les deux cas.
 */

import { useEffect, useState } from "react";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { GA_ID } from "@/lib/analytics";
import {
  CONSENT_EVENT,
  OPEN_PREFERENCES_EVENT,
  cleanupLegacyConsent,
  openCookiePreferences,
  readConsent,
  saveConsent,
  type CookieChoice,
} from "@/lib/tracking/consent";
import { recordFirstTouch } from "@/lib/tracking/firstTouch";
import { disableMarketingTrackers, initializeMarketingTrackers } from "@/lib/tracking/marketing";

const PRIVACY_URL = "https://althoce.com/confidentialite/";

export default function CookieConsent() {
  const [choice, setChoice] = useState<CookieChoice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Indispensable au parcours, sans cookie ni donnée personnelle : toujours actif
    recordFirstTouch();
    cleanupLegacyConsent();
    const current = readConsent();
    setChoice(current?.choice ?? null);
    setOpen(!current);
    if (current?.choice === "ALL") initializeMarketingTrackers();

    const reopen = () => setOpen(true);
    const sync = () => setChoice(readConsent()?.choice ?? null);
    window.addEventListener(OPEN_PREFERENCES_EVENT, reopen);
    window.addEventListener(CONSENT_EVENT, sync);
    return () => {
      window.removeEventListener(OPEN_PREFERENCES_EVENT, reopen);
      window.removeEventListener(CONSENT_EVENT, sync);
    };
  }, []);

  function decide(next: CookieChoice) {
    saveConsent(next);
    setChoice(next);
    setOpen(false);
    if (next === "ALL") initializeMarketingTrackers();
    else disableMarketingTrackers(); // coupe les traceurs actifs et nettoie leurs cookies (sans effet sinon)
  }

  return (
    <>
      {choice === "ALL" && GA_ID && <GoogleAnalytics />}

      <footer className="pb-6 text-center">
        <button
          type="button"
          onClick={openCookiePreferences}
          className="text-xs text-secondaire underline underline-offset-2 hover:text-white transition-colors"
        >
          Gérer mes cookies
        </button>
      </footer>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-title"
          aria-describedby="cookie-text"
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
        >
          <div className="mx-auto w-full max-w-2xl rounded-2xl border border-bordure bg-carte p-5 shadow-2xl sm:p-6">
            <p id="cookie-title" className="font-display text-base font-semibold">
              Votre confidentialité
            </p>
            <p id="cookie-text" className="mt-2 text-sm leading-relaxed text-secondaire">
              Nous utilisons des cookies pour mesurer l&apos;utilisation de nos contenus et améliorer
              nos campagnes. Vous pouvez tout accepter ou utiliser uniquement les cookies essentiels
              au fonctionnement du site.{" "}
              <a
                href={PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white transition-colors"
              >
                En savoir plus
              </a>
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={() => decide("ALL")}
                className="w-full rounded-lg border border-accent bg-accent px-5 py-3 text-sm font-semibold text-white hover:border-accent-clair hover:bg-accent-clair active:scale-[0.99] transition"
              >
                Tout accepter
              </button>
              <button
                type="button"
                onClick={() => decide("ESSENTIAL")}
                className="w-full rounded-lg border border-white/40 bg-transparent px-5 py-3 text-sm font-semibold text-white hover:border-white hover:bg-white/5 active:scale-[0.99] transition"
              >
                Essentiels uniquement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
