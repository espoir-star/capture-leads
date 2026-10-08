import { test } from "node:test";
import assert from "node:assert/strict";
import { loadNewsletter, renderMarkdown, renderNewsletterHtml } from "@/lib/newsletter";

test("exemple versionné : frontmatter valide, statut brouillon", () => {
  const nl = loadNewsletter("content/newsletters/2026-11-03-finance.md");
  assert.equal(nl.name, "NL 2026-11-03-finance");
  assert.equal(nl.meta.status, "draft");
  assert.equal(nl.meta.audience, "finance");
  assert.equal(nl.meta.tag, "NL_FINANCE");
});

test("rendu : UTM sur les liens, blocs cas d'usage / insight, pas de HTML brut", () => {
  const html = renderMarkdown(
    "Intro [guide](https://althoce.com/x?utm_source=linkedin)\n\n:::usecase Relances clients\nTexte **gras**\n:::\n\n<script>alert(1)</script>",
    { utm_source: "brevo", utm_medium: "email", utm_campaign: "nl_test" }
  );
  assert.match(html, /utm_source=linkedin/);
  assert.doesNotMatch(html, /utm_source=brevo/, "UTM existant jamais doublé");
  assert.match(html, /utm_campaign=nl_test/);
  assert.match(html, /CAS D’USAGE/);
  assert.match(html, /Relances clients/);
  assert.doesNotMatch(html, /<script>/);
});

test("email complet : désinscription Brevo, CTA tracé, aucun marqueur restant", () => {
  const nl = loadNewsletter("content/newsletters/2026-11-03-finance.md");
  const html = renderNewsletterHtml(nl);
  assert.match(html, /\{\{ unsubscribe \}\}/);
  assert.match(html, /\{\{ mirror \}\}/);
  assert.match(html, /cal\.com\/althoce-conseil-4ncbuz\/30min\?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=nl_finance_20261103&amp;utm_content=cta/);
  assert.doesNotMatch(html, /%%[A-Z_]+%%/);
  assert.doesNotMatch(html, /<script/i);
});
