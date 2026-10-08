import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContactUpdate, withoutRejectedSms, type CaptureData } from "@/lib/lead/contactUpdate";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { checkPhone } from "@/lib/data-quality/phone";
import type { BrevoContact } from "@/lib/brevo/api";

const pilot = LEAD_MAGNETS["12-cas-usage-experts-comptables"];

function data(over: Partial<CaptureData> = {}): CaptureData {
  return {
    prenom: "Claire",
    nom: "Martin",
    besoin: "DEPLOYER_AGENT_IA",
    horizon: "MOINS_3_MOIS",
    optIn: false,
    phone: checkPhone("06 45 87 12 39", "FR"),
    attribution: {
      utm_source: "linkedin",
      utm_medium: "organic",
      utm_campaign: "guide_experts_comptables",
      utm_content: "LI_EC_20261008_01",
      landing_page: "/r/12-cas-usage-experts-comptables",
    },
    source: pilot,
    now: new Date("2026-10-08T09:00:00Z"),
    ...over,
  };
}

function contact(attributes: BrevoContact["attributes"], listIds = [10]): BrevoContact {
  return { id: 42, email: "claire@cabinet.fr", emailBlacklisted: false, listIds, attributes };
}

test("scénario pilote : nouveau contact (test 65)", () => {
  const u = buildContactUpdate(null, data());
  assert.equal(u.isNew, true);
  assert.deepEqual(u.attributes, {
    PRENOM: "Claire",
    NOM: "Martin",
    SMS: "+33645871239",
    RESSOURCE: "12-cas-usage-experts-comptables",
    SOURCE_INSCRIPTION: "page-capture",
    DATE_OPTIN: "2026-10-08T09:00:00.000Z",
    VERTICAL: "FINANCE",
    SUBSECTOR: "EXPERTISE_COMPTABLE",
    BESOIN_PRIORITAIRE: "DEPLOYER_AGENT_IA",
    HORIZON_PROJET: "MOINS_3_MOIS",
    UTM_SOURCE: "linkedin",
    UTM_MEDIUM: "organic",
    UTM_CAMPAIGN: "guide_experts_comptables",
    UTM_CONTENT: "LI_EC_20261008_01",
    EMAIL_STATUS: "PENDING",
    PHONE_STATUS: "VALID_FORMAT",
    LEAD_SCORE: 12,
    LIFECYCLE_STAGE: "LEAD",
    OPT_IN: false,
  });
});

test("first touch conservé : aucun UTM écrasé (test 69)", () => {
  const existing = contact({ UTM_SOURCE: "linkedin", UTM_CONTENT: "LI_EC_01" });
  const u = buildContactUpdate(
    existing,
    data({ attribution: { utm_source: "google", utm_content: "GOOGLE_01", utm_medium: "cpc" } })
  );
  for (const k of ["UTM_SOURCE", "UTM_MEDIUM", "UTM_CAMPAIGN", "UTM_CONTENT", "SOURCE_CONTENT_URL"]) {
    assert.equal(k in u.attributes, false, k);
  }
  assert.equal(u.firstTouchWritten, false);
});

test("score existant conservé : max(30, 12) = 30 (test 70)", () => {
  const u = buildContactUpdate(contact({ LEAD_SCORE: 30, LIFECYCLE_STAGE: "MQL" }), data());
  assert.equal(u.attributes.LEAD_SCORE, 30);
  assert.equal(u.formScore, 12);
  assert.equal(u.attributes.LIFECYCLE_STAGE, "HOT_LEAD"); // 30 >= 25 et email exploitable
});

test("contact existant d'un autre guide : mise à jour, pas de doublon (test 71)", () => {
  const existing = contact(
    { PRENOM: "Claire", VERTICAL: "LEGAL", SOURCE_INSCRIPTION: "page-capture", DATE_OPTIN: "2026-09-01T10:00:00Z", LIFECYCLE_STAGE: "LEAD", LEAD_SCORE: 5 },
    [12]
  );
  const u = buildContactUpdate(existing, data());
  assert.equal(u.isNew, false);
  assert.equal("VERTICAL" in u.attributes, false, "verticale précise conservée");
  assert.equal("SOURCE_INSCRIPTION" in u.attributes, false);
  assert.equal("DATE_OPTIN" in u.attributes, false, "date d'opt-in d'origine conservée");
  assert.equal(u.attributes.RESSOURCE, "12-cas-usage-experts-comptables");
  assert.equal(u.attributes.LEAD_SCORE, 12);
  assert.equal("LIFECYCLE_STAGE" in u.attributes, false, "inchangé");
});

test("verticale GENERAL complétée par une verticale précise", () => {
  const u = buildContactUpdate(contact({ VERTICAL: "GENERAL" }), data());
  assert.equal(u.attributes.VERTICAL, "FINANCE");
  assert.equal(u.attributes.SUBSECTOR, "EXPERTISE_COMPTABLE");
});

test("sous-secteur complété si même verticale et vide", () => {
  const u = buildContactUpdate(contact({ VERTICAL: "FINANCE" }), data());
  assert.equal(u.attributes.SUBSECTOR, "EXPERTISE_COMPTABLE");
  const u2 = buildContactUpdate(contact({ VERTICAL: "FINANCE", SUBSECTOR: "DAF_FINANCE" }), data());
  assert.equal("SUBSECTOR" in u2.attributes, false);
});

test("liste ambiguë : aucune verticale déduite", () => {
  const u = buildContactUpdate(null, data({ source: LEAD_MAGNETS["claude-data-gouv-20-prompts"] }));
  assert.equal("VERTICAL" in u.attributes, false);
  assert.equal("SUBSECTOR" in u.attributes, false);
});

test("EMAIL_STATUS : VERIFIED et BOUNCED conservés, sinon PENDING", () => {
  assert.equal("EMAIL_STATUS" in buildContactUpdate(contact({ EMAIL_STATUS: "VERIFIED" }), data()).attributes, false);
  assert.equal("EMAIL_STATUS" in buildContactUpdate(contact({ EMAIL_STATUS: "BOUNCED" }), data()).attributes, false);
  assert.equal(buildContactUpdate(contact({ EMAIL_STATUS: "INVALID" }), data()).attributes.EMAIL_STATUS, "PENDING");
});

test("BOUNCED ne devient jamais HOT_LEAD même avec un gros score", () => {
  const u = buildContactUpdate(contact({ EMAIL_STATUS: "BOUNCED", LEAD_SCORE: 50, LIFECYCLE_STAGE: "LEAD" }), data());
  assert.equal("LIFECYCLE_STAGE" in u.attributes, false);
});

test("PHONE_STATUS : VERIFIED (humain) conservé si le numéro est inchangé", () => {
  const same = buildContactUpdate(contact({ PHONE_STATUS: "VERIFIED", SMS: "33645871239" }), data());
  assert.equal(same.attributes.PHONE_STATUS, "VERIFIED");
  const changed = buildContactUpdate(contact({ PHONE_STATUS: "VERIFIED", SMS: "33600112233" }), data());
  assert.equal(changed.attributes.PHONE_STATUS, "VALID_FORMAT");
});

test("numéro douteux : stocké avec PHONE_STATUS = SUSPECT", () => {
  const u = buildContactUpdate(null, data({ phone: checkPhone("06 12 34 56 78", "FR") }));
  assert.equal(u.attributes.PHONE_STATUS, "SUSPECT");
  assert.equal(u.attributes.SMS, "+33612345678");
});

test("webinar : RESSOURCE non modifiée", () => {
  const u = buildContactUpdate(null, data({ kind: "webinar" }));
  assert.equal("RESSOURCE" in u.attributes, false);
});

/* ── A. SMS absent → PHONE_STATUS vide ─────────────────────────────── */

test("A · aucun numéro écrit → aucun PHONE_STATUS", () => {
  const u = buildContactUpdate(null, data({ phone: { status: "VALID_FORMAT", reason: "ok" } })); // sans e164
  assert.equal("SMS" in u.attributes, false);
  assert.equal("PHONE_STATUS" in u.attributes, false);
  assert.equal(u.phoneStatus, undefined);
});

test("A · SMS refusé par Brevo, aucun SMS stocké → PHONE_STATUS vide (jamais VALID_FORMAT)", () => {
  const u = buildContactUpdate(null, data());
  const retry = withoutRejectedSms(u.attributes, null);
  assert.equal("SMS" in retry, false);
  assert.equal("PHONE_STATUS" in retry, false);
  assert.equal(retry.TEL_DOUBLON, "+33645871239");

  // contact existant avec un ancien statut mais sans SMS : statut effacé
  const stale = contact({ PHONE_STATUS: "VALID_FORMAT" });
  assert.equal(withoutRejectedSms(buildContactUpdate(stale, data()).attributes, stale).PHONE_STATUS, "");
});

test("A · SMS refusé, contact ayant déjà un SMS → statut de CE SMS (VERIFIED conservé)", () => {
  const withSms = contact({ SMS: "33612345678", PHONE_STATUS: "VALID_FORMAT" });
  assert.equal(withoutRejectedSms(buildContactUpdate(withSms, data()).attributes, withSms).PHONE_STATUS, "SUSPECT");
  const verified = contact({ SMS: "33699887766", PHONE_STATUS: "VERIFIED" });
  assert.equal(withoutRejectedSms(buildContactUpdate(verified, data()).attributes, verified).PHONE_STATUS, "VERIFIED");
});

test("règle complète PHONE_STATUS : valide / douteux selon le SMS écrit", () => {
  assert.equal(buildContactUpdate(null, data()).attributes.PHONE_STATUS, "VALID_FORMAT");
  assert.equal(buildContactUpdate(null, data({ phone: checkPhone("06 12 34 56 78", "FR") })).attributes.PHONE_STATUS, "SUSPECT");
  // INVALID n'est jamais stocké par le formulaire : la saisie est refusée en amont (tests e2e 68)
  assert.equal(checkPhone("0000000000", "FR").e164, undefined);
});

/* ── B. Email valide sans interaction → PENDING ────────────────────── */

test("B · email techniquement valide, aucune interaction → PENDING, jamais VERIFIED", () => {
  assert.equal(buildContactUpdate(null, data()).attributes.EMAIL_STATUS, "PENDING");
  assert.equal(buildContactUpdate(contact({}), data()).attributes.EMAIL_STATUS, "PENDING");
  assert.equal(buildContactUpdate(contact({ EMAIL_STATUS: "PENDING" }), data()).attributes.EMAIL_STATUS, undefined);
});

/* ── OPT_IN : uniquement la case newsletter ────────────────────────── */

test("OPT_IN : case cochée → true ; non cochée → false ; un true existant n'est jamais rétrogradé", () => {
  assert.equal(buildContactUpdate(null, data({ optIn: true })).attributes.OPT_IN, true);
  assert.equal(buildContactUpdate(null, data({ optIn: false })).attributes.OPT_IN, false);
  assert.equal(buildContactUpdate(contact({}), data({ optIn: false })).attributes.OPT_IN, false);
  assert.equal("OPT_IN" in buildContactUpdate(contact({ OPT_IN: true }), data({ optIn: false })).attributes, false);
  assert.equal(buildContactUpdate(contact({ OPT_IN: false }), data({ optIn: true })).attributes.OPT_IN, true);
});

test("jeton de confirmation écrit une seule fois (lien stable)", () => {
  assert.equal(buildContactUpdate(null, data({ confirmToken: "v1.abc" })).attributes.EMAIL_CONFIRM_TOKEN, "v1.abc");
  assert.equal(
    "EMAIL_CONFIRM_TOKEN" in buildContactUpdate(contact({ EMAIL_CONFIRM_TOKEN: "v1.old" }), data({ confirmToken: "v1.new" })).attributes,
    false
  );
});
