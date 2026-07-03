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
};

export function getRessource(slug: string): Ressource | undefined {
  return RESSOURCES[slug];
}

export function getAllSlugs(): string[] {
  return Object.keys(RESSOURCES);
}
