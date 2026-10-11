/**
 * Rapport multi-guides EN LECTURE SEULE. Aucune inscription, aucun email,
 * aucune modification de liste ou d'attribut.
 *
 * npx tsx --tsconfig tsconfig.json scripts/brevo/report-multi-guides.ts
 * Ajouter --json=/chemin/prive/rapport.json pour enregistrer les IDs et guides.
 * Sans cette option : seulement des effectifs agrégés, pas de données contacts.
 */
import { writeFile } from "node:fs/promises";
import { getApiKey, brevoRequest, type BrevoContact } from "@/lib/brevo/api";
import { summarizeGuideInterests } from "@/lib/guides/interests";
import { mayReceiveMarketing } from "@/lib/marketing/status";

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absent : configurez-le dans l'environnement sécurisé.");
  const args = process.argv.slice(2);
  if (args.some((arg) => !arg.startsWith("--json=")) || args.length > 1) throw new Error("Option autorisée : --json=/chemin/prive/rapport.json");
  const target = args[0]?.slice("--json=".length);
  if (args.length && !target) throw new Error("Chemin JSON vide.");
  const contacts = new Map<number, BrevoContact>();
  let complete = false;
  for (let page = 0; page < 100; page++) {
    const res = await brevoRequest<{ contacts?: BrevoContact[] }>(`/contacts?limit=500&offset=${page * 500}&sort=asc`, { method: "GET", retries: 2 });
    if (!res.ok) throw new Error(`Lecture des contacts interrompue (HTTP ${res.status}), aucun rapport partiel publié.`);
    const rows = res.data?.contacts;
    if (!Array.isArray(rows)) throw new Error("Réponse contacts invalide.");
    for (const c of rows) contacts.set(c.id, c);
    if (rows.length < 500) { complete = true; break; }
  }
  if (!complete) throw new Error("Limite de pagination atteinte ; rapport non considéré comme complet.");
  const rows = [...contacts.values()].map((contact) => {
    const summary = summarizeGuideInterests(contact);
    return {
      contactId: contact.id,
      distinctGuideCount: summary.distinctCount,
      guides: summary.guides.map(({ slug, title, evidence }) => ({ slug, title, evidence })),
      interestSectors: summary.sectors,
      latestSlug: summary.latestSlug ?? null,
      requestDatesKnown: false,
      marketingEligible: mayReceiveMarketing(contact),
      lifecycleStage: String(contact.attributes.LIFECYCLE_STAGE ?? ""),
      leadScore: Number(contact.attributes.LEAD_SCORE) || 0,
      contactUrl: `https://app.brevo.com/contact/index/${contact.id}`,
    };
  }).filter((r) => r.distinctGuideCount >= 2)
    .sort((a, b) => b.leadScore - a.leadScore || b.distinctGuideCount - a.distinctGuideCount || a.contactId - b.contactId);
  const counts = {
    contactsRead: contacts.size, contactsWithMultipleGuides: rows.length,
    withTwoGuides: rows.filter((r) => r.distinctGuideCount === 2).length,
    withThreeOrMore: rows.filter((r) => r.distinctGuideCount >= 3).length,
    marketingEligible: rows.filter((r) => r.marketingEligible).length,
  };
  console.log(JSON.stringify({ mode: "READ_ONLY", ...counts }, null, 2));
  if (target) {
    await writeFile(target, JSON.stringify({ generatedAt: new Date().toISOString(), counts, note: "Appartenances aux listes et dernière ressource uniquement ; dates historiques inconnues. Aucun statut de lecture déduit.", rows }, null, 2), { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log("Rapport privé créé. Ne pas le publier ni le commiter.");
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Échec du rapport multi-guides.");
  process.exitCode = 1;
});
