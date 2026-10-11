/**
 * SÉQUENCES EMAIL — Vercel décide, le workflow n8n commun attend.
 * Une identité par ressource isole les clés anti-doublons sans dupliquer les
 * modèles Brevo ni les workflows. Les identités historiques restent lisibles.
 */
import { templateId, type EmailTemplateKey } from "@/config/emailTemplates";
import type { LifecycleStage } from "@/config/taxonomy";

export type StepCategory = "transactional" | "marketing";
export interface SequenceStep {
  id: string;
  template: EmailTemplateKey;
  category: StepCategory;
  offsetHours: number;
  anchor: "enrollment" | "event";
  requires?: "replayUrl";
}
export interface SequenceConfig {
  id: string;
  label: string;
  delivery: EmailTemplateKey;
  steps: SequenceStep[];
}
export const STOP_LIFECYCLE_STAGES: readonly LifecycleStage[] = ["MEETING_BOOKED", "OPPORTUNITY", "CLIENT", "LOST"];
export const MEETING_ATTRIBUTES = ["TYPE_RDV", "ETAT_RDV"] as const;
export const STEP_STALE_AFTER_HOURS = 12;

function genericGuide(id: string, label: string): SequenceConfig {
  return {
    id, label, delivery: "generique.delivery",
    steps: [{ id: "relance-j2", template: "generique.relance-j2", category: "marketing", offsetHours: 48, anchor: "enrollment" }],
  };
}

export const SEQUENCES = {
  "guide-12-cas-ec-v1": {
    id: "guide-12-cas-ec-v1", label: "12 cas d'usage experts-comptables", delivery: "guide-12-cas-ec.delivery",
    steps: [{ id: "relance-j2", template: "guide-12-cas-ec.relance-j2", category: "marketing", offsetHours: 48, anchor: "enrollment" }],
  },
  // Compatibilité : ne pas supprimer cette identité, des inscriptions signées peuvent encore la porter.
  "guide-generique-v1": genericGuide("guide-generique-v1", "Guide (ancienne identité partagée)"),
  "guide-claude-pennylane-v1": genericGuide("guide-claude-pennylane-v1", "Claude × Pennylane"),
  "guide-claude-meta-ads-v1": genericGuide("guide-claude-meta-ads-v1", "Claude × Meta Ads"),
  "guide-copilot-8-cas-v1": genericGuide("guide-copilot-8-cas-v1", "Copilot : 8 cas d'usage"),
  "guide-claude-droit-v1": genericGuide("guide-claude-droit-v1", "Claude pour le droit"),
  "guide-claude-finance-skills-v1": genericGuide("guide-claude-finance-skills-v1", "12 skills Claude finance"),
  "guide-claude-data-gouv-v1": genericGuide("guide-claude-data-gouv-v1", "Claude × data.gouv"),
  "guide-agents-direction-financiere-v1": genericGuide("guide-agents-direction-financiere-v1", "12 agents IA direction financière"),
  "guide-7-chantiers-cabinet-v1": genericGuide("guide-7-chantiers-cabinet-v1", "7 chantiers IA cabinet"),
  "webinar-standard-v1": {
    id: "webinar-standard-v1", label: "Webinar (parcours standard)", delivery: "webinar.confirmation",
    steps: [
      { id: "rappel-j-1", template: "webinar.j-1", category: "transactional", offsetHours: -24, anchor: "event" },
      { id: "rappel-h-1", template: "webinar.h-1", category: "transactional", offsetHours: -1, anchor: "event" },
      { id: "replay", template: "webinar.replay", category: "transactional", offsetHours: 20, anchor: "event", requires: "replayUrl" },
      { id: "suivi", template: "webinar.suivi", category: "marketing", offsetHours: 72, anchor: "event" },
    ],
  },
} satisfies Record<string, SequenceConfig>;

export type SequenceId = keyof typeof SEQUENCES;
export function getSequence(id: string): SequenceConfig | undefined {
  return Object.prototype.hasOwnProperty.call(SEQUENCES, id) ? SEQUENCES[id as SequenceId] : undefined;
}
export function sequenceReady(seq: SequenceConfig): boolean {
  return templateId(seq.delivery) !== null && seq.steps.every((s) => templateId(s.template) !== null);
}
