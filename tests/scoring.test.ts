import { test } from "node:test";
import assert from "node:assert/strict";
import { formIntentScore, isCallable, isEmailMarketable, mergeScore, nextLifecycleStage } from "@/lib/scoring";

test("score formulaire = horizon + besoin, max 15", () => {
  assert.equal(formIntentScore("DEPLOYER_AGENT_IA", "MOINS_3_MOIS"), 12); // cas pilote
  assert.equal(formIntentScore("AUTOMATISER_PROCESS", "IMMEDIAT"), 15);
  assert.equal(formIntentScore("DIAGNOSTIC_STRATEGIE", "TROIS_SIX_MOIS"), 8);
  assert.equal(formIntentScore("FORMER_EQUIPES", "SIX_DOUZE_MOIS"), 5);
  assert.equal(formIntentScore("VEILLE_IA", "PAS_DE_PROJET"), 1);
  assert.equal(formIntentScore("AUTRE", "PAS_DE_PROJET"), 1);
});

test("le score ne diminue jamais : max(existant, formulaire)", () => {
  assert.equal(mergeScore(30, 12), 30);
  assert.equal(mergeScore("30", 12), 30);
  assert.equal(mergeScore(undefined, 12), 12);
  assert.equal(mergeScore("", 7), 7);
  assert.equal(mergeScore("abc", 7), 7);
  assert.equal(mergeScore(5, 12), 12);
});

test("cycle de vie : LEAD à la création, jamais de rétrogradation", () => {
  const ctx = { score: 12, emailStatus: "PENDING" as const };
  assert.equal(nextLifecycleStage(undefined, ctx), "LEAD");
  assert.equal(nextLifecycleStage("SUBSCRIBER", ctx), "LEAD");
  assert.equal(nextLifecycleStage("MQL", ctx), "MQL");
  for (const s of ["CONTACTED", "MEETING_BOOKED", "OPPORTUNITY", "CLIENT", "LOST", "HOT_LEAD"]) {
    assert.equal(nextLifecycleStage(s, { score: 99, emailStatus: "PENDING" }), s);
  }
  assert.equal(nextLifecycleStage("valeur manuelle", ctx), "valeur manuelle");
});

test("HOT_LEAD seulement si score >= 25 et email exploitable", () => {
  assert.equal(nextLifecycleStage("LEAD", { score: 30, emailStatus: "PENDING" }), "HOT_LEAD");
  assert.equal(nextLifecycleStage("LEAD", { score: 24, emailStatus: "PENDING" }), "LEAD");
  for (const bad of ["INVALID", "DISPOSABLE", "BOUNCED"] as const) {
    assert.equal(nextLifecycleStage("LEAD", { score: 40, emailStatus: bad }), "LEAD");
  }
});

test("éligibilités data quality", () => {
  assert.equal(isEmailMarketable("PENDING"), true);
  assert.equal(isEmailMarketable("VERIFIED"), true);
  assert.equal(isEmailMarketable("BOUNCED"), false);
  assert.equal(isCallable("INVALID"), false);
  assert.equal(isCallable("SUSPECT"), true);
  assert.equal(isCallable(undefined), false);
});
