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
 *   npm run newsletter -- <fichier> --update
 *        → met à jour un BROUILLON déjà créé (objet, aperçu, contenu) après relecture.
 *          Refusé si la campagne n'est plus un brouillon. Ne programme jamais.
 *
 *   npm run newsletter -- <fichier> --schedule
 *        → programme à `scheduledAt` un BROUILLON déjà créé (status "created"),
 *          après relecture et accord explicite. Remet le contenu à jour, vérifie
 *          l'audience du brouillon puis confirme que Brevo l'a mis en file (queued).
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
const UPDATE = argv.includes("--update");
const SCHEDULE_DRAFT = SCHEDULE && !CREATE;

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
  if (!file) throw new Error("Usage : npm run newsletter -- content/newsletters/<fichier>.md [--create] [--schedule] [--update]");
  if (UPDATE && SCHEDULE) throw new Error("--update ne programme jamais : --schedule seul programme un brouillon déjà créé");
  if (UPDATE && CREATE) throw new Error("--update met à jour un brouillon existant : ne pas combiner avec --create");

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

  console.log(`\n${CREATE ? (SCHEDULE ? "CRÉATION + PROGRAMMATION" : "CRÉATION (brouillon)") : SCHEDULE_DRAFT ? "PROGRAMMATION DU BROUILLON" : "DRY RUN"} — ${nl.name}\n`);
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

  /** Garde-fous de toute programmation : segments validés, audience et expéditeur trouvés, date future. */
  const sendingErrors = () => {
    const errors: string[] = [];
    // Les segments actuels doivent être validés manuellement après la migration
    // de OPT_IN vers MARKETING_STATUS avant toute création de campagne.
    if (process.env.MARKETING_SEGMENTS_REVIEWED !== "true") {
      errors.push("Segments marketing non validés : reconfigurer Brevo puis MARKETING_SEGMENTS_REVIEWED=true");
    }
    if (!getApiKey()) errors.push("BREVO_API_KEY absente");
    if (!targetId) errors.push(`segment « ${audience.segment.name} » introuvable dans Brevo (créer puis npm run brevo:segments)`);
    if (!senderOk) errors.push(`expéditeur ${NEWSLETTER_SENDER.email} absent ou inactif dans Brevo (npm run brevo:domain)`);
    if (SCHEDULE) {
      if (!meta.scheduledAt) errors.push("scheduledAt manquant");
      else if (new Date(meta.scheduledAt).getTime() < Date.now() + 15 * 60_000)
        errors.push("scheduledAt doit être au moins 15 min dans le futur");
    }
    return errors;
  };

  if (UPDATE || SCHEDULE_DRAFT) {
    if (!getApiKey()) throw new Error("Refusé : BREVO_API_KEY absente");
    if (!meta.brevoCampaignId) throw new Error("Refusé : aucun brevoCampaignId dans le fichier (créer d'abord avec --create)");
    if (meta.status !== "created") throw new Error(`Refusé : statut "${meta.status}" (seul un brouillon créé, status "created", se met à jour)`);
    const current = await brevoRequest<{ status?: string; name?: string; recipients?: { segments?: number[]; excludedSegments?: number[] } }>(
      `/emailCampaigns/${meta.brevoCampaignId}?excludeHtmlContent=true`
    );
    if (!current.ok) throw new Error(`Refusé : campagne #${meta.brevoCampaignId} illisible (${current.status})`);
    if (current.data?.status !== "draft") throw new Error(`Refusé : la campagne #${meta.brevoCampaignId} n'est plus un brouillon (${current.data?.status})`);
    if (current.data?.name !== nl.name) throw new Error(`Refusé : la campagne #${meta.brevoCampaignId} ne correspond pas à ${nl.name}`);
    if (SCHEDULE_DRAFT) {
      const errors = sendingErrors();
      const same = (a: number[] = [], b: number[]) => [...a].sort().join() === [...b].sort().join();
      const r = current.data?.recipients;
      if (targetId && !same(r?.segments, [targetId])) errors.push(`audience du brouillon ${JSON.stringify(r?.segments ?? [])} ≠ segment ${targetId}`);
      if (!same(r?.excludedSegments, excludeIds)) errors.push(`exclusions du brouillon ${JSON.stringify(r?.excludedSegments ?? [])} ≠ ${JSON.stringify(excludeIds)}`);
      if (errors.length) throw new Error(`Refusé :\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    }
    const upd = await brevoRequest(`/emailCampaigns/${meta.brevoCampaignId}`, {
      method: "PUT",
      body: {
        subject: meta.subject,
        previewText: meta.previewText || undefined,
        htmlContent: html,
        sender: NEWSLETTER_SENDER,
        replyTo: NEWSLETTER_REPLY_TO,
        ...(SCHEDULE_DRAFT && { scheduledAt: meta.scheduledAt }),
      },
      retries: 0,
    });
    if (!upd.ok) throw new Error(`${SCHEDULE_DRAFT ? "Programmation" : "Mise à jour"} refusée par Brevo : ${upd.status} ${upd.code ?? ""} ${upd.message ?? ""}`);
    if (UPDATE) {
      console.log(`\n✓ Brouillon #${meta.brevoCampaignId} mis à jour (toujours en brouillon, rien n'est programmé).\n`);
      return;
    }
    // Brevo indique une campagne programmée par le statut « queued » : le fichier n'est marqué qu'après relecture.
    const after = await brevoRequest<{ status?: string; scheduledAt?: string }>(`/emailCampaigns/${meta.brevoCampaignId}?excludeHtmlContent=true`);
    if (after.data?.status !== "queued") {
      throw new Error(`Programmation non confirmée : la campagne #${meta.brevoCampaignId} est « ${after.data?.status ?? "illisible"} » (attendu : queued). Vérifier dans Brevo.`);
    }
    markFile(nl.file, "scheduled", meta.brevoCampaignId);
    console.log(`\n✓ Campagne #${meta.brevoCampaignId} programmée le ${fmtDate(after.data.scheduledAt || meta.scheduledAt)} (statut Brevo : queued).`);
    console.log("  Elle peut encore être suspendue depuis Brevo avant l'heure d'envoi.\n");
    return;
  }

  if (!CREATE) {
    console.log("\nDRY RUN : rien n'a été créé ni envoyé. Ajouter --create (brouillon), --create --schedule, ou --schedule pour un brouillon déjà créé.\n");
    return;
  }

  /* ── Garde-fous ── */
  const errors = sendingErrors();
  if (meta.status !== "ready") errors.push(`status doit être "ready" (actuel : ${meta.status})`);
  if (meta.brevoCampaignId) errors.push(`déjà créée (brevoCampaignId ${meta.brevoCampaignId})`);
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
      // Brevo Free refuse l'option tag sur les campagnes (« not allowed to avail tag option ») :
      // le tag reste dans le fichier et le nom de campagne ; envoyé seulement si l'offre le permet.
      ...(process.env.BREVO_CAMPAIGN_TAGS === "true" && { tag: meta.tag }),
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
