/**
 * Livraison durable (lib/sequences/delivery.ts) : une livraison dont l'envoi
 * immédiat (after()) a été interrompu est reprise par la tâche horaire, sans
 * jamais envoyer deux fois le guide.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MOCK_API_KEY, startMockBrevo, type MockState } from "./e2e/mock-brevo";

const PORT = 4013;
const MOCK = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${MOCK}/v3`;
process.env.SIGNING_SECRET = "secret-tests-livraison";
process.env.SITE_URL = "https://site.test";

let server: { close: () => void };
let delivery: typeof import("@/lib/sequences/delivery");
let run: typeof import("@/lib/sequences/run");
before(async () => {
  server = await startMockBrevo(PORT);
  delivery = await import("@/lib/sequences/delivery");
  run = await import("@/lib/sequences/run");
});
after(() => server.close());
beforeEach(async () => {
  await fetch(`${MOCK}/__reset`, { method: "POST" });
});

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const configure = (c: Record<string, number | boolean>) => fetch(`${MOCK}/__config`, { method: "POST", body: JSON.stringify(c) });
const MIN = 60_000;
const NOW = new Date();
const seedPending = async (email: string, ageMs: number, ref?: string) => {
  const at = new Date(NOW.getTime() - ageMs);
  const attributes: Record<string, unknown> = { EMAIL_STATUS: "PENDING", ...delivery.pendingDeliveryAttributes("guide-12-cas-ec-v1", "12-cas-usage-experts-comptables", at) };
  if (ref !== undefined) attributes.GUIDE_DELIVERY_REF = ref;
  const r = await fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify({ email, attributes }) });
  return { id: (await r.json()).id as number, at };
};
const statusOf = async (id: number) => (await state()).contacts.find((c) => c.id === id)!.attributes.GUIDE_DELIVERY_STATUS;

test("tâche écrite avec le contact : PENDING + référence séquence|guide|date", () => {
  const a = delivery.pendingDeliveryAttributes("guide-12-cas-ec-v1", "12-cas-usage-experts-comptables", new Date("2026-10-11T08:00:00Z"));
  assert.deepEqual(a, { GUIDE_DELIVERY_STATUS: "PENDING", GUIDE_DELIVERY_REF: "guide-12-cas-ec-v1|12-cas-usage-experts-comptables|2026-10-11T08:00:00.000Z" });
  assert.equal(delivery.parseDeliveryRef(a.GUIDE_DELIVERY_REF)?.slug, "12-cas-usage-experts-comptables");
  assert.equal(delivery.parseDeliveryRef("n'importe quoi"), null);
});

test("envoi immédiat interrompu : la tâche horaire livre UNE fois, puis plus rien", async () => {
  const { id } = await seedPending("interrompu@cabinet.fr", 30 * MIN);
  const r1 = await delivery.retryPendingDeliveries(NOW);
  assert.equal(r1.sent, 1);
  assert.equal(await statusOf(id), "SENT");
  const r2 = await delivery.retryPendingDeliveries(NOW);
  assert.equal(r2.checked, 0);
  const s = await state();
  assert.equal(s.emails.length, 1);
  assert.equal(s.emails[0].templateId, 35, "modèle de livraison du pilote");
});

test("email déjà parti mais statut resté PENDING (coupure après l'envoi) : retrouvé au journal, pas renvoyé", async () => {
  const { id, at } = await seedPending("coupure@cabinet.fr", 30 * MIN);
  const pilot = (await import("@/config/sequences")).SEQUENCES["guide-12-cas-ec-v1"];
  await run.deliverGuide({ seq: pilot, contactId: id, email: "coupure@cabinet.fr", slug: "12-cas-usage-experts-comptables", emailStatus: "PENDING", now: at });
  await configure({ idemTtlMs: 0 }); // idempotence Brevo expirée : seul le journal protège
  const r = await delivery.retryPendingDeliveries(NOW);
  assert.equal(r.alreadySent, 1);
  assert.equal(await statusOf(id), "SENT");
  assert.equal((await state()).emails.length, 1);
});

test("tâche trop récente (envoi immédiat peut-être en cours), expirée (> 72 h) ou invalide", async () => {
  const recent = await seedPending("recent@cabinet.fr", 3 * MIN);
  const old = await seedPending("ancien@cabinet.fr", 4 * 24 * 60 * MIN);
  const broken = await seedPending("casse@cabinet.fr", 30 * MIN, "pas-une-reference");
  const r = await delivery.retryPendingDeliveries(NOW);
  assert.deepEqual({ expired: r.expired, invalid: r.invalid, sent: r.sent }, { expired: 1, invalid: 1, sent: 0 });
  assert.equal(await statusOf(recent.id), "PENDING");
  assert.equal(await statusOf(old.id), "EXPIRED");
  assert.equal(await statusOf(broken.id), "FAILED");
  assert.equal((await state()).emails.length, 0);
});

test("Brevo refuse l'envoi : la tâche reste PENDING, livrée à la reprise suivante", async () => {
  const { id } = await seedPending("panne@cabinet.fr", 30 * MIN);
  await configure({ sendFailStatus: 401 });
  const r1 = await delivery.retryPendingDeliveries(NOW);
  assert.equal(r1.stillPending, 1);
  assert.equal(await statusOf(id), "PENDING");
  const r2 = await delivery.retryPendingDeliveries(NOW);
  assert.equal(r2.sent, 1);
  assert.equal((await state()).emails.length, 1);
});
