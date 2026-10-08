/**
 * Qualité email côté SERVEUR — gratuit, sans API tierce, sans sonde SMTP.
 *
 *   1. trim + minuscules (+ domaine accentué converti en punycode)
 *   2. syntaxe
 *   3. valeurs manifestement factices / domaines réservés (détection prudente)
 *   4. domaine jetable (lib/data-quality/disposableDomains.ts)
 *   5. CAPACITÉ DE RÉCEPTION, selon les règles SMTP standard :
 *      - le domaine existe (sinon NXDOMAIN → refus)
 *      - MX nul « . » (RFC 7505) → le domaine déclare ne recevoir aucun email → refus
 *      - MX présents → au moins un serveur MX doit avoir une adresse IP joignable
 *        (MX pointant vers des noms inexistants ou vers 127.0.0.1 → refus)
 *      - AUCUN MX → MX implicite (RFC 5321 § 5.1) : le domaine reçoit sur son
 *        adresse A/AAAA. « Pas de MX » n'est donc PAS un refus si une adresse existe.
 *
 * Fail-open UNIQUEMENT si le DNS ne répond pas (timeout, SERVFAIL, budget de
 * 4 s dépassé) : on ne peut pas conclure, l'adresse passe en PENDING. Une
 * preuve négative (domaine inexistant, aucun serveur de réception) est
 * toujours refusée.
 *
 * Utilisé par l'API (lib/lead/capture.ts) et par le backfill (lib/backfill).
 */

import { Resolver } from "node:dns/promises";
import { isDisposableDomain } from "@/lib/data-quality/disposableDomains";
import { emailDomain, isValidEmailSyntax, normalizeEmail } from "@/lib/validation/email";

export { isDisposableDomain };

export type EmailCheckReason =
  | "ok"
  | "ok_implicit_mx"
  | "dns_unavailable"
  | "syntax"
  | "reserved_domain"
  | "fake_value"
  | "disposable"
  | "domain_not_found"
  | "no_mail_server";

export interface EmailCheck {
  email: string;
  /** false = refuser la soumission, ne rien créer dans Brevo */
  accepted: boolean;
  status: "PENDING" | "INVALID" | "DISPOSABLE";
  reason: EmailCheckReason;
}

/** Grands fournisseurs : MX connus, on évite une requête DNS inutile. */
const KNOWN_PROVIDERS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
  "live.com", "live.fr", "msn.com", "yahoo.com", "yahoo.fr", "icloud.com", "me.com",
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "neuf.fr", "laposte.net", "bbox.fr",
  "gmx.fr", "gmx.com", "protonmail.com", "proton.me",
]);

/** Domaines réservés (RFC 2606/6761) et domaines-placeholder tapés pour « faire semblant » */
const RESERVED_SUFFIXES = [".example", ".test", ".invalid", ".localhost", ".local"];
const FAKE_DOMAINS = new Set([
  "example.com", "example.net", "example.org", "exemple.com", "exemple.fr",
  "test.com", "test.fr", "fake.com", "fake.fr", "domain.com", "domaine.com",
  "domaine.fr", "mondomaine.com", "mondomaine.fr", "monemail.com", "localhost",
]);

/** Parties locales de test, refusées quel que soit le domaine */
const FAKE_LOCALS = new Set([
  "test", "test1", "test123", "testtest", "fake", "faux", "noreply", "no-reply",
  "nobody", "example", "exemple", "asdf",
]);

/** Mots « bidon » : refusés seulement en miroir local@mot.tld (test@test.com, abc@abc.com…) */
const FAKE_WORDS = new Set([
  "test", "fake", "faux", "abc", "email", "mail", "toto", "tata", "titi", "foo",
  "bar", "aaa", "xxx", "xyz", "demo", "azerty", "qwerty", "asdf",
]);

export function isFakeValue(email: string): "reserved_domain" | "fake_value" | null {
  const domain = emailDomain(email);
  const local = email.slice(0, email.lastIndexOf("@"));
  if (FAKE_DOMAINS.has(domain) || RESERVED_SUFFIXES.some((s) => domain.endsWith(s))) {
    return "reserved_domain";
  }
  if (FAKE_LOCALS.has(local)) return "fake_value";
  const firstLabel = domain.split(".")[0];
  if (FAKE_WORDS.has(local) && FAKE_WORDS.has(firstLabel)) return "fake_value";
  return null;
}

/** Contrôles hors réseau : syntaxe, factice, jetable. null = rien à signaler. */
export function classifyEmailOffline(
  email: string
): { status: "INVALID" | "DISPOSABLE"; reason: EmailCheckReason } | null {
  if (!isValidEmailSyntax(email)) return { status: "INVALID", reason: "syntax" };
  const fake = isFakeValue(email);
  if (fake) return { status: "INVALID", reason: fake };
  if (isDisposableDomain(emailDomain(email))) return { status: "DISPOSABLE", reason: "disposable" };
  return null;
}

/* ── DNS : capacité de réception ─────────────────────────────────────── */

export interface DnsLike {
  resolveMx(domain: string): Promise<{ exchange: string; priority: number }[]>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

export type DnsVerdict = "ok" | "ok_implicit_mx" | "domain_not_found" | "no_mail_server" | "dns_unavailable";

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "ENONAME", "NXDOMAIN"]);
const LOOKUP_TIMEOUT_MS = 2500;
const TOTAL_BUDGET_MS = 4000;
const MAX_MX_HOSTS = 5;

function errCode(e: unknown): string {
  return (e as { code?: string })?.code ?? "UNKNOWN";
}

let defaultResolver: DnsLike | null = null;
function getResolver(): DnsLike {
  if (!defaultResolver) defaultResolver = new Resolver({ timeout: 1500, tries: 2 });
  return defaultResolver;
}

const cache = new Map<string, { verdict: DnsVerdict; exp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), ms)
    ),
  ]);
}

/** Adresse capable de recevoir depuis Internet (pas de boucle locale / adresse nulle). */
function isRoutable(ip: string): boolean {
  return !(/^127\./.test(ip) || ip === "0.0.0.0" || ip === "::1" || ip === "::");
}

/** true = une adresse joignable existe ; false = preuve qu'il n'y en a aucune ; "unknown" = DNS muet */
async function hostReachable(host: string, dns: DnsLike): Promise<boolean | "unknown"> {
  const results = await Promise.allSettled([
    withTimeout(dns.resolve4(host), LOOKUP_TIMEOUT_MS),
    withTimeout(dns.resolve6(host), LOOKUP_TIMEOUT_MS),
  ]);
  const addresses = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (addresses.some(isRoutable)) return true;
  if (addresses.length > 0) return false; // uniquement 127.0.0.1 / 0.0.0.0
  const allNotFound = results.every((r) => r.status === "rejected" && NOT_FOUND.has(errCode(r.reason)));
  return allNotFound ? false : "unknown";
}

async function inspectDomain(domain: string, dns: DnsLike): Promise<DnsVerdict> {
  let mx: { exchange: string; priority: number }[];
  try {
    mx = await withTimeout(dns.resolveMx(domain), LOOKUP_TIMEOUT_MS);
  } catch (e) {
    const code = errCode(e);
    if (code === "ENOTFOUND" || code === "NXDOMAIN" || code === "ENONAME") return "domain_not_found";
    if (code !== "ENODATA") return "dns_unavailable";
    mx = []; // le domaine existe mais n'a pas de MX
  }

  const hosts = mx
    .filter((m) => m.exchange && m.exchange !== ".")
    .sort((a, b) => a.priority - b.priority)
    .map((m) => m.exchange.replace(/\.$/, ""));

  // MX nul (RFC 7505) : le domaine refuse explicitement tout email
  if (mx.length > 0 && hosts.length === 0) return "no_mail_server";

  // Aucun MX : MX implicite sur l'adresse du domaine (RFC 5321 § 5.1)
  if (hosts.length === 0) {
    const r = await hostReachable(domain, dns);
    return r === true ? "ok_implicit_mx" : r === false ? "no_mail_server" : "dns_unavailable";
  }

  // MX présents : au moins un serveur doit être joignable
  const checks = await Promise.all(hosts.slice(0, MAX_MX_HOSTS).map((h) => hostReachable(h, dns)));
  if (checks.includes(true)) return "ok";
  if (checks.includes("unknown")) return "dns_unavailable";
  return "no_mail_server";
}

export async function checkDomainDns(domain: string, dns: DnsLike = getResolver()): Promise<DnsVerdict> {
  if (KNOWN_PROVIDERS.has(domain)) return "ok";
  const hit = cache.get(domain);
  if (hit && hit.exp > Date.now()) return hit.verdict;

  // Budget global : un DNS lent ne doit jamais retarder le guide au-delà de 4 s
  const verdict = await withTimeout(inspectDomain(domain, dns), TOTAL_BUDGET_MS).catch(
    () => "dns_unavailable" as const
  );
  // on ne met pas en cache une panne : la prochaine soumission retentera
  if (verdict !== "dns_unavailable") cache.set(domain, { verdict, exp: Date.now() + CACHE_TTL_MS });
  return verdict;
}

/* ── Point d'entrée ──────────────────────────────────────────────────── */

export async function checkEmail(raw: unknown, opts: { dns?: DnsLike; skipDns?: boolean } = {}): Promise<EmailCheck> {
  const email = normalizeEmail(raw);
  const offline = classifyEmailOffline(email);
  if (offline) return { email, accepted: false, ...offline };
  if (opts.skipDns) return { email, accepted: true, status: "PENDING", reason: "ok" };

  const verdict = await checkDomainDns(emailDomain(email), opts.dns);
  if (verdict === "domain_not_found" || verdict === "no_mail_server") {
    return { email, accepted: false, status: "INVALID", reason: verdict };
  }
  return { email, accepted: true, status: "PENDING", reason: verdict };
}

/** Messages affichés : simples, sans détail technique. */
export function emailErrorMessage(check: EmailCheck): string {
  return check.status === "DISPOSABLE"
    ? "Merci d’utiliser une adresse email personnelle ou professionnelle valide."
    : "Veuillez vérifier votre adresse email.";
}
