/** Téléchargement du skill « saisie des pièces comptables » : ZIP au format claude.ai, généré depuis la fiche. */
import { NextResponse } from "next/server";
import { SAISIE_PIECES, skillZip } from "@/content/guides/saisie-pieces-comptables";

export const dynamic = "force-static";

export function GET() {
  const body = skillZip();
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${SAISIE_PIECES.zip.file}"`,
      "Content-Length": String(body.length),
      "X-Robots-Tag": "noindex",
    },
  });
}
