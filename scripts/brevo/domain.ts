/**
 * Domaine d'envoi althoce.fr + expéditeurs Brevo. DRY RUN PAR DÉFAUT.
 *
 *   npm run brevo:domain
 *        → état Brevo du domaine, enregistrements DNS demandés par Brevo,
 *          ce que le DNS public publie réellement, expéditeurs attendus.
 *          Aucune écriture.
 *
 *   npm run brevo:domain -- --apply
 *        → ajoute le domaine s'il est absent ; demande l'authentification
 *          à Brevo quand les 4 enregistrements sont publiés ; crée les
 *          expéditeurs manquants UNIQUEMENT si le domaine est authentifié
 *          (Brevo les valide alors sans email de vérification).
 *
 * Ne supprime ni ne modifie jamais un expéditeur ou un domaine existant.
 * Les valeurs DNS viennent de l'API Brevo, jamais du code.
 */

import { Resolver } from "node:dns/promises";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { findActiveSender, getSendingDomain, listSenders, type DnsRecord } from "@/lib/brevo/senders";
import { REPLY_TO, SENDERS, SENDING_DOMAIN } from "@/config/senders";

const APPLY = process.argv.includes("--apply");

const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const norm = (s: string) => s.trim().toLowerCase().replace(/\.$/, "");
const fqdn = (host: string) => (host === "@" ? SENDING_DOMAIN : `${host}.${SENDING_DOMAIN}`);

async function publicValues(rec: DnsRecord): Promise<string[]> {
  try {
    if (rec.type === "CNAME") return await resolver.resolveCname(fqdn(rec.host_name));
    if (rec.type === "TXT") return (await resolver.resolveTxt(fqdn(rec.host_name))).map((parts) => parts.join(""));
  } catch {
    // NXDOMAIN / ENODATA : rien de publié
  }
  return [];
}

/** Publié tel que Brevo le demande ? (+ alerte si doublon DMARC / SPF) */
async function checkRecord(rec: DnsRecord): Promise<{ published: boolean; note: string }> {
  const values = await publicValues(rec);
  if (rec.type === "CNAME") {
    const ok = values.some((v) => norm(v) === norm(rec.value));
    return { published: ok, note: ok ? "" : values.length ? `publié : ${values.join(", ")}` : "non publié" };
  }
  const ok = values.some((v) => v.trim() === rec.value.trim());
  const notes: string[] = [];
  if (rec.host_name === "_dmarc") {
    const dmarc = values.filter((v) => /^v=DMARC1/i.test(v));
    if (dmarc.length > 1) notes.push(`⚠ ${dmarc.length} enregistrements DMARC (un seul autorisé)`);
    else if (dmarc.length === 1 && !ok) notes.push(`DMARC existant différent : ${dmarc[0]}`);
  }
  if (rec.host_name === "@") {
    const spf = values.filter((v) => /^v=spf1/i.test(v));
    if (spf.length > 1) notes.push(`⚠ ${spf.length} SPF à la racine (un seul autorisé)`);
  }
  if (!ok && !notes.length) notes.push("non publié");
  return { published: ok, note: notes.join(" · ") };
}

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — domaine d'envoi ${SENDING_DOMAIN}\n`);

  let domain = await getSendingDomain(SENDING_DOMAIN);
  if (!domain) {
    if (!APPLY) {
      console.log("  ✗ Domaine absent de Brevo. --apply l'ajoute (aucun envoi, aucun DNS modifié).\n");
      return;
    }
    const res = await brevoRequest("/senders/domains", { method: "POST", body: { name: SENDING_DOMAIN }, retries: 0 });
    if (!res.ok) throw new Error(`Ajout refusé : ${res.status} ${res.code ?? ""} ${res.message ?? ""}`);
    console.log("  ✓ Domaine ajouté dans Brevo.");
    domain = await getSendingDomain(SENDING_DOMAIN);
    if (!domain) throw new Error("Domaine introuvable après ajout");
  }

  console.log(`  Brevo : ${domain.authenticated ? "✓ AUTHENTIFIÉ" : "✗ non authentifié"} · ${domain.verified ? "vérifié" : "non vérifié"}\n`);
  const records = Object.values(domain.dns_records).filter((r): r is DnsRecord => !!r);
  let allPublished = true;
  for (const rec of records) {
    const { published, note } = await checkRecord(rec);
    allPublished &&= published;
    console.log(`  ${published ? "✓" : "✗"} ${rec.type.padEnd(5)} ${rec.host_name.padEnd(18)} ${rec.value}`);
    console.log(`        Brevo ${rec.status ? "OK" : "pas encore vu"} · DNS public ${published ? "OK" : note}`);
  }

  if (!domain.authenticated) {
    if (!allPublished) {
      console.log("\n  Enregistrements manquants : les créer chez l'hébergeur DNS (Cloudflare, « DNS only »), puis relancer.\n");
      return;
    }
    if (!APPLY) {
      console.log("\n  Les 4 enregistrements sont publiés. --apply demande l'authentification à Brevo.\n");
      return;
    }
    const res = await brevoRequest(`/senders/domains/${SENDING_DOMAIN}/authenticate`, { method: "PUT", retries: 0 });
    console.log(res.ok ? "\n  ✓ Authentification demandée." : `\n  ✗ Authentification refusée : ${res.status} ${res.message ?? ""}`);
    domain = (await getSendingDomain(SENDING_DOMAIN)) ?? domain;
    console.log(`  Brevo : ${domain.authenticated ? "✓ AUTHENTIFIÉ" : "✗ non authentifié (propagation DNS : relancer plus tard)"}`);
  }

  console.log(`\n  Expéditeurs (réponses : ${REPLY_TO}, réglées dans chaque campagne / template)`);
  let senders = await listSenders();
  const exists = (email: string) => senders.some((x) => x.email.toLowerCase() === email);
  for (const s of Object.values(SENDERS)) {
    if (!exists(s.email) && APPLY && domain.authenticated) {
      const res = await brevoRequest<{ id: number }>("/senders", { method: "POST", body: s, retries: 0 });
      if (!res.ok) console.log(`  ✗ ${s.email} : création refusée ${res.status} ${res.message ?? ""}`);
      senders = await listSenders();
    }
    const active = findActiveSender(senders, s.email);
    const state = active
      ? `✓ actif (id ${active.id})`
      : exists(s.email)
        ? "✗ présent mais inactif (validation Brevo en attente)"
        : domain.authenticated
          ? "✗ absent (--apply le crée)"
          : "✗ absent (créé après authentification du domaine)";
    console.log(`  ${s.name} <${s.email}> ${state}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
