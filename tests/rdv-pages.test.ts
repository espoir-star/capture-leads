import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RDV_PAGES, getRdvPage, type RdvBlock, type RdvPage, type RdvPoint } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";

type Kind = RdvBlock["kind"];
type BlockOf<K extends Kind> = Extract<RdvBlock, { kind: K }>;

function blocks<K extends Kind>(p: RdvPage, kind: K): BlockOf<K>[] {
  return p.blocks.filter((b): b is BlockOf<K> => b.kind === kind);
}

function bloc<K extends Kind>(p: RdvPage, kind: K): BlockOf<K> {
  const [b] = blocks(p, kind);
  assert.ok(b, `${p.slug} : pas de bloc ${kind}`);
  return b;
}

/** Largeur et hauteur d'un WebP étendu (en-tête VP8X : largeur - 1 et hauteur - 1 sur 24 bits) */
function webpSize(file: string): [number, number] {
  assert.ok(existsSync(file), file);
  const b = readFileSync(file);
  assert.equal(b.toString("latin1", 0, 4) + b.toString("latin1", 8, 16), "RIFFWEBPVP8X", `${file} : WebP étendu attendu`);
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
}

/** Tous les textes affichés d'une page de rendez-vous */
function texts(p: RdvPage): string[] {
  const point = (x: RdvPoint) => [x.title, x.text];
  const out = [p.metaTitle, p.metaDescription, p.eyebrow, p.title, p.subtitle, p.priceLabel, p.booking.title, p.host.name, p.host.role];
  for (const b of p.blocks) {
    switch (b.kind) {
      case "apports":
        out.push(b.title, b.note.text, ...b.items.flatMap(point));
        break;
      case "cartes":
        out.push(b.eyebrow, b.title, ...b.items.flatMap(point));
        if (b.more !== undefined) out.push(b.more);
        if (b.highlight) out.push(...point(b.highlight));
        if (b.points) out.push(b.points.title, ...b.points.items);
        if (b.note) out.push(b.note.text);
        break;
      case "apercu":
        out.push(b.eyebrow, b.title, b.image.alt, b.image.caption, ...b.items.flatMap(point));
        if (b.note) out.push(b.note.text);
        break;
      case "travail":
        out.push(b.eyebrow, b.title, ...point(b.highlight), ...b.tasks, b.tasksMore, ...point(b.aside));
        break;
      case "liste":
        out.push(b.eyebrow, b.title, b.cta, ...b.items.flatMap((s) => [s.title, s.text, ...(s.status === undefined ? [] : [s.status])]));
        break;
      case "agenda":
        break;
    }
  }
  return out;
}

test("pages de rendez-vous : agenda Google réel, intégrable, et page bien formée", () => {
  for (const p of Object.values(RDV_PAGES)) {
    assert.equal(getRdvPage(p.slug), p);
    assert.match(p.slug, /^[a-z0-9-]+$/);
    assert.match(p.booking.url, /^https:\/\/calendar\.app\.google\/[A-Za-z0-9]+$/);
    assert.match(p.booking.embedUrl, /^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\/[A-Za-z0-9_-]+\?gv=true(&hl=fr)?$/);
    assert.equal(p.booking.durationMin, 30);
    assert.ok(existsSync(join(process.cwd(), "public", p.host.photo)), p.host.photo);
    assert.equal(p.title.split("<accent>").length, p.title.split("</accent>").length);
    // Un seul agenda (ancre #creneaux), au plus un bloc d'apports (ancre #apports), ancres de section uniques
    assert.equal(blocks(p, "agenda").length, 1, p.slug);
    assert.ok(blocks(p, "apports").length <= 1, p.slug);
    const ids = p.blocks.flatMap((b) => ("id" in b ? [b.id] : []));
    assert.equal(new Set(ids).size, ids.length, `ancres en double : ${ids}`);
    for (const id of ids) {
      assert.match(id, /^[a-z0-9-]+$/);
      assert.ok(!["apports", "creneaux", "creneaux-titre"].includes(id), id);
    }
    for (const b of p.blocks) {
      if (b.kind === "cartes" || b.kind === "apports" || b.kind === "liste" || b.kind === "apercu") assert.ok(b.items.length > 0, `${p.slug} : ${b.kind} vide`);
      if (b.kind === "travail") assert.ok(b.tasks.length > 0, `${p.slug} : tâches vides`);
      // Capture : fichier présent dans public/ et dimensions déclarées = dimensions réelles (pas de déformation)
      if (b.kind === "apercu") assert.deepEqual(webpSize(join(process.cwd(), "public", b.image.src)), [b.image.width, b.image.height], b.image.src);
    }
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
  // Ordre validé le 28/10 : ce que l'audit apporte, l'agenda, puis le détail
  assert.deepEqual(p.blocks.map((b) => b.kind), ["apports", "agenda", "travail", "liste"]);
  // Même agenda que althoce.com/connecteurs (« Connecteurs IA MCP - By Althoce », 30 min)
  assert.equal(p.booking.url, "https://calendar.app.google/m6thfjDsXzEqKdkKA");
  assert.match(p.eyebrow, /100 % gratuit/);
  assert.equal(p.priceLabel, "Gratuit");
  const travail = bloc(p, "travail");
  assert.deepEqual(travail.tasks, ["Catégoriser les transactions", "Affecter un tiers", "Ventiler une facture fournisseur", "Lettrer et rapprocher", "Passer des écritures"]);
  assert.match(travail.tasksMore, /^Et d'autres tâches/, "liste non exhaustive");
  // Temps gagné : le texte du post, aucun chiffre ajouté
  assert.match(travail.highlight.title, /une matinée par dossier/i);
  assert.match(travail.highlight.title, /quelques minutes/);
  assert.match(bloc(p, "apports").note.text, /ne permet pas l'écriture/);
  assert.match(travail.aside.text, /sans votre accord/);
  const logiciels = bloc(p, "liste").items;
  const pennylane = logiciels.find((s) => s.title === "Pennylane");
  assert.ok(pennylane);
  assert.match(pennylane.text, /lecture seule/);
  assert.equal(pennylane.source?.url, "https://www.pennylane.com/fr/mcp");
  // Espoir, 28/10 : ACD, Loop, Sage GE, MyUnisoft, Inqom en écriture comme Pennylane ; logiciels fermés en sur mesure ; plus de FEC
  const status = (name: string) => logiciels.find((s) => s.title.includes(name))?.status;
  for (const name of ["Pennylane", "ACD", "Cegid Loop", "Sage Génération Experts", "MyUnisoft", "Inqom"]) assert.equal(status(name), "Lecture et écriture", name);
  for (const name of ["Cegid Quadra", "Quadratus", "Coala", "Isacompta"]) assert.equal(status(name), "Sur mesure", name);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, `fichier FEC retiré : ${t}`);
});

test("démo agents IA : les tâches du post d'abord, puis l'agenda du pré-audit offert, puis la démo", () => {
  const p = getRdvPage("demo-agents-ia");
  assert.ok(p);
  // Espoir, 10/11 : d'abord ce que la plateforme automatise, puis l'agenda, puis ce que la démo apporte
  assert.deepEqual(p.blocks.map((b) => b.kind), ["cartes", "agenda", "cartes", "liste"]);
  const [taches, demo] = blocks(p, "cartes");
  assert.equal(taches.id, "plateforme");
  assert.equal(demo.id, "demo");
  assert.equal(demo.title, "Ce que la démo vous apporte");
  // Agenda « Pré-audit IA offert - Althoce » (30 min, Google Meet), le même que les guides et les emails (lib/sequences/links.ts)
  assert.equal(p.booking.url, "https://calendar.app.google/JmhxjFqk2kybuFLR9");
  assert.equal(
    p.booking.embedUrl,
    "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3fJwV7FRh514CDPeI7xaMilYOxLNenoXdF9ZNlL4NRkEUuO5fK3TUzHRcdNsf4A3IwA8Xx0Xbl?gv=true&hl=fr"
  );
  assert.equal(p.priceLabel, "Offert");
  assert.match(p.eyebrow, /Pré-audit offert/);
  assert.equal(p.webinarSlug, undefined, "aucun webinar ouvert à proposer");
  // Les quatre tâches du post, dans l'ordre, chacune décrite ; liste non exhaustive
  assert.deepEqual(taches.items.map((t) => t.title), [
    "La saisie et la production",
    "Le rapprochement bancaire",
    "La collecte des pièces auprès de vos clients",
    "Les documents des espaces officiels",
  ]);
  assert.match(taches.items[3].text, /^Impôts, URSSAF, BODACC :/);
  assert.match(taches.items[2].text, /Rien ne part sans votre validation/);
  assert.match(taches.more ?? "", /^Et bien d'autres tâches/);
  // Ce qui change pour le cabinet : les trois phrases du post
  assert.deepEqual(taches.points?.items, [
    "Les agents préparent, vos collaborateurs valident",
    "Plus de copier-coller entre cinq outils",
    "Un seul endroit pour suivre tous les dossiers",
  ]);
  assert.match(demo.items[0].text, /sur de vrais dossiers/);
  // Vos données restent chez vous : les trois phrases du post
  const data = bloc(p, "liste").items.map((s) => `${s.title} ${s.text}`).join(" ");
  assert.match(data, /modèles hébergés en Europe, ou directement sur votre serveur/);
  assert.match(data, /IA grand public/);
  assert.match(data, /Rien ne part chez un client sans votre validation/);
  assert.match(p.subtitle, /ne quittent jamais l'Europe/);
  // Seuls chiffres : la durée (30 min) et « plus de 20 cabinets », écrit par Espoir dans le post
  assert.match(taches.note?.text ?? "", /plus de 20 cabinets/);
  assert.deepEqual([...new Set(texts(p).join(" ").match(/\d+/g))].sort(), ["20", "30"]);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, t);
});

test("agent pièces : ce que fait l'agent, puis l'interface réelle, puis l'agenda du pré-audit, puis la démo", () => {
  const p = getRdvPage("agent-pieces");
  assert.ok(p);
  // Préférence d'Espoir (10/11) : d'abord ce que fait l'agent et comment, puis l'agenda, puis ce que la démo apporte
  assert.deepEqual(p.blocks.map((b) => b.kind), ["cartes", "apercu", "agenda", "cartes", "liste"]);
  const [agent, demo] = blocks(p, "cartes");
  assert.equal(agent.id, "agent");
  assert.equal(demo.title, "Ce que la démo vous apporte");
  // Agenda « Pré-audit IA offert - Althoce », le même que la démo du 10/11
  assert.equal(p.booking.url, getRdvPage("demo-agents-ia")?.booking.url);
  assert.equal(p.booking.embedUrl, getRdvPage("demo-agents-ia")?.booking.embedUrl);
  assert.match(p.eyebrow, /100 % gratuit/);
  assert.equal(p.webinarSlug, undefined);
  // Les quatre actions du post, dans l'ordre ; relance validée ; CFE et attestation URSSAF
  assert.deepEqual(agent.items.map((t) => t.title), [
    "Il repère les pièces manquantes",
    "Il relance le client",
    "Il récupère les documents officiels",
    "Il range tout au bon dossier",
  ]);
  assert.match(agent.items[1].text, /message prêt\. Vous le validez/);
  assert.match(agent.items[2].text, /avis de CFE/);
  assert.match(agent.items[2].text, /attestation URSSAF/);
  assert.equal(agent.highlight?.title, "Le matin, vous ne voyez que ce qui a changé");
  // L'interface : la capture d'Espoir (onglet Agents) et ce qu'elle montre
  const ui = bloc(p, "apercu");
  assert.equal(ui.image.src, "/rdv/onglet-agents.webp");
  for (const espace of ["Impôts", "URSSAF", "URSSAF · TNS", "INPI", "jedeclare.com", "BODACC"]) assert.ok(ui.items[0].text.includes(espace), espace);
  assert.ok(ui.items.some((i) => /dernier passage/.test(i.text)));
  assert.ok(ui.items.some((i) => /accès à rétablir/.test(i.text)));
  assert.ok(ui.items.some((i) => /Relever maintenant/.test(i.text)));
  assert.match(ui.note?.text ?? "", /saisie et le rapprochement\. Commencez par les pièces/);
  // Données : Europe ou serveur du cabinet, relance jamais envoyée sans validation
  const data = bloc(p, "liste").items.map((s) => `${s.title} ${s.text}`).join(" ");
  assert.match(data, /En Europe, ou sur votre propre serveur/);
  assert.match(data, /sans votre validation/);
  // Seuls chiffres : 100 % gratuit et 30 minutes
  assert.deepEqual([...new Set(texts(p).join(" ").match(/\d+/g))].sort(), ["100", "30"]);
  for (const t of texts(p)) assert.doesNotMatch(t, /\bFEC\b/, t);
});
