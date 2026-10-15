/** Fichier agenda (.ics) public : date, page du webinar ; jamais de lien de connexion. */
import { NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { siteUrl } from "@/lib/sequences/links";
import { webinarIcs } from "@/lib/webinar/access";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = getWebinar(slug);
  if (!w) return new NextResponse("Introuvable", { status: 404 });
  return new NextResponse(webinarIcs(w, siteUrl()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="webinar-althoce-${slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
