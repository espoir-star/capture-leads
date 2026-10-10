/**
 * n8n → Vercel : alerte d'erreur d'un workflow Althoce (workflow n8n
 * « ALTHOCE | Marketing | Alertes n8n — v1 », déclenché par l'Error Trigger).
 *
 *   POST { workflow, executionId, node, message, url? }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Envoie un email à REPLY_TO via Brevo (la clé Brevo reste sur Vercel, jamais
 * dans n8n). Limité à 10 alertes par heure et par instance ; une même
 * exécution n'alerte qu'une fois (clé d'idempotence Brevo).
 */

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { brevoRequest } from "@/lib/brevo/api";
import { isIdempotencyDuplicate } from "@/lib/brevo/transactional";
import { REPLY_TO, SENDERS } from "@/config/senders";
import { bearerMatches } from "@/lib/security/bearer";
import { isRateLimited } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALERT_LIMITS = [{ ms: 3_600_000, max: 10 }];

const esc = (v: unknown) =>
  String(v ?? "")
    .slice(0, 1000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  if (isRateLimited("sequence_alert", "n8n", ALERT_LIMITS)) return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  let b: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 6000) return NextResponse.json({ ok: false }, { status: 413 });
    b = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const url = typeof b.url === "string" && /^https:\/\//.test(b.url) ? b.url : "";
  const res = await brevoRequest("/smtp/email", {
    method: "POST",
    body: {
      sender: SENDERS.resources,
      to: [{ email: REPLY_TO }],
      subject: `[Alerte n8n] ${String(b.workflow ?? "workflow").slice(0, 80)}`,
      htmlContent: `<p><strong>Workflow :</strong> ${esc(b.workflow)}</p>
<p><strong>Nœud :</strong> ${esc(b.node)}</p>
<p><strong>Message :</strong> ${esc(b.message)}</p>
<p><strong>Exécution :</strong> ${esc(b.executionId)}${url ? ` — <a href="${esc(url)}">ouvrir dans n8n</a>` : ""}</p>`,
      tags: ["alerte-sequences"],
      headers: { idempotencyKey: `alert.${createHash("sha256").update(String(b.executionId ?? Date.now())).digest("hex").slice(0, 24)}` },
    },
    retries: 1,
  });
  if (res.ok || isIdempotencyDuplicate(res.status, res.message)) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false }, { status: 502 });
}
