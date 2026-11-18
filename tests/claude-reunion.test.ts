import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLAUDE_REUNION as r } from "@/content/guides/claude-en-reunion";
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
    ...r.prompts.flatMap((p) => [p.title, p.result, p.prompt]), r.promptsNote,
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
  // Claude n'envoie pas de mail de suivi : le prompt n'en prépare qu'un brouillon
  assert.match(r.prompts.find((p) => p.number === "02")!.prompt, /n(’|')envoie rien/);
  assert.equal(r.prompts.length, 5);
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
  for (const id of ["ce-quil-fait", "avant", "reglages", "accord", "client", "prompts", "creneaux"]) assert.match(page, new RegExp(`id="${id}"`), id);
});
