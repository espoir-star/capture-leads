/**
 * Vercel → journal des événements n8n (Data table « althoce_marketing_events »,
 * workflow « ALTHOCE | Marketing | Journal des événements — v1 »).
 *
 *   POST { events: LedgerEvent[] }   Authorization: Bearer N8N_WEBHOOK_TOKEN
 *   ← { ok: true, inserted, rows }   rows = historique COMPLET des contacts concernés
 *
 *   N8N_EVENTS_WEBHOOK_URL   URL de production du webhook (absente = scoring comportemental désactivé)
 *   N8N_WEBHOOK_TOKEN        même jeton que le moteur de séquences
 *
 * n8n ne reçoit aucune donnée personnelle : ID contact Brevo, catégorie,
 * points, date, clé opaque. 3 tentatives ; l'appelant décide de la suite
 * (webhook Brevo : 429 → Brevo rejoue plus tard).
 */

import type { LedgerEvent, LedgerRow } from "@/lib/scoring/behavior";

type Env = Record<string, string | undefined>;

export type LedgerResult =
  | { ok: true; inserted: number; rows: LedgerRow[] }
  | { ok: false; reason: "not_configured" | "rejected" | "unreachable"; status?: number };

/** Taille maximale d'un envoi (le workflow n8n refuse au-delà) */
export const LEDGER_BATCH = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ledgerConfigured(env: Env = process.env): boolean {
  return !!(env.N8N_EVENTS_WEBHOOK_URL?.trim() && env.N8N_WEBHOOK_TOKEN?.trim());
}

async function postBatch(events: LedgerEvent[], url: string, token: string, fetchImpl: typeof fetch): Promise<LedgerResult> {
  let last: LedgerResult = { ok: false, reason: "unreachable" };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(700 * attempt);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { ok?: unknown; inserted?: unknown; rows?: unknown } | null;
        if (body?.ok === true && Array.isArray(body.rows)) {
          return { ok: true, inserted: Number(body.inserted) || 0, rows: body.rows as LedgerRow[] };
        }
        last = { ok: false, reason: "unreachable", status: res.status }; // réponse tronquée : on réessaie
        continue;
      }
      last = { ok: false, reason: res.status === 429 || res.status >= 500 ? "unreachable" : "rejected", status: res.status };
      if (last.reason === "rejected") return last;
    } catch {
      last = { ok: false, reason: "unreachable" };
    }
  }
  return last;
}

/** Enregistre des événements (idempotent : une clé déjà connue n'est pas réinsérée). */
export async function recordEvents(
  events: readonly LedgerEvent[],
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<LedgerResult> {
  const url = env.N8N_EVENTS_WEBHOOK_URL?.trim();
  const token = env.N8N_WEBHOOK_TOKEN?.trim();
  if (!url || !token) return { ok: false, reason: "not_configured" };
  const rows: LedgerRow[] = [];
  let inserted = 0;
  for (let i = 0; i < events.length; i += LEDGER_BATCH) {
    const r = await postBatch(events.slice(i, i + LEDGER_BATCH), url, token, fetchImpl);
    if (!r.ok) return r;
    rows.push(...r.rows);
    inserted += r.inserted;
  }
  return { ok: true, inserted, rows };
}
