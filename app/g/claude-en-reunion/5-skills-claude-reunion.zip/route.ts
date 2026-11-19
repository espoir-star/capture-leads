/**
 * Téléchargement des 5 skills de la fiche « Claude en réunion » (demande d'Espoir du 19/11/2026 :
 * les installer en même temps). Généré depuis le contenu de la fiche : toujours à jour.
 */
import { NextResponse } from "next/server";
import { CLAUDE_REUNION, skillsBundleZip } from "@/content/guides/claude-en-reunion";

export const dynamic = "force-static";

export function GET() {
  const body = skillsBundleZip();
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${CLAUDE_REUNION.zip.file}"`,
      "Content-Length": String(body.length),
      "X-Robots-Tag": "noindex",
    },
  });
}
