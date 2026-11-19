import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAISIE_PIECES as r, skillFile, skillZip } from "@/content/guides/saisie-pieces-comptables";
import { getLeadMagnet, guideFormOptions } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget } from "@/config/shortLinks";
import { crc32 } from "@/lib/zip";

function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.pieces.flatMap((p) => [p.title, p.text]), ...r.before.flatMap((b) => [b.title, b.text]),
    r.skill.title, r.skill.body, ...r.install.steps, r.install.safari, r.install.phrase,
    ...r.prompts.flatMap((p) => [p.title, p.result, p.prompt]), r.promptsNote, r.guarantee,
  ];
}

test("Saisie des pièces : 10 prompts, exemples de pièces, garde-fous", () => {
  assert.equal(r.prompts.length, 10);
  assert.deepEqual(r.prompts.map((p) => p.number), ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10"]);
  assert.ok(r.pieces.length >= 6);
  const all = texts().join(" ");
  assert.match(all, /100 pages/);
  assert.match(all, /solde de départ \+ total des crédits - total des débits = solde de fin/i);
  assert.match(all, /HT \+ TVA = TTC/);
  assert.match(all, /ILLISIBLE/);
  assert.match(all, /à valider/);
  assert.match(all, /accord de traitement des données/);
  assert.match(r.prompts[9].prompt, /Laisse de côté les pièces en écart/);
  // le skill regroupe tout : chaque type de pièce et chaque étape
  for (const k of ["Facture d", "Ticket", "Relevé bancaire", "Échéancier", "immobilisation", "Rapproche", "CSV"]) assert.ok(r.skill.body.includes(k), k);
  assert.ok(r.sources.every((s) => s.href.startsWith("https://support.claude.com/")));
});

test("Saisie des pièces : typographie française, pas de tiret long, jamais FEC", () => {
  for (const t of texts()) {
    assert.ok(t.trim());
    assert.doesNotMatch(t, /—/, t);
    assert.doesNotMatch(t, / [:?!;»%€]|« /, t);
    assert.doesNotMatch(t, /\bFEC\b/);
  }
});

test("Saisie des pièces : skill conforme et ZIP <nom>/SKILL.md", () => {
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

test("Saisie des pièces : capture avec formulaire, liste 28, lien sp1, agenda", () => {
  assert.equal(getRessource(r.slug)?.urlRessource, `/g/${r.slug}`);
  assert.equal(getLeadMagnet(r.slug)?.brevoListId, 28);
  assert.deepEqual(guideFormOptions(r.slug), { entrepriseRequise: true, sansHorizon: true });
  assert.equal(
    shortLinkTarget("sp1"),
    "/r/saisie-pieces-comptables?utm_source=linkedin&utm_medium=organic&utm_campaign=saisie_pieces_comptables&utm_content=LI_EC_20261120_01"
  );
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<BookingCalendar embedUrl=\{PRE_AUDIT_BOOKING_EMBED\}/);
  for (const id of ["pieces", "avant", "skill", "prompts", "creneaux"]) assert.match(page, new RegExp(`id="${id}"`), id);
});
