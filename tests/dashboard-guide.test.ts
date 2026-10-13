import { test } from "node:test";
import assert from "node:assert/strict";
import { getLeadMagnet } from "@/config/leadMagnets";
import { activeGuideSequence } from "@/lib/sequences/switch";
import { guideParams } from "@/lib/sequences/links";
import { guideEmailPublication } from "@/config/guideEmailPublications";

test("Dashboards : QA réservée, mode sans-liste, identité et modèles publiés", () => {
  const lm = getLeadMagnet("tableaux-de-bord-claude-cabinets")!;
  assert.equal(lm.brevoListId, 19);
  assert.equal(lm.legacy.automationId, 0);
  assert.equal(activeGuideSequence(lm, {}, "qa@example.com"), null);
  const env = { ALTHOCE_SEQUENCE_GUIDES: `${lm.slug}:qa`, ALTHOCE_SEQUENCE_QA_EMAILS: "qa@example.com" };
  assert.equal(activeGuideSequence(lm, env, "visitor@example.com"), null);
  const qa = activeGuideSequence(lm, env, "qa@example.com")!;
  assert.equal(qa.seq.id, "guide-claude-dashboards-cabinets-v1");
  assert.equal(qa.addToList, false);
  assert.equal(qa.seq.steps[0].offsetHours, 48);
  assert.equal(guideEmailPublication("generique.delivery", "2").id, 43);
  assert.equal(guideEmailPublication("generique.relance-j2", "2").id, 44);
  const prod = activeGuideSequence(lm, { ALTHOCE_SEQUENCE_GUIDES: `${lm.slug}:sans-liste` }, "visitor@example.com")!;
  assert.equal(prod.addToList, false);
  assert.equal(prod.timeScale, 1);
});

test("guide interne : lien absolu dans les emails, domaine Preview respecté, anciens liens conservés", () => {
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://qa.althoce.example";
    assert.equal(guideParams("tableaux-de-bord-claude-cabinets")?.GUIDE_URL, "https://qa.althoce.example/g/tableaux-de-bord-claude-cabinets");
    assert.match(guideParams("guide-claude-pennylane")!.GUIDE_URL, /^https:\/\//);
    assert.equal(guideParams("inconnu"), null);
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});
