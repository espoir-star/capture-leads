/**
 * Validation MINIMALE du téléphone : on ne rejette que les schémas
 * manifestement faux (répétition, séquence, liste noire explicite).
 * On laisse volontairement passer des numéros douteux mais plausibles
 * (DOM, formats internationaux) : ils seront filtrés manuellement à
 * l'extraction plutôt que bloqués à la saisie.
 */

/** Numéros nationaux explicitement interdits (indicatif retiré, sans le 0 initial) */
const NUMEROS_INTERDITS = new Set([
  "606060606",
  "600000000",
  "666666666",
  "612555555",
  "677777777",
  "123456789",
  "000000000",
  "111111111",
]);

/** 4 chiffres identiques ou plus, consécutifs */
function aRepetition(chiffres: string): boolean {
  return /(\d)\1{3,}/.test(chiffres);
}

/** 4 chiffres ou plus formant une séquence croissante ou décroissante consécutive */
function aSequence(chiffres: string): boolean {
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < chiffres.length; i++) {
    const diff = Number(chiffres[i]) - Number(chiffres[i - 1]);
    asc = diff === 1 ? asc + 1 : 1;
    desc = diff === -1 ? desc + 1 : 1;
    if (asc >= 4 || desc >= 4) return true;
  }
  return false;
}

/**
 * Retourne un motif de rejet si le numéro (partie nationale, sans l'indicatif)
 * correspond à un schéma manifestement faux, sinon null.
 */
export function numeroSuspect(local: string): string | null {
  if (!local) return "vide";
  if (NUMEROS_INTERDITS.has(local)) return "liste_noire";
  if (aRepetition(local)) return "repetition";
  if (aSequence(local)) return "sequence";
  return null;
}

/** Format E.164 générique : "+" suivi de 8 à 15 chiffres, le premier non nul */
export function formatE164Valide(tel: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(tel);
}

/** Construit un E.164 best-effort à partir d'un indicatif et d'une saisie libre (jamais null, pour permettre la journalisation même en cas de saisie invalide) */
export function construireE164(indicatif: string, brut: string): string {
  let chiffres = brut.replace(/\D/g, "");
  if (chiffres.startsWith(indicatif)) {
    chiffres = chiffres.slice(indicatif.length);
  } else if (chiffres.startsWith("0")) {
    chiffres = chiffres.slice(1);
  }
  return "+" + indicatif + chiffres;
}

/** Extrait la partie nationale (sans indicatif) d'un numéro E.164, pour tester les motifs suspects */
export function partieLocale(tel: string, indicatif: string): string {
  const chiffres = tel.replace(/\D/g, "");
  const ind = indicatif.replace(/\D/g, "");
  return chiffres.startsWith(ind) ? chiffres.slice(ind.length) : chiffres;
}
