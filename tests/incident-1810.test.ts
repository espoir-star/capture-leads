/**
 * Incident #1810 (11/10/2026) : deux guides acceptés, aucun email.
 *  1. Le journal Brevo répond « HTTP 200 {} » pour une adresse sans historique ;
 *     le code déployé exigeait une liste → UNKNOWN → aucun POST /smtp/email.
 *  2. La maintenance plantait (« reading 'trim' ») sur une fiche Brevo sans email,
 *     donc les demandes en attente n'étaient jamais reprises.
 *  3. Une reprise tardive ne doit pas déclencher la relance J+2 dans la foulée.
 * Le faux Brevo reproduit la réponse réelle observée (tests/e2e/mock-brevo.ts).
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { startMockBrevo, MOCK_API_KEY, type MockState } from "./e2e/mock-brevo";

const PORT = 4523;
const URL = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${URL}/v3`;
process.env.N8N_SEQUENCE_WEBHOOK_URL = `${URL}/__n8n`;
process.env.N8N_WEBHOOK_TOKEN = "test-only-incident";
process.env.SIGNING_SECRET = "test-only-incident-signing";
process.env.SITE_URL = "https://site.test";
process.env.ALTHOCE_MULTI_GUIDES = "qa";
process.env.ALTHOCE_SEQUENCE_QA_EMAILS = "qa-incident@cabinet.test";

let server: { close: () => void };
let store: typeof import("@/lib/guides/store");
let requests: typeof import("@/lib/guides/requests");
let config: typeof import("@/config/multiGuides");
let run: typeof import("@/lib/sequences/run");
let enr: typeof import("@/lib/sequences/enrollment");
const EC = "12-cas-usage-experts-comptables", PL = "guide-claude-pennylane";
const T = new Date("2026-10-11T19:40:24.585Z");
const MIN = 60_000, H = 3_600_000;
const state = async (): Promise<MockState> => (await fetch(`${URL}/__state`)).json();
const seed = async (body: object) => (await (await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify(body) })).json()).id as number;
const seedQa = (attributes: object) => seed({ email: "qa-incident@cabinet.test", listIds: [], attributes: { EMAIL_STATUS: "PENDING", MARKETING_STATUS: "B2B_ELIGIBLE", ...attributes } });
const build = (slug: string, now: Date, timeScale?: number) => requests.buildGuideRequest(null, { slug, now, queued: true, enroll: true, timeScale });

before(async () => {
  server = await startMockBrevo(PORT);
  requests = await import("@/lib/guides/requests");
  config = await import("@/config/multiGuides");
  store = await import("@/lib/guides/store");
  run = await import("@/lib/sequences/run");
  enr = await import("@/lib/sequences/enrollment");
});
after(() => server.close());
beforeEach(async () => { await fetch(`${URL}/__reset`, { method: "POST" }); });

test("#1810 : le faux Brevo renvoie le journal vide réel (HTTP 200 « {} »)", async () => {
  const res = await fetch(`${URL}/v3/smtp/emails?email=qa-incident%40cabinet.test&limit=500&offset=0&sort=desc`, { headers: { "api-key": MOCK_API_KEY } });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "{}");
});

test("#1810 : adresse neuve, deux guides à 23 s d'écart → deux envois immédiats et deux reçus", async () => {
  const ec = build(EC, T, 120), pl = build(PL, new Date(T.getTime() + 22_735), 120);
  const id = await seedQa({ ...ec.attributes, ...pl.attributes });
  const a = await store.processGuideRequest(id, EC, T);
  const b = await store.processGuideRequest(id, PL, new Date(T.getTime() + 22_735));
  assert.equal(a.delivery, "sent");
  assert.equal(b.delivery, "sent");
  const s = await state();
  assert.equal(s.emails.length, 2, "un email par guide, aucun bloqué par le journal vide");
  assert.notEqual(s.emails[0].params.GUIDE_URL, s.emails[1].params.GUIDE_URL);
  const c = s.contacts[0];
  for (const slug of [EC, PL]) {
    const receipt = store.readGuideReceipt(c.attributes[config.guideStateFields(slug).sent]);
    assert.equal(receipt?.status, "SENT", `reçu ${slug}`);
  }
});

test("#1810 : une fiche Brevo sans email ne fait plus échouer la maintenance multi-guides", async () => {
  await seed({ email: null, attributes: { SMS: "33600000000" } });
  const id = await seedQa(build(EC, T, 120).attributes);
  const report = await store.maintainMultiGuides(new Date(T.getTime() + H), { budgetMs: 25_000 });
  assert.equal(report.failed, 0);
  assert.equal(report.processed, 1);
  const s = await state();
  assert.equal(s.emails.length, 1, "la demande en attente est livrée");
  assert.equal(s.contacts.find((c) => c.id === id)!.attributes.GUIDES_COUNT, 1);
  assert.equal(config.multiGuidesEnabled(undefined, { ALTHOCE_MULTI_GUIDES: "qa", ALTHOCE_SEQUENCE_QA_EMAILS: "x@y.fr" }), false);
  assert.equal(config.multiGuidesEnabled(null, { ALTHOCE_MULTI_GUIDES: "on" }), false);
  assert.equal(config.multiGuidesEnabled("", { ALTHOCE_MULTI_GUIDES: "on" }), false);
});

test("#1810 : reprise en retard → la relance J+2 part de la livraison réelle, jamais dans la foulée", async () => {
  const scale = 120; // mode QA de production : J+2 = 24 min
  const id = await seedQa(build(EC, T, scale).attributes);
  const late = new Date(T.getTime() + 75 * MIN); // la J+2 « théorique » (T + 24 min) est déjà passée
  const r = await store.processGuideRequest(id, EC, late);
  assert.deepEqual(r, { delivery: "sent", enrollment: "enrolled" });
  const s = await state();
  const body = s.n8n[0].body as { enrollmentId: string; at: string };
  assert.equal(Date.parse(body.at), late.getTime() + (48 * H) / scale, "relance planifiée 24 min après la livraison");
  const signed = enr.verifyEnrollment(body.enrollmentId)!;
  assert.equal(signed.t, T.getTime(), "identité de l'inscription inchangée (date de demande)");
  assert.equal(signed.d, late.getTime());
  // Un appel prématuré (n8n rejoué juste après la livraison) n'envoie rien.
  assert.deepEqual(await run.runStep(body.enrollmentId, "relance-j2", new Date(late.getTime() + MIN)),
    { action: "wait", stepId: "relance-j2", at: body.at });
  assert.equal((await state()).emails.length, 1);
  assert.deepEqual(await run.runStep(body.enrollmentId, "relance-j2", new Date(Date.parse(body.at))), { action: "done", reason: "completed" });
  assert.equal((await state()).emails.length, 2, "guide puis une seule relance");
});

test("#1810 : livraison immédiate → inscription inchangée (pas d'ancre de livraison)", async () => {
  const id = await seedQa(build(PL, T).attributes);
  await store.processGuideRequest(id, PL, new Date(T.getTime() + 2_000));
  const body = (await state()).n8n[0].body as { enrollmentId: string; at: string };
  assert.equal(enr.verifyEnrollment(body.enrollmentId)!.d, undefined);
  assert.equal(Date.parse(body.at), T.getTime() + 48 * H);
});

test("#1810 : production (sans accélération), guide repris à J+1 → relance à J+3, pas à J+2", async () => {
  const id = await seedQa(build(PL, T).attributes);
  const late = new Date(T.getTime() + 30 * H);
  await store.processGuideRequest(id, PL, late);
  const body = (await state()).n8n[0].body as { at: string };
  assert.equal(Date.parse(body.at), late.getTime() + 48 * H);
});
