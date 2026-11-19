/** Téléchargement du skill « relevé bancaire vers fichier d'import » : ZIP au format claude.ai, généré depuis la fiche. */
import { NextResponse } from "next/server";
import { RELEVE_BANCAIRE, skillZip } from "@/content/guides/releve-bancaire-pdf";

export const dynamic = "force-static";

export function GET() {
  const body = skillZip();
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${RELEVE_BANCAIRE.zip.file}"`,
      "Content-Length": String(body.length),
      "X-Robots-Tag": "noindex",
    },
  });
}
