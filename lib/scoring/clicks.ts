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
}

/** Heure d'envoi d'emails transactionnels, par messageId (journal Brevo) */
async function sentAtOf(messageIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const id of messageIds.slice(0, 50)) {
    const res = await brevoRequest<{ transactionalEmails?: { date?: string }[] }>(`/smtp/emails?messageId=${encodeURIComponent(id)}`, { method: "GET" }).catch(() => null);
    const date = res?.ok ? res.data?.transactionalEmails?.[0]?.date : undefined;
    if (date) out.set(id, new Date(date).toISOString());
  }
  return out;
}

/** Score des clics. Lève une erreur si le journal n8n est injoignable (l'appelant fait réessayer). */
export async function scoreClickCandidates(cands: ClickCandidate[], sentAt?: Map<string, string>): Promise<ClickReport> {
  const report: ClickReport = { candidates: cands.length, bots: 0, unknownContacts: 0, recorded: 0, inserted: 0 };
  const missing = [...new Set(cands.filter((c) => !c.sentAt && c.messageId && !sentAt?.has(c.messageId)).map((c) => c.messageId!))];
  const known = new Map([...(sentAt ?? new Map()), ...(missing.length ? await sentAtOf(missing) : new Map())]);
  const human = cands.filter((c) => {
    const bot = isLikelyBotClick({ occurred_at: c.occurred_at, sentAt: c.sentAt ?? (c.messageId ? known.get(c.messageId) : undefined) });
    if (bot) report.bots++;
    return !bot;
  });

  const ids = new Map<string, number | null>();
  const events: LedgerEvent[] = [];
  for (const c of human) {
    if (!ids.has(c.email)) ids.set(c.email, (await getContactByEmail(c.email))?.id ?? null);
    const id = ids.get(c.email);
    if (id) events.push(toLedgerEvent(c, id));
    else report.unknownContacts++;
  }
  if (!events.length) return report;
  const r = await recordEvents(events);
  if (!r.ok) {
    if (r.reason === "not_configured") return report;
    throw new Error(`Journal n8n indisponible (${r.reason}${r.status ? ` ${r.status}` : ""})`);
  }
  report.recorded = events.length;
  report.inserted = r.inserted;
  try {
    await applyBehaviorScores(r.rows);
  } catch (e) {
    // Événements déjà journalisés : la passe horaire n8n recalculera
    console.error("Scoring : écriture différée :", e instanceof Error ? e.message : e);
  }
  return report;
}

const parisDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(ms));

interface StatEvent {
  email?: string;
  date?: string;
  messageId?: string;
  event?: string;
  link?: string;
  templateId?: number;
}

async function statEvents(event: "clicks" | "requests", now: Date): Promise<StatEvent[]> {
  const q = new URLSearchParams({ event, startDate: parisDay(now.getTime() - 86_400_000), endDate: parisDay(now.getTime()), limit: "2500", sort: "desc" });
  const res = await brevoRequest<{ events?: StatEvent[] }>(`/smtp/statistics/events?${q}`, { method: "GET", retries: 2 });
  if (!res.ok) throw new Error(`Journal des événements Brevo indisponible (${res.status})`);
  return res.data?.events ?? [];
}

/**
 * Réconciliation (tâche horaire) : clics transactionnels d'hier et d'aujourd'hui
 * lus dans le journal Brevo, y compris ceux dont le webhook a été abandonné.
 * Les clics déjà journalisés sont ignorés par la clé unique.
 */
export async function reconcileTransactionalClicks(now: Date = new Date()): Promise<ClickReport> {
  const clicks = await statEvents("clicks", now);
  const sends = await statEvents("requests", now);
  const sentAt = new Map<string, string>();
  for (const s of sends) if (s.messageId && s.date) sentAt.set(s.messageId, new Date(s.date).toISOString());
  const cands: ClickCandidate[] = [];
  for (const e of clicks) {
    if (!e.email || e.email.toLowerCase() === REPLY_TO.toLowerCase()) continue; // emails internes
    const t = Date.parse(e.date ?? "");
    const c = clickCandidate(
      { event: "click", email: e.email, "message-id": e.messageId, link: e.link, template_id: e.templateId, ...(Number.isFinite(t) && { ts_event: Math.floor(t / 1000) }) },
      now
    );
    if (c) cands.push(c);
  }
  return scoreClickCandidates(cands, sentAt);
}
