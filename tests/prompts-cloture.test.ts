import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROMPTS_CLOTURE as r } from "@/content/guides/prompts-cloture-exercice";
import { OPEN_READERS, shortLinkTarget } from "@/config/shortLinks";
import { getRdvPage } from "@/config/rdvPages";

/** Tous les textes affichés ou copiés depuis la ressource */
function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.before.flatMap((b) => [b.title, b.text]),
    ...r.families.map((f) => f.label),
    ...r.prompts.flatMap((p) => [p.title, p.result, p.prompt]),
    r.guarantee, r.further.title, r.further.text,
  ];
}

test("10 prompts de clôture : 10 prompts en trois étapes, dans l'ordre", () => {
  assert.deepEqual(r.prompts.map((p) => p.number), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  assert.deepEqual(r.families.map((f) => [f.label, r.prompts.filter((p) => p.family === f.id).length]), [
    ["Préparer", 3], ["Contrôler", 5], ["Conclure", 2],
  ]);
});

test("10 prompts de clôture : indépendants du logiciel, l'IA propose et vous validez", () => {
  for (const p of r.prompts) {
    assert.match(p.prompt, /\[LOGICIEL\]/, p.number);
    assert.match(p.prompt, /\[NOM DU DOSSIER\]|\[LISTE DES DOSSIERS/, p.number);
  }
  // Rien n'est écrit ni envoyé sans validation
  for (const n of ["04", "05"]) assert.match(r.prompts.find((p) => p.number === n)!.prompt, /Ne passe (aucune écriture|rien)/, n);
  assert.match(r.prompts.find((p) => p.number === "02")!.prompt, /n'envoie rien/);
  assert.match(r.guarantee, /sans votre accord/);
});

test("10 prompts de clôture : aucun fait daté ni seuil imposé, typographie française, ni FEC", () => {
  for (const t of texts()) {
    assert.ok(t.trim(), "texte vide");
    assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
    assert.doesNotMatch(t, / [:?!;»%€]|« /, `espace sécable : ${t}`);
    assert.doesNotMatch(t, /\bFEC\b/, `jamais le mot FEC : ${t}`);
    assert.doesNotMatch(t, /\b20\d\d\b/, `aucune année figée : ${t}`);
  }
  // Les seuils réglementaires ne sont jamais imposés : ils restent entre crochets
  assert.match(r.prompts.find((p) => p.number === "07")!.prompt, /\[SEUIL EN\s€ HT\]/);
  assert.match(r.prompts.find((p) => p.number === "06")!.prompt, /\[SEUIL EN\s€\]/);
});

test("10 prompts de clôture : accès libre, agenda de l'audit sur la page, lien court du post du 18/11", () => {
  assert.ok(OPEN_READERS.includes(r.slug));
  const rdv = getRdvPage(r.rdvSlug);
  assert.ok(rdv?.booking.embedUrl, "agenda de l'audit");
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  for (const id of ["avant", "prompts", "rendez-vous", "creneaux"]) assert.match(page, new RegExp(`id="${id}"`), id);
  // Espoir, 18/11 : le créneau se réserve sur la page, sans renvoi vers une autre page
  assert.match(page, /<BookingCalendar embedUrl=\{rdv\.booking\.embedUrl\}/);
  assert.doesNotMatch(page, /href=\{?["`]\/rdv\//);
  assert.doesNotMatch(page, /<form|CaptureForm|fetch\(|localStorage|sendBeacon/);
  assert.equal(
    shortLinkTarget("cl1"),
    "/g/10-prompts-cloture-exercice?utm_source=linkedin&utm_medium=organic&utm_campaign=10_prompts_cloture_exercice&utm_content=LI_EC_20261118_01"
  );
});
