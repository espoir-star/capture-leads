import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RDV_PAGES, getRdvPage } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";

/** Tous les textes affichés d'une page de rendez-vous */
function texts(p: (typeof RDV_PAGES)[string]): string[] {
  return [
    p.metaTitle, p.metaDescription, p.eyebrow, p.title, p.subtitle, p.booking.title, p.honesty,
    p.validation.title, p.validation.text, p.host.name, p.host.role, p.tasksMore,
    p.timeSaved.title, p.timeSaved.text, p.softwareTitle,
    ...p.deliverables.flatMap((d) => [d.title, d.text]),
    ...p.tasks,
    ...p.software.flatMap((s) => [s.names, s.status, s.text]),
  ];
}

test("pages de rendez-vous : agenda Google réel, intégrable, et page bien formée", () => {
  for (const p of Object.values(RDV_PAGES)) {
    assert.equal(getRdvPage(p.slug), p);
    assert.match(p.slug, /^[a-z0-9-]+$/);
    assert.match(p.booking.url, /^https:\/\/calendar\.app\.google\/[A-Za-z0-9]+$/);
    assert.match(p.booking.embedUrl, /^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\/[A-Za-z0-9_-]+\?gv=true(&hl=fr)?$/);
    assert.ok(existsSync(join(process.cwd(), "public", p.host.photo)), p.host.photo);
    assert.equal(p.title.split("<accent>").length, p.title.split("</accent>").length);
    if (p.webinarSlug) assert.ok(getWebinar(p.webinarSlug), p.webinarSlug);
    for (const t of texts(p)) {
      assert.ok(t.trim(), `texte vide sur ${p.slug}`);
      assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
      // Typographie française : espace insécable avant « : ? ! ; » et dans les guillemets (jamais seuls en début de ligne)
      assert.doesNotMatch(t, / [:?!;»]|« /, `espace sécable : ${t}`);
      assert.doesNotMatch(t, /€|\bprix\b|\bessai\b|\breplay\b/i, `vente sur rendez-vous, sans prix ni essai ni replay : ${t}`);
    }
  }
  assert.equal(getRdvPage("toString"), undefined);
  assert.equal(getRdvPage("__proto__"), undefined);
});

test("audit connecteurs : le texte du post, l'agenda des connecteurs, les logiciels validés par Espoir", () => {
  const p = getRdvPage("audit-connecteurs");
  assert.ok(p);
  // Même agenda que althoce.com/connecteurs (« Connecteurs IA MCP - By Althoce », 30 min)
  assert.equal(p.booking.url, "https://calendar.app.google/m6thfjDsXzEqKdkKA");
  assert.equal(p.booking.durationMin, 30);
  assert.match(p.eyebrow, /100\u00a0% gratuit/);
  assert.deepEqual(p.tasks, ["Catégoriser les transactions", "Affecter un tiers", "Ventiler une facture fournisseur", "Lettrer et rapprocher", "Passer des écritures"]);
  assert.match(p.tasksMore, /^Et d'autres tâches/, "liste non exhaustive");
  // Temps gagné : le texte du post, aucun chiffre ajouté
  assert.match(p.timeSaved.title, /une matinée par dossier/i);
  assert.match(p.timeSaved.title, /quelques minutes/);
  assert.match(p.honesty, /ne permet pas l'écriture/);
  assert.match(p.validation.text, /sans votre accord/);
  const pennylane = p.software.find((s) => s.names === "Pennylane");
  assert.ok(pennylane);
  assert.match(pennylane.text, /lecture seule/);
  assert.equal(pennylane.source?.url, "https://www.pennylane.com/fr/mcp");
  // Espoir, 28/10 : ACD, Loop, Sage GE, MyUnisoft, Inqom en écriture comme Pennylane ; logiciels fermés en sur mesure ; plus de FEC
  const status = (name: string) => p.software.find((s) => s.names.includes(name))?.status;
  for (const name of ["Pennylane", "ACD", "Cegid Loop", "Sage Génération Experts", "MyUnisoft", "Inqom"]) assert.equal(status(name), "Lecture et écriture", name);
  for (const name of ["Cegid Quadra", "Quadratus", "Coala", "Isacompta"]) assert.equal(status(name), "Sur mesure", name);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, `fichier FEC retiré : ${t}`);
});
