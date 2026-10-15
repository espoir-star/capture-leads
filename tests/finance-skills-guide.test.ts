import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_FINANCE_SKILLS_GUIDE as guide, skillFile } from "@/content/guides/claude-finance-skills";
import { getLeadMagnet } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { guideParams } from "@/lib/sequences/links";
import { activeGuideSequence } from "@/lib/sequences/switch";

test("12 skills finance : fichiers SKILL.md conformes aux limites de claude.ai", () => {
  assert.equal(guide.skills.length, 12);
  assert.equal(new Set(guide.skills.map((s) => s.name)).size, 12);
  assert.deepEqual(guide.skills.map((s) => s.number), Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")));
  for (const s of guide.skills) {
    // Centre d'aide Anthropic : nom ≤ 64, description ≤ 200 ; documentation : minuscules, chiffres, tirets.
    assert.match(s.name, /^[a-z0-9-]{1,64}$/, s.name);
    assert.doesNotMatch(s.name, /claude|anthropic/, s.name);
    assert.ok(s.description.length > 0 && s.description.length <= 200, `${s.name} : ${s.description.length} caractères`);
    assert.match(s.description, /À utiliser/, `${s.name} : la description doit dire quand l'utiliser`);
    assert.doesNotMatch(s.description + s.body, /<[a-z/][^>]*>/i, `${s.name} : pas de balise XML`);
    const file = skillFile(s);
    assert.ok(file.startsWith(`---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n# `), s.name);
    assert.ok(guide.families.some((f) => f.id === s.family), s.family);
  }
  for (const p of guide.periods) for (const n of p.skills) assert.ok(guide.skills.some((s) => s.number === n), n);
});

test("12 skills finance : sources HTTPS uniques et datées", () => {
  assert.ok(guide.sources.length >= 6);
  assert.equal(new Set(guide.sources.map((s) => s.url)).size, guide.sources.length);
  for (const s of guide.sources) assert.match(s.url, /^https:\/\//);
  assert.match(guide.edition, /2026/);
});

test("12 skills finance : lecteur interne dans la capture et les emails, mapping Brevo inchangé", () => {
  assert.equal(getRessource("12-skills-claude-finance")?.urlRessource, "/g/12-skills-claude-finance");
  const lm = getLeadMagnet("12-skills-claude-finance")!;
  assert.equal(lm.brevoListId, 13);
  assert.equal(lm.sequence, "guide-claude-finance-skills-v1");
  const prod = activeGuideSequence(lm, { ALTHOCE_SEQUENCE_GUIDES: `${lm.slug}:sans-liste` }, "visiteur@example.com")!;
  assert.equal(prod.addToList, false);
  const before = process.env.SITE_URL;
  try {
    process.env.SITE_URL = "https://qa.althoce.example";
    assert.equal(guideParams("12-skills-claude-finance")?.GUIDE_URL, "https://qa.althoce.example/g/12-skills-claude-finance");
  } finally {
    if (before === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = before;
  }
});
