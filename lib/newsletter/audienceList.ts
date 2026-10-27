/**
 * Membres d'une liste d'annonce : les contacts autorisés à recevoir un email
 * marketing (lib/marketing/status.ts), hors adresses de recette (IS_QA).
 * Fonction pure : le script scripts/newsletter/sync-list.ts applique le diff.
 */
import type { BrevoContact } from "@/lib/brevo/api";
import { mayReceiveMarketing } from "@/lib/marketing/status";

type ContactLike = Pick<BrevoContact, "id" | "email" | "attributes" | "emailBlacklisted" | "listIds">;

export function isAnnouncementRecipient(c: ContactLike): boolean {
  return !!c.email && c.attributes?.IS_QA !== true && mayReceiveMarketing(c);
}

/** Contacts à ajouter à la liste et à en retirer pour qu'elle corresponde exactement à la règle. */
export function listDiff(contacts: ContactLike[], listId: number | null) {
  const add: number[] = [];
  const remove: number[] = [];
  for (const c of contacts) {
    const inList = listId !== null && (c.listIds ?? []).includes(listId);
    const wanted = isAnnouncementRecipient(c);
    if (wanted && !inList) add.push(c.id);
    if (!wanted && inList) remove.push(c.id);
  }
  return { add, remove };
}
