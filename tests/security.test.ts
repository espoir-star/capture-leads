import { test } from "node:test";
import assert from "node:assert/strict";
import { signLeadRef, verifyLeadRef } from "@/lib/security/leadToken";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { __resetRateLimits, isRateLimited, LEAD_LIMITS } from "@/lib/security/rateLimit";

process.env.SIGNING_SECRET = "secret-de-test";

test("leadRef : signé, infalsifiable, expirant", () => {
  const t = signLeadRef(1234, "12-cas-usage-experts-comptables")!;
  assert.deepEqual(
    { c: verifyLeadRef(t)?.c, s: verifyLeadRef(t)?.s },
    { c: 1234, s: "12-cas-usage-experts-comptables" }
  );
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ c: 1, s: "x", x: Date.now() + 1e6 })).toString("base64url");
  assert.equal(verifyLeadRef(`${forged}.${sig}`), null);
  assert.equal(verifyLeadRef(`${body}.AAAA`), null);
  assert.equal(verifyLeadRef(t, Date.now() + 25 * 3600 * 1000), null);
  assert.equal(t.includes("@"), false, "aucun email dans le jeton");
});

const fakeFetch = (payload: unknown, ok = true) =>
  (async () => ({ ok, status: ok ? 200 : 500, json: async () => payload })) as unknown as typeof fetch;

test("Turnstile : désactivé sans secret, refus sans jeton, fail-open si Cloudflare tombe", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.deepEqual(await verifyTurnstile(undefined), { ok: true, skipped: "not_configured" });

  process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
  assert.equal((await verifyTurnstile(undefined)).ok, false);
  assert.equal((await verifyTurnstile("token-valide-123", "1.2.3.4", fakeFetch({ success: true }))).ok, true);
  const rejected = await verifyTurnstile(
    "token-invalide-123",
    "1.2.3.4",
    fakeFetch({ success: false, "error-codes": ["invalid-input-response"] })
  );
  assert.equal(rejected.ok, false);
  const down = await verifyTurnstile("token-123456", "1.2.3.4", (async () => {
    throw new Error("réseau");
  }) as unknown as typeof fetch);
  assert.deepEqual(down, { ok: true, skipped: "unreachable" });
  delete process.env.TURNSTILE_SECRET_KEY;
});

test("rate limiting : 6/min par IP, IP distinctes indépendantes", () => {
  __resetRateLimits();
  const results = Array.from({ length: 7 }, () => isRateLimited("lead", "9.9.9.9", LEAD_LIMITS));
  assert.deepEqual(results, [false, false, false, false, false, false, true]);
  assert.equal(isRateLimited("lead", "8.8.8.8", LEAD_LIMITS), false);
});
