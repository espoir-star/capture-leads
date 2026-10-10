import { test } from "node:test";
import assert from "node:assert/strict";
import { BEHAVIOR_POINTS, HOT_LEAD_THRESHOLD, SCORE_CAP } from "@/config/scoring";
import {
  aggregateLedger,
  classifyClick,
  clickCandidate,
  EVENT_KEY_RE,
  hasConfirmedMeeting,
  isLikelyBotClick,
  makeEvent,
  planScoreUpdate,
  toLedgerEvent,
  type LedgerRow,
} from "@/lib/scoring/behavior";
import { recordEvents } from "@/lib/scoring/ledger";

process.env.SIGNING_SECRET = "secret-de-test";

const NOW = new Date("2026-10-10T12:00:00Z");
const CAL = "https://cal.com/althoce-conseil-4ncbuz/30min";
const NOTION = "https://espoir-metareglage.notion.site/12-cas-d-usage-concrets-de-Claude";
const tx = (over: Record<string, unknown> = {}) => ({
  event: "click",
  email: "Lea@Cabinet.fr",
  "message-id": "<201798300811.5787683@relay.mailin.fr>",
  link: CAL,
  ts_event: 1791633600,
  template_id: 35,
  tags: ["sequence"],
  ...over,
});
const row = (key: string, contact: number, category: string, points: number, at = "2026-10-01T10:00:00Z"): LedgerRow => ({
  event_key: `clk.${key.repeat(32).slice(0, 32)}`,
  contact_id: contact,
  category,
  points,
  occurred_at: at,
});

test("barème appliqué (cahier des charges du 10/10/2026)", () => {
  assert.deepEqual(BEHAVIOR_POINTS, {
    content_click: 3,
    guide_click: 5,
    offer_click: 10,
    webinar_registered: 8,
    webinar_attended: 15,
    meeting_booked: 25,
  });
  assert.equal(HOT_LEAD_THRESHOLD, 25);
  assert.equal(SCORE_CAP, 100);
});

test("classification des liens : offre, guide, contenu ; désinscription, confirmation, mailto jamais comptés", () => {
  assert.equal(classifyClick(CAL), "offer_click");
  assert.equal(classifyClick(`${CAL}?utm_source=brevo`), "offer_click");
  assert.equal(classifyClick(NOTION), "guide_click");
  assert.equal(classifyClick("https://guide-gratuit-pi.vercel.app/r/12-cas-usage-experts-comptables?utm_source=newsletter"), "guide_click");
  assert.equal(classifyClick("https://www.linkedin.com/posts/espoir-123"), "content_click");
  assert.equal(classifyClick("https://guide-gratuit-pi.vercel.app/desinscription?t=x"), null);
  assert.equal(classifyClick("https://guide-gratuit-pi.vercel.app/api/marketing/unsubscribe?t=x"), null);
  assert.equal(classifyClick("https://guide-gratuit-pi.vercel.app/confirmer-email?t=x"), null);
  assert.equal(classifyClick("mailto:espoir@contact.althoce.com"), null);
  assert.equal(classifyClick(""), null);
  assert.equal(classifyClick("javascript:alert(1)"), null);
});

test("clic Brevo → événement : clé opaque (aucun email), stable au rejeu, une fois par email et par catégorie", () => {
  const a = clickCandidate(tx(), NOW)!;
  assert.equal(a.category, "offer_click");
  assert.equal(a.source, "brevo_transactional");
  assert.equal(a.ref, "modele:35");
  assert.equal(a.occurred_at, new Date(1791633600 * 1000).toISOString());
  const e = toLedgerEvent(a, 42);
  assert.match(e.event_key, EVENT_KEY_RE);
  assert.ok(!e.event_key.toLowerCase().includes("cabinet"), "pas d'email dans la clé");
  assert.equal(e.points, 10);

  const replay = toLedgerEvent(clickCandidate(tx(), NOW)!, 42);
  assert.equal(replay.event_key, e.event_key, "rejeu Brevo = même clé");
  const otherLinkSameCategory = toLedgerEvent(clickCandidate(tx({ link: `${CAL}?b=1` }), NOW)!, 42);
  assert.equal(otherLinkSameCategory.event_key, e.event_key, "2e lien RDV du même email = même clé");
  const guide = toLedgerEvent(clickCandidate(tx({ link: NOTION }), NOW)!, 42);
  assert.notEqual(guide.event_key, e.event_key, "guide ≠ offre");
  const otherEmail = toLedgerEvent(clickCandidate(tx({ "message-id": "<autre@relay>" }), NOW)!, 42);
  assert.notEqual(otherEmail.event_key, e.event_key, "autre email = autre clé");

  const camp = clickCandidate({ event: "click", email: "lea@cabinet.fr", camp_id: 41, URL: "https://www.linkedin.com/posts/x", ts_event: 1 }, NOW)!;
  assert.equal(camp.source, "brevo_marketing");
  assert.equal(camp.category, "content_click");
  assert.equal(camp.ref, "campagne:41");
});

test("clics ignorés : non-clic, email interne (tag d'alerte, y compris sous forme de chaîne JSON), sans référence", () => {
  assert.equal(clickCandidate(tx({ event: "opened" }), NOW), null);
  assert.equal(clickCandidate(tx({ tags: ["alerte-lead-chaud"] }), NOW), null);
  assert.equal(clickCandidate(tx({ tags: undefined, tag: '["alerte-sequences"]' }), NOW), null);
  assert.equal(clickCandidate(tx({ "message-id": undefined }), NOW), null);
  assert.equal(clickCandidate(tx({ link: "mailto:x@y.fr" }), NOW), null);
  assert.equal(clickCandidate(null, NOW), null);
  assert.equal(clickCandidate("click", NOW), null);
});

test("événements webinar / RDV : une clé par webinar et par contact, un seul RDV compté par contact", () => {
  const w1 = makeEvent("webinar_registered", 7, "ia-cabinet", "capture", NOW);
  assert.equal(w1.points, 8);
  assert.equal(makeEvent("webinar_registered", 7, "ia-cabinet", "capture", new Date()).event_key, w1.event_key);
  assert.notEqual(makeEvent("webinar_registered", 7, "autre-webinar", "capture", NOW).event_key, w1.event_key);
  assert.notEqual(makeEvent("webinar_attended", 7, "ia-cabinet", "webinar", NOW).event_key, w1.event_key);
  assert.equal(makeEvent("meeting_booked", 7, "crm", "crm", NOW).points, 25);
  assert.match(makeEvent("meeting_booked", 7, "crm", "crm", NOW).event_key, /^rdv\./);
});

test("RDV confirmé : valeurs commerciales relevées dans Brevo", () => {
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "Prévu" }), true);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "RDV planifié" }), true);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "RDV booke" }), true);
  assert.equal(hasConfirmedMeeting({ LIFECYCLE_STAGE: "MEETING_BOOKED" }), true);
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "À préciser" }), false);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "À appeler" }), false);
  assert.equal(hasConfirmedMeeting({}), false);
});

test("agrégat : doublons de clé ignorés, lignes invalides écartées, points bornés au barème, dates", () => {
  const rows = [
    row("a", 1, "offer_click", 10, "2026-10-01T10:00:00Z"),
    row("a", 1, "offer_click", 10, "2026-10-01T10:00:00Z"), // double insertion
    row("b", 1, "guide_click", 5, "2026-10-03T08:00:00Z"),
    { ...row("c", 1, "meeting_booked", 25, "2026-10-05T08:00:00Z"), event_key: `rdv.${"c".repeat(32)}` },
    row("d", 1, "content_click", 999), // points falsifiés → bornés à 3
    row("e", 2, "content_click", 3),
    row("f", 1, "inconnu", 50),
    { ...row("g", 1, "guide_click", 5), event_key: "pas-une-cle" },
    row("h", 0, "guide_click", 5),
  ];
  const agg = aggregateLedger(rows);
  const one = agg.find((x) => x.contactId === 1)!;
  assert.equal(one.behavior, 10 + 5 + 25 + 3);
  assert.equal(one.events, 4);
  assert.equal(one.lastClickAt, "2026-10-03T08:00:00.000Z", "le RDV n'est pas un clic");
  assert.equal(one.lastEngagementAt, "2026-10-05T08:00:00.000Z");
  assert.equal(agg.find((x) => x.contactId === 2)!.behavior, 3);
  assert.equal(agg.length, 2);
  assert.deepEqual(aggregateLedger([]), []);
});

test("score : contact historique → FORM_SCORE figé = min(LEAD_SCORE, 15), puis formulaire + comportement", () => {
  const p = planScoreUpdate({ LEAD_SCORE: 12, LIFECYCLE_STAGE: "LEAD" }, { behavior: 5, lastClickAt: "2026-10-03T08:00:00Z" }, NOW);
  assert.deepEqual(p.attributes, {
    FORM_SCORE: 12,
    BEHAVIOR_SCORE: 5,
    LEAD_SCORE: 17,
    SCORE_UPDATED_AT: "2026-10-10",
    LAST_EMAIL_CLICK_AT: "2026-10-03",
  });
  assert.equal(p.hotAlert, false);
  // Rejouer avec l'état obtenu : rien à écrire (idempotent)
  const again = planScoreUpdate({ LIFECYCLE_STAGE: "LEAD", ...p.attributes }, { behavior: 5, lastClickAt: "2026-10-03T08:00:00Z" }, NOW);
  assert.deepEqual(again.attributes, {});
});

test("score : jamais de baisse (score manuel, comportement déjà plus haut), plafond 100", () => {
  const manual = planScoreUpdate({ LEAD_SCORE: 40, LIFECYCLE_STAGE: "LEAD" }, { behavior: 10 }, NOW);
  assert.equal(manual.formScore, 15, "un score manuel n'est pas pris pour un score formulaire > 15");
  assert.equal(manual.score, 40);
  assert.equal("LEAD_SCORE" in manual.attributes, false);

  const lower = planScoreUpdate({ LEAD_SCORE: 30, FORM_SCORE: 10, BEHAVIOR_SCORE: 20, LIFECYCLE_STAGE: "HOT_LEAD" }, { behavior: 8 }, NOW);
  assert.equal(lower.behavior, 20);
  assert.deepEqual(lower.attributes, {});

  const capped = planScoreUpdate({ LEAD_SCORE: 10, FORM_SCORE: 15 }, { behavior: 200 }, NOW);
  assert.equal(capped.score, SCORE_CAP);
  const above = planScoreUpdate({ LEAD_SCORE: 120, FORM_SCORE: 15 }, { behavior: 200 }, NOW);
  assert.equal(above.score, 120, "un score saisi au-dessus du plafond n'est pas réduit");
});

test("lead chaud : promotion HOT_LEAD et alerte au passage du seuil, une seule fois, jamais pendant le cycle commercial", () => {
  const base = { LEAD_SCORE: 12, FORM_SCORE: 12, LIFECYCLE_STAGE: "LEAD", EMAIL_STATUS: "PENDING" };
  const hot = planScoreUpdate(base, { behavior: 15 }, NOW);
  assert.equal(hot.score, 27);
  assert.equal(hot.attributes.LIFECYCLE_STAGE, "HOT_LEAD");
  assert.equal(hot.hotAlert, true);

  assert.equal(planScoreUpdate({ ...base, HOT_ALERT_SENT_AT: "2026-10-09" }, { behavior: 15 }, NOW).hotAlert, false, "déjà alerté");
  assert.equal(planScoreUpdate(base, { behavior: 12 }, NOW).hotAlert, false, "24 < 25");
  assert.equal(planScoreUpdate({ ...base, EMAIL_STATUS: "BOUNCED" }, { behavior: 15 }, NOW).hotAlert, false);
  assert.equal(planScoreUpdate({ ...base, ETAT_RDV: "Prévu" }, { behavior: 15 }, NOW).hotAlert, false, "RDV en cours");
  assert.equal(planScoreUpdate({ ...base, LIFECYCLE_STAGE: "CONTACTED" }, { behavior: 15 }, NOW).hotAlert, false, "déjà contacté");
  assert.equal(planScoreUpdate({ ...base, STATUT_APPEL: "Ne plus appeler" }, { behavior: 15 }, NOW).hotAlert, false);

  const contacted = planScoreUpdate({ ...base, LIFECYCLE_STAGE: "CONTACTED" }, { behavior: 15 }, NOW);
  assert.equal("LIFECYCLE_STAGE" in contacted.attributes, false, "étape commerciale jamais modifiée");
  const noStage = planScoreUpdate({ LEAD_SCORE: 2 }, { behavior: 3 }, NOW);
  assert.equal("LIFECYCLE_STAGE" in noStage.attributes, false, "un clic de newsletter ne fait pas un LEAD");
});

test("journal n8n : non configuré, lots, reprises sur 5xx, refus définitif, réponse tronquée", async () => {
  const ev = makeEvent("meeting_booked", 3, "crm", "crm", NOW);
  assert.deepEqual(await recordEvents([ev], {}), { ok: false, reason: "not_configured" });

  const env = { N8N_EVENTS_WEBHOOK_URL: "https://n8n.test/webhook/x", N8N_WEBHOOK_TOKEN: "tok" };
  const calls: { auth: string | null; n: number }[] = [];
  const answers = [new Response("", { status: 503 }), new Response("{}", { status: 200 })];
  const ok = (body: { events: unknown[] }) => new Response(JSON.stringify({ ok: true, inserted: body.events.length, rows: [{ contact_id: 3 }] }));
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { events: unknown[] };
    calls.push({ auth: new Headers(init.headers).get("authorization"), n: body.events.length });
    return answers.shift() ?? ok(body);
  }) as unknown as typeof fetch;
  const r = await recordEvents(Array.from({ length: 150 }, () => ev), env, fetchImpl);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.inserted, 150);
  assert.equal(r.ok && r.rows.length, 2, "un lot de 100 + un lot de 50");
  assert.equal(calls[0].auth, "Bearer tok");
  assert.deepEqual(calls.map((c) => c.n), [100, 100, 100, 50], "503 puis réponse tronquée → réessais");

  const denied = await recordEvents([ev], env, (async () => new Response("", { status: 403 })) as unknown as typeof fetch);
  assert.deepEqual(denied, { ok: false, reason: "rejected", status: 403 });
});

test("robots : clic < 15 s après l'envoi ignoré ; heure d'envoi inconnue → compté ; horloges incohérentes → compté", () => {
  const sent = "2026-10-10T19:13:26.349Z";
  assert.equal(isLikelyBotClick({ sentAt: sent, occurred_at: "2026-10-10T19:13:40.874Z" }), true, "14 s : cas réel relevé");
  assert.equal(isLikelyBotClick({ sentAt: sent, occurred_at: "2026-10-10T19:14:00.000Z" }), false, "34 s");
  assert.equal(isLikelyBotClick({ occurred_at: "2026-10-10T19:13:40.874Z" }), false);
  assert.equal(isLikelyBotClick({ sentAt: sent, occurred_at: "2026-10-10T19:10:00.000Z" }), false);
  const camp = clickCandidate({ event: "click", email: "a@b.fr", camp_id: 3, URL: "https://www.linkedin.com/x", ts_sent: 1791633600, ts_event: 1791633605 }, NOW)!;
  assert.equal(isLikelyBotClick(camp), true, "campagne : ts_sent lu dans le webhook");
});

test("seuil HOT exact : 24 → pas d'alerte ; 25 → HOT_LEAD et alerte", () => {
  const base = { FORM_SCORE: 15, BEHAVIOR_SCORE: 9, LEAD_SCORE: 24, LIFECYCLE_STAGE: "LEAD", EMAIL_STATUS: "PENDING" };
  const at24 = planScoreUpdate(base, { behavior: 9 }, NOW);
  assert.equal(at24.score, 24);
  assert.equal(at24.hotAlert, false);
  const at25 = planScoreUpdate(base, { behavior: 10 }, NOW);
  assert.equal(at25.score, 25);
  assert.equal(at25.hotAlert, true);
  assert.equal(at25.attributes.LIFECYCLE_STAGE, "HOT_LEAD");
});
