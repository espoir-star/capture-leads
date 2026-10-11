import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startMockBrevo, MOCK_API_KEY, type MockState } from "./e2e/mock-brevo";

const URL = "http://127.0.0.1:4513";
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${URL}/v3`;
process.env.N8N_SEQUENCE_WEBHOOK_URL = `${URL}/__n8n`;
process.env.N8N_WEBHOOK_TOKEN = "test-only-edges";
process.env.SIGNING_SECRET = "test-only-edges-signing";
process.env.SITE_URL = "https://site.test";
process.env.ALTHOCE_MULTI_GUIDES = "qa";
process.env.ALTHOCE_SEQUENCE_QA_EMAILS = "qa-edges@cabinet.test";
let server: { close: () => void };
let requests: typeof import("@/lib/guides/requests");
let store: typeof import("@/lib/guides/store");
let interests: typeof import("@/lib/guides/interests");
const A = "guide-claude-pennylane", B = "guide-claude-meta-ads";
const T = new Date("2026-10-11T12:00:00Z");
const state = async (): Promise<MockState> => (await fetch(`${URL}/__state`)).json();
before(async () => {
  server = await startMockBrevo(4513);
  requests = await import("@/lib/guides/requests");
  store = await import("@/lib/guides/store");
  interests = await import("@/lib/guides/interests");
});
after(() => server.close());

test("multi-guides : ressource historique plus récente conservée pendant la transition", () => {
  const a = requests.buildGuideRequest(null, { slug: A, now: T, queued: true, enroll: true });
  const s = interests.summarizeGuideInterests({ listIds: [], attributes: { ...a.attributes, RESSOURCE: B } });
  assert.equal(s.distinctCount, 2);
  assert.equal(s.latestSlug, B);
  assert.deepEqual(s.guides.find((g) => g.slug === B)!.evidence, ["latest_resource"]);
});

test("multi-guides : ordre de réponses CRM ne décide pas du dernier guide daté", () => {
  const a = requests.buildGuideRequest(null, { slug: A, now: T, queued: true, enroll: true });
  const b = requests.buildGuideRequest(null, { slug: B, now: new Date(T.getTime() + 60000), queued: true, enroll: true });
  const s = interests.summarizeGuideInterests({ listIds: [], attributes: { ...a.attributes, ...b.attributes, RESSOURCE: A } });
  assert.equal(s.distinctCount, 2);
  assert.equal(s.latestSlug, B);
});

test("multi-guides : n8n indisponible, guide reçu puis inscription reprise sans renvoi", async () => {
  const a = requests.buildGuideRequest(null, { slug: A, now: T, queued: true, enroll: true });
  const id = (await (await fetch(`${URL}/__seed`, { method: "POST", body: JSON.stringify({ email: "qa-edges@cabinet.test", attributes: { EMAIL_STATUS: "PENDING", MARKETING_STATUS: "B2B_ELIGIBLE", ...a.attributes } }) })).json()).id as number;
  const original = process.env.N8N_SEQUENCE_WEBHOOK_URL;
  try {
    process.env.N8N_SEQUENCE_WEBHOOK_URL = "http://127.0.0.1:4514/unavailable";
    const result = await store.processGuideRequest(id, A, T);
    assert.equal(result.delivery, "sent");
    assert.equal(result.enrollment, "pending");
    assert.equal((await state()).emails.length, 1);
    assert.equal((await state()).n8n.length, 0);
  } finally { process.env.N8N_SEQUENCE_WEBHOOK_URL = original; }
  await store.maintainMultiGuides(new Date(T.getTime() + 3600000));
  assert.equal((await state()).emails.length, 1);
  assert.equal((await state()).n8n.length, 1);
});
