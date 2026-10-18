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

const OCTOBER = [
  ["2026-10-19", "+02:00", "Actualité IA & Finance", "/g/tableaux-de-bord-claude-cabinets"],
  ["2026-10-21", "+02:00", "Conseil pratique", "/g/tableaux-de-bord-claude-cabinets"],
  ["2026-10-23", "+02:00", "Pourquoi Althoce ?", "/g/mini-diagnostic-ia-finance"],
  ["2026-10-26", "+01:00", "Actualité IA & Finance", "ai-act-service-desk.ec.europa.eu"],
  ["2026-10-28", "+01:00", "Conseil pratique", "/g/12-skills-claude-finance"],
  ["2026-10-30", "+01:00", "Pourquoi Althoce ?", "/g/mini-diagnostic-ia-finance"],
] as const;

// Seules les éditions dont la programmation a été explicitement accordée (19/10 : accord d'Espoir le 18/10).
const SCHEDULED_WITH_CONSENT = new Set(["2026-10-19"]);

test("newsletters d'octobre : brouillons Brevo, programmés seulement sur accord, Finance, 8 h 30 à Paris (heure d'hiver le 25/10), un seul CTA", () => {
  for (const [date, offset, rubric, ctaPart] of OCTOBER) {
    const nl = loadNewsletter(`content/newsletters/${date}-finance.md`);
    if (SCHEDULED_WITH_CONSENT.has(date)) assert.ok(["created", "scheduled"].includes(nl.meta.status), `${date} : ${nl.meta.status}`);
    else assert.equal(nl.meta.status, "created", `${date} : ${nl.meta.status}`);
    assert.equal(nl.meta.audience, "finance");
    assert.equal(nl.meta.tag, "NL_FINANCE");
    assert.equal(nl.meta.utmCampaign, `nl_finance_${date.replaceAll("-", "")}`);
    assert.equal(nl.meta.scheduledAt, `${date}T08:30:00${offset}`);
    assert.equal(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(nl.meta.scheduledAt!)), "08:30");
    assert.equal(nl.meta.rubric, rubric);
    assert.ok(nl.meta.cta?.url.includes(ctaPart), date);
    const html = renderNewsletterHtml(nl);
    assert.match(html, /\{\{ unsubscribe \}\}/);
    assert.match(html, new RegExp(`utm_campaign=nl_finance_${date.replaceAll("-", "")}&amp;utm_content=cta`));
    assert.equal((html.match(/background-color:#1D9E75;border-radius:8px/g) ?? []).length, 1, `${date} : un seul bouton`);
    assert.doesNotMatch(html, /%%[A-Z_]+%%/);
    assert.ok(html.includes(rubric.replace("&", "&amp;")), `${date} : rubrique affichée`);
  }
});

test("newsletters Althoce du vendredi : la ressource mène à l'échange, pas de lien de réservation", () => {
  for (const date of ["2026-10-23", "2026-10-30"]) {
    const html = renderNewsletterHtml(loadNewsletter(`content/newsletters/${date}-finance.md`));
    assert.doesNotMatch(html, /cal\.com/);
  }
});
