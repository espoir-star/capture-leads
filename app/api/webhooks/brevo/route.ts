/**
 * Webhook Brevo (désactivé tant que BREVO_WEBHOOK_SECRET n'est pas défini : 404).
 *
 *   hard_bounce → EMAIL_STATUS = BOUNCED (exclu newsletter, leads chauds, automations)
 *   autres événements (click, opened…) → journalisés, aucun effet
 *
 * Sécurité : Brevo ne signe pas ses webhooks ; il envoie le jeton configuré
 * (`auth: { type: "bearer", token }`) dans l'en-tête Authorization. Vérifié
 * en temps constant. Payload revalidé champ par champ, taille bornée.
 *
 * Reprises : Brevo ne retente QUE sur 429 ou absence de réponse (tout autre
 * 4xx/5xx abandonne l'événement). Une erreur temporaire répond donc 429 ;
 * le rejeu est sans danger (traitement idempotent).
 */

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getContactByEmail, updateContactAttributes, blocklistMarketingContact } from "@/lib/brevo/server";
import { emailStatusAfterBounce, parseWebhookEvent } from "@/lib/brevo/webhook";
import { logLead, maskEmail } from "@/lib/lead/log";
import { isValidEmailSyntax } from "@/lib/validation/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512_000;

function authorized(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const given = header || req.nextUrl.searchParams.get("token") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(raw: unknown): Promise<string> {
  const evt = parseWebhookEvent(raw);
  if (!isValidEmailSyntax(evt.email)) return "ignored_invalid";
  if (evt.kind === "unsubscribed") {
    const contact = await getContactByEmail(evt.email);
    if (!contact) return "unknown_contact";
    if (contact.attributes.MARKETING_STATUS === "OPPOSED" && contact.emailBlacklisted) return "unchanged";
    await blocklistMarketingContact({ id: contact.id });
    return "marketing_opposed";
  }
  if (evt.kind !== "hard_bounce") return `ignored_${evt.kind}`;

  const contact = await getContactByEmail(evt.email);
  if (!contact) return "unknown_contact";
  const next = emailStatusAfterBounce(String(contact.attributes.EMAIL_STATUS ?? ""));
  if (!next) return "unchanged"; // rejeu : aucune écriture
  await updateContactAttributes({ id: contact.id }, { EMAIL_STATUS: next });
  logLead("succes", { motif: "webhook_hard_bounce", statut: next, valeur: maskEmail(evt.email) });
  return "bounced";
}

export async function POST(req: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET?.trim();
  if (!secret) return new NextResponse(null, { status: 404 });
  if (!authorized(req, secret)) {
    logLead("rejet", { motif: "webhook_non_autorise" });
    return new NextResponse(null, { status: 401 });
  }

  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return NextResponse.json({ ok: false }, { status: 413 });
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const events = (Array.isArray(payload) ? payload : [payload]).slice(0, 500);
  const results: string[] = [];
  for (const evt of events) {
    try {
      results.push(await handle(evt));
    } catch (e) {
      console.error("Webhook Brevo :", e instanceof Error ? e.message : e);
      return NextResponse.json({ ok: false, retry: true }, { status: 429, headers: { "Retry-After": "600" } });
    }
  }
  return NextResponse.json({ ok: true, results });
}
