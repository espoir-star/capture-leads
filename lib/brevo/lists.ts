/**
 * Listes Brevo : lecture et résolution par ID configuré ou NOM EXACT
 * (jamais d'ID inventé), comme les segments (lib/brevo/segments.ts).
 */
import { brevoRequest } from "@/lib/brevo/api";
import type { ListRef } from "@/config/newsletter";

export interface BrevoList {
  id: number;
  name: string;
  folderId?: number;
  uniqueSubscribers?: number;
}

export async function listLists(): Promise<BrevoList[]> {
  const out: BrevoList[] = [];
  for (let offset = 0; offset < 5000; offset += 50) {
    const res = await brevoRequest<{ lists?: BrevoList[] }>(`/contacts/lists?limit=50&offset=${offset}&sort=asc`, { retries: 2 });
    if (!res.ok) throw new Error(`Lecture des listes impossible (${res.status})`);
    const page = res.data?.lists ?? [];
    out.push(...page);
    if (page.length < 50) break;
  }
  return out;
}

export function resolveListId(ref: ListRef, lists: BrevoList[]): number | null {
  if (ref.id && lists.some((l) => l.id === ref.id)) return ref.id;
  const byName = lists.filter((l) => l.name.trim() === ref.name);
  return byName.length === 1 ? byName[0].id : null;
}
