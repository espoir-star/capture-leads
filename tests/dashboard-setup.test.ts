import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardAttributePlan } from "@/scripts/brevo/setup-dashboard-guide";

test("configuration Dashboards : champs absents uniquement, relecture idempotente", () => {
  const plan = dashboardAttributePlan([], 123);
  assert.deepEqual(plan.map((a) => a.name), ["MG_REQ_123", "MG_SENT_123", "MG_ENROLLED_123"]);
  assert.ok(plan.every((a) => a.create && a.type === "text"));
  const existing = plan.map((a) => ({ name: a.name, type: "text", category: "normal" }));
  assert.ok(dashboardAttributePlan(existing, 123).every((a) => !a.create));
  assert.equal(dashboardAttributePlan(existing.slice(0, 1), 123).filter((a) => a.create).length, 2);
});

test("configuration Dashboards : type existant incompatible et ID invalide bloquent", () => {
  for (const attr of [{ type: "float", category: "normal" }, { type: "text", category: "transactional" }]) {
    assert.throws(() => dashboardAttributePlan([{ name: "MG_REQ_123", ...attr }], 123), /incompatible/);
  }
  for (const id of [0, -1, 1.5, NaN]) assert.throws(() => dashboardAttributePlan([], id), /invalide/);
});
