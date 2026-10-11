/**
 * État PUR par contact × guide. Deux guides n'écrivent jamais le même champ
 * technique. Une nouvelle demande d'un même guide actualise la provenance ;
 * elle ne recrée pas un nouveau guide distinct ni une nouvelle relance complète.
 * Les événements de capture restent l'historique des demandes ; ces champs
 * constituent une projection dernière demande + une tâche de livraison.
 */
import { createHash } from "node:crypto";
import { LEAD_MAGNETS, getLeadMagnet } from "@/config/leadMagnets";
import { getSequence } from "@/config/sequences";
import { GUIDE_RECENCY_DAYS, GUIDE_FOLLOWUP_INTERVAL_HOURS, MULTI_GUIDE_LAST_FOLLOWUP, guideStateFields } from "@/config/multiGuides";
import type { AttributeValue } from "@/lib/brevo/api";
import { summarizeGuideInterests, type GuideInterestContact } from "@/lib/guides/interests";
import { deliverySendKey } from "@/lib/sequences/enrollment";
import type { Touch } from "@/lib/tracking/utm";

export interface GuideRequest {
  v: 1;
  slug: string;
  sequenceId: string;
  requestedAt: string;
  /** Première observation par ce nouveau suivi, PAS une date historique inventée. */
  firstTrackedAt: string;
  /** false = ancienne automation : tracer la demande, mais ne pas doubler sa livraison. */
  queued: boolean;
  /** Date stable de la seule inscription en relance prévue pour ce guide. */
  followupAt?: string;
  scale?: number;
  source: Record<string, string>;
}
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const validIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function parseGuideRequest(value: unknown, expectedSlug: string): GuideRequest | null {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const r = JSON.parse(value) as GuideRequest;
    const lm = getLeadMagnet(expectedSlug);
    if (!r || r.v !== 1 || !lm || r.slug !== expectedSlug || typeof r.queued !== "boolean") return null;
    if (r.sequenceId !== lm.sequence && r.sequenceId !== "guide-generique-v1") return null;
    if (!getSequence(r.sequenceId) || !validIso(r.requestedAt) || !validIso(r.firstTrackedAt)) return null;
    if (Date.parse(r.firstTrackedAt) > Date.parse(r.requestedAt)) return null;
    if (r.followupAt !== undefined && (!validIso(r.followupAt) || Date.parse(r.followupAt) > Date.parse(r.requestedAt))) return null;
    if (r.scale !== undefined && (!Number.isFinite(r.scale) || r.scale < 1 || r.scale > 1440)) return null;
    if (!r.source || typeof r.source !== "object" || Array.isArray(r.source)) return null;
    if (Object.entries(r.source).some(([k, v]) => !SOURCE_KEYS.includes(k as typeof SOURCE_KEYS[number]) || typeof v !== "string" || v.length > 200)) return null;
    return r;
  } catch { return null; }
}

export function knownGuideRequests(contact: GuideInterestContact): GuideRequest[] {
  return Object.values(LEAD_MAGNETS).flatMap((lm) => {
    const r = parseGuideRequest(contact.attributes[guideStateFields(lm.slug).request], lm.slug);
    return r ? [r] : [];
  });
}

/** Cette écriture est ajoutée à l'upsert du contact AVANT de répondre au formulaire. */
export function buildGuideRequest(
  existing: GuideInterestContact | null,
  input: { slug: string; now: Date; queued: boolean; enroll: boolean; timeScale?: number; touch?: Touch }
): { record: GuideRequest; attributes: Record<string, AttributeValue> } {
  const lm = getLeadMagnet(input.slug);
  if (!lm || !Number.isFinite(input.now.getTime())) throw new Error("Demande guide invalide");
  const fields = guideStateFields(input.slug);
  const old = parseGuideRequest(existing?.attributes[fields.request], input.slug);
  const now = input.now.toISOString();
  const source: Record<string, string> = {};
  for (const k of SOURCE_KEYS) {
    const value = input.touch?.[k];
    if (typeof value === "string" && value.trim()) source[k] = value.trim().slice(0, 200);
  }
  // Un rejeu plus ancien ne doit pas remplacer une demande plus récente déjà connue.
  if (old && old.requestedAt > now) return { record: old, attributes: {} };
  const followupAt = old?.followupAt ?? (input.queued && input.enroll ? now : undefined);
  const scale = old?.followupAt ? old.scale : input.timeScale;
  const record: GuideRequest = {
    v: 1, slug: lm.slug, sequenceId: lm.sequence, requestedAt: now,
    firstTrackedAt: old?.firstTrackedAt ?? now, queued: input.queued,
    ...(followupAt && { followupAt }),
    ...(typeof scale === "number" && scale > 1 && scale <= 1440 && { scale }),
    source,
  };
  return { record, attributes: { [fields.request]: JSON.stringify(record) } };
}

export const guideDeliveryKey = (contactId: number, r: GuideRequest) => deliverySendKey(r.sequenceId, contactId, new Date(r.requestedAt));
export function guideEnrollmentKey(contactId: number, r: GuideRequest): string | null {
  if (!r.followupAt) return null;
  return createHash("sha256").update(["guide-enrollment", contactId, r.slug, r.sequenceId, r.followupAt].join("|")).digest("hex").slice(0, 32);
}

/** Projection CRM recalculée après relecture, jamais compteur += 1. */
export function guideSummaryAttributes(contact: GuideInterestContact, now = new Date()): Record<string, AttributeValue> {
  const requests = knownGuideRequests(contact);
  const observedLists = requests.map((r) => getLeadMagnet(r.slug)!.brevoListId);
  const known = summarizeGuideInterests({ listIds: [...(contact.listIds ?? []), ...observedLists], attributes: contact.attributes });
  const recent = requests.filter((r) => Date.parse(r.requestedAt) >= now.getTime() - GUIDE_RECENCY_DAYS * DAY && Date.parse(r.requestedAt) <= now.getTime());
  const last = requests.map((r) => r.requestedAt).filter((s) => Date.parse(s) <= now.getTime()).sort().at(-1);
  return {
    GUIDES_COUNT: known.distinctCount,
    GUIDES_NAMES: known.guides.map((g) => g.title).join(" ; ").slice(0, 9000),
    GUIDES_THEMES: known.sectors.join(" · "),
    GUIDES_RECENT_30D: recent.length,
    GUIDE_INTEREST_LEVEL: recent.length >= 2 ? "MULTI_RECENT" : known.distinctCount >= 2 ? "MULTI_KNOWN" : "SINGLE",
    ...(last && { LAST_GUIDE_REQUEST_AT: last.slice(0, 10) }),
  };
}

export type GuideFollowupDecision = { action: "send" } | { action: "stop"; reason: string } | { action: "wait"; at: string };
/**
 * Parmi les nouvelles séquences rapprochées, seule la plus récente reste
 * candidate. Re-télécharger le même guide ne recommence pas son J+2.
 * Le cooldown ne concerne jamais la livraison des ressources demandées.
 */
export function guideFollowupDecision(
  contact: GuideInterestContact,
  enrollment: { r?: string; t: number; s: string; k?: number },
  now: Date
): GuideFollowupDecision {
  const requests = knownGuideRequests(contact).filter((r) => r.queued && r.followupAt);
  const current = requests.find((r) => r.slug === enrollment.r && r.sequenceId === enrollment.s);
  if (!current) return { action: "send" }; // ancienne inscription : comportement inchangé
  if (Date.parse(current.followupAt!) !== enrollment.t) return { action: "stop", reason: "guide_enrollment_superseded" };
  const latest = [...requests].sort((a, b) => b.followupAt!.localeCompare(a.followupAt!) || b.slug.localeCompare(a.slug))[0];
  if (latest && latest.slug !== current.slug && Date.parse(latest.followupAt!) >= enrollment.t) {
    return { action: "stop", reason: "multi_guide_consolidated" };
  }
  const last = Date.parse(String(contact.attributes[MULTI_GUIDE_LAST_FOLLOWUP] ?? ""));
  const scale = enrollment.k ?? 1;
  const earliest = last + GUIDE_FOLLOWUP_INTERVAL_HOURS * HOUR / scale;
  if (Number.isFinite(last) && earliest > now.getTime()) return { action: "wait", at: new Date(earliest).toISOString() };
  return { action: "send" };
}
