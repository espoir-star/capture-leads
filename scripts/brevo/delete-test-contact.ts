/**
 * Supprime EXCLUSIVEMENT le contact de QA « qa-capture-test@example.com ».
 * Aucune suppression générique ni par motif : email exact + empreinte vérifiée.
 *
 *   npm run brevo:delete-test-contact            → DRY RUN (affiche le contact)
 *   npm run brevo:delete-test-contact -- --apply → suppression définitive
 */

import { brevoRequest, getApiKey, getContactByEmail } from "@/lib/brevo/api";

const EMAIL = "qa-capture-test@example.com";
const APPLY = process.argv.includes("--apply");

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  const c = await getContactByEmail(EMAIL);
  if (!c) return console.log(`\n${EMAIL} n'existe pas (déjà supprimé ?). Rien à faire.\n`);

  const checks: [string, boolean][] = [
    ["email exact", c.email.toLowerCase() === EMAIL],
    ["PRENOM = Test", c.attributes.PRENOM === "Test"],
    ["NOM = QA Althoce", c.attributes.NOM === "QA Althoce"],
    ["dans aucune liste", c.listIds.length === 0],
  ];
  console.log(`\n${APPLY ? "SUPPRESSION" : "DRY RUN"} — contact #${c.id} ${c.email}`);
  for (const [label, ok] of checks) console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (checks.some(([, ok]) => !ok)) throw new Error("Empreinte non conforme : suppression refusée.");
  if (!APPLY) return console.log("\nDRY RUN : rien n'a été supprimé. Ajouter --apply pour supprimer CE contact.\n");

  const res = await brevoRequest(`/contacts/${c.id}?identifierType=contact_id`, { method: "DELETE", retries: 0 });
  console.log(res.ok ? `\n✓ Contact #${c.id} supprimé.\n` : `\n✗ ${res.status} ${res.code ?? ""}\n`);
  if (!res.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
