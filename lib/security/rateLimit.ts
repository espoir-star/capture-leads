/**
 * Limitation de débit en mémoire (par instance serverless), best-effort.
 * Repris de l'ancienne route /api/lead et généralisé à plusieurs fenêtres.
 *
 * Suffisant contre les boucles d'envoi naïves ; les bots sont surtout
 * arrêtés par le honeypot et Turnstile. Pour une limite globale multi-
 * instances, il faudrait un stockage partagé (non nécessaire aujourd'hui).
 */

interface Window {
  ms: number;
  max: number;
}

const buckets = new Map<string, { count: number; reset: number }>();

function hit(key: string, w: Window, now: number): boolean {
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + w.ms });
    return false;
  }
  b.count++;
  return b.count > w.max;
}

/** true = trop de requêtes. Toutes les fenêtres sont comptées. */
export function isRateLimited(scope: string, id: string, windows: Window[]): boolean {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  let limited = false;
  for (const w of windows) {
    if (hit(`${scope}:${w.ms}:${id}`, w, now)) limited = true;
  }
  return limited;
}

/** Capture de lead : 6/min et 30/h par IP (un cabinet derrière une même IP passe). */
export const LEAD_LIMITS: Window[] = [
  { ms: 60_000, max: 6 },
  { ms: 3_600_000, max: 30 },
];

export const EVENT_LIMITS: Window[] = [{ ms: 60_000, max: 30 }];

/** Mode dégradé (Cloudflare Turnstile injoignable) : 2 soumissions / 10 min par IP… */
export const DEGRADED_IP_LIMITS: Window[] = [{ ms: 600_000, max: 2 }];
/** … et 20 / heure par instance, toutes IP confondues */
export const DEGRADED_GLOBAL_LIMITS: Window[] = [{ ms: 3_600_000, max: 20 }];

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "inconnue"
  );
}

/** Réservé aux tests */
export function __resetRateLimits() {
  buckets.clear();
}
