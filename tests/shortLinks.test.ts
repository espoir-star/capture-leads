import { test } from "node:test";
import assert from "node:assert/strict";
import { SHORT_LINKS, shortLinkTarget } from "@/config/shortLinks";
import { getLeadMagnet } from "@/config/leadMagnets";
import { LINKEDIN_UTM_CONTENT_PATTERN } from "@/config/sourceRegistry";

test("liens courts : guide existant, code court, utm_content conforme et unique par post", () => {
  const contents = new Set<string>();
  for (const [code, l] of Object.entries(SHORT_LINKS)) {
    assert.match(code, /^[a-z0-9-]{1,20}$/, code);
    assert.ok(getLeadMagnet(l.slug), l.slug);
    if (l.utm_content === null) {
      assert.equal(shortLinkTarget(code), null, "code réservé, jamais diffusé avec une date inventée");
      continue;
    }
    assert.match(l.utm_content, LINKEDIN_UTM_CONTENT_PATTERN, code);
    assert.equal(contents.has(l.utm_content), false, `utm_content déjà utilisé : ${l.utm_content}`);
    contents.add(l.utm_content);
  }
});

test("liens courts : cible exacte, code inconnu et clés du prototype refusés", () => {
  assert.equal(
    shortLinkTarget("ec1"),
    "/r/12-cas-usage-experts-comptables?utm_source=linkedin&utm_medium=organic&utm_campaign=12_cas_usage_experts_comptables&utm_content=LI_EC_20261012_01"
  );
  assert.equal(shortLinkTarget("inconnu"), null);
  assert.equal(shortLinkTarget("toString"), null);
  assert.equal(shortLinkTarget("__proto__"), null);
});
