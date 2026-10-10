/**
 * Envoi transactionnel « une seule fois » par clé métier
 * (contact × séquence × étape, ou contact × séquence × jour pour la livraison).
 *
 * Deux protections complémentaires :
 *   1. Journal Brevo = preuve DURABLE. Chaque email porte l'étiquette `k:<clé>` ;
 *      avant tout envoi, GET /smtp/emails vérifie qu'aucun email portant cette
 *      étiquette n'est déjà parti. Une reprise n8n après 30 min, 2 h ou 24 h ne
 *      renvoie donc jamais, même une fois l'idempotence Brevo expirée.
 *   2. idempotencyKey Brevo = protection ATOMIQUE contre les appels simultanés
 *      (Brevo n'accepte qu'un envoi par clé), valable 15 à 30 min selon la doc
 *      Brevo : elle couvre le court délai d'indexation du journal.
 *
 * États : PENDING (vérification du journal) → SENDING → SENT | FAILED | UNKNOWN.
 *   UNKNOWN = issue incertaine (réponse perdue, 5xx, journal Brevo injoignable) :
 *   rien n'est renvoyé à l'aveugle ; l'appelant réessaie plus tard et la
 *   vérification du journal passe toujours en premier.
 * Aucune donnée personnelle dans la clé : empreinte SHA-256.
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

/** Clé métier (32 hexadécimaux) : même entrée → même clé, sans donnée personnelle */
export function sendKeyOf(...parts: (string | number)[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

/** idempotencyKey Brevo au format UUID (recommandé par Brevo), dérivé de la clé */
export function idempotencyUuid(sendKey: string): string {
  const h = createHash("sha256").update(`idem|${sendKey}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const sendKeyTag = (sendKey: string) => `k:${sendKey}`;

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface LogEmail {
  messageId?: string;
  tags?: string[];
  date?: string;
}

/**
 * Cherche dans le journal Brevo un email déjà envoyé avec cette clé.
 * 1. Sans dates : fenêtre par défaut de Brevo (envois récents). Constat réel du
 *    11/10/2026 : Brevo valide les dates en UTC mais date le journal à l'heure de
 *    Paris ; sans dates, aucune ambiguïté autour de minuit.
 * 2. Si l'envoi a pu avoir lieu il y a plus de 2 jours : dates UTC (jamais
 *    « dans le futur » pour Brevo), bornées à 30 jours.
 * Lève une erreur si le journal est injoignable (l'appelant n'envoie pas).
 */
export async function findSentEmail(q: { email: string; templateId: number; sendKey: string; since: Date; now: Date }): Promise<LogEmail | null> {
  const tag = sendKeyTag(q.sendKey);
  const query = async (extra: Record<string, string>) => {
    const params = new URLSearchParams({ email: q.email, templateId: String(q.templateId), limit: "500", sort: "desc", ...extra });
    const res = await brevoRequest<{ transactionalEmails?: LogEmail[] }>(`/smtp/emails?${params}`, { method: "GET", retries: 2 });
    if (!res.ok) throw new Error(`Journal Brevo indisponible (${res.status})`);
    return (res.data?.transactionalEmails ?? []).find((e) => Array.isArray(e.tags) && e.tags.includes(tag)) ?? null;
  };
  const recent = await query({});
  if (recent || q.now.getTime() - q.since.getTime() <= 2 * DAY) return recent;
  const start = Math.max(q.since.getTime() - DAY, q.now.getTime() - 29 * DAY);
  return query({ startDate: utcDay(start), endDate: utcDay(q.now.getTime()) });
}

export interface SendOnceInput extends Omit<TransactionalEmail, "idempotencyKey"> {
  sendKey: string;
  /** Aucun envoi de cette clé n'a pu avoir lieu avant cette date (borne de recherche) */
  since: Date;
  now?: Date;
  /** Attente avant de revérifier le journal quand la réponse est perdue (ms) */
  recheckDelayMs?: number;
  /** Suivi des phases (journalisation, tests) */
  onPhase?: (phase: SendPhase) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sendOnce(m: SendOnceInput): Promise<SendOutcome> {
  const now = m.now ?? new Date();
  const { sendKey } = m;
  const lookup = () => findSentEmail({ email: m.to.email, templateId: m.templateId, sendKey, since: m.since, now });

  // PENDING : déjà parti ? (reprise tardive, double inscription, rejeu)
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

  // SENDING : envoi protégé par l'idempotence Brevo (appels simultanés)
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
        to: [m.to],
        templateId: m.templateId,
        params: m.params,
        tags: [...m.tags, sendKeyTag(sendKey)],
        headers,
      },
      retries: 2, // même idempotencyKey : un rejeu rapide ne peut pas doubler l'envoi
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
      // 400 / 404 : requête refusée (adresse, modèle) → inutile de réessayer ; 401 / 403 : configuration
      return { status: "FAILED", httpStatus: status, code, permanent: status === 400 || status === 404, sendKey };
    }
  } catch {
    status = 0; // réseau / délai dépassé : Brevo a peut-être accepté l'envoi
  }

  // UNKNOWN : issue incertaine → revérifier le journal, ne jamais renvoyer à l'aveugle
  await sleep(m.recheckDelayMs ?? 2000);
  try {
    const found = await lookup();
    if (found) {
      m.onPhase?.("SENT");
      return { status: "SENT", via: "journal", messageId: found.messageId, sendKey };
    }
  } catch {
    // journal injoignable : reste incertain
  }
  m.onPhase?.("UNKNOWN");
  return { status: "UNKNOWN", reason: status === 0 ? "response_lost" : "brevo_unavailable", sendKey };
}
