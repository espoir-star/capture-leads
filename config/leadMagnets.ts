/**
 * ═══════════════════════════════════════════════════════════════
 *  LEAD MAGNETS → BREVO  (source de vérité CRM, côté serveur)
 * ═══════════════════════════════════════════════════════════════
 *
 *  1 entrée = 1 page /r/[slug] (contenu dans lib/ressources.ts).
 *  Le navigateur n'envoie QUE le slug : la liste Brevo, la verticale et le
 *  sous-secteur sont résolus ici, jamais fournis par le formulaire.
 *
 *  Règle : si la cible d'une ressource est ambiguë, mettre `null` + `todo`.
 *  Ne jamais deviner une verticale (elle pilote la segmentation newsletter).
 *
 *  `npm test` vérifie que chaque ressource a son entrée et inversement.
 */

import type { SequenceId } from "@/config/sequences";
import type { Subsector, Vertical } from "@/config/taxonomy";

/** Automation Brevo historique (dossier « LM - … ») : rattachement prouvé par les envois réels */
export interface LegacyAutomation {
  /** ID du workflow dans Brevo → Automatisations */
  automationId: number;
  deliveryTemplateId: number;
  followupTemplateIds: number[];
}

export interface LeadMagnetConfig {
  /** Slug d'URL, identique à la clé */
  slug: string;
  /** Valeur écrite dans l'attribut Brevo RESSOURCE (historiquement = slug) */
  resource: string;
  /** Liste Brevo « LM - … » (dossier Lead Magnets) */
  brevoListId: number;
  /** Nom de la liste dans Brevo, pour les rapports et la doc */
  brevoListName: string;
  vertical: Vertical | null;
  subsector: Subsector | null;
  /** Justification du mapping, ou TODO si ambigu */
  note: string;
  /** Séquence du moteur Althoce, utilisée quand le slug est dans ALTHOCE_SEQUENCE_GUIDES */
  sequence: SequenceId;
  /** Automation Brevo qui livre le guide tant qu'il n'a pas basculé */
  legacy: LegacyAutomation;
}

export const LEAD_MAGNETS = {
  "12-cas-usage-experts-comptables": {
    slug: "12-cas-usage-experts-comptables",
    resource: "12-cas-usage-experts-comptables",
    brevoListId: 10,
    brevoListName: "LM - 12 cas d'usage experts-comptables",
    vertical: "FINANCE",
    subsector: "EXPERTISE_COMPTABLE",
    note: "Page pilote. Mapping fourni dans le cahier des charges.",
    sequence: "guide-12-cas-ec-v1",
    legacy: { automationId: 4, deliveryTemplateId: 9, followupTemplateIds: [8] },
  },
  "guide-claude-pennylane": {
    slug: "guide-claude-pennylane",
    resource: "guide-claude-pennylane",
    brevoListId: 6,
    brevoListName: "LM - Guide Claude Pennylane",
    vertical: "FINANCE",
    subsector: "EXPERTISE_COMPTABLE",
    note: "Sous-titre de la page : « Pour les experts-comptables et cabinets ».",
    sequence: "guide-generique-v1",
    legacy: { automationId: 2, deliveryTemplateId: 1, followupTemplateIds: [2] },
  },
  "guide-claude-meta-ads": {
    slug: "guide-claude-meta-ads",
    resource: "guide-claude-meta-ads",
    brevoListId: 7,
    brevoListName: "LM - Guide Claude Meta Ads",
    vertical: "MARKETING",
    subsector: null,
    note: "TODO sous-secteur : la page vise « PME et agences » (AGENCE_MARKETING ne couvre qu'une partie).",
    sequence: "guide-generique-v1",
    legacy: { automationId: 3, deliveryTemplateId: 6, followupTemplateIds: [5] },
  },
  "copilot-8-cas-usage": {
    slug: "copilot-8-cas-usage",
    resource: "copilot-8-cas-usage",
    brevoListId: 11,
    brevoListName: "LM - Guide Copilot 8 cas d'usage",
    vertical: "GENERAL",
    subsector: null,
    note: "Guide Microsoft Copilot sans cible métier (licences, gouvernance, agents).",
    sequence: "guide-generique-v1",
    legacy: { automationId: 6, deliveryTemplateId: 11, followupTemplateIds: [12] },
  },
  "claude-droit-10-cas-usage": {
    slug: "claude-droit-10-cas-usage",
    resource: "claude-droit-10-cas-usage",
    brevoListId: 12,
    brevoListName: "LM - Guide Claude Droit",
    vertical: "LEGAL",
    subsector: null,
    note: "TODO sous-secteur : avocats et juristes d'entreprise mélangés, aucun code SUBSECTOR juridique défini.",
    sequence: "guide-generique-v1",
    legacy: { automationId: 7, deliveryTemplateId: 16, followupTemplateIds: [15] },
  },
  "12-skills-claude-finance": {
    slug: "12-skills-claude-finance",
    resource: "12-skills-claude-finance",
    brevoListId: 13,
    brevoListName: "LM - 12 skills Claude finance",
    vertical: "FINANCE",
    subsector: null,
    note: "TODO sous-secteur : « charger votre balance » vaut pour cabinets comme pour DAF.",
    sequence: "guide-generique-v1",
    legacy: { automationId: 8, deliveryTemplateId: 19, followupTemplateIds: [21] },
  },
  "claude-data-gouv-20-prompts": {
    slug: "claude-data-gouv-20-prompts",
    resource: "claude-data-gouv-20-prompts",
    brevoListId: 14,
    brevoListName: "LM - Claude data.gouv",
    vertical: null,
    subsector: null,
    note: "TODO verticale : données publiques (ratios, bilans, foncier, registre) sans cible explicite.",
    sequence: "guide-generique-v1",
    legacy: { automationId: 9, deliveryTemplateId: 26, followupTemplateIds: [25] },
  },
  "12-agents-ia-direction-financiere": {
    slug: "12-agents-ia-direction-financiere",
    resource: "12-agents-ia-direction-financiere",
    brevoListId: 15,
    brevoListName: "LM - 12 agents IA direction financiere",
    vertical: "FINANCE",
    subsector: "DAF_FINANCE",
    note: "Titre : « pour votre direction financière ».",
    sequence: "guide-generique-v1",
    legacy: { automationId: 10, deliveryTemplateId: 29, followupTemplateIds: [30] },
  },
  "7-chantiers-ia-cabinet": {
    slug: "7-chantiers-ia-cabinet",
    resource: "7-chantiers-ia-cabinet",
    brevoListId: 16,
    brevoListName: "LM - 7 chantiers IA cabinet",
    vertical: null,
    subsector: null,
    note: "TODO verticale : « cabinet » peut désigner expertise comptable, avocats ou conseil.",
    sequence: "guide-generique-v1",
    legacy: { automationId: 11, deliveryTemplateId: 34, followupTemplateIds: [33] },
  },
} as const satisfies Record<string, LeadMagnetConfig>;

export type LeadMagnetSlug = keyof typeof LEAD_MAGNETS;

export function getLeadMagnet(slug: string): LeadMagnetConfig | undefined {
  return Object.prototype.hasOwnProperty.call(LEAD_MAGNETS, slug)
    ? LEAD_MAGNETS[slug as LeadMagnetSlug]
    : undefined;
}

export function getLeadMagnetByListId(listId: number): LeadMagnetConfig | undefined {
  return Object.values(LEAD_MAGNETS).find((lm) => lm.brevoListId === listId);
}

export const LEAD_MAGNET_SLUGS = Object.keys(LEAD_MAGNETS) as LeadMagnetSlug[];
