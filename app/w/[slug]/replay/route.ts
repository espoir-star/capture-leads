/** Lien personnel de replay : clic enregistré (webinar_replay_clicked) puis enregistrement Meet. */
import { NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { readWebinarToken } from "@/lib/webinar/access";
import { recordWebinarReplay } from "@/lib/webinar/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = getWebinar(slug);
  const local = (path: string) => {
    const res = NextResponse.redirect(new URL(path, req.url), 302);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  if (!w || w.status === "draft") return local("/");
  const contactId = readWebinarToken(req.nextUrl.searchParams.get("t"), slug, "replay");
  if (contactId === null) return local(`/w/${slug}/acces?etat=lien-invalide`);
  if (!w.replayUrl) return local(`/w/${slug}/acces?etat=replay-bientot`);
  await recordWebinarReplay(contactId, slug, new Date());
  const res = NextResponse.redirect(w.replayUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
