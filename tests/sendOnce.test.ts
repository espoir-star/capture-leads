/**
 * Envoi unique (lib/brevo/sendOnce.ts) contre le faux Brevo : journal des
 * envois, idempotence à durée de vie limitée, horloge décalable, pannes.
 * Objectif : jamais deux emails pour une même clé.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { MOCK_API_KEY, startMockBrevo, type MockState } from "./e2e/mock-brevo";

const PORT = 4012;
const MOCK = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${MOCK}/v3`;

let server: { close: () => void };
let so: typeof import("@/lib/brevo/sendOnce");
let run: typeof import("@/lib/sequences/run");
let enrollment: typeof import("@/lib/sequences/enrollment");
before(async () => {
  process.env.SIGNING_SECRET = "secret-tests-envoi-unique";
  server = await startMockBrevo(PORT);
  so = await import("@/lib/brevo/sendOnce");
  run = await import("@/lib/sequences/run");
  enrollment = await import("@/lib/sequences/enrollment");
});
after(() => server.close());

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const configure = (c: Record<string, number | boolean>) => fetch(`${MOCK}/__config`, { method: "POST", body: JSON.stringify(c) });
const seed = async (c: Record<string, unknown>): Promise<number> =>
  (await (await fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify(c) })).json()).id;
beforeEach(async () => {
  await fetch(`${MOCK}/__reset`, { method: "POST" });
});

const MIN = 60_000;
const H = 60 * MIN;
const NOW = new Date("2026-10-12T09:00:00Z");
const posts = (s: MockState) => s.requests.filter((r) => r === "POST /v3/smtp/email").length;
const input = (sendKey: string, over: Partial<Parameters<typeof so.sendOnce>[0]> = {}) => ({
  to: { email: "qa@cabinet.fr" },
  templateId: 36,
  params: { GUIDE_TITLE: "Guide" },
  tags: ["seq:test"],
  sendKey,
  since: new Date(NOW.getTime() - H),
  now: NOW,
  recheckDelayMs: 50,
  ...over,
});

test("clé : empreinte stable sans donnée personnelle ; idempotencyKey au format UUID v4", () => {
  const k = so.sendKeyOf("step", "guide-12-cas-ec-v1", 42, "relance-j2");
  assert.match(k, /^[0-9a-f]{32}$/);
  assert.equal(k, so.sendKeyOf("step", "guide-12-cas-ec-v1", 42, "relance-j2"));
  assert.match(so.idempotencyUuid(k), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("premier envoi : SENT, messageId conservé, étiquette de clé posée", async () => {
  const k = so.sendKeyOf("t1");
  const phases: string[] = [];
  const out = await so.sendOnce(input(k, { onPhase: (p) => phases.push(p) }));
  assert.deepEqual(out, { status: "SENT", via: "sent", messageId: "<mock-1@smtp>", sendKey: k });
  assert.deepEqual(phases, ["PENDING", "SENDING", "SENT"]);
  const s = await state();
  assert.equal(s.emails.length, 1);
  assert.ok(s.emails[0].tags.includes(`k:${k}`));
  assert.equal(s.emails[0].headers.idempotencyKey, so.idempotencyUuid(k));
});

test("reprises après 30 min, 2 h et 24 h (idempotence Brevo expirée) : jamais de second email", async () => {
  await configure({ idemTtlMs: 15 * MIN }); // hypothèse basse de la doc Brevo
  const k = so.sendKeyOf("t2");
  assert.equal((await so.sendOnce(input(k))).status, "SENT");
  for (const delay of [30 * MIN, 2 * H, 24 * H]) {
    await configure({ clockOffsetMs: delay });
    const out = await so.sendOnce(input(k, { now: new Date(NOW.getTime() + delay) }));
    assert.equal(out.status, "SENT", `reprise à +${delay / MIN} min`);
    assert.equal(out.status === "SENT" && out.via, "journal", "retrouvé dans le journal, pas renvoyé");
    assert.equal(out.status === "SENT" && out.messageId, "<mock-1@smtp>");
  }
  const s = await state();
  assert.equal(s.emails.length, 1);
  assert.equal(posts(s), 1, "un seul POST /smtp/email en tout");
});

test("10 appels simultanés pour la même clé : un seul email", async () => {
  const k = so.sendKeyOf("t3");
  const outs = await Promise.all(Array.from({ length: 10 }, () => so.sendOnce(input(k))));
  assert.ok(outs.every((o) => o.status === "SENT"));
  assert.equal(outs.filter((o) => o.status === "SENT" && o.via === "sent").length, 1);
  assert.equal((await state()).emails.length, 1);
});

test("réponse perdue après acceptation, reprises réseau perdues aussi : retrouvé au journal, pas renvoyé", async () => {
  await configure({ dropResponses: 3 }); // les 3 tentatives HTTP de brevoRequest perdent leur réponse
  const k = so.sendKeyOf("t4");
  const out = await so.sendOnce(input(k));
  assert.equal(out.status === "SENT" && out.via, "journal");
  assert.equal(out.status === "SENT" && out.messageId, "<mock-1@smtp>", "messageId récupéré au journal");
  assert.equal((await state()).emails.length, 1);
});

test("réponse perdue une fois : la reprise réseau est refusée par l'idempotence Brevo, un seul email", async () => {
  await configure({ dropResponses: 1 });
  const out = await so.sendOnce(input(so.sendKeyOf("t5")));
  assert.equal(out.status === "SENT" && out.via, "duplicate");
  assert.equal((await state()).emails.length, 1);
});

test("réponse perdue ET journal en retard : UNKNOWN (rien renvoyé), la reprise 30 min plus tard le retrouve", async () => {
  await configure({ dropResponses: 3, journalDelayMs: 10 * MIN });
  const k = so.sendKeyOf("t6");
  const first = await so.sendOnce(input(k));
  assert.deepEqual(first, { status: "UNKNOWN", reason: "response_lost", sendKey: k });
  assert.equal((await state()).emails.length, 1);
  // n8n réessaie 30 min plus tard : idempotence expirée (15 min), l'email est désormais au journal
  await configure({ clockOffsetMs: 30 * MIN, idemTtlMs: 15 * MIN });
  const second = await so.sendOnce(input(k, { now: new Date(NOW.getTime() + 30 * MIN) }));
  assert.equal(second.status === "SENT" && second.via, "journal");
  assert.equal((await state()).emails.length, 1, "aucun nouvel email");
});

test("journal Brevo réel : date de fin jamais future (heure de Paris), y compris juste après minuit", async () => {
  await configure({ journalStrictDates: true });
  const now = new Date();
  const k = so.sendKeyOf("t-dates");
  assert.equal((await so.sendOnce(input(k, { now, since: new Date(now.getTime() - H) }))).status, "SENT");
  const again = await so.sendOnce(input(k, { now, since: new Date(now.getTime() - H) }));
  assert.equal(again.status === "SENT" && again.via, "journal", "requête de journal acceptée");
});

test("journal Brevo indisponible : on n'envoie PAS (UNKNOWN, reprise plus tard)", async () => {
  await configure({ journalDown: true });
  const out = await so.sendOnce(input(so.sendKeyOf("t7")));
  assert.deepEqual(out, { status: "UNKNOWN", reason: "journal_unavailable", sendKey: so.sendKeyOf("t7") });
  assert.equal(posts(await state()), 0);
});

test("étape de séquence : deux inscriptions du même contact + reprises → une seule relance", async () => {
  const pilot = (await import("@/config/sequences")).SEQUENCES["guide-12-cas-ec-v1"];
  const T0 = new Date("2026-10-12T09:00:00Z");
  const id = await seed({ email: "double@cabinet.fr", attributes: { VERTICAL: "FINANCE", MARKETING_STATUS: "B2B_ELIGIBLE", EMAIL_STATUS: "PENDING" }, listIds: [10] });
  const a = enrollment.signEnrollment({ s: pilot.id, c: id, t: T0.getTime(), r: "12-cas-usage-experts-comptables" })!;
  const b = enrollment.signEnrollment({ s: pilot.id, c: id, t: T0.getTime() + 1500, r: "12-cas-usage-experts-comptables" })!;
  assert.notEqual(a, b, "deux inscriptions distinctes (double soumission)");
  const at = new Date(T0.getTime() + 48 * H + 1500);
  const results = await Promise.all([run.runStep(a, "relance-j2", at), run.runStep(b, "relance-j2", at), run.runStep(a, "relance-j2", at)]);
  assert.ok(results.every((r) => r.action === "done"));
  await configure({ idemTtlMs: 15 * MIN, clockOffsetMs: 2 * H });
  assert.deepEqual(await run.runStep(b, "relance-j2", new Date(at.getTime() + 2 * H)), { action: "done", reason: "already_sent" });
  const s = await state();
  assert.equal(s.emails.length, 1);
  const attempts = s.events.filter((e) => e.event_name === "email_send_attempt");
  assert.equal(attempts.length, 4, "chaque tentative est historisée");
  assert.ok(attempts.some((e) => e.event_properties?.status === "SENT" && e.event_properties?.via === "sent" && e.event_properties?.message_id));
});

test("refus Brevo : 400 → abandon définitif (FAILED) ; 401 → FAILED temporaire ; aucune requête renvoyée", async () => {
  await configure({ sendFailStatus: 400 });
  const bad = await so.sendOnce(input(so.sendKeyOf("t8")));
  assert.equal(bad.status === "FAILED" && bad.permanent, true);
  await configure({ sendFailStatus: 401 });
  const auth = await so.sendOnce(input(so.sendKeyOf("t9")));
  assert.equal(auth.status === "FAILED" && auth.permanent, false);
  assert.equal((await state()).emails.length, 0);
});
