/**
 * Opposition marketing centralisée (newsletters, relances n8n, suivi commercial).
 *
 *   POST /api/marketing/unsubscribe          { t }  ← bouton de /desinscription
 *   POST /api/marketing/unsubscribe?t=…              ← « Se désabonner » des messageries
 *        (List-Unsubscribe-Post: List-Unsubscribe=One-Click, RFC 8058)
 *
 * Toujours un POST : un GET (aperçu de lien, antivirus, robot) ne fait rien.
 * Effet : MARKETING_STATUS = OPPOSED + emailBlacklisted = true dans Brevo
 * (campagnes exclues d'office, étapes marketing n8n refusées). Les emails
 * transactionnels (guide demandé) restent possibles. Idempotent.
 */
import { NextRequest, NextResponse } from "next/server";
import { blocklistMarketingContact, getContactByEmail } from "@/lib/brevo/server";
import { readMarketingOptoutToken } from "@/lib/marketing/token";
import { clientIp, EVENT_LIMITS, isRateLimited } from "@/lib/security/rateLimit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (isRateLimited("marketing_unsubscribe", clientIp(req.headers), EVENT_LIMITS)) {
    return NextResponse.json({ message: "Veuillez réessayer dans un instant." }, { status: 429 });
  }
  const raw = await req.text();
  if (raw.length > 1600) return NextResponse.json({ message: "Requête invalide." }, { status: 413 });

  let token: unknown = req.nextUrl.searchParams.get("t");
  if (!token) {
    try {
      token = (JSON.parse(raw) as { t?: unknown } | null)?.t;
    } catch {
      return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
    }
  }
  const email = readMarketingOptoutToken(token);
  if (!email) return NextResponse.json({ message: "Lien invalide." }, { status: 400 });
  try {
    const contact = await getContactByEmail(email);
    if (contact && !(contact.emailBlacklisted && contact.attributes.MARKETING_STATUS === "OPPOSED")) {
      await blocklistMarketingContact({ id: contact.id });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Désinscription temporairement indisponible." }, { status: 502 });
  }
}
