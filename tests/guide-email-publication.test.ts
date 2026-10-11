import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { GUIDE_EMAIL_PUBLICATIONS, guideEmailPublication, type GuideEmailKey } from "@/config/guideEmailPublications";
import { startMockBrevo, MOCK_API_KEY, type MockState } from "./e2e/mock-brevo";

const PORT = 4397;
const BASE = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${BASE}/v3`;
let server: { close: () => void };
let sending: typeof import("@/lib/brevo/sendOnce");
before(async () => { server = await startMockBrevo(PORT); sending = await import("@/lib/brevo/sendOnce"); });
after(() => server.close());
const state = async (): Promise<MockState> => (await fetch(`${BASE}/__state`)).json();
const reset = () => fetch(`${BASE}/__reset`, { method: "POST" });
const now = () => new Date();
const input = (templateId: number, sendKey: string, at: Date) => ({
  to: { email: "publication@qa.test" }, templateId, sendKey,
  params: { GUIDE_URL: "https://example.test/guide", UNSUBSCRIBE_URL: "https://example.test/optout" },
  tags: ["test-guide-publication"], since: at, now: at, recheckDelayMs: 0,
});

test("publication : quatre IDs Brevo réels, bascule explicite et retour arrière", () => {
  const ids: number[] = [];
  for (const key of Object.keys(GUIDE_EMAIL_PUBLICATIONS) as GuideEmailKey[]) {
    const p = GUIDE_EMAIL_PUBLICATIONS[key];
    assert.deepEqual(guideEmailPublication(key, "1"), { id: p.legacyId, name: p.name });
    assert.deepEqual(guideEmailPublication(key, ""), { id: p.legacyId, name: p.name });
    assert.deepEqual(guideEmailPublication(key, "2"), { id: p.publishedId, name: `${p.name} · Conseil IA v2` });
    ids.push(p.publishedId);
  }
  assert.deepEqual(ids, [41, 42, 43, 44]);
});

test("publication : ancien modèle puis nouveau après expiration idempotence, aucun deuxième email", async () => {
  await reset();
  const t = now();
  const key = sending.sendKeyOf("test-publication", 1, "guide-a");
  assert.equal((await sending.sendOnce(input(35, key, t))).status, "SENT");
  await fetch(`${BASE}/__config`, { method: "POST", body: JSON.stringify({ clockOffsetMs: 2 * 3_600_000 }) });
  const replay = await sending.sendOnce({ ...input(41, key, new Date(t.getTime() + 2 * 3_600_000)), since: t });
  assert.equal(replay.status, "SENT");
  assert.ok(replay.status === "SENT" && replay.via === "journal");
  assert.equal((await state()).emails.length, 1);
});

test("publication : deux guides différents restent deux envois, même après changement de modèle", async () => {
  await reset();
  const t = now();
  await sending.sendOnce(input(37, sending.sendKeyOf("test-publication", 1, "guide-a"), t));
  await sending.sendOnce(input(43, sending.sendKeyOf("test-publication", 1, "guide-b"), t));
  assert.equal((await state()).emails.length, 2);
});

test("publication : pagination du journal, preuve sur la deuxième page tous modèles confondus", async (t) => {
  const key = sending.sendKeyOf("pagination");
  const offsets: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const u = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
    assert.equal(u.searchParams.has("templateId"), false);
    const offset = u.searchParams.get("offset") ?? "0";
    offsets.push(offset);
    const transactionalEmails = offset === "0"
      ? Array.from({ length: 500 }, (_, i) => ({ messageId: `other-${i}`, tags: [] }))
      : [{ messageId: "old-template-proof", tags: [sending.sendKeyTag(key)] }];
    return new Response(JSON.stringify({ count: 501, transactionalEmails }), { status: 200 });
  });
  const at = now();
  assert.equal((await sending.findSentEmail({ email: "qa@example.test", templateId: 43, sendKey: key, since: at, now: at }))?.messageId, "old-template-proof");
  assert.deepEqual(offsets, ["0", "500"]);
});

test("publication : journal malformé n'autorise aucun envoi", async (t) => {
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, options?: RequestInit) => {
    if (options?.method === "POST") sends++;
    return new Response("{}", { status: 200 });
  });
  const out = await sending.sendOnce(input(41, sending.sendKeyOf("invalid-journal"), now()));
  assert.equal(out.status, "UNKNOWN");
  assert.equal(sends, 0);
});

test("publication : page tronquée n'est pas assimilée à une absence d'envoi", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ count: 10, transactionalEmails: [] }), { status: 200 }));
  const at = now();
  await assert.rejects(sending.findSentEmail({ email: "qa@example.test", templateId: 41, sendKey: sending.sendKeyOf("truncated"), since: at, now: at }), /incomplète/);
});
