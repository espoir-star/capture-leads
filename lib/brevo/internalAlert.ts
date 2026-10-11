/**
 * Alertes internes (équipe uniquement) : erreur n8n, lead chaud, quota Brevo.
 *
 * Passent par le modèle Brevo « INTERNE · Alerte » (emails/interne/alerte.html) :
 * constat réel du 11/10/2026, un email au contenu HTML brut a mis 6 h à être
 * délivré alors qu'un email à modèle part en 1 s. Tant que le modèle n'a pas
 * d'ID (config/emailTemplates.ts), repli sur un contenu HTML échappé.
 */

import { brevoRequest } from "@/lib/brevo/api";
import { isIdempotencyDuplicate } from "@/lib/brevo/transactional";
import { templateId } from "@/config/emailTemplates";
import { REPLY_TO, SENDERS } from "@/config/senders";

export interface InternalAlert {
  subject: string;
  title: string;
  intro?: string;
  rows?: { label: string; value: string }[];
  items?: string[];
  link?: { url: string; label: string };
  tag: string;
  idempotencyKey: string;
}

const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export const escapeHtml = (v: unknown) =>
  clip(v, 1000).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Repli si le modèle n'existe pas encore dans Brevo */
export function fallbackAlertHtml(a: InternalAlert): string {
  const rows = (a.rows ?? []).map((r) => `<p><strong>${escapeHtml(r.label)} :</strong> ${escapeHtml(r.value)}</p>`).join("");
  const items = a.items?.length ? `<ul>${a.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";
  const link = a.link && /^https:\/\//.test(a.link.url) ? `<p><a href="${escapeHtml(a.link.url)}">${escapeHtml(a.link.label)}</a></p>` : "";
  return `<p><strong>${escapeHtml(a.title)}</strong></p>${a.intro ? `<p>${escapeHtml(a.intro)}</p>` : ""}${rows}${items}${link}`;
}

export function alertParams(a: InternalAlert): Record<string, unknown> {
  return {
    SUBJECT: clip(a.subject, 150),
    TITLE: clip(a.title, 200),
    ...(a.intro && { INTRO: clip(a.intro, 1000) }),
    ...(a.rows?.length && { ROWS: a.rows.slice(0, 20).map((r) => ({ LABEL: clip(r.label, 60), VALUE: clip(r.value, 500) })) }),
    ...(a.items?.length && { ITEMS: a.items.slice(0, 15).map((i) => clip(i, 300)) }),
    ...(a.link && /^https:\/\//.test(a.link.url) && { LINK_URL: clip(a.link.url, 500), LINK_LABEL: clip(a.link.label, 80) }),
  };
}

/** true si l'alerte est partie (ou était déjà partie : clé d'idempotence) */
export async function sendInternalAlert(a: InternalAlert): Promise<boolean> {
  const id = templateId("interne.alerte");
  const res = await brevoRequest("/smtp/email", {
    method: "POST",
    body: {
      sender: SENDERS.resources,
      to: [{ email: REPLY_TO }],
      ...(id ? { templateId: id, params: alertParams(a) } : { subject: clip(a.subject, 150), htmlContent: fallbackAlertHtml(a) }),
      tags: [a.tag],
      headers: { idempotencyKey: a.idempotencyKey },
    },
    retries: 1,
  }).catch(() => null);
  return !!res && (res.ok || isIdempotencyDuplicate(res.status, res.message));
}
