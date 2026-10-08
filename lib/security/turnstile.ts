/**
 * Cloudflare Turnstile — vérification SERVEUR du jeton.
 *
 * TURNSTILE_SECRET_KEY absent  → protection désactivée (log d'avertissement),
 *                                  le honeypot et le rate limiting restent actifs.
 * Jeton absent / refusé         → soumission rejetée (aucun contact créé).
 * Cloudflare injoignable         → fail-open journalisé : une panne d'un service
 *                                  tiers ne doit pas bloquer les vrais prospects.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { ok: true; skipped?: "not_configured" | "unreachable" }
  | { ok: false; reason: "missing_token" | "rejected"; codes?: string[] };

let warned = false;

export async function verifyTurnstile(
  token: unknown,
  ip?: string,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (!warned) {
      console.warn("TURNSTILE_SECRET_KEY absente : vérification anti-bot Turnstile désactivée");
      warned = true;
    }
    return { ok: true, skipped: "not_configured" };
  }
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    return { ok: false, reason: "missing_token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "inconnue") body.set("remoteip", ip);

  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`siteverify ${res.status}`);
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    const codes = data["error-codes"] ?? [];
    if (codes.includes("internal-error")) {
      console.error("Turnstile internal-error : fail-open");
      return { ok: true, skipped: "unreachable" };
    }
    return { ok: false, reason: "rejected", codes };
  } catch (e) {
    console.error("Turnstile injoignable, fail-open :", e instanceof Error ? e.message : e);
    return { ok: true, skipped: "unreachable" };
  }
}
