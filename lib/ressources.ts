/**
 * ═══════════════════════════════════════════════════════════════
 *  CONFIG DES RESSOURCES — 1 bloc = 1 page de capture
 * ═══════════════════════════════════════════════════════════════
 *
 *  Contenu des pages uniquement. Le mapping CRM (liste Brevo, verticale,
 *  sous-secteur) est côté serveur dans config/leadMagnets.ts.
 *
 *  Pour créer une nouvelle ressource :
 *  1. Ajouter un bloc ci-dessous (copier la structure d'un existant)
 *  2. Créer la liste correspondante dans Brevo → noter son ID
 *  3. Ajouter l'entrée dans config/leadMagnets.ts (listId, verticale…)
 *  4. (Optionnel) Ajouter une image de partage dans /public/covers/
 *  5. npm test (vérifie la cohérence) puis git push
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
  resourceCard?: { titre: string; description?: string; meta: string };
  /** Points détaillés (titre en gras + description). Remplace les pills si présent. */
  points?: { titre: string; description?: string }[];
  /** Encadré d'alerte/insight affiché après les points */
  encadre?: { titre: string; texte: string };
  /** Signature en bas de page (remplace la ligne par défaut) */
  signature?: string;
  /**
   * Personnalisation de la page merci (remplace le titre/texte par défaut).
   * Ne jamais promettre un délai d'email : la page ignore l'état de l'envoi.
   * ctaTitre/ctaTexte personnalisent le second bloc (relance call) ;
   * ctaTexte omis = texte par défaut, ctaTexte: "" = pas de texte sous le titre.
   */
  merci?: {
    titre?: string;
    texte?: string;
    ctaTitre?: string;
    ctaTexte?: string;
  };
}

export const RESSOURCES: Record<string, Ressource> = {
  "tableaux-de-bord-claude-cabinets": {
    slug: "tableaux-de-bord-claude-cabinets",
    badge: "GUIDE GRATUIT",
    titre: "3 tableaux de bord <accent>Claude</accent> pour piloter votre cabinet",
    sousTitre: "Pour les experts-comptables et dirigeants de cabinets. Un tutoriel court et trois prompts prêts à adapter, avec sources officielles et précautions sur les données clients.",
    resourceCard: {
      titre: "3 tableaux de bord Claude pour piloter votre cabinet",
      description: "Portefeuille, rendez-vous client et radar sectoriel.",
      meta: "Lecture estimée : 5 minutes",
    },
    pills: ["3 prompts prêts à adapter", "Portefeuille, rendez-vous, secteur", "Sources vérifiables"],
    // Route interne : reste dans la Preview lors de la recette, en production après activation.
    urlRessource: "/g/tableaux-de-bord-claude-cabinets",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },
  /* ─────────────────────────────────────────────────────────────
   * Claude × Pennylane : 10 usages (refait le 19/10/2026, connecteur officiel)
   * ──────────────────────────────────────────────────────────── */
  "guide-claude-pennylane": {
    slug: "guide-claude-pennylane",
    badge: "GUIDE GRATUIT",
    titre: "Claude est branché sur <accent>Pennylane</accent>.\nVoici 10 usages qui changent le quotidien.",
    sousTitre:
      "Pour les experts-comptables, collaborateurs et DAF. Production, analyse, relation client et pilotage du cabinet : chaque usage avec son prompt prêt à copier, avec Claude, ChatGPT ou Mistral.",
    resourceCard: {
      titre: "Claude × Pennylane : 10 usages",
      description: "Les 10 prompts prêts à copier et le paramétrage du connecteur.",
      meta: "Lecture estimée : 5 minutes",
    },
    pills: [
      "Connecteur officiel Pennylane",
      "10 prompts prêts à copier",
      "Claude, ChatGPT, Mistral…",
      "Lecture seule : rien n'est modifié",
    ],
    // Lecteur interne depuis le 19/10/2026 (l'ancienne page Notion reste en ligne pour les premiers inscrits).
    urlRessource: "/g/claude-pennylane",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },

  /* ─────────────────────────────────────────────────────────────
   * Agent Surveillance : la fiche complète (proposition Althoce, 27/10/2026)
   * ──────────────────────────────────────────────────────────── */
  "agent-surveillance-cabinets": {
    slug: "agent-surveillance-cabinets",
    badge: "FICHE GRATUITE",
    titre: "Vos clients relevés <accent>chaque nuit</accent>,\nsans que personne ne se connecte.",
    sousTitre:
      "Pour les experts-comptables et dirigeants de cabinets. La fiche complète de l'agent Surveillance : ce qu'il relève source par source, ce que vous recevez le matin, la mise en route et les garanties.",
    resourceCard: {
      titre: "Agent Surveillance : la fiche complète",
      description: "Impôts, URSSAF, INPI, BODACC et facturation électronique, client par client.",
      meta: "Lecture estimée : 4 minutes",
    },
    pills: [
      "Impôts, URSSAF, INPI, BODACC",
      "Facturation électronique",
      "Uniquement le neuf, chaque matin",
      "Lecture seule, serveur en France",
    ],
    urlRessource: "/g/agent-surveillance",
    style: "modal",
    cta: "Recevoir la fiche",
    signature: "Espoir Mwami — Althoce",
    merci: {
      titre: "Votre fiche est prête.",
      ctaTitre: "Voir l'agent sur votre cabinet ?",
    },
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
      "Le mode agent change tout depuis avril 2026. Personne ne vous a montré ce que ça change.",
    sousTitre: "",
    points: [
      { titre: "8 cas d'usage concrets, prompts à copier-coller inclus" },
      { titre: "Votre premier agent créé pas à pas, sans une ligne de code" },
      { titre: "La checklist de gouvernance avant tout déploiement" },
      { titre: "Les 4 niveaux de licence 2026, et le piège à éviter" },
    ],
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/Copilot-8-cas-d-usage-ton-premier-agent-et-la-checklist-de-gouvernance-3b1c7d01a0e8812b994ae14f8ce79bf9",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Guide rédigé par Espoir Mwami — Althoce",
  },

  /* ─────────────────────────────────────────────────────────────
   * Guide Claude pour le droit — 10 cas d'usage
   * ──────────────────────────────────────────────────────────── */
  "claude-droit-10-cas-usage": {
    slug: "claude-droit-10-cas-usage",
    badge: "GUIDE GRATUIT",
    titre:
      "Vous passez plus de temps à lire des contrats qu'à les négocier.",
    sousTitre: "Et la partie qui a de la valeur pour votre client, c'est la seconde.",
    resourceCard: {
      titre: "10 cas d'usage de Claude en droit",
      description:
        "Les prompts, le paramétrage du compte, les précautions liées au secret professionnel.",
      meta: "Guide gratuit · aucun connecteur, aucune compétence technique",
    },
    points: [
      {
        titre: "Analyse et comparaison de contrats",
        description: "les prompts à copier tels quels",
      },
      {
        titre: "Rédaction à partir de vos propres modèles",
        description: "sans qu'ils soient réécrits",
      },
      {
        titre: "Le paramétrage à faire avant de charger un document client",
        description: "entraînement, DPA, rétention",
      },
      {
        titre: "Ce qu'on ne charge jamais",
        description: "et comment anonymiser en amont",
      },
    ],
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/10-cas-d-usage-de-Claude-en-droit-le-param-trage-et-les-pr-cautions-3bec7d01a0e881898436ea4809c4049a",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Guide rédigé par Espoir Mwami — Althoce",
    merci: {
      ctaTitre:
        "Une question sur le paramétrage de votre compte ou sur le cadre RGPD ?",
      ctaTexte: "",
    },
  },

  /* ─────────────────────────────────────────────────────────────
   * 12 skills Claude pour la finance
   * ──────────────────────────────────────────────────────────── */
  "12-skills-claude-finance": {
    slug: "12-skills-claude-finance",
    badge: "GUIDE GRATUIT",
    titre:
      "Un prompt, vous le collez.\nUn skill, vous l'installez une fois.",
    sousTitre:
      "Vous chargez votre balance. Claude reconnaît la situation et applique votre procédure, sans que vous ayez à lui demander.",
    resourceCard: {
      titre: "12 skills Claude pour la finance",
      description: "Les 12 fichiers à copier, l'installation et la méthode.",
      meta: "Lecture estimée : 3 minutes",
    },
    pills: [],
    // Lecteur interne depuis le 15/10/2026 (l'ancienne page Notion reste en ligne pour les premiers inscrits).
    urlRessource: "/g/12-skills-claude-finance",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },

  /* ─────────────────────────────────────────────────────────────
   * Claude × data.gouv — 20 prompts
   * ──────────────────────────────────────────────────────────── */
  "claude-data-gouv-20-prompts": {
    slug: "claude-data-gouv-20-prompts",
    badge: "GUIDE GRATUIT",
    titre:
      "Les données sont publiques depuis des années.\nLe problème, c'est de savoir où chercher.",
    sousTitre:
      "Ratios sectoriels, bilans déposés, valeurs foncières, registre des entreprises. Tout est sur data.gouv.fr, gratuitement. Encore faut-il connaître le catalogue.",
    resourceCard: {
      titre: "Claude × data.gouv : 20 prompts pour exploiter les données publiques",
      description:
        "Le connecteur officiel, l'installation en 2 minutes, et les prompts prêts à copier.",
      meta: "Guide gratuit",
    },
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/Claude-data-gouv-20-prompts-pour-exploiter-les-donn-es-publiques-3ccc7d01a0e881098c94f3a4e67310a0",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },

  /* ─────────────────────────────────────────────────────────────
   * 12 agents IA pour la direction financière
   * ──────────────────────────────────────────────────────────── */
  "12-agents-ia-direction-financiere": {
    slug: "12-agents-ia-direction-financiere",
    badge: "GUIDE GRATUIT",
    titre:
      "Vos données sortent déjà de votre ERP.\nC'est tout ce dont vous avez besoin.",
    sousTitre:
      "Pas de projet d'intégration. Pas de ticket DSI.\nVous exportez, vous chargez, l'agent s'active.",
    resourceCard: {
      titre: "12 agents IA pour votre direction financière",
      description: "Les fichiers, le paramétrage, la conformité.",
      meta: "Guide gratuit",
    },
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/12-agents-IA-pour-votre-direction-financi-re-les-fichiers-le-param-trage-et-la-conformit-3cfc7d01a0e8817281a3c36a0c8e7f5e",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },

  /* ─────────────────────────────────────────────────────────────
   * Les 7 chantiers — intégrer l'IA dans un cabinet
   * ──────────────────────────────────────────────────────────── */
  "7-chantiers-ia-cabinet": {
    slug: "7-chantiers-ia-cabinet",
    badge: "GUIDE GRATUIT",
    titre: "L'outil n'est jamais le problème.\nC'est ce qu'on met autour.",
    sousTitre:
      "Trois collaborateurs, trois méthodes, trois comptes.\nDes gains individuels, rien au niveau du cabinet.",
    resourceCard: {
      titre: "Intégrer l'IA dans un cabinet : les 7 chantiers, dans l'ordre",
      description: "Aucun n'est technique. Tous relèvent de l'organisation.",
      meta: "Guide gratuit",
    },
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/Int-grer-l-IA-dans-un-cabinet-les-7-chantiers-dans-l-ordre-3d8c7d01a0e8812ba6e2ffcdee9c7dc0",
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
  },
};

export function getRessource(slug: string): Ressource | undefined {
  return RESSOURCES[slug];
}

export function getAllSlugs(): string[] {
  return Object.keys(RESSOURCES);
}
