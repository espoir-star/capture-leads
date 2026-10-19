import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLAUDE_PENNYLANE_GUIDE as guide } from "@/content/guides/claude-pennylane";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget, SHORT_LINKS } from "@/config/shortLinks";
import { guideParams } from "@/lib/sequences/links";

test("Claude × Pennylane : 10 usages répartis comme dans le post (4 production, 2 analyse, 3 client, 1 cabinet)", () => {
  assert.equal(guide.usages.length, 10);
  assert.deepEqual(guide.usages.map((u) => u.number), Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0")));
  const count = (f: string) => guide.usages.filter((u) => u.family === f).length;
  assert.deepEqual([count("production"), count("analyse"), count("client"), count("cabinet")], [4, 2, 3, 1]);
  for (const f of guide.families) assert.ok(count(f.id) > 0, f.id);
});

test("Claude × Pennylane : prompts qui nomment le connecteur, à compléter, sans rien valider ni inventer", () => {
  for (const u of guide.usages) {
    assert.match(u.prompt, /connecteur Pennylane/, `${u.number} : nommer le connecteur évite une réponse de mémoire`);
    assert.match(u.prompt, /\[[A-ZÀ-Ý0-9 %€:,…'É]+\]/, `${u.number} : au moins un champ [À COMPLÉTER]`);
    assert.match(u.prompt, /présente|prépare|rédige/i, `${u.number} : format de sortie précisé`);
    assert.ok(u.reads.length > 0 && u.description.length <= 120, u.number);
    // Le connecteur est en lecture seule : aucun prompt ne demande d'agir dans Pennylane.
    assert.doesNotMatch(u.prompt, /\b(crée|modifie|supprime|passe l'écriture|envoie les)\b/i, u.number);
  }
  // Garde-fous explicites là où Claude pourrait affirmer ou agir.
  const byNumber = Object.fromEntries(guide.usages.map((u) => [u.number, u.prompt]));
  assert.match(byNumber["01"], /N'invente aucun montant/);
  assert.match(byNumber["04"], /au lieu de le supposer/);
  assert.match(byNumber["08"], /n'envoie rien/);
  assert.match(byNumber["10"], /connexion cabinet/);
  assert.ok(guide.usages.find((u) => u.number === "10")?.note, "usage 10 : réservé aux comptes cabinet");
});

test("Claude × Pennylane : serveur officiel et sources HTTPS uniques et datées", () => {
  assert.equal(guide.mcpUrl, "https://mcp.pennylane.com/mcp");
  assert.ok(guide.sources.length >= 6);
  assert.equal(new Set(guide.sources.map((s) => s.url)).size, guide.sources.length);
  for (const s of guide.sources) assert.match(s.url, /^https:\/\//);
  assert.ok(guide.sources.some((s) => s.url.startsWith("https://www.pennylane.com/")));
  assert.ok(guide.sources.some((s) => s.url.startsWith("https://support.claude.com/")));
  assert.match(guide.edition, /2026/);
});

test("Claude × Pennylane : lecteur interne dans la capture et les emails, mapping Brevo inchangé, lien court réservé", () => {
  const r = getRessource("guide-claude-pennylane")!;
  assert.equal(r.urlRessource, "/g/claude-pennylane");
  assert.equal(r.resourceCard?.titre, "Claude × Pennylane : 10 usages");
  assert.doesNotMatch(r.titre + r.sousTitre + r.pills.join(" "), /automatiser votre comptabilité|Open source/);
  const lm = getLeadMagnet("guide-claude-pennylane")!;
  assert.equal(lm.brevoListId, 6);
  assert.equal(lm.sequence, "guide-claude-pennylane-v1");
  assert.equal(SHORT_LINKS.pl1.slug, "guide-claude-pennylane");
  assert.equal(shortLinkTarget("pl1"), null, "réservé : aucune date de post inventée");
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://qa.althoce.example";
    assert.equal(guideParams("guide-claude-pennylane")?.GUIDE_URL, "https://qa.althoce.example/g/claude-pennylane");
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});

test("Claude × Pennylane : page non indexée, avertissement données clients, aucune collecte", () => {
  const page = readFileSync("app/g/claude-pennylane/page.tsx", "utf8");
  assert.match(page, /robots:\{index:false,follow:false\}/);
  assert.match(page, /id="donnees-clients"/);
  assert.match(page, /Free, Pro ou Max/);
  assert.doesNotMatch(page, /<form|fetch\(|localStorage|sendBeacon|CaptureForm/);
});
