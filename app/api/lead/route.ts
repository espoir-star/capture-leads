import { NextRequest, NextResponse } from "next/server";
import { getRessource } from "@/lib/ressources";

const BREVO_API = "https://api.brevo.com/v3/contacts";

interface LeadPayload {
  slug?: string;
  prenom?: string;
  email?: string;
  tel?: string;
  website?: string; // honeypot
  utm?: { source?: string; medium?: string; campaign?: string };
}

function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function telValide(tel: string): boolean {
  return /^\+33[67]\d{8}$/.test(tel);
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Requête invalide." },
      { status: 400 }
    );
  }

  // Honeypot rempli = bot. On répond OK sans rien faire.
  if (body.website && body.website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  const slug = String(body.slug ?? "");
  const prenom = String(body.prenom ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const tel = String(body.tel ?? "").trim();

  const ressource = getRessource(slug);
  if (!ressource) {
    return NextResponse.json(
      { message: "Ressource inconnue." },
      { status: 404 }
    );
  }
  if (prenom.length < 2 || prenom.length > 60) {
    return NextResponse.json(
      { message: "Prénom invalide." },
      { status: 400 }
    );
  }
  if (!emailValide(email)) {
    return NextResponse.json(
      { message: "Email invalide." },
      { status: 400 }
    );
  }
  if (!telValide(tel)) {
    return NextResponse.json(
      { message: "Numéro de mobile invalide (format +336... ou +337...)." },
      { status: 400 }
    );
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY manquante");
    return NextResponse.json(
      { message: "Configuration serveur incomplète." },
      { status: 500 }
    );
  }

  const attributes: Record<string, string> = {
    PRENOM: prenom,
    SMS: tel,
    RESSOURCE: slug,
    SOURCE_INSCRIPTION: "page-capture",
    DATE_OPTIN: new Date().toISOString(),
  };
  if (body.utm?.source) attributes.UTM_SOURCE = body.utm.source;
  if (body.utm?.medium) attributes.UTM_MEDIUM = body.utm.medium;
  if (body.utm?.campaign) attributes.UTM_CAMPAIGN = body.utm.campaign;

  try {
    const res = await fetch(BREVO_API, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [ressource.brevoListId],
        updateEnabled: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);

      // Cas fréquent : le numéro SMS existe déjà sur un autre contact.
      // On retente sans le SMS pour ne pas perdre le lead.
      if (err?.code === "duplicate_parameter") {
        delete attributes.SMS;
        attributes.TEL_DOUBLON = tel; // on garde la trace du numéro
        const retry = await fetch(BREVO_API, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email,
            attributes,
            listIds: [ressource.brevoListId],
            updateEnabled: true,
          }),
        });
        if (retry.ok) return NextResponse.json({ ok: true });
      }

      console.error("Erreur Brevo:", res.status, err);
      return NextResponse.json(
        { message: "Impossible d'enregistrer votre inscription. Réessayez." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erreur réseau Brevo:", e);
    return NextResponse.json(
      { message: "Erreur réseau. Réessayez." },
      { status: 502 }
    );
  }
}
