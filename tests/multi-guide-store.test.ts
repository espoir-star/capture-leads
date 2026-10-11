import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startMockBrevo, MOCK_API_KEY, type MockState } from "./e2e/mock-brevo";

const PORT = 4507;
const URL = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${URL}/v3`;
process.env.N8N_SEQUENCE_WEBHOOK_URL = `${URL}/__n8n`;
process.env.N8N_WEBHOOK_TOKEN = "test-only-multi-guide";
process.env.SIGNING_SECRET = "test-only-multi-guide-signing";
process.env.SITE_URL = "https://site.test";
process.env.ALTHOCE_MULTI_GUIDES = "qa";
process.env.ALTHOCE_SEQUENCE_QA_EMAILS = "qa-multi@cabinet.test";

let server: { close: () => void };
let store: typeof import("@/lib/guides/store");
let requests: typeof import("@/lib/guides/requests");
let config: typeof import("@/config/multiGuides");
let run: typeof import("@/lib/sequences/run");
let enr: typeof import("@/lib/sequences/enrollment");
const A = "guide-claude-pennylane", B = "guide-claude-meta-ads";
const T = new Date("2026-10-11T12:00:00Z");
const H = 3_600_000;
const state = async (): Promise<MockState> => (await fetch(`${URL}/__state`)).json();
const control = async (body: object) => fetch(`${URL}/__config`, { method: "POST", body: JSON.stringify(body) });
const patch = async (id: number, attributes: object, extras = {}) => fetch(`${URL}/v3/contacts/${id}?identifierType=contact_id`, { method: "PUT", headers: { "api-key": MOCK_API_KEY }, body: JSON.stringify({ attributes, ...extras }) });
const seed = async (attributes: object, emailBlacklisted = false) => (await (await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify({ email: "qa-multi@cabinet.test", attributes: { EMAIL_STATUS: "PENDING", MARKETING_STATUS: "B2B_ELIGIBLE", LEAD_SCORE: 12, ...attributes }, listIds: [], emailBlacklisted }) })).json()).id as number;
const build = (slug: string, now = T) => requests.buildGuideRequest(null, { slug, now, queued: true, enroll: true });

before(async () => {
  server = await startMockBrevo(PORT);
  requests = await import("@/lib/guides/requests");
  config = await import("@/config/multiGuides");
  store = await import("@/lib/guides/store");
  run = await import("@/lib/sequences/run");
  enr = await import("@/lib/sequences/enrollment");
});
after(() => server.close());
beforeEach(async () => { await fetch(`${URL}/__reset`, { method: "POST" }); process.env.ALTHOCE_MULTI_GUIDES = "qa"; });

test("multi-guides réel simulé : deux ressources simultanées, deux livraisons, un contact", async () => {
  const a = build(A), b = build(B);
  const id = await seed({ ...a.attributes, ...b.attributes });
  const results = await Promise.all([store.processGuideRequest(id, A, T), store.processGuideRequest(id, B, T)]);
  assert.ok(results.every((r) => r.delivery === "sent"));
  await store.refreshGuideSummary(id, T);
  const s = await state();
  assert.equal(s.contacts.length, 1);
  assert.equal(s.emails.length, 2);
  assert.equal(s.contacts[0].attributes.GUIDES_COUNT, 2);
  assert.equal(s.contacts[0].attributes.GUIDES_RECENT_30D, 2);
  assert.equal(s.contacts[0].attributes.LEAD_SCORE, 12, "pas de points artificiels");
  assert.notEqual(s.emails[0].params.GUIDE_URL, s.emails[1].params.GUIDE_URL);
});

test("multi-guides : cinq replays après livraison ne renvoient ni guide ni inscription n8n", async () => {
  const a = build(A), id = await seed(a.attributes);
  await store.processGuideRequest(id, A, T);
  const initial = await state();
  await Promise.all(Array.from({ length: 5 }, () => store.processGuideRequest(id, A, new Date(T.getTime() + H))));
  const s = await state();
  assert.equal(s.emails.length, 1);
  assert.equal(s.n8n.length, initial.n8n.length);
});

test("multi-guides : une panne pour B ne perd pas A ni la demande B", async () => {
  const a = build(A), b = build(B), id = await seed({ ...a.attributes, ...b.attributes });
  await store.processGuideRequest(id, A, T);
  await control({ journalDown: true });
  assert.equal((await store.processGuideRequest(id, B, T)).delivery, "pending");
  let s = await state();
  assert.equal(s.emails.length, 1);
  assert.ok(s.contacts[0].attributes[config.guideStateFields(B).request]);
  await control({ journalDown: false });
  const report = await store.maintainMultiGuides(new Date(T.getTime() + H), { budgetMs: 25000 });
  s = await state();
  assert.equal(s.emails.length, 2);
  assert.equal(report.failed, 0);
  assert.equal(s.contacts[0].attributes.GUIDES_COUNT, 2);
});

test("multi-guides : opposition après A, B est livré sans aucune relance", async () => {
  const a = build(A), b = build(B), id = await seed({ ...a.attributes, ...b.attributes });
  await store.processGuideRequest(id, A, T);
  await patch(id, { MARKETING_STATUS: "OPPOSED" }, { emailBlacklisted: true });
  const bResult = await store.processGuideRequest(id, B, T);
  assert.equal(bResult.delivery, "sent");
  assert.equal(bResult.enrollment, "skipped");
  const token = enr.signEnrollment({ s: a.record.sequenceId, c: id, t: T.getTime(), r: A })!;
  const follow = await run.runStep(token, "relance-j2", new Date(T.getTime() + 48 * H));
  assert.deepEqual(follow, { action: "done", reason: "marketing_not_allowed" });
  assert.equal((await state()).emails.length, 2);
});

test("multi-guides : seule la relance du dernier guide est envoyée", async () => {
  const a = build(A), b = build(B, new Date(T.getTime() + H));
  const id = await seed({ ...a.attributes, ...b.attributes });
  await store.processGuideRequest(id, A, T);
  await store.processGuideRequest(id, B, new Date(T.getTime() + H));
  const tokenA = enr.signEnrollment({ s: a.record.sequenceId, c: id, t: T.getTime(), r: A })!;
  const tokenB = enr.signEnrollment({ s: b.record.sequenceId, c: id, t: T.getTime() + H, r: B })!;
  assert.deepEqual(await run.runStep(tokenA, "relance-j2", new Date(T.getTime() + 48 * H)), { action: "done", reason: "multi_guide_consolidated" });
  assert.deepEqual(await run.runStep(tokenB, "relance-j2", new Date(T.getTime() + 49 * H)), { action: "done", reason: "completed" });
  const s = await state();
  assert.equal(s.emails.filter((e) => e.templateId === 38).length, 1);
  assert.equal(s.emails.length, 3, "deux guides et une seule relance");
});

test("multi-guides : ancienne automation tracée mais pas de second email", async () => {
  const a = requests.buildGuideRequest(null, { slug: A, now: T, queued: false, enroll: false });
  const id = await seed(a.attributes);
  assert.equal((await store.processGuideRequest(id, A, T)).delivery, "legacy");
  await store.refreshGuideSummary(id, T);
  assert.equal((await state()).emails.length, 0);
  assert.equal((await state()).contacts[0].attributes.GUIDES_COUNT, 1);
});

test("multi-guides : feature flag absent, aucun attribut ni envoi ajouté", async () => {
  const a = build(A), id = await seed(a.attributes);
  delete process.env.ALTHOCE_MULTI_GUIDES;
  assert.equal((await store.processGuideRequest(id, A, T)).delivery, "disabled");
  assert.equal(await store.refreshGuideSummary(id, T), false);
  assert.equal((await state()).emails.length, 0);
});

test("multi-guides : ancienne écriture SENT ne solde pas la nouvelle demande du même guide", async () => {
  const a = build(A), id = await seed(a.attributes);
  await store.processGuideRequest(id, A, T);
  const fields = config.guideStateFields(A);
  const oldReceipt = (await state()).contacts[0].attributes[fields.sent];
  const next = requests.buildGuideRequest({ attributes: a.attributes }, { slug: A, now: new Date(T.getTime() + 24 * H), queued: true, enroll: true });
  await patch(id, { ...next.attributes, [fields.sent]: oldReceipt });
  assert.equal((await store.processGuideRequest(id, A, new Date(T.getTime() + 24 * H))).delivery, "sent");
  assert.equal((await state()).emails.length, 2);
});
