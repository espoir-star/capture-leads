/**
 * Événements déclenchés par le navigateur (ex. clic « Lire le guide » sur la
 * page merci). Le contact est identifié par le jeton signé `leadRef` renvoyé
 * par /api/lead : le navigateur ne peut ni choisir le contact ni inventer un
 * événement hors liste blanche. Toujours 204 : le tracking ne gêne jamais l'UX.
 */

import { after, NextRequest } from "next/server";
import { getLeadMagnet } from "@/config/leadMagnets";
import { BREVO_EVENTS, CLIENT_EVENTS, sendBrevoEvent } from "@/lib/brevo/server";
import { verifyLeadRef } from "@/lib/security/leadToken";
import { clientIp, EVENT_LIMITS, isRateLimited } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noContent = () => new Response(null, { status: 204 });

export async function POST(req: NextRequest) {
  if (isRateLimited("events", clientIp(req.headers), EVENT_LIMITS)) return noContent();

  let body: { name?: unknown; leadRef?: unknown };
  try {
    // sendBeacon envoie du text/plain : on lit le texte brut
    const text = await req.text();
    if (text.length > 2000) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  if (typeof body.name !== "string" || !CLIENT_EVENTS.has(body.name)) return noContent();
  const ref = verifyLeadRef(body.leadRef);
  if (!ref) return noContent();
  const source = getLeadMagnet(ref.s);
  if (!source) return noContent();

  if (body.name === BREVO_EVENTS.LEAD_MAGNET_DOWNLOADED) {
    after(() =>
      sendBrevoEvent(BREVO_EVENTS.LEAD_MAGNET_DOWNLOADED, { contact_id: ref.c }, {
        resource: source.resource,
        vertical: source.vertical,
        subsector: source.subsector,
      })
    );
  }
  return noContent();
}
