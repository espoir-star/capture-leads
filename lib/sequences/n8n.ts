/**
 * Vercel → n8n : inscription d'un contact à une séquence.
 *
 * Appel unique au webhook du workflow générique (n8n/althoce-sequences.json),
 * authentifié par jeton Bearer (credential « Header Auth » côté n8n). n8n ne
 * reçoit AUCUNE donnée personnelle : seulement l'identifiant signé
 * d'inscription, la prochaine étape et sa date.
 *
 *   N8N_SEQUENCE_WEBHOOK_URL   URL de production du webhook n8n
 *   N8N_WEBHOOK_TOKEN          jeton partagé (jamais affiché, jamais commité)
 *
 * Indisponibilité de n8n : 3 tentatives, puis échec journalisé + événement
 * Brevo `sequence_enroll_failed` (rejouable). La livraison du guide, faite
 * AVANT par Vercel, n'en dépend jamais.
 */

type Env = Record<string, string | undefined>;

export interface N8nEnrollPayload {
  enrollmentId: string;
  sequenceId: string;
  stepId: string;
  /** Date ISO à laquelle n8n doit appeler /api/sequences/step */
  at: string;
}

export type N8nResult = { ok: true } | { ok: false; reason: "not_configured" | "rejected" | "unreachable"; status?: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function notifyN8n(
  payload: N8nEnrollPayload,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<N8nResult> {
  const url = env.N8N_SEQUENCE_WEBHOOK_URL?.trim();
  const token = env.N8N_WEBHOOK_TOKEN?.trim();
  if (!url || !token) return { ok: false, reason: "not_configured" };

  let last: N8nResult = { ok: false, reason: "unreachable" };
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(500 * attempt);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { ok: true };
      last = { ok: false, reason: res.status === 429 || res.status >= 500 ? "unreachable" : "rejected", status: res.status };
      if (last.reason === "rejected") return last;
    } catch {
      last = { ok: false, reason: "unreachable" };
    }
  }
  return last;
}
