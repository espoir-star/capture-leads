import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhone } from "@/lib/data-quality/phone";

test("normalisation E.164", () => {
  assert.deepEqual(
    [checkPhone("06 45 87 12 39", "FR").e164, checkPhone("06 45 87 12 39", "FR").status],
    ["+33645871239", "VALID_FORMAT"]
  );
  assert.equal(checkPhone("+33 6 45 87 12 39", "BE").e164, "+33645871239"); // indicatif saisi prime
  assert.equal(checkPhone("0470 98 76 54", "BE").e164, "+32470987654");
});

test("faux manifestes → INVALID", () => {
  for (const n of ["0000000000", "1111111111", "9999999999", "0123456789", "0666666666"]) {
    assert.equal(checkPhone(n, "FR").status, "INVALID", n);
  }
});

test("impossibles techniquement → INVALID", () => {
  assert.equal(checkPhone("06123", "FR").status, "INVALID");
  assert.equal(checkPhone("abc", "FR").status, "INVALID");
  assert.equal(checkPhone("", "FR").status, "INVALID");
  assert.equal(checkPhone("06 12 34 56 78 99 99", "FR").status, "INVALID");
});

test("douteux mais plausibles → SUSPECT (stockés, signalés)", () => {
  assert.equal(checkPhone("06 12 34 56 78", "FR").status, "SUSPECT");
  assert.equal(checkPhone("06 06 06 06 06", "FR").status, "SUSPECT");
  assert.equal(checkPhone("06 00 00 00 00", "FR").status, "SUSPECT");
  assert.equal(checkPhone("08 99 12 34 56", "FR").status, "SUSPECT"); // surtaxé
});

test("pas d'excès de zèle : de vrais numéros avec petites suites passent", () => {
  // l'ancien filtre rejetait toute suite de 4 chiffres (« 2345 ») ou 4 chiffres identiques (« 0000 »)
  assert.equal(checkPhone("06 81 23 45 90", "FR").status, "VALID_FORMAT");
  assert.equal(checkPhone("01 42 00 00 12", "FR").status, "VALID_FORMAT");
});

test("DOM-TOM saisis avec +33 : repli automatique", () => {
  const r = checkPhone("0692 73 40 67", "FR");
  assert.equal(r.status, "VALID_FORMAT");
  assert.equal(r.e164, "+262692734067");
});

test("indicatifs à 0 significatif (Côte d'Ivoire) conservés", () => {
  assert.equal(checkPhone("07 09 72 85 51", "CI").e164, "+2250709728551");
});
