import { test } from "node:test";
import assert from "node:assert/strict";
import { readCommercialState } from "@/lib/sequences/commercial";
import { decideStep } from "@/lib/sequences/plan";
import { hasConfirmedMeeting, planScoreUpdate } from "@/lib/scoring/behavior";

const B2B = { MARKETING_STATUS: "B2B_ELIGIBLE", EMAIL_STATUS: "PENDING" };
const c = (attributes: Record<string, string>) => ({ attributes, emailBlacklisted: false });
const marketing = { category: "marketing" as const };
const transactional = { category: "transactional" as const };

test("CRM : valeurs réelles de Brevo classées explicitement", () => {
  const cases: [Record<string, string>, string][] = [
    [{}, "NONE"],
    [{ NOM_SETTER: "Setter A" }, "NONE"], // attribution seule ≠ prise en charge
    [{ STATUT_APPEL: "À appeler" }, "IMPORTED"],
    [{ STATUT_APPEL: "À rappeler" }, "ATTEMPTED"],
    [{ STATUT_APPEL: "A rappeler" }, "ATTEMPTED"],
    [{ STATUT_APPEL: "À relancer" }, "ATTEMPTED"],
    [{ STATUT_APPEL: "Contacté" }, "REACHED"],
    [{ STATUT_APPEL: "RDV planifié" }, "MEETING_CONFIRMED"],
    [{ STATUT_APPEL: "RDV booke" }, "MEETING_CONFIRMED"],
    [{ STATUT_APPEL: "Ne plus appeler" }, "DO_NOT_CALL"],
    [{ STATUT_APPEL: "Non qualifie" }, "DISQUALIFIED"],
    [{ ETAT_RDV: "Prévu" }, "MEETING_CONFIRMED"],
    [{ ETAT_RDV: "À préciser" }, "MEETING_TBD"],
    [{ ETAT_RDV: "Annulé" }, "MEETING_CANCELLED"],
    [{ ETAT_RDV: "Planifié" }, "UNKNOWN"], // valeur inconnue : jamais « confirmé »
    [{ TYPE_RDV: "R2" }, "MEETING_TBD"],
    [{ ETAPE_COMMERCIALE: "Négociation" }, "OPPORTUNITY"],
    [{ ETAPE_COMMERCIALE: "Projet reporté — à suivre" }, "DEFERRED"],
    [{ LIFECYCLE_STAGE: "HOT_LEAD" }, "NONE"],
    [{ LIFECYCLE_STAGE: "CLIENT" }, "CLIENT"],
    [{ STATUT_APPEL: "À appeler", ETAT_RDV: "Prévu" }, "MEETING_CONFIRMED"],
    [{ STATUT_APPEL: "Ne plus appeler", ETAT_RDV: "Prévu" }, "DO_NOT_CALL"], // le refus l'emporte
  ];
  for (const [attrs, expected] of cases) assert.equal(readCommercialState(attrs).state, expected, JSON.stringify(attrs));
});

test("CRM : relance guide maintenue pour une fiche importée ou seulement attribuée, suspendue dès la prise en charge", () => {
  assert.deepEqual(decideStep(c({ ...B2B, STATUT_APPEL: "À appeler" }), marketing), { send: true }, "import ≠ contact");
  assert.deepEqual(decideStep(c({ ...B2B, NOM_SETTER: "Setter A" }), marketing), { send: true });
  for (const v of ["À rappeler", "Contacté", "RDV planifié", "Ne plus appeler", "Non qualifie", "Valeur libre"]) {
    assert.deepEqual(decideStep(c({ ...B2B, STATUT_APPEL: v }), marketing), { send: false, reason: "commercial_cycle" }, v);
  }
  for (const v of ["Prévu", "À préciser", "Annulé"]) {
    assert.deepEqual(decideStep(c({ ...B2B, ETAT_RDV: v }), marketing), { send: false, reason: "commercial_cycle" }, v);
  }
});

test("CRM : la livraison d'un guide demandé ne dépend jamais de l'état commercial", () => {
  for (const v of ["Ne plus appeler", "RDV planifié", "Contacté"]) {
    assert.deepEqual(decideStep(c({ ...B2B, STATUT_APPEL: v }), transactional), { send: true }, v);
  }
  assert.deepEqual(decideStep(c({ ...B2B, LIFECYCLE_STAGE: "CLIENT" }), transactional), { send: true });
});

test("CRM : opposition marketing prioritaire ; « Ne plus appeler » ne lève aucun refus", () => {
  assert.deepEqual(decideStep(c({ MARKETING_STATUS: "OPPOSED", EMAIL_STATUS: "PENDING", STATUT_APPEL: "À appeler" }), marketing), { send: false, reason: "marketing_not_allowed" });
});

test("CRM : RDV compté (+25) seulement s'il est confirmé ; « À préciser » ne compte pas", () => {
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "Prévu" }), true);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "RDV planifié" }), true);
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "À préciser" }), false);
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "Planifié" }), false);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "Contacté" }), false);
});

test("CRM : pas d'alerte « lead chaud » pour une personne déjà prise en charge ou refusant l'appel", () => {
  const NOW = new Date("2026-10-12T08:00:00Z");
  const agg = { behavior: 15, lastClickAt: "2026-10-11T08:00:00Z" };
  const base = { LEAD_SCORE: 15, FORM_SCORE: 15, LIFECYCLE_STAGE: "LEAD", EMAIL_STATUS: "PENDING" };
  assert.equal(planScoreUpdate({ ...base }, agg, NOW).hotAlert, true, "aucune prise en charge : alerte");
  assert.equal(planScoreUpdate({ ...base, STATUT_APPEL: "À appeler" }, agg, NOW).hotAlert, true, "fiche importée à traiter : alerte");
  for (const v of ["À rappeler", "Contacté", "RDV planifié", "Ne plus appeler"]) {
    assert.equal(planScoreUpdate({ ...base, STATUT_APPEL: v }, agg, NOW).hotAlert, false, v);
  }
  assert.equal(planScoreUpdate({ ...base, ETAT_RDV: "À préciser" }, agg, NOW).hotAlert, false);
});
