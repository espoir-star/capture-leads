/**
 * Test de bout en bout contre le VRAI Brevo, sans effet de bord marketing.
 *
 *   npm run brevo:smoke -- --email qa-capture-test@example.com
 *
 * Reproduit le scénario pilote (12-cas-usage-experts-comptables, UTM LinkedIn,
 * DEPLOYER_AGENT_IA / MOINS_3_MOIS) avec le code de production
 * (buildContactUpdate + upsertContact + sendBrevoEvent), puis vérifie :
 *   - attributs écrits et typés correctement (LEAD_SCORE numérique…)
 *   - 2e soumission depuis une autre source : first touch conservé
 *   - score existant 30 conservé (max)
 *   - un seul contact (dédoublonnage par email)
 *   - événement lead_magnet_submitted accepté par l'API
 *
 * Le contact n'est ajouté à AUCUNE liste : aucune automation ni email ne
 * part. L'adresse doit être une adresse de test (example.com conseillé).
 * Le contact reste dans Brevo : le supprimer à la main après contrôle.
 */

import { brevoRequest, getApiKey, getContactByEmail } from "@/lib/brevo/api";
import { upsertContact } from "@/lib/brevo/contacts";
import { BREVO_EVENTS, sendBrevoEvent } from "@/lib/brevo/events";
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { checkPhone } from "@/lib/data-quality/phone";
import { buildContactUpdate, withoutRejectedSms } from "@/lib/lead/contactUpdate";
import { createEmailConfirmToken, readEmailConfirmToken } from "@/lib/security/emailConfirm";

const argv = process.argv.slice(2);
const email = argv[argv.indexOf("--email") + 1]?.toLowerCase();

let failures = 0;
function expect(label: string, actual: unknown, expected: unknown) {
  const ok = String(actual) === String(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(20)} ${String(actual)}${ok ? "" : `   (attendu : ${expected})`}`);
}

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  if (!argv.includes("--email") || !email || !/@(example\.(com|org|net)|[\w-]+\.test)$/.test(email)) {
    throw new Error("Usage : npm run brevo:smoke -- --email qa-capture-test@example.com (domaine de test obligatoire)");
  }
  const source = LEAD_MAGNETS["12-cas-usage-experts-comptables"];
  const phone = checkPhone("06 45 87 12 39", "FR");

  console.log(`\nSmoke test Brevo — ${email} (aucune liste, aucun email envoyé)\n`);
  const before = await getContactByEmail(email);
  if (before) console.log(`  (contact déjà présent #${before.id} : il sera mis à jour)`);

  /* 1. Première soumission : LinkedIn */
  const u1 = buildContactUpdate(before, {
    prenom: "Test",
    nom: "QA Althoce",
    besoin: "DEPLOYER_AGENT_IA",
    horizon: "MOINS_3_MOIS",
    optIn: false,
    confirmToken: createEmailConfirmToken(email),
    phone,
    attribution: {
      utm_source: "linkedin",
      utm_medium: "organic",
      utm_campaign: "guide_experts_comptables",
      utm_content: "LI_EC_20261008_01",
      landing_page: "/r/12-cas-usage-experts-comptables",
    },
    source,
    now: new Date(),
  });
  const r1 = await upsertContact(email, u1.attributes, [], before, (attrs) => withoutRejectedSms(attrs, before));
  console.log(`1) Soumission LinkedIn → contact #${r1.contactId}${r1.phoneRejected ? ` (SMS refusé : ${r1.phoneRejected})` : ""}`);
  const c1 = await getContactByEmail(email);
  const a = c1?.attributes ?? {};
  if (!before) {
    expect("RESSOURCE", a.RESSOURCE, "12-cas-usage-experts-comptables");
    expect("VERTICAL", a.VERTICAL, "FINANCE");
    expect("SUBSECTOR", a.SUBSECTOR, "EXPERTISE_COMPTABLE");
    expect("UTM_SOURCE", a.UTM_SOURCE, "linkedin");
    expect("UTM_MEDIUM", a.UTM_MEDIUM, "organic");
    expect("UTM_CAMPAIGN", a.UTM_CAMPAIGN, "guide_experts_comptables");
    expect("UTM_CONTENT", a.UTM_CONTENT, "LI_EC_20261008_01");
    expect("BESOIN_PRIORITAIRE", a.BESOIN_PRIORITAIRE, "DEPLOYER_AGENT_IA");
    expect("HORIZON_PROJET", a.HORIZON_PROJET, "MOINS_3_MOIS");
    expect("LIFECYCLE_STAGE", a.LIFECYCLE_STAGE, "LEAD");
    expect("LEAD_SCORE", a.LEAD_SCORE, 12);
    expect("LEAD_SCORE (type)", typeof a.LEAD_SCORE, "number");
    expect("EMAIL_STATUS", a.EMAIL_STATUS, "PENDING");
    // PHONE_STATUS ne décrit que le numéro réellement stocké dans SMS
    expect("PHONE_STATUS", a.PHONE_STATUS, a.SMS ? "VALID_FORMAT" : undefined);
    expect("OPT_IN (case non cochée)", a.OPT_IN, false);
  }

  const ev = await sendBrevoEvent(BREVO_EVENTS.LEAD_MAGNET_SUBMITTED, { contact_id: c1!.id }, {
    resource: source.resource,
    vertical: source.vertical,
    subsector: source.subsector,
    utm_source: "linkedin",
    utm_campaign: "guide_experts_comptables",
    utm_content: "LI_EC_20261008_01",
    landing_page: "/r/12-cas-usage-experts-comptables",
    smoke_test: true,
  });
  expect("événement", ev ? "accepté" : "refusé", "accepté");
  expect("jeton confirmation", readEmailConfirmToken(a.EMAIL_CONFIRM_TOKEN) === email ? "lisible serveur" : "absent", "lisible serveur");

  /* 2. Score commercial monté à 30, puis nouvelle soumission depuis Google */
  await brevoRequest(`/contacts/${c1!.id}?identifierType=contact_id`, {
    method: "PUT",
    body: { attributes: { LEAD_SCORE: 30 } },
  });
  const c2 = await getContactByEmail(email);
  const u2 = buildContactUpdate(c2, {
    prenom: "Test",
    nom: "QA Althoce",
    besoin: "VEILLE_IA",
    horizon: "PAS_DE_PROJET",
    optIn: true,
    phone,
    attribution: { utm_source: "google", utm_medium: "cpc", utm_content: "GOOGLE_01" },
    source: LEAD_MAGNETS["guide-claude-pennylane"],
    now: new Date(),
  });
  await upsertContact(email, u2.attributes, [], c2, (attrs) => withoutRejectedSms(attrs, c2));
  const c3 = await getContactByEmail(email);
  const b = c3?.attributes ?? {};
  console.log("2) Nouvelle soumission (Google, autre guide, score formulaire 1)");
  expect("même contact", c3?.id, c1!.id);
  expect("UTM_SOURCE", b.UTM_SOURCE, "linkedin");
  expect("UTM_CONTENT", b.UTM_CONTENT, "LI_EC_20261008_01");
  expect("LEAD_SCORE", b.LEAD_SCORE, 30);
  expect("LIFECYCLE_STAGE", b.LIFECYCLE_STAGE, "HOT_LEAD");
  expect("RESSOURCE", b.RESSOURCE, "guide-claude-pennylane");
  expect("OPT_IN (case cochée)", b.OPT_IN, true);
  expect("listes", (c3?.listIds ?? []).length, 0);

  /* 3. Nettoyage : aucun numéro fictif ne reste stocké, donc aucun PHONE_STATUS */
  await brevoRequest(`/contacts/${c1!.id}?identifierType=contact_id`, {
    method: "PUT",
    body: { attributes: { SMS: "", PHONE_STATUS: "" } },
  });
  const c4 = await getContactByEmail(email);
  console.log("3) Nettoyage du numéro de test");
  expect("SMS", c4?.attributes.SMS, undefined);
  expect("PHONE_STATUS", c4?.attributes.PHONE_STATUS, undefined);

  console.log(
    failures
      ? `\n✗ ${failures} écart(s).`
      : `\n✓ Tout est conforme. Supprimer le contact de test dans Brevo (Contacts → ${email}) après contrôle.`
  );
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
