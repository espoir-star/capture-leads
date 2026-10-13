/** Configuration additive du dixième guide. Aucun contact, email ou flag modifié.
 * Sans option : lecture seule. --apply : crée seulement la liste et ses 3 champs.
 * Exécuter une seule instance à la fois (Brevo ne fournit pas de clé d'idempotence
 * pour la création de liste). Après une erreur réseau, relire avant toute reprise.
 */
import { pathToFileURL } from "node:url";
import { brevoRequest, listAttributes, type BrevoAttributeDef } from "@/lib/brevo/api";

const FOLDER = "Lead Magnets";
export const DASHBOARD_LIST_NAME = "LM - Claude Dashboards cabinets";
type Named = { id: number; name: string; folderId?: number };

export function dashboardAttributePlan(current: BrevoAttributeDef[], listId: number) {
  if (!Number.isSafeInteger(listId) || listId <= 0) throw new Error("ID de liste invalide");
  return ["MG_REQ", "MG_SENT", "MG_ENROLLED"].map((prefix) => {
    const name = `${prefix}_${listId}`;
    const old = current.find((a) => a.name === name);
    if (old && (old.category !== "normal" || old.type !== "text")) {
      throw new Error(`Type incompatible pour ${name} : aucune conversion autorisée`);
    }
    return { name, type: "text" as const, create: !old };
  });
}

async function all(kind: "folders" | "lists"): Promise<Named[]> {
  const found: Named[] = [];
  for (let offset = 0; ; offset += 50) {
    const res = await brevoRequest<Partial<Record<typeof kind, Named[]>>>(`/contacts/${kind}?limit=50&offset=${offset}&sort=asc`);
    if (!res.ok || !Array.isArray(res.data?.[kind])) throw new Error(`Lecture ${kind} refusée (${res.status})`);
    const page = res.data![kind]!;
    found.push(...page);
    if (page.length < 50) return found;
  }
}

function unique(items: Named[], name: string): Named | undefined {
  const matches = items.filter((x) => x.name.trim().toLowerCase() === name.toLowerCase());
  if (matches.length > 1) throw new Error(`Plusieurs objets nommés « ${name} » : arrêt sans modification`);
  return matches[0];
}

async function verifiedList(id: number, folderId: number): Promise<Named> {
  const res = await brevoRequest<Named>(`/contacts/lists/${id}`);
  if (!res.ok || res.data?.name !== DASHBOARD_LIST_NAME || res.data.folderId !== folderId || res.data.id !== id) {
    throw new Error("Liste absente ou nom/dossier incompatible : arrêt sans déplacer ni renommer");
  }
  return { id, name: res.data.name, folderId };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((a) => a !== "--apply")) throw new Error("Seule option autorisée : --apply");
  const apply = args.includes("--apply");
  const folder = unique(await all("folders"), FOLDER);
  if (!folder) throw new Error("Dossier Lead Magnets introuvable : aucun dossier créé");
  let list = unique(await all("lists"), DASHBOARD_LIST_NAME);
  if (list) list = await verifiedList(list.id, folder.id);
  const current = await listAttributes();
  const plan = list ? dashboardAttributePlan(current, list.id) : null;
  if (current.length + (plan?.filter((a) => a.create).length ?? 3) > 200) {
    throw new Error("Capacité d'attributs insuffisante : aucune liste ni attribut créé");
  }
  console.log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", folder: { id: folder.id, name: folder.name },
    list: list ?? { name: DASHBOARD_LIST_NAME, create: true, id: "attribué par Brevo à la création" },
    attributes: plan ?? ["MG_REQ_<ID_RÉEL>", "MG_SENT_<ID_RÉEL>", "MG_ENROLLED_<ID_RÉEL>"],
    contactsModified: 0, emailsSent: 0 }, null, 2));
  if (!apply) return;
  if (!list) {
    // Une nouvelle lecture réduit le risque de doublon entre aperçu et application.
    list = unique(await all("lists"), DASHBOARD_LIST_NAME);
    if (!list) {
      const created = await brevoRequest<{ id: number }>("/contacts/lists", {
        method: "POST", body: { name: DASHBOARD_LIST_NAME, folderId: folder.id }, retries: 0,
      });
      if (!created.ok || !created.data?.id) throw new Error(`Création liste non confirmée (${created.status}). Relancer le dry-run, pas un POST aveugle.`);
      list = { id: created.data.id, name: DASHBOARD_LIST_NAME };
    }
  }
  list = await verifiedList(list.id, folder.id);
  for (const attr of dashboardAttributePlan(await listAttributes(), list.id)) {
    if (!attr.create) continue;
    const res = await brevoRequest(`/contacts/attributes/normal/${attr.name}`, {
      method: "POST", body: { type: "text" }, retries: 0,
    });
    if (!res.ok && dashboardAttributePlan(await listAttributes(), list.id).find((a) => a.name === attr.name)?.create) {
      throw new Error(`Création ${attr.name} non confirmée (${res.status})`);
    }
  }
  const verified = dashboardAttributePlan(await listAttributes(), list.id);
  if (verified.some((a) => a.create)) throw new Error("Relecture incomplète : ne pas activer le guide");
  await verifiedList(list.id, folder.id);
  console.log(JSON.stringify({ verified: true, list, attributes: verified.map(({ name, type }) => ({ name, type })) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Configuration non confirmée");
    console.error("Relancer le dry-run avant toute reprise. Aucun contact ni email modifié.");
    process.exitCode = 1;
  });
}
