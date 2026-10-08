/**
 * Domaines d'email jetables — module unique, serveur uniquement.
 *
 * Liste      : lib/data-quality/disposable-domains.json (9 225 domaines)
 *              = liste communautaire CC0 github.com/disposable-email-domains
 *              + ajouts maison − exceptions (EXTRA / ALLOW du script).
 * Mise à jour: npm run data:disposable  (scripts/data-quality/update-disposable-domains.ts),
 *              relire le diff, commiter. Aucune dépendance payante.
 *
 * Si la liste est illisible : le fichier JSON est intégré au build, donc un
 * fichier absent ou corrompu fait échouer `next build` (jamais déployé cassé).
 * Si son contenu est vide ou anormal (< 1 000 entrées), la LISTE DE SECOURS
 * ci-dessous prend le relais avec une erreur dans les logs : le formulaire
 * continue de fonctionner et aucun email légitime n'est bloqué.
 */

import data from "./disposable-domains.json";

/** Secours : services jetables les plus courants (dont l'ancienne liste maison). */
const FALLBACK = [
  "mailinator.com", "yopmail.com", "yopmail.fr", "yopmail.net", "jetable.org",
  "tempmail.com", "temp-mail.org", "guerrillamail.com", "guerrillamail.info",
  "10minutemail.com", "throwawaymail.com", "trashmail.com", "trashmail.fr",
  "getnada.com", "sharklasers.com", "dispostable.com", "maildrop.cc",
  "fakeinbox.com", "mailnesia.com", "moakt.cc", "discard.email", "mytemp.email",
  "mohmal.com", "emailondeck.com", "spamgourmet.com", "mintemail.com",
  "burnermail.io", "einrot.com", "correotemporal.org",
];

function load() {
  const raw = data as { domains?: unknown; updatedAt?: string; count?: number };
  if (Array.isArray(raw.domains) && raw.domains.length >= 1000) {
    return { domains: new Set<string>(raw.domains as string[]), source: "fichier" as const, updatedAt: raw.updatedAt };
  }
  console.error(
    `Liste de domaines jetables illisible ou incomplète : liste de secours (${FALLBACK.length} domaines) utilisée`
  );
  return { domains: new Set<string>(FALLBACK), source: "secours" as const, updatedAt: undefined };
}

export const DISPOSABLE_LIST = load();

/** Le domaine ou l'un de ses parents (x.yopmail.com) est-il jetable ? */
export function isDisposableDomain(domain: string): boolean {
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (DISPOSABLE_LIST.domains.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
