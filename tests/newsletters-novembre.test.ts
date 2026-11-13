import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

/**
 * Planning de novembre 2026 (demande d'Espoir du 13/11) : deux emails par semaine, mardi et
 * jeudi à 8 h 30, une ressource par email, lien direct vers la page /g/ (jamais le formulaire),
 * aucun rendez-vous.
 */
const PLANNING = [
  { file: "2026-11-17-finance", day: 2, page: "10-prompts-production-cabinet" },
  { file: "2026-11-19-finance", day: 4, page: "agent-surveillance" },
  { file: "2026-11-24-finance", day: 2, page: "12-cas-usage-experts-comptables" },
  { file: "2026-11-26-finance", day: 4, page: "12-skills-claude-finance" },
];

test("newsletters de novembre : une ressource par email, lien direct, mardi et jeudi 8 h 30", () => {
  for (const p of PLANNING) {
    const md = readFileSync(`content/newsletters/${p.file}.md`, "utf8");
    const field = (k: string) => md.match(new RegExp(`^\\s*${k}: "?([^"\\n]+)"?$`, "m"))?.[1];
    // Un seul bouton : la page /g/ de la ressource, qui existe dans l'application
    assert.equal(field("url"), `https://guide-gratuit-pi.vercel.app/g/${p.page}`, p.file);
    assert.ok(existsSync(`app/g/${p.page}/page.tsx`), `page /g/${p.page} absente`);
    // Ni formulaire, ni Notion, ni agenda, ni page de rendez-vous, nulle part dans l'email
    assert.doesNotMatch(md, /\/r\/|notion\.site|calendar|cal\.com|\/rdv\//, p.file);
    assert.doesNotMatch(md, /—/, `${p.file} : tiret long`);
    // Date : mardi ou jeudi, 8 h 30 heure de Paris ; campagne datée du même jour
    const at = new Date(field("scheduledAt")!);
    assert.equal(at.getUTCDay(), p.day, `${p.file} : jour`);
    assert.equal(field("scheduledAt")!.slice(11), "08:30:00+01:00", `${p.file} : heure`);
    assert.equal(field("utmCampaign"), `nl_finance_${p.file.slice(0, 10).replace(/-/g, "")}`);
    assert.equal(field("status"), "draft", `${p.file} : rien n'est créé dans Brevo sans accord`);
  }
});
