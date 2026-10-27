/**
 * Synchronise la liste Brevo d'une audience « liste » (config/newsletter.ts) :
 *
 *   npm run newsletter:list -- annonce            → simulation (compte, diff)
 *   npm run newsletter:list -- annonce --apply    → crée la liste si besoin, ajoute / retire
 *
 * La liste contient exactement les contacts autorisés au marketing, hors
 * recette (lib/newsletter/audienceList.ts). Relancer juste avant l'envoi
 * retire les contacts devenus opposés entre-temps. N'envoie aucun email.
 */
import { brevoRequest, getApiKey, iterateContacts, type BrevoContact } from "@/lib/brevo/api";
import { listLists, resolveListId } from "@/lib/brevo/lists";
import { AUDIENCES } from "@/config/newsletter";
import { isAnnouncementRecipient, listDiff } from "@/lib/newsletter/audienceList";

const argv = process.argv.slice(2);
const key = argv.find((a) => !a.startsWith("--"));
const APPLY = argv.includes("--apply");
const CHUNK = 150; // limite Brevo par appel d'ajout / retrait

async function main() {
  const audience = key ? AUDIENCES[key] : undefined;
  if (!audience?.list) throw new Error(`Usage : npm run newsletter:list -- <audience à liste> [--apply] (${Object.keys(AUDIENCES).filter((k) => AUDIENCES[k].list).join(", ")})`);
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente");
  if (APPLY && process.env.MARKETING_SEGMENTS_REVIEWED !== "true") throw new Error("Refusé : MARKETING_SEGMENTS_REVIEWED=true requis");

  const ref = audience.list;
  const lists = await listLists();
  let listId = resolveListId(ref, lists);
  const contacts: BrevoContact[] = [];
  for await (const c of iterateContacts()) contacts.push(c);
  const { add, remove } = listDiff(contacts, listId);
  const recipients = contacts.filter(isAnnouncementRecipient);
  const byVertical: Record<string, number> = {};
  for (const c of recipients) {
    const v = String(c.attributes?.VERTICAL ?? "(non renseigné)");
    byVertical[v] = (byVertical[v] ?? 0) + 1;
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — liste « ${ref.name} » ${listId ? `(#${listId})` : "(à créer)"}`);
  console.log(`  Règle         ${ref.rule}`);
  console.log(`  Contacts      ${contacts.length} dans Brevo · ${recipients.length} destinataires`);
  console.log(`  Par secteur   ${Object.entries(byVertical).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(" · ")}`);
  console.log(`  Diff          +${add.length} à ajouter · -${remove.length} à retirer`);
  if (!APPLY) { console.log("\nRien n'a été écrit. Relancer avec --apply.\n"); return; }

  if (!listId) {
    const folderId = lists.find((l) => l.folderId)?.folderId;
    if (!folderId) throw new Error("Aucun dossier de listes trouvé dans Brevo");
    const created = await brevoRequest<{ id: number }>("/contacts/lists", { method: "POST", body: { name: ref.name, folderId }, retries: 0 });
    if (!created.ok || !created.data?.id) throw new Error(`Création de la liste refusée : ${created.status} ${created.message ?? ""}`);
    listId = created.data.id;
    console.log(`  ✓ liste créée (#${listId})`);
  }
  for (const [ids, verb] of [[add, "add"], [remove, "remove"]] as const) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const res = await brevoRequest(`/contacts/lists/${listId}/contacts/${verb}`, { method: "POST", body: { ids: ids.slice(i, i + CHUNK) } });
      if (!res.ok) throw new Error(`${verb === "add" ? "Ajout" : "Retrait"} refusé (lot ${i / CHUNK + 1}) : ${res.status} ${res.message ?? ""}`);
    }
  }
  const after = await brevoRequest<{ uniqueSubscribers?: number; totalSubscribers?: number }>(`/contacts/lists/${listId}`);
  console.log(`  ✓ liste #${listId} : ${after.data?.uniqueSubscribers ?? after.data?.totalSubscribers ?? "?"} contacts (attendu ${recipients.length})\n`);
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
