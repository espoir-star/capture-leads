import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MINI_DIAGNOSTIC, MAX_SCORE, band, bestCandidate, caseFor, ranking, roadmapSummary, score } from "@/content/guides/mini-diagnostic-ia-finance";

const full = { frequency: 3, repetition: 3, data: 2, control: 3 } as const;

test("score : somme des 4 critères sur 12, incomplet = pas de score", () => {
  assert.equal(MAX_SCORE, 12);
  assert.equal(score(full), 11);
  assert.equal(score({ frequency: 3, repetition: 3 }), null);
  assert.equal(band(11).label, "Bon candidat pour un premier test");
  assert.equal(band(8).label, "Possible après préparation");
  assert.equal(band(5).label, "À garder pour plus tard");
});

test("premier candidat : meilleur score, puis le plus facile à contrôler, jamais une tâche sans nom ou incomplète", () => {
  const tasks = [
    { name: "Reporting", ratings: { frequency: 3, repetition: 2, data: 3, control: 1 } as const },
    { name: "Relances", ratings: { frequency: 2, repetition: 3, data: 1, control: 3 } as const },
    { name: "", ratings: { frequency: 3, repetition: 3, data: 3, control: 3 } as const },
    { name: "Incomplète", ratings: { frequency: 3 } as const },
  ];
  assert.equal(bestCandidate(tasks)?.name, "Relances", "à égalité (9), la plus facile à contrôler");
  assert.equal(bestCandidate([]), null);
});

test("classement : tâches nommées et complètes seulement, dans l'ordre du premier candidat", () => {
  const tasks = [
    { name: "Reporting", ratings: { frequency: 3, repetition: 2, data: 3, control: 1 } as const },
    { name: "Relances", ratings: { frequency: 2, repetition: 3, data: 1, control: 3 } as const },
    { name: "Comptes rendus", ratings: { frequency: 3, repetition: 3, data: 3, control: 3 } as const },
    { name: "  ", ratings: { frequency: 3, repetition: 3, data: 3, control: 3 } as const },
    { name: "Incomplète", ratings: { frequency: 3 } as const },
  ];
  assert.deepEqual(ranking(tasks).map((t) => t.name), ["Comptes rendus", "Relances", "Reporting"]);
  assert.equal(bestCandidate(tasks)?.name, "Comptes rendus");
});

test("cas concrets : chaque exemple de l'étape 1 a son cas et ses suggestions de feuille de route", () => {
  for (const example of MINI_DIAGNOSTIC.examples) {
    const c = caseFor(`  ${example} `);
    assert.ok(c, example);
    for (const field of ["data", "validator", "indicator"] as const) assert.ok(c.suggestions[field].length > 10, `${example} : ${field}`);
  }
  assert.equal(caseFor("Une tâche personnelle"), null);
});

test("feuille de route : réponses, classement, champs manquants signalés, prochaine étape prudente", () => {
  const text = roadmapSummary(
    [
      { name: "Relances", ratings: { frequency: 2, repetition: 3, data: 1, control: 3 } },
      { name: "Reporting", ratings: { frequency: 3, repetition: 3, data: 3, control: 3 } },
      { name: "Sans note", ratings: {} },
    ],
    { process: "Reporting", data: " Exports autorisés ", validator: "", indicator: "" },
  );
  assert.match(text, /^Mini-diagnostic IA — ma première feuille de route/);
  assert.match(text, /Processus à tester : Reporting\n/);
  assert.match(text, /Données et applications nécessaires : Exports autorisés\n/);
  assert.match(text, /Validation des résultats : à compléter/);
  assert.match(text, /1\. Reporting — 12\/12 · Bon candidat pour un premier test\n2\. Relances — 9\/12 · Possible après préparation/);
  assert.doesNotMatch(text, /Sans note/);
  assert.match(text, /validation humaine/);
  assert.doesNotMatch(roadmapSummary([], {}), /Classement/);
});

test("page : un seul appel commercial (Cal.com), aucun formulaire ni envoi de données", () => {
  const page = readFileSync("app/g/mini-diagnostic-ia-finance/page.tsx", "utf8");
  const tool = readFileSync("components/MiniDiagnostic.tsx", "utf8");
  assert.equal((page.match(/cal\.com\/althoce-conseil-4ncbuz\/30min/g) ?? []).length, 1);
  assert.match(page, /Échanger 30 minutes avec Althoce/);
  assert.match(page, /robots:\{index:false,follow:false\}/);
  for (const src of [page, tool]) {
    assert.doesNotMatch(src, /<form|fetch\(|sendBeacon|localStorage|sessionStorage|gtag|dataLayer|CaptureForm/);
  }
  assert.ok(MINI_DIAGNOSTIC.sources.every((s) => s.url.startsWith("https://www.cnil.fr/")));
});
