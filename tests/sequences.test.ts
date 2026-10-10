import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { MOCK_API_KEY, startMockBrevo, type MockState } from "./e2e/mock-brevo";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { EMAIL_TEMPLATES } from "@/config/emailTemplates";
import { getSequence, SEQUENCES, sequenceReady, type SequenceConfig } from "@/config/sequences";
import { marketingStatusForCapture } from "@/lib/marketing/status";

/* Environnement AVANT le chargement des modules qui lisent BREVO_API_BASE_URL */
const PORT = 4011;
const MOCK = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${MOCK}/v3`;
process.env.SIGNING_SECRET = "secret-tests-sequences";
process.env.N8N_SEQUENCE_WEBHOOK_URL = `${MOCK}/__n8n`;
process.env.N8N_WEBHOOK_TOKEN = "jeton-n8n";
process.env.SITE_URL = "https://site.test";

let server: { close: () => void };
let run: typeof import("@/lib/sequences/run");
let enrollment: typeof import("@/lib/sequences/enrollment");
let plan: typeof import("@/lib/sequences/plan");
let sw: typeof import("@/lib/sequences/switch");
let links: typeof import("@/lib/sequences/links");

before(async () => {
  server = await startMockBrevo(PORT);
  run = await import("@/lib/sequences/run");
  enrollment = await import("@/lib/sequences/enrollment");
  plan = await import("@/lib/sequences/plan");
  sw = await import("@/lib/sequences/switch");
  links = await import("@/lib/sequences/links");
});
after(() => server.close());

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const reset = () => fetch(`${MOCK}/__reset`, { method: "POST" });
const seed = async (c: Record<string, unknown>): Promise<number> =>
  (await (await fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify(c) })).json()).id;
const pilot = SEQUENCES["guide-12-cas-ec-v1"];
const H = 3_600_000;
const T0 = new Date("2026-10-12T09:00:00Z");
const B2B = { VERTICAL: "FINANCE", SUBSECTOR: "EXPERTISE_COMPTABLE", MARKETING_STATUS: "B2B_ELIGIBLE", EMAIL_STATUS: "PENDING", PRENOM: "Claire" };

/* ── Configuration ─────────────────────────────────────────────────── */

test("config : chaque guide a une séquence prête et son automation historique documentée", () => {
  const delivery = new Set<number>();
  for (const lm of Object.values(LEAD_MAGNETS)) {
    const seq = getSequence(lm.sequence);
    assert.ok(seq && sequenceReady(seq), `${lm.slug} : séquence ${lm.sequence} prête`);
    assert.ok(!delivery.has(lm.legacy.deliveryTemplateId), "un email de livraison historique par guide");
    delivery.add(lm.legacy.deliveryTemplateId);
  }
});

test("modèles : fichiers présents, désinscription Althoce, jamais {{ unsubscribe }} Brevo", () => {
  for (const [key, t] of Object.entries(EMAIL_TEMPLATES)) {
    assert.ok(existsSync(t.file), key);
    const html = readFileSync(t.file, "utf8");
    assert.match(html, /params\.UNSUBSCRIBE_URL/, `${key} : lien d'opposition`);
    assert.doesNotMatch(html, /\{\{\s*unsubscribe\s*\}\}/, `${key} : pas de désinscription transactionnelle Brevo`);
    assert.ok(Number.isInteger(t.id), `${key} : ID Brevo réel`);
  }
});

/* ── Statut marketing ──────────────────────────────────────────────── */

test("statut : capture métier informée qualifie un TO_REVIEW, jamais un ancien refus ni un opposant", () => {
  const c = (attributes: Record<string, unknown>, emailBlacklisted = false) => ({ attributes, emailBlacklisted }) as never;
  assert.equal(marketingStatusForCapture(c({ MARKETING_STATUS: "TO_REVIEW" }), { explicitOpposition: false, vertical: "FINANCE" }), "B2B_ELIGIBLE");
  assert.equal(marketingStatusForCapture(c({ MARKETING_STATUS: "TO_REVIEW" }), { explicitOpposition: false, vertical: null }), "TO_REVIEW");
  assert.equal(marketingStatusForCapture(c({ OPT_IN: false, MARKETING_STATUS: "TO_REVIEW" }), { explicitOpposition: false, vertical: "FINANCE" }), "TO_REVIEW");
  assert.equal(marketingStatusForCapture(c({ MARKETING_STATUS: "OPPOSED" }), { explicitOpposition: false, vertical: "FINANCE" }), "OPPOSED");
  assert.equal(marketingStatusForCapture(c({}, true), { explicitOpposition: false, vertical: "FINANCE" }), "OPPOSED");
});

/* ── Logique pure ──────────────────────────────────────────────────── */

test("inscription signée : infalsifiable, sans email, clés d'idempotence sans donnée personnelle", () => {
  const id = enrollment.signEnrollment({ s: pilot.id, c: 42, t: T0.getTime(), r: "12-cas-usage-experts-comptables" })!;
  assert.match(id, /^e1\./);
  assert.equal(id.includes("@"), false);
  assert.equal(enrollment.verifyEnrollment(id)?.c, 42);
  const [, body, sig] = id.split(".");
  const forged = Buffer.from(JSON.stringify({ s: pilot.id, c: 7, t: 0 })).toString("base64url");
  assert.equal(enrollment.verifyEnrollment(`e1.${forged}.${sig}`), null);
  assert.equal(enrollment.verifyEnrollment(`e1.${body}.AAAA`), null);
  const k = enrollment.stepIdempotencyKey(id, "relance-j2");
  assert.equal(k, enrollment.stepIdempotencyKey(id, "relance-j2"), "stable");
  assert.match(k, /^seq\.[\w-]{22}\.relance-j2$/);
  assert.match(enrollment.deliveryIdempotencyKey(pilot.id, 42, T0), /^dlv\.[\w-]{22}\.2026-10-12$/);
});

test("planification : J+2, étapes dépassées sautées, filtre transactionnel", () => {
  const enr = { s: pilot.id, c: 1, t: T0.getTime() };
  assert.equal(plan.nextStep(pilot, enr, null, T0.getTime())?.at, T0.getTime() + 48 * H);
  assert.equal(plan.nextStep(pilot, enr, "relance-j2", T0.getTime()), null);
  const webinar: SequenceConfig = {
    id: "w",
    label: "w",
    delivery: "generique.delivery",
    steps: [
      { id: "j-1", template: "generique.relance-j2", category: "transactional", offsetHours: -24, anchor: "event" },
      { id: "h-1", template: "generique.relance-j2", category: "transactional", offsetHours: -1, anchor: "event" },
      { id: "suivi", template: "generique.relance-j2", category: "marketing", offsetHours: 48, anchor: "event" },
    ],
  };
  const late = { s: "w", c: 1, t: T0.getTime(), e: T0.getTime() + 3 * H }; // inscrit 3 h avant
  assert.equal(plan.nextStep(webinar, late, null, T0.getTime())?.step.id, "h-1", "pas de J-1 envoyé après coup");
  assert.equal(plan.nextStep(webinar, late, "h-1", T0.getTime(), { transactionalOnly: true }), null);
  assert.equal(plan.stepAt({ s: "w", c: 1, t: 0 }, webinar.steps[0]), null, "webinar sans date : aucune étape");
});

test("décision : marketing refusé aux opposants et en cycle commercial, transactionnel toujours possible", () => {
  const mk = { category: "marketing" as const };
  const tx = { category: "transactional" as const };
  const c = (attributes: Record<string, string | number | boolean>, emailBlacklisted = false) => ({ attributes, emailBlacklisted });
  assert.deepEqual(plan.decideStep(c(B2B), mk), { send: true });
  assert.equal(plan.decideStep(c({ ...B2B, MARKETING_STATUS: "OPPOSED" }), mk).send, false);
  assert.equal(plan.decideStep(c(B2B, true), mk).send, false);
  assert.equal(plan.decideStep(c({ ...B2B, MARKETING_STATUS: "TO_REVIEW" }), mk).send, false);
  assert.deepEqual(plan.decideStep(c({ ...B2B, ETAT_RDV: "Planifié" }), mk), { send: false, reason: "commercial_cycle" });
  assert.deepEqual(plan.decideStep(c({ ...B2B, LIFECYCLE_STAGE: "CLIENT" }), mk), { send: false, reason: "commercial_cycle" });
  assert.deepEqual(plan.decideStep(c({ ...B2B, MARKETING_STATUS: "OPPOSED" }, true), tx), { send: true });
  assert.deepEqual(plan.decideStep(c({ ...B2B, EMAIL_STATUS: "BOUNCED" }), tx), { send: false, reason: "email_unusable" });
  assert.deepEqual(plan.decideStep(null, tx), { send: false, reason: "contact_absent" });
});

test("bascule : explicite par slug, séquence prête exigée ; pause ; liens selon l'environnement", () => {
  const lm = LEAD_MAGNETS["12-cas-usage-experts-comptables"];
  assert.equal(sw.activeGuideSequence(lm, {}), null);
  assert.equal(sw.activeGuideSequence(lm, { ALTHOCE_SEQUENCE_GUIDES: "autre, 12-cas-usage-experts-comptables" })?.id, pilot.id);
  assert.equal(sw.activeGuideSequence({ slug: "x", sequence: "inconnue" }, { ALTHOCE_SEQUENCE_GUIDES: "x" }), null);
  assert.equal(sw.sequencesPaused({ ALTHOCE_SEQUENCES_PAUSED: "true" }), true);
  assert.equal(links.siteUrl({ VERCEL_ENV: "preview", VERCEL_BRANCH_URL: "app-git-x.vercel.app" }), "https://app-git-x.vercel.app");
  assert.equal(links.siteUrl({}), "https://guide-gratuit-pi.vercel.app");
  assert.equal(links.guideParams("12-cas-usage-experts-comptables")?.GUIDE_URL.startsWith("https://"), true);
});

/* ── Intégration (faux Brevo, horloge contrôlée) ───────────────────── */

test("livraison : modèle du guide, liens signés, désinscription One-Click ; même jour = aucun doublon", async () => {
  await reset();
  const id = await seed({ email: "claire@cabinet.fr", attributes: B2B, listIds: [10] });
  const send = (now: Date) =>
    run.deliverGuide({ seq: pilot, contactId: id, email: "claire@cabinet.fr", slug: "12-cas-usage-experts-comptables", emailStatus: "PENDING", now });
  assert.equal((await send(T0)).status, "sent");
  assert.equal((await send(new Date(T0.getTime() + 2 * H))).status, "duplicate");
  const s = await state();
  assert.equal(s.emails.length, 1, "un seul email le même jour");
  const e = s.emails[0];
  assert.equal(e.templateId, 35);
  assert.match(e.params.CONFIRM_URL, /^https:\/\/site\.test\/confirmer-email\?t=v1\./);
  assert.match(e.params.UNSUBSCRIBE_URL, /^https:\/\/site\.test\/desinscription\?t=m1\./);
  assert.match(e.headers["List-Unsubscribe"], /^<https:\/\/site\.test\/api\/marketing\/unsubscribe\?t=m1\./);
  assert.equal(e.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.ok(e.tags.includes("seq:guide-12-cas-ec-v1:delivery"));
  assert.ok(s.events.some((x) => x.event_name === "guide_delivered"));
  // adresse déjà confirmée : plus de bouton
  await send(new Date(T0.getTime() + 30 * H));
  const confirmed = await run.deliverGuide({ seq: pilot, contactId: id, email: "claire@cabinet.fr", slug: "12-cas-usage-experts-comptables", emailStatus: "VERIFIED", now: new Date(T0.getTime() + 60 * H) });
  assert.equal(confirmed.status, "sent");
  assert.equal((await state()).emails.at(-1)!.params.CONFIRM_URL, undefined);
});

test("séquence : inscription n8n sans donnée personnelle, J+2 envoyée une seule fois, rejeu sans doublon", async () => {
  await reset();
  const id = await seed({ email: "paul@cabinet.fr", attributes: B2B, listIds: [10] });
  assert.equal(await run.enrollInSequence({ seq: pilot, contactId: id, slug: "12-cas-usage-experts-comptables", now: T0 }), "enrolled");
  const call = (await state()).n8n[0];
  assert.equal(call.authorization, "Bearer jeton-n8n");
  assert.equal(JSON.stringify(call.body).includes("@"), false, "aucun email transmis à n8n");
  assert.equal(call.body.stepId, "relance-j2");
  assert.equal(call.body.at, new Date(T0.getTime() + 48 * H).toISOString());

  const enr = String(call.body.enrollmentId);
  assert.deepEqual(await run.runStep(enr, "relance-j2", new Date(T0.getTime() + H)), {
    action: "wait",
    stepId: "relance-j2",
    at: new Date(T0.getTime() + 48 * H).toISOString(),
  });
  assert.equal((await state()).emails.length, 0, "rien avant J+2");
  assert.deepEqual(await run.runStep(enr, "relance-j2", new Date(T0.getTime() + 48 * H)), { action: "done", reason: "completed" });
  assert.deepEqual(await run.runStep(enr, "relance-j2", new Date(T0.getTime() + 49 * H)), { action: "done", reason: "already_sent" });
  const s = await state();
  assert.equal(s.emails.length, 1);
  assert.equal(s.emails[0].templateId, 36);
  assert.equal(s.events.filter((x) => x.event_name === "sequence_step_sent").length, 1);
});

test("désinscription avant la relance, contact qualifié, adresse en bounce : aucune relance", async () => {
  for (const [label, attrs, blacklisted, reason] of [
    ["désinscrit", { ...B2B, MARKETING_STATUS: "OPPOSED" }, true, "marketing_not_allowed"],
    ["RDV pris", { ...B2B, ETAT_RDV: "Planifié" }, false, "commercial_cycle"],
    ["bounce", { ...B2B, EMAIL_STATUS: "BOUNCED" }, false, "email_unusable"],
  ] as const) {
    await reset();
    const id = await seed({ email: "lea@cabinet.fr", attributes: attrs, listIds: [10], emailBlacklisted: blacklisted });
    const enr = enrollment.signEnrollment({ s: pilot.id, c: id, t: T0.getTime(), r: "12-cas-usage-experts-comptables" })!;
    assert.deepEqual(await run.runStep(enr, "relance-j2", new Date(T0.getTime() + 48 * H)), { action: "done", reason }, label);
    const s = await state();
    assert.equal(s.emails.length, 0, label);
    assert.ok(s.events.some((x) => x.event_name === "sequence_step_skipped"), label);
  }
});

test("n8n indisponible ou non configuré : échec tracé (rejouable), jamais d'exception", async () => {
  await reset();
  const id = await seed({ email: "n8n@cabinet.fr", attributes: B2B, listIds: [10] });
  const url = process.env.N8N_SEQUENCE_WEBHOOK_URL;
  process.env.N8N_SEQUENCE_WEBHOOK_URL = "http://127.0.0.1:9/indisponible";
  assert.equal(await run.enrollInSequence({ seq: pilot, contactId: id, slug: "12-cas-usage-experts-comptables", now: T0 }), "failed");
  const failed = (await state()).events.find((x) => x.event_name === "sequence_enroll_failed");
  assert.match(String(failed?.event_properties?.enrollment_id), /^e1\./);
  delete process.env.N8N_SEQUENCE_WEBHOOK_URL;
  assert.equal(await run.enrollInSequence({ seq: pilot, contactId: id, slug: "12-cas-usage-experts-comptables", now: T0 }), "n8n_not_configured");
  process.env.N8N_SEQUENCE_WEBHOOK_URL = url;
});

test("pause d'urgence : étapes reportées de 6 h ; identifiant falsifié : refus", async () => {
  await reset();
  const id = await seed({ email: "pause@cabinet.fr", attributes: B2B, listIds: [10] });
  const enr = enrollment.signEnrollment({ s: pilot.id, c: id, t: T0.getTime() })!;
  process.env.ALTHOCE_SEQUENCES_PAUSED = "true";
  const now = new Date(T0.getTime() + 48 * H);
  assert.deepEqual(await run.runStep(enr, "relance-j2", now), { action: "wait", stepId: "relance-j2", at: new Date(now.getTime() + 6 * H).toISOString() });
  delete process.env.ALTHOCE_SEQUENCES_PAUSED;
  assert.equal((await state()).emails.length, 0);
  assert.deepEqual(await run.runStep("e1.faux.faux", "relance-j2", now), { action: "invalid", reason: "enrollment" });
});
