/**
 * Agrégats du journal → attributs Brevo + alerte « lead chaud ».
 *
 * Appelé en temps réel (webhook Brevo, capture webinar, présences) et par la
 * passe horaire n8n (« ALTHOCE | Marketing | Recalcul des scores — v1 ») qui
 * repart de l'historique complet : un échec ponctuel est rattrapé à l'heure
 * suivante, sans jamais compter deux fois.
 *
 * Ordre des écritures : score d'abord, puis alerte, puis HOT_ALERT_SENT_AT.
 * Si l'alerte échoue (quota Brevo épuisé…), elle repart à la passe suivante ;
 * la clé d'idempotence Brevo empêche un doublon si seule la date a échoué.
 */

import { createHash } from "node:crypto";
import { brevoRequest, getContactById, type AttributeValue, type BrevoContact } from "@/lib/brevo/api";
import { updateContactAttributes } from "@/lib/brevo/contacts";
import { sendInternalAlert } from "@/lib/brevo/internalAlert";
import { BEHAVIOR_POINTS, type BehaviorCategory } from "@/config/scoring";
import { aggregateLedger, brevoDate, EVENT_KEY_RE, planScoreUpdate, type LedgerRow, type ScorePlan } from "@/lib/scoring/behavior";

export interface ApplyResult {
  contactId: number;
  status: "updated" | "unchanged" | "absent";
  score?: number;
  hotAlert?: "sent" | "failed";
}

export class ScoreWriteError extends Error {
  constructor(readonly contactId: number, readonly httpStatus: number) {
    super(`Écriture du score impossible (contact ${contactId}, HTTP ${httpStatus})`);
  }
}

const LABELS: Record<BehaviorCategory, string> = {
  content_click: "Clic contenu",
  guide_click: "Clic guide",
  offer_click: "Clic offre / prise de RDV",
  webinar_registered: "Inscription webinar",
  webinar_attended: "Participation webinar",
  meeting_booked: "RDV confirmé",
};

async function sendHotAlert(contact: BrevoContact, plan: ScorePlan, rows: readonly LedgerRow[]): Promise<boolean> {
  const a = contact.attributes;
  const who = [a.PRENOM, a.NOM].filter(Boolean).join(" ") || `contact ${contact.id}`;
  const seen = new Set<string>();
  const items = rows
    .filter((r) => Number(r.contact_id) === contact.id && typeof r.event_key === "string" && EVENT_KEY_RE.test(r.event_key))
    .filter((r) => (seen.has(String(r.event_key)) ? false : (seen.add(String(r.event_key)), true)))
    .sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)))
    .slice(0, 10)
    .map((r) => {
      const cat = String(r.category) as BehaviorCategory;
      return `${String(r.occurred_at).slice(0, 10)} — ${LABELS[cat] ?? cat} (+${BEHAVIOR_POINTS[cat] ?? 0})`;
    });
  const field = (label: string, v: unknown) => (v === undefined || v === null || v === "" ? [] : [{ label, value: String(v) }]);
  return sendInternalAlert({
    subject: `[Lead chaud] ${String(who).slice(0, 60)}${a.ENTREPRISE ? ` — ${String(a.ENTREPRISE).slice(0, 60)}` : ""} (score ${plan.score})`,
    title: "Un contact vient de passer le seuil « lead chaud »",
    rows: [
      ...field("Contact", who),
      ...field("Email", contact.email),
      ...field("Entreprise", a.ENTREPRISE),
      ...field("Fonction", a.JOB_TITLE),
      ...field("Téléphone", a.SMS),
      ...field("Ressource d'origine", a.RESSOURCE),
      ...field("Verticale", a.VERTICAL),
      ...field("Statut marketing", a.MARKETING_STATUS),
      { label: "Score", value: `${plan.score} (formulaire ${plan.formScore} + comportement ${plan.behavior}, avant : ${plan.previousScore})` },
    ],
    items: items.length ? items : ["—"],
    link: { url: `https://app.brevo.com/contact/index/${contact.id}`, label: "Ouvrir la fiche dans Brevo" },
    tag: "alerte-lead-chaud",
    idempotencyKey: `hot.${createHash("sha256").update(`hot:${contact.id}`).digest("hex").slice(0, 24)}`,
  });
}

async function write(contactId: number, attributes: Record<string, AttributeValue>) {
  const res = await brevoRequest(`/contacts/${contactId}?identifierType=contact_id`, { method: "PUT", body: { attributes }, retries: 2 });
  if (!res.ok) throw new ScoreWriteError(contactId, res.status);
}

/**
 * Applique les lignes du journal (historique complet de chaque contact).
 * Lève ScoreWriteError si Brevo refuse une écriture (l'appelant réessaie).
 */
export async function applyBehaviorScores(rows: readonly LedgerRow[], now: Date = new Date()): Promise<ApplyResult[]> {
  const out: ApplyResult[] = [];
  for (const agg of aggregateLedger(rows)) {
    const contact = await getContactById(agg.contactId);
    if (!contact) {
      out.push({ contactId: agg.contactId, status: "absent" });
      continue;
    }
    const plan = planScoreUpdate(contact.attributes, agg, now);
    if (Object.keys(plan.attributes).length) await write(contact.id, plan.attributes);
    const result: ApplyResult = {
      contactId: contact.id,
      status: Object.keys(plan.attributes).length ? "updated" : "unchanged",
      score: plan.score,
    };
    if (plan.hotAlert) {
      const sent = await sendHotAlert(contact, plan, rows).catch(() => false);
      result.hotAlert = sent ? "sent" : "failed";
      if (sent) await updateContactAttributes({ id: contact.id }, { HOT_ALERT_SENT_AT: brevoDate(now.toISOString()) });
    }
    out.push(result);
  }
  return out;
}
