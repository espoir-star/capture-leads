import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELEVE_BANCAIRE as r, skillFile, skillZip } from "@/content/guides/releve-bancaire-pdf";
import { getLeadMagnet, guideFormOptions } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget } from "@/config/shortLinks";
import { crc32 } from "@/lib/zip";

function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.before.flatMap((b) => [b.title, b.text]), r.skill.title, r.skill.body,
    ...r.install.steps, r.install.safari, r.install.phrase,
    ...r.prompts.flatMap((p) => [p.title, p.result, p.prompt]), r.promptsNote, r.guarantee,
  ];
}

test("Relevé bancaire : faits et garde-fous présents", () => {
  const all = texts().join(" ");
  assert.match(all, /100 pages/);
  assert.match(all, /solde de départ \+ total des crédits - total des débits = solde de fin/i);
  assert.match(all, /ILLISIBLE/);
  assert.match(all, /N(’|')invente aucune ligne/);
  assert.match(all, /accord de traitement des données/);
  assert.match(r.prompts[2].prompt, /seulement si le contrôle des soldes est juste/);
  assert.equal(r.prompts.length, 3);
  assert.ok(r.sources.every((s) => s.href.startsWith("https://support.claude.com/")));
});

test("Relevé bancaire : typographie française, pas de tiret long, jamais FEC", () => {
  for (const t of texts()) {
    assert.ok(t.trim());
    assert.doesNotMatch(t, /—/, t);
    assert.doesNotMatch(t, / [:?!;»%€]|« /, t);
    assert.doesNotMatch(t, /\bFEC\b/);
  }
});

test("Relevé bancaire : skill conforme et ZIP <nom>/SKILL.md", () => {
  const k = r.skill;
  assert.match(k.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(k.name.length <= 64);
  assert.ok(k.description.length <= 200, String(k.description.length));
  assert.doesNotMatch(k.description, /:|#|\n/);
  for (const part of ["## Rôle", "## Procédure", "## Format de sortie", "## Règles"]) assert.ok(k.body.includes(part), part);
  const zip = skillZip();
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  const nameLen = v.getUint16(26, true);
  const size = v.getUint32(18, true);
  assert.equal(new TextDecoder().decode(zip.subarray(30, 30 + nameLen)), `${k.name}/SKILL.md`);
  const data = zip.subarray(30 + nameLen, 30 + nameLen + size);
  assert.equal(crc32(data), v.getUint32(14, true));
  assert.equal(new TextDecoder().decode(data), skillFile(k));
  assert.equal(r.zip.file, `${k.name}.zip`);
  assert.equal(r.zip.href, `/g/${r.slug}/${r.zip.file}`);
});

test("Relevé bancaire : capture avec formulaire, liste 28, lien rb1, agenda", () => {
  assert.equal(getRessource(r.slug)?.urlRessource, `/g/${r.slug}`);
  assert.equal(getLeadMagnet(r.slug)?.brevoListId, 28);
  assert.deepEqual(guideFormOptions(r.slug), { entrepriseRequise: true, sansHorizon: true });
  assert.equal(
    shortLinkTarget("rb1"),
    "/r/releve-bancaire-pdf?utm_source=linkedin&utm_medium=organic&utm_campaign=releve_bancaire_pdf&utm_content=LI_EC_20261120_01"
  );
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<BookingCalendar embedUrl=\{PRE_AUDIT_BOOKING_EMBED\}/);
  for (const id of ["avant", "skill", "prompts", "creneaux"]) assert.match(page, new RegExp(`id="${id}"`), id);
});
