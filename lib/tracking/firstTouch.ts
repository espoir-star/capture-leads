/**
 * First touch — CLIENT. Mémorise la PREMIÈRE visite portant des UTM
 * (source, medium, campagne, contenu, page d'arrivée, date) pendant 90 jours.
 *
 * Stockage first-party (localStorage du domaine), sans identifiant ni donnée
 * personnelle : uniquement la provenance marketing. Jamais écrasé par une
 * visite ultérieure tant qu'il n'a pas expiré.
 *
 * Toute erreur de stockage (navigation privée, stockage bloqué) est ignorée :
 * l'attribution retombe alors sur les UTM de l'URL courante.
 */

import { cleanTouch, hasUtm, utmFromSearchParams, type Touch } from "@/lib/tracking/utm";

const KEY = "althoce_first_touch";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function readFirstTouch(): Touch | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const touch = cleanTouch(JSON.parse(raw));
    if (!touch?.ts || Date.now() - touch.ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return undefined;
    }
    return touch;
  } catch {
    return undefined;
  }
}

/** Touche de la visite courante (UTM de l'URL + page d'arrivée). */
export function currentTouch(): Touch {
  return {
    ...utmFromSearchParams(new URLSearchParams(window.location.search)),
    landing_page: window.location.pathname,
    ts: Date.now(),
  };
}

/** À appeler à chaque chargement de page : n'écrit que si aucun first touch valide n'existe. */
export function recordFirstTouch(): void {
  const touch = currentTouch();
  if (!hasUtm(touch) || readFirstTouch()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(touch));
  } catch {
    /* stockage indisponible : on continue sans first touch */
  }
}
