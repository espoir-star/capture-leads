import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { PROMPTS_PRODUCTION as r } from "@/content/guides/prompts-production-cabinet";
import { OPEN_READERS, SHORT_LINKS, shortLinkPageExists, shortLinkTarget } from "@/config/shortLinks";
import { getRdvPage } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";
import { pathWithUtm } from "@/lib/tracking/utm";

/** Tous les textes affichés ou copiés depuis la ressource */
function texts(): string[] {
  const notes = r.families.map((f) => (f as { note?: string }).note).filter((n): n is string => !!n);
  assert.equal(notes.length, 1, "seule la saisie porte une note");
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.before.flatMap((b) => [b.title, b.text]),
    ...r.families.map((f) => f.label), ...notes,
    ...r.prompts.flatMap((p) => [p.title, p.result, p.prompt]),
    r.halfWork.title, r.halfWork.alone.label, r.halfWork.alone.title, r.halfWork.alone.text,
    r.halfWork.writer.label, r.halfWork.writer.title, ...r.halfWork.writer.done, r.halfWork.writer.text, r.halfWork.promise,
    r.applyPrompt.title, r.applyPrompt.text, r.applyPrompt.prompt,
    r.method.title, r.method.coverage, ...r.method.steps.flatMap((s) => [s.title, s.text]),
    r.software.title, r.software.custom, ...r.software.names,
  ];
}

test("10 prompts : les titres et les familles du post, dans l'ordre", () => {
  assert.deepEqual(r.prompts.map((p) => p.number), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  assert.deepEqual(r.families.map((f) => [f.label, r.prompts.filter((p) => p.family === f.id).length]), [
    ["Contrôle", 3], ["Saisie", 3], ["Analyse", 2], ["Relation client", 2],
  ]);
  assert.deepEqual(r.prompts.map((p) => p.title), [
    "Repérer les anomalies de la balance avant la révision",
    "Lister les comptes d'attente non soldés",
    "Vérifier la cohérence de la TVA",
    "Proposer une catégorie pour chaque transaction du mois",
    "Retrouver le bon fournisseur pour chaque facture",
    "Préparer le lettrage et lister ce qui reste ouvert",
    "Comparer N et N-1 avec les écarts expliqués",
    "Repérer les clients dont la trésorerie se tend",
    "Préparer un rendez-vous à partir des chiffres du dossier",
    "Rédiger les relances d'impayés, prêtes à relire",
  ]);
  assert.equal(r.halfWork.promise, "Plus de ressaisie. Et rien n'entre dans le dossier sans votre accord.");
  // Espoir, 02/11 : « lorsque les accès le permettent » retiré, aucune condition d'accès
  assert.doesNotMatch([r.method.coverage, ...r.method.steps.map((s) => s.text)].join(" "), /accès/);
});

test("10 prompts : indépendants du logiciel, l'IA propose et vous validez", () => {
  for (const p of r.prompts) {
    assert.match(p.prompt, /\[LOGICIEL\]/, p.number);
    assert.match(p.prompt, /\[NOM DU DOSSIER\]|\[LISTE DES DOSSIERS/, p.number);
  }
  // Saisie : rien n'est écrit avant la relecture ; l'écriture passe par le prompt d'application
  for (const p of r.prompts.filter((x) => x.family === "saisie")) {
    assert.match(p.prompt, /N'écris rien dans le logiciel|Ne lettre rien sans ma validation/, p.number);
    assert.match(p.prompt, /n°/, `tableau numéroté pour le prompt d'application : ${p.number}`);
  }
  assert.match(r.applyPrompt.prompt, /uniquement les lignes que j'ai validées/);
  assert.match(r.prompts.find((p) => p.number === "10")!.prompt, /n'envoie rien/);
});

test("10 prompts : faits validés, typographie française, ni FEC ni replay", () => {
  for (const t of texts()) {
    assert.ok(t.trim(), "texte vide");
    assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
    assert.doesNotMatch(t, / [:?!;»%€]|« /, `espace sécable : ${t}`);
    assert.doesNotMatch(t, /\bFEC\b/, `fichier FEC retiré (Espoir, 28/10) : ${t}`);
    assert.doesNotMatch(t, /\breplay\b|enregistr/i, `invitation au direct, sans replay : ${t}`);
  }
  // Espoir, 02/11 : en écriture, du sur mesure pour tous les logiciels ; branchement montré au webinar ; aucun lien vers Pennylane
  assert.match(r.software.custom, /connecteur sur mesure en écriture/);
  assert.match(r.method.steps[0].title, /sur mesure en écriture/);
  assert.ok(r.software.names.length >= 10 && r.software.names.includes("Pennylane"));
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  for (const src of [page, readFileSync("content/guides/prompts-production-cabinet.ts", "utf8")]) {
    assert.doesNotMatch(src, /pennylane\.com|Lecture et écriture|\.software\.map|softwareTitle|connecteur qui écrit|lorsque les accès/);
  }
  assert.match(page, /on vous l'explique \$\{[^}]+\}, avec une démo en direct/);
  assert.ok(getRdvPage(r.rdvSlug), "page d'audit, repli après le direct");
});

test("10 prompts : appels à l'action vers le webinar, puis l'audit, avec la même campagne que wb1 et au1", () => {
  const w = getWebinar(r.webinarSlug);
  assert.ok(w);
  assert.equal(r.campaigns.webinar, SHORT_LINKS.wb1.utm_campaign);
  assert.equal(r.campaigns.rdv, SHORT_LINKS.au1.utm_campaign);
  assert.equal(
    pathWithUtm(`/w/${w.slug}`, { ...r.fallbackUtm, utm_campaign: r.campaigns.webinar }),
    "/w/connecteurs-mcp-cabinets?utm_source=althoce&utm_medium=ressource&utm_campaign=webinar_connecteurs_mcp_20261105&utm_content=ressource_10_prompts"
  );
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.ok((page.match(/<SourceLink /g) ?? []).length >= 4, "au moins quatre appels à l'action");
  for (const id of ["avant", "prompts", "connecteur", "methode", "logiciels", "webinar", "rendez-vous"]) assert.match(page, new RegExp(`id="${id}"`), id);
  // Accès libre : aucun formulaire ni collecte sur la page
  assert.doesNotMatch(page, /<form|CaptureForm|fetch\(|localStorage|sendBeacon/);
  assert.doesNotMatch(readFileSync("components/SourceLink.tsx", "utf8"), /fetch\(|localStorage|sendBeacon|cookie/i);
});

test("liens internes : UTM nettoyés, valeur invalide ignorée, chemin seul sans UTM", () => {
  assert.equal(pathWithUtm("/w/x", {}), "/w/x");
  assert.equal(pathWithUtm("/w/x", { utm_source: "LinkedIn", utm_content: "pas un id !" }), "/w/x?utm_source=linkedin");
});

test("lecteurs en accès libre : page présente, lien court réservé sans date inventée", () => {
  for (const slug of OPEN_READERS) assert.ok(existsSync(`app/g/${slug}/page.tsx`), slug);
  assert.ok(shortLinkPageExists({ kind: "lecteur", slug: r.slug }));
  assert.equal(shortLinkPageExists({ kind: "lecteur", slug: "inconnu" }), false);
  assert.equal(SHORT_LINKS.pr1.slug, r.slug);
  assert.equal(SHORT_LINKS.pr1.utm_content, null);
  assert.equal(shortLinkTarget("pr1"), null);
});
