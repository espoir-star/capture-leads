/**
 * Normalisation + syntaxe email. Module PUR (sans réseau), utilisable côté
 * client et serveur. Les vérifications DNS/MX et jetables sont dans
 * lib/data-quality/email.ts (serveur uniquement).
 */

/** trim + minuscules ; un domaine accentué (société.fr) est converti en punycode. */
export function normalizeEmail(raw: unknown): string {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  const at = email.lastIndexOf("@");
  const domain = at > 0 ? email.slice(at + 1) : "";
  if (!domain || /^[\x20-\x7e]*$/.test(domain)) return email;
  try {
    return email.slice(0, at + 1) + new URL(`http://${domain}`).hostname;
  } catch {
    return email;
  }
}

const LOCAL_PART = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1);
}

/**
 * Syntaxe stricte mais réaliste (RFC 5321 simplifiée) : pas de guillemets,
 * pas d'IP littérale, domaine à au moins deux labels avec TLD alphabétique.
 */
export function isValidEmailSyntax(email: string): boolean {
  if (email.length < 6 || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || email.indexOf("@") !== at) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => LABEL.test(l))) return false;
  return TLD.test(labels[labels.length - 1]);
}
