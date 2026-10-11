/**
 * Envoi par clé métier stable (contact × séquence × étape/jour).
 * Le journal Brevo est relu avant l'envoi ; son horizon de conservation
 * n'est pas une garantie d'idempotence permanente. L'idempotencyKey protège
 * les reprises proches selon la fenêtre offerte par Brevo.
 * Une nouvelle publication de template ne doit pas masquer un ancien envoi.
 */
import { createHash } from "node:crypto";
import { brevoRequest } from "@/lib/brevo/api";
import { isIdempotencyDuplicate, type TransactionalEmail } from "@/lib/brevo/transactional";
import { REPLY_TO, SENDERS } from "@/config/senders";

export type SendPhase = "PENDING" | "SENDING" | "SENT" | "FAILED" | "UNKNOWN";
export type SendOutcome =
  | { status: "SENT"; via: "sent" | "duplicate" | "journal"; messageId?: string; sendKey: string }
  | { status: "FAILED"; httpStatus: number; code?: string; permanent: boolean; sendKey: string }
  | { status: "UNKNOWN"; reason: "response_lost" | "journal_unavailable" | "brevo_unavailable"; sendKey: string };
const DAY = 86_400_000;
export function sendKeyOf(...parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
export function idempotencyUuid(sendKey: string): string {
  const h = createHash("sha256").update(`idem|${sendKey}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const sendKeyTag = (sendKey: string) => `k:${sendKey}`;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
interface LogEmail { messageId?: string; tags?: string[]; date?: string }

/**
 * Recherche par destinataire ET clé, tous modèles confondus : le passage
 * #35 → #41 ne remet pas à zéro l'historique de la même opération.
 * Pagination bornée ; réponse invalide, pages tronquées ou limite atteinte
 * => erreur et UNKNOWN, jamais un renvoi faute de preuve.
 */
export async function findSentEmail(q: { email: string; templateId: number; sendKey: string; since: Date; now: Date }): Promise<LogEmail | null> {
  const tag = sendKeyTag(q.sendKey);
  const query = async (extra: Record<string, string>) => {
    const limit = 500;
    for (let page = 0; page < 10; page++) {
      // templateId est volontairement absent : la clé identifie l'action, pas son design.
      const params = new URLSearchParams({ email: q.email, limit: String(limit), offset: String(page * limit), sort: "desc", ...extra });
      const res = await brevoRequest<{ transactionalEmails?: LogEmail[]; count?: number }>(`/smtp/emails?${params}`, { method: "GET", retries: 2 });
      if (!res.ok) throw new Error(`Journal Brevo indisponible (${res.status})`);
      const emails = res.data?.transactionalEmails;
      if (!Array.isArray(emails)) throw new Error("Journal Brevo incomplet");
      const found = emails.find((e) => Array.isArray(e.tags) && e.tags.includes(tag));
      if (found) return found;
      const count = res.data?.count;
      if (emails.length < limit) {
        if (typeof count === "number" && count > page * limit + emails.length) throw new Error("Pagination journal Brevo incomplète");
        return null;
      }
      if (typeof count === "number" && page * limit + emails.length >= count) return null;
    }
    throw new Error("Limite de pagination du journal atteinte");
  };
  const recent = await query({});
  if (recent || q.now.getTime() - q.since.getTime() <= 2 * DAY) return recent;
  const start = Math.max(q.since.getTime() - DAY, q.now.getTime() - 29 * DAY);
  return query({ startDate: utcDay(start), endDate: utcDay(q.now.getTime()) });
}

export interface SendOnceInput extends Omit<TransactionalEmail, "idempotencyKey"> {
  sendKey: string;
  since: Date;
  now?: Date;
  recheckDelayMs?: number;
  onPhase?: (phase: SendPhase) => void;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export async function sendOnce(m: SendOnceInput): Promise<SendOutcome> {
  const now = m.now ?? new Date();
  const { sendKey } = m;
  const lookup = () => findSentEmail({ email: m.to.email, templateId: m.templateId, sendKey, since: m.since, now });
  m.onPhase?.("PENDING");
  try {
    const found = await lookup();
    if (found) {
      m.onPhase?.("SENT");
      return { status: "SENT", via: "journal", messageId: found.messageId, sendKey };
    }
  } catch {
    m.onPhase?.("UNKNOWN");
    return { status: "UNKNOWN", reason: "journal_unavailable", sendKey };
  }
  m.onPhase?.("SENDING");
  const headers: Record<string, string> = { idempotencyKey: idempotencyUuid(sendKey) };
  if (m.oneClickUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${m.oneClickUnsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  let status = 0;
  let code: string | undefined;
  try {
    const res = await brevoRequest<{ messageId?: string }>("/smtp/email", {
      method: "POST",
      body: {
        sender: m.sender ?? SENDERS.resources,
        replyTo: { email: REPLY_TO, name: "Althoce" },
        to: [m.to], templateId: m.templateId, params: m.params,
        tags: [...m.tags, sendKeyTag(sendKey)], headers,
      },
      retries: 2,
    });
    if (res.ok) {
      m.onPhase?.("SENT");
      return { status: "SENT", via: "sent", messageId: res.data?.messageId, sendKey };
    }
    if (isIdempotencyDuplicate(res.status, res.message)) {
      m.onPhase?.("SENT");
      return { status: "SENT", via: "duplicate", sendKey };
    }
    status = res.status;
    code = res.code;
    if (status < 500 && status !== 429) {
      m.onPhase?.("FAILED");
      return { status: "FAILED", httpStatus: status, code, permanent: status === 400 || status === 404, sendKey };
    }
  } catch { status = 0; }
  await sleep(m.recheckDelayMs ?? 2000);
  try {
    const found = await lookup();
    if (found) {
      m.onPhase?.("SENT");
      return { status: "SENT", via: "journal", messageId: found.messageId, sendKey };
    }
  } catch { /* reste incertain, pas de renvoi aveugle */ }
  m.onPhase?.("UNKNOWN");
  return { status: "UNKNOWN", reason: status === 0 ? "response_lost" : "brevo_unavailable", sendKey };
}
