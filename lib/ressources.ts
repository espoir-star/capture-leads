/**
 * ═══════════════════════════════════════════════════════════════
 *  CONFIG DES RESSOURCES — 1 bloc = 1 page de capture
 * ═══════════════════════════════════════════════════════════════
 *
 *  Pour créer une nouvelle ressource :
 *  1. Ajouter un bloc ci-dessous (copier la structure d'un existant)
 *  2. Créer la liste correspondante dans Brevo → noter son ID → brevoListId
 *  3. (Optionnel) Ajouter une image de partage dans /public/covers/
 *  4. git push → la page /r/[slug] existe automatiquement
 *
 *  ⚠️ RÈGLE ABSOLUE : chaque affirmation factuelle (chiffres, noms
 *  d'outils, méthodes) doit être VÉRIFIÉE avant mise en ligne.
 *  Pas d'extrapolation. Voir incident Pennylane.
 */

export type StylePage = "modal" | "page";

export interface Ressource {
  /** Slug dans l'URL : /r/[slug] */
  slug: string;
  /** Badge au-dessus du titre (ex: "GUIDE GRATUIT") */
  badge: string;
  /** Titre principal. Utiliser <accent> pour la partie en vert. */
  titre: string;
  /** Sous-titre : à qui + ce que contient la ressource, concret */
  sousTitre: string;
  /** 3-4 pills de valeur scannables. Uniquement des faits vérifiés. */
  pills: string[];
  /** Lien vers la ressource (Notion, artifact Claude, PDF...) */
  urlRessource: string;
  /** ID de la liste Brevo dédiée à cette ressource */
  brevoListId: number;
  /** "modal" = form au centre sur fond flouté / "page" = landing 2 colonnes */
  style: StylePage;
  /** Image OG pour la preview LinkedIn (dans /public/covers/), optionnel */
  cover?: string;
  /** Texte du bouton de soumission */
  cta?: string;

  /* ── Champs optionnels pour un contenu plus riche que pills ──── */

  /** Paragraphe(s) affiché(s) après le sous-titre principal */
  paragraphes?: string[];
  /** Mini-carte "titre du guide" affichée au-dessus du formulaire (ex: durée de lecture) */
  resourceCard?: { titre: string; meta: string };
  /** Points détaillés (titre en gras + description). Remplace les pills si présent. */
  points?: { titre: string; description: string }[];
  /** Encadré d'alerte/insight affiché après les points */
  encadre?: { titre: string; texte: string };
  /** Signature en bas de page (remplace la ligne par défaut) */
  signature?: string;
  /** Personnalisation de la page merci (remplace le titre/texte par défaut) */
  merci?: { titre: string; texte: string };
}

export const RESSOURCES: Record<string, Ressource> = {
  /* ─────────────────────────────────────────────────────────────
   * EXEMPLE 1 — Guide Claude × Pennylane (guide existant, corrigé)
   * ⚠️ brevoListId à remplacer par le vrai ID après création
   *    de la liste dans Brevo (Contacts → Listes)
   * ──────────────────────────────────────────────────────────── */
  "guide-claude-pennylane": {
    slug: "guide-claude-pennylane",
    badge: "GUIDE GRATUIT",
    titre: "Connecter Claude à <accent>Pennylane</accent> et automatiser votre comptabilité",
    sousTitre:
      "Pour les experts-comptables et cabinets. Guide complet de connexion Claude × Pennylane via MCP : installation pas à pas, cas d'usage concrets et prompts prêts à copier.",
    pills: [
      "Installation pas à pas",
      "Prompts prêts à copier",
      "Cas d'usage cabinet",
      "Open source · Gratuit",
    ],
    urlRessource:
      "https://espoir-metareglage.notion.site/Claude-Pennylane-le-guide-pour-automatiser-ta-production-comptable-en-2026-387c7d01a0e88169b12dc48fee3de7c0",
    brevoListId: 6, // "LM - Guide Claude Pennylane" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
  },

  /* ─────────────────────────────────────────────────────────────
   * EXEMPLE 2 — Guide Claude × Meta Ads (guide existant)
   * ──────────────────────────────────────────────────────────── */
  "guide-claude-meta-ads": {
    slug: "guide-claude-meta-ads",
    badge: "GUIDE GRATUIT",
    titre: "Piloter vos <accent>Meta Ads</accent> avec Claude",
    sousTitre:
      "Pour les PME et agences qui gèrent leurs campagnes Meta. Méthode complète pour analyser et optimiser vos campagnes avec Claude, sans dépendre d'un consultant.",
    pills: [
      "Méthode d'analyse complète",
      "Prompts prêts à copier",
      "Applicable dès aujourd'hui",
    ],
    urlRessource:
      "https://espoir-metareglage.notion.site/Claude-Meta-Ads-le-guide-pour-piloter-tes-campagnes-en-langage-naturel-388c7d01a0e88188bf67fb196260b017",
    brevoListId: 7, // "LM - Guide Claude Meta Ads" (dossier Lead Magnets)
    style: "page",
    cta: "Recevoir le guide",
  },

  /* ─────────────────────────────────────────────────────────────
   * 12 cas d'usage Claude pour experts-comptables
   * ──────────────────────────────────────────────────────────── */
  "12-cas-usage-experts-comptables": {
    slug: "12-cas-usage-experts-comptables",
    badge: "GUIDE GRATUIT",
    titre:
      "12 cas d'usage concrets de <accent>Claude</accent> pour les experts-comptables",
    sousTitre:
      "Pour les experts-comptables, collaborateurs et dirigeants de cabinets. 12 cas d'usage testés sur le terrain, de la production à la relation client, en passant par l'organisation interne et le conseil. Le principe : Claude propose, vous validez. Aucune écriture, aucun mail, aucune note sans votre accord.",
    pills: [
      "12 cas d'usage concrets",
      "Testés sur le terrain",
      "Claude propose, vous validez",
      "Compatible responsabilité pro",
    ],
    urlRessource:
      "https://espoir-metareglage.notion.site/12-cas-d-usage-concrets-de-Claude-pour-les-experts-comptables-3aac7d01a0e881caabc6c8d9d5555dc2",
    brevoListId: 10, // "LM - 12 cas d'usage experts-comptables" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
  },

  /* ─────────────────────────────────────────────────────────────
   * Guide Copilot — 8 cas d'usage
   * ──────────────────────────────────────────────────────────── */
  "copilot-8-cas-usage": {
    slug: "copilot-8-cas-usage",
    badge: "GUIDE GRATUIT",
    titre:
      "Votre entreprise a bloqué Claude et ChatGPT.\nEt vous utilisez <accent>Copilot</accent> uniquement pour écrire des mails.",
    sousTitre:
      "Le problème n'est pas l'outil. C'est que personne n'a montré ce qu'il sait faire depuis qu'il a changé de nature.",
    paragraphes: [
      "Depuis le 22 avril 2026, le mode agent est disponible en version générale dans Word, Excel et PowerPoint. Copilot n'attend plus vos instructions étape par étape : il exécute des actions en plusieurs étapes directement dans vos documents.",
    ],
    resourceCard: {
      titre:
        "Copilot : 8 cas d'usage, votre premier agent et la checklist de gouvernance",
      meta: "Guide gratuit · lecture 20 min",
    },
    points: [
      {
        titre: "Les 8 cas d'usage détaillés, avec les prompts exacts à copier-coller",
        description:
          "Restructurer un rapport de 40 pages, nettoyer un Excel mal fichu, transformer un document interne en présentation client.",
      },
      {
        titre: "La création de votre premier agent, pas à pas et sans une ligne de code",
        description:
          "Agent Builder en 15 minutes, puis Copilot Studio pour les agents qui agissent.",
      },
      {
        titre: "La checklist de gouvernance à passer avant tout déploiement",
        description: "Permissions, périmètre, actions, coûts, suivi.",
      },
      {
        titre: "Le tableau des quatre niveaux de licence 2026",
        description:
          "Et le piège du modèle à crédits, celui qui fait déraper la facture.",
      },
    ],
    encadre: {
      titre: "Le point que peu de gens ont vu passer",
      texte:
        "Vos agents héritent des permissions existantes de votre annuaire. Ils ne créent aucun droit nouveau — mais ils rendent accessible, en langage naturel et à la demande, tout ce qui l'était déjà sans que personne ne l'ait jamais retrouvé.\n\nSi vos droits SharePoint sont mal configurés depuis trois ans, l'agent expose ces données à toute l'entreprise.",
    },
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/Copilot-8-cas-d-usage-ton-premier-agent-et-la-checklist-de-gouvernance-3b1c7d01a0e8812b994ae14f8ce79bf9",
    brevoListId: 11, // "LM - Guide Copilot 8 cas d'usage" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Guide rédigé par Espoir Mwami — Althoce",
    merci: {
      titre: "C'est parti — le guide arrive dans votre boîte mail.",
      texte:
        "Vérifiez vos spams si vous ne le voyez pas dans les deux minutes.",
    },
  },
};

export function getRessource(slug: string): Ressource | undefined {
  return RESSOURCES[slug];
}

export function getAllSlugs(): string[] {
  return Object.keys(RESSOURCES);
}
