/** Téléchargement du skill « revue de dossier » : ZIP au format claude.ai (SKILL.md et le tableau de bord en assets). */
import { NextResponse } from "next/server";
import { REVUE_FEC, skillZip } from "@/content/guides/revue-dossier-fec";

export const dynamic = "force-static";

export function GET() {
  const body = skillZip();
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${REVUE_FEC.zip.file}"`,
      "Content-Length": String(body.length),
      "X-Robots-Tag": "noindex",
    },
  });
}
