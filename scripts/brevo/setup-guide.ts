/** Configuration additive réutilisable pour un guide. Aucun contact, email ou flag modifié.
 * Sans option : lecture seule. --apply : crée seulement la liste et ses 3 champs.
 * Exécuter une seule instance à la fois (Brevo ne fournit pas de clé d'idempotence
 * pour la création de liste). Après une erreur réseau, relire avant toute reprise.
 */
import { pathToFileURL } from "node:url";
import { brevoRequest, type BrevoAttributeDef } from "@/lib/brevo/api";

const FOLDER = "Lead Magnets";
export interface GuideSetupOptions { name: string; apply: boolean }

export function parseGuideSetupArgs(args: string[]): GuideSetupOptions {
  let name: string | undefined;
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--apply" && !apply) apply = true;
    else if (arg === "--name" && name === undefined && args[i + 1] && !args[i + 1].startsWith("--")) name = args[++i].trim();
    else throw new Error("Usage : --name \"LM - Titre du guide\" [--apply]");
  }
  if (!name || !/^LM - \S/.test(name) || name.length > 120 || /[\r\n\x00-\x1f]/.test(name)) {
    throw new Error("Nom requis : LM - Titre du guide (120 caractères maximum)");
  }
  return { name, apply };
}
type Named = { id: number; name: string; folderId?: number };

export function guideAttributePlan(current: BrevoAttributeDef[], listId: number) {
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

export async function setupGuide(
  options: GuideSetupOptions,
  request: typeof brevoRequest = brevoRequest,
  log: (value: string) => void = console.log,
): Promise<void> {
  const { name, apply } = parseGuideSetupArgs(["--name", options.name, ...(options.apply ? ["--apply"] : [])]);
  const listAttributes = async () => {
    const res = await request<{ attributes: BrevoAttributeDef[] }>("/contacts/attributes");
    if (!res.ok || !Array.isArray(res.data?.attributes)) throw new Error(`Lecture attributs impossible (${res.status})`);
    return res.data.attributes;
  };
  async function all(kind: "folders" | "lists"): Promise<Named[]> {
    const found: Named[] = [];
    for (let offset = 0; ; offset += 50) {
      const res = await request<Partial<Record<typeof kind, Named[]>>>(`/contacts/${kind}?limit=50&offset=${offset}&sort=asc`);
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
    const res = await request<Named>(`/contacts/lists/${id}`);
    if (!res.ok || res.data?.name !== name || res.data.folderId !== folderId || res.data.id !== id) {
      throw new Error("Liste absente ou nom/dossier incompatible : arrêt sans déplacer ni renommer");
    }
    return { id, name: res.data.name, folderId };
  }

  const folder = unique(await all("folders"), FOLDER);
  if (!folder) throw new Error("Dossier Lead Magnets introuvable : aucun dossier créé");
  let list = unique(await all("lists"), name);
  if (list) list = await verifiedList(list.id, folder.id);
  const current = await listAttributes();
  const plan = list ? guideAttributePlan(current, list.id) : null;
  if (current.length + (plan?.filter((a) => a.create).length ?? 3) > 200) {
    throw new Error("Capacité d'attributs insuffisante : aucune liste ni attribut créé");
  }
  log(JSON.stringify({ mode: apply ? "APPLY" : "DRY_RUN", folder: { id: folder.id, name: folder.name },
    list: list ?? { name, create: true, id: "attribué par Brevo à la création" },
    attributes: plan ?? ["MG_REQ_<ID_RÉEL>", "MG_SENT_<ID_RÉEL>", "MG_ENROLLED_<ID_RÉEL>"],
    contactsModified: 0, emailsSent: 0 }, null, 2));
  if (!apply) return;
  if (!list) {
    // Une nouvelle lecture réduit le risque de doublon entre aperçu et application.
    list = unique(await all("lists"), name);
    if (!list) {
      const created = await request<{ id: number }>("/contacts/lists", {
        method: "POST", body: { name, folderId: folder.id }, retries: 0,
      });
      if (!created.ok || !created.data?.id) throw new Error(`Création liste non confirmée (${created.status}). Relancer le dry-run, pas un POST aveugle.`);
      list = { id: created.data.id, name };
    }
  }
  list = await verifiedList(list.id, folder.id);
  for (const attr of guideAttributePlan(await listAttributes(), list.id)) {
    if (!attr.create) continue;
    const res = await request(`/contacts/attributes/normal/${attr.name}`, {
      method: "POST", body: { type: "text" }, retries: 0,
    });
    if (!res.ok && guideAttributePlan(await listAttributes(), list.id).find((a) => a.name === attr.name)?.create) {
      throw new Error(`Création ${attr.name} non confirmée (${res.status})`);
    }
  }
  const verified = guideAttributePlan(await listAttributes(), list.id);
  if (verified.some((a) => a.create)) throw new Error("Relecture incomplète : ne pas activer le guide");
  await verifiedList(list.id, folder.id);
  log(JSON.stringify({ verified: true, list, attributes: verified.map(({ name, type }) => ({ name, type })) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  Promise.resolve().then(() => setupGuide(parseGuideSetupArgs(process.argv.slice(2)))).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Configuration non confirmée");
    console.error("Relancer le dry-run avant toute reprise. Aucun contact ni email modifié.");
    process.exitCode = 1;
  });
}
