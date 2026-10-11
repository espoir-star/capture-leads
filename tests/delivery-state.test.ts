import { test } from "node:test";
import assert from "node:assert/strict";
import { publicDeliveryState } from "@/lib/guides/deliveryState";
import { buildGuideRequest, guideDeliveryKey } from "@/lib/guides/requests";
import { guideStateFields } from "@/config/multiGuides";

const T = new Date("2026-10-11T19:40:24.585Z");
const MIN = 60_000;
const EC = "12-cas-usage-experts-comptables";
const at = (ms: number) => new Date(T.getTime() + ms);
const multi = (queued = true) => buildGuideRequest(null, { slug: EC, now: T, queued, enroll: true });
const contact = (attributes: Record<string, string>) => ({ id: 1810, attributes });

test("page merci : demande multi-guides sans reçu → en cours, puis retardée après 10 min (cas #1810)", () => {
  const c = contact(multi().attributes as Record<string, string>);
  assert.equal(publicDeliveryState(c, EC, at(MIN)), "pending");
  assert.equal(publicDeliveryState(c, EC, at(11 * MIN)), "delayed");
});

test("page merci : reçu SENT de CETTE demande → accepté ; reçu d'une autre demande ignoré", () => {
  const r = multi();
  const sent = guideStateFields(EC).sent;
  const ok = JSON.stringify({ key: guideDeliveryKey(1810, r.record), status: "SENT", at: T.toISOString() });
  const other = JSON.stringify({ key: "0".repeat(32), status: "SENT", at: T.toISOString() });
  assert.equal(publicDeliveryState(contact({ ...(r.attributes as Record<string, string>), [sent]: ok }), EC, at(MIN)), "accepted");
  assert.equal(publicDeliveryState(contact({ ...(r.attributes as Record<string, string>), [sent]: other }), EC, at(MIN)), "pending");
  const expired = JSON.stringify({ key: guideDeliveryKey(1810, r.record), status: "EXPIRED", at: T.toISOString() });
  assert.equal(publicDeliveryState(contact({ ...(r.attributes as Record<string, string>), [sent]: expired }), EC, at(MIN)), "failed");
});

test("page merci : automation Brevo historique ou guide inconnu → état non observable", () => {
  assert.equal(publicDeliveryState(contact(multi(false).attributes as Record<string, string>), EC, at(MIN)), "unknown");
  assert.equal(publicDeliveryState(contact({}), EC, at(MIN)), "unknown");
  assert.equal(publicDeliveryState(contact({}), "inexistant", at(MIN)), "unknown");
});

test("page merci : tâche de livraison simple (GUIDE_DELIVERY_*) du même guide seulement", () => {
  const ref = `guide-12-cas-ec-v1|${EC}|${T.toISOString()}`;
  assert.equal(publicDeliveryState(contact({ GUIDE_DELIVERY_STATUS: "SENT", GUIDE_DELIVERY_REF: ref }), EC, at(MIN)), "accepted");
  assert.equal(publicDeliveryState(contact({ GUIDE_DELIVERY_STATUS: "PENDING", GUIDE_DELIVERY_REF: ref }), EC, at(MIN)), "pending");
  assert.equal(publicDeliveryState(contact({ GUIDE_DELIVERY_STATUS: "PENDING", GUIDE_DELIVERY_REF: ref }), EC, at(30 * MIN)), "delayed");
  assert.equal(publicDeliveryState(contact({ GUIDE_DELIVERY_STATUS: "EXPIRED", GUIDE_DELIVERY_REF: ref }), EC, at(MIN)), "failed");
  assert.equal(publicDeliveryState(contact({ GUIDE_DELIVERY_STATUS: "SENT", GUIDE_DELIVERY_REF: ref }), "guide-claude-pennylane", at(MIN)), "unknown");
});
