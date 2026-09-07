/**
 * Domaines email jetables (bloqués) et corrections de typo courantes
 * (suggérées, jamais bloquées). Listes à enrichir au fil de l'eau.
 */

const DOMAINES_JETABLES = new Set([
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "throwawaymail.com",
  "trashmail.com",
  "getnada.com",
  "sharklasers.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "moakt.cc",
  "discard.email",
  "mytemp.email",
  "mohmal.com",
  "emailondeck.com",
  "spamgourmet.com",
  "mintemail.com",
  "burnermail.io",
  "einrot.com",
  "correotemporal.org",
]);

/** Typos courantes → domaine corrigé. Complète la détection générique par distance. */
const TYPOS_CONNUES: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmailcom": "gmail.com",
  "gmail.fr": "gmail.com",
  "hotmial.fr": "hotmail.fr",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmailcom": "hotmail.com",
  "outlok.fr": "outlook.fr",
  "outlok.com": "outlook.com",
  "outlookcom": "outlook.com",
  "yaho.fr": "yahoo.fr",
  "yaho.com": "yahoo.com",
  "yahoo.fre": "yahoo.fr",
  "wanadoo.fre": "wanadoo.fr",
  "orange.fre": "orange.fr",
};

/** Domaines fréquents utilisés pour une détection générique par distance (typos non listées explicitement) */
const DOMAINES_COURANTS = [
  "gmail.com",
  "hotmail.com",
  "hotmail.fr",
  "outlook.com",
  "outlook.fr",
  "yahoo.com",
  "yahoo.fr",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "laposte.net",
  "icloud.com",
  "live.fr",
  "sfr.fr",
  "bbox.fr",
];

function domaine(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

export function domaineJetable(email: string): boolean {
  return DOMAINES_JETABLES.has(domaine(email));
}

/** Distance de Levenshtein, bornée (suffisant pour des domaines courts) */
function distance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** Retourne l'email corrigé suggéré, ou null si rien à suggérer */
export function suggestionEmail(email: string): string | null {
  const d = domaine(email);
  if (!d) return null;

  if (TYPOS_CONNUES[d]) {
    return email.replace(d, TYPOS_CONNUES[d]);
  }

  for (const candidat of DOMAINES_COURANTS) {
    if (d === candidat) return null; // déjà correct
    if (distance(d, candidat) === 1) {
      return email.replace(d, candidat);
    }
  }
  return null;
}
