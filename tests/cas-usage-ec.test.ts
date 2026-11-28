import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAS_USAGE_EC as r } from "@/content/guides/cas-usage-experts-comptables";
import { PRE_AUDIT_BOOKING_URL } from "@/config/rdvPages";

/** Tous les textes affichés ou copiés depuis la ressource */
function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.before.flatMap((b) => [b.title, b.text]),
    ...r.families.flatMap((f) => ("note" in f && f.note ? [f.label, f.note.text, f.note.label] : [f.label])),
    ...r.cases.flatMap((c) => [c.title, c.result, c.prompt, c.practice]),
    r.start.title, ...r.start.steps.flatMap((s) => [s.title, s.text]), r.start.entry.title, r.start.entry.text,
    r.rdv.eyebrow, r.rdv.title, r.rdv.text,
  ];
}

test("15 cas d'usage : les 12 cas du guide Notion + 3 cas de saisie (28/11), dans l'ordre et par famille", () => {
  assert.deepEqual(r.cases.map((c) => c.number), Array.from({ length: 15 }, (_, i) => String(i + 1).padStart(2, "0")));
  assert.deepEqual(r.families.map((f) => [f.label, r.cases.filter((c) => c.family === f.id).length]), [
    ["Saisie et écritures", 3], ["Révision et analyse", 4], ["Relation client", 4], ["Organisation interne", 2], ["Conseil et technique", 2],
  ]);
  // les cas d'une famille se suivent (numérotation continue sur la page)
  const ordre = r.cases.map((c) => c.family).filter((f, i, a) => a.indexOf(f) === i);
  assert.deepEqual(ordre, r.families.map((f) => f.id));
  assert.deepEqual(r.cases.map((c) => c.title), [
    "Saisir les pièces comptables",
    "Catégoriser et rapprocher la banque",
    "Préparer le lettrage clients et fournisseurs",
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
  assert.deepEqual(r.cases.filter((c) => c.warning).map((c) => c.number), ["14", "15"]);
  assert.match(r.cases[14].practice, /pas comme source de droit/);
  // Points d'entrée du guide : préparer un rendez-vous (08) puis analyser une balance (04) ; temps repris du guide
  assert.deepEqual(r.start.entry.cases, ["08", "04"]);
  assert.equal(r.cases[7].title, "Préparer un rendez-vous client");
  assert.equal(r.cases[3].title, "Analyser une balance générale");
  assert.match(r.cases[7].practice, /45 minutes.*10 minutes/);
});

test("15 cas d'usage : saisie avec connecteur qui écrit (mention discrète) et résultats lourds en fichiers (Espoir, 28/11)", () => {
  // Les 3 cas de saisie : avec connecteur, l'IA prépare sans valider ; sans connecteur, un fichier d'import Excel
  for (const c of r.cases.filter((c) => c.family === "saisie")) {
    assert.match(c.prompt, /connecteur, prépare .* sans (les |le )?valider/, c.number);
    assert.match(c.prompt, /fichier Excel \(\.xlsx\)/, c.number);
  }
  const saisie = r.families.find((f) => f.id === "saisie");
  assert.ok(saisie && "note" in saisie, "mention du connecteur sous la famille Saisie");
  assert.match(saisie.note.text, /connecteur qui écrit/);
  assert.match(saisie.note.text, /Althoce/);
  // lien d'appel : l'agenda de démo, calendrier affiché directement
  assert.equal(saisie.note.url, "https://calendar.app.google/m6thfjDsXzEqKdkKA");
  // une seule famille porte une mention commerciale
  assert.equal(r.families.filter((f) => "note" in f).length, 1);
  // résultats lourds : un fichier propre plutôt qu'un pavé de texte
  const livrable = (titre: string) => r.cases.find((c) => c.title === titre)!.prompt;
  assert.match(livrable("Analyser une balance générale"), /fichier Excel \(\.xlsx\)/);
  assert.match(livrable("Comparer deux périodes comptables"), /fichier Excel \(\.xlsx\)/);
  assert.match(livrable("Analyser un grand livre fournisseurs"), /fichier Excel \(\.xlsx\)/);
  assert.match(livrable("Faire la synthèse rapide d'une plaquette"), /PDF d'une seule page/);
  assert.match(livrable("Créer un visuel pour expliquer les chiffres"), /PDF au format paysage/);
  assert.match(livrable("Faire sa veille réglementaire"), /fichier Excel \(\.xlsx\)/);
  assert.ok(r.before.some((b) => /Google Sheets/.test(b.text)), "Excel s'ouvre aussi dans Google Sheets");
  // ordre conservé : la dernière ligne des procédures reste la question des zones ambiguës
  assert.match(livrable("Créer des procédures internes"), /ambiguë ou incomplète\.$/);
});

test("15 cas d'usage : accès libre, ni formulaire ni ancien lien de réservation, typographie française", () => {
  for (const t of texts()) {
    assert.ok(t.trim(), "texte vide");
    assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
    assert.doesNotMatch(t, / [:;?!»]|« /, `espace sécable : ${t}`);
    assert.doesNotMatch(t, /\bFEC\b|OPCO|cal\.com/i, t);
  }
  const page = readFileSync("app/g/12-cas-usage-experts-comptables/page.tsx", "utf8");
  assert.doesNotMatch(page, /cal\.com|notion\.site|<form/i);
  // Bas de page (Espoir, 28/11) : l'agenda du pré-audit IA offert, ouvert, après les cas ; plus de « Une autre ressource gratuite »
  assert.match(page, /<BookingCalendar embedUrl=\{PRE_AUDIT_BOOKING_EMBED\} url=\{PRE_AUDIT_BOOKING_URL\}/);
  assert.ok(page.indexOf("<BookingCalendar") > page.indexOf('id="cas"'), "l'agenda vient après les cas");
  assert.doesNotMatch(page, /r\.next\b/);
  assert.ok(!("next" in r), "plus de bloc « Une autre ressource gratuite »");
  assert.equal(PRE_AUDIT_BOOKING_URL, "https://calendar.app.google/JmhxjFqk2kybuFLR9");
  // Bouton de démo du connecteur : un vrai bouton (style principal), pas un lien discret
  const bloc = page.slice(page.indexOf('"note" in f'), page.indexOf("</a>", page.indexOf('"note" in f')));
  assert.match(bloc, /className=\{`\$\{primary\}/);
});

test("newsletters du 17 et du 24/11 : un email par ressource, lien direct, sans formulaire ni rendez-vous", () => {
  const prompts = readFileSync("content/newsletters/2026-11-17-finance.md", "utf8");
  const cas = readFileSync("content/newsletters/2026-11-24-finance.md", "utf8");
  assert.match(prompts, /url: "https:\/\/guide-gratuit-pi\.vercel\.app\/g\/10-prompts-production-cabinet"/);
  assert.match(cas, /url: "https:\/\/guide-gratuit-pi\.vercel\.app\/g\/12-cas-usage-experts-comptables"/);
  for (const nl of [prompts, cas]) assert.doesNotMatch(nl, /\/r\/|notion\.site|calendar|cal\.com|\/rdv\//);
});
