import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAS_USAGE_EC as r } from "@/content/guides/cas-usage-experts-comptables";

/** Tous les textes affichés ou copiés depuis la ressource */
function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.before.flatMap((b) => [b.title, b.text]),
    ...r.families.map((f) => f.label),
    ...r.cases.flatMap((c) => [c.title, c.result, c.prompt, c.practice]),
    r.start.title, ...r.start.steps.flatMap((s) => [s.title, s.text]), r.start.entry.title, r.start.entry.text,
    r.next.eyebrow, r.next.title, r.next.text, r.next.button, r.booking.label,
  ];
}

test("12 cas d'usage : les 12 cas du guide Notion, dans l'ordre et par famille", () => {
  assert.deepEqual(r.cases.map((c) => c.number), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]);
  assert.deepEqual(r.families.map((f) => [f.label, r.cases.filter((c) => c.family === f.id).length]), [
    ["Production et révision", 4], ["Relation client", 4], ["Organisation interne", 2], ["Conseil et technique", 2],
  ]);
  assert.deepEqual(r.cases.map((c) => c.title), [
    "Analyser une balance générale",
    "Comparer deux périodes comptables",
    "Faire la synthèse rapide d'une plaquette",
    "Analyser un grand livre fournisseurs",
    "Préparer un rendez-vous client",
    "Créer un visuel pour expliquer les chiffres",
    "Rédiger des comptes rendus",
    "Préparer des emails et relances clients",
    "Créer des procédures internes",
    "Créer un assistant interne au cabinet",
    "Faire sa veille réglementaire",
    "Rédiger une note technique",
  ]);
  for (const c of r.cases) {
    assert.ok(c.result.trim() && c.prompt.trim() && c.practice.trim(), c.number);
    assert.match(c.prompt, /\[[A-ZÉÈ]/, `${c.number} : champ entre crochets à remplacer`);
  }
  // Points de vigilance du guide : la veille (sources à vérifier) et la note technique (références à vérifier)
  assert.deepEqual(r.cases.filter((c) => c.warning).map((c) => c.number), ["11", "12"]);
  assert.match(r.cases[11].practice, /pas comme source de droit/);
  // Points d'entrée du guide : cas 5 puis cas 1 ; temps du cas 5 repris du guide
  assert.deepEqual(r.start.entry.cases, ["05", "01"]);
  assert.match(r.cases[4].practice, /45 minutes.*10 minutes/);
});

test("12 cas d'usage : accès libre, ni formulaire ni ancien lien de réservation, typographie française", () => {
  for (const t of texts()) {
    assert.ok(t.trim(), "texte vide");
    assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
    assert.doesNotMatch(t, / [:;?!»]|« /, `espace sécable : ${t}`);
    assert.doesNotMatch(t, /\bFEC\b|OPCO|cal\.com/i, t);
  }
  const page = readFileSync("app/g/12-cas-usage-experts-comptables/page.tsx", "utf8");
  assert.doesNotMatch(page, /cal\.com|notion\.site|<form/i);
  // Appel principal : une autre ressource ; en bas de page, l'agenda du pré-audit (Google, lu par le CRM)
  assert.equal(r.next.href, "/g/10-prompts-production-cabinet");
  assert.equal(r.booking.url, "https://calendar.app.google/JmhxjFqk2kybuFLR9");
});

test("newsletters du 17 et du 24/11 : un email par ressource, lien direct, sans formulaire ni rendez-vous", () => {
  const prompts = readFileSync("content/newsletters/2026-11-17-finance.md", "utf8");
  const cas = readFileSync("content/newsletters/2026-11-24-finance.md", "utf8");
  assert.match(prompts, /url: "https:\/\/guide-gratuit-pi\.vercel\.app\/g\/10-prompts-production-cabinet"/);
  assert.match(cas, /url: "https:\/\/guide-gratuit-pi\.vercel\.app\/g\/12-cas-usage-experts-comptables"/);
  for (const nl of [prompts, cas]) assert.doesNotMatch(nl, /\/r\/|notion\.site|calendar|cal\.com|\/rdv\//);
});
