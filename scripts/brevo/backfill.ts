/**
 * Backfill des contacts Brevo existants. Règles : lib/backfill/plan.ts
 * (uniquement ce qui est prouvé par les données : provenance + preuves négatives).
 *
 *   npm run brevo:backfill                         → DRY RUN : rapport, aucune écriture
 *   npm run brevo:backfill -- --apply              → applique le plan (attributs VIDES uniquement)
 *   npm run brevo:backfill -- --no-dns             → sans vérification de réception (plus rapide)
 *   npm run brevo:backfill -- --with-commercial-mapping
 *                                                  → + proposition STATUT_APPEL/ETAPE_COMMERCIALE
 *                                                    → LIFECYCLE_STAGE (à valider avant !)
 *
 * Jamais écrits : EMAIL_STATUS VERIFIED/PENDING, PHONE_STATUS VALID_FORMAT/VERIFIED,
 * OPT_IN, LEAD_SCORE, UTM. Aucune liste ni contact supprimé.
 * Avant --apply, un instantané des valeurs précédentes est écrit dans backfill-reports/.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brevoRequest, getApiKey, iterateContacts, type BrevoContact } from "@/lib/brevo/api";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { planContactBackfill } from "@/lib/backfill/plan";
import { checkDomainDns, type DnsVerdict } from "@/lib/data-quality/email";
import { emailDomain } from "@/lib/validation/email";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const WITH_DNS = !args.has("--no-dns");
const WITH_COMMERCIAL = args.has("--with-commercial-mapping");

type Plan = { email: string; id: number; set: Record<string, string>; before: Record<string, unknown> };

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

async function fetchHardBounces(): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; offset < 50_000; offset += 100) {
    const res = await brevoRequest<{ contacts?: { email: string; reason?: { code?: string } }[] }>(
      `/smtp/blockedContacts?limit=100&offset=${offset}`,
      { retries: 2 }
    );
    if (!res.ok) {
      console.warn(`  (blocklist transactionnelle illisible : ${res.status} — bounces non détectés)`);
      break;
    }
    const rows = res.data?.contacts ?? [];
    for (const r of rows) if (r.reason?.code === "hardBounce") out.add(r.email.toLowerCase());
    if (rows.length < 100) break;
  }
  return out;
}

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  console.log(`\n═══ BACKFILL BREVO — ${APPLY ? "APPLY" : "DRY RUN"} ═══\n`);

  const contacts: BrevoContact[] = [];
  for await (const c of iterateContacts()) contacts.push(c);
  console.log(`Contacts lus : ${contacts.length}`);

  const bounced = await fetchHardBounces();
  console.log(`Hard bounces (blocklist transactionnelle) : ${bounced.size}`);

  /* DNS : un appel par domaine distinct */
  const dnsVerdict = new Map<string, DnsVerdict>();
  if (WITH_DNS) {
    const domains = [...new Set(contacts.map((c) => emailDomain((c.email ?? "").toLowerCase())).filter(Boolean))];
    process.stdout.write(`Vérification MX de ${domains.length} domaines… `);
    await mapLimit(domains, 8, async (d) => {
      dnsVerdict.set(d, await checkDomainDns(d));
    });
    console.log("ok");
  }

  const plans: Plan[] = [];
  const stats = {
    attr: new Map<string, number>(),
    vertical: new Map<string, number>(),
    subsector: new Map<string, number>(),
    emailStatus: new Map<string, number>(),
    phoneStatus: new Map<string, number>(),
    lifecycle: new Map<string, number>(),
    conflicts: [] as string[],
    commercial: new Map<string, number>(),
    ambiguousLists: new Map<string, number>(),
  };

  for (const c of contacts) {
    const plan = planContactBackfill(c, {
      hardBounces: bounced,
      dnsVerdict,
      withCommercialMapping: WITH_COMMERCIAL,
    });
    const { set } = plan;
    for (const name of plan.ambiguousLists) count(stats.ambiguousLists, name);
    for (const conflict of plan.conflicts) stats.conflicts.push(`${c.email} : ${conflict}`);
    if (plan.commercial) {
      const label =
        plan.commercial.proposal ??
        (plan.commercial.key === "À appeler" ? "LEAD (pas encore appelé)" : "(ambigu : inchangé)");
      count(stats.commercial, `${plan.commercial.key} → ${label}`);
    }
    if (!c.email) count(stats.attr, "(contact sans email)");

    for (const k of Object.keys(set)) count(stats.attr, k);
    if (set.VERTICAL) count(stats.vertical, set.VERTICAL);
    if (set.SUBSECTOR) count(stats.subsector, set.SUBSECTOR);
    if (set.EMAIL_STATUS) count(stats.emailStatus, set.EMAIL_STATUS);
    if (set.PHONE_STATUS) count(stats.phoneStatus, set.PHONE_STATUS);
    if (set.LIFECYCLE_STAGE) count(stats.lifecycle, set.LIFECYCLE_STAGE);

    if (Object.keys(set).length) {
      const before = Object.fromEntries(Object.keys(set).map((k) => [k, c.attributes?.[k] ?? null]));
      plans.push({ email: c.email ?? "", id: c.id, set, before });
    }
  }

  /* ── Rapport ── */
  const show = (title: string, m: Map<string, number>) => {
    console.log(`\n${title}`);
    if (!m.size) return console.log("  (aucun)");
    for (const [k, v] of [...m].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`);
  };

  console.log("\nMapping listes → verticales (config/leadMagnets.ts)");
  for (const lm of Object.values(LEAD_MAGNETS)) {
    console.log(
      `  liste ${String(lm.brevoListId).padStart(2)}  ${lm.brevoListName.padEnd(42)} → ${lm.vertical ?? "— (ambigu, non modifié)"}${lm.subsector ? ` / ${lm.subsector}` : ""}`
    );
  }
  show("Attributs ajoutés (nombre de contacts)", stats.attr);
  show("VERTICAL", stats.vertical);
  show("SUBSECTOR", stats.subsector);
  show("LIFECYCLE_STAGE", stats.lifecycle);
  show("EMAIL_STATUS", stats.emailStatus);
  show("PHONE_STATUS", stats.phoneStatus);
  show("Contacts dans une liste ambiguë (verticale non déduite par cette liste)", stats.ambiguousLists);
  show(
    `Proposition commerciale → LIFECYCLE_STAGE (${WITH_COMMERCIAL ? "APPLIQUÉE" : "NON appliquée, --with-commercial-mapping"})`,
    stats.commercial
  );
  console.log(`\nConflits (non modifiés) : ${stats.conflicts.length}`);
  for (const line of stats.conflicts.slice(0, 15)) console.log(`  - ${line}`);
  if (stats.conflicts.length > 15) console.log(`  … ${stats.conflicts.length - 15} de plus dans le fichier de plan`);

  console.log(`\nContacts modifiés : ${plans.length} / ${contacts.length}`);
  console.log("Garanties : seuls des attributs vides sont remplis (hors EMAIL_STATUS → BOUNCED constaté par");
  console.log("Brevo) ; aucun statut positif inventé (ni VERIFIED, ni PENDING, ni VALID_FORMAT), ni OPT_IN,");
  console.log("ni score, ni UTM ; aucune liste ni contact supprimé. EMAIL_STATUS = INVALID = domaine inexistant");
  console.log("ou sans serveur de réception au moment du contrôle : relire la liste avant --apply.");

  const dir = resolve(process.cwd(), "backfill-reports");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = resolve(dir, `${APPLY ? "applied" : "plan"}-${stamp}.json`);
  writeFileSync(file, JSON.stringify({ apply: APPLY, withCommercial: WITH_COMMERCIAL, conflicts: stats.conflicts, plans }, null, 1));
  console.log(`\nPlan détaillé (avec valeurs précédentes, pour retour arrière) : ${file}`);

  if (!APPLY) return console.log("\nDRY RUN : aucune écriture. Relancer avec --apply pour appliquer.\n");

  /* ── Application par lots de 100 (POST /contacts/batch) ── */
  let done = 0;
  for (let i = 0; i < plans.length; i += 100) {
    const chunk = plans.slice(i, i + 100);
    const res = await brevoRequest("/contacts/batch", {
      method: "POST",
      body: { contacts: chunk.map((p) => ({ id: p.id, attributes: p.set })) },
      retries: 3,
    });
    if (!res.ok) {
      console.error(`Lot ${i / 100 + 1} en échec : ${res.status} ${res.code ?? ""} ${res.message ?? ""}`);
      process.exitCode = 1;
      break;
    }
    done += chunk.length;
    process.stdout.write(`\r  ${done}/${plans.length} contacts mis à jour`);
  }
  console.log("\nTerminé.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
