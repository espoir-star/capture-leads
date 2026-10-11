/**
 * État de l'envoi du guide pour la page merci. Le contact est identifié par le
 * jeton signé `leadRef` (corps POST, jamais dans l'URL) : le navigateur ne peut
 * interroger que sa propre demande. Réponse limitée à un état, sans donnée
 * personnelle ; toute anomalie donne « unknown ».
 */

import { NextRequest, NextResponse } from "next/server";
import { getContactById } from "@/lib/brevo/api";
import { publicDeliveryState, type PublicDeliveryState } from "@/lib/guides/deliveryState";
import { readBodyLimited } from "@/lib/security/body";
import { verifyLeadRef } from "@/lib/security/leadToken";
import { clientIp, EVENT_LIMITS, isRateLimited } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (state: PublicDeliveryState, status = 200) =>
  NextResponse.json({ state }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (isRateLimited("lead-status", clientIp(req.headers), EVENT_LIMITS)) return reply("unknown", 429);
  const read = await readBodyLimited(req, 2000);
  if (!read.ok) return reply("unknown", 413);
  let leadRef: unknown;
  try {
    leadRef = (JSON.parse(read.text) as { leadRef?: unknown }).leadRef;
  } catch {
    return reply("unknown", 400);
  }
  const ref = verifyLeadRef(leadRef);
  if (!ref) return reply("unknown", 400);
  try {
    const contact = await getContactById(ref.c);
    return reply(contact ? publicDeliveryState(contact, ref.s, new Date()) : "unknown");
  } catch {
    return reply("unknown");
  }
}
