/**
 * Tests de bout en bout : application Next en production locale (`next start`)
 * branchée sur le faux Brevo (tests/e2e/mock-brevo.ts). Aucune donnée
 * n'atteint le vrai Brevo : clé et URL d'API sont remplacées.
 *
 *   npm run build && npm run test:e2e
 *
 * Turnstile utilise la clé secrète de TEST officielle Cloudflare
 * (1x…AA : accepte tout jeton) : accès réseau à challenges.cloudflare.com requis.
 */

import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { MOCK_API_KEY, startMockBrevo, type MockContact, type MockState } from "./mock-brevo";

const MOCK_PORT = 4010;
const APP_PORT = 3100;
const APP = `http://127.0.0.1:${APP_PORT}`;
const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
const WEBHOOK_SECRET = "e2e-webhook-secret";
const SEQUENCE_SECRET = "e2e-sequence-secret";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ipCounter = 10;

const PILOT_TOUCH = {
  utm_source: "linkedin",
  utm_medium: "organic",
  utm_campaign: "guide_experts_comptables",
  utm_content: "LI_EC_20261008_01",
  landing_page: "/r/12-cas-usage-experts-comptables",
  ts: Date.now(),
};

function lead(over: Record<string, unknown> = {}) {
  return {
    slug: "12-cas-usage-experts-comptables",
    prenom: "Claire",
    nom: "Martin",
    email: "claire.martin.e2e@gmail.com",
    tel: "06 45 87 12 39",
    pays: "FR",
    besoin: "DEPLOYER_AGENT_IA",
    horizon: "MOINS_3_MOIS",
    website: "",
    turnstileToken: "XXXX.DUMMY.TOKEN.XXXX",
    currentTouch: PILOT_TOUCH,
    sessionId: "e2e",
    ...over,
  };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${APP}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": `10.0.0.${ipCounter++}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const reset = () => fetch(`${MOCK}/__reset`, { method: "POST" });
const seed = (c: Partial<MockContact>) =>
  fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify(c) });
const contactOf = async (email: string) => (await state()).contacts.find((c) => c.email === email);
const configure = (c: { credits?: number; ledgerDown?: boolean }) =>
  fetch(`${MOCK}/__config`, { method: "POST", body: JSON.stringify(c) });
const today = () => new Date().toISOString().slice(0, 10);

const results: { name: string; ok: boolean; error?: string }[] = [];
async function scenario(name: string, fn: () => Promise<void>) {
  await reset();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) });
    console.log(`  ✗ ${name}\n      ${e instanceof Error ? e.message.split("\n").join("\n      ") : e}`);
  }
}

async function main() {
  const mock = await startMockBrevo(MOCK_PORT);
  const app = spawn("npx", ["next", "start", "-p", String(APP_PORT)], {
    env: {
      ...process.env,
      BREVO_API_KEY: MOCK_API_KEY,
      BREVO_API_BASE_URL: `${MOCK}/v3`,
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      BREVO_WEBHOOK_SECRET: WEBHOOK_SECRET,
      SIGNING_SECRET: "e2e",
      // Moteur de séquences : seul le guide pilote a basculé
      ALTHOCE_SEQUENCE_GUIDES: "12-cas-usage-experts-comptables",
      N8N_SEQUENCE_WEBHOOK_URL: `${MOCK}/__n8n`,
      N8N_WEBHOOK_TOKEN: "e2e-n8n-token",
      N8N_EVENTS_WEBHOOK_URL: `${MOCK}/__n8n_events`,
      SEQUENCE_API_SECRET: SEQUENCE_SECRET,
      SITE_URL: APP,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  app.stdout.on("data", (d) => logs.push(String(d)));
  app.stderr.on("data", (d) => logs.push(String(d)));

  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${APP}/r/12-cas-usage-experts-comptables`);
      break;
    } catch {
      await sleep(500);
    }
  }

  console.log("\nE2E — application ↔ faux Brevo\n");

  await scenario("65 · page pilote : contact, liste 10, attributs, score 12, événement", async () => {
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.leadRef, "leadRef renvoyé");
    const c = await contactOf("claire.martin.e2e@gmail.com");
    assert.ok(c, "contact créé");
    assert.deepEqual(c.listIds, [10]);
    const a = c.attributes;
    const expected: Record<string, unknown> = {
      RESSOURCE: "12-cas-usage-experts-comptables",
      VERTICAL: "FINANCE",
      SUBSECTOR: "EXPERTISE_COMPTABLE",
      UTM_SOURCE: "linkedin",
      UTM_MEDIUM: "organic",
      UTM_CAMPAIGN: "guide_experts_comptables",
      UTM_CONTENT: "LI_EC_20261008_01",
      BESOIN_PRIORITAIRE: "DEPLOYER_AGENT_IA",
      HORIZON_PROJET: "MOINS_3_MOIS",
      LIFECYCLE_STAGE: "LEAD",
      LEAD_SCORE: 12,
      EMAIL_STATUS: "PENDING",
      PHONE_STATUS: "VALID_FORMAT",
      SMS: "33645871239",
      PRENOM: "Claire",
      NOM: "Martin",
      SOURCE_INSCRIPTION: "page-capture",
      MARKETING_STATUS: "B2B_ELIGIBLE",
    };
    for (const [k, v] of Object.entries(expected)) assert.equal(a[k], v, k);
    assert.match(String(a.EMAIL_CONFIRM_TOKEN), /^v1\./, "lien de confirmation prêt pour l'email de bienvenue");
    assert.equal(String(a.EMAIL_CONFIRM_TOKEN).includes("claire"), false, "email non lisible dans le jeton");
    await sleep(800); // after() : l'événement part après la réponse
    const ev = (await state()).events.find((e) => e.event_name === "lead_magnet_submitted");
    assert.ok(ev, "événement lead_magnet_submitted");
    assert.deepEqual(ev.identifiers, { contact_id: c.id });
    assert.equal(ev.event_properties?.resource, "12-cas-usage-experts-comptables");
    assert.equal(ev.event_properties?.utm_content, "LI_EC_20261008_01");
    assert.equal(ev.event_properties?.landing_page, "/r/12-cas-usage-experts-comptables");

    // lead_magnet_downloaded via le jeton signé
    const d = await post("/api/events", { name: "lead_magnet_downloaded", leadRef: r.body.leadRef });
    assert.equal(d.status, 204);
    await sleep(800);
    assert.ok((await state()).events.find((e) => e.event_name === "lead_magnet_downloaded"), "téléchargement mesuré");
    const forged = await post("/api/events", { name: "lead_magnet_downloaded", leadRef: "faux.jeton" });
    assert.equal(forged.status, 204);
  });

  await scenario("66 · domaine inexistant : refus propre, aucun contact", async () => {
    const r = await post("/api/lead", lead({ email: "abc@domainetotalementinexistant-althoce-test.fr" }));
    assert.equal(r.status, 400);
    assert.equal(r.body.field, "email");
    assert.equal(r.body.message, "Veuillez vérifier votre adresse email.");
    assert.equal((await state()).contacts.length, 0);
  });

  await scenario("67 · email jetable : refus, message dédié, aucun contact", async () => {
    const r = await post("/api/lead", lead({ email: "prospect@yopmail.com" }));
    assert.equal(r.status, 400);
    assert.equal(r.body.message, "Merci d’utiliser une adresse email personnelle ou professionnelle valide.");
    assert.equal((await state()).contacts.length, 0);
  });

  await scenario("68 · 0000000000 : refus sur le champ téléphone, aucun contact", async () => {
    const r = await post("/api/lead", lead({ tel: "0000000000" }));
    assert.equal(r.status, 400);
    assert.equal(r.body.field, "tel");
    assert.equal((await state()).contacts.length, 0);
  });

  await scenario("68b · numéro douteux (06 12 34 56 78) : accepté, PHONE_STATUS = SUSPECT", async () => {
    const r = await post("/api/lead", lead({ tel: "06 12 34 56 78" }));
    assert.equal(r.status, 200);
    assert.equal((await contactOf("claire.martin.e2e@gmail.com"))?.attributes.PHONE_STATUS, "SUSPECT");
  });

  await scenario("69 · first touch : LinkedIn conservé après une visite Google", async () => {
    await post("/api/lead", lead({ currentTouch: { utm_source: "linkedin", utm_content: "LI_EC_TEST_01" } }));
    // Visite ultérieure : first touch toujours en localStorage + URL Google
    const r = await post(
      "/api/lead",
      lead({
        firstTouch: { utm_source: "linkedin", utm_content: "LI_EC_TEST_01", ts: Date.now() - 86400000 },
        currentTouch: { utm_source: "google", utm_content: "GOOGLE_TEST" },
      })
    );
    assert.equal(r.status, 200);
    const a = (await contactOf("claire.martin.e2e@gmail.com"))!.attributes;
    assert.equal(a.UTM_SOURCE, "linkedin");
    assert.equal(a.UTM_CONTENT, "LI_EC_TEST_01");
    // Même sans first touch navigateur (autre appareil), Brevo garde la provenance initiale
    await post("/api/lead", lead({ currentTouch: { utm_source: "google", utm_content: "GOOGLE_TEST_2" } }));
    assert.equal((await contactOf("claire.martin.e2e@gmail.com"))!.attributes.UTM_SOURCE, "linkedin");
  });

  await scenario("70 · score existant 30 conservé face à un formulaire à 12", async () => {
    await seed({ email: "claire.martin.e2e@gmail.com", listIds: [13], attributes: { LEAD_SCORE: 30, LIFECYCLE_STAGE: "CONTACTED" } });
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200);
    const a = (await contactOf("claire.martin.e2e@gmail.com"))!.attributes;
    assert.equal(a.LEAD_SCORE, 30);
    assert.equal(a.LIFECYCLE_STAGE, "CONTACTED", "étape commerciale jamais rétrogradée");
  });

  await scenario("71 · même email, guide A puis guide B : un seul contact, deux listes", async () => {
    await post("/api/lead", lead());
    await post("/api/lead", lead({ slug: "guide-claude-pennylane" }));
    const s = await state();
    assert.equal(s.contacts.filter((c) => c.email === "claire.martin.e2e@gmail.com").length, 1);
    assert.deepEqual(s.contacts[0].listIds.sort((a, b) => a - b), [6, 10]);
    assert.equal(s.contacts[0].attributes.RESSOURCE, "guide-claude-pennylane");
  });

  await scenario("71b · numéro déjà porté par un autre contact : lead gardé, TEL_DOUBLON", async () => {
    await seed({ email: "autre@cabinet.fr", attributes: { SMS: "33645871239" } });
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200);
    const a = (await contactOf("claire.martin.e2e@gmail.com"))!.attributes;
    assert.equal(a.SMS, undefined);
    assert.equal(a.TEL_DOUBLON, "+33645871239");
    assert.equal(a.PHONE_STATUS, undefined, "aucun SMS stocké → PHONE_STATUS vide");
  });

  await scenario("71c · numéro refusé, contact ayant déjà un autre SMS : statut de l'ancien SMS", async () => {
    await seed({ email: "autre@cabinet.fr", attributes: { SMS: "33645871239" } });
    await seed({ email: "claire.martin.e2e@gmail.com", attributes: { SMS: "33612345678", PHONE_STATUS: "VALID_FORMAT" } });
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200);
    const a = (await contactOf("claire.martin.e2e@gmail.com"))!.attributes;
    assert.equal(a.SMS, "33612345678");
    assert.equal(a.PHONE_STATUS, "SUSPECT", "statut recalculé sur le SMS réellement stocké");
  });

  await scenario("72 · honeypot rempli : succès factice, aucun contact", async () => {
    const r = await post("/api/lead", lead({ website: "https://spam.example" }));
    assert.equal(r.status, 200);
    assert.equal((await state()).contacts.length, 0);
  });

  await scenario("72b · jeton Turnstile absent : 403, aucun contact", async () => {
    const r = await post("/api/lead", lead({ turnstileToken: undefined }));
    assert.equal(r.status, 403);
    assert.equal((await state()).contacts.length, 0);
  });

  await scenario("72c · liste Brevo imposée par le navigateur : ignorée", async () => {
    const r = await post("/api/lead", lead({ brevoListId: 2, listIds: [2] }));
    assert.equal(r.status, 200);
    assert.deepEqual((await contactOf("claire.martin.e2e@gmail.com"))!.listIds, [10]);
  });

  await scenario("72d · slug inconnu : 404 ; champs hors référentiel : 400", async () => {
    assert.equal((await post("/api/lead", lead({ slug: "inexistant" }))).status, 404);
    const r = await post("/api/lead", lead({ horizon: "DEMAIN" }));
    assert.equal(r.status, 400);
    assert.equal(r.body.field, "horizon");
  });

  await scenario("72e · rate limiting : 7e requête/min d'une même IP → 429", async () => {
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await post("/api/lead", { slug: "x" }, { "x-real-ip": "10.9.9.9" })).status);
    assert.equal(codes[6], 429);
  });

  await scenario("D · nouveau prospect métier informé : B2B éligible et sans OPT_IN artificiel", async () => {
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200);
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.equal(c.attributes.MARKETING_STATUS, "B2B_ELIGIBLE");
    assert.equal(c.emailBlacklisted, false);
    assert.equal("OPT_IN" in c.attributes, false);
  });

  await scenario("E · opposition dès la capture : guide accessible, mais campagnes bloquées", async () => {
    const r = await post("/api/lead", lead({ marketingOpposition: true }));
    assert.equal(r.status, 200);
    assert.ok(r.body.leadRef, "accès au guide indépendamment de l'opposition");
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.equal(c.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal(c.emailBlacklisted, true);

    // Une nouvelle soumission ne peut pas annuler l'opposition.
    const again = await post("/api/lead", lead({ marketingOpposition: false }));
    assert.equal(again.status, 200);
    const after = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.equal(after.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal(after.emailBlacklisted, true);
  });

  await scenario("E2 · ancien consentement préservé, ancien refus non converti", async () => {
    await seed({ email: "abonne@cabinet.fr", attributes: { OPT_IN: true } });
    await post("/api/lead", lead({ email: "abonne@cabinet.fr", tel: "06 45 87 12 38" }));
    const subscribed = (await contactOf("abonne@cabinet.fr"))!;
    assert.equal(subscribed.attributes.OPT_IN, true);
    assert.equal(subscribed.attributes.MARKETING_STATUS, "CONSENT");

    await seed({ email: "refus@cabinet.fr", attributes: { OPT_IN: false } });
    await post("/api/lead", lead({ email: "refus@cabinet.fr", tel: "06 45 87 12 37" }));
    const refused = (await contactOf("refus@cabinet.fr"))!;
    assert.equal(refused.attributes.MARKETING_STATUS, "TO_REVIEW");
    assert.equal(refused.attributes.OPT_IN, false);
  });

  await scenario("E3 · lien de désinscription : POST confirmé, idem au 2e clic, pas de re-opt-in", async () => {
    await post("/api/lead", lead());
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    const token = String(c.attributes.MARKETING_OPTOUT_TOKEN);
    assert.match(token, /^m1\./);
    const landing = await fetch(`${APP}/desinscription?t=${encodeURIComponent(token)}`);
    assert.equal(landing.status, 200, "GET est uniquement consultatif");
    assert.equal((await contactOf(c.email))!.emailBlacklisted, false);

    const first = await post("/api/marketing/unsubscribe", { t: token });
    assert.equal(first.status, 200);
    assert.equal((await contactOf(c.email))!.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal((await contactOf(c.email))!.emailBlacklisted, true);
    const writes = (await state()).requests.filter((x) => x === `PUT /v3/contacts/${c.id}`).length;
    assert.equal((await post("/api/marketing/unsubscribe", { t: token })).status, 200);
    assert.equal((await state()).requests.filter((x) => x === `PUT /v3/contacts/${c.id}`).length, writes);
    assert.equal((await post("/api/marketing/unsubscribe", { t: "m1.bad" })).status, 400);
  });

  /** Les envois se font après la réponse (after()) : on attend qu'ils apparaissent */
  async function until(pred: (s: MockState) => boolean, label: string) {
    for (let i = 0; i < 40; i++) {
      const s = await state();
      if (pred(s)) return s;
      await sleep(100);
    }
    throw new Error(`délai dépassé : ${label}`);
  }

  await scenario("S1 · pilote basculé : guide livré tout de suite, séquence n8n ; 2e inscription : rien en double", async () => {
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 200);
    const s = await until((x) => x.emails.length === 1 && x.n8n.length === 1, "livraison + inscription");
    assert.equal(s.emails[0].templateId, 35, "modèle de livraison du pilote");
    assert.equal(s.emails[0].to[0].email, "claire.martin.e2e@gmail.com");
    assert.match(s.emails[0].headers["List-Unsubscribe"], /\/api\/marketing\/unsubscribe\?t=m1\./);
    assert.equal(s.n8n[0].authorization, "Bearer e2e-n8n-token");
    assert.equal(s.n8n[0].body.stepId, "relance-j2");
    assert.equal(JSON.stringify(s.n8n[0].body).includes("@"), false);

    const again = await post("/api/lead", lead());
    assert.equal(again.status, 200);
    await sleep(800);
    const s2 = await state();
    assert.equal(s2.emails.length, 1, "même jour : pas de 2e email");
    assert.equal(s2.n8n.length, 1, "déjà dans la liste : pas de 2e séquence");
  });

  await scenario("S2 · opposant sur un guide encore en automation Brevo : hors liste, guide livré en transactionnel", async () => {
    const r = await post("/api/lead", lead({ slug: "guide-claude-pennylane", marketingOpposition: true }));
    assert.equal(r.status, 200);
    assert.equal(r.body.marketing, "opposed", "opposition confirmée par le serveur");
    const s = await until((x) => x.emails.length === 1, "livraison");
    assert.equal(s.emails[0].templateId, 37, "modèle générique");
    assert.equal(s.emails[0].params.GUIDE_URL.startsWith("https://"), true);
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.deepEqual(c.listIds, [], "pas d'ajout à la liste 6 : l'automation n'envoie rien");
    assert.equal(c.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal(s.n8n.length, 0, "aucune séquence");
  });

  await scenario("S3 · /api/sequences/step : secret exigé, étape prématurée reportée, identifiant falsifié refusé", async () => {
    await post("/api/lead", lead());
    const s = await until((x) => x.n8n.length === 1, "inscription");
    const body = { enrollmentId: s.n8n[0].body.enrollmentId, stepId: "relance-j2" };
    assert.equal((await post("/api/sequences/step", body)).status, 401);
    assert.equal((await post("/api/sequences/step", body, { Authorization: "Bearer faux" })).status, 401);
    const auth = { Authorization: `Bearer ${SEQUENCE_SECRET}` };
    const early = await post("/api/sequences/step", body, auth);
    assert.equal(early.status, 200);
    assert.equal(early.body.action, "wait");
    assert.equal(early.body.at, s.n8n[0].body.at);
    assert.equal((await post("/api/sequences/step", { ...body, enrollmentId: "e1.faux.faux" }, auth)).status, 400);
    assert.equal((await state()).emails.length, 1, "seule la livraison est partie");
  });

  await scenario("S4 · « Se désabonner » de la messagerie (RFC 8058) : POST ?t= → opposé ; GET sans effet", async () => {
    await post("/api/lead", lead());
    const s = await until((x) => x.emails.length === 1, "livraison");
    const url = s.emails[0].headers["List-Unsubscribe"].slice(1, -1);
    const get = await fetch(url);
    assert.notEqual(get.status, 200, "GET (aperçu, antivirus) ne désinscrit pas");
    assert.equal((await contactOf("claire.martin.e2e@gmail.com"))!.emailBlacklisted, false);
    const oneClick = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "x-real-ip": "10.9.9.9" },
      body: "List-Unsubscribe=One-Click",
    });
    assert.equal(oneClick.status, 200);
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.equal(c.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal(c.emailBlacklisted, true);
  });

  await scenario("S5 · alerte n8n : secret exigé, email envoyé à la boîte de réponse, une seule fois par exécution", async () => {
    const alert = { workflow: "Marketing — Séquences (moteur) — v1", executionId: "123", node: "Exécuter l'étape", message: "HTTP 502" };
    assert.equal((await post("/api/sequences/alert", alert)).status, 401);
    const auth = { Authorization: `Bearer ${SEQUENCE_SECRET}` };
    assert.equal((await post("/api/sequences/alert", alert, auth)).status, 200);
    assert.equal((await post("/api/sequences/alert", alert, auth)).status, 200, "même exécution : pas de 2e email");
    const s = await state();
    assert.equal(s.emails.length, 1);
    assert.equal(s.emails[0].to[0].email, "espoir@contact.althoce.com");
    assert.ok(s.emails[0].tags.includes("alerte-sequences"));
  });

  await scenario("54 · confirmation dédiée → VERIFIED ; 2e clic sans effet ; jeton falsifié refusé", async () => {
    await post("/api/lead", lead());
    const c = (await contactOf("claire.martin.e2e@gmail.com"))!;
    assert.equal(c.attributes.EMAIL_STATUS, "PENDING");
    const t = String(c.attributes.EMAIL_CONFIRM_TOKEN);
    const first = await post("/api/email/confirm", { t });
    assert.equal(first.status, 200);
    assert.equal(first.body.status, "verified");
    const second = await post("/api/email/confirm", { t });
    assert.equal(second.body.status, "already_verified");
    await sleep(300);
    const s = await state();
    assert.equal(s.contacts[0].attributes.EMAIL_STATUS, "VERIFIED");
    assert.equal("OPT_IN" in s.contacts[0].attributes, false, "confirmer l'email ne crée pas de consentement");
    assert.equal(s.events.filter((e) => e.event_name === "email_confirmed").length, 1, "un seul événement");
    const forged = await post("/api/email/confirm", { t: t.slice(0, -3) + "abc" });
    assert.equal(forged.status, 400);
  });

  await scenario("54 · clic générique de newsletter (webhook) : reste PENDING", async () => {
    await seed({ email: "lecteur@cabinet.fr", attributes: { EMAIL_STATUS: "PENDING" } });
    const auth = { Authorization: `Bearer ${WEBHOOK_SECRET}` };
    const r = await post("/api/webhooks/brevo", { event: "click", email: "lecteur@cabinet.fr", URL: "https://althoce.com/blog" }, auth);
    assert.deepEqual(r.body.results, ["ignored_click"]);
    assert.equal((await contactOf("lecteur@cabinet.fr"))!.attributes.EMAIL_STATUS, "PENDING");
  });

  await scenario("54b · webhook Brevo unsubscribe → opposition marketing", async () => {
    await seed({ email: "stop@cabinet.fr", attributes: { MARKETING_STATUS: "CONSENT" } });
    const auth = { Authorization: `Bearer ${WEBHOOK_SECRET}` };
    const evt = { event: "unsubscribe", email: "stop@cabinet.fr" };
    assert.equal((await post("/api/webhooks/brevo", evt)).status, 401);
    assert.deepEqual((await post("/api/webhooks/brevo", evt, auth)).body.results, ["marketing_opposed"]);
    assert.deepEqual((await post("/api/webhooks/brevo", evt, auth)).body.results, ["unchanged"]);
    assert.equal((await contactOf("stop@cabinet.fr"))!.emailBlacklisted, true);
    assert.equal((await contactOf("stop@cabinet.fr"))!.attributes.MARKETING_STATUS, "OPPOSED");
  });

  await scenario("54 · hard bounce → BOUNCED ; reçu deux fois → une seule écriture ; secret exigé", async () => {
    await seed({ email: "rebond@cabinet.fr", attributes: { EMAIL_STATUS: "PENDING", LEAD_SCORE: 12 } });
    const bounce = { event: "hard_bounce", email: "rebond@cabinet.fr" };
    assert.equal((await post("/api/webhooks/brevo", bounce)).status, 401);
    const auth = { Authorization: `Bearer ${WEBHOOK_SECRET}` };
    assert.deepEqual((await post("/api/webhooks/brevo", bounce, auth)).body.results, ["bounced"]);
    assert.deepEqual((await post("/api/webhooks/brevo", [bounce, bounce], auth)).body.results, ["unchanged", "unchanged"]);
    const s = await state();
    assert.equal(s.requests.filter((r) => r.startsWith("PUT")).length, 1, "une seule écriture Brevo");
    assert.equal(s.contacts[0].attributes.EMAIL_STATUS, "BOUNCED");
    assert.equal(s.contacts[0].attributes.LEAD_SCORE, 12, "score jamais modifié");
  });

  /* ── Scoring comportemental (journal n8n simulé) ───────────────────── */
  const hook = (evt: unknown) => post("/api/webhooks/brevo", evt, { Authorization: `Bearer ${WEBHOOK_SECRET}` });
  const click = (email: string, messageId: string, link: string) => ({
    event: "click", email, "message-id": messageId, link, ts_event: Math.floor(Date.now() / 1000), tags: ["sequence"], template_id: 35,
  });
  const hotAlerts = (s: MockState) => s.emails.filter((e) => e.tags?.includes("alerte-lead-chaud"));

  await scenario("SC1 · clic RDV (transactionnel) → +10 ; rejeu → rien ; clic guide → +5, lead chaud, alerte UNE fois", async () => {
    await seed({ email: "chaud@cabinet.fr", attributes: { LEAD_SCORE: 12, LIFECYCLE_STAGE: "LEAD", EMAIL_STATUS: "PENDING", PRENOM: "Léa", ENTREPRISE: "Cabinet <Test>" } });
    const offer = click("chaud@cabinet.fr", "<m1@relay>", "https://cal.com/althoce-conseil-4ncbuz/30min");
    const r1 = await hook(offer);
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.deepEqual(r1.body.results, ["click_scored"]);
    let c = (await contactOf("chaud@cabinet.fr"))!;
    assert.equal(c.attributes.FORM_SCORE, 12, "score formulaire historique figé");
    assert.equal(c.attributes.BEHAVIOR_SCORE, 10);
    assert.equal(c.attributes.LEAD_SCORE, 22);
    assert.equal(c.attributes.LAST_EMAIL_CLICK_AT, today());

    await hook(offer); // Brevo rejoue
    await hook([offer, { ...offer, link: "https://cal.com/althoce-conseil-4ncbuz/30min?x=1" }]); // 2e clic RDV, même email
    let s = await state();
    assert.equal(s.ledger.length, 1, "un seul événement journalisé");
    assert.equal(s.contacts[0].attributes.LEAD_SCORE, 22, "aucun double comptage");

    await hook(click("chaud@cabinet.fr", "<m1@relay>", "https://espoir-metareglage.notion.site/12-cas"));
    c = (await contactOf("chaud@cabinet.fr"))!;
    assert.equal(c.attributes.LEAD_SCORE, 27);
    assert.equal(c.attributes.LIFECYCLE_STAGE, "HOT_LEAD");
    assert.equal(c.attributes.HOT_ALERT_SENT_AT, today());
    s = await state();
    assert.equal(hotAlerts(s).length, 1);
    assert.equal(hotAlerts(s)[0].to[0].email, "espoir@contact.althoce.com");
    const html = String((hotAlerts(s)[0] as unknown as { htmlContent: string }).htmlContent);
    assert.match(html, /Cabinet &lt;Test&gt;/, "valeurs échappées");
    assert.match(html, /formulaire 12 \+ comportement 15/);

    await hook({ event: "click", email: "chaud@cabinet.fr", camp_id: 41, URL: "https://www.linkedin.com/posts/x", ts_event: 1 });
    s = await state();
    assert.equal(s.contacts[0].attributes.LEAD_SCORE, 30, "clic newsletter +3");
    assert.equal(hotAlerts(s).length, 1, "pas de 2e alerte");
  });

  await scenario("SC2 · n8n arrêté → 429 (Brevo rejoue), rien écrit ; au rejeu → compté une fois", async () => {
    await seed({ email: "panne@cabinet.fr", attributes: { LEAD_SCORE: 4 } });
    await configure({ ledgerDown: true });
    const evt = click("panne@cabinet.fr", "<m2@relay>", "https://cal.com/althoce-conseil-4ncbuz/30min");
    const r = await hook(evt);
    assert.equal(r.status, 429);
    assert.equal((await contactOf("panne@cabinet.fr"))!.attributes.LEAD_SCORE, 4);
    await configure({ ledgerDown: false });
    assert.equal((await hook(evt)).status, 200);
    assert.equal((await hook(evt)).status, 200);
    const c = (await contactOf("panne@cabinet.fr"))!;
    assert.equal(c.attributes.LEAD_SCORE, 14);
    assert.equal((await state()).ledger.length, 1);
  });

  await scenario("SC3 · liens jamais comptés (désinscription, confirmation, mailto) ; spam → opposition ; email interne ignoré", async () => {
    await seed({ email: "neutre@cabinet.fr", attributes: { LEAD_SCORE: 3, MARKETING_STATUS: "B2B_ELIGIBLE" } });
    const r = await hook([
      click("neutre@cabinet.fr", "<m3@relay>", `${APP}/desinscription?t=abc`),
      click("neutre@cabinet.fr", "<m3@relay>", `${APP}/confirmer-email?t=abc`),
      click("neutre@cabinet.fr", "<m3@relay>", "mailto:espoir@contact.althoce.com"),
      { ...click("neutre@cabinet.fr", "<m4@relay>", "https://cal.com/althoce-conseil-4ncbuz/30min"), tags: ["alerte-lead-chaud"] },
      { event: "spam", email: "neutre@cabinet.fr" },
    ]);
    assert.deepEqual(r.body.results, ["ignored_click", "ignored_click", "ignored_click", "ignored_click", "marketing_opposed"]);
    const c = (await contactOf("neutre@cabinet.fr"))!;
    assert.equal(c.attributes.LEAD_SCORE, 3);
    assert.equal(c.attributes.MARKETING_STATUS, "OPPOSED");
    assert.equal((await state()).ledger.length, 0);
  });

  await scenario("SC4 · passe horaire /api/marketing/score : secret exigé, idempotente, ne baisse jamais", async () => {
    await seed({ email: "manuel@cabinet.fr", attributes: { LEAD_SCORE: 40, BEHAVIOR_SCORE: 20, FORM_SCORE: 10, LIFECYCLE_STAGE: "CONTACTED" } });
    const id = (await contactOf("manuel@cabinet.fr"))!.id;
    const rows = [
      { event_key: `clk.${"a".repeat(32)}`, contact_id: id, category: "guide_click", points: 5, occurred_at: "2026-10-01T10:00:00Z" },
      { event_key: `clk.${"a".repeat(32)}`, contact_id: id, category: "guide_click", points: 5, occurred_at: "2026-10-01T10:00:00Z" },
      { event_key: `clk.${"b".repeat(32)}`, contact_id: id, category: "content_click", points: 3, occurred_at: "2026-10-02T10:00:00Z" },
    ];
    assert.equal((await post("/api/marketing/score", { rows })).status, 401);
    const auth = { Authorization: `Bearer ${SEQUENCE_SECRET}` };
    const r = await post("/api/marketing/score", { rows }, auth);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const c = (await contactOf("manuel@cabinet.fr"))!;
    assert.equal(c.attributes.LEAD_SCORE, 40, "score manuel conservé");
    assert.equal(c.attributes.BEHAVIOR_SCORE, 20, "comportement jamais réduit (8 < 20)");
    assert.equal(c.attributes.LIFECYCLE_STAGE, "CONTACTED", "étape commerciale intouchée");
    assert.equal(c.attributes.LAST_EMAIL_CLICK_AT, "2026-10-02");
    const puts = (await state()).requests.filter((q) => q.startsWith("PUT")).length;
    await post("/api/marketing/score", { rows }, auth);
    assert.equal((await state()).requests.filter((q) => q.startsWith("PUT")).length, puts, "2e passe : aucune écriture");
    assert.equal(hotAlerts(await state()).length, 0, "contact déjà contacté : pas d'alerte");
  });

  await scenario("SC5 · tâches horaires : quota bas → alerte une fois/jour ; RDV confirmé → +25 une fois, sans alerte", async () => {
    await seed({ email: "rdv@cabinet.fr", attributes: { LEAD_SCORE: 5, ETAT_RDV: "Prévu" } });
    await seed({ email: "rien@cabinet.fr", attributes: { LEAD_SCORE: 5, ETAT_RDV: "À préciser" } });
    await configure({ credits: 50 });
    const auth = { Authorization: `Bearer ${SEQUENCE_SECRET}` };
    assert.equal((await post("/api/marketing/maintenance", {})).status, 401);
    const r1 = await post("/api/marketing/maintenance", {}, auth);
    assert.equal(r1.status, 200, JSON.stringify(r1.body));
    assert.equal(r1.body.quota.remaining, 50);
    assert.equal(r1.body.quota.alert, "sent");
    assert.equal(r1.body.meetings.events, 1);
    const r2 = await post("/api/marketing/maintenance", {}, auth);
    assert.equal(r2.body.meetings.inserted, 0, "RDV déjà compté");
    const s = await state();
    assert.equal(s.emails.filter((e) => e.tags?.includes("alerte-quota")).length, 1, "une alerte quota par jour");
    const rdv = s.contacts.find((c) => c.email === "rdv@cabinet.fr")!;
    assert.equal(rdv.attributes.BEHAVIOR_SCORE, 25);
    assert.equal(rdv.attributes.LEAD_SCORE, 30);
    assert.equal(hotAlerts(s).length, 0, "RDV en cours : pas d'alerte lead chaud");
    assert.equal(s.contacts.find((c) => c.email === "rien@cabinet.fr")!.attributes.LEAD_SCORE, 5);
  });

  await scenario("SC6 · présence webinar (n8n → /api/sequences/event) → +15, une fois", async () => {
    await seed({ email: "present@cabinet.fr", attributes: { LEAD_SCORE: 8 } });
    const auth = { Authorization: `Bearer ${SEQUENCE_SECRET}` };
    const evt = { email: "present@cabinet.fr", event: "webinar_attended", properties: { webinar: "ia-cabinet-2026" } };
    assert.equal((await post("/api/sequences/event", evt, auth)).status, 200);
    assert.equal((await post("/api/sequences/event", evt, auth)).status, 200);
    const c = (await contactOf("present@cabinet.fr"))!;
    assert.equal(c.attributes.BEHAVIOR_SCORE, 15);
    assert.equal(c.attributes.LEAD_SCORE, 23);
  });

  await scenario("Brevo en panne : message clair, réessai possible", async () => {
    mock.close();
    await sleep(200);
    const r = await post("/api/lead", lead());
    assert.equal(r.status, 502);
    assert.match(r.body.message, /Réessayez/);
  });

  app.kill();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scénarios OK\n`);
  if (failed.length) {
    console.log("Journal serveur (extrait) :\n" + logs.join("").split("\n").slice(-30).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
