/**
 * Lien personnel de replay : redirection vers l'enregistrement (lu côté serveur,
 * publié quand WEBINAR_REPLAY_URL__<SLUG> existe) et signal « replay consulté »,
 * distinct d'une présence au direct. Scanners (HEAD, robots) : rien n'est noté.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { readWebinarToken } from "@/lib/webinar/access";
import { recordWebinarReplay } from "@/lib/webinar/events";
import { isAutomatedRequest } from "@/lib/webinar/scanner";
import { webinarReplayUrl } from "@/lib/webinar/urls";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = getWebinar(slug);
  const local = (path: string) => noStore(NextResponse.redirect(new URL(path, req.url), 302));
  if (!w || w.status === "draft") return local("/");
  const contactId = readWebinarToken(req.nextUrl.searchParams.get("t"), slug, "replay");
  if (contactId === null) return local(`/w/${slug}/acces?etat=lien-invalide`);
  const recording = webinarReplayUrl(slug);
  if (!recording) return local(`/w/${slug}/acces?etat=replay-bientot`);
  const now = new Date();
  if (!isAutomatedRequest(req.headers, req.method)) after(() => recordWebinarReplay(contactId, w, now));
  return noStore(NextResponse.redirect(recording, 302));
}

export async function HEAD() {
  return noStore(new NextResponse(null, { status: 204 }));
}
