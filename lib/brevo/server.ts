/**
 * Point d'entrée Brevo des routes SERVEUR. `server-only` fait échouer le
 * build si ce module est importé par erreur depuis un composant client :
 * la clé BREVO_API_KEY ne peut pas se retrouver dans le navigateur.
 */

import "server-only";

export { getContactByEmail, type BrevoContact } from "@/lib/brevo/api";
export { upsertContact, updateContactAttributes, blocklistMarketingContact, BrevoWriteError, type UpsertResult } from "@/lib/brevo/contacts";
export {
  BREVO_EVENTS,
  CLIENT_EVENTS,
  sendBrevoEvent,
  type BrevoEventName,
  type EventProperties,
} from "@/lib/brevo/events";
