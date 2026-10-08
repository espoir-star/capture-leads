/**
 * Cloudflare Turnstile — vérification SERVEUR du jeton.
 *
 * TURNSTILE_SECRET_KEY absent  → Preview Vercel : clé secrète de TEST officielle
 *                                  Cloudflare (la vérification serveur a bien lieu) ;
 *                                  local : protection désactivée (log d'avertissement),
 *                                  le honeypot et le rate limiting restent actifs.
 *                                  Production : impossible (garde-fou de build).
 * Jeton absent / refusé         → soumission rejetée (aucun contact créé).
 * Cloudflare injoignable         → fail-open journalisé : une panne d'un service
 *                                  tiers ne doit pas bloquer les vrais prospects.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Clé secrète de TEST officielle Cloudflare (publique, documentée : accepte
 * tout jeton non vide). Utilisée UNIQUEMENT sur les déploiements Preview sans
 * vraie clé, pour recetter le widget et l'appel serveur sans secret réel.
 */
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export function turnstileSecret(): { secret?: string; test: boolean } {
  const real = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (real) return { secret: real, test: false };
  if (process.env.VERCEL_ENV === "preview") return { secret: TURNSTILE_TEST_SECRET, test: true };
  return { test: false };
}

export type TurnstileResult =
  | { ok: true; skipped?: "not_configured" | "unreachable" }
  | { ok: false; reason: "missing_token" | "rejected"; codes?: string[] };

let warned = false;

export async function verifyTurnstile(
  token: unknown,
  ip?: string,
  fetchImpl: typeof fetch = fetch
): Promise<TurnstileResult> {
  const { secret, test } = turnstileSecret();
  if (!warned && (test || !secret)) {
    console.warn(
      test
        ? "Turnstile : clés de TEST Cloudflare (Preview) — remplacer par de vraies clés en Production"
        : "TURNSTILE_SECRET_KEY absente : vérification anti-bot Turnstile désactivée"
    );
    warned = true;
  }
  if (!secret) return { ok: true, skipped: "not_configured" };
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
