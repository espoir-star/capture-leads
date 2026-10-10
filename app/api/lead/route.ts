import { after, NextRequest, NextResponse } from "next/server";
import { captureLead } from "@/lib/lead/capture";
import { logLead } from "@/lib/lead/log";
import { clientIp, DEGRADED_GLOBAL_LIMITS, DEGRADED_IP_LIMITS, isRateLimited, LEAD_LIMITS } from "@/lib/security/rateLimit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { FIELD_MESSAGES, firstInvalidField, leadSchema } from "@/lib/validation/leadSchema";
import { readBodyLimited } from "@/lib/security/body";

// DNS (vérification MX) et crypto : runtime Node.js obligatoire
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16_000;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers);

  /* 1. Anti-abus : débit */
  if (isRateLimited("lead", ip, LEAD_LIMITS)) {
    logLead("rejet", { motif: "rate_limit", ip });
    return json({ message: "Trop de tentatives. Réessayez dans une minute." }, 429);
  }

  let raw: unknown;
  try {
    const read = await readBodyLimited(req, MAX_BODY_BYTES);
    if (!read.ok) return json({ message: "Requête invalide." }, 413);
    const text = read.text;
    raw = JSON.parse(text);
  } catch {
    return json({ message: "Requête invalide." }, 400);
  }

  /* 2. Honeypot : un bot reçoit un succès factice, rien n'est enregistré */
  const honeypot = (raw as { website?: unknown })?.website;
  if (typeof honeypot === "string" && honeypot.length > 0) {
    logLead("rejet", { motif: "honeypot", ip });
    return json({ ok: true });
  }

  /* 3. Schéma : aucune valeur du navigateur n'est prise telle quelle */
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const field = firstInvalidField(parsed.error);
    logLead("rejet", { motif: `schema_${field ?? "inconnu"}`, ip });
    return json(
      { field, message: (field && FIELD_MESSAGES[field]) || "Merci de vérifier le formulaire." },
      400
    );
  }
  const input = parsed.data;

  /* 4. Turnstile (vérifié côté serveur, secret jamais exposé) */
  const turnstile = await verifyTurnstile(input.turnstileToken, ip);
  if (!turnstile.ok) {
    logLead("rejet", { motif: `turnstile_${turnstile.reason}`, slug: input.slug, sessionId: input.sessionId, ip });
    return json(
      { field: "turnstile", message: "La vérification anti-robot a échoué. Réessayez." },
      403
    );
  }

  /* 4b. Mode dégradé : Cloudflare injoignable → petit volume, aucun email automatique */
  const degraded = turnstile.skipped === "unreachable";
  if (degraded) {
    const ipLimited = isRateLimited("lead_degraded", ip, DEGRADED_IP_LIMITS);
    const globalLimited = isRateLimited("lead_degraded", "instance", DEGRADED_GLOBAL_LIMITS);
    if (ipLimited || globalLimited) {
      logLead("rejet", { motif: "turnstile_degrade_plafond", slug: input.slug, sessionId: input.sessionId, ip });
      return json({ message: "La vérification anti-robot est momentanément indisponible. Réessayez dans quelques minutes." }, 503);
    }
  }

  /* 5. Validation qualité + Brevo */
  const outcome = await captureLead(input, { ip, degraded });
  if (!outcome.ok) {
    return json({ field: outcome.field, message: outcome.message }, outcome.status);
  }

  /* 6. Tracking secondaire après la réponse : ne ralentit jamais l'accès au guide */
  if (outcome.followUp) after(outcome.followUp);

  return json({ ok: true, leadRef: outcome.leadRef, ...(outcome.marketingOpposed && { marketing: "opposed" }) });
}
