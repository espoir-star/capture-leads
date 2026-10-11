import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOCK_API_KEY, startMockBrevo, type MockState } from "./e2e/mock-brevo";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
import { getRessource } from "@/lib/ressources";

// API factice uniquement : aucun appel Brevo ni contact réel.
const PORT = 4119;
const MOCK = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${MOCK}/v3`;
process.env.SIGNING_SECRET = "multi-guide-delivery-tests-only";
process.env.SITE_URL = "https://site.test";

let server: { close: () => void };
let run: typeof import("@/lib/sequences/run");
before(async () => {
  server = await startMockBrevo(PORT);
  run = await import("@/lib/sequences/run");
});
after(() => server.close());

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const reset = () => fetch(`${MOCK}/__reset`, { method: "POST" });
const email = "multi-guide@cabinet.test";
async function seed(): Promise<number> {
  const res = await fetch(`${MOCK}/__seed`, {
    method: "POST",
    body: JSON.stringify({ email, listIds: [6, 7], attributes: { EMAIL_STATUS: "PENDING", MARKETING_STATUS: "B2B_ELIGIBLE" } }),
  });
  return (await res.json()).id;
}
const slugs = ["guide-claude-pennylane", "guide-claude-meta-ads"] as const;
const now = new Date("2026-10-11T09:00:00Z");
function deliver(slug: typeof slugs[number], contactId: number) {
  return run.deliverGuide({ seq: getSequence(LEAD_MAGNETS[slug].sequence)!, contactId, email, slug, emailStatus: "PENDING", now });
}

function assertTwoCorrectGuides(s: MockState) {
  assert.equal(s.contacts.length, 1, "un seul contact");
  assert.equal(s.emails.length, 2, "une livraison pour chacun des deux guides");
  assert.deepEqual(new Set(s.emails.map((e) => e.params.GUIDE_URL)), new Set(slugs.map((slug) => getRessource(slug)!.urlRessource)));
  for (const e of s.emails) {
    assert.equal(e.templateId, 37, "même modèle générique réutilisé");
    assert.match(e.params.UNSUBSCRIBE_URL, /^https:\/\/site\.test\/desinscription\?t=m1\./);
  }
  assert.equal(new Set(s.emails.map((e) => e.headers.idempotencyKey)).size, 2, "clés différentes entre ressources");
}

test("multi-guide : le même contact reçoit deux guides génériques distincts le même jour", async () => {
  await reset();
  const id = await seed();
  assert.equal((await deliver(slugs[0], id)).status, "sent");
  assert.equal((await deliver(slugs[1], id)).status, "sent");
  assertTwoCorrectGuides(await state());
  assert.equal((await deliver(slugs[0], id)).status, "duplicate");
  assert.equal((await deliver(slugs[1], id)).status, "duplicate");
  assertTwoCorrectGuides(await state());
});

test("multi-guide : livraisons simultanées A et B et replays ne fusionnent pas les ressources", async () => {
  await reset();
  const id = await seed();
  const outcomes = await Promise.all([deliver(slugs[0], id), deliver(slugs[1], id), deliver(slugs[0], id), deliver(slugs[1], id)]);
  assert.ok(outcomes.every((out) => out.status === "sent" || out.status === "duplicate"));
  assertTwoCorrectGuides(await state());
});
