/**
 * Met à jour la liste locale des domaines d'email jetables.
 *
 * Source : https://github.com/disposable-email-domains/disposable-email-domains
 * (liste communautaire CC0, maintenue avec une allowlist anti faux positifs).
 * Fusion : liste communautaire + EXTRA (ajouts Althoce) − ALLOW (exceptions).
 *
 * Usage : npm run data:disposable
 * Puis relire le diff de lib/data-quality/disposable-domains.json et commiter.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE =
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";
const OUT = resolve(process.cwd(), "lib/data-quality/disposable-domains.json");

/** Ajouts maison : reprend intégralement l'ancienne liste de lib/validationEmail.ts */
const EXTRA = [
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "jetable.org",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "guerrillamail.info",
  "10minutemail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.fr",
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
];

/** Exceptions : domaines à ne jamais considérer comme jetables */
const ALLOW = new Set<string>([]);

const DOMAIN = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function main() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
  const remote = (await res.text())
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith("#") && DOMAIN.test(l));

  if (remote.length < 1000) throw new Error(`Liste suspecte (${remote.length} entrées), abandon`);

  let previous: string[] = [];
  try {
    previous = JSON.parse(readFileSync(OUT, "utf8")).domains ?? [];
  } catch {
    /* première génération */
  }

  const domains = [...new Set([...remote, ...EXTRA])].filter((d) => !ALLOW.has(d)).sort();
  writeFileSync(
    OUT,
    JSON.stringify(
      { source: SOURCE, updatedAt: new Date().toISOString().slice(0, 10), count: domains.length, domains },
      null,
      0
    ) + "\n"
  );
  const prev = new Set(previous);
  const added = domains.filter((d) => !prev.has(d)).length;
  console.log(`${domains.length} domaines (${added} nouveaux) → ${OUT}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
