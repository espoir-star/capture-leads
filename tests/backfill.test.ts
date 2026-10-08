import { test } from "node:test";
import assert from "node:assert/strict";
import { planContactBackfill, type BackfillContext } from "@/lib/backfill/plan";
import type { BrevoContact } from "@/lib/brevo/api";
import type { DnsVerdict } from "@/lib/data-quality/email";

const ctx = (over: Partial<BackfillContext> = {}): BackfillContext => ({
  hardBounces: new Set(),
  dnsVerdict: new Map<string, DnsVerdict>([["cabinet.fr", "ok"]]),
  ...over,
});

function contact(attributes: BrevoContact["attributes"], listIds: number[] = [10], email = "jean@cabinet.fr"): BrevoContact {
  return { id: 7, email, emailBlacklisted: false, listIds, attributes };
}

const FORBIDDEN = ["OPT_IN", "LEAD_SCORE", "UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT"];

test("F · contact historique sans données qualité : aucun statut de validation inventé", () => {
  const { set } = planContactBackfill(contact({ PRENOM: "Jean", SMS: "33645871239" }), ctx());
  assert.equal("EMAIL_STATUS" in set, false, "ni PENDING ni VERIFIED");
  assert.equal("PHONE_STATUS" in set, false, "jamais VALID_FORMAT sans preuve");
  for (const k of FORBIDDEN) assert.equal(k in set, false, k);
  // seule la provenance est reprise
  assert.equal(set.VERTICAL, "FINANCE");
  assert.equal(set.SUBSECTOR, "EXPERTISE_COMPTABLE");
  assert.equal(set.LIFECYCLE_STAGE, "LEAD");
});

test("F · aucun cas ne produit VERIFIED, VALID_FORMAT ou OPT_IN", () => {
  const cases = [
    contact({}),
    contact({ SMS: "33612345678" }),
    contact({ SMS: "33645871239", TEL_DOUBLON: "+33600000000" }),
    contact({ STATUT_APPEL: "Contacté" }, [6, 13]),
    contact({}, [14], "x@yopmail.com"),
  ];
  for (const c of cases) {
    const { set } = planContactBackfill(c, ctx({ withCommercialMapping: true }));
    assert.notEqual(set.EMAIL_STATUS, "VERIFIED");
    assert.notEqual(set.EMAIL_STATUS, "PENDING");
    assert.notEqual(set.PHONE_STATUS, "VALID_FORMAT");
    assert.notEqual(set.PHONE_STATUS, "VERIFIED");
    assert.equal("OPT_IN" in set, false);
  }
});

test("preuves négatives seulement : bounce Brevo, jetable, domaine sans réception, SMS douteux", () => {
  assert.equal(planContactBackfill(contact({}), ctx({ hardBounces: new Set(["jean@cabinet.fr"]) })).set.EMAIL_STATUS, "BOUNCED");
  assert.equal(planContactBackfill(contact({}, [10], "x@yopmail.com"), ctx()).set.EMAIL_STATUS, "DISPOSABLE");
  assert.equal(planContactBackfill(contact({}, [10], "test@test.com"), ctx()).set.EMAIL_STATUS, "INVALID");
  const typo = ctx({ dnsVerdict: new Map([["orange.fe", "domain_not_found" as const]]) });
  assert.equal(planContactBackfill(contact({}, [10], "x@orange.fe"), typo).set.EMAIL_STATUS, "INVALID");
  const noMx = ctx({ dnsVerdict: new Map([["parking.fr", "no_mail_server" as const]]) });
  assert.equal(planContactBackfill(contact({}, [10], "x@parking.fr"), noMx).set.EMAIL_STATUS, "INVALID");
  const dnsDown = ctx({ dnsVerdict: new Map([["lent.fr", "dns_unavailable" as const]]) });
  assert.equal("EMAIL_STATUS" in planContactBackfill(contact({}, [10], "x@lent.fr"), dnsDown).set, false);
  assert.equal(planContactBackfill(contact({ SMS: "33612345678" }), ctx()).set.PHONE_STATUS, "SUSPECT");
  // numéro seulement dans TEL_DOUBLON : aucun SMS stocké → aucun PHONE_STATUS
  assert.equal("PHONE_STATUS" in planContactBackfill(contact({ TEL_DOUBLON: "+33692734067" }), ctx()).set, false);
});

test("jamais d'écrasement, provenance ambiguë ou conflictuelle laissée vide", () => {
  const filled = contact({ VERTICAL: "LEGAL", EMAIL_STATUS: "VERIFIED", PHONE_STATUS: "VERIFIED", LIFECYCLE_STAGE: "CLIENT" });
  assert.deepEqual(planContactBackfill(filled, ctx()).set, {});
  assert.equal("VERTICAL" in planContactBackfill(contact({}, [14]), ctx()).set, false, "liste data.gouv ambiguë");
  const conflict = planContactBackfill(contact({}, [10, 12]), ctx());
  assert.equal("VERTICAL" in conflict.set, false);
  assert.equal(conflict.conflicts.length, 1);
});

test("LEAD seulement sans statut commercial ; mapping commercial uniquement sur demande", () => {
  assert.equal(planContactBackfill(contact({ STATUT_APPEL: "À appeler" }), ctx()).set.LIFECYCLE_STAGE, "LEAD");
  assert.equal("LIFECYCLE_STAGE" in planContactBackfill(contact({ STATUT_APPEL: "RDV planifié" }), ctx()).set, false);
  assert.equal(
    planContactBackfill(contact({ STATUT_APPEL: "RDV planifié" }), ctx({ withCommercialMapping: true })).set.LIFECYCLE_STAGE,
    "MEETING_BOOKED"
  );
  assert.equal("LIFECYCLE_STAGE" in planContactBackfill(contact({}, [17]), ctx()).set, false, "hors liste LM");
});
