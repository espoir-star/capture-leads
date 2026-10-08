/**
 * Supprime EXCLUSIVEMENT les contacts de QA créés pendant la recette du
 * 08/10/2026. Aucune suppression générique ni par motif : chaque contact est
 * identifié par son email exact et son empreinte (prénom, nom, listes, date
 * de création) ; au moindre écart, il est ignoré.
 *
 *   npm run brevo:delete-test-contact            → DRY RUN (affiche ce qui serait supprimé)
 *   npm run brevo:delete-test-contact -- --apply → suppression définitive des contacts conformes
 */

import { brevoRequest, getApiKey, getContactByEmail } from "@/lib/brevo/api";

interface QaContact {
  email: string;
  prenom: string;
  nom: string;
  /** listes autorisées (le contact ne doit appartenir à aucune autre) */
  lists: number[];
}

const QA_CONTACTS: QaContact[] = [
  { email: "qa-capture-test@example.com", prenom: "Test", nom: "QA Althoce", lists: [] },
  { email: "echelleprod+qa-althoce-1@gmail.com", prenom: "QA", nom: "Test QA ne pas appeler", lists: [10] },
  { email: "echelleprod+qa-althoce-2@gmail.com", prenom: "QA", nom: "Test QA ne pas appeler", lists: [10] },
];

/** Créés pendant la recette : rien d'antérieur ne peut correspondre */
const CREATED_FROM = Date.parse("2026-10-08T00:00:00+02:00");

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  console.log(`\n${APPLY ? "SUPPRESSION" : "DRY RUN"} — contacts de QA\n`);

  for (const qa of QA_CONTACTS) {
    const c = await getContactByEmail(qa.email);
    if (!c) {
      console.log(`  · ${qa.email} : absent (déjà supprimé ?)`);
      continue;
    }
    const checks: [string, boolean][] = [
      ["email exact", c.email.toLowerCase() === qa.email],
      [`PRENOM = ${qa.prenom}`, c.attributes.PRENOM === qa.prenom],
      [`NOM = ${qa.nom}`, c.attributes.NOM === qa.nom],
      [`listes ⊆ [${qa.lists.join(", ")}]`, c.listIds.every((l) => qa.lists.includes(l))],
      ["créé le 08/10/2026 ou après", !!c.createdAt && Date.parse(c.createdAt) >= CREATED_FROM],
    ];
    const ok = checks.every(([, v]) => v);
    console.log(`  ${ok ? "✓" : "✗"} #${c.id} ${c.email}`);
    for (const [label, v] of checks) if (!v) console.log(`      ✗ ${label}`);
    if (!ok || !APPLY) continue;

    const res = await brevoRequest(`/contacts/${c.id}?identifierType=contact_id`, { method: "DELETE", retries: 0 });
    console.log(res.ok ? `      supprimé` : `      ✗ échec ${res.status} ${res.code ?? ""}`);
    if (!res.ok) process.exitCode = 1;
  }
  if (!APPLY) console.log("\nDRY RUN : rien n'a été supprimé. Ajouter --apply pour supprimer les contacts ✓.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
