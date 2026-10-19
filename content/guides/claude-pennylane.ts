/**
 * Claude × Pennylane : 10 usages. Sources primaires vérifiées le 19 octobre 2026.
 * Le connecteur officiel (MCP Pennylane) est en lecture seule : les prompts préparent
 * une révision, une analyse ou un brouillon, ils ne valident ni ne modifient rien.
 * Chaque usage ne s'appuie que sur des outils documentés par Pennylane (balance avec
 * comparaison N-1, écritures et lettrage, TVA, factures et paiements, transactions,
 * états financiers, portefeuille du cabinet).
 */

export interface PennylaneUsage {
  number: string;
  title: string;
  family: "production" | "analyse" | "client" | "cabinet";
  /** Ce que l'usage apporte, en une phrase */
  description: string;
  /** Données Pennylane lues par Claude (outils documentés du connecteur) */
  reads: string[];
  /** Condition particulière d'accès, s'il y en a une */
  note?: string;
  prompt: string;
}

const usages: PennylaneUsage[] = [
  {
    number: "01",
    title: "Repérer les anomalies de la balance avant la révision",
    family: "production",
    description: "Sens de solde anormal, variations fortes, comptes nouveaux : ce qu'il faut regarder, classé par priorité.",
    reads: ["Balance de l'exercice", "Comparaison N-1"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Exercice : du [JJ/MM/AAAA] au [JJ/MM/AAAA].
Avec le connecteur Pennylane, récupère la balance de cet exercice avec la comparaison N-1.
Repère ce qui doit être vérifié avant la révision :
- les comptes dont le sens du solde est anormal pour leur nature (client créditeur, fournisseur débiteur, banque ou caisse créditrice…) ;
- les variations fortes par rapport à N-1 ;
- les comptes mouvementés pour la première fois, ou soldés alors qu'ils étaient significatifs ;
- les soldes ronds ou inhabituels.
Présente un tableau : priorité (haute, moyenne, basse) | compte | libellé | solde N | solde N-1 | ce qui pose question | justificatif à demander.
N'invente aucun montant. Ne conclus jamais qu'un compte est faux : signale ce qui mérite vérification et ce que la balance seule ne permet pas de trancher.`,
  },
  {
    number: "02",
    title: "Lister les comptes d'attente non soldés",
    family: "production",
    description: "Chaque compte 47 avec les lignes qui composent son solde, les plus anciennes en premier.",
    reads: ["Balance", "Lignes d'écritures des comptes 47"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Date d'arrêté : [JJ/MM/AAAA].
Avec le connecteur Pennylane, liste les comptes d'attente et transitoires de la classe 47 qui ont un solde à cette date.
Pour chacun, récupère les lignes d'écritures qui composent le solde : date, journal, libellé, montant.
Présente un tableau : compte | solde | nombre de lignes | ligne la plus ancienne | montant de plus de 90 jours | imputation probable (à confirmer).
Termine par les 5 lignes à traiter en priorité. Les imputations sont des pistes : ne présente aucune écriture comme définitive.`,
  },
  {
    number: "03",
    title: "Contrôler la cohérence de la TVA",
    family: "production",
    description: "Déclarations, comptes de TVA et chiffre d'affaires rapprochés : écarts chiffrés et pistes d'explication.",
    reads: ["Déclarations de TVA", "Comptes 445 et 70"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Période : [MOIS OU TRIMESTRE].
Avec le connecteur Pennylane :
1. récupère les déclarations de TVA de la période (montant, statut, échéance) ;
2. récupère les soldes et mouvements des comptes de TVA (445) et des comptes de produits (70) sur la même période ;
3. rapproche le chiffre d'affaires de la TVA collectée, taux par taux si les sous-comptes le permettent, puis la TVA déductible des achats et des immobilisations.
Présente les écarts en valeur et en pourcentage, avec les explications possibles : autoliquidation, exonérations, opérations intracommunautaires, TVA non déductible, décalage d'exigibilité sur les prestations de services.
Ne conclus pas à une erreur : liste ce qu'il faut vérifier, avec les écritures concernées.`,
  },
  {
    number: "04",
    title: "Trouver les comptes à lettrer",
    family: "production",
    description: "Balance et écritures croisées : les factures et règlements qui se correspondent sans être lettrés.",
    reads: ["Balance des comptes 401 et 411", "Écritures et lettrage"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Date d'arrêté : [JJ/MM/AAAA].
Avec le connecteur Pennylane, récupère dans la balance les soldes des comptes clients (411) et fournisseurs (401). Pour les [10] soldes les plus importants, récupère les écritures et leur lettrage.
Identifie :
- les règlements qui ne sont rapprochés d'aucune facture ;
- les factures et règlements de même montant qui ne sont pas lettrés entre eux ;
- les soldes qui ne correspondent à aucune facture ouverte.
Présente un tableau : compte | tiers | solde | lignes non lettrées | rapprochement probable (facture ↔ règlement) | niveau de confiance.
Si le lettrage d'une ligne n'est pas renvoyé, dis-le au lieu de le supposer. Tu proposes, je vérifie et je lettre dans Pennylane.`,
  },
  {
    number: "05",
    title: "Comparer N et N-1 sur tous les postes",
    family: "analyse",
    description: "Chaque écart significatif expliqué à partir des écritures, avec ce qui reste à confirmer.",
    reads: ["Bilan et compte de résultat N et N-1", "Écritures des postes"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Exercices : [N] et [N-1].
Avec le connecteur Pennylane, récupère le compte de résultat et le bilan des deux exercices.
Pour chaque poste : montant N, montant N-1, écart en valeur et en pourcentage.
Pour chaque écart supérieur à [10 %] et à [5 000 €], cherche l'explication dans les écritures du poste : principales lignes, nouveaux tiers, opérations ponctuelles. Indique ce qui reste à confirmer avec le client.
Présente le tableau des écarts significatifs, puis une synthèse en 5 lignes.
Distingue toujours ce que montrent les écritures de ce que tu supposes.`,
  },
  {
    number: "06",
    title: "Suivre la trésorerie et les clients qui se tendent",
    family: "analyse",
    description: "Les flux mois par mois et les clients dont les retards ou l'encours augmentent.",
    reads: ["Transactions bancaires", "Factures et paiements clients"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Période : les 6 derniers mois.
Avec le connecteur Pennylane :
1. récupère les transactions bancaires et calcule, mois par mois, les encaissements, les décaissements et la variation de trésorerie ;
2. récupère les factures clients et leurs paiements. Pour chaque client significatif, compare le délai de paiement moyen des 3 derniers mois à celui des 3 mois précédents ;
3. liste les clients dont les retards s'allongent ou dont l'encours augmente.
Présente un tableau mensuel de trésorerie, puis les clients à surveiller : encours, retard moyen, évolution.
Signale les transactions non rapprochées qui faussent la lecture.`,
  },
  {
    number: "07",
    title: "Préparer un rendez-vous à partir des chiffres du dossier",
    family: "client",
    description: "Une fiche d'une page : chiffres clés, évolutions, points de vigilance et questions à poser.",
    reads: ["Fiche entreprise", "États financiers", "Factures en retard", "Déclarations"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Rendez-vous avec [NOM DU DIRIGEANT] le [DATE], objet : [OBJET].
Avec le connecteur Pennylane, récupère : la fiche de l'entreprise, le bilan et le compte de résultat du dernier exercice clos, l'exercice en cours à date, la trésorerie des 3 derniers mois, les factures clients en retard et l'état des déclarations (TVA, liasse fiscale).
Prépare une fiche d'une page :
- les 5 chiffres à connaître ;
- ce qui a changé depuis le dernier exercice ;
- 3 points de vigilance ;
- 5 questions à poser au dirigeant ;
- les documents à lui demander.
N'affirme rien qui ne soit pas dans les données : marque « à confirmer » ce qui l'est.`,
  },
  {
    number: "08",
    title: "Rédiger les relances d'impayés de plus de 30 jours",
    family: "client",
    description: "Les factures échues classées par retard et montant, et un brouillon de relance par client, prêt à relire.",
    reads: ["Factures clients", "Paiements"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Date du jour : [JJ/MM/AAAA].
Avec le connecteur Pennylane, liste les factures clients non payées dont l'échéance est dépassée de plus de 30 jours : client, numéro, date, échéance, reste dû, jours de retard. Classe-les par retard, puis par montant.
Pour chaque client, rédige un brouillon d'email de relance :
- courtois jusqu'à 60 jours de retard, plus ferme au-delà ;
- factures concernées et montant total rappelés précisément ;
- proposition de régularisation ou d'échéancier ;
- aucune pénalité ni mise en demeure sans mon accord.
Ce sont des brouillons à relire : n'envoie rien.`,
  },
  {
    number: "09",
    title: "Transformer un bilan en note lisible par un dirigeant",
    family: "client",
    description: "Deux pages sans jargon, où chaque chiffre renvoie au poste dont il vient.",
    reads: ["Bilan et compte de résultat N et N-1"],
    prompt: `Dossier Pennylane : [NOM DU DOSSIER]. Exercice : [N].
Avec le connecteur Pennylane, récupère le bilan (actif et passif) et le compte de résultat de l'exercice et de l'exercice précédent.
Rédige une note de deux pages maximum pour un dirigeant qui n'est pas financier :
1. l'année en 5 phrases ;
2. activité et rentabilité : chiffre d'affaires, marge, résultat ;
3. trésorerie et endettement ;
4. ce qui s'est amélioré, ce qui s'est dégradé ;
5. 3 points à discuter ensemble.
Explique chaque terme technique en une phrase et indique pour chaque chiffre le poste d'où il vient. Signale ce qui demande l'avis de l'expert-comptable.`,
  },
  {
    number: "10",
    title: "Voir tous les dossiers qui demandent une action",
    family: "cabinet",
    description: "Échéances de TVA, liasses et transactions à traiter, dossier par dossier, classés par urgence.",
    reads: ["Dossiers du portefeuille", "Déclarations de TVA et liasses", "Transactions à traiter"],
    note: "Connexion cabinet : la liste des dossiers du portefeuille n'existe que pour les comptes cabinet.",
    prompt: `Avec le connecteur Pennylane (connexion cabinet), liste les dossiers clients du portefeuille [FILTRE ÉVENTUEL : TVA MENSUELLE, FORME JURIDIQUE…].
Pour chaque dossier, récupère :
- les déclarations de TVA à venir ou en retard (échéance, statut) ;
- l'état de la liasse fiscale ;
- le nombre de transactions bancaires non traitées.
Classe les dossiers par urgence : échéance dans les 7 jours, retard, volume à traiter.
Présente un tableau : dossier | prochaine échéance | statut | transactions à traiter | action recommandée.
Commence par [10] dossiers et montre-moi le résultat avant d'élargir au portefeuille.`,
  },
];

export const CLAUDE_PENNYLANE_GUIDE = {
  slug: "claude-pennylane",
  title: "Claude × Pennylane : 10 usages",
  edition: "19 octobre 2026",
  intro:
    "Le connecteur s'installe en quelques minutes. Ensuite, la plupart des cabinets lui posent deux questions sur un dossier et s'arrêtent là. Voici 10 usages qui changent vraiment le quotidien, chacun avec son prompt prêt à copier.",
  mcpUrl: "https://mcp.pennylane.com/mcp",
  families: [
    { id: "production", label: "Production" },
    { id: "analyse", label: "Analyse" },
    { id: "client", label: "Relation client" },
    { id: "cabinet", label: "Pilotage du cabinet" },
  ],
  usages,
  sources: [
    {
      label: "Pennylane — MCP Pennylane : connectez vos données à votre IA",
      url: "https://www.pennylane.com/fr/mcp",
      detail: "Cabinets sans surcoût, entreprises à partir de l'abonnement Essentiel ; lecture seule ; types de données activables un par un.",
    },
    {
      label: "Pennylane — Connecter votre assistant IA au MCP Pennylane",
      url: "https://help.pennylane.com/fr/articles/757740-connecter-votre-assistant-ia-au-mcp-pennylane",
      detail: "Étapes dans Claude, droits identiques aux vôtres, suspension par l'administrateur du cabinet, vérifications à faire chez le fournisseur d'IA.",
    },
    {
      label: "Pennylane MCP — documentation technique",
      url: "https://pennylane-mcp.readme.io/docs/getting-started",
      detail: "Adresse du serveur, connexion OAuth, outils (balance avec N-1, écritures et lettrage, TVA, portefeuille), 100 lignes par page, avertissements.",
    },
    {
      label: "Anthropic — Connecteurs personnalisés (MCP distant)",
      url: "https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp",
      detail: "Toutes les offres, l'offre gratuite limitée à un connecteur ; ajout par un propriétaire sur Team et Enterprise ; activation dans la conversation.",
    },
    {
      label: "Anthropic — Addendum de traitement des données (DPA)",
      url: "https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa",
      detail: "Le DPA est intégré aux conditions commerciales (Claude for Work, API).",
    },
    {
      label: "Anthropic — Politique de confidentialité des comptes grand public",
      url: "https://privacy.claude.com/en/articles/10301952",
      detail: "Free, Pro et Max sont des comptes grand public ; Team, Enterprise et l'API relèvent des conditions commerciales.",
    },
  ],
} as const;
