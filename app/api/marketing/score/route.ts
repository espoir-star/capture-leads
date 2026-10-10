/**
 * n8n → Vercel : passe horaire de recalcul des scores
 * (workflow « ALTHOCE | Marketing | Recalcul des scores — v1 »).
 *
 *   POST { rows: LedgerRow[] }   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * `rows` = historique complet des contacts actifs, lu dans la Data table.
 * Idempotent : un contact déjà à jour ne provoque aucune écriture. Brevo en
 * erreur → 502 (n8n réessaie ; l'heure suivante rattrape de toute façon).
 */

import { NextRequest, NextResponse } from "next/server";
import { applyBehaviorScores, ScoreWriteError } from "@/lib/scoring/apply";
import type { LedgerRow } from "@/lib/scoring/behavior";
import { bearerMatches } from "@/lib/security/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ROWS = 2000;

export async function POST(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) {
    return new NextResponse(null, { status: 401 });
  }
  let rows: LedgerRow[];
  try {
    const text = await req.text();
    if (text.length > 600_000) return NextResponse.json({ ok: false }, { status: 413 });
    const body = JSON.parse(text) as { rows?: unknown };
    if (!Array.isArray(body.rows) || body.rows.length > MAX_ROWS) return NextResponse.json({ ok: false }, { status: 400 });
    rows = body.rows as LedgerRow[];
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const results = await applyBehaviorScores(rows);
    return NextResponse.json({
      ok: true,
      contacts: results.length,
      updated: results.filter((r) => r.status === "updated").length,
      hotAlerts: results.filter((r) => r.hotAlert === "sent").length,
      hotAlertsFailed: results.filter((r) => r.hotAlert === "failed").length,
    });
  } catch (e) {
    console.error("Recalcul des scores :", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, reason: e instanceof ScoreWriteError ? "brevo_write" : "brevo" }, { status: 502 });
  }
}
