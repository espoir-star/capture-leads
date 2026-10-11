import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCaptureAcknowledgement } from "@/lib/lead/captureResponse";
import { signLeadRef } from "@/lib/security/leadToken";

process.env.SIGNING_SECRET = "capture-response-unit-test-only";
const reference = () => signLeadRef(42, "12-cas-usage-experts-comptables")!;

test("capture : réponse serveur confirmée compatible avec signLeadRef", () => {
  const leadRef = reference();
  assert.ok(leadRef);
  assert.deepEqual(parseCaptureAcknowledgement(true, { ok: true, leadRef }), { ok: true, leadRef });
});

test("capture : opposition du serveur conservée après confirmation", () => {
  const leadRef = reference();
  assert.deepEqual(parseCaptureAcknowledgement(true, { ok: true, leadRef, marketing: "opposed" }), {
    ok: true, leadRef, marketing: "opposed",
  });
});

test("capture : succès factice du honeypot ne confirme jamais une inscription", () => {
  assert.equal(parseCaptureAcknowledgement(true, { ok: true }), null);
});

test("capture : HTTP en erreur ne confirme rien, même avec un corps ressemblant à un succès", () => {
  assert.equal(parseCaptureAcknowledgement(false, { ok: true, leadRef: reference() }), null);
});

test("capture : HTTP 2xx sans JSON valide ou sans ok=true refusé", () => {
  for (const body of [null, undefined, [], true, "ok", {}, { ok: "true", leadRef: reference() }, { ok: false, leadRef: reference() }]) {
    assert.equal(parseCaptureAcknowledgement(true, body), null);
  }
});

test("capture : référence absente, malformée ou surdimensionnée refusée", () => {
  for (const leadRef of [undefined, null, 42, "", "a.b", reference() + ".extra", "A".repeat(601)]) {
    assert.equal(parseCaptureAcknowledgement(true, { ok: true, leadRef }), null);
  }
});

test("capture : statut marketing inattendu refusé sans modification de préférence", () => {
  assert.equal(parseCaptureAcknowledgement(true, { ok: true, leadRef: reference(), marketing: "subscribed" }), null);
});
