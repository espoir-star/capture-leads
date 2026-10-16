/**
 * Incident du 12/10/2026 à 00:07 (heure de Paris) : la réconciliation des clics
 * demandait endDate = jour parisien (déjà le lendemain) et Brevo répondait 400.
 * Le faux Brevo applique la même règle que le vrai : pas de date au-delà du jour UTC.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startMockBrevo, MOCK_API_KEY } from "./e2e/mock-brevo";

const PORT = 4531;
const URL = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${URL}/v3`;
process.env.N8N_EVENTS_WEBHOOK_URL = `${URL}/__n8n_events`;
process.env.N8N_WEBHOOK_TOKEN = "e2e-n8n-token";
process.env.SIGNING_SECRET = "test-only-clicks";

let server: { close: () => void };
let clicks: typeof import("@/lib/scoring/clicks");
before(async () => {
  server = await startMockBrevo(PORT);
  clicks = await import("@/lib/scoring/clicks");
});
after(() => server.close());
beforeEach(async () => { await fetch(`${URL}/__reset`, { method: "POST" }); });

test("faux Brevo : une date au-delà du jour UTC est refusée comme par le vrai (400)", async () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(`${URL}/v3/smtp/statistics/events?event=clicks&startDate=${tomorrow}&endDate=${tomorrow}`, { headers: { "api-key": MOCK_API_KEY } });
  assert.equal(res.status, 400);
});

test("réconciliation des clics à 00:30 heure de Paris (22:30 UTC) : aucune erreur, clic rattrapé", async () => {
  const utcToday = new Date().toISOString().slice(0, 10);
  const parisAfterMidnight = new Date(`${utcToday}T22:30:00Z`); // à Paris : déjà le lendemain
  const sentAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const clickAt = new Date(Date.now() - 3_600_000).toISOString();
  await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify({ email: "nuit@cabinet.fr", attributes: { LEAD_SCORE: 5 } }) });
  await fetch(`${URL}/__stats`, { method: "POST", body: JSON.stringify({ events: [
    { event: "requests", email: "nuit@cabinet.fr", messageId: "<m-nuit@relay>", date: sentAt, templateId: 43 },
    { event: "clicks", email: "nuit@cabinet.fr", messageId: "<m-nuit@relay>", date: clickAt, templateId: 43, link: "https://cal.com/althoce-conseil-4ncbuz/30min" },
  ] }) });
  const report = await clicks.reconcileTransactionalClicks(parisAfterMidnight);
  assert.equal(report.candidates, 1);
  assert.equal(report.inserted, 1);
});

test("passe horaire : clics déjà journalisés = aucune relecture ni réécriture de score (incident du 16/10)", async () => {
  const sentAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const clickAt = new Date(Date.now() - 3_600_000).toISOString();
  const emails = ["a@cabinet.fr", "b@cabinet.fr", "c@cabinet.fr"];
  for (const email of emails) await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify({ email, attributes: { LEAD_SCORE: 5 } }) });
  await fetch(`${URL}/__stats`, { method: "POST", body: JSON.stringify({ events: emails.flatMap((email, i) => [
    { event: "requests", email, messageId: `<m-${i}@relay>`, date: sentAt, templateId: 43 },
    { event: "clicks", email, messageId: `<m-${i}@relay>`, date: clickAt, templateId: 43, link: "https://cal.com/althoce-conseil-4ncbuz/30min" },
  ]) }) });
  const first = await clicks.reconcileTransactionalClicks(new Date());
  assert.equal(first.inserted, 3);
  const before = ((await (await fetch(`${URL}/__state`)).json()) as { requests: string[] }).requests.length;
  const second = await clicks.reconcileTransactionalClicks(new Date());
  assert.equal(second.recorded, 3);
  assert.equal(second.inserted, 0);
  const calls = ((await (await fetch(`${URL}/__state`)).json()) as { requests: string[] }).requests.slice(before);
  // 2 lectures du journal + 3 recherches de contact, aucune relecture par ID ni écriture (PUT).
  assert.equal(calls.filter((c) => c.startsWith("PUT ")).length, 0);
  assert.equal(calls.length, 5);
});

test("passe horaire : heure limite atteinte → clics reportés, sans erreur", async () => {
  const clickAt = new Date(Date.now() - 3_600_000).toISOString();
  await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify({ email: "tard@cabinet.fr", attributes: {} }) });
  await fetch(`${URL}/__stats`, { method: "POST", body: JSON.stringify({ events: [
    { event: "requests", email: "tard@cabinet.fr", messageId: "<m-tard@relay>", date: new Date(Date.now() - 7_200_000).toISOString(), templateId: 43 },
    { event: "clicks", email: "tard@cabinet.fr", messageId: "<m-tard@relay>", date: clickAt, templateId: 43, link: "https://cal.com/althoce-conseil-4ncbuz/30min" },
  ] }) });
  const report = await clicks.reconcileTransactionalClicks(new Date(), { deadline: Date.now() - 1 });
  assert.equal(report.deferred, 1);
  assert.equal(report.recorded, 0);
});
