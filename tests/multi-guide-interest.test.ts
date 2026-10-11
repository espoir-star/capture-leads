import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeGuideInterests, guideInterestRows } from "@/lib/guides/interests";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
import { stepSendKey, deliverySendKey } from "@/lib/sequences/enrollment";

const PENNYLANE = "guide-claude-pennylane";
const META = "guide-claude-meta-ads";

test("multi-guide : deux listes de guides = deux ressources, sans duplication du contact", () => {
  const out = summarizeGuideInterests({ listIds: [6, 7], attributes: { RESSOURCE: META } });
  assert.equal(out.distinctCount, 2);
  assert.equal(out.multiGuide, true);
  assert.equal(out.latestSlug, META);
  assert.deepEqual(out.sectors, ["FINANCE", "MARKETING"]);
});

test("multi-guide : liste + dernière ressource identique ne comptent qu'une fois", () => {
  const out = summarizeGuideInterests({ listIds: [6, 6, 6], attributes: { RESSOURCE: PENNYLANE } });
  assert.equal(out.distinctCount, 1);
  assert.equal(out.multiGuide, false);
  assert.deepEqual(out.guides[0].evidence, ["guide_list", "latest_resource"]);
});

test("multi-guide : listes inconnues, webinar et spam de ressource ignorés", () => {
  const out = summarizeGuideInterests({ listIds: [9000, 9001], attributes: { RESSOURCE: "webinar-inconnu" } });
  assert.equal(out.distinctCount, 0);
  assert.equal(out.latestSlug, undefined);
});

test("multi-guide : dernière ressource QA sans liste reste visible, sans inventer les précédentes", () => {
  const out = summarizeGuideInterests({ listIds: [], attributes: { RESSOURCE: PENNYLANE } });
  assert.equal(out.distinctCount, 1);
  assert.equal(out.datesKnown, false);
  assert.deepEqual(out.guides[0].evidence, ["latest_resource"]);
});

test("multi-guide : aucun changement de score, d'opposition, de verticale ou d'attribution", () => {
  const contact = { listIds: [6, 7], attributes: { RESSOURCE: META, MARKETING_STATUS: "OPPOSED", VERTICAL: "FINANCE", LEAD_SCORE: 12, UTM_SOURCE: "linkedin" } };
  const before = JSON.stringify(contact);
  summarizeGuideInterests(contact);
  guideInterestRows(contact);
  assert.equal(JSON.stringify(contact), before);
});

test("multi-guide : l'alerte montre les ressources exactes, pas un téléchargement supposé", () => {
  const rows = guideInterestRows({ listIds: [6, 7], attributes: { RESSOURCE: META } });
  assert.equal(rows.find((r) => r.label === "Guides distincts associés")?.value, "2");
  assert.match(rows.find((r) => r.label === "Guides connus")!.value, /Pennylane/);
  assert.match(rows.find((r) => r.label === "Dernier guide demandé")!.value, /Meta Ads/);
  assert.doesNotMatch(JSON.stringify(rows), /a lu|a téléchargé/);
});

test("multi-guide : chaque guide possède une identité de séquence propre et réutilise les modèles", () => {
  const ids = Object.values(LEAD_MAGNETS).map((lm) => lm.sequence);
  assert.equal(new Set(ids).size, 9, "neuf ressources, neuf identités (pas neuf workflows n8n)");
  assert.ok(getSequence("guide-generique-v1"), "compatibilité des anciennes inscriptions signées");
  for (const lm of Object.values(LEAD_MAGNETS)) {
    const seq = getSequence(lm.sequence);
    assert.ok(seq, lm.slug);
    assert.equal(seq.steps.length, 1);
    assert.equal(seq.steps[0].offsetHours, 48);
    if (lm.slug !== "12-cas-usage-experts-comptables") assert.equal(seq.delivery, "generique.delivery");
  }
});

test("multi-guide : même contact, même jour, deux guides = deux clés de livraison et relance", () => {
  const now = new Date("2026-10-11T13:00:00Z");
  const a = LEAD_MAGNETS[PENNYLANE].sequence;
  const b = LEAD_MAGNETS[META].sequence;
  assert.notEqual(deliverySendKey(a, 1808, now), deliverySendKey(b, 1808, now));
  assert.notEqual(stepSendKey(a, 1808, "relance-j2"), stepSendKey(b, 1808, "relance-j2"));
  assert.equal(deliverySendKey(a, 1808, now), deliverySendKey(a, 1808, new Date(now.getTime() + 60000)));
  assert.equal(stepSendKey(a, 1808, "relance-j2"), stepSendKey(a, 1808, "relance-j2"));
});
