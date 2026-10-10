/**
 * Faux Brevo (API v3) en mémoire pour les tests de bout en bout.
 * Reproduit les comportements utilisés par l'application :
 *   GET  /v3/contacts/:id(email|contact_id)   POST /v3/contacts (updateEnabled)
 *   PUT  /v3/contacts/:id                      POST /v3/events
 *   POST /v3/smtp/email (en-tête idempotencyKey : 2e envoi refusé, comme Brevo)
 *   unicité de l'attribut SMS (duplicate_parameter), listes cumulées.
 *   GET  /v3/account (crédits d'envoi du jour)  GET /v3/contacts (liste, modifiedSince ignoré)
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
}

const emptyState = (): MockState => ({ contacts: [], events: [], requests: [], emails: [], n8n: [], ledger: [], credits: 300, ledgerDown: false });

export const MOCK_API_KEY = "mock-key-e2e";

export function startMockBrevo(port: number) {
  let state: MockState = emptyState();
  let idempotencyKeys = new Set<string>();
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
      req.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const body = req.method === "GET" ? {} : await readBody(req);

    if (url.pathname === "/__state") return send(res, 200, state);
    if (url.pathname === "/__reset") {
      state = emptyState();
      idempotencyKeys = new Set();
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
      if (typeof body.credits === "number") state.credits = body.credits;
      if (typeof body.ledgerDown === "boolean") state.ledgerDown = body.ledgerDown;
      return send(res, 204);
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
      const key = email.headers?.idempotencyKey;
      if (key && idempotencyKeys.has(key)) {
        return send(res, 400, { code: "duplicate_parameter", message: "Email for the idempotency key has already been processed" });
      }
      if (key) idempotencyKeys.add(key);
      state.emails.push(email);
      return send(res, 201, { messageId: `<mock-${state.emails.length}@smtp>` });
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
