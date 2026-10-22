/**
 * État d'exploitation d'un webinar, pour `npm run webinar:check` :
 *   GET ?slug=…   Authorization: Bearer SEQUENCE_API_SECRET
 *
 * Indique si la salle Meet et le replay sont configurés (variables Vercel) et
 * si l'enregistrement s'ouvre sans compte Google, SANS jamais renvoyer leurs
 * adresses (dépôt et réponses restent sans lien de salle).
 */
import { NextRequest, NextResponse } from "next/server";
import { getWebinar } from "@/config/webinars";
import { bearerMatches } from "@/lib/security/bearer";
import { joinState, registrationOpen } from "@/lib/webinar/access";
import { joinEnvName, replayEnvName, webinarJoinUrl, webinarReplayUrl } from "@/lib/webinar/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Drive : un fichier non partagé redirige vers la connexion Google. */
async function replayAccess(url: string): Promise<"public_link" | "sign_in_required" | "unreachable"> {
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 (Althoce webinar check)" } });
    const location = res.headers.get("location") ?? "";
    if (res.status >= 300 && res.status < 400 && /accounts\.google\.com|ServiceLogin/i.test(location)) return "sign_in_required";
    if (res.status === 200 || (res.status >= 300 && res.status < 400)) return "public_link";
    return res.status === 401 || res.status === 403 ? "sign_in_required" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.SEQUENCE_API_SECRET?.trim()) return new NextResponse(null, { status: 404 });
  if (!bearerMatches(req.headers.get("authorization"), process.env.SEQUENCE_API_SECRET)) return new NextResponse(null, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const w = /^[a-z0-9-]{1,80}$/.test(slug) ? getWebinar(slug) : undefined;
  if (!w) return NextResponse.json({ ok: false, reason: "webinar_inconnu" }, { status: 404 });
  const now = new Date();
  const replay = webinarReplayUrl(slug);
  return NextResponse.json({
    ok: true,
    slug,
    status: w.status,
    environment: process.env.VERCEL_ENV ?? "local",
    registrationOpen: w.status === "open" && registrationOpen(w, now),
    joinWindow: joinState(w, now),
    join: { variable: joinEnvName(slug), configured: !!webinarJoinUrl(slug) },
    replay: { variable: replayEnvName(slug), configured: !!replay, ...(replay && { access: await replayAccess(replay) }) },
  }, { headers: { "Cache-Control": "no-store" } });
}
