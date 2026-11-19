import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { MOCK_API_KEY, startMockBrevo, type MockState } from "./e2e/mock-brevo";
import { SECTEUR_SLUGS, TEST_MATURITE_SECTEURS, testMaturiteIntakeMode, testMaturiteListId } from "@/config/testMaturite";
import { SUBSECTORS, VERTICALS } from "@/config/taxonomy";

// Faux Brevo local uniquement : aucun appel Brevo, n8n ni Vercel réel.
const PORT = 4547;
const MOCK = `http://127.0.0.1:${PORT}`;
process.env.BREVO_API_KEY = MOCK_API_KEY;
process.env.BREVO_API_BASE_URL = `${MOCK}/v3`;
process.env.SIGNING_SECRET = "intake-test-maturite-tests-only";

const SECRET = "secret-intake-de-test";
const LIST_ID = 31;
const ON = { SEQUENCE_API_SECRET: SECRET, ALTHOCE_INTAKE_TEST_MATURITE: "on", BREVO_LIST_TEST_MATURITE: String(LIST_ID) };
const NOW = new Date("2026-11-19T10:00:00Z");

let server: { close: () => void };
let intake: typeof import("@/lib/intake/testMaturite");
let contacts: typeof import("@/lib/brevo/contacts");
let rate: typeof import("@/lib/security/rateLimit");
let optout: typeof import("@/lib/marketing/token");
let confirm: typeof import("@/lib/security/emailConfirm");
before(async () => {
  server = await startMockBrevo(PORT);
  intake = await import("@/lib/intake/testMaturite");
  contacts = await import("@/lib/brevo/contacts");
  rate = await import("@/lib/security/rateLimit");
  optout = await import("@/lib/marketing/token");
  confirm = await import("@/lib/security/emailConfirm");
});
after(() => server.close());
beforeEach(async () => {
  await fetch(`${MOCK}/__reset`, { method: "POST" });
  rate.__resetRateLimits();
});

const state = async (): Promise<MockState> => (await fetch(`${MOCK}/__state`)).json();
const brevoCalls = async () => (await state()).requests;

function payload(over: Record<string, unknown> = {}) {
  return {
    email: "claire.martin@gmail.com",
    prenom: "Claire",
    secteur_slug: "comptabilite",
    secteur_personnalise: "",
    taille: "10-49",
    role: "Dirigeant ou associé",
    score: 42,
    stade: 2,
    stade_nom: "Usages dispersés",
    offre_recommandee: "Formation IA Dirigeant & Associés",
    lien_resultat: "https://althoce.com/test-maturite-ia/#resultat=1.comptabilite.2.0.0123x01230123",
    opposition_marketing: false,
    source_url: "https://althoce.com/test-maturite-ia/",
    ...over,
  };
}

async function call(
  body: unknown,
  { env = ON as Record<string, string | undefined>, auth = `Bearer ${SECRET}` as string | null, raw = false } = {}
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth !== null) headers.Authorization = auth;
  const req = new Request("http://localhost/api/intake/test-maturite", {
    method: "POST", headers, body: raw ? String(body) : JSON.stringify(body),
  });
  return intake.intakeTestMaturite(req, { env, now: NOW });
}

/* ── Configuration ───────────────────────────────────────────────────── */

test("config : chaque secteur du test a une verticale et un sous-secteur de la taxonomie", () => {
  assert.equal(SECTEUR_SLUGS.length, 14);
  for (const slug of SECTEUR_SLUGS) {
    const m = TEST_MATURITE_SECTEURS[slug];
    assert.ok((VERTICALS as readonly string[]).includes(m.vertical), slug);
    assert.ok(m.subsector === null || (SUBSECTORS as readonly string[]).includes(m.subsector), slug);
    if (m.vertical === "GENERAL") assert.equal(m.subsector, null, slug);
  }
  assert.deepEqual(
    Object.fromEntries(SECTEUR_SLUGS.filter((s) => TEST_MATURITE_SECTEURS[s].vertical !== "GENERAL")
      .map((s) => [s, `${TEST_MATURITE_SECTEURS[s].vertical}/${TEST_MATURITE_SECTEURS[s].subsector ?? "-"}`])),
    {
      finance: "FINANCE/-",
      comptabilite: "FINANCE/EXPERTISE_COMPTABLE",
      droit: "LEGAL/-",
      "assurance-patrimoine": "FINANCE/ASSURANCE",
      "marketing-communication": "MARKETING/AGENCE_MARKETING",
    }
  );
});

test("config : bascule fermée par défaut, liste exigée sous forme d'ID numérique", () => {
  assert.equal(testMaturiteIntakeMode({}), "off");
  assert.equal(testMaturiteIntakeMode({ ALTHOCE_INTAKE_TEST_MATURITE: "true" }), "off");
  assert.equal(testMaturiteIntakeMode({ ALTHOCE_INTAKE_TEST_MATURITE: "qa" }), "qa");
  assert.equal(testMaturiteIntakeMode({ ALTHOCE_INTAKE_TEST_MATURITE: " ON " }), "on");
  assert.equal(testMaturiteListId({}), null);
  assert.equal(testMaturiteListId({ BREVO_LIST_TEST_MATURITE: "LM - Test" }), null);
  assert.equal(testMaturiteListId({ BREVO_LIST_TEST_MATURITE: "0" }), null);
  assert.equal(testMaturiteListId({ BREVO_LIST_TEST_MATURITE: " 31 " }), 31);
});

/* ── Accès ───────────────────────────────────────────────────────────── */

test("auth : secret non configuré → 404, Bearer absent ou faux → 401, sans appel Brevo", async () => {
  assert.equal((await call(payload(), { env: { ...ON, SEQUENCE_API_SECRET: "" } })).status, 404);
  for (const auth of [null, "Bearer faux", `Basic ${SECRET}`, SECRET, `Bearer ${SECRET}x`]) {
    const out = await call(payload(), { auth });
    assert.equal(out.status, 401, String(auth));
    assert.equal(out.body, undefined, "aucun détail renvoyé");
  }
  assert.deepEqual(await brevoCalls(), []);
});

test("bascule fermée → 503 disabled ; ouverte sans liste → 503 misconfigured ; sans appel Brevo", async () => {
  for (const flag of [undefined, "", "off", "oui"]) {
    const out = await call(payload(), { env: { ...ON, ALTHOCE_INTAKE_TEST_MATURITE: flag } });
    assert.equal(out.status, 503, String(flag));
    assert.deepEqual(out.body, { status: "disabled" });
  }
  const noList = await call(payload(), { env: { ...ON, BREVO_LIST_TEST_MATURITE: undefined } });
  assert.deepEqual([noList.status, noList.body], [503, { status: "misconfigured" }]);
  assert.deepEqual(await brevoCalls(), []);
});

test("débit : garde-fou par instance (60 / min) → 429", async () => {
  const outs = [];
  for (let i = 0; i < 61; i++) outs.push((await call(payload({ opposition_marketing: true }))).status);
  assert.deepEqual(outs.slice(0, 60).every((s) => s === 200), true);
  assert.equal(outs[60], 429);
});

test("route Next : même contrat (401 sans corps, 503 JSON non mis en cache)", async () => {
  const { POST } = await import("@/app/api/intake/test-maturite/route");
  const req = (auth?: string) => new NextRequest("http://localhost/api/intake/test-maturite", {
    method: "POST", headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(payload()),
  });
  process.env.SEQUENCE_API_SECRET = SECRET;
  try {
    const denied = await POST(req("Bearer faux"));
    assert.deepEqual([denied.status, await denied.text()], [401, ""]);
    const closed = await POST(req(`Bearer ${SECRET}`));
    assert.equal(closed.status, 503);
    assert.equal(closed.headers.get("cache-control"), "no-store");
    assert.deepEqual(await closed.json(), { status: "disabled" });
  } finally {
    delete process.env.SEQUENCE_API_SECRET;
  }
  assert.deepEqual(await brevoCalls(), []);
});

/* ── Corps ───────────────────────────────────────────────────────────── */

test("corps invalide → 400 avec le champ en cause, jamais d'appel Brevo", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [payload({ secteur_slug: "banque" }), "secteur_slug"],
    [payload({ taille: "1 à 9 personnes" }), "taille"],
    [payload({ score: 120 }), "score"],
    [payload({ score: "42" }), "score"],
    [payload({ stade: 5 }), "stade"],
    [payload({ prenom: "" }), "prenom"],
    [payload({ prenom: "<b>Claire</b>" }), "prenom"],
    [payload({ role: "https://exemple.fr" }), "role"],
    [payload({ opposition_marketing: "non" }), "opposition_marketing"],
    [payload({ source_url: "javascript:alert(1)" }), "source_url"],
    [payload({ secteur_personnalise: "x".repeat(81) }), "secteur_personnalise"],
    [payload({ secteur_personnalise: "<img src=x>" }), "secteur_personnalise"],
    [{ ...payload(), telephone: "0612345678" }, "unknown_keys"],
  ];
  for (const [body, field] of cases) {
    const out = await call(body);
    assert.equal(out.status, 400, field);
    assert.deepEqual(out.body, { status: "invalid_body", field }, field);
  }
  const { email: _e, ...missing } = payload();
  void _e;
  assert.deepEqual((await call(missing)).body, { status: "invalid_body", field: "email" });
  assert.deepEqual((await call("{pas du json", { raw: true })).body, { status: "invalid_body", reason: "json" });
  const big = await call(payload({ secteur_personnalise: "x".repeat(9000) }));
  assert.deepEqual([big.status, big.body], [413, { status: "invalid_body", reason: "size" }]);
  assert.deepEqual(await brevoCalls(), []);
});

test("lien_resultat : préfixe althoce.com exigé, code de partage seulement", async () => {
  for (const lien of [
    "https://althoce.com/test-maturite-ia/",
    "https://althoce.com/test-maturite-ia/#resultat=",
    "http://althoce.com/test-maturite-ia/#resultat=1.finance.0.0.0",
    "https://althoce.com.evil.fr/test-maturite-ia/#resultat=1.finance.0.0.0",
    "https://evil.fr/?u=https://althoce.com/test-maturite-ia/#resultat=1",
    "https://althoce.com/test-maturite-ia/#resultat=1.finance<script>",
    `https://althoce.com/test-maturite-ia/#resultat=${"1".repeat(81)}`,
  ]) {
    const out = await call(payload({ lien_resultat: lien }));
    assert.deepEqual([out.status, out.body], [400, { status: "invalid_body", field: "lien_resultat" }], lien);
  }
  assert.deepEqual(await brevoCalls(), []);
});

/* ── Comportement ────────────────────────────────────────────────────── */

test("opposition_marketing = true → 200 ignored, Brevo n'est même pas lu", async () => {
  const out = await call(payload({ opposition_marketing: true }));
  assert.deepEqual([out.status, out.body, out.followUp], [200, { status: "ignored" }, undefined]);
  assert.deepEqual(await brevoCalls(), []);
});

test("adresse refusée par les contrôles de la capture → 422 invalid_email, sans appel Brevo", async () => {
  const disposable = await call(payload({ email: "claire@yopmail.com" }));
  assert.deepEqual([disposable.status, disposable.body], [422, { status: "invalid_email", reason: "disposable" }]);
  const fake = await call(payload({ email: "test@test.com" }));
  assert.equal(fake.status, 422);
  const syntax = await call(payload({ email: "claire.martin@" }));
  assert.deepEqual(syntax.body, { status: "invalid_email", reason: "syntax" });
  assert.deepEqual(await brevoCalls(), []);
});

test("contact existant → 200 existing, ni attribut ni liste modifiés", async () => {
  const seeded = {
    email: "claire.martin@gmail.com",
    listIds: [10],
    attributes: { PRENOM: "Claire", NOM: "Martin", RESSOURCE: "12-cas-usage-experts-comptables", MARKETING_STATUS: "TO_REVIEW", VERTICAL: "FINANCE", LEAD_SCORE: 12 },
  };
  await fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify(seeded) });
  const before = (await state()).contacts;
  const out = await call(payload({ email: " Claire.Martin@Gmail.com ", prenom: "Clara", secteur_slug: "industrie" }));
  assert.deepEqual([out.status, out.body, out.followUp], [200, { status: "existing" }, undefined]);
  const s = await state();
  assert.deepEqual(s.contacts, before, "contact strictement inchangé");
  assert.deepEqual(s.requests, ["GET /v3/contacts/claire.martin%40gmail.com"], "une lecture, aucune écriture");
  assert.deepEqual(s.events, []);
});

test("création sans écrasement : un contact apparu entre lecture et écriture n'est pas modifié", async () => {
  await fetch(`${MOCK}/__seed`, { method: "POST", body: JSON.stringify({ email: "claire.martin@gmail.com", listIds: [10], attributes: { PRENOM: "Claire" } }) });
  const before = (await state()).contacts;
  const out = await contacts.createContactIfAbsent("claire.martin@gmail.com", { PRENOM: "Autre", RESSOURCE: "x" }, [LIST_ID]);
  assert.deepEqual(out, { created: false });
  assert.deepEqual((await state()).contacts, before);
});

test("nouveau contact FINANCE (expertise comptable) → attributs d'une nouvelle capture, liste dédiée, B2B_ELIGIBLE", async () => {
  const out = await call(payload());
  assert.deepEqual([out.status, out.body], [200, { status: "created", marketingStatus: "B2B_ELIGIBLE" }]);
  const s = await state();
  assert.equal(s.contacts.length, 1);
  const c = s.contacts[0];
  assert.equal(c.email, "claire.martin@gmail.com");
  assert.deepEqual(c.listIds, [LIST_ID], "liste dédiée uniquement");
  assert.equal(c.emailBlacklisted, false);
  const { MARKETING_OPTOUT_TOKEN, EMAIL_CONFIRM_TOKEN, ...attrs } = c.attributes;
  assert.equal(optout.readMarketingOptoutToken(MARKETING_OPTOUT_TOKEN), "claire.martin@gmail.com");
  assert.equal(confirm.readEmailConfirmToken(EMAIL_CONFIRM_TOKEN), "claire.martin@gmail.com");
  assert.deepEqual(attrs, {
    PRENOM: "Claire",
    RESSOURCE: "Test de maturité IA",
    SOURCE_INSCRIPTION: "test-maturite-ia",
    JOB_TITLE: "Dirigeant ou associé",
    VERTICAL: "FINANCE",
    SUBSECTOR: "EXPERTISE_COMPTABLE",
    MARKETING_STATUS: "B2B_ELIGIBLE",
    EMAIL_STATUS: "PENDING",
    LIFECYCLE_STAGE: "LEAD",
    // Comme toute nouvelle capture sans déclaration : 0, jamais le score du test (42).
    FORM_SCORE: 0,
    LEAD_SCORE: 0,
    LAST_QUALIFYING_ACTIVITY_AT: NOW.toISOString(),
    LAST_QUALIFYING_ACTIVITY_TYPE: "GUIDE_REQUEST",
  });
  // Ni email, ni séquence, ni n8n, ni événement avant la fin de la réponse.
  assert.deepEqual([s.emails, s.n8n, s.events], [[], [], []]);
  assert.deepEqual(s.requests, ["GET /v3/contacts/claire.martin%40gmail.com", "POST /v3/contacts"]);

  // Après la réponse : événement de la liste blanche avec les données propres au test.
  await out.followUp!();
  const ev = (await state()).events;
  assert.equal(ev.length, 1);
  assert.equal(ev[0].event_name, "lead_magnet_submitted");
  assert.deepEqual(ev[0].identifiers, { contact_id: c.id });
  assert.deepEqual(ev[0].event_properties, {
    resource: "Test de maturité IA", vertical: "FINANCE", subsector: "EXPERTISE_COMPTABLE",
    secteur: "comptabilite", taille: "10-49", role: "Dirigeant ou associé",
    score: 42, stade: 2, stade_nom: "Usages dispersés", offre_recommandee: "Formation IA Dirigeant & Associés",
    lien_resultat: "https://althoce.com/test-maturite-ia/#resultat=1.comptabilite.2.0.0123x01230123",
    is_new_contact: true, marketing_status: "B2B_ELIGIBLE", landing_page: "https://althoce.com/test-maturite-ia/",
  });
});

test("nouveau contact GENERAL (industrie) → TO_REVIEW, sans sous-secteur ; « autre » garde la précision dans l'événement", async () => {
  const out = await call(payload({ secteur_slug: "industrie", score: null, stade: null, stade_nom: null, role: "Responsable d’équipe" }));
  assert.deepEqual([out.status, out.body], [200, { status: "created", marketingStatus: "TO_REVIEW" }]);
  const c = (await state()).contacts[0];
  assert.equal(c.attributes.VERTICAL, "GENERAL");
  assert.equal("SUBSECTOR" in c.attributes, false);
  assert.equal(c.attributes.MARKETING_STATUS, "TO_REVIEW", "jamais CONSENT ni B2B_ELIGIBLE sans verticale métier");
  assert.equal(c.attributes.JOB_TITLE, "Responsable d’équipe");
  await out.followUp!();
  const props = (await state()).events[0].event_properties!;
  assert.equal("score" in props, false, "score non établi : propriété absente");

  await fetch(`${MOCK}/__reset`, { method: "POST" });
  const other = await call(payload({ email: "paul.durand@gmail.com", secteur_slug: "autre", secteur_personnalise: "  Cabinet de kinésithérapie  " }));
  assert.deepEqual(other.body, { status: "created", marketingStatus: "TO_REVIEW" });
  await other.followUp!();
  assert.equal((await state()).events[0].event_properties!.secteur_personnalise, "Cabinet de kinésithérapie");
});

test("finance → FINANCE sans sous-secteur (périmètre mixte), B2B_ELIGIBLE", async () => {
  const out = await call(payload({ secteur_slug: "finance" }));
  assert.deepEqual(out.body, { status: "created", marketingStatus: "B2B_ELIGIBLE" });
  const c = (await state()).contacts[0];
  assert.deepEqual([c.attributes.VERTICAL, c.attributes.SUBSECTOR], ["FINANCE", undefined]);
});

test("mode qa : adresse hors recette ignorée sans appel Brevo ; adresse QA créée avec IS_QA", async () => {
  const env = { ...ON, ALTHOCE_INTAKE_TEST_MATURITE: "qa", ALTHOCE_SEQUENCE_QA_EMAILS: "qa.althoce@gmail.com" };
  const skipped = await call(payload(), { env });
  assert.deepEqual([skipped.status, skipped.body], [200, { status: "skipped", reason: "qa" }]);
  assert.deepEqual(await brevoCalls(), []);
  const qa = await call(payload({ email: "QA.Althoce@gmail.com" }), { env });
  assert.deepEqual(qa.body, { status: "created", marketingStatus: "B2B_ELIGIBLE" });
  const c = (await state()).contacts[0];
  assert.deepEqual([c.email, c.attributes.IS_QA, c.listIds], ["qa.althoce@gmail.com", true, [LIST_ID]]);
});

test("Brevo en erreur → 502 sans détail du fournisseur", async () => {
  process.env.BREVO_API_KEY = "cle-refusee-par-le-faux-brevo";
  try {
    const out = await call(payload());
    assert.deepEqual([out.status, out.body, out.followUp], [502, { status: "error" }, undefined]);
  } finally {
    process.env.BREVO_API_KEY = MOCK_API_KEY;
  }
  assert.equal((await state()).contacts.length, 0);
});
