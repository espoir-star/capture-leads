/**
 * Modèles email du moteur de séquences → Brevo. DRY RUN PAR DÉFAUT.
 *
 *   npm run brevo:templates            → état de chaque modèle (absent, identique, à mettre à jour)
 *   npm run brevo:templates -- --apply → crée les absents, met à jour ceux qui diffèrent
 *
 * Rapprochement par NOM EXACT (config/emailTemplates.ts). Ne touche à aucun
 * autre modèle (les emails des automations Brevo historiques restent intacts).
 * Expéditeur : Althoce <bonjour@althoce.fr>, réponses sur REPLY_TO.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { EMAIL_TEMPLATES } from "@/config/emailTemplates";
import { REPLY_TO, SENDERS } from "@/config/senders";

const APPLY = process.argv.includes("--apply");

interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
  isActive: boolean;
}

async function listTemplates(): Promise<BrevoTemplate[]> {
  const all: BrevoTemplate[] = [];
  for (let offset = 0; ; offset += 100) {
    const res = await brevoRequest<{ templates?: BrevoTemplate[]; count?: number }>(
      `/smtp/templates?limit=100&offset=${offset}`
    );
    if (!res.ok) throw new Error(`Lecture des modèles refusée : ${res.status} ${res.message ?? ""}`);
    all.push(...(res.data?.templates ?? []));
    if (offset + 100 >= (res.data?.count ?? 0)) return all;
  }
}

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — modèles du moteur de séquences\n`);
  const existing = await listTemplates();

  for (const [key, def] of Object.entries(EMAIL_TEMPLATES)) {
    const html = readFileSync(resolve(process.cwd(), def.file), "utf8");
    const matches = existing.filter((t) => t.name === def.name);
    if (matches.length > 1) {
      console.log(`  ✗ ${key} : ${matches.length} modèles portent le nom « ${def.name} » (à dédoublonner à la main)`);
      continue;
    }
    const body = {
      templateName: def.name,
      subject: def.subject,
      htmlContent: html,
      sender: SENDERS.resources,
      replyTo: REPLY_TO,
      isActive: true,
      tag: "sequences",
    };
    const t = matches[0];
    if (!t) {
      if (!APPLY) {
        console.log(`  + ${key} : absent (--apply le crée)`);
        continue;
      }
      const res = await brevoRequest<{ id: number }>("/smtp/templates", { method: "POST", body, retries: 0 });
      if (!res.ok || !res.data?.id) throw new Error(`Création refusée (${key}) : ${res.status} ${res.message ?? ""}`);
      console.log(`  ✓ ${key} : créé → config/emailTemplates.ts : id ${res.data.id}`);
      continue;
    }
    const same = t.htmlContent === html && t.subject === def.subject && t.isActive;
    const idNote = def.id === t.id ? "" : `  → config/emailTemplates.ts : id ${t.id}`;
    if (same) {
      console.log(`  = ${key} : identique (id ${t.id})${idNote}`);
      continue;
    }
    if (!APPLY) {
      console.log(`  ~ ${key} : diffère du fichier (id ${t.id}, --apply le met à jour)${idNote}`);
      continue;
    }
    const res = await brevoRequest(`/smtp/templates/${t.id}`, { method: "PUT", body, retries: 0 });
    if (!res.ok) throw new Error(`Mise à jour refusée (${key}) : ${res.status} ${res.message ?? ""}`);
    console.log(`  ✓ ${key} : mis à jour (id ${t.id})${idNote}`);
  }
  console.log("");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
