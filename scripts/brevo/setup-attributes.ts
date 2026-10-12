/**
 * Vérifie les attributs Brevo et crée UNIQUEMENT ceux qui manquent.
 * Ne modifie, ne renomme et ne supprime jamais un attribut existant.
 *
 *   npm run brevo:attributes            → DRY RUN (affiche le plan)
 *   npm run brevo:attributes -- --apply → crée les attributs manquants
 */

import { brevoRequest, getApiKey, listAttributes } from "@/lib/brevo/api";
import { EXISTING_ATTRIBUTES, NEW_ATTRIBUTES } from "@/config/brevoAttributes";

const CRM_NAMES = new Set(["INTENT_UPDATED_AT", "LAST_QUALIFYING_ACTIVITY_AT", "LAST_QUALIFYING_ACTIVITY_TYPE", "IS_QA",
  "CRM_CONTACT_ID", "CRM_SALES_STATUS", "CRM_SALES_UPDATED_AT", "CRM_SALES_VERSION", "CRM_SALES_EVENT_ID",
  "CRM_DO_NOT_CALL", "CRM_EMAIL_OPPOSED", "CRM_GLOBAL_OPPOSED"]);
const definitions = process.argv.includes("--crm-only") ? NEW_ATTRIBUTES.filter((a) => CRM_NAMES.has(a.name)) : NEW_ATTRIBUTES;
const APPLY = process.argv.includes("--apply");

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  const attrs = await listAttributes();
  const byName = new Map(attrs.map((a) => [a.name.toUpperCase(), a]));

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — attributs Brevo\n`);
  console.log("Attributs existants réutilisés :");
  for (const name of EXISTING_ATTRIBUTES) {
    const a = byName.get(name);
    console.log(`  ${a ? "✓" : "✗ ABSENT"} ${name}${a ? ` (${a.type ?? a.category})` : ""}`);
  }

  console.log("\nNouveaux attributs :");
  const missing = [];
  const incompatible: string[] = [];
  for (const def of definitions) {
    const a = byName.get(def.name);
    if (a) {
      const typeOk = (a.type ?? "") === def.type;
      if (!typeOk) incompatible.push(def.name);
      console.log(`  = ${def.name} existe déjà (${a.type})${typeOk ? "" : ` ⚠ type attendu ${def.type}`}`);
    } else {
      missing.push(def);
      console.log(`  + ${def.name} (${def.type}) — ${def.description}`);
    }
  }

  // Garde-fou anti-doublons : signaler les équivalents anglais déjà présents
  for (const dup of ["FIRSTNAME", "LASTNAME", "COMPANY", "PHONE"]) {
    if (byName.has(dup)) console.log(`  ⚠ ${dup} existe : ne pas l'utiliser (doublon de l'attribut FR)`);
  }

  if (incompatible.length) throw new Error(`Types incompatibles, aucune écriture : ${incompatible.join(", ")}`);
  if (!missing.length) return console.log("\nRien à créer.");
  if (!APPLY) return console.log(`\n${missing.length} attribut(s) à créer. Relancer avec --apply.`);

  for (const def of missing) {
    const res = await brevoRequest(`/contacts/attributes/normal/${def.name}`, {
      method: "POST",
      body: { type: def.type },
    });
    if (res.ok) console.log(`  ✓ ${def.name} créé`);
    else if (res.code === "duplicate_parameter") console.log(`  = ${def.name} existe déjà`);
    else {
      console.error(`  ✗ ${def.name} : ${res.status} ${res.code ?? ""} ${res.message ?? ""}`);
      process.exitCode = 1;
    }
  }
  const after = new Map((await listAttributes()).map((a) => [a.name.toUpperCase(), a]));
  const failed = definitions.filter((d) => after.get(d.name)?.type !== d.type);
  if (failed.length) throw new Error(`Relecture du schéma non conforme : ${failed.map((a) => a.name).join(", ")}`);
  console.log("Schéma relu et types confirmés.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
