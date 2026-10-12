/** Joint QA contract. Only fictional @example.com data; no provider transport. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { buildContactUpdate } from "@/lib/lead/contactUpdate";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { checkPhone } from "@/lib/data-quality/phone";
import { decideStep } from "@/lib/sequences/plan";
import { hasConfirmedMeeting } from "@/lib/scoring/behavior";
const [mode, path] = process.argv.slice(2);
if (!path) throw new Error("Usage: crm-roundtrip.ts capture|verify fichier.json");
if (mode === "capture") {
  const now = new Date(Date.now() - 1000);
  const attributes = buildContactUpdate(null, { prenom: "QA", nom: "Raccordement", besoin: "DEPLOYER_AGENT_IA",
    horizon: "MOINS_3_MOIS", marketingOpposition: false, phone: checkPhone("0645871239", "FR"),
    attribution: { utm_source: "linkedin", utm_content: "QA-contexte" },
    source: LEAD_MAGNETS["12-cas-usage-experts-comptables"], now }).attributes;
  const req = { requestedAt: now.toISOString(), slug: "qa-guide-1", source: { utm_source: "linkedin" } };
  const first = { id: 90001, email: "qa-raccordement@example.com", listIds: [], emailBlacklisted: false,
    createdAt: now.toISOString(), modifiedAt: now.toISOString(), attributes: { ...attributes, MG_REQ_10: JSON.stringify(req) } };
  const second = { ...first, attributes: { ...first.attributes, MG_REQ_11: JSON.stringify({ ...req, slug: "qa-guide-2" }) } };
  fs.writeFileSync(path, JSON.stringify([first, second], null, 2));
} else if (mode === "verify") {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  assert.equal(data.kind, "isolated-simulation");
  for (const record of data.records) {
    const contact = { attributes: record.attributes, emailBlacklisted: false };
    assert.equal(decideStep(contact, { category: "marketing" }).send, ["RECEIVED", "ASSIGNED"].includes(record.status), record.status);
    assert.equal(decideStep(contact, { category: "transactional" }).send, true, record.status);
    assert.equal(hasConfirmedMeeting(record.attributes), record.status === "MEETING_CONFIRMED", record.status);
  }
  console.log(`QA commune : ${data.records.length} projections issues du vrai code CRM consommées par le moteur guides ; livraison transactionnelle préservée.`);
} else throw new Error("Mode inconnu");
