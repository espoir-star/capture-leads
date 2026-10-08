/**
 * Qualité téléphone — locale et gratuite (libphonenumber-js, métadonnées
 * complètes). Aucune API de lookup : la vérification réelle est faite par le
 * commercial au moment de l'appel (PHONE_STATUS = VERIFIED, posé à la main).
 *
 *   INVALID      : impossible techniquement (longueur, préfixe, non numérique)
 *                  ou faux manifeste (0123456789, chiffres tous identiques)
 *   SUSPECT      : format valide mais motif douteux (06 12 34 56 78,
 *                  06 66 66 66 66, numéro surtaxé…) → stocké, signalé
 *   VALID_FORMAT : format valide selon le plan de numérotation du pays
 */

import { parsePhoneNumberFromString, type CountryCode, type PhoneNumber } from "libphonenumber-js/max";

export type PhoneCheckStatus = "VALID_FORMAT" | "SUSPECT" | "INVALID";

export interface PhoneCheck {
  status: PhoneCheckStatus;
  /** Format E.164 (+33612345678), présent si le numéro est exploitable */
  e164?: string;
  /** Pays détecté (peut différer du pays choisi : DOM, NANP…) */
  country?: string;
  reason:
    | "ok"
    | "empty"
    | "non_numeric"
    | "not_possible"
    | "not_valid"
    | "blacklist"
    | "all_same_digit"
    | "few_distinct_digits"
    | "long_repetition"
    | "long_sequence"
    | "premium_or_special";
}

/** DOM-TOM : un « 0692… » saisi avec +33 est en réalité un mobile de La Réunion (+262). */
const FR_OVERSEAS: CountryCode[] = ["RE", "YT", "GP", "MQ", "GF", "PM", "BL", "MF", "NC", "PF", "WF"];

/** Faux manifestes connus (E.164) */
const BLACKLIST = new Set(["+33123456789", "+33987654321"]);

const ALLOWED_CHARS = /^[\d\s+().\-/]*$/;

function longestRun(digits: string): number {
  let best = 1;
  let cur = 1;
  for (let i = 1; i < digits.length; i++) {
    cur = digits[i] === digits[i - 1] ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

function longestSequence(digits: string): number {
  let best = 1;
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < digits.length; i++) {
    const diff = Number(digits[i]) - Number(digits[i - 1]);
    asc = diff === 1 ? asc + 1 : 1;
    desc = diff === -1 ? desc + 1 : 1;
    best = Math.max(best, asc, desc);
  }
  return best;
}

function parseValid(raw: string, country: CountryCode): PhoneNumber | undefined {
  const p = parsePhoneNumberFromString(raw, country);
  return p && p.isValid() ? p : undefined;
}

export function checkPhone(raw: unknown, country: CountryCode = "FR"): PhoneCheck {
  const input = String(raw ?? "").trim().slice(0, 40);
  if (!input) return { status: "INVALID", reason: "empty" };
  if (!ALLOWED_CHARS.test(input)) return { status: "INVALID", reason: "non_numeric" };

  const digits = input.replace(/\D/g, "");
  if (digits.length > 0 && new Set(digits.replace(/^0+/, "")).size <= 1) {
    return { status: "INVALID", reason: "all_same_digit" };
  }

  let parsed = parsePhoneNumberFromString(input, country);
  if (!parsed || !parsed.isPossible()) {
    return { status: "INVALID", reason: "not_possible" };
  }
  if (!parsed.isValid()) {
    // Repli DOM-TOM pour un numéro français
    const fallback =
      parsed.countryCallingCode === "33"
        ? FR_OVERSEAS.map((c) => parseValid("0" + parsed!.nationalNumber, c)).find(Boolean)
        : undefined;
    if (!fallback) return { status: "INVALID", reason: "not_valid" };
    parsed = fallback;
  }

  const e164 = parsed.number;
  const national = String(parsed.nationalNumber);
  const base = { e164, country: parsed.country };

  if (BLACKLIST.has(e164)) return { status: "INVALID", reason: "blacklist", ...base };

  if (new Set(national).size <= 2) return { status: "SUSPECT", reason: "few_distinct_digits", ...base };
  if (longestRun(national) >= 6) return { status: "SUSPECT", reason: "long_repetition", ...base };
  if (longestSequence(national) >= 7) return { status: "SUSPECT", reason: "long_sequence", ...base };

  const type = parsed.getType();
  if (
    type === "PREMIUM_RATE" ||
    type === "SHARED_COST" ||
    type === "TOLL_FREE" ||
    type === "PAGER" ||
    type === "UAN" ||
    type === "VOICEMAIL"
  ) {
    return { status: "SUSPECT", reason: "premium_or_special", ...base };
  }

  return { status: "VALID_FORMAT", reason: "ok", ...base };
}

export const PHONE_ERROR_MESSAGE = "Ce numéro ne semble pas valide. Vérifiez la saisie.";
