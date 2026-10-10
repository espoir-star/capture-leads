/**
 * Envoi d'un modèle Brevo par l'API transactionnelle (POST /v3/smtp/email).
 *
 * Constats vérifiés sur le compte réel (10/10/2026) :
 *   - l'en-tête `idempotencyKey` est respecté : un second envoi avec la même
 *     clé est refusé (400 duplicate_parameter « already been processed ») →
 *     les reprises (n8n, réseau) ne créent jamais de doublon ;
 *   - un contact bloqué côté marketing (emailBlacklisted) reçoit quand même
 *     le transactionnel : c'est voulu pour la livraison d'un guide demandé,
 *     jamais un moyen de contourner une opposition (étapes marketing filtrées
 *     par lib/sequences/plan.ts) ;
 *   - un `List-Unsubscribe` fourni remplace celui de Brevo : le bouton
 *     « Se désabonner » des messageries mène à NOTRE opposition marketing,
 *     pas au blocage transactionnel Brevo (qui couperait aussi les guides).
 *
 * L'en-tête idempotencyKey est visible dans l'email : clés sans donnée
 * personnelle (lib/sequences/enrollment.ts).
 */

import { brevoRequest } from "@/lib/brevo/api";
import { REPLY_TO, SENDERS, type Sender } from "@/config/senders";

export interface TransactionalEmail {
  to: { email: string; name?: string };
  templateId: number;
  params: Record<string, string>;
  tags: string[];
  idempotencyKey: string;
  /** URL d'opposition en un clic (RFC 8058), ajoutée en List-Unsubscribe */
  oneClickUnsubscribeUrl?: string;
  sender?: Sender;
}

export type SendResult =
  | { status: "sent"; messageId?: string }
  | { status: "duplicate" }
  | { status: "error"; httpStatus: number; code?: string };

export function isIdempotencyDuplicate(status: number, message?: string): boolean {
  return status === 400 && /idempotency/i.test(message ?? "");
}

export async function sendTransactionalEmail(m: TransactionalEmail): Promise<SendResult> {
  const headers: Record<string, string> = { idempotencyKey: m.idempotencyKey };
  if (m.oneClickUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${m.oneClickUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const res = await brevoRequest<{ messageId?: string }>("/smtp/email", {
    method: "POST",
    body: {
      sender: m.sender ?? SENDERS.resources,
      replyTo: { email: REPLY_TO, name: "Althoce" },
      to: [m.to],
      templateId: m.templateId,
      params: m.params,
      tags: m.tags,
      headers,
    },
    // sans risque : la clé d'idempotence empêche tout double envoi
    retries: 2,
  });
  if (res.ok) return { status: "sent", messageId: res.data?.messageId };
  if (isIdempotencyDuplicate(res.status, res.message)) return { status: "duplicate" };
  return { status: "error", httpStatus: res.status, code: res.code };
}
