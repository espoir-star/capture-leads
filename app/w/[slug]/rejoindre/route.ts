/**
 * Lien personnel de connexion : /w/<slug>/rejoindre?t=… (envoyé par email).
 * Pendant la fenêtre du live : redirection vers la salle Google Meet (lue côté
 * serveur, jamais publiée) et signal « lien de connexion ouvert », noté APRÈS
 * la réponse. Ce signal ne vaut pas présence : aucun point, aucun
 * webinar_attended (voir lib/webinar/events.ts). Hors fenêtre : page d'information.
 * Scanners de messagerie (HEAD, robots) : rien n'est noté.
 */
import { after, NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { createWebinarToken, joinState, readWebinarToken } from "@/lib/webinar/access";
import { recordWebinarJoinOpened } from "@/lib/webinar/events";
import { isAutomatedRequest } from "@/lib/webinar/scanner";
import { webinarJoinUrl, webinarReplayUrl } from "@/lib/webinar/urls";

export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
};
const go = (req: NextRequest, path: string) => noStore(NextResponse.redirect(new URL(path, req.url), 302));

async function handle(req: NextRequest, slug: string): Promise<NextResponse> {
  const w = getWebinar(slug);
  if (!w || (w.status !== "open" && w.status !== "closed" && w.status !== "done")) return go(req, "/");
  const contactId = readWebinarToken(req.nextUrl.searchParams.get("t"), slug, "join");
  if (contactId === null) return go(req, `/w/${slug}/acces?etat=lien-invalide`);
  const now = new Date();
  const state = joinState(w, now);
  if (state === "too_early") return go(req, `/w/${slug}/acces?etat=bientot`);
  if (state === "ended") {
    const replay = webinarReplayUrl(slug) ? createWebinarToken(contactId, slug, "replay") : undefined;
    return go(req, replay ? `/w/${slug}/replay?t=${replay}` : `/w/${slug}/acces?etat=termine`);
  }
  const room = webinarJoinUrl(slug);
  if (!room) return go(req, `/w/${slug}/acces?etat=salle-fermee`);
  if (!isAutomatedRequest(req.headers, req.method)) after(() => recordWebinarJoinOpened(contactId, w, now));
  return noStore(NextResponse.redirect(room, 302));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return handle(req, (await params).slug);
}

/** Pré-vérification d'un scanner : aucune redirection vers la salle, rien de noté. */
export async function HEAD() {
  return noStore(new NextResponse(null, { status: 204 }));
}
