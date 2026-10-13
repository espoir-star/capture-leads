/** Sources primaires vérifiées le 13 octobre 2026. Les exemples sont des modèles à adapter, pas des promesses de connecteurs existants. */
export const CLAUDE_DASHBOARDS_GUIDE = {
  "slug": "tableaux-de-bord-claude-cabinets",
  "title": "3 tableaux de bord Claude pour les cabinets",
  "intro": "Portefeuille, rendez-vous client et radar sectoriel : une méthode courte, trois prompts copiables et des vérifications avant de montrer un chiffre à un client.",
  "steps": [
    [
      "Ouvrir Claude",
      "Dans Artefacts, sélectionnez le modèle Dashboards, ou demandez un tableau de bord dans une conversation."
    ],
    [
      "Connecter une source autorisée",
      "Utilisez un entrepôt de données ou une application réellement compatible et autorisée. Aucun connecteur comptable universel n'est garanti."
    ],
    [
      "Adapter un prompt",
      "Remplacez les espaces entre crochets par le nom de la source, le dossier et les champs disponibles. N'inventez aucun jeu de données."
    ],
    [
      "Vérifier avant usage",
      "Inspectez les requêtes des graphiques, les droits d'accès, les définitions métier et la date de dernière actualisation."
    ]
  ],
  "prompts": [
    {
      "number": "01",
      "id": "portefeuille",
      "title": "Vue portefeuille",
      "subtitle": "Impayés, chiffre d'affaires et données disponibles",
      "before": "Tables de factures clients, échéances, soldes, écritures, dates et droits de consultation.",
      "prompt": "Crée un tableau de bord pour mon portefeuille à partir de [SOURCE AUTORISÉE], en lecture seule. Avant de construire les graphiques, recense les tables et colonnes accessibles, les droits et les dates de mise à jour. Affiche : (1) les créances clients non soldées dont l’échéance est dépassée de plus de 30 jours, par dossier ; (2) le chiffre d’affaires mensuel comparé au même mois de N-1 à périmètre constant ; (3) la TVA à décaisser seulement si une source fiable de déclarations validées est disponible ; (4) la trésorerie seulement si les soldes ou flux datés sont accessibles. Pour chaque mesure, précise la définition, le périmètre, la requête et la dernière actualisation. Si une donnée manque, affiche « Non disponible », sans estimation. Ne modifie aucune donnée et ne produis aucune écriture.",
      "limit": "Une balance seule ne permet pas de conclure au montant de TVA dû ni à la trésorerie disponible."
    },
    {
      "number": "02",
      "id": "rendez-vous",
      "title": "Rendez-vous client",
      "subtitle": "Une vue à ouvrir en entretien, sans conclusion automatique",
      "before": "Dossier explicitement sélectionné, droits appropriés et période de référence définie.",
      "prompt": "Construis un tableau de bord de rendez-vous pour le SEUL dossier [ID DOSSIER] depuis [SOURCE AUTORISÉE]. Affiche le chiffre d’affaires des 12 derniers mois et N-1 si les données sont comparables ; les créances échues par tranches de retard (0–30, 31–60, plus de 60 jours) ; et l’évolution de trésorerie uniquement si des soldes datés sont disponibles. Termine par trois questions à vérifier avec le client, en distinguant faits observés et hypothèses. Affiche sur chaque graphique les règles de calcul, le périmètre, la date des données et la requête vérifiable. Ne mélange pas les dossiers, ne réalise aucun acte comptable ou fiscal et n’invente rien si la source est incomplète.",
      "limit": "Un tableau de bord prépare la discussion ; il ne remplace pas la validation de l’expert-comptable."
    },
    {
      "number": "03",
      "id": "sectoriel",
      "title": "Radar sectoriel",
      "subtitle": "Repères économiques publics, avec leurs dates",
      "before": "Code d'activité, zone et jeux de données publics préalablement identifiés.",
      "prompt": "Crée un radar sectoriel à partir de [SOURCE INSEE ÉSANE ANNUELLE] et, uniquement si elle existe pour ce secteur, [SÉRIE D’ACTIVITÉ MENSUELLE INSEE]. Vérifie d’abord le code de secteur, le champ statistique, l’unité, le millésime et la géographie. Partie A : affiche les ratios annuels disponibles avec leur définition exacte. Partie B : représente 24 mois d’activité seulement si une série mensuelle officielle comparable couvre réellement cette période. Affiche le producteur, la source primaire, la date de publication et les limites. Ne transforme jamais des ratios annuels en données mensuelles, ne comble pas les trous et ne compare pas une entreprise avec un agrégat sectoriel de périmètre incompatible.",
      "limit": "Les ratios Ésane sont annuels ; les indicateurs mensuels portent sur d’autres mesures et ne couvrent pas tous les secteurs."
    }
  ],
  "sources": [
    {
      "label": "Anthropic — annonce Claude Dashboards (8 octobre 2026)",
      "url": "https://claude.com/resources/articles/dashboards-and-motion",
      "detail": "Annonce de la bêta, sources connectées et tableaux de bord."
    },
    {
      "label": "Anthropic — Commencer avec Claude Dashboards",
      "url": "https://support.claude.com/fr/articles/17454700-commencer-avec-claude-dashboards",
      "detail": "Plans Pro/Max/Team/Enterprise, étapes, requêtes visibles et fraîcheur des données."
    },
    {
      "label": "Insee — Ratios sectoriels 2023 (Ésane)",
      "url": "https://www.insee.fr/fr/statistiques/2015421",
      "detail": "Ratios annuels ; ne pas présenter comme des chiffres mensuels ou temps réel."
    },
    {
      "label": "Insee — Indice de production industrielle",
      "url": "https://www.insee.fr/fr/metadonnees/source/indicateur/p1646/presentation",
      "detail": "Exemple de série mensuelle pour les activités couvertes."
    },
    {
      "label": "CNIL — IA générative dans les TPE/PME",
      "url": "https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme",
      "detail": "Précautions de sécurité et de conformité."
    },
    {
      "label": "Anthropic — Addendum de traitement des données (DPA)",
      "url": "https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa",
      "detail": "Vérification du cadre contractuel adapté au traitement envisagé."
    }
  ]
} as const;
