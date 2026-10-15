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
    [{ STATUT_APPEL: "RDV planifié" }, "MEETING_TBD"],
    [{ STATUT_APPEL: "RDV booke" }, "MEETING_TBD"],
    [{ STATUT_APPEL: "Ne plus appeler" }, "DO_NOT_CALL"],
    [{ STATUT_APPEL: "Non qualifie" }, "DISQUALIFIED"],
    [{ ETAT_RDV: "Prévu" }, "MEETING_TBD"],
    [{ ETAT_RDV: "À préciser" }, "MEETING_TBD"],
    [{ ETAT_RDV: "Annulé" }, "MEETING_CANCELLED"],
    [{ ETAT_RDV: "Planifié" }, "UNKNOWN"], // valeur inconnue : jamais « confirmé »
    [{ TYPE_RDV: "R2" }, "MEETING_TBD"],
    [{ ETAPE_COMMERCIALE: "Négociation" }, "OPPORTUNITY"],
    [{ ETAPE_COMMERCIALE: "Projet reporté — à suivre" }, "DEFERRED"],
    [{ LIFECYCLE_STAGE: "HOT_LEAD" }, "NONE"],
    [{ LIFECYCLE_STAGE: "CLIENT" }, "CLIENT"],
    [{ STATUT_APPEL: "À appeler", ETAT_RDV: "Prévu" }, "MEETING_TBD"],
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
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "Prévu" }), false);
  assert.equal(hasConfirmedMeeting({ STATUT_APPEL: "RDV planifié" }), false);
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

const projection = (status: string, version = 1) => ({
  CRM_SALES_STATUS: status, CRM_SALES_VERSION: version,
  CRM_SALES_UPDATED_AT: "2026-10-12T08:00:00Z", CRM_SALES_EVENT_ID: `qa-event-${version}`,
});
test("Contrat partagé : chaque retour CRM est réellement consommé par la décision de relance", () => {
  for (const status of ["RECEIVED", "ASSIGNED", "TAKEN_IN_CHARGE", "NO_ANSWER", "CONTACTED",
    "MEETING_PENDING", "MEETING_CONFIRMED", "MEETING_CANCELLED", "OPPORTUNITY", "CLIENT", "LOST",
    "DISQUALIFIED", "ARCHIVED", "DO_NOT_CALL", "OPPOSED", "UNVERIFIED"]) {
    const attributes = { ...B2B, ...projection(status) };
    const contact = { attributes, emailBlacklisted: false };
    assert.equal(decideStep(contact, marketing).send, ["RECEIVED", "ASSIGNED"].includes(status), status);
    assert.equal(decideStep(contact, transactional).send, true, status);
    assert.equal(hasConfirmedMeeting(attributes), status === "MEETING_CONFIRMED", status);
  }
});
test("Écarté par le CRM (UNVERIFIED) : relances et alerte HOT suspendues, reprises après réintégration", () => {
  const unverified = { ...B2B, ...projection("UNVERIFIED", 2), CRM_SALES_REASON: "FOREIGN_PHONE" };
  assert.equal(readCommercialState(unverified).state, "DISQUALIFIED");
  assert.equal(decideStep({ attributes: unverified, emailBlacklisted: false }, marketing).send, false);
  // Le motif reste dans Brevo après réintégration : seul le statut versionné compte.
  const back = { ...unverified, ...projection("RECEIVED", 3) };
  assert.equal(readCommercialState(back).state, "IMPORTED");
  assert.equal(decideStep({ attributes: back, emailBlacklisted: false }, marketing).send, true);
});
test("Une annulation récente prime sur les anciennes confirmations et ne donne aucun +25", () => {
  const attributes = { ...projection("MEETING_CANCELLED", 3), ETAT_RDV: "Confirmé", LIFECYCLE_STAGE: "MEETING_BOOKED" };
  assert.equal(readCommercialState(attributes).state, "MEETING_CANCELLED");
  assert.equal(hasConfirmedMeeting(attributes), false);
  assert.equal(hasConfirmedMeeting({ ETAT_RDV: "Annulé", LIFECYCLE_STAGE: "MEETING_BOOKED" }), false);
});
test("Projection partielle, inconnue ou ancien statut initial : pas de reprise des relances", () => {
  for (const attributes of [projection("FUTURE_STATUS"), projection("ASSIGNED", 0),
    { CRM_SALES_VERSION: 3 }, { ...projection("ASSIGNED"), ETAT_RDV: "Annulé" }]) {
    assert.equal(decideStep({ attributes: { ...B2B, ...attributes }, emailBlacklisted: false }, marketing).send, false);
  }
  for (const key of ["CRM_DO_NOT_CALL", "CRM_EMAIL_OPPOSED", "CRM_GLOBAL_OPPOSED"]) {
    assert.equal(readCommercialState({ ...projection("ASSIGNED"), [key]: true }).state, "DO_NOT_CALL");
  }
});
