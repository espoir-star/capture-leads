/**
 * Mini-diagnostic IA (ressource des newsletters, pas une page de capture).
 * Sources vérifiées le 18 octobre 2026. Le score aide à choisir un premier test :
 * ce n'est ni une estimation financière ni un diagnostic professionnel.
 * Les réponses restent dans le navigateur : aucun envoi, aucun enregistrement.
 */

export const MINI_DIAGNOSTIC = {
  slug: "mini-diagnostic-ia-finance",
  edition: "18 octobre 2026",
  examples: [
    "Collecte et suivi de documents manquants",
    "Préparation de reportings et synthèses financières",
    "Préparation des rendez-vous et réunions clients",
  ],
  criteria: [
    {
      id: "frequency",
      label: "Fréquence",
      question: "À quelle fréquence la tâche revient-elle ?",
      levels: ["Une fois par mois ou moins", "Chaque semaine", "Chaque jour"],
    },
    {
      id: "repetition",
      label: "Répétitivité",
      question: "Suit-elle toujours les mêmes étapes ?",
      levels: ["Différente à chaque fois", "En partie standard", "Toujours les mêmes étapes"],
    },
    {
      id: "data",
      label: "Données",
      question: "Les informations nécessaires sont-elles disponibles ?",
      levels: ["Dispersées ou sur papier", "Numériques mais hétérogènes", "Structurées et accessibles avec autorisation"],
    },
    {
      id: "control",
      label: "Complexité, confidentialité et contrôles",
      question: "Le résultat est-il facile à vérifier et peu sensible ?",
      levels: ["Données très sensibles ou décision engageante", "Contrôle à organiser", "Facile à vérifier, données peu sensibles"],
    },
  ],
  cases: [
    {
      title: "Collecte de documents",
      ai: "Comparer la liste des pièces attendues avec les documents reçus, repérer les manquants et préparer des relances en brouillon.",
      prerequisites: "Une liste de pièces attendues par dossier et un accès autorisé aux documents reçus.",
      human: "Chaque relance est relue et validée avant envoi.",
    },
    {
      title: "Reporting financier",
      ai: "Réunir les indicateurs disponibles dans des sources autorisées, signaler les variations importantes et préparer une synthèse contrôlable.",
      prerequisites: "Des sources identifiées et des définitions d'indicateurs écrites (période, périmètre, règle de calcul).",
      human: "Les chiffres et le commentaire sont vérifiés avant diffusion.",
    },
    {
      title: "Rendez-vous client",
      ai: "Préparer un ordre du jour, puis un projet de compte rendu (décisions, tâches, points à clarifier) à partir d'informations autorisées.",
      prerequisites: "Des notes ou une transcription que vous êtes autorisé à utiliser, et un modèle de compte rendu.",
      human: "Le responsable vérifie décisions et engagements avant diffusion.",
    },
  ],
  roadmap: [
    { id: "process", question: "Quel processus tester ?", short: "Processus à tester", hint: "Le candidat le mieux noté à l'étape 2." },
    { id: "data", question: "Quelles données ou applications sont nécessaires ?", short: "Données et applications nécessaires", hint: "Ex. : liste des pièces attendues, export du logiciel, dossier partagé." },
    { id: "validator", question: "Qui doit valider les résultats ?", short: "Validation des résultats", hint: "Ex. : le chef de mission, le contrôleur de gestion, le DAF." },
    { id: "indicator", question: "Quel indicateur permettra d'évaluer le pilote ?", short: "Indicateur du pilote", hint: "Ex. : temps passé par dossier, délai de production du reporting, nombre de corrections." },
  ],
  sources: [
    {
      label: "CNIL — Les questions-réponses sur l'utilisation d'un système d'IA générative (18 juillet 2024)",
      url: "https://www.cnil.fr/fr/les-questions-reponses-de-la-cnil-sur-lutilisation-dun-systeme-dia-generative",
    },
    {
      label: "CNIL — Utiliser l'IA générative dans les TPE et PME",
      url: "https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme",
    },
  ],
} as const;

export type CriterionId = (typeof MINI_DIAGNOSTIC.criteria)[number]["id"];
/** Note de 1 à 3 par critère ; null tant que le critère n'est pas renseigné */
export type Ratings = Partial<Record<CriterionId, 1 | 2 | 3>>;

export const MAX_SCORE = MINI_DIAGNOSTIC.criteria.length * 3;

/** Somme des quatre notes (4 à 12), ou null si un critère manque. */
export function score(ratings: Ratings): number | null {
  const values = MINI_DIAGNOSTIC.criteria.map((c) => ratings[c.id]);
  return values.every((v) => v !== undefined) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
}

export function band(total: number): { label: string; detail: string } {
  if (total >= 10) return { label: "Bon candidat pour un premier test", detail: "Fréquent, structuré et vérifiable : un pilote limité est envisageable." };
  if (total >= 7) return { label: "Possible après préparation", detail: "Clarifiez d'abord les données ou les contrôles nécessaires." };
  return { label: "À garder pour plus tard", detail: "Peu fréquent, peu structuré ou trop sensible pour un premier essai." };
}

/**
 * Tâche la plus simple à expérimenter en premier : score le plus élevé ;
 * à égalité, la plus facile à contrôler, puis celle dont les données sont prêtes.
 */
export function bestCandidate<T extends { name: string; ratings: Ratings }>(tasks: readonly T[]): T | null {
  const scored = tasks.filter((t) => t.name.trim() && score(t.ratings) !== null);
  if (!scored.length) return null;
  return [...scored].sort((a, b) =>
    (score(b.ratings)! - score(a.ratings)!) ||
    ((b.ratings.control ?? 0) - (a.ratings.control ?? 0)) ||
    ((b.ratings.data ?? 0) - (a.ratings.data ?? 0))
  )[0];
}
