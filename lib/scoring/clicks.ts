/**
 * Clics Brevo → journal n8n → score. Partagé par le webhook (temps réel) et la
 * réconciliation horaire (journal des clics Brevo, pour les webhooks que Brevo
 * aurait abandonnés). Même clé dans les deux cas : jamais de double comptage.
 *
 * Filtre robots : un clic moins de BOT_CLICK_SECONDS après l'envoi n'est pas
 * compté. Heure d'envoi : ts_sent (campagnes) ou journal Brevo (transactionnel).
 */

import { brevoRequest, getContactByEmail } from "@/lib/brevo/api";
import { REPLY_TO } from "@/config/senders";
import { applyBehaviorScores } from "@/lib/scoring/apply";
import { clickCandidate, isLikelyBotClick, toLedgerEvent, type ClickCandidate, type LedgerEvent } from "@/lib/scoring/behavior";
import { recordEvents } from "@/lib/scoring/ledger";

export interface ClickReport {
  candidates: number;
  bots: number;
  unknownContacts: number;
  recorded: number;
  inserted: number;
  /** Clics laissés pour la passe suivante (budget de temps atteint) */
  deferred?: number;
}

export interface ClickOptions {
  /** Passe horaire : les clics déjà journalisés ont déjà leur score, rien à recalculer */
  reconcile?: boolean;
  /** Heure limite (ms epoch) : au-delà, les clics restants attendent la passe suivante */
  deadline?: number;
}

/** Appels Brevo simultanés pendant la passe horaire (bien sous la limite de l'API) */
const BREVO_CONCURRENCY = 5;
/**
 * Passe horaire : clics des 6 dernières heures seulement. Le temps réel passe par le webhook ;
 * chaque clic est donc revu par 6 passes successives, de quoi couvrir une panne de quelques heures
 * sans relire deux jours de clics à chaque passe (incident du 16/10/2026).
 */
export const RECONCILE_WINDOW_MS = 6 * 3_600_000;
/** Temps minimal pour écrire au journal n8n avant l'heure limite ; sinon report à la passe suivante */
const LEDGER_MIN_MS = 8_000;

/** Applique fn à chaque élément avec au plus `limit` appels en parallèle, dans l'ordre d'origine. */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Heure d'envoi d'emails transactionnels, par messageId (journal Brevo) */
async function sentAtOf(messageIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await mapLimit(messageIds.slice(0, 50), BREVO_CONCURRENCY, async (id) => {
    const res = await brevoRequest<{ transactionalEmails?: { date?: string }[] }>(`/smtp/emails?messageId=${encodeURIComponent(id)}`, { method: "GET" }).catch(() => null);
    const date = res?.ok ? res.data?.transactionalEmails?.[0]?.date : undefined;
    if (date) out.set(id, new Date(date).toISOString());
  });
  return out;
}

/** Score des clics. Lève une erreur si le journal n8n est injoignable (l'appelant fait réessayer). */
export async function scoreClickCandidates(cands: ClickCandidate[], sentAt?: Map<string, string>, opts: ClickOptions = {}): Promise<ClickReport> {
  const report: ClickReport = { candidates: cands.length, bots: 0, unknownContacts: 0, recorded: 0, inserted: 0 };
  const missing = [...new Set(cands.filter((c) => !c.sentAt && c.messageId && !sentAt?.has(c.messageId)).map((c) => c.messageId!))];
  const known = new Map([...(sentAt ?? new Map()), ...(missing.length ? await sentAtOf(missing) : new Map())]);
  const human = cands.filter((c) => {
    const bot = isLikelyBotClick({ occurred_at: c.occurred_at, sentAt: c.sentAt ?? (c.messageId ? known.get(c.messageId) : undefined) });
    if (bot) report.bots++;
    return !bot;
  });

  // Une lecture Brevo par adresse, en parallèle limité ; au-delà de l'heure limite, la suite attend.
  const emails = [...new Set(human.map((c) => c.email))];
  const found = await mapLimit(emails, BREVO_CONCURRENCY, async (email) =>
    opts.deadline && Date.now() > opts.deadline ? undefined : ((await getContactByEmail(email))?.id ?? null)
  );
  const ids = new Map(emails.map((email, i) => [email, found[i]] as const));
  const events: LedgerEvent[] = [];
  for (const c of human) {
    const id = ids.get(c.email);
    if (id === undefined) report.deferred = (report.deferred ?? 0) + 1;
    else if (id) events.push(toLedgerEvent({ ...c, sentAt: c.sentAt ?? (c.messageId ? known.get(c.messageId) : undefined) }, id));
    else report.unknownContacts++;
  }
  if (!events.length) return report;
  if (opts.deadline && opts.deadline - Date.now() < LEDGER_MIN_MS) {
    report.deferred = (report.deferred ?? 0) + events.length;
    return report;
  }
  const r = await recordEvents(events);
  if (!r.ok) {
    if (r.reason === "not_configured") return report;
    throw new Error(`Journal n8n indisponible (${r.reason}${r.status ? ` ${r.status}` : ""})`);
  }
  report.recorded = events.length;
  report.inserted = r.inserted;
  // Passe horaire sans nouveau clic : les scores ont déjà été calculés à la première écriture.
  if (opts.reconcile && r.inserted === 0) return report;
  try {
    await applyBehaviorScores(r.rows);
  } catch (e) {
    // Événements déjà journalisés : la passe horaire n8n recalculera
    console.error("Scoring : écriture différée :", e instanceof Error ? e.message : e);
  }
  return report;
}

interface StatEvent {
  email?: string;
  date?: string;
  messageId?: string;
  event?: string;
  link?: string;
  templateId?: number;
}

/**
 * Fenêtre « days=2 » (aujourd'hui et hier) plutôt que startDate/endDate :
 * Brevo refuse (400) une date postérieure au jour UTC courant, or entre 00 h et
 * 02 h à Paris le jour parisien est déjà le lendemain (incident du 12/10/2026).
 */
async function statEvents(event: "clicks" | "requests"): Promise<StatEvent[]> {
  const q = new URLSearchParams({ event, days: "2", limit: "2500", sort: "desc" });
  const res = await brevoRequest<{ events?: StatEvent[] }>(`/smtp/statistics/events?${q}`, { method: "GET", retries: 2 });
  if (!res.ok) throw new Error(`Journal des événements Brevo indisponible (${res.status})`);
  return res.data?.events ?? [];
}

/**
 * Réconciliation (tâche horaire) : clics transactionnels des 6 dernières heures lus dans le
 * journal Brevo, y compris ceux dont le webhook a été abandonné. Les clics déjà journalisés
 * sont ignorés par la clé unique ; au-delà de l'heure limite, la suite attend la passe suivante.
 */
export async function reconcileTransactionalClicks(now: Date = new Date(), opts: { deadline?: number } = {}): Promise<ClickReport> {
  const clicks = await statEvents("clicks");
  const sends = await statEvents("requests");
  const sentAt = new Map<string, string>();
  for (const s of sends) if (s.messageId && s.date) sentAt.set(s.messageId, new Date(s.date).toISOString());
  const cands: ClickCandidate[] = [];
  const since = now.getTime() - RECONCILE_WINDOW_MS;
  for (const e of clicks) {
    if (!e.email || e.email.toLowerCase() === REPLY_TO.toLowerCase()) continue; // emails internes
    const t = Date.parse(e.date ?? "");
    const c = clickCandidate(
      { event: "click", email: e.email, "message-id": e.messageId, link: e.link, template_id: e.templateId, ...(Number.isFinite(t) && { ts_event: Math.floor(t / 1000) }) },
      now
    );
    if (c && Date.parse(c.occurred_at) >= since) cands.push(c);
  }
  return scoreClickCandidates(cands, sentAt, { reconcile: true, deadline: opts.deadline });
}
