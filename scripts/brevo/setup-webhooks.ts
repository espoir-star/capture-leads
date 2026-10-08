/**
 * Webhooks Brevo → /api/webhooks/brevo (hard bounce → EMAIL_STATUS = BOUNCED).
 * API officielle : POST /v3/webhooks, authentification Bearer.
 *
 *   npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo            → DRY RUN
 *   npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo --apply    → création
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
  { type: "marketing", events: ["hardBounce"], description: "Althoce — hard bounce campagnes → EMAIL_STATUS" },
  { type: "transactional", events: ["hardBounce"], description: "Althoce — hard bounce transactionnel → EMAIL_STATUS" },
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
      console.log(`  = ${w.type.padEnd(13)} existe déjà (#${twin.id}, événements ${twin.events.join(", ")})`);
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
