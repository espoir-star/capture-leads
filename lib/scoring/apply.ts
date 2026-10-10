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
import { isIdempotencyDuplicate } from "@/lib/brevo/transactional";
import { REPLY_TO, SENDERS } from "@/config/senders";
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

const esc = (v: unknown) =>
  String(v ?? "")
    .slice(0, 300)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function hotAlertHtml(contact: BrevoContact, plan: ScorePlan, rows: readonly LedgerRow[]): string {
  const a = contact.attributes;
  const name = [a.PRENOM, a.NOM].filter(Boolean).join(" ") || "(nom non renseigné)";
  const seen = new Set<string>();
  const events = rows
    .filter((r) => Number(r.contact_id) === contact.id && typeof r.event_key === "string" && EVENT_KEY_RE.test(r.event_key))
    .filter((r) => (seen.has(String(r.event_key)) ? false : (seen.add(String(r.event_key)), true)))
    .sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)))
    .slice(0, 10)
    .map((r) => {
      const cat = String(r.category) as BehaviorCategory;
      return `<li>${esc(String(r.occurred_at).slice(0, 10))} — ${esc(LABELS[cat] ?? cat)} (+${BEHAVIOR_POINTS[cat] ?? 0})</li>`;
    })
    .join("");
  const line = (label: string, v: unknown) => (v === undefined || v === "" ? "" : `<p><strong>${label} :</strong> ${esc(v)}</p>`);
  return `<p>Un contact vient de passer le seuil « lead chaud ».</p>
${line("Contact", name)}${line("Email", contact.email)}${line("Entreprise", a.ENTREPRISE)}${line("Fonction", a.JOB_TITLE)}${line("Téléphone", a.SMS)}
${line("Ressource d'origine", a.RESSOURCE)}${line("Verticale", a.VERTICAL)}${line("Statut marketing", a.MARKETING_STATUS)}
<p><strong>Score :</strong> ${plan.score} (formulaire ${plan.formScore} + comportement ${plan.behavior}, avant : ${plan.previousScore})</p>
<p><strong>Derniers signaux :</strong></p><ul>${events || "<li>—</li>"}</ul>
<p><a href="https://app.brevo.com/contact/index/${contact.id}">Ouvrir la fiche dans Brevo</a></p>`;
}

async function sendHotAlert(contact: BrevoContact, plan: ScorePlan, rows: readonly LedgerRow[]): Promise<boolean> {
  const a = contact.attributes;
  const who = [a.PRENOM, a.NOM].filter(Boolean).join(" ") || `contact ${contact.id}`;
  const res = await brevoRequest("/smtp/email", {
    method: "POST",
    body: {
      sender: SENDERS.resources,
      to: [{ email: REPLY_TO }],
      subject: `[Lead chaud] ${String(who).slice(0, 60)}${a.ENTREPRISE ? ` — ${String(a.ENTREPRISE).slice(0, 60)}` : ""} (score ${plan.score})`,
      htmlContent: hotAlertHtml(contact, plan, rows),
      tags: ["alerte-lead-chaud"],
      headers: { idempotencyKey: `hot.${createHash("sha256").update(`hot:${contact.id}`).digest("hex").slice(0, 24)}` },
    },
    retries: 1,
  });
  return res.ok || isIdempotencyDuplicate(res.status, res.message);
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
