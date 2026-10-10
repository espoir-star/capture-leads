/**
 * Faux Brevo (API v3) en mémoire pour les tests de bout en bout.
 * Reproduit les comportements utilisés par l'application :
 *   GET  /v3/contacts/:id(email|contact_id)   POST /v3/contacts (updateEnabled)
 *   PUT  /v3/contacts/:id                      POST /v3/events
 *   POST /v3/smtp/email (en-tête idempotencyKey : 2e envoi refusé, comme Brevo)
 *   unicité de l'attribut SMS (duplicate_parameter), listes cumulées.
 *   GET  /v3/account (crédits d'envoi du jour)  GET /v3/contacts (liste, modifiedSince ignoré)
 *   GET  /v3/smtp/emails (journal des envois : email, templateId, tags, messageId)
 *   Idempotence avec durée de vie (idemTtlMs, 30 min par défaut) et horloge décalable
 *   (clockOffsetMs) ; pannes simulées : réponse perdue après acceptation
 *   (dropResponses), journal indisponible (journalDown) ou en retard (journalDelayMs).
 * Faux n8n : POST /__n8n (webhook d'inscription, enregistre en-tête et corps),
 *            POST /__n8n_events (journal des événements : clé unique, renvoie
 *            l'historique complet des contacts concernés, comme le workflow réel).
 * Routes de test : GET /__state, POST /__reset, POST /__seed, POST /__config.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export interface MockContact {
  id: number;
  email: string;
  emailBlacklisted: boolean;
  listIds: number[];
  attributes: Record<string, unknown>;
}

export interface MockEmail {
  to: { email: string }[];
  templateId: number;
  params: Record<string, string>;
  tags: string[];
  headers: Record<string, string>;
  messageId?: string;
  /** horloge du faux Brevo (ms) */
  acceptedAt?: number;
}

export interface MockState {
  contacts: MockContact[];
  events: { event_name: string; identifiers: Record<string, unknown>; event_properties?: Record<string, unknown> }[];
  requests: string[];
  emails: MockEmail[];
  n8n: { authorization?: string; body: Record<string, unknown> }[];
  /** Journal n8n (Data table) */
  ledger: Record<string, unknown>[];
  /** Crédits d'envoi restants (offre Free) */
  credits: number;
  /** Simule un n8n arrêté (503) */
  ledgerDown: boolean;
  /** Durée de vie de l'idempotencyKey (Brevo : 15 à 30 min) */
  idemTtlMs: number;
  /** Décalage de l'horloge du faux Brevo (simuler 30 min, 2 h, 24 h plus tard) */
  clockOffsetMs: number;
  /** Nombre de prochaines réponses de POST /smtp/email perdues (connexion coupée, l'envoi est traité) */
  dropResponses: number;
  /** Statut HTTP imposé au prochain POST /smtp/email (0 = aucun) */
  sendFailStatus: number;
  journalDown: boolean;
  /** Comme le vrai Brevo : refuse une date de journal future (heure de Paris, horloge réelle) */
  journalStrictDates: boolean;
  /** Journal des événements Brevo (GET /smtp/statistics/events), alimenté par /__stats */
  statsEvents: Record<string, unknown>[];
  /** Faux Cloudflare Turnstile : ok | down | duplicate | invalid | internal */
  turnstile: string;
  /** Délai avant qu'un envoi apparaisse dans le journal */
  journalDelayMs: number;
}

const emptyState = (): MockState => ({
  contacts: [], events: [], requests: [], emails: [], n8n: [], ledger: [], credits: 300, ledgerDown: false,
  idemTtlMs: 30 * 60_000, clockOffsetMs: 0, dropResponses: 0, sendFailStatus: 0, journalDown: false, journalStrictDates: false, journalDelayMs: 0, turnstile: "ok", statsEvents: [],
});

export const MOCK_API_KEY = "mock-key-e2e";

export function startMockBrevo(port: number) {
  let state: MockState = emptyState();
  let idempotencyKeys = new Map<string, number>();
  const clock = () => Date.now() + state.clockOffsetMs;
  let nextId = 1;

  const find = (id: string, type: string | null) =>
    type === "contact_id"
      ? state.contacts.find((c) => c.id === Number(id))
      : state.contacts.find((c) => c.email === decodeURIComponent(id).toLowerCase());

  const smsOwner = (sms: unknown, exceptId?: number) => {
    const d = String(sms ?? "").replace(/\D/g, "");
    return d ? state.contacts.find((c) => c.id !== exceptId && String(c.attributes.SMS ?? "") === d) : undefined;
  };

  const merge = (c: MockContact, attrs: Record<string, unknown> = {}) => {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === "" || v === null) delete c.attributes[k]; // Brevo : chaîne vide = attribut effacé
      else c.attributes[k] = k === "SMS" ? String(v).replace(/\D/g, "") : v;
    }
  };

  const send = (res: ServerResponse, status: number, body?: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<Record<string, unknown>>((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({}); // corps non JSON (formulaire Turnstile, flux de test)
        }
      });
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const body = req.method === "GET" ? {} : await readBody(req);

    if (url.pathname === "/__state") return send(res, 200, state);
    if (url.pathname === "/__reset") {
      state = emptyState();
      idempotencyKeys = new Map();
      nextId = 1;
      return send(res, 204);
    }
    if (url.pathname === "/__seed") {
      const c = body as unknown as Partial<MockContact>;
      state.contacts.push({ emailBlacklisted: false, listIds: [], attributes: {}, ...c, email: String(c.email), id: nextId++ });
      return send(res, 201, { id: nextId - 1 });
    }

    if (url.pathname === "/__n8n" && req.method === "POST") {
      state.n8n.push({ authorization: req.headers.authorization, body });
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/__config" && req.method === "POST") {
      for (const k of ["credits", "idemTtlMs", "clockOffsetMs", "dropResponses", "journalDelayMs", "sendFailStatus"] as const) {
        if (typeof body[k] === "number") state[k] = body[k] as number;
      }
      if (typeof body.ledgerDown === "boolean") state.ledgerDown = body.ledgerDown;
      if (typeof body.journalDown === "boolean") state.journalDown = body.journalDown;
      if (typeof body.journalStrictDates === "boolean") state.journalStrictDates = body.journalStrictDates;
      if (typeof body.turnstile === "string") state.turnstile = body.turnstile;
      return send(res, 204);
    }
    if (url.pathname === "/__stats" && req.method === "POST") {
      state.statsEvents = (body.events as Record<string, unknown>[]) ?? [];
      return send(res, 204);
    }
    if (url.pathname === "/__turnstile" && req.method === "POST") {
      if (state.turnstile === "down") return send(res, 503, {});
      if (state.turnstile === "ok") return send(res, 200, { success: true });
      const code = { duplicate: "timeout-or-duplicate", invalid: "invalid-input-response", internal: "internal-error" }[state.turnstile] ?? "invalid-input-response";
      return send(res, 200, { success: false, "error-codes": [code] });
    }
    if (url.pathname === "/__n8n_events" && req.method === "POST") {
      if (state.ledgerDown) return send(res, 503, { message: "n8n arrêté" });
      if (req.headers.authorization !== "Bearer e2e-n8n-token") return send(res, 403, {});
      const events = (body.events as Record<string, unknown>[]) ?? [];
      let inserted = 0;
      for (const e of events) {
        if (state.ledger.some((r) => r.event_key === e.event_key)) continue;
        state.ledger.push({ id: state.ledger.length + 1, ...e, createdAt: new Date().toISOString() });
        inserted++;
      }
      const ids = new Set(events.map((e) => e.contact_id));
      return send(res, 200, { ok: true, inserted, rows: state.ledger.filter((r) => ids.has(r.contact_id)) });
    }

    state.requests.push(`${req.method} ${url.pathname}`);
    if (req.headers["api-key"] !== MOCK_API_KEY) return send(res, 401, { code: "unauthorized", message: "Key not found" });

    if (url.pathname === "/v3/account" && req.method === "GET") {
      return send(res, 200, { plan: [{ type: "free", credits: state.credits, creditsType: "sendLimit" }] });
    }
    if (url.pathname === "/v3/contacts" && req.method === "GET") {
      return send(res, 200, { contacts: state.contacts, count: state.contacts.length });
    }
    const m = url.pathname.match(/^\/v3\/contacts\/([^/]+)$/);
    if (m && req.method === "GET") {
      const c = find(m[1], url.searchParams.get("identifierType"));
      return c ? send(res, 200, c) : send(res, 404, { code: "document_not_found", message: "Contact does not exist" });
    }
    if (m && req.method === "PUT") {
      const c = find(m[1], url.searchParams.get("identifierType"));
      if (!c) return send(res, 404, { code: "document_not_found" });
      merge(c, body.attributes as Record<string, unknown>);
      if (typeof body.emailBlacklisted === "boolean") c.emailBlacklisted = body.emailBlacklisted;
      return send(res, 204);
    }
    if (url.pathname === "/v3/contacts" && req.method === "POST") {
      const email = String(body.email ?? "").toLowerCase();
      const attrs = (body.attributes ?? {}) as Record<string, unknown>;
      const existing = state.contacts.find((c) => c.email === email);
      if (attrs.SMS && smsOwner(attrs.SMS, existing?.id)) {
        return send(res, 400, { code: "duplicate_parameter", message: "Unable to update contact, SMS is already associated with another Contact" });
      }
      const listIds = (body.listIds as number[]) ?? [];
      if (existing) {
        if (!body.updateEnabled) return send(res, 400, { code: "duplicate_parameter", message: "Contact already exist" });
        merge(existing, attrs);
        if (typeof body.emailBlacklisted === "boolean") existing.emailBlacklisted = body.emailBlacklisted;
        existing.listIds = [...new Set([...existing.listIds, ...listIds])];
        return send(res, 204);
      }
      const c: MockContact = { id: nextId++, email, emailBlacklisted: false, listIds: [...listIds], attributes: {} };
      merge(c, attrs);
      if (typeof body.emailBlacklisted === "boolean") c.emailBlacklisted = body.emailBlacklisted;
      state.contacts.push(c);
      return send(res, 201, { id: c.id });
    }
    if (url.pathname === "/v3/smtp/email" && req.method === "POST") {
      const email = body as unknown as MockEmail;
      if (state.sendFailStatus) {
        const status = state.sendFailStatus;
        state.sendFailStatus = 0;
        return send(res, status, { code: status === 400 ? "invalid_parameter" : "unauthorized", message: "refus simulé" });
      }
      const drop = state.dropResponses > 0;
      if (drop) state.dropResponses--;
      const key = email.headers?.idempotencyKey;
      const seen = key ? idempotencyKeys.get(key) : undefined;
      if (seen !== undefined && clock() - seen < state.idemTtlMs) {
        if (drop) return void req.socket.destroy();
        return send(res, 400, { code: "duplicate_parameter", message: "Email for the idempotency key has already been processed" });
      }
      if (key) idempotencyKeys.set(key, clock());
      email.messageId = `<mock-${state.emails.length + 1}@smtp>`;
      email.acceptedAt = clock();
      state.emails.push(email);
      if (drop) return void req.socket.destroy(); // email accepté, réponse perdue
      return send(res, 201, { messageId: email.messageId });
    }
    if (url.pathname === "/v3/smtp/statistics/events" && req.method === "GET") {
      const event = url.searchParams.get("event");
      return send(res, 200, { events: state.statsEvents.filter((e) => !event || e.event === event) });
    }
    if (url.pathname === "/v3/smtp/emails" && req.method === "GET") {
      if (state.journalDown) return send(res, 503, { code: "unavailable" });
      if (state.journalStrictDates) {
        const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
        for (const k of ["startDate", "endDate"]) {
          const v = url.searchParams.get(k);
          if (v && v > today) return send(res, 400, { code: "invalid_parameter", message: "Start/End date should not be greater than current date" });
        }
      }
      const email = url.searchParams.get("email");
      const tpl = url.searchParams.get("templateId");
      const mid = url.searchParams.get("messageId");
      const visible = state.emails.filter(
        (e) =>
          (!email || e.to[0]?.email === email) &&
          (!tpl || String(e.templateId) === tpl) &&
          (!mid || e.messageId === mid) &&
          (e.acceptedAt ?? 0) <= clock() - state.journalDelayMs
      );
      return send(res, 200, {
        count: visible.length,
        transactionalEmails: visible.map((e) => ({ email: e.to[0]?.email, templateId: e.templateId, messageId: e.messageId, tags: e.tags, date: new Date(e.acceptedAt ?? 0).toISOString() })),
      });
    }
    if (url.pathname === "/v3/events" && req.method === "POST") {
      state.events.push(body as MockState["events"][number]);
      return send(res, 204);
    }
    return send(res, 404, { code: "not_found" });
  });

  return new Promise<{ close: () => void }>((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve({ close: () => server.close() }))
  );
}

// Lancement direct : npx tsx tests/e2e/mock-brevo.ts
if (process.argv[1]?.endsWith("mock-brevo.ts")) {
  startMockBrevo(Number(process.env.MOCK_BREVO_PORT ?? 4010)).then(() =>
    console.log(`Faux Brevo sur http://127.0.0.1:${process.env.MOCK_BREVO_PORT ?? 4010}/v3`)
  );
}
