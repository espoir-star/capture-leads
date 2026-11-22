/**
 * Téléchargement du tableau de bord seul (fichier HTML à ouvrir dans le navigateur, sans Claude).
 * Servi en pièce jointe : il s'exécute sur l'ordinateur de la personne, pas sur ce site.
 */
import { NextResponse } from "next/server";
import { REVUE_FEC, dashboardHtml } from "@/content/guides/revue-dossier-fec";

export const dynamic = "force-static";

export function GET() {
  const body = new TextEncoder().encode(dashboardHtml());
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${REVUE_FEC.html.file}"`,
      "Content-Length": String(body.length),
      "X-Robots-Tag": "noindex",
    },
  });
}
