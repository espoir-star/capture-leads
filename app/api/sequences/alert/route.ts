/**
 * n8n → Vercel : alerte d'erreur d'un workflow Althoce (workflow n8n
 * « ALTHOCE | Marketing | Alertes n8n — v1 », déclenché par l'Error Trigger).
 *
 *   POST { workflow, executionId, node, message, url? }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Envoie un email à REPLY_TO via le modèle Brevo « INTERNE · Alerte » (la clé
 * Brevo reste sur Vercel, jamais dans n8n). Limité à 10 alertes par heure et par instance ; une même
 * exécution n'alerte qu'une fois (clé d'idempotence Brevo).
 */

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendInternalAlert } from "@/lib/brevo/internalAlert";
import { bearerMatches } from "@/lib/security/bearer";
import { isRateLimited } from "@/lib/security/rateLimit";
import { readBodyLimited } from "@/lib/security/body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALERT_LIMITS = [{ ms: 3_600_000, max: 10 }];

export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  if (isRateLimited("sequence_alert", "n8n", ALERT_LIMITS)) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  let b: Record<string, unknown>;
  try {
    const read = await readBodyLimited(req, 6000);
    if (!read.ok) return NextResponse.json({ ok: false }, { status: 413 });
    const text = read.text;
    b = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const url = typeof b.url === "string" && /^https:\/\//.test(b.url) ? b.url : "";
  const workflow = String(b.workflow ?? "workflow").slice(0, 80);
  const sent = await sendInternalAlert({
    subject: `[Alerte n8n] ${workflow}`,
    title: "Un workflow n8n Althoce a échoué",
    rows: [
      { label: "Workflow", value: workflow },
      { label: "Nœud", value: String(b.node ?? "") },
      { label: "Message", value: String(b.message ?? "") },
      { label: "Exécution", value: String(b.executionId ?? "") },
    ],
    ...(url && { link: { url, label: "Ouvrir l'exécution dans n8n" } }),
    tag: "alerte-sequences",
    idempotencyKey: `alert.${createHash("sha256").update(String(b.executionId ?? Date.now())).digest("hex").slice(0, 24)}`,
  });
  if (sent) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 502 });
}
