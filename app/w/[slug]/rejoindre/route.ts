/**
 * Lien personnel de connexion : /w/<slug>/rejoindre?t=… (envoyé par email).
 * Pendant la fenêtre du live : présence enregistrée (webinar_attended, une fois
 * par contact) puis redirection vers la salle Google Meet. Hors fenêtre : page
 * d'information, aucune présence comptée. La salle n'est jamais publiée.
 */
import { NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { createWebinarToken, joinState, readWebinarToken } from "@/lib/webinar/access";
import { recordWebinarAttendance } from "@/lib/webinar/events";

export const dynamic = "force-dynamic";

const go = (req: NextRequest, path: string) => {
  const res = NextResponse.redirect(new URL(path, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = getWebinar(slug);
  if (!w || (w.status !== "open" && w.status !== "closed" && w.status !== "done")) return go(req, "/");
  const contactId = readWebinarToken(req.nextUrl.searchParams.get("t"), slug, "join");
  if (contactId === null) return go(req, `/w/${slug}/acces?etat=lien-invalide`);
  const now = new Date();
  const state = joinState(w, now);
  if (state === "too_early") return go(req, `/w/${slug}/acces?etat=bientot`);
  if (state === "ended") {
    const replay = w.replayUrl ? createWebinarToken(contactId, slug, "replay") : undefined;
    return go(req, replay ? `/w/${slug}/replay?t=${replay}` : `/w/${slug}/acces?etat=termine`);
  }
  if (!w.joinUrl) return go(req, `/w/${slug}/acces?etat=salle-fermee`);
  await recordWebinarAttendance(contactId, slug, now);
  const res = NextResponse.redirect(w.joinUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
