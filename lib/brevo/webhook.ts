/**
 * Webhooks Brevo — logique PURE (tests/webhook.test.ts).
 *
 *   hard_bounce → EMAIL_STATUS = BOUNCED   (prioritaire, définitif)
 *   click, opened, … → AUCUN effet sur EMAIL_STATUS. VERIFIED ne vient que du
 *   lien de confirmation dédié (lib/security/emailConfirm.ts), jamais d'un clic
 *   quelconque dans une newsletter. Ces événements restent parsés pour un
 *   futur scoring (désactivé).
 *
 * Idempotence : l'effet est un ÉTAT ABSOLU (jamais un incrément, jamais de
 * score). Un même événement reçu deux fois ne produit qu'une écriture.
 */

export type WebhookKind = "hard_bounce" | "click" | "opened" | "unsubscribed" | "other";

export interface WebhookEvent {
  kind: WebhookKind;
  email: string;
  url?: string;
  /** secondes epoch */
  sentAt?: number;
  eventAt?: number;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

const KINDS: Record<string, WebhookKind> = {
  hard_bounce: "hard_bounce",
  hardBounce: "hard_bounce",
  click: "click",
  opened: "opened",
  unique_opened: "opened",
  uniqueOpened: "opened",
  unsubscribe: "unsubscribed",
  unsubscribed: "unsubscribed",
};

/** Accepte les formats marketing (campagnes) et transactionnels de Brevo. Ne fait confiance à rien. */
export function parseWebhookEvent(raw: unknown): WebhookEvent {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const evt = typeof o.event === "string" ? o.event : "";
  const url = typeof o.URL === "string" ? o.URL : typeof o.link === "string" ? o.link : undefined;
  return {
    kind: KINDS[evt] ?? "other",
    email: typeof o.email === "string" ? o.email.trim().toLowerCase().slice(0, 254) : "",
    url: url?.slice(0, 2000),
    sentAt: num(o.ts_sent),
    eventAt: num(o.ts_event),
  };
}

/** Nouvel EMAIL_STATUS après un hard bounce, ou null si déjà appliqué. */
export function emailStatusAfterBounce(current: string | undefined): "BOUNCED" | null {
  return String(current ?? "") === "BOUNCED" ? null : "BOUNCED";
}
