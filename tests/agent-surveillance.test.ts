import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_SURVEILLANCE as fiche } from "@/content/guides/agent-surveillance";
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
  for (const item of ["Avis de CFE", "Avis de taxe foncière", "Avis à payer", "Procédures collectives", "Mandats", "Raccordement"]) {
    assert.ok(all.includes(item), item);
  }
  assert.equal(fiche.steps.length, 3);
  assert.equal(fiche.guarantees.length, 3);
});

test("Agent Surveillance : garanties de la proposition, aucun prix ni chiffre inventé, pas de tiret long", () => {
  const all = text(fiche);
  assert.match(all, /ne paie, ne déclare et ne signe jamais/);
  assert.match(all, /sans votre validation/);
  assert.match(all, /serveur en France, au nom du cabinet/);
  assert.doesNotMatch(all, /€|\d+ ?%|clients satisfaits|témoign/i, "aucun prix, pourcentage ni témoignage");
  assert.doesNotMatch(all, /—/, "pas de tiret long");
  // Relevé chaque nuit : une pièce déposée en journée est vue au relevé suivant, jamais « le jour même ».
  assert.doesNotMatch(all, /le jour même/);
});

test("Agent Surveillance : chaque « Bon à savoir » renvoie à une source officielle HTTPS existante", () => {
  const n = fiche.officialSources.length;
  assert.equal(new Set(fiche.officialSources.map((s) => s.url)).size, n);
  for (const s of fiche.officialSources) assert.match(s.url, /^https:\/\/(www\.)?(impots\.gouv\.fr|data\.gouv\.fr|inpi\.fr)\//);
  for (const s of fiche.sources) for (const ref of s.context?.sources ?? []) assert.ok(ref >= 1 && ref <= n, `${s.id} : [${ref}]`);
  const fe = fiche.sources.find((s) => s.id === "facturation")!;
  assert.match(fe.context!.text, /1er septembre 2026/);
  assert.match(fe.context!.text, /1er septembre 2027/);
  assert.match(fiche.sources.find((s) => s.id === "impots")!.context!.text, /15 décembre/);
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

test("Agent Surveillance : page non indexée, sources affichées, aucune collecte", () => {
  const page = readFileSync("app/g/agent-surveillance/page.tsx", "utf8");
  assert.match(page, /robots:\{index:false,follow:false\}/);
  for (const id of ["releves", "matin", "mise-en-route", "garanties", "proposition", "sources"]) assert.match(page, new RegExp(`id="${id}"`), id);
  assert.doesNotMatch(page, /<form|fetch\(|localStorage|sendBeacon|CaptureForm/);
});
