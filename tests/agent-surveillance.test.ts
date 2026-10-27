import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_SURVEILLANCE as fiche, einvoiceTableTsv, manualReviewHours } from "@/content/guides/agent-surveillance";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget, SHORT_LINKS } from "@/config/shortLinks";
import { guideParams } from "@/lib/sequences/links";

const text = (v: unknown) => JSON.stringify(v);

test("Agent Surveillance : les quatre sources du post, dans l'ordre, avec ce que l'agent relève", () => {
  assert.deepEqual(fiche.sources.map((s) => s.name), ["Impôts", "URSSAF", "INPI et BODACC", "Facturation électronique"]);
  for (const s of fiche.sources) assert.ok(s.reads.length >= 3, s.id);
  const all = text(fiche.sources);
  for (const item of ["Avis de CFE", "taxe foncière", "Avis à payer", "Procédures collectives", "Mandats", "Raccordement"]) assert.ok(all.includes(item), item);
  assert.equal(fiche.steps.length, 3);
  assert.equal(fiche.guarantees.length, 3);
});

test("Agent Surveillance : checklist portail par portail, chaque geste appuyé sur une source officielle", () => {
  const n = fiche.officialSources.length;
  assert.equal(new Set(fiche.officialSources.map((s) => s.url)).size, n);
  for (const s of fiche.officialSources) assert.match(s.url, /^https:\/\/(www\.legifrance\.gouv\.fr\/codes\/article_lc\/LEGIARTI\d+|www\.impots\.gouv\.fr\/|www\.bodacc\.fr\/)/);
  assert.equal(fiche.checklist.length, 5);
  for (const c of fiche.checklist) {
    assert.ok(c.refs.length > 0 && c.action.length > 0, c.item);
    for (const r of c.refs) assert.ok(r >= 1 && r <= n, `${c.item} : [${r}]`);
  }
  const action = (i: string) => fiche.checklist.find((c) => c.item === i)!.action;
  // Vérifiés le 27/10/2026 : CGI 1731 B + 1731 (5 %), CGI 1730 (10 %), C. com. R622-24 (deux mois),
  // dépliant CFE 2026 (prélèvement à l'échéance jusqu'au 30 novembre), guide DGFiP (trois mois).
  assert.match(action("Avis de CFE"), /30 novembre.*15 décembre.*5\s%/);
  assert.match(fiche.checklist[0].where!, /Consulter > Avis C\.F\.E/);
  assert.match(action("Compte fiscal et messages"), /10\s%/);
  assert.match(action("Procédure collective d'un client"), /deux mois/);
  assert.match(action("Client sans plateforme agréée"), /trois mois/);
  assert.doesNotMatch(action("Mise en demeure"), /\bmois\b/, "aucun délai URSSAF non vérifié");
});

test("Agent Surveillance : tableau de suivi de la facturation électronique copiable dans un tableur", () => {
  const t = fiche.einvoiceTable;
  assert.equal(t.columns.length, t.example.length);
  const tsv = einvoiceTableTsv();
  assert.equal(tsv.split("\n").length, 2);
  assert.equal(tsv.split("\n")[0].split("\t").length, t.columns.length);
  assert.ok(t.columns.includes("Trace conservée"), "la démarche doit pouvoir être prouvée (guide DGFiP)");
  assert.doesNotMatch(tsv, /\d{3} \d{3} \d{3}/, "aucun SIREN réel ou inventé dans l'exemple");
});

test("Agent Surveillance : précisions d'Espoir (27/10) reprises, aucun prix", () => {
  assert.equal(fiche.proof, "Déjà en service dans plusieurs cabinets.");
  assert.match(fiche.mail, /boîte du cabinet.*après votre validation/);
  assert.match(fiche.steps[2].text, /se connecte une fois/);
  assert.match(fiche.offer, /sur rendez-vous/);
});

test("Agent Surveillance : garanties fidèles, aucun prix ni témoignage, exemple du matin fictif et anonyme", () => {
  const all = text(fiche);
  assert.match(all, /ne paie, ne déclare et ne signe jamais/);
  assert.match(all, /sans votre validation/);
  assert.match(all, /serveur en France, au nom du cabinet/i);
  assert.doesNotMatch(all, /€|clients satisfaits|témoign/i, "aucun prix ni témoignage");
  assert.doesNotMatch(all, /—/, "pas de tiret long");
  // Relevé chaque nuit : une pièce déposée en journée est vue au relevé suivant, jamais « le jour même ».
  assert.doesNotMatch(all, /le jour même/);
  for (const m of fiche.morningExample) assert.match(m.file, /^Dossier \d{3} · (SARL|SAS|EURL)$/, "dossiers anonymes");
  assert.match(readFileSync("app/g/agent-surveillance/page.tsx", "utf8"), /Exemple fictif/);
});

test("Agent Surveillance : relevé à la main = dossiers × portails × minutes × passages, sans valeur négative", () => {
  assert.deepEqual(manualReviewHours({ files: 80, portals: 3, minutes: 3, perMonth: 4 }), { month: 48, year: 576 });
  assert.deepEqual(manualReviewHours({ files: -5, portals: 3, minutes: 3, perMonth: 4 }), { month: 0, year: 0 });
  assert.deepEqual(manualReviewHours({ files: Number.NaN, portals: 3, minutes: 3, perMonth: 4 }), { month: 0, year: 0 });
});

test("Agent Surveillance : capture, liste Brevo 24, séquence dédiée, lecteur interne dans les emails, lien sv1 réservé", () => {
  const r = getRessource("agent-surveillance-cabinets")!;
  assert.equal(r.urlRessource, "/g/agent-surveillance");
  assert.equal(r.resourceCard?.titre, "Agent Surveillance : la fiche complète");
  const lm = getLeadMagnet("agent-surveillance-cabinets")!;
  assert.equal(lm.brevoListId, 24);
  assert.equal(lm.brevoListName, "LM - Agent Surveillance cabinets");
  assert.deepEqual([lm.vertical, lm.subsector], ["FINANCE", "EXPERTISE_COMPTABLE"]);
  assert.equal(lm.legacy.automationId, 0, "aucune automation Brevo");
  assert.equal(getSequence(lm.sequence)?.delivery, "generique.delivery");
  assert.equal(SHORT_LINKS.sv1.slug, "agent-surveillance-cabinets");
  // Date du post non confirmée : le code est réservé, jamais diffusé avec une date inventée.
  assert.equal(SHORT_LINKS.sv1.utm_content, null);
  assert.equal(shortLinkTarget("sv1"), null);
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://qa.althoce.example";
    assert.equal(guideParams("agent-surveillance-cabinets")?.GUIDE_URL, "https://qa.althoce.example/g/agent-surveillance");
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});

test("Agent Surveillance : page non indexée, sections et sources affichées, calculateur sans collecte", () => {
  const page = readFileSync("app/g/agent-surveillance/page.tsx", "utf8");
  assert.match(page, /robots:\{index:false,follow:false\}/);
  for (const id of ["checklist", "tableau", "temps", "releves", "matin", "mise-en-route", "garanties", "proposition", "sources"]) assert.match(page, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(page, /<form|fetch\(|localStorage|sendBeacon|CaptureForm/);
  for (const f of ["components/ManualReviewCalculator.tsx", "components/CopyPillButton.tsx"]) assert.doesNotMatch(readFileSync(f, "utf8"), /fetch\(|localStorage|sendBeacon|cookie/i, f);
});
