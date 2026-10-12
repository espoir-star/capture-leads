/**
 * Scoring comportemental — logique PURE (tests/behavior-scoring.test.ts).
 *
 * Chaîne : événement Brevo / Vercel → LedgerEvent (clé unique, points du
 * barème) → journal n8n (Data table, durable) → agrégat par contact →
 * attributs Brevo (planScoreUpdate).
 *
 * Fiabilité :
 *   - la clé d'un événement est déterministe (même clic reçu deux fois =
 *     même clé) ; l'agrégat ignore les doublons de clé, donc un rejeu ou une
 *     double insertion ne compte jamais deux fois ;
 *   - le calcul repart toujours de l'historique complet du contact : il est
 *     idempotent et converge, quel que soit l'ordre d'arrivée ;
 *   - aucune baisse : BEHAVIOR_SCORE et LEAD_SCORE ne font que monter ou
 *     rester. Aucune donnée personnelle dans le journal (ID contact + clé opaque).
 */

import { createHash, createHmac } from "node:crypto";
import type { AttributeValue } from "@/lib/brevo/api";
import { isEmptyValue } from "@/lib/brevo/api";
import {
  BEHAVIOR_POINTS,
  BOT_CLICK_SECONDS,
  CLICK_CATEGORIES,
  GUIDE_URL_PATTERNS,
  HOT_LEAD_THRESHOLD,
  IGNORED_URL_PATTERNS,
  INTERNAL_EMAIL_TAGS,
  OFFER_URL_PREFIXES,
  SCORE_CAP,
  type BehaviorCategory,
} from "@/config/scoring";
import type { EmailStatus } from "@/config/taxonomy";
import { isEmailMarketable, MAX_FORM_SCORE, nextLifecycleStage, toScore } from "@/lib/scoring";
import { HOT_ALERT_ALLOWED } from "@/config/commercialStates";
import { readCommercialState } from "@/lib/sequences/commercial";
import { deriveKey } from "@/lib/security/secret";

export type LedgerSource = "brevo_transactional" | "brevo_marketing" | "capture" | "webinar" | "crm";

/** Une ligne du journal n8n (noms de colonnes de la Data table) */
export interface LedgerEvent {
  event_key: string;
  contact_id: number;
  category: BehaviorCategory;
  points: number;
  /** ISO 8601 */
  occurred_at: string;
  source: LedgerSource;
  /** Référence non personnelle : campagne, modèle, webinar… */
  ref: string;
}

/* ── Clés ─────────────────────────────────────────────────────────────── */

const KEY_PREFIX: Record<BehaviorCategory, string> = {
  content_click: "clk",
  guide_click: "clk",
  offer_click: "clk",
  webinar_registered: "wreg",
  webinar_attended: "watt",
  meeting_booked: "rdv",
};

/** Clé opaque et déterministe (HMAC) : ni email ni lien en clair dans n8n */
export function eventKey(category: BehaviorCategory, parts: readonly (string | number)[]): string {
  const material = [category, ...parts].join("|");
  const key = deriveKey("scoring-event:v1");
  const digest = key
    ? createHmac("sha256", key).update(material).digest("base64url")
    : createHash("sha256").update(`althoce:${material}`).digest("base64url");
  return `${KEY_PREFIX[category]}.${digest.slice(0, 32)}`;
}

export const EVENT_KEY_RE = /^(clk|wreg|watt|rdv)\.[A-Za-z0-9_-]{32}$/;

/* ── Webhooks Brevo → événement de scoring ────────────────────────────── */

/** Catégorie d'un clic, ou null si le lien ne compte pas */
export function classifyClick(url: string | undefined): BehaviorCategory | null {
  const u = String(url ?? "").trim();
  if (!u) return null;
  if (IGNORED_URL_PATTERNS.some((re) => re.test(u))) return null;
  if (OFFER_URL_PREFIXES.some((p) => u.toLowerCase().startsWith(p.toLowerCase()))) return "offer_click";
  if (GUIDE_URL_PATTERNS.some((re) => re.test(u))) return "guide_click";
  if (!/^https?:\/\//i.test(u)) return null;
  return "content_click";
}

export interface ClickCandidate {
  email: string;
  category: BehaviorCategory;
  /** parties de la clé (sans contact_id, résolu ensuite) */
  keyParts: string[];
  occurred_at: string;
  source: LedgerSource;
  ref: string;
  /** email transactionnel : identifiant Brevo (heure d'envoi retrouvée au journal) */
  messageId?: string;
  /** heure d'envoi si connue (campagnes : ts_sent) */
  sentAt?: string;
  timeProven?: boolean;
}

/** Clic trop proche de l'envoi pour être humain (BOT_CLICK_SECONDS). Heure d'envoi inconnue → compté. */
export function isLikelyBotClick(c: Pick<ClickCandidate, "occurred_at" | "sentAt">): boolean {
  if (!c.sentAt) return false;
  const delta = Date.parse(c.occurred_at) - Date.parse(c.sentAt);
  return Number.isFinite(delta) && delta >= 0 && delta < BOT_CLICK_SECONDS * 1000;
}

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function tagsOf(o: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === "string") {
      const t = v.trim();
      if (t.startsWith("[")) {
        try {
          add(JSON.parse(t));
        } catch {
          out.push(t);
        }
      } else if (t) out.push(t);
    }
  };
  add(o.tags);
  add(o.tag);
  return out;
}

function eventDate(o: Record<string, unknown>, now: Date): string {
  for (const k of ["ts_event", "ts_epoch", "ts"]) {
    const n = Number(o[k]);
    if (Number.isFinite(n) && n > 0) return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  return now.toISOString();
}

/**
 * Clic Brevo (transactionnel ou campagne) → candidat de scoring, ou null.
 * Un même email ne compte qu'une fois par catégorie (plusieurs clics sur le
 * même lien, ou sur deux articles du même email = un seul « clic contenu »).
 */
export function clickCandidate(raw: unknown, now: Date): ClickCandidate | null {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  if (o.event !== "click") return null;
  const email = str(o.email).trim().toLowerCase();
  if (!email) return null;
  if (tagsOf(o).some((t) => INTERNAL_EMAIL_TAGS.includes(t))) return null;
  const category = classifyClick(str(o.URL) || str(o.link));
  if (!category) return null;
  const occurred_at = eventDate(o, now);
  const timeProven = ["ts_event", "ts_epoch", "ts"].some((k) => Number.isFinite(Number(o[k])) && Number(o[k]) > 0);

  const campId = str(o.camp_id);
  if (campId) {
    const sent = Number(o.ts_sent);
    return {
      email, category, keyParts: ["m", campId, email], occurred_at, timeProven, source: "brevo_marketing", ref: `campagne:${campId}`,
      ...(Number.isFinite(sent) && sent > 0 && { sentAt: new Date(sent * 1000).toISOString() }),
    };
  }
  const messageId = str(o["message-id"]) || str(o.messageId);
  if (messageId) {
    const tpl = str(o.template_id) || str(o.templateId);
    return { email, category, keyParts: ["t", messageId], occurred_at, timeProven, source: "brevo_transactional", ref: tpl ? `modele:${tpl}` : "transactionnel", messageId };
  }
  return null;
}

export function toLedgerEvent(c: ClickCandidate, contactId: number): LedgerEvent {
  return {
    event_key: eventKey(c.category, c.keyParts),
    contact_id: contactId,
    category: c.category,
    points: BEHAVIOR_POINTS[c.category],
    occurred_at: c.occurred_at,
    source: c.source,
    ref: c.timeProven && c.sentAt && Date.parse(c.occurred_at) - Date.parse(c.sentAt) >= BOT_CLICK_SECONDS * 1000 ? `human-validated:${c.ref}` : c.ref,
  };
}

/** Événement non lié à un email (inscription / présence webinar, RDV) */
export function makeEvent(
  category: Exclude<BehaviorCategory, "content_click" | "guide_click" | "offer_click">,
  contactId: number,
  ref: string,
  source: LedgerSource,
  occurredAt: Date
): LedgerEvent {
  return {
    event_key: eventKey(category, [contactId, ref]),
    contact_id: contactId,
    category,
    points: BEHAVIOR_POINTS[category],
    occurred_at: occurredAt.toISOString(),
    source,
    ref,
  };
}

/** RDV confirmé d'après les attributs commerciaux (MEETING_CONFIRMED) */
export function hasConfirmedMeeting(attributes: Record<string, AttributeValue | undefined>): boolean {
  return readCommercialState(attributes).state === "MEETING_CONFIRMED";
}

/* ── Journal → agrégat ────────────────────────────────────────────────── */

export interface LedgerRow {
  event_key: unknown;
  contact_id: unknown;
  category: unknown;
  points: unknown;
  occurred_at: unknown;
  ref?: unknown;
}

export interface BehaviorAggregate {
  contactId: number;
  behavior: number;
  events: number;
  lastClickAt?: string;
  lastEngagementAt?: string;
  lastQualifyingAt?: string;
  lastQualifyingType?: string;
}

const isoOf = (v: unknown): string | undefined => {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
};

/** Lignes du journal (éventuellement en double) → un agrégat par contact. Doublons de clé ignorés. */
export function aggregateLedger(rows: readonly LedgerRow[]): BehaviorAggregate[] {
  const seen = new Set<string>();
  const by = new Map<number, BehaviorAggregate>();
  for (const r of rows) {
    const key = typeof r.event_key === "string" ? r.event_key : "";
    const contactId = Number(r.contact_id);
    const category = String(r.category) as BehaviorCategory;
    if (!EVENT_KEY_RE.test(key) || !Number.isInteger(contactId) || contactId <= 0) continue;
    if (!(category in BEHAVIOR_POINTS)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const points = Math.max(0, Math.min(BEHAVIOR_POINTS[category], toScore(r.points)));
    const at = isoOf(r.occurred_at);
    const agg = by.get(contactId) ?? { contactId, behavior: 0, events: 0 };
    agg.behavior += points;
    agg.events += 1;
    if (at && (!agg.lastEngagementAt || at > agg.lastEngagementAt)) agg.lastEngagementAt = at;
    if (at && CLICK_CATEGORIES.has(category) && (!agg.lastClickAt || at > agg.lastClickAt)) agg.lastClickAt = at;
    // Only validated ledger events qualify. CRM writes and opens are never ledger events.
    const qualifying = !CLICK_CATEGORIES.has(category) || String(r.ref ?? "").startsWith("human-validated:");
    if (qualifying && at && points > 0 && (!agg.lastQualifyingAt || at > agg.lastQualifyingAt)) {
      agg.lastQualifyingAt = at;
      agg.lastQualifyingType = ({ content_click: "HUMAN_CONTENT_CLICK", guide_click: "HUMAN_GUIDE_CLICK",
        offer_click: "HUMAN_OFFER_CLICK", webinar_registered: "WEBINAR_REGISTERED",
        webinar_attended: "WEBINAR_ATTENDED", meeting_booked: "MEETING_CONFIRMED" })[category];
    }
    by.set(contactId, agg);
  }
  return [...by.values()];
}

/* ── Agrégat → attributs Brevo ────────────────────────────────────────── */

export interface ScorePlan {
  attributes: Record<string, AttributeValue>;
  previousScore: number;
  score: number;
  formScore: number;
  behavior: number;
  /** Alerte « lead chaud » à envoyer (jamais deux fois : HOT_ALERT_SENT_AT) */
  hotAlert: boolean;
}

const PRE_SALES_STAGES = ["", "SUBSCRIBER", "LEAD", "MQL", "HOT_LEAD"];

/** Date Brevo (attribut de type date) : AAAA-MM-JJ */
export const brevoDate = (iso: string) => iso.slice(0, 10);

/**
 * Nouveaux attributs d'un contact.
 *   score formulaire = FORM_SCORE, ou pour un contact antérieur au scoring
 *                      comportemental min(LEAD_SCORE, 15) (son score venait du formulaire)
 *   LEAD_SCORE       = max(LEAD_SCORE, min(100, formulaire + comportement))
 */
export function planScoreUpdate(
  attributes: Record<string, AttributeValue | undefined>,
  agg: Pick<BehaviorAggregate, "behavior" | "lastClickAt" | "lastEngagementAt" | "lastQualifyingAt" | "lastQualifyingType">,
  now: Date
): ScorePlan {
  const a: Record<string, AttributeValue> = {};
  const previousScore = toScore(attributes.LEAD_SCORE);
  const previousBehavior = toScore(attributes.BEHAVIOR_SCORE);
  const formKnown = !isEmptyValue(attributes.FORM_SCORE);
  const formScore = formKnown ? toScore(attributes.FORM_SCORE) : Math.min(previousScore, MAX_FORM_SCORE);
  const behavior = Math.max(previousBehavior, agg.behavior);
  const score = Math.max(previousScore, Math.min(SCORE_CAP, formScore + behavior));

  if (!formKnown) a.FORM_SCORE = formScore;
  if (behavior !== previousBehavior || isEmptyValue(attributes.BEHAVIOR_SCORE)) a.BEHAVIOR_SCORE = behavior;
  if (score !== previousScore) {
    a.LEAD_SCORE = score;
    a.SCORE_UPDATED_AT = brevoDate(now.toISOString());
  }
  const later = (attr: string, iso: string | undefined) => {
    if (!iso) return;
    const d = brevoDate(iso);
    if (d > String(attributes[attr] ?? "")) a[attr] = d;
  };
  later("LAST_EMAIL_CLICK_AT", agg.lastClickAt);
  later("LAST_ENGAGEMENT_AT", agg.lastEngagementAt);
  const previousQualifying = Date.parse(String(attributes.LAST_QUALIFYING_ACTIVITY_AT ?? ""));
  const latestQualifying = Date.parse(agg.lastQualifyingAt ?? "");
  if (agg.lastQualifyingType && Number.isFinite(latestQualifying) && latestQualifying <= now.getTime() &&
      (!Number.isFinite(previousQualifying) || latestQualifying > previousQualifying)) {
    a.LAST_QUALIFYING_ACTIVITY_AT = new Date(latestQualifying).toISOString();
    a.LAST_QUALIFYING_ACTIVITY_TYPE = agg.lastQualifyingType;
  }

  // Seule promotion possible : HOT_LEAD (jamais de rétrogradation, étapes commerciales intouchées)
  const emailStatus = String(attributes.EMAIL_STATUS ?? "");
  const current = isEmptyValue(attributes.LIFECYCLE_STAGE) ? undefined : String(attributes.LIFECYCLE_STAGE);
  if (current !== "HOT_LEAD" && nextLifecycleStage(current, { score, emailStatus: emailStatus as EmailStatus }) === "HOT_LEAD") {
    a.LIFECYCLE_STAGE = "HOT_LEAD";
  }

  // Alerte = « à appeler » : seulement avant toute prise en charge commerciale (CONTACTED et au-delà exclus)
  const hotAlert =
    score >= HOT_LEAD_THRESHOLD &&
    isEmptyValue(attributes.HOT_ALERT_SENT_AT) &&
    PRE_SALES_STAGES.includes(current ?? "") &&
    isEmailMarketable(emailStatus) &&
    HOT_ALERT_ALLOWED.has(readCommercialState(attributes).state);

  return { attributes: a, previousScore, score, formScore, behavior, hotAlert };
}
