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
  resourceCard?: { titre: string; description?: string; meta: string };
  /** Points détaillés (titre en gras + description). Remplace les pills si présent. */
  points?: { titre: string; description?: string }[];
  /** Encadré d'alerte/insight affiché après les points */
  encadre?: { titre: string; texte: string };
  /** Signature en bas de page (remplace la ligne par défaut) */
  signature?: string;
  /**
   * Personnalisation de la page merci (remplace le titre/texte par défaut).
   * ctaTitre/ctaTexte personnalisent le second bloc (relance call) ;
   * ctaTexte omis = texte par défaut, ctaTexte: "" = pas de texte sous le titre.
   */
  merci?: {
    titre: string;
    texte: string;
    ctaTitre?: string;
    ctaTexte?: string;
  };
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
    brevoListId: 12, // "LM - Guide Claude Droit" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Guide rédigé par Espoir Mwami — Althoce",
    merci: {
      titre: "C'est parti — le guide arrive dans votre boîte mail.",
      texte:
        "Vérifiez vos spams si vous ne le voyez pas dans les deux minutes.",
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
      description: "Les fichiers, l'installation et la méthode.",
      meta: "Guide gratuit",
    },
    pills: [],
    urlRessource:
      "https://espoir-metareglage.notion.site/12-skills-Claude-pour-la-finance-les-fichiers-l-installation-et-la-m-thode-3c0c7d01a0e8810dac7ec917d2a378e8",
    brevoListId: 13, // "LM - 12 skills Claude finance" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
    merci: {
      titre: "C'est parti — le guide arrive dans votre boîte mail.",
      texte:
        "Vérifiez vos spams si vous ne le voyez pas dans les deux minutes.",
    },
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
    brevoListId: 14, // "LM - Claude data.gouv" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
    merci: {
      titre: "C'est parti — le guide arrive dans votre boîte mail.",
      texte:
        "Vérifiez vos spams si vous ne le voyez pas dans les deux minutes.",
    },
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
    brevoListId: 15, // "LM - 12 agents IA direction financière" (dossier Lead Magnets)
    style: "modal",
    cta: "Recevoir le guide",
    signature: "Espoir Mwami — Althoce",
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
