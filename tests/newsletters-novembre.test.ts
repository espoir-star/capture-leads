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
  // Reportée au vendredi 27/11 (campagne #62) : le jeudi 19/11 est pris par l'annonce du webinaire du 26/11
  { file: "2026-11-19-finance", day: 5, page: "agent-surveillance" },
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
    assert.ok(at.toISOString().slice(0, 10) >= p.file.slice(0, 10), `${p.file} : jamais avant la date du fichier`);
    assert.equal(field("scheduledAt")!.slice(11), "08:30:00+01:00", `${p.file} : heure`);
    assert.equal(field("utmCampaign"), `nl_finance_${p.file.slice(0, 10).replace(/-/g, "")}`);
    assert.ok(["draft", "ready", "created", "scheduled"].includes(field("status")!), `${p.file} : statut inconnu`);
  }
});

/**
 * Webinaire AgentFlow × Althoce du jeudi 26/11/2026 à 11 h (page d'inscription chez AgentFlow,
 * lien de recommandation fourni par Espoir le 17/11). Cinq emails demandés par Espoir le 17/11 :
 * jeudi 19, samedi 21, lundi 23, mercredi 25 et le matin même. Faits repris de la page
 * d'inscription, aucune mention d'un enregistrement.
 */
const WEBINAR_STARTS_AT = "2026-11-26T11:00:00+01:00";
const WEBINAR_MAILS = [
  { file: "2026-11-19-webinar-cabinet-ia", at: "2026-11-19T08:30:00+01:00", content: "email_annonce" },
  { file: "2026-11-21-webinar-cabinet-ia-pieces", at: "2026-11-21T09:00:00+01:00", content: "email_pieces" },
  { file: "2026-11-23-webinar-cabinet-ia-conseil", at: "2026-11-23T08:30:00+01:00", content: "email_conseil" },
  { file: "2026-11-25-webinar-cabinet-ia-veille", at: "2026-11-25T08:30:00+01:00", content: "email_veille" },
  { file: "2026-11-26-webinar-cabinet-ia-jour-j", at: "2026-11-26T08:00:00+01:00", content: "email_jour_j" },
];

test("webinaire du 26/11 : cinq emails avant le direct, lien de recommandation, présence en direct", () => {
  for (const m of WEBINAR_MAILS) {
    const md = readFileSync(`content/newsletters/${m.file}.md`, "utf8");
    const field = (k: string) => md.match(new RegExp(`^\\s*${k}: "?([^"\\n]+)"?$`, "m"))?.[1];
    assert.equal(field("url"), "https://0e7tr90.short.gy/reco-c05-althoce", m.file);
    assert.equal(field("audience"), "finance", m.file);
    assert.equal(field("scheduledAt"), m.at, m.file);
    assert.ok(Date.parse(m.at) < Date.parse(WEBINAR_STARTS_AT), `${m.file} : avant le direct`);
    assert.equal(field("utmCampaign"), "webinar_agentflow_althoce_20261126");
    assert.equal(field("utmContent"), m.content);
    assert.match(md, /11 h/, `${m.file} : horaire`);
    assert.match(md, /Augustin Branthomme, fondateur d'AgentFlow/, `${m.file} : co-animateur`);
    assert.doesNotMatch(md, /—/, `${m.file} : tiret long`);
    assert.doesNotMatch(md, /replay|enregistr|places limitées/i, `${m.file} : pas de raison de ne pas venir, pas de pression`);
    assert.doesNotMatch(md, /page d'AgentFlow/, `${m.file} : formulation écartée par Espoir`);
  }
});
