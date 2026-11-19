import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLAUDE_REUNION as r, skillFile, skillsBundleZip } from "@/content/guides/claude-en-reunion";
import { crc32 } from "@/lib/zip";
import { getLeadMagnet, guideFormOptions } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget } from "@/config/shortLinks";
import { PRE_AUDIT_BOOKING_EMBED } from "@/config/rdvPages";

function texts(): string[] {
  return [
    r.metaTitle, r.metaDescription, r.eyebrow, r.title, r.subtitle, ...r.promises,
    ...r.does.flatMap((d) => [d.title, d.text]), ...r.before,
    ...r.steps.flatMap((s) => [s.title, s.text]),
    r.consent.title, r.consent.text, r.consent.invitation, r.consent.opening,
    r.external.title, ...r.external.points,
    ...r.skills.flatMap((k) => [k.title, k.result, k.body]),
    r.install.prerequisite, ...r.install.steps, r.install.phrase, r.install.use, ...r.zip.steps, r.zip.team,
  ];
}

test("Claude en réunion : faits vérifiés et nuances obligatoires présents", () => {
  const all = texts().join(" ");
  assert.match(all, /Team ou Enterprise/);
  assert.match(all, /bêta/);
  assert.match(all, /Google Meet uniquement/);
  assert.match(all, /ne conserve pas l(’|')audio/);
  assert.match(all, /accepter d(’|')être transcrits/);
  assert.match(all, /invité extérieur/);
  assert.match(all, /10 février 2027/);
  // Claude n'envoie pas de mail de suivi : le skill n'en prépare qu'un brouillon
  assert.match(r.skills.find((k) => k.number === "02")!.body, /n(’|')envoie rien/);
  assert.equal(r.skills.length, 5);
  assert.match(r.install.prerequisite, /exécution de code/);
  assert.ok(r.sources.every((s) => /^https:\/\/(claude\.com|support\.claude\.com)\//.test(s.href)));
});

test("Claude en réunion : typographie française, pas de tiret long, jamais FEC", () => {
  for (const t of texts()) {
    assert.ok(t.trim(), "texte vide");
    assert.doesNotMatch(t, /—/, `tiret long : ${t}`);
    assert.doesNotMatch(t, / [:?!;»%€]|« /, `espace sécable : ${t}`);
    assert.doesNotMatch(t, /\bFEC\b/);
  }
});

test("Claude en réunion : capture avec formulaire (entreprise, sans horizon), lien re1, agenda du pré-audit", () => {
  assert.equal(getRessource(r.slug)?.urlRessource, `/g/${r.slug}`);
  assert.equal(getLeadMagnet(r.slug)?.brevoListId, 26);
  assert.deepEqual(guideFormOptions(r.slug), { entrepriseRequise: true, sansHorizon: true });
  assert.equal(
    shortLinkTarget("re1"),
    "/r/claude-en-reunion?utm_source=linkedin&utm_medium=organic&utm_campaign=claude_en_reunion&utm_content=LI_GEN_20261119_01"
  );
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /<BookingCalendar embedUrl=\{PRE_AUDIT_BOOKING_EMBED\}/);
  assert.ok(PRE_AUDIT_BOOKING_EMBED);
  for (const id of ["ce-quil-fait", "avant", "reglages", "accord", "client", "skills", "creneaux"]) assert.match(page, new RegExp(`id="${id}"`), id);
});

test("Claude en réunion : fichiers SKILL.md conformes au centre d'aide Claude", () => {
  const names = new Set<string>();
  for (const k of r.skills) {
    assert.match(k.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, k.name);
    assert.ok(k.name.length <= 64, k.name);
    assert.ok(!names.has(k.name), `nom en double : ${k.name}`);
    names.add(k.name);
    assert.ok(k.description.length <= 200, `${k.name} : ${k.description.length} caractères`);
    // Valeur YAML sans guillemets : ni deux-points, ni dièse, ni retour à la ligne
    assert.doesNotMatch(k.description, /:|#|\n/, k.name);
    assert.match(k.description, /À utiliser/, k.name);
    const file = skillFile(k);
    assert.ok(file.startsWith(`---\nname: ${k.name}\ndescription: ${k.description}\n---\n\n# `), k.name);
    for (const part of ["## Rôle", "## Procédure", "## Format de sortie", "## Règles"]) assert.ok(k.body.includes(part), `${k.name} : ${part}`);
  }
});

/** Lit une archive ZIP « stored » : chemins et contenus, contrôle du CRC */
function readZip(buf: Uint8Array): Map<string, Uint8Array> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out = new Map<string, Uint8Array>();
  let p = 0;
  while (v.getUint32(p, true) === 0x04034b50) {
    assert.equal(v.getUint16(p + 8, true), 0, "méthode stored");
    const crc = v.getUint32(p + 14, true);
    const size = v.getUint32(p + 18, true);
    const nameLen = v.getUint16(p + 26, true);
    const extraLen = v.getUint16(p + 28, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nameLen));
    const data = buf.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    assert.equal(crc32(data), crc, `CRC ${name}`);
    out.set(name, data);
    p += 30 + nameLen + extraLen + size;
  }
  assert.equal(v.getUint32(p, true), 0x02014b50, "répertoire central");
  return out;
}

test("Claude en réunion : le ZIP contient un ZIP par skill, au format claude.ai (<nom>/SKILL.md)", () => {
  const outer = readZip(skillsBundleZip());
  assert.deepEqual([...outer.keys()], r.skills.map((k) => `${r.zip.folder}/${k.name}.zip`));
  for (const k of r.skills) {
    const inner = readZip(outer.get(`${r.zip.folder}/${k.name}.zip`)!);
    assert.deepEqual([...inner.keys()], [`${k.name}/SKILL.md`]);
    assert.equal(new TextDecoder().decode(inner.get(`${k.name}/SKILL.md`)!), skillFile(k));
  }
  // Même fichier d'un build à l'autre
  assert.deepEqual(skillsBundleZip(), skillsBundleZip());
  const route = readFileSync(`app/g/${r.slug}/${r.zip.file}/route.ts`, "utf8");
  assert.match(route, /application\/zip/);
  assert.equal(r.zip.href, `/g/${r.slug}/${r.zip.file}`);
  const page = readFileSync(`app/g/${r.slug}/page.tsx`, "utf8");
  assert.match(page, /href=\{r\.zip\.href\} download=\{r\.zip\.file\}/);
});
