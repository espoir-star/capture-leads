/**
 * Lien court de diffusion : /l/<code> → page du guide avec ses UTM (302).
 * Seuls les codes du registre config/shortLinks.ts redirigent (aucune
 * redirection ouverte) ; un code inconnu renvoie vers l'accueil.
 */
import { NextRequest, NextResponse } from "next/server";
import { shortLinkTarget } from "@/config/shortLinks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const target = shortLinkTarget(code.toLowerCase()) ?? "/";
  const res = NextResponse.redirect(new URL(target, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
