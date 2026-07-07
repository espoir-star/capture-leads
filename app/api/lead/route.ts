import { NextRequest, NextResponse } from "next/server";
import { getRessource } from "@/lib/ressources";

const BREVO_API = "https://api.brevo.com/v3/contacts";

/* Limitation de débit best-effort (mémoire de l'instance serverless).
   Suffisant contre les boucles naïves ; les bots simples sont déjà
   filtrés par le honeypot. */
const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 5;
const tentatives = new Map<string, { count: number; reset: number }>();

function tropDeRequetes(ip: string): boolean {
  const now = Date.now();
  if (tentatives.size > 1000) {
    for (const [k, v] of tentatives) if (now > v.reset) tentatives.delete(k);
  }
  const t = tentatives.get(ip);
  if (!t || now > t.reset) {
    tentatives.set(ip, { count: 1, reset: now + FENETRE_MS });
    return false;
  }
  t.count++;
  return t.count > MAX_PAR_FENETRE;
}

/** Nettoie une chaîne libre : caractères de contrôle retirés, longueur bornée */
function nettoyer(val: unknown, max: number): string {
  return String(val ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

interface LeadPayload {
  slug?: string;
  prenom?: string;
  nom?: string;
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
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (tropDeRequetes(ip)) {
    return NextResponse.json(
      { message: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429 }
    );
  }

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

  const slug = nettoyer(body.slug, 80);
  const prenom = nettoyer(body.prenom, 60);
  const nom = nettoyer(body.nom, 60);
  const email = nettoyer(body.email, 254).toLowerCase();
  const tel = nettoyer(body.tel, 20);

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
  if (nom.length < 2 || nom.length > 60) {
    return NextResponse.json(
      { message: "Nom invalide." },
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
    NOM: nom,
    SMS: tel,
    RESSOURCE: slug,
    SOURCE_INSCRIPTION: "page-capture",
    DATE_OPTIN: new Date().toISOString(),
  };
  const utmSource = nettoyer(body.utm?.source, 120);
  const utmMedium = nettoyer(body.utm?.medium, 120);
  const utmCampaign = nettoyer(body.utm?.campaign, 120);
  if (utmSource) attributes.UTM_SOURCE = utmSource;
  if (utmMedium) attributes.UTM_MEDIUM = utmMedium;
  if (utmCampaign) attributes.UTM_CAMPAIGN = utmCampaign;

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

      // Deux cas où le numéro bloque la création alors que le lead est bon :
      // - duplicate_parameter : le SMS existe déjà sur un autre contact
      // - invalid_parameter "Invalid phone number" : Brevo valide les tranches
      //   attribuées, plus strict que notre regex
      // On retente sans le SMS pour ne pas perdre le lead.
      const numeroRejete =
        err?.code === "duplicate_parameter" ||
        (err?.code === "invalid_parameter" &&
          /phone/i.test(String(err?.message ?? "")));
      if (numeroRejete) {
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
