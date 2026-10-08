/**
 * Segments Brevo attendus : présents ? ID réel ? (lecture seule)
 *
 *   npm run brevo:segments
 *
 * L'API Brevo ne permet pas de créer des segments : les créer à la main
 * (docs/BREVO_SETUP.md § 5), relancer ce script, recopier les IDs affichés
 * dans config/newsletter.ts.
 */

import { getApiKey } from "@/lib/brevo/api";
import { listSegments, resolveSegmentId } from "@/lib/brevo/segments";
import { SEGMENTS } from "@/config/newsletter";

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  const segments = await listSegments();
  console.log(`\nSegments présents dans Brevo : ${segments.length}\n`);
  let missing = 0;
  for (const [key, ref] of Object.entries(SEGMENTS)) {
    const id = resolveSegmentId(ref, segments);
    if (!id) missing++;
    console.log(`  ${id ? "✓" : "✗"} ${ref.name.padEnd(34)} ${id ? `id ${id}` : "À CRÉER"}${ref.id ? "" : id ? `  → config/newsletter.ts : SEGMENTS.${key}.id = ${id}` : ""}`);
    if (!id) console.log(`      conditions : ${ref.conditions}`);
  }
  console.log(missing ? `\n${missing} segment(s) à créer dans Brevo → Contacts → Segments.\n` : "\nTous les segments existent.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
