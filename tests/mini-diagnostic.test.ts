import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MINI_DIAGNOSTIC, MAX_SCORE, band, bestCandidate, score } from "@/content/guides/mini-diagnostic-ia-finance";

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
