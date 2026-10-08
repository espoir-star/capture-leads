/**
 * Vérifie les attributs Brevo et crée UNIQUEMENT ceux qui manquent.
 * Ne modifie, ne renomme et ne supprime jamais un attribut existant.
 *
 *   npm run brevo:attributes            → DRY RUN (affiche le plan)
 *   npm run brevo:attributes -- --apply → crée les attributs manquants
 */

import { brevoRequest, getApiKey, listAttributes } from "@/lib/brevo/api";
import { EXISTING_ATTRIBUTES, NEW_ATTRIBUTES } from "@/config/brevoAttributes";

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
  for (const def of NEW_ATTRIBUTES) {
    const a = byName.get(def.name);
    if (a) {
      const typeOk = (a.type ?? "") === def.type;
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
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
