/**
 * n8n → Vercel : visiteur du test de maturité IA (althoce.com) à verser dans
 * la base marketing Brevo, s'il n'a demandé ni rappel ni opposé aux
 * communications. Le PDF du résultat reste envoyé par n8n.
 *
 *   POST  Authorization: Bearer SEQUENCE_API_SECRET
 *   { email, prenom, secteur_slug, secteur_personnalise?, taille, role, score,
 *     stade, stade_nom, offre_recommandee, lien_resultat, opposition_marketing,
 *     source_url }
 *
 * Réponses (JSON, sauf 404/401) :
 *   200 { status: "created", marketingStatus }  contact créé + liste dédiée
 *   200 { status: "existing" }                   contact déjà connu : rien ne change
 *   200 { status: "ignored" }                    opposition_marketing = true
 *   200 { status: "skipped", reason: "qa" }      mode qa, adresse hors recette
 *   400 { status: "invalid_body", field? }       413 corps trop volumineux
 *   422 { status: "invalid_email", reason }      adresse refusée (factice, jetable, DNS)
 *   401 secret faux · 404 secret absent · 429 débit
 *   503 { status: "disabled" | "misconfigured" } bascule fermée / liste ou clé absente
 *   502 { status: "error" }                      Brevo indisponible → n8n peut réessayer
 *
 * Détails, correspondance des secteurs et mise en service : docs/INTAKE_TEST_MATURITE.md.
 */

import { after, NextRequest, NextResponse } from "next/server";
import { intakeTestMaturite } from "@/lib/intake/testMaturite";

// DNS (vérification MX) et crypto : runtime Node.js obligatoire
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const out = await intakeTestMaturite(req);
  // Événement Brevo après la réponse : un échec n'est jamais bloquant.
  if (out.followUp) after(out.followUp);
  if (!out.body) return new NextResponse(null, { status: out.status });
  return NextResponse.json(out.body, { status: out.status, headers: { "Cache-Control": "no-store" } });
}
