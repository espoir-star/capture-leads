/**
 * Bascule explicite, guide par guide, vers le moteur Althoce.
 *
 *   ALTHOCE_SEQUENCE_GUIDES   slugs séparés par des virgules (vide = aucun) ;
 *                             « slug:qa » = actif seulement pour les adresses de
 *                             ALTHOCE_SEQUENCE_QA_EMAILS (test en Production sans
 *                             toucher aux vrais prospects)
 *   ALTHOCE_SEQUENCE_QA_TIME_SCALE  mode QA : délais divisés par ce facteur
 *                             (ex. 120 → relance J+2 après 24 min)
 *   ALTHOCE_SEQUENCES_PAUSED  "true" = les étapes différées sont reportées
 *                             (la livraison immédiate continue)
 *
 * Un guide hors liste reste livré par son automation Brevo historique : ce
 * moteur n'envoie alors rien pour lui (sauf la livraison d'un opposant, que
 * l'automation ne doit pas recevoir, cf. lib/lead/capture.ts).
 */

import { getSequence, sequenceReady, type SequenceConfig } from "@/config/sequences";

type Env = Record<string, string | undefined>;

/** Mode de bascule par slug : "all" (tous les leads) ou "qa" (adresses QA seulement) */
export function switchedGuides(env: Env = process.env): Map<string, "all" | "qa"> {
  const out = new Map<string, "all" | "qa">();
  for (const raw of (env.ALTHOCE_SEQUENCE_GUIDES ?? "").split(",")) {
    const [slug, mode] = raw.trim().split(":");
    if (slug) out.set(slug, mode === "qa" ? "qa" : "all");
  }
  return out;
}

export interface ActiveSequence {
  seq: SequenceConfig;
  /** mode QA : pas d'ajout à la liste (l'automation historique reste active), délais accélérés */
  qa: boolean;
  timeScale: number;
}

/** Séquence active pour ce guide et cette adresse, ou null s'il reste sur l'automation Brevo */
export function activeGuideSequence(
  lm: { slug: string; sequence: string },
  env: Env = process.env,
  email?: string
): ActiveSequence | null {
  const mode = switchedGuides(env).get(lm.slug);
  if (!mode) return null;
  const seq = getSequence(lm.sequence);
  if (!seq || !sequenceReady(seq)) return null;
  if (mode === "all") return { seq, qa: false, timeScale: 1 };
  const qaEmails = new Set((env.ALTHOCE_SEQUENCE_QA_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
  if (!email || !qaEmails.has(email.toLowerCase())) return null;
  const k = Number(env.ALTHOCE_SEQUENCE_QA_TIME_SCALE ?? 1);
  return { seq, qa: true, timeScale: Number.isFinite(k) && k >= 1 && k <= 1440 ? k : 1 };
}

/** Parcours d'un webinar ouvert, si sa séquence est prête (modèles créés) */
export function webinarSequence(w: { sequence?: string; status: string } | undefined): SequenceConfig | null {
  if (!w?.sequence || w.status !== "open") return null;
  const seq = getSequence(w.sequence);
  return seq && sequenceReady(seq) ? seq : null;
}

export function sequencesPaused(env: Env = process.env): boolean {
  return env.ALTHOCE_SEQUENCES_PAUSED === "true";
}
