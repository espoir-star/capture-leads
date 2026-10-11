/** Préparer/créer UNIQUEMENT les attributs multi-guides ; aucune donnée contact ni aucun email. */
import { MULTI_GUIDE_ATTRIBUTES } from "@/config/multiGuides";
import { brevoRequest, listAttributes } from "@/lib/brevo/api";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== "--apply") || args.length > 1) throw new Error("Seule option autorisée : --apply");
  const apply = args.includes("--apply");
  const current = await listAttributes();
  const names = new Set<string>();
  const missing = [];
  for (const attr of MULTI_GUIDE_ATTRIBUTES) {
    if (names.has(attr.name) || !/^[A-Z][A-Z0-9_]{0,49}$/.test(attr.name)) throw new Error("Définition d'attribut multi-guides invalide");
    names.add(attr.name);
    const old = current.find((v) => v.name === attr.name);
    if (old && (old.category !== "normal" || old.type !== attr.type)) throw new Error(`Type incompatible pour ${attr.name} : arrêt sans modifier l'existant`);
    if (!old) missing.push(attr);
  }
  if (current.filter((a) => a.category === "normal").length + missing.length > 200) throw new Error("Capacité d'attributs insuffisante : ne pas activer le suivi");
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", missing: missing.map(({ name, type }) => ({ name, type })) }, null, 2));
  if (!apply) return;
  for (const attr of missing) {
    const res = await brevoRequest(`/contacts/attributes/normal/${attr.name}`, { method: "POST", body: { type: attr.type }, retries: 0 });
    if (!res.ok) {
      // Tolère uniquement une création concurrente prouvée par relecture du type exact.
      const found = (await listAttributes()).find((x) => x.name === attr.name && x.category === "normal" && x.type === attr.type);
      if (!found) throw new Error(`Création ${attr.name} refusée (HTTP ${res.status})`);
    }
  }
  console.log("Attributs vérifiés. Le feature flag reste inchangé : aucun contact ni envoi modifié.");
}
main().catch((e: unknown) => { console.error(e instanceof Error ? e.message : "Échec du paramétrage"); process.exitCode = 1; });
