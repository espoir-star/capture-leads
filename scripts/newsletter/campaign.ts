/**
 * Newsletter-as-code → campagne Brevo. DRY RUN PAR DÉFAUT.
 *
 *   npm run newsletter -- content/newsletters/2026-11-03-finance.md
 *        → affiche sujet, audience, date/heure, tag, UTM, expéditeur
 *          + écrit un aperçu HTML local (.newsletter-previews/). Rien n'est créé.
 *
 *   npm run newsletter -- <fichier> --create
 *        → crée la campagne en BROUILLON dans Brevo (aucun envoi)
 *
 *   npm run newsletter -- <fichier> --create --schedule
 *        → crée ET programme à `scheduledAt`
 *
 * Garde-fous : status "ready" exigé, segment d'audience existant dans Brevo,
 * expéditeur actif dans Brevo (domaine althoce.fr authentifié),
 * date future, refus si une campagne du même nom existe déjà ou si le
 * fichier porte déjà un brevoCampaignId. Un fichier Markdown seul ne
 * déclenche jamais d'envoi.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { listSegments, resolveSegmentId, type BrevoSegment } from "@/lib/brevo/segments";
import { findActiveSender, listSenders, type BrevoSender } from "@/lib/brevo/senders";
import { AUDIENCES, NEWSLETTER_REPLY_TO, NEWSLETTER_SENDER, NEWSLETTER_TIMEZONE } from "@/config/newsletter";
import { campaignUtm, loadNewsletter, renderNewsletterHtml } from "@/lib/newsletter";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const CREATE = argv.includes("--create");
const SCHEDULE = argv.includes("--schedule");

function fmtDate(iso?: string) {
  if (!iso) return "(non programmée)";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: NEWSLETTER_TIMEZONE,
  }).format(new Date(iso));
}

/** Écrit le statut et l'ID Brevo dans le frontmatter (trace + anti-doublon). */
function markFile(path: string, status: "created" | "scheduled", id: number) {
  const src = readFileSync(path, "utf8");
  const [, fm, rest] = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
  if (fm === undefined) return;
  const lines = fm
    .split("\n")
    .filter((l) => !/^brevoCampaignId:/.test(l))
    .map((l) => (/^status:/.test(l) ? `status: ${status}` : l));
  lines.push(`brevoCampaignId: ${id}`);
  writeFileSync(path, `---\n${lines.join("\n")}\n---\n${rest}`);
}

async function main() {
  if (!file) throw new Error("Usage : npm run newsletter -- content/newsletters/<fichier>.md [--create] [--schedule]");
  if (SCHEDULE && !CREATE) throw new Error("--schedule s'utilise avec --create (création + programmation)");

  const nl = loadNewsletter(file);
  const { meta } = nl;
  const audience = AUDIENCES[meta.audience];
  const utm = campaignUtm(meta);

  // Segments : ID configuré, sinon nom exact dans Brevo (jamais d'ID inventé)
  let segments: BrevoSegment[] | null = null;
  let senders: BrevoSender[] | null = null;
  if (getApiKey()) {
    segments = await listSegments().catch(() => null);
    senders = await listSenders().catch(() => null);
  }
  const senderOk = senders ? !!findActiveSender(senders, NEWSLETTER_SENDER.email) : null;
  const targetId = segments ? resolveSegmentId(audience.segment, segments) : audience.segment.id;
  const excludeIds = audience.exclude
    .map((ref) => (segments ? resolveSegmentId(ref, segments) : ref.id))
    .filter((id): id is number => !!id);
  const html = renderNewsletterHtml(nl);

  const previewDir = resolve(process.cwd(), ".newsletter-previews");
  mkdirSync(previewDir, { recursive: true });
  const previewFile = resolve(previewDir, `${nl.name.replace(/\W+/g, "-")}.html`);
  writeFileSync(previewFile, html);

  console.log(`\n${CREATE ? (SCHEDULE ? "CRÉATION + PROGRAMMATION" : "CRÉATION (brouillon)") : "DRY RUN"} — ${nl.name}\n`);
  console.log(`  Sujet        ${meta.subject}`);
  console.log(`  Aperçu       ${meta.previewText || "(vide)"}`);
  console.log(`  Audience     ${meta.audience} → ${audience.label}`);
  console.log(`               segment « ${audience.segment.name} » → ${targetId ? `id ${targetId}` : "⚠ INTROUVABLE dans Brevo (à créer, voir npm run brevo:segments)"}`);
  console.log(`               exclusions ${audience.exclude.map((r) => `« ${r.name} »`).join(", ")} → ${excludeIds.join(", ") || "aucune trouvée"}`);
  console.log(`               ${audience.segment.conditions}`);
  console.log(`  Date/heure   ${fmtDate(meta.scheduledAt)} (${NEWSLETTER_TIMEZONE})`);
  console.log(`  Tag          ${meta.tag}`);
  console.log(`  UTM          ${new URLSearchParams(utm as Record<string, string>).toString()}`);
  console.log(`  Expéditeur   ${NEWSLETTER_SENDER.name} <${NEWSLETTER_SENDER.email}> · réponse ${NEWSLETTER_REPLY_TO}`);
  if (senderOk === false) console.log("               ⚠ expéditeur absent ou inactif dans Brevo (npm run brevo:domain)");
  console.log(`  Statut       ${meta.status}${meta.brevoCampaignId ? ` · campagne Brevo #${meta.brevoCampaignId}` : ""}`);
  console.log(`  Aperçu HTML  ${previewFile}`);

  if (!CREATE) {
    console.log("\nDRY RUN : rien n'a été créé ni envoyé. Ajouter --create (brouillon) ou --create --schedule.\n");
    return;
  }

  /* ── Garde-fous ── */
  const errors: string[] = [];
  if (!getApiKey()) errors.push("BREVO_API_KEY absente");
  if (meta.status !== "ready") errors.push(`status doit être "ready" (actuel : ${meta.status})`);
  if (meta.brevoCampaignId) errors.push(`déjà créée (brevoCampaignId ${meta.brevoCampaignId})`);
  if (!targetId) errors.push(`segment « ${audience.segment.name} » introuvable dans Brevo (créer puis npm run brevo:segments)`);
  if (!senderOk) errors.push(`expéditeur ${NEWSLETTER_SENDER.email} absent ou inactif dans Brevo (npm run brevo:domain)`);
  if (SCHEDULE) {
    if (!meta.scheduledAt) errors.push("scheduledAt manquant");
    else if (new Date(meta.scheduledAt).getTime() < Date.now() + 15 * 60_000)
      errors.push("scheduledAt doit être au moins 15 min dans le futur");
  }
  if (errors.length) throw new Error(`Refusé :\n${errors.map((e) => `  - ${e}`).join("\n")}`);

  const existing = await brevoRequest<{ campaigns?: { id: number; name: string }[] }>(
    "/emailCampaigns?limit=100&sort=desc&excludeHtmlContent=true"
  );
  const twin = existing.data?.campaigns?.find((c) => c.name === nl.name);
  if (twin) throw new Error(`Refusé : une campagne "${nl.name}" existe déjà dans Brevo (#${twin.id})`);

  const res = await brevoRequest<{ id: number }>("/emailCampaigns", {
    method: "POST",
    body: {
      name: nl.name,
      subject: meta.subject,
      previewText: meta.previewText || undefined,
      sender: NEWSLETTER_SENDER,
      replyTo: NEWSLETTER_REPLY_TO,
      htmlContent: html,
      tag: meta.tag,
      recipients: {
        segmentIds: [targetId],
        ...(excludeIds.length && { exclusionSegmentIds: excludeIds }),
      },
      ...(SCHEDULE && { scheduledAt: meta.scheduledAt }),
    },
    retries: 0,
  });
  if (!res.ok || !res.data?.id) throw new Error(`Création refusée par Brevo : ${res.status} ${res.code ?? ""} ${res.message ?? ""}`);

  markFile(nl.file, SCHEDULE ? "scheduled" : "created", res.data.id);
  console.log(`\n✓ Campagne #${res.data.id} ${SCHEDULE ? `programmée le ${fmtDate(meta.scheduledAt)}` : "créée en brouillon"}.`);
  console.log("  Envoyer un test depuis Brevo avant la date d'envoi (vérifier liens, désinscription, rendu mobile).\n");
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
