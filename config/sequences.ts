/**
 * ═══════════════════════════════════════════════════════════════
 *  SÉQUENCES EMAIL — moteur Althoce (Vercel décide, n8n attend)
 * ═══════════════════════════════════════════════════════════════
 *
 *  Une séquence = une LIVRAISON immédiate (transactionnelle, envoyée par
 *  Vercel : le guide part même si n8n est indisponible) + des ÉTAPES
 *  différées. Un SEUL workflow n8n générique (n8n/althoce-sequences.json)
 *  attend la date de chaque étape et appelle /api/sequences/step : il ne
 *  connaît ni les modèles, ni les délais, ni les règles. Ajouter un guide
 *  = une entrée ici, jamais un nouveau workflow.
 *
 *  Règles d'envoi (lib/sequences/plan.ts) :
 *    - transactional : livraison, confirmation et rappels pratiques d'un
 *      webinar → envoyés à la personne qui les a demandés, même opposée au
 *      marketing (jamais à une adresse invalide ou en bounce) ;
 *    - marketing : relances, suivi commercial → seulement si
 *      mayReceiveMarketing() (statut CONSENT / B2B_ELIGIBLE, non bloqué) et
 *      si le contact n'est pas déjà en cycle commercial (STOP_*).
 *
 *  Bascule par guide : ALTHOCE_SEQUENCE_GUIDES (variable Vercel, slugs
 *  séparés par des virgules). Hors de cette liste, le guide reste sur son
 *  automation Brevo historique. Modèles : config/emailTemplates.ts
 *  (aucun ID fictif ; une séquence dont un modèle manque ne s'active pas).
 */

import { templateId, type EmailTemplateKey } from "@/config/emailTemplates";
import type { LifecycleStage } from "@/config/taxonomy";

export type StepCategory = "transactional" | "marketing";

export interface SequenceStep {
  /** Identifiant stable : clé d'idempotence, événements Brevo, n8n */
  id: string;
  template: EmailTemplateKey;
  category: StepCategory;
  /** Heures après l'ancre ; négatif = avant (rappels webinar) */
  offsetHours: number;
  /** enrollment = inscription ; event = début du webinar */
  anchor: "enrollment" | "event";
}

export interface SequenceConfig {
  id: string;
  label: string;
  /** Envoi immédiat, transactionnel (guide demandé / confirmation d'inscription) */
  delivery: EmailTemplateKey;
  steps: SequenceStep[];
}

/** Contact déjà en cycle commercial : plus de relance marketing automatique */
export const STOP_LIFECYCLE_STAGES: readonly LifecycleStage[] = ["MEETING_BOOKED", "OPPORTUNITY", "CLIENT", "LOST"];
/** Attributs Brevo historiques de prise de RDV (renseignés par le setter) */
export const MEETING_ATTRIBUTES = ["TYPE_RDV", "ETAT_RDV"] as const;

/** Une étape prévue il y a plus longtemps que ce délai n'est plus envoyée (ex. J-1 d'un webinar déjà passé) */
export const STEP_STALE_AFTER_HOURS = 12;

export const SEQUENCES = {
  /** Guide pilote : copie fidèle des emails #9 / #8 de l'automation historique #4 */
  "guide-12-cas-ec-v1": {
    id: "guide-12-cas-ec-v1",
    label: "12 cas d'usage experts-comptables",
    delivery: "guide-12-cas-ec.delivery",
    steps: [{ id: "relance-j2", template: "guide-12-cas-ec.relance-j2", category: "marketing", offsetHours: 48, anchor: "enrollment" }],
  },
  /** Nouveaux guides : modèles génériques paramétrés (titre et lien depuis lib/ressources.ts) */
  "guide-generique-v1": {
    id: "guide-generique-v1",
    label: "Guide (modèles génériques)",
    delivery: "generique.delivery",
    steps: [{ id: "relance-j2", template: "generique.relance-j2", category: "marketing", offsetHours: 48, anchor: "enrollment" }],
  },
} satisfies Record<string, SequenceConfig>;

export type SequenceId = keyof typeof SEQUENCES;

export function getSequence(id: string): SequenceConfig | undefined {
  return Object.prototype.hasOwnProperty.call(SEQUENCES, id) ? SEQUENCES[id as SequenceId] : undefined;
}

/** Tous les modèles de la séquence existent dans Brevo (IDs réels renseignés) */
export function sequenceReady(seq: SequenceConfig): boolean {
  return templateId(seq.delivery) !== null && seq.steps.every((s) => templateId(s.template) !== null);
}
