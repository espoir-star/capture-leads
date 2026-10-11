/**
 * Projection CRM et reprise des demandes multi-guides.
 * Un reçu de livraison porte la clé de SA demande : un envoi A terminé
 * ne peut jamais solder la demande B. Aucun email/secret n'est journalisé ici.
 * Activation explicite par ALTHOCE_MULTI_GUIDES (off par défaut).
 */
import { getSequence } from "@/config/sequences";
import { GUIDE_DELIVERY_MAX_AGE_HOURS, guideStateFields, multiGuidesEnabled } from "@/config/multiGuides";
import { brevoRequest, getContactById, type AttributeValue, type BrevoContact } from "@/lib/brevo/api";
import { deliverGuide, enrollInSequence } from "@/lib/sequences/run";
import { decideStep } from "@/lib/sequences/plan";
import { guideDeliveryKey, guideEnrollmentKey, guideSummaryAttributes, knownGuideRequests, parseGuideRequest, type GuideRequest } from "@/lib/guides/requests";

export interface Receipt { key: string; status: "SENT" | "ENROLLED" | "SKIPPED" | "EXPIRED"; at: string }
export function readGuideReceipt(raw: unknown): Receipt | null {
  if (typeof raw !== "string" || raw.length > 500) return null;
  try {
    const r = JSON.parse(raw) as Receipt;
    if (!r || !/^[a-f0-9]{32}$/.test(r.key) || !["SENT", "ENROLLED", "SKIPPED", "EXPIRED"].includes(r.status) || !Number.isFinite(Date.parse(r.at))) return null;
    return r;
  } catch { return null; }
}

async function write(id: number, attributes: Record<string, AttributeValue>): Promise<void> {
  const res = await brevoRequest(`/contacts/${id}?identifierType=contact_id`, { method: "PUT", body: { attributes }, retries: 2 });
  if (!res.ok) throw new Error(`Écriture suivi guides refusée (contact ${id}, HTTP ${res.status})`);
}
async function receipt(id: number, field: string, key: string, status: Receipt["status"], now: Date): Promise<void> {
  await write(id, { [field]: JSON.stringify({ key, status, at: now.toISOString() } satisfies Receipt) });
}

/** Relecture avant agrégation : convergence périodique, pas compteur concurrent +1. */
export async function refreshGuideSummary(contactId: number, now = new Date()): Promise<boolean> {
  const current = await getContactById(contactId);
  if (!current || !multiGuidesEnabled(current.email)) return false;
  const summary = guideSummaryAttributes(current, now);
  const delta = Object.fromEntries(Object.entries(summary).filter(([k, v]) => current.attributes[k] !== v));
  if (!Object.keys(delta).length) return false;
  await write(contactId, delta);
  return true;
}

export interface GuideProcessReport {
  delivery: "sent" | "already_sent" | "pending" | "expired" | "blocked" | "legacy" | "absent" | "disabled";
  enrollment?: "enrolled" | "already_enrolled" | "pending" | "skipped" | "none";
}

/** Réessaie UNE ressource ; ne modifie jamais la demande d'une autre ressource. */
export async function processGuideRequest(contactId: number, slug: string, now = new Date()): Promise<GuideProcessReport> {
  let contact = await getContactById(contactId);
  if (!contact) return { delivery: "absent" };
  if (!multiGuidesEnabled(contact.email)) return { delivery: "disabled" };
  const fields = guideStateFields(slug);
  const request = parseGuideRequest(contact.attributes[fields.request], slug);
  if (!request || !request.queued) return { delivery: "legacy" };
  const seq = getSequence(request.sequenceId);
  if (!seq) throw new Error("Séquence du guide absente");
  const sendKey = guideDeliveryKey(contactId, request);
  const prior = readGuideReceipt(contact.attributes[fields.sent]);
  const done = prior?.key === sendKey ? prior : null;
  let delivery: GuideProcessReport["delivery"] = "already_sent";
  if (done?.status === "EXPIRED") return { delivery: "expired" };
  if (done?.status !== "SENT") {
    if (!decideStep(contact, { category: "transactional" }).send) return { delivery: "blocked" };
    const age = now.getTime() - Date.parse(request.requestedAt);
    if (age < 0) return { delivery: "pending" };
    if (age > GUIDE_DELIVERY_MAX_AGE_HOURS * 3_600_000) {
      await receipt(contactId, fields.sent, sendKey, "EXPIRED", now);
      return { delivery: "expired" };
    }
    const result = await deliverGuide({ seq, contactId, email: contact.email, slug, emailStatus: contact.attributes.EMAIL_STATUS, now, requestedAt: new Date(request.requestedAt) });
    if (result.status === "error") return { delivery: "pending" };
    await receipt(contactId, fields.sent, sendKey, "SENT", now);
    delivery = result.status === "sent" ? "sent" : "already_sent";
  }
  const enrollKey = guideEnrollmentKey(contactId, request);
  if (!enrollKey) return { delivery, enrollment: "none" };
  // Une opposition peut intervenir pendant la livraison : la relire avant d'inscrire.
  contact = await getContactById(contactId);
  if (!contact) return { delivery, enrollment: "skipped" };
  const previous = readGuideReceipt(contact.attributes[fields.enrolled]);
  if (previous?.key === enrollKey && ["ENROLLED", "SKIPPED"].includes(previous.status)) {
    return { delivery, enrollment: previous.status === "ENROLLED" ? "already_enrolled" : "skipped" };
  }
  if (!decideStep(contact, { category: "marketing" }).send) {
    await receipt(contactId, fields.enrolled, enrollKey, "SKIPPED", now);
    return { delivery, enrollment: "skipped" };
  }
  const outcome = await enrollInSequence({ seq, contactId, slug, now: new Date(request.followupAt!), ...(request.scale && { timeScale: request.scale }) });
  if (outcome === "enrolled" || outcome === "no_steps") {
    await receipt(contactId, fields.enrolled, enrollKey, outcome === "enrolled" ? "ENROLLED" : "SKIPPED", now);
    return { delivery, enrollment: outcome === "enrolled" ? "enrolled" : "none" };
  }
  // Le champ de demande est toujours présent : rattrapage à la maintenance suivante.
  return { delivery, enrollment: "pending" };
}

export interface MultiGuideMaintenanceReport {
  enabled: boolean;
  scanned: number;
  candidates: number;
  processed: number;
  pending: number;
  failed: number;
  refreshed: number;
  budgetExceeded: boolean;
}

function needsProcessing(c: BrevoContact, r: GuideRequest, now: Date): boolean {
  if (!r.queued || now.getTime() - Date.parse(r.requestedAt) < 10 * 60_000) return false;
  const fields = guideStateFields(r.slug);
  const d = readGuideReceipt(c.attributes[fields.sent]);
  if (d?.key === guideDeliveryKey(c.id, r) && d.status === "EXPIRED") return false;
  if (d?.key !== guideDeliveryKey(c.id, r) || d.status !== "SENT") return true;
  const k = guideEnrollmentKey(c.id, r);
  const e = readGuideReceipt(c.attributes[fields.enrolled]);
  return !!k && (e?.key !== k || !["ENROLLED", "SKIPPED"].includes(e.status));
}

/**
 * Maintenance bornée, paginée, réservée aux contacts activés. Pas de backfill
 * implicite des anciens contacts. Rotation horaire des candidats pour ne pas
 * bloquer toujours la file sur le même contact en erreur.
 * Le budget est contrôlé entre opérations, ce n'est pas une garantie de durée
 * maximale d'un appel distant ; surveiller budgetExceeded/failed en production.
 */
export async function maintainMultiGuides(now = new Date(), options: { budgetMs?: number; maxJobs?: number } = {}): Promise<MultiGuideMaintenanceReport> {
  const report: MultiGuideMaintenanceReport = { enabled: false, scanned: 0, candidates: 0, processed: 0, pending: 0, failed: 0, refreshed: 0, budgetExceeded: false };
  if (!["on", "qa"].includes(process.env.ALTHOCE_MULTI_GUIDES ?? "")) return report;
  report.enabled = true;
  const started = Date.now();
  const budget = options.budgetMs ?? 25_000;
  const contacts: BrevoContact[] = [];
  let allPages = false;
  for (let page = 0; page < 100; page++) {
    if (Date.now() - started > budget) { report.budgetExceeded = true; return report; }
    const res = await brevoRequest<{ contacts?: BrevoContact[] }>(`/contacts?limit=500&offset=${page * 500}&sort=asc`, { method: "GET", retries: 1 });
    if (!res.ok || !Array.isArray(res.data?.contacts)) throw new Error("Lecture maintenance multi-guides impossible");
    report.scanned += res.data.contacts.length;
    contacts.push(...res.data.contacts.filter((c) => multiGuidesEnabled(c.email) && knownGuideRequests(c).length > 0));
    if (res.data.contacts.length < 500) { allPages = true; break; }
  }
  if (!allPages) throw new Error("Pagination maintenance multi-guides incomplète");
  const jobs = contacts.flatMap((c) => knownGuideRequests(c).filter((r) => needsProcessing(c, r, now)).map((r) => ({ id: c.id, slug: r.slug })));
  report.candidates = jobs.length;
  const startIndex = jobs.length ? Math.floor(now.getTime() / 3_600_000) % jobs.length : 0;
  const ordered = [...jobs.slice(startIndex), ...jobs.slice(0, startIndex)].slice(0, options.maxJobs ?? 12);
  for (const job of ordered) {
    if (Date.now() - started > budget) { report.budgetExceeded = true; break; }
    try {
      const result = await processGuideRequest(job.id, job.slug, now);
      report.processed++;
      if (result.delivery === "pending" || result.enrollment === "pending") report.pending++;
    } catch { report.failed++; }
  }
  const rotation = contacts.length ? Math.floor(now.getTime() / 3_600_000) % contacts.length : 0;
  for (const c of [...contacts.slice(rotation), ...contacts.slice(0, rotation)]) {
    if (Date.now() - started > budget) { report.budgetExceeded = true; break; }
    try { if (await refreshGuideSummary(c.id, now)) report.refreshed++; } catch { report.failed++; }
  }
  return report;
}
