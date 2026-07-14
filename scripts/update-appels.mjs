/**
 * Met à jour le suivi des appels dans Brevo :
 * 1. Crée les attributs STATUT_APPEL / NOTE_APPEL / DATE_APPEL s'ils manquent
 * 2. Met à jour les attributs de 3 contacts (sans toucher au reste)
 *
 * Usage : node scripts/update-appels.mjs
 * Clé lue dans .env.local puis .env (BREVO_API_KEY=...)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://api.brevo.com/v3";

function chargerCle() {
  for (const fichier of [".env.local", ".env"]) {
    try {
      const contenu = readFileSync(resolve(process.cwd(), fichier), "utf8");
      const m = contenu.match(/^BREVO_API_KEY=(.+)$/m);
      if (m) return { cle: m[1].trim(), source: fichier };
    } catch {
      /* fichier absent : on tente le suivant */
    }
  }
  return null;
}

const env = chargerCle();
if (!env) {
  console.error("BREVO_API_KEY introuvable dans .env.local ou .env");
  process.exit(1);
}
console.log(`Clé chargée depuis ${env.source}\n`);

const ENTETES = {
  "api-key": env.cle,
  "Content-Type": "application/json",
  Accept: "application/json",
};

const ATTRIBUTS = ["STATUT_APPEL", "NOTE_APPEL", "DATE_APPEL"];

const CONTACTS = [
  {
    email: "j.dray@jenher.fr",
    attributes: {
      STATUT_APPEL: "A rappeler",
      NOTE_APPEL:
        "Veut etre rappelee a la rentree. Souhaite commencer a integrer l'IA.",
      DATE_APPEL: "2026-07-14",
    },
  },
  {
    email: "contact@theia-expertise.fr",
    attributes: {
      STATUT_APPEL: "Non qualifie",
      NOTE_APPEL: "Developpe ses propres solutions en interne. Pas de budget.",
      DATE_APPEL: "2026-07-14",
    },
  },
  {
    email: "t.vieira@cabinet-hive.com",
    attributes: {
      STATUT_APPEL: "RDV booke",
      NOTE_APPEL: "Call booke pour le 30/07.",
      DATE_APPEL: "2026-07-14",
    },
  },
];

/* ── 1. Attributs ──────────────────────────────────────────────── */
console.log("── Création des attributs ──");
for (const nom of ATTRIBUTS) {
  const res = await fetch(`${API}/contacts/attributes/normal/${nom}`, {
    method: "POST",
    headers: ENTETES,
    body: JSON.stringify({ type: "text" }),
  });
  if (res.status === 201) {
    console.log(`  ${nom} : créé`);
  } else {
    const err = await res.json().catch(() => null);
    if (err?.code === "duplicate_parameter") {
      console.log(`  ${nom} : existe déjà`);
    } else {
      console.error(`  ${nom} : ERREUR ${res.status}`, err);
      process.exitCode = 1;
    }
  }
}

/* ── 2. Mise à jour des contacts ───────────────────────────────── */
console.log("\n── Mise à jour des contacts ──");
for (const { email, attributes } of CONTACTS) {
  const res = await fetch(`${API}/contacts/${encodeURIComponent(email)}`, {
    method: "PUT",
    headers: ENTETES,
    body: JSON.stringify({ attributes }),
  });
  if (res.status === 204) {
    console.log(`  ✓ ${email} → ${attributes.STATUT_APPEL}`);
  } else {
    const err = await res.json().catch(() => null);
    console.error(`  ✗ ${email} : ERREUR ${res.status}`, err);
    process.exitCode = 1;
  }
}
