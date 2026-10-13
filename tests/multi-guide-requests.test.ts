import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { guideStateFields, multiGuidesEnabled, MULTI_GUIDE_ATTRIBUTES, MULTI_GUIDE_LAST_FOLLOWUP } from "@/config/multiGuides";
import { buildGuideRequest, guideSummaryAttributes, parseGuideRequest, guideDeliveryKey, guideEnrollmentKey, guideFollowupDecision } from "@/lib/guides/requests";

const A = "guide-claude-pennylane";
const B = "guide-claude-meta-ads";
const T = new Date("2026-10-11T12:00:00Z");
const H = 3_600_000;
const req = (slug: string, now = T) => buildGuideRequest(null, { slug, now, queued: true, enroll: true });

test("multi-guides : activation absente = désactivée, QA uniquement sur liste autorisée", () => {
  assert.equal(multiGuidesEnabled("a@test.fr", {}), false);
  assert.equal(multiGuidesEnabled("a@test.fr", { ALTHOCE_MULTI_GUIDES: "on" }), true);
  const env = { ALTHOCE_MULTI_GUIDES: "qa", ALTHOCE_SEQUENCE_QA_EMAILS: "qa@test.fr" };
  assert.equal(multiGuidesEnabled("QA@test.fr", env), true);
  assert.equal(multiGuidesEnabled("prospect@test.fr", env), false);
});

test("multi-guides : trois attributs par guide et sept communs, noms uniques et valides", () => {
  assert.equal(MULTI_GUIDE_ATTRIBUTES.length, Object.keys(LEAD_MAGNETS).length * 3 + 7);
  assert.equal(new Set(MULTI_GUIDE_ATTRIBUTES.map((x) => x.name)).size, MULTI_GUIDE_ATTRIBUTES.length);
  for (const a of MULTI_GUIDE_ATTRIBUTES) assert.match(a.name, /^[A-Z][A-Z0-9_]{0,49}$/);
});

test("multi-guides : deux demandes concurrentes distinctes ne touchent aucun champ commun", () => {
  const a = req(A), b = req(B);
  assert.equal(Object.keys(a.attributes).some((k) => k in b.attributes), false);
  const contact = { listIds: [], attributes: { ...a.attributes, ...b.attributes } };
  const summary = guideSummaryAttributes(contact, T);
  assert.equal(summary.GUIDES_COUNT, 2);
  assert.equal(summary.GUIDES_RECENT_30D, 2);
  assert.equal(summary.GUIDE_INTEREST_LEVEL, "MULTI_RECENT");
  assert.match(String(summary.GUIDES_NAMES), /Pennylane/);
});

test("multi-guides : provenance par guide sans réécriture du first touch", () => {
  const c = { listIds: [], attributes: { UTM_SOURCE: "linkedin", UTM_CONTENT: "LI_FIRST" } };
  const a = buildGuideRequest(c, { slug: A, now: T, queued: true, enroll: true, touch: { utm_source: "linkedin", utm_content: "LI_SECOND" } });
  assert.equal(a.record.source.utm_content, "LI_SECOND");
  assert.equal("UTM_SOURCE" in a.attributes, false);
  assert.equal(c.attributes.UTM_CONTENT, "LI_FIRST");
  assert.equal(parseGuideRequest(JSON.stringify(a.record), B), null);
});

test("multi-guides : redemande du même guide ne double ni le compteur ni l'ancre J+2", () => {
  const a = req(A);
  const c = { listIds: [6], attributes: a.attributes };
  const second = buildGuideRequest(c, { slug: A, now: new Date(T.getTime() + H), queued: true, enroll: true });
  assert.equal(second.record.followupAt, a.record.followupAt);
  assert.equal(guideEnrollmentKey(1808, a.record), guideEnrollmentKey(1808, second.record));
  assert.equal(guideDeliveryKey(1808, a.record), guideDeliveryKey(1808, second.record));
  assert.equal(guideSummaryAttributes({ listIds: [6], attributes: { ...a.attributes, ...second.attributes } }, new Date(T.getTime() + H)).GUIDES_COUNT, 1);
});

test("multi-guides : reçu ancien ne peut pas solder une demande du lendemain", () => {
  const first = req(A), tomorrow = req(A, new Date(T.getTime() + 24 * H));
  assert.notEqual(guideDeliveryKey(1808, first.record), guideDeliveryKey(1808, tomorrow.record));
  assert.notEqual(guideDeliveryKey(1808, first.record), guideDeliveryKey(1808, req(B).record));
});

test("multi-guides : anciennes listes sans dates ne sont pas récentes", () => {
  const summary = guideSummaryAttributes({ listIds: [6, 7, 10], attributes: {} }, T);
  assert.equal(summary.GUIDES_COUNT, 3);
  assert.equal(summary.GUIDES_RECENT_30D, 0);
  assert.equal(summary.GUIDE_INTEREST_LEVEL, "MULTI_KNOWN");
  assert.equal("LAST_GUIDE_REQUEST_AT" in summary, false);
  const old = req(A, new Date(T.getTime() - 31 * 24 * H));
  assert.equal(guideSummaryAttributes({ attributes: old.attributes }, T).GUIDES_RECENT_30D, 0);
});

test("multi-guides : seule la plus récente des relances rapprochées reste candidate", () => {
  const a = req(A), b = req(B, new Date(T.getTime() + H));
  const contact = { attributes: { ...a.attributes, ...b.attributes } };
  assert.deepEqual(guideFollowupDecision(contact, { r: A, s: a.record.sequenceId, t: T.getTime() }, new Date(T.getTime() + 48 * H)), { action: "stop", reason: "multi_guide_consolidated" });
  assert.deepEqual(guideFollowupDecision(contact, { r: B, s: b.record.sequenceId, t: T.getTime() + H }, new Date(T.getTime() + 49 * H)), { action: "send" });
});

test("multi-guides : départage déterministe de deux demandes à la même milliseconde", () => {
  const a = req(A), b = req(B), c = { attributes: { ...a.attributes, ...b.attributes } };
  const outcomes = [a, b].map(({ record: r }) => guideFollowupDecision(c, { r: r.slug, s: r.sequenceId, t: T.getTime() }, new Date(T.getTime() + 48 * H)).action);
  assert.equal(outcomes.filter((o) => o === "send").length, 1);
});

test("multi-guides : fréquence commerciale, pas de frein à la livraison", () => {
  const a = req(A);
  const c = { attributes: { ...a.attributes, [MULTI_GUIDE_LAST_FOLLOWUP]: new Date(T.getTime() + 47 * H).toISOString() } };
  assert.equal(guideFollowupDecision(c, { r: A, s: a.record.sequenceId, t: T.getTime() }, new Date(T.getTime() + 48 * H)).action, "wait");
  assert.equal(a.record.queued, true);
});

test("multi-guides : ancienne automation tracée mais jamais livrée une seconde fois", () => {
  const a = buildGuideRequest(null, { slug: A, now: T, queued: false, enroll: false });
  assert.equal(a.record.queued, false);
  assert.equal(a.record.followupAt, undefined);
  assert.equal(guideEnrollmentKey(1808, a.record), null);
});

test("multi-guides : attribut malformé ignoré, sans effacer les demandes valides", () => {
  const a = req(A);
  const c = { attributes: { ...a.attributes, [guideStateFields(B).request]: "{broken" } };
  assert.equal(guideSummaryAttributes(c, T).GUIDES_COUNT, 1);
  assert.equal(parseGuideRequest(JSON.stringify({ ...a.record, source: { password: "forbidden" } }), A), null);
});
