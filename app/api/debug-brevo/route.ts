import { NextRequest, NextResponse } from "next/server";

/* Endpoint de diagnostic TEMPORAIRE — à supprimer après résolution.
   Ne révèle jamais la clé : uniquement sa présence, sa longueur
   et le code de réponse Brevo depuis les serveurs Vercel. */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("t") !== "alth2026") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const cle = process.env.BREVO_API_KEY;
  const diagnostic: Record<string, unknown> = {
    presente: Boolean(cle),
    longueur: cle?.length ?? 0,
    longueurAttendue: 89,
    prefixeOk: cle?.startsWith("xkeysib-") ?? false,
    espacesParasites: cle !== cle?.trim(),
  };

  if (cle) {
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": cle },
    });
    diagnostic.brevoStatus = res.status;
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      diagnostic.brevoCode = err?.code ?? null;
    }
  }

  return NextResponse.json(diagnostic);
}
