/**
 * Écritures de contacts Brevo. Utilisé par les routes serveur (via
 * lib/brevo/server.ts, protégé par `server-only`) et par les scripts CLI.
 */

import { brevoRequest, getContactByEmail, type AttributeValue, type BrevoContact } from "@/lib/brevo/api";

export interface UpsertResult {
  contactId?: number;
  /** Le SMS a été refusé par Brevo (doublon ou tranche non attribuée) et déplacé dans TEL_DOUBLON */
  phoneRejected?: "duplicate" | "invalid";
}

export class BrevoWriteError extends Error {
  constructor(
    public status: number,
    public code?: string
  ) {
    super(`Brevo ${status} ${code ?? ""}`.trim());
  }
}

/**
 * Crée ou met à jour le contact (clé = email) et l'ajoute aux listes.
 * `updateEnabled` couvre la course entre la lecture et l'écriture.
 *
 * Contrainte Brevo : l'attribut SMS est unique dans le compte. Si le numéro
 * appartient déjà à un autre contact (doublon = signal de déduplication) ou
 * si Brevo refuse la tranche, on retente sans SMS (numéro gardé dans
 * TEL_DOUBLON, comportement historique) : le lead n'est jamais perdu.
 * `onSmsRejected` construit les attributs du nouvel essai (voir
 * withoutRejectedSms) ; par défaut : sans SMS ni PHONE_STATUS.
 */
export async function upsertContact(
  email: string,
  attributes: Record<string, AttributeValue>,
  listIds: number[],
  existing: BrevoContact | null,
  onSmsRejected: (attrs: Record<string, AttributeValue>) => Record<string, AttributeValue> = ({
    SMS,
    PHONE_STATUS: _status,
    ...rest
  }) => {
    void _status;
    return { ...rest, ...(SMS ? { TEL_DOUBLON: SMS } : {}) };
  }
): Promise<UpsertResult> {
  const write = (attrs: Record<string, AttributeValue>) =>
    brevoRequest<{ id?: number }>("/contacts", {
      method: "POST",
      body: { email, attributes: attrs, listIds, updateEnabled: true },
      retries: 1,
    });

  let res = await write(attributes);
  let phoneRejected: UpsertResult["phoneRejected"];

  if (!res.ok && attributes.SMS) {
    const duplicate = res.code === "duplicate_parameter";
    const invalid = res.code === "invalid_parameter" && /phone|sms/i.test(res.message ?? "");
    if (duplicate || invalid) {
      phoneRejected = duplicate ? "duplicate" : "invalid";
      res = await write(onSmsRejected(attributes));
    }
  }

  if (!res.ok) throw new BrevoWriteError(res.status, res.code);

  let contactId = existing?.id ?? res.data?.id;
  if (contactId === undefined) {
    // 204 sur mise à jour concurrente : on relit pour obtenir l'identifiant
    contactId = (await getContactByEmail(email).catch(() => null))?.id;
  }
  return { contactId, phoneRejected };
}

/** Met à jour quelques attributs d'un contact existant (webhooks, statuts). */
export async function updateContactAttributes(
  identifier: { email: string } | { id: number },
  attributes: Record<string, AttributeValue>
): Promise<boolean> {
  const path =
    "email" in identifier
      ? `/contacts/${encodeURIComponent(identifier.email)}?identifierType=email_id`
      : `/contacts/${identifier.id}?identifierType=contact_id`;
  const res = await brevoRequest(path, { method: "PUT", body: { attributes } });
  return res.ok;
}
