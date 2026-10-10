/**
 * Bascule explicite, guide par guide, vers le moteur Althoce.
 *
 *   ALTHOCE_SEQUENCE_GUIDES   slugs séparés par des virgules (vide = aucun)
 *   ALTHOCE_SEQUENCES_PAUSED  "true" = les étapes différées sont reportées
 *                             (la livraison immédiate continue)
 *
 * Un guide hors liste reste livré par son automation Brevo historique : ce
 * moteur n'envoie alors rien pour lui (sauf la livraison d'un opposant, que
 * l'automation ne doit pas recevoir, cf. lib/lead/capture.ts).
 */

import { getSequence, sequenceReady, type SequenceConfig } from "@/config/sequences";

type Env = Record<string, string | undefined>;

export function switchedGuides(env: Env = process.env): Set<string> {
  return new Set(
    (env.ALTHOCE_SEQUENCE_GUIDES ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Séquence active pour ce guide, ou null s'il reste sur l'automation Brevo */
export function activeGuideSequence(
  lm: { slug: string; sequence: string },
  env: Env = process.env
): SequenceConfig | null {
  if (!switchedGuides(env).has(lm.slug)) return null;
  const seq = getSequence(lm.sequence);
  return seq && sequenceReady(seq) ? seq : null;
}

export function sequencesPaused(env: Env = process.env): boolean {
  return env.ALTHOCE_SEQUENCES_PAUSED === "true";
}
