import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { RDV_PAGES, getRdvPage } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";

/** Tous les textes affichés d'une page de rendez-vous */
function texts(p: (typeof RDV_PAGES)[string]): string[] {
  return [
    p.metaTitle, p.metaDescription, p.eyebrow, p.title, p.subtitle, p.priceLabel, p.booking.title,
    p.host.name, p.host.role, p.deliverablesTitle, p.note.text,
    p.work.eyebrow, p.work.title, p.work.highlight.title, p.work.highlight.text, p.work.aside.title, p.work.aside.text,
    p.work.tasksMore, p.details.eyebrow, p.details.title, p.details.cta,
    ...p.deliverables.flatMap((d) => [d.title, d.text]),
    ...p.work.tasks,
    ...p.details.items.flatMap((s) => [s.title, s.text, ...(s.status === undefined ? [] : [s.status])]),
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
    assert.equal(p.booking.durationMin, 30);
    // Ancre de la liste détaillée : unique sur la page (les autres sections sont « apports », « creneaux », « ia »)
    assert.match(p.details.id, /^[a-z0-9-]+$/);
    assert.ok(!["apports", "creneaux", "creneaux-titre", "ia"].includes(p.details.id), p.details.id);
    assert.ok(p.deliverables.length > 0 && p.work.tasks.length > 0 && p.details.items.length > 0, p.slug);
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
  assert.equal(p.priceLabel, "Gratuit");
  assert.deepEqual(p.work.tasks, ["Catégoriser les transactions", "Affecter un tiers", "Ventiler une facture fournisseur", "Lettrer et rapprocher", "Passer des écritures"]);
  assert.match(p.work.tasksMore, /^Et d'autres tâches/, "liste non exhaustive");
  // Temps gagné : le texte du post, aucun chiffre ajouté
  assert.match(p.work.highlight.title, /une matinée par dossier/i);
  assert.match(p.work.highlight.title, /quelques minutes/);
  assert.match(p.note.text, /ne permet pas l'écriture/);
  assert.match(p.work.aside.text, /sans votre accord/);
  const pennylane = p.details.items.find((s) => s.title === "Pennylane");
  assert.ok(pennylane);
  assert.match(pennylane.text, /lecture seule/);
  assert.equal(pennylane.source?.url, "https://www.pennylane.com/fr/mcp");
  // Espoir, 28/10 : ACD, Loop, Sage GE, MyUnisoft, Inqom en écriture comme Pennylane ; logiciels fermés en sur mesure ; plus de FEC
  const status = (name: string) => p.details.items.find((s) => s.title.includes(name))?.status;
  for (const name of ["Pennylane", "ACD", "Cegid Loop", "Sage Génération Experts", "MyUnisoft", "Inqom"]) assert.equal(status(name), "Lecture et écriture", name);
  for (const name of ["Cegid Quadra", "Quadratus", "Coala", "Isacompta"]) assert.equal(status(name), "Sur mesure", name);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, `fichier FEC retiré : ${t}`);
});

test("démo agents IA : le texte du post du 10/11, l'agenda du pré-audit offert", () => {
  const p = getRdvPage("demo-agents-ia");
  assert.ok(p);
  // Agenda « Pré-audit IA offert - Althoce » (30 min, Google Meet), le même que les guides et les emails (lib/sequences/links.ts)
  assert.equal(p.booking.url, "https://calendar.app.google/JmhxjFqk2kybuFLR9");
  assert.equal(
    p.booking.embedUrl,
    "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3fJwV7FRh514CDPeI7xaMilYOxLNenoXdF9ZNlL4NRkEUuO5fK3TUzHRcdNsf4A3IwA8Xx0Xbl?gv=true&hl=fr"
  );
  assert.equal(p.priceLabel, "Offert");
  assert.match(p.eyebrow, /Pré-audit offert/);
  assert.equal(p.webinarSlug, undefined, "aucun webinar ouvert à proposer");
  // Les quatre tâches du post, dans l'ordre ; liste non exhaustive
  assert.deepEqual(p.work.tasks, [
    "La saisie et la production",
    "Le rapprochement bancaire",
    "La collecte des pièces auprès de vos clients",
    "La récupération des documents sur les espaces officiels : impôts, URSSAF, BODACC",
  ]);
  assert.match(p.work.tasksMore, /^Et bien d'autres tâches/);
  // Ce qui change pour le cabinet, puis « Vos données restent chez vous » : les phrases du post
  assert.match(p.work.aside.title, /Les agents préparent, vos collaborateurs valident/);
  assert.match(p.work.aside.text, /copier-coller entre cinq outils/);
  assert.match(p.work.highlight.text, /Un seul endroit pour suivre tous les dossiers/);
  const data = p.details.items.map((s) => `${s.title} ${s.text}`).join(" ");
  assert.match(data, /modèles hébergés en Europe, ou directement sur votre serveur/);
  assert.match(data, /IA grand public/);
  assert.match(data, /Rien ne part chez un client sans votre validation/);
  assert.match(p.subtitle, /ne quittent jamais l'Europe/);
  // Seuls chiffres : la durée (30 min) et « plus de 20 cabinets », écrit par Espoir dans le post
  assert.match(p.note.text, /plus de 20 cabinets/);
  assert.deepEqual([...new Set(texts(p).join(" ").match(/\d+/g))].sort(), ["20", "30"]);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, t);
});
