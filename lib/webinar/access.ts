/**
 * Webinars : liens personnels de connexion et de replay, fenêtre d'accès, agenda.
 *
 * Chaque inscrit reçoit /w/<slug>/rejoindre?t=… : le jeton (AES-256-GCM, chiffré,
 * infalsifiable) porte l'identifiant du contact, le webinar et l'usage. Le clic
 * pendant la fenêtre du live est noté « lien de connexion ouvert » (signal, pas
 * une présence : aucun point de score), puis redirige vers la salle Google Meet,
 * lue côté serveur (lib/webinar/urls.ts). Aucune donnée personnelle lisible dans
 * l'URL, et le lien Meet n'est jamais publié.
 *
 * Fenêtre : 15 min avant le début → fin + 30 min. Un antivirus de messagerie
 * qui ouvre le lien à la livraison (J-1, H-1) tombe hors fenêtre : rien n'est noté.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { deriveKey } from "@/lib/security/secret";
import type { WebinarConfig } from "@/config/webinars";
import { webinarReplayUrl } from "@/lib/webinar/urls";

export type WebinarLinkPurpose = "join" | "replay";

const PREFIX = "w1.";
const OPEN_BEFORE_MS = 15 * 60_000;
const CLOSE_AFTER_MS = 30 * 60_000;

export function createWebinarToken(contactId: number, slug: string, purpose: WebinarLinkPurpose): string | undefined {
  const key = deriveKey("webinar-link:v1");
  if (!key || !Number.isSafeInteger(contactId) || contactId <= 0) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const payload = JSON.stringify({ c: contactId, s: slug, p: purpose });
  const ct = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, ct, cipher.getAuthTag()]).toString("base64url");
}

/** Identifiant du contact si le jeton est valide pour CE webinar et CET usage, sinon null. */
export function readWebinarToken(token: unknown, slug: string, purpose: WebinarLinkPurpose): number | null {
  const key = deriveKey("webinar-link:v1");
  if (!key || typeof token !== "string" || !token.startsWith(PREFIX) || token.length > 600) return null;
  try {
    const raw = Buffer.from(token.slice(PREFIX.length), "base64url");
    if (raw.length < 12 + 16 + 3) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(raw.length - 16));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8"));
    return data?.s === slug && data?.p === purpose && Number.isSafeInteger(data?.c) && data.c > 0 ? data.c : null;
  } catch {
    return null;
  }
}

/** Liens personnels à insérer dans les emails (absents si le secret manque). */
export function personalWebinarLinks(w: WebinarConfig, contactId: number, base: string): { JOIN_URL?: string; REPLAY_URL?: string } {
  const join = createWebinarToken(contactId, w.slug, "join");
  const replay = webinarReplayUrl(w.slug) ? createWebinarToken(contactId, w.slug, "replay") : undefined;
  return {
    ...(join && { JOIN_URL: `${base}/w/${w.slug}/rejoindre?t=${join}` }),
    ...(replay && { REPLAY_URL: `${base}/w/${w.slug}/replay?t=${replay}` }),
  };
}

/** Inscriptions acceptées jusqu'à la fin du direct (une inscription pendant le live reste utile). */
export function registrationOpen(w: Pick<WebinarConfig, "startsAt" | "durationMin">, now: Date): boolean {
  return now.getTime() < Date.parse(w.startsAt) + w.durationMin * 60_000;
}

export type JoinState = "too_early" | "open" | "ended";

export function joinState(w: Pick<WebinarConfig, "startsAt" | "durationMin">, now: Date): JoinState {
  const start = Date.parse(w.startsAt);
  const end = start + w.durationMin * 60_000;
  const t = now.getTime();
  if (t < start - OPEN_BEFORE_MS) return "too_early";
  if (t > end + CLOSE_AFTER_MS) return "ended";
  return "open";
}

/* ── Agenda ──────────────────────────────────────────────────────────── */

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function eventBounds(w: Pick<WebinarConfig, "startsAt" | "durationMin">) {
  const start = Date.parse(w.startsAt);
  return { start, end: start + w.durationMin * 60_000 };
}

function calendarDetails(w: WebinarConfig, base: string): string {
  return `${w.description}\n\nVotre lien de connexion personnel est dans l'email de confirmation d'Althoce.\nPage du webinar : ${base}/w/${w.slug}`;
}

/** Lien « Ajouter à Google Agenda » (aucun lien de connexion : il reste personnel). */
export function googleCalendarUrl(w: WebinarConfig, base: string): string {
  const { start, end } = eventBounds(w);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${w.title} — Webinar Althoce`,
    dates: `${utc(start)}/${utc(end)}`,
    details: calendarDetails(w, base),
    location: "En ligne (Google Meet)",
    ctz: "Europe/Paris",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Repli à 75 octets (RFC 5545 § 3.1), sans couper un caractère UTF-8. */
function fold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch) > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** Fichier .ics (Outlook, Apple, Google) ; aucun lien de connexion personnel dedans. */
export function webinarIcs(w: WebinarConfig, base: string, now: Date = new Date()): string {
  const { start, end } = eventBounds(w);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Althoce//Webinars//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:webinar-${w.slug}@althoce.fr`,
    `DTSTAMP:${utc(now.getTime())}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${icsText(`${w.title} — Webinar Althoce`)}`,
    `DESCRIPTION:${icsText(calendarDetails(w, base))}`,
    "LOCATION:En ligne (Google Meet)",
    `URL:${base}/w/${w.slug}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(w.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
