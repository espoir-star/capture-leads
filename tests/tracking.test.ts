import { test } from "node:test";
import assert from "node:assert/strict";
import { addUtmToUrl, cleanTouch, cleanUtm, resolveAttribution, utmFromSearchParams } from "@/lib/tracking/utm";

test("lecture des 4 UTM depuis l'URL LinkedIn", () => {
  const u = utmFromSearchParams(
    new URLSearchParams(
      "utm_source=linkedin&utm_medium=organic&utm_campaign=guide_experts_comptables&utm_content=LI_EC_20261008_01"
    )
  );
  assert.deepEqual(u, {
    utm_source: "linkedin",
    utm_medium: "organic",
    utm_campaign: "guide_experts_comptables",
    utm_content: "LI_EC_20261008_01",
  });
});

test("UTM nettoyés, jamais bloquants", () => {
  assert.deepEqual(cleanUtm({ utm_source: " LinkedIn ", utm_content: "<script>", utm_medium: 3 }), {
    utm_source: "linkedin",
  });
  assert.deepEqual(cleanUtm(null), {});
});

test("first touch prioritaire sur la visite courante (test 69)", () => {
  const first = cleanTouch({ utm_source: "linkedin", utm_content: "LI_EC_01", ts: Date.now() - 86400000 });
  const current = cleanTouch({ utm_source: "google", utm_content: "GOOGLE_01" });
  assert.equal(resolveAttribution(first, current).utm_source, "linkedin");
  assert.equal(resolveAttribution(first, current).utm_content, "LI_EC_01");
  assert.equal(resolveAttribution(undefined, current).utm_source, "google");
});

test("page d'arrivée : chemin seul, sans query", () => {
  assert.equal(cleanTouch({ utm_source: "x", landing_page: "/r/abc?email=a@b.fr" })?.landing_page, "/r/abc");
  assert.equal(cleanTouch({ utm_source: "x", landing_page: "https://evil" })?.landing_page, undefined);
});

test("UTM email : ajoutés sans jamais doubler un paramètre existant", () => {
  const utm = { utm_source: "brevo", utm_medium: "email", utm_campaign: "nl_finance_20261103" };
  assert.equal(
    addUtmToUrl("https://althoce.com/services", utm),
    "https://althoce.com/services?utm_source=brevo&utm_medium=email&utm_campaign=nl_finance_20261103"
  );
  const kept = addUtmToUrl("https://althoce.com/?utm_source=linkedin&a=1", utm);
  assert.equal(new URL(kept).searchParams.getAll("utm_source").join(), "linkedin");
  assert.equal(new URL(kept).searchParams.get("utm_campaign"), "nl_finance_20261103");
  assert.equal(addUtmToUrl("{{ unsubscribe }}", utm), "{{ unsubscribe }}");
  assert.equal(addUtmToUrl("mailto:a@b.fr", utm), "mailto:a@b.fr");
});
