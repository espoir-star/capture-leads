import { test } from "node:test";
import assert from "node:assert/strict";
import { REVUE_FEC as r, dashboardHtml, skillFile, skillZip } from "@/content/guides/revue-dossier-fec";
import { getLeadMagnet, guideFormOptions } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";
import { shortLinkTarget } from "@/config/shortLinks";
import { crc32 } from "@/lib/zip";

/** La logique de calcul du tableau de bord, extraite du fichier HTML (entre les deux marqueurs) */
type Ano = { sev: string; type: string; montant?: number; compte?: string; date?: number };
type Res = {
  integ: { lignes: number; ecritures: number; desequilibrees: number; trous: unknown[]; weekend: number; debit: number; credit: number };
  anomalies: Ano[];
  activite: { ca: number; resultat: number; mois: { k: number; ca: number }[] };
  tiers: { clients: { ages: number[]; tauxLettrage: number | null } };
  questions: string[];
};
type Fec = {
  parse: (t: string) => { rows: unknown[]; sep: string; absentes: string[] };
  analyse: (rows: unknown[], o?: Record<string, unknown>) => Res;
  cents: (s: string) => number;
  jour: (s: string) => number;
};
function logique(): Fec {
  const html = dashboardHtml();
  const code = html.split("/*FEC-LOGIC-START*/")[1].split("/*FEC-LOGIC-END*/")[0];
  return new Function(`${code}; return FEC;`)() as Fec;
}

/**
 * Quelques lignes de test, écrites à la main pour déclencher chaque contrôle (pas un FEC
 * d'exemple : rien n'est publié). Le 27/12/2025 est un samedi.
 */
const H = "JournalCode\tJournalLib\tEcritureNum\tEcritureDate\tCompteNum\tCompteLib\tCompAuxNum\tCompAuxLib\tPieceRef\tPieceDate\tEcritureLib\tDebit\tCredit\tEcritureLet\tDateLet\tValidDate\tMontantdevise\tIdevise";
function l(j: string, n: string, d: string, c: string, lib: string, aux: string, debit: string, credit: string, lettre = "") {
  return [j, j, n, d, c, lib, aux, aux, "P" + n, d, lib, debit, credit, lettre, "", d, "", ""].join("\t");
}
const LIGNES = [
  H,
  l("VE", "1", "20250115", "411000", "Clients", "CLI01", "1200,00", "0,00"),
  l("VE", "1", "20250115", "706000", "Prestations", "", "0,00", "1000,00"),
  l("VE", "1", "20250115", "445710", "TVA collectée", "", "0,00", "200,00"),
  l("BQ", "2", "20250120", "512000", "Banque", "", "1500,00", "0,00"),
  l("BQ", "2", "20250120", "411000", "Clients", "CLI02", "0,00", "1500,00"),
  l("CA", "3", "20250106", "530000", "Caisse", "", "0,00", "300,00"),
  l("CA", "3", "20250106", "606300", "Petit équipement", "", "300,00", "0,00"),
  l("AC", "4", "20250210", "606300", "Petit équipement", "", "2000,00", "0,00"),
  l("AC", "4", "20250210", "445660", "TVA déductible", "", "400,00", "0,00"),
  l("AC", "4", "20250210", "401000", "Fournisseurs", "FOU01", "0,00", "2400,00"),
  l("AC", "5", "20250211", "606300", "Petit équipement", "", "2000,00", "0,00"),
  l("AC", "5", "20250211", "445660", "TVA déductible", "", "400,00", "0,00"),
  l("AC", "5", "20250211", "401000", "Fournisseurs", "FOU01", "0,00", "2400,00"),
  l("OD", "6", "20251227", "455000", "Associé", "", "10000,00", "0,00"),
  l("OD", "6", "20251227", "512000", "Banque", "", "0,00", "10000,00"),
  l("OD", "8", "20250303", "471000", "Attente", "", "50,00", "0,00"),
  l("OD", "8", "20250303", "512000", "Banque", "", "0,00", "40,00"),
].join("\r\n");

test("revue FEC : lecture du FEC (tabulation, Montant et Sens, montants et dates)", () => {
  const F = logique();
  assert.equal(F.cents("1 234,56"), 123456);
  assert.equal(F.cents("1.234,56"), 123456);
  assert.equal(F.cents("1234.56"), 123456);
  assert.equal(F.cents("-12,00"), -1200);
  assert.equal(F.jour("31/12/2025"), 20251231);
  assert.equal(F.jour("2025-12-31"), 20251231);
  const p = F.parse(LIGNES);
  assert.equal(p.rows.length, 17);
  assert.equal(p.sep, "tabulation");
  assert.deepEqual(p.absentes, []);
  // Variante Montant + Sens, séparateur barre verticale, BOM
  const v = F.parse("﻿JournalCode|EcritureNum|EcritureDate|CompteNum|Montant|Sens\nVE|1|20250115|411000|1 200,50|D\nVE|1|20250115|706000|1200,50|C");
  const res = F.analyse(v.rows);
  assert.equal(res.integ.debit, 120050);
  assert.equal(res.integ.credit, 120050);
  assert.equal(res.activite.ca, 120050);
  // En-têtes absents : message clair
  assert.throws(() => F.parse("a\tb\tc\n1\t2\t3"), /Colonnes introuvables/);
});

test("revue FEC : chaque contrôle se déclenche sur sa ligne", () => {
  const F = logique();
  const res = F.analyse(F.parse(LIGNES).rows, { seuilImmo: 50000, seuilRond: 500000 });
  const types = (t: string) => res.anomalies.filter((a) => a.type === t);
  assert.equal(res.integ.ecritures, 7);
  assert.equal(res.integ.desequilibrees, 1);
  assert.equal(types("Écriture déséquilibrée")[0].montant, 1000);
  assert.equal(types("Total débit différent du total crédit").length, 1);
  assert.equal(res.integ.trous.length, 1, "OD 6 puis OD 8");
  assert.equal(types("Client créditeur")[0].montant, 150000);
  assert.equal(types("Caisse créditrice")[0].montant, 30000);
  assert.equal(types("Compte courant d'associé débiteur")[0].montant, 1000000);
  assert.equal(types("Compte d'attente non soldé")[0].montant, 5000);
  assert.equal(types("Doublon possible").length, 1);
  assert.equal(types("Achat en charge, à immobiliser ?").length, 2, "2 000 € au-dessus du seuil de 500 €, pas les 300 €");
  assert.equal(res.integ.weekend, 1);
  assert.equal(types("Montant rond").length, 1);
  assert.equal(res.activite.ca, 100000);
  // Tri : priorité haute d'abord, puis montant décroissant
  assert.equal(res.anomalies[0].sev, "haute");
  assert.equal(res.anomalies[0].type, "Compte courant d'associé débiteur");
  assert.ok(res.questions.length >= 3);
  // Seuil à 0 : le contrôle est coupé
  assert.equal(F.analyse(F.parse(LIGNES).rows, { seuilImmo: 0 }).anomalies.filter((a) => a.type === "Achat en charge, à immobiliser ?").length, 0);
});

test("revue FEC : le tableau de bord est autonome et n'envoie rien", () => {
  const html = dashboardHtml();
  assert.match(html, /Charger le FEC/);
  for (const o of ["Synthèse", "Anomalies", "Tiers", "Activité", "Cohérences"]) assert.match(html, new RegExp(`data-o="[a-z]+"[^>]*>${o}`));
  assert.match(html, /type="file"/);
  assert.match(html, /FileReader/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|fetch\(|XMLHttpRequest|sendBeacon|https?:\/\//, "aucune ressource ni requête externe");
  assert.doesNotMatch(html, /—/, "pas de tiret long");
  assert.ok(html.length < 80_000, `taille ${html.length}`);
});

test("revue FEC : skill, ZIP, capture et lien court", () => {
  const k = r.skill;
  assert.ok(k.name.length <= 64 && /^[a-z0-9-]+$/.test(k.name));
  assert.ok(k.description.length <= 200, `description ${k.description.length}`);
  assert.doesNotMatch(k.description, /:/, "pas de deux-points dans l'en-tête YAML");
  assert.match(k.body, /assets\/tableau-de-bord-revue-fec\.html/);
  assert.match(k.body, /Charger le FEC/);
  assert.match(k.body, /n'est pas envoyé dans la conversation/);
  assert.match(skillFile(k), /^---\nname: revue-dossier-fec\ndescription: /);
  // ZIP : SKILL.md et le tableau de bord, CRC justes
  const zip = skillZip();
  const txt = new TextDecoder().decode(zip);
  assert.ok(txt.includes("revue-dossier-fec/SKILL.md"));
  assert.ok(txt.includes("revue-dossier-fec/assets/tableau-de-bord-revue-fec.html"));
  const html = new TextEncoder().encode(dashboardHtml());
  const dv = new DataView(zip.buffer, zip.byteOffset);
  let off = 0, vus = 0;
  while (dv.getUint32(off, true) === 0x04034b50) {
    const crc = dv.getUint32(off + 14, true), size = dv.getUint32(off + 18, true), nl = dv.getUint16(off + 26, true);
    const data = zip.subarray(off + 30 + nl, off + 30 + nl + size);
    assert.equal(crc32(data), crc);
    if (size === html.length) vus++;
    off += 30 + nl + size;
  }
  assert.equal(vus, 1, "le tableau de bord est dans le ZIP, à l'identique");
  // Capture, séquence, lien court
  const lm = getLeadMagnet("revue-dossier-fec");
  assert.equal(lm?.brevoListId, 29);
  assert.deepEqual(guideFormOptions("revue-dossier-fec"), { entrepriseRequise: true, sansHorizon: true });
  assert.equal(getRessource("revue-dossier-fec")?.urlRessource, "/g/revue-dossier-fec");
  assert.match(shortLinkTarget("rv1") ?? "", /^\/r\/revue-dossier-fec\?utm_source=linkedin/);
  // Pas de tiret long dans les textes de la fiche
  assert.doesNotMatch(JSON.stringify(r), /—/);
});
