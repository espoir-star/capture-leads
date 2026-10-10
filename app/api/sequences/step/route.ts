/**
 * n8n → Vercel : exécuter une étape de séquence.
 *
 *   POST { enrollmentId, stepId }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Réponses (toujours JSON, avec enrollmentId et stepId en écho pour la boucle n8n) :
 *   200 { action: "wait", stepId, at }  attendre jusqu'à `at`, puis rappeler avec stepId
 *   200 { action: "done", reason }      fin de séquence (terminée, désinscrit, qualifié…)
 *   400 { action: "invalid" }           identifiant non signé / altéré → n8n s'arrête
 *   401                                 secret absent ou faux
 *   502                                 Brevo indisponible → n8n réessaie (sans risque : idempotence)
 *
 * Le secret n'existe pas → 404 : le moteur est désactivé tant qu'il n'est pas configuré.
 */

import { NextRequest, NextResponse } from "next/server";
import { runStep } from "@/lib/sequences/run";
import { bearerMatches } from "@/lib/security/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  let body: { enrollmentId?: unknown; stepId?: unknown };
  try {
    const text = await req.text();
    if (text.length > 2000) return json({ action: "invalid", reason: "size" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ action: "invalid", reason: "json" }, 400);
  }
  const echo = {
    enrollmentId: typeof body.enrollmentId === "string" ? body.enrollmentId.slice(0, 600) : undefined,
    requestedStepId: typeof body.stepId === "string" ? body.stepId.slice(0, 60) : undefined,
  };
  try {
    const res = await runStep(body.enrollmentId, body.stepId);
    console.log(JSON.stringify({ type: "sequence_step", step: echo.requestedStepId, ...res }));
    return json({ ...echo, ...res }, res.action === "invalid" ? 400 : 200);
  } catch (e) {
    console.error(JSON.stringify({ type: "sequence_step", step: echo.requestedStepId, error: String(e).slice(0, 200) }));
    return json({ ...echo, action: "retry", reason: "brevo" }, 502);
  }
}
