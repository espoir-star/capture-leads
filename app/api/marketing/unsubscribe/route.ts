/** Opposition marketing, confirmée par POST (pas les prévisualisations de liens). */
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
  let payload: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 1600) return NextResponse.json({ message: "Requête invalide." }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Requête invalide." }, { status: 400 });
  }
  const email = readMarketingOptoutToken((payload as { t?: unknown } | null)?.t);
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
