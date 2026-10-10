/**
 * Webhooks Brevo → /api/webhooks/brevo (point d'entrée UNIQUE, voir la route) :
 *   hardBounce         → EMAIL_STATUS = BOUNCED
 *   unsubscribed, spam → MARKETING_STATUS = OPPOSED (désinscription d'une
 *                        campagne ou du lien Brevo d'un email transactionnel)
 *   click              → scoring comportemental (journal n8n)
 *   autres             → reçus, sans effet (0 point) : delivered, opened…
 * Les deux webhooks existants sont COMPLÉTÉS (PUT), jamais dupliqués.
 * API officielle : POST /v3/webhooks (création), PUT /v3/webhooks/{id}
 * (ajout d'événements à un webhook existant), authentification Bearer.
 *
 *   npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo            → DRY RUN
 *   npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo --apply    → création / mise à jour
 *
 * L'événement unsubscribed n'est utile qu'une fois déployée la version de la
 * route qui le traite (branche marketing) : la version précédente l'ignore.
 *
 * BREVO_WEBHOOK_SECRET (même valeur que sur Vercel) est envoyé par Brevo dans
 * l'en-tête « Authorization: Bearer … ». À créer UNIQUEMENT quand la route est
 * déployée sur l'URL indiquée (sinon Brevo abandonne les événements).
 */

import { brevoRequest, getApiKey } from "@/lib/brevo/api";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const url = argv[argv.indexOf("--url") + 1];

const WEBHOOKS = [
  {
    type: "marketing",
    events: ["delivered", "opened", "click", "hardBounce", "softBounce", "spam", "unsubscribed"],
    description: "Althoce — événements campagnes (statuts, opposition, scoring)",
  },
  {
    type: "transactional",
    events: ["request", "delivered", "opened", "uniqueOpened", "click", "hardBounce", "softBounce", "blocked", "invalid", "deferred", "spam", "unsubscribed"],
    description: "Althoce — événements transactionnels (statuts, opposition, scoring)",
  },
];

async function main() {
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente (.env)");
  const secret = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!argv.includes("--url") || !/^https:\/\/[^/]+\/api\/webhooks\/brevo$/.test(url ?? "")) {
    throw new Error("Usage : npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo [--apply]");
  }
  if (!secret || secret.length < 32) throw new Error("BREVO_WEBHOOK_SECRET absent ou trop court (openssl rand -hex 32)");

  const existing = await brevoRequest<{ webhooks?: { id: number; url: string; type: string; events: string[] }[] }>(
    "/webhooks"
  );
  const current = existing.data?.webhooks ?? [];
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — webhooks Brevo vers ${url}\n`);
  for (const w of WEBHOOKS) {
    const twin = current.find((c) => c.url.split("?")[0] === url && c.type === w.type);
    if (twin) {
      const missing = w.events.filter((e) => !twin.events.includes(e));
      if (!missing.length) {
        console.log(`  = ${w.type.padEnd(13)} à jour (#${twin.id}, événements ${twin.events.join(", ")})`);
        continue;
      }
      console.log(`  ~ ${w.type.padEnd(13)} #${twin.id} : ajout de ${missing.join(", ")}`);
      if (!APPLY) continue;
      const upd = await brevoRequest(`/webhooks/${twin.id}`, {
        method: "PUT",
        body: { events: [...new Set([...twin.events, ...w.events])], auth: { type: "bearer", token: secret } },
        retries: 0,
      });
      console.log(upd.ok ? "    ✓ mis à jour" : `    ✗ ${upd.status} ${upd.code ?? ""} ${upd.message ?? ""}`);
      if (!upd.ok) process.exitCode = 1;
      continue;
    }
    console.log(`  + ${w.type.padEnd(13)} événements ${w.events.join(", ")}, auth Bearer`);
    if (!APPLY) continue;
    const res = await brevoRequest<{ id: number }>("/webhooks", {
      method: "POST",
      body: { url, description: w.description, type: w.type, events: w.events, auth: { type: "bearer", token: secret } },
      retries: 0,
    });
    console.log(res.ok ? `    ✓ créé #${res.data?.id}` : `    ✗ ${res.status} ${res.code ?? ""} ${res.message ?? ""}`);
    if (!res.ok) process.exitCode = 1;
  }
  if (!APPLY) console.log("\nDRY RUN : rien n'a été créé. Ajouter --apply.\n");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
