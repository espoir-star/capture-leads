/**
 * « 10 prompts pour un mois de production » : ressource en accès libre, sans
 * formulaire (lecteur /g/10-prompts-production-cabinet). Texte du post LinkedIn
 * fourni par Espoir le 02/11/2026 : 10 prompts en 4 familles, puis le connecteur
 * qui écrit. Les appels à l'action mènent à l'inscription au webinar du 05/11/2026,
 * puis, une fois les inscriptions closes, à l'audit d'installation (/rdv/audit-connecteurs).
 *
 * Faits : MCP Pennylane officiel en lecture seule « pour le moment » (pennylane.com/fr/mcp,
 * revérifié le 02/11/2026) ; logiciels en écriture ou sur mesure validés par Espoir le
 * 28/10/2026 (config/rdvPages.ts, repris tel quel) ; temps gagné = texte du post.
 * Aucune mention du fichier FEC, aucun replay annoncé (objectif : présence en direct).
 * Prompts repris du guide Pennylane (content/guides/claude-pennylane.ts) et rendus
 * indépendants du logiciel ; ceux de la saisie sont nouveaux.
 */
import type { IconName } from "@/components/icons/lucide";
import type { Utm } from "@/lib/tracking/utm";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

export type PromptFamily = "controle" | "saisie" | "analyse" | "client";

export interface ProductionPrompt {
  number: string;
  family: PromptFamily;
  /** Titre repris du post */
  title: string;
  /** Ce que le prompt produit, en une phrase */
  result: string;
  prompt: string;
}

const prompts: ProductionPrompt[] = [
  {
    number: "01",
    family: "controle",
    title: "Repérer les anomalies de la balance avant la révision",
    result: "Soldes de sens anormal, variations fortes, comptes nouveaux : ce qu'il faut regarder, par priorité.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Exercice du [JJ/MM/AAAA] au [JJ/MM/AAAA].
Récupère la balance de cet exercice et celle de l'exercice précédent.
Repère ce qui doit être vérifié avant la révision :
- les comptes dont le sens du solde est anormal pour leur nature (client créditeur, fournisseur débiteur, banque ou caisse créditrice…) ;
- les variations fortes par rapport à N-1 ;
- les comptes mouvementés pour la première fois, ou soldés alors qu'ils étaient significatifs ;
- les soldes ronds ou inhabituels.
Présente un tableau : priorité (haute, moyenne, basse) | compte | libellé | solde N | solde N-1 | ce qui pose question | justificatif à demander.
N'invente aucun montant. Ne conclus jamais qu'un compte est faux : signale ce qui mérite vérification.`,
  },
  {
    number: "02",
    family: "controle",
    title: "Lister les comptes d'attente non soldés",
    result: "Chaque compte 47 avec les lignes qui composent son solde, les plus anciennes en premier.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date d'arrêté : [JJ/MM/AAAA].
Liste les comptes d'attente et transitoires (classe 47) qui ont un solde à cette date.
Pour chacun, récupère les lignes d'écritures qui composent le solde : date, journal, libellé, montant.
Présente un tableau : compte | solde | nombre de lignes | ligne la plus ancienne | montant de plus de 90 jours | imputation probable (à confirmer).
Termine par les 5 lignes à traiter en priorité. Les imputations sont des pistes : ne présente aucune écriture comme définitive.`,
  },
  {
    number: "03",
    family: "controle",
    title: "Vérifier la cohérence de la TVA",
    result: "Déclarations, comptes de TVA et chiffre d'affaires rapprochés : écarts chiffrés et pistes d'explication.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Période : [MOIS OU TRIMESTRE].
1. Récupère les déclarations de TVA de la période (montant, statut, échéance).
2. Récupère les soldes et mouvements des comptes de TVA (445) et des comptes de produits (70) sur la même période.
3. Rapproche le chiffre d'affaires de la TVA collectée, taux par taux si les sous-comptes le permettent, puis la TVA déductible des achats et des immobilisations.
Présente les écarts en valeur et en pourcentage, avec les explications possibles : autoliquidation, exonérations, opérations intracommunautaires, TVA non déductible, décalage d'exigibilité sur les prestations de services.
Ne conclus pas à une erreur : liste ce qu'il faut vérifier, avec les écritures concernées.`,
  },
  {
    number: "04",
    family: "saisie",
    title: "Proposer une catégorie pour chaque transaction du mois",
    result: "Chaque transaction avec sa catégorie proposée, la raison et un niveau de confiance. Les cas douteux à part.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Mois : [MOIS ET ANNÉE].
Récupère les transactions bancaires du mois qui ne sont pas encore catégorisées.
Pour chacune, propose une catégorie (compte de charge ou de produit) en t'appuyant sur :
- le libellé bancaire et le montant ;
- la façon dont les transactions du même tiers ont été catégorisées dans ce dossier ;
- le plan comptable du dossier.
Présente un tableau : n° | date | libellé | montant | catégorie proposée | compte | niveau de confiance | raison.
Regroupe à la fin les transactions que tu ne sais pas catégoriser, avec la question à poser au client.
N'écris rien dans le logiciel : je relis et je valide d'abord.`,
  },
  {
    number: "05",
    family: "saisie",
    title: "Retrouver le bon fournisseur pour chaque facture",
    result: "Chaque facture rapprochée de son fournisseur, avec l'indice qui le justifie. Fournisseurs absents et doublons signalés.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Période : [MOIS ET ANNÉE].
Récupère les factures d'achat de la période sans fournisseur affecté, ou dont le fournisseur semble incorrect.
Pour chacune, propose le fournisseur à affecter en comparant :
- le nom, le SIREN ou le numéro de TVA lus sur la facture, s'ils y figurent ;
- les fournisseurs déjà créés dans le dossier (nom, variantes d'écriture, compte fournisseur) ;
- les paiements bancaires du même montant.
Présente un tableau : n° | facture | date | montant TTC | fournisseur proposé | compte | indice utilisé | niveau de confiance.
Signale à part les fournisseurs qui n'existent pas encore dans le dossier, et les doublons possibles (le même fournisseur créé deux fois).
N'écris rien dans le logiciel : je relis et je valide d'abord.`,
  },
  {
    number: "06",
    family: "saisie",
    title: "Préparer le lettrage et lister ce qui reste ouvert",
    result: "Les rapprochements facture ↔ règlement proposés, puis tout ce qui reste ouvert, par ancienneté.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date d'arrêté : [JJ/MM/AAAA].
Récupère les écritures non lettrées des comptes clients (411) et fournisseurs (401).
Propose les rapprochements facture ↔ règlement :
- même tiers et même montant ;
- règlements partiels, ou groupés sur plusieurs factures ;
- petits écarts (escompte, frais bancaires, arrondis), signalés à part.
Présente deux tableaux :
1. les lettrages proposés : n° | compte | tiers | facture(s) | règlement(s) | écart | niveau de confiance ;
2. ce qui reste ouvert : compte | tiers | pièce | date | montant | ancienneté.
Si une information de lettrage n'est pas disponible, dis-le au lieu de la supposer. Ne lettre rien sans ma validation.`,
  },
  {
    number: "07",
    family: "analyse",
    title: "Comparer N et N-1 avec les écarts expliqués",
    result: "Chaque écart significatif expliqué à partir des écritures, avec ce qui reste à confirmer.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Exercices : [N] et [N-1].
Récupère le compte de résultat et le bilan des deux exercices.
Pour chaque poste : montant N, montant N-1, écart en valeur et en pourcentage.
Pour chaque écart supérieur à [10 %] et à [5 000 €], cherche l'explication dans les écritures du poste : principales lignes, nouveaux tiers, opérations ponctuelles. Indique ce qui reste à confirmer avec le client.
Présente le tableau des écarts significatifs, puis une synthèse en 5 lignes.
Distingue toujours ce que montrent les écritures de ce que tu supposes.`,
  },
  {
    number: "08",
    family: "analyse",
    title: "Repérer les clients dont la trésorerie se tend",
    result: "Vos dossiers classés du plus tendu au moins tendu, avec le signal et la question à poser au dirigeant.",
    prompt: `Dossiers : [LISTE DES DOSSIERS, OU TOUT LE PORTEFEUILLE SI VOTRE CONNEXION LE PERMET], dans [LOGICIEL]. Période : les 6 derniers mois.
Pour chaque dossier, à partir des transactions bancaires :
1. calcule la trésorerie en fin de mois et son évolution sur les 3 derniers mois ;
2. compare les encaissements et les décaissements, mois par mois ;
3. relève les factures clients échues non payées, et les factures fournisseurs à payer dans les 30 prochains jours si elles figurent dans le dossier.
Classe les dossiers du plus tendu au moins tendu : trésorerie en baisse continue, solde qui ne couvre pas les paiements à venir, encaissements qui ralentissent.
Présente un tableau : dossier | trésorerie fin de mois | évolution sur 3 mois | à payer sous 30 jours | signal | question à poser au dirigeant.
Commence par [10] dossiers et montre-moi le résultat avant d'élargir. Signale les comptes bancaires non synchronisés et les transactions non rapprochées qui faussent la lecture.`,
  },
  {
    number: "09",
    family: "client",
    title: "Préparer un rendez-vous à partir des chiffres du dossier",
    result: "Une fiche d'une page : chiffres clés, évolutions, points de vigilance et questions à poser.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Rendez-vous avec [NOM DU DIRIGEANT] le [DATE], objet : [OBJET].
Récupère le bilan et le compte de résultat du dernier exercice clos, l'exercice en cours à date, la trésorerie des 3 derniers mois, les factures clients en retard et l'état des déclarations (TVA, liasse fiscale).
Prépare une fiche d'une page :
- les 5 chiffres à connaître ;
- ce qui a changé depuis le dernier exercice ;
- 3 points de vigilance ;
- 5 questions à poser au dirigeant ;
- les documents à lui demander.
N'affirme rien qui ne soit pas dans les données : marque « à confirmer » ce qui l'est.`,
  },
  {
    number: "10",
    family: "client",
    title: "Rédiger les relances d'impayés, prêtes à relire",
    result: "Les factures échues classées par retard et montant, et un brouillon de relance par client.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date du jour : [JJ/MM/AAAA].
Liste les factures clients non payées dont l'échéance est dépassée de plus de [30] jours : client, numéro, date, échéance, reste dû, jours de retard. Classe-les par retard, puis par montant.
Pour chaque client, rédige un brouillon d'email de relance :
- courtois jusqu'à 60 jours de retard, plus ferme au-delà ;
- factures concernées et montant total rappelés précisément ;
- proposition de régularisation ou d'échéancier ;
- aucune pénalité ni mise en demeure sans mon accord.
Ce sont des brouillons à relire : n'envoie rien.`,
  },
];

export const PROMPTS_PRODUCTION = {
  slug: "10-prompts-production-cabinet",
  metaTitle: "10 prompts pour un mois de production",
  metaDescription: fr(
    "Les 10 prompts d'un mois de production en cabinet, du contrôle à la relance client, et la méthode pour brancher un connecteur qui écrit dans votre logiciel. Accès libre."
  ),
  eyebrow: "Ressource gratuite · 10 prompts",
  /** <accent>…</accent> = mot mis en avant (bleu du site) ; phrase d'accroche du post */
  title: "Une matinée de production par dossier, <accent>ramenée à quelques minutes de relecture.</accent>",
  subtitle: fr(
    "Les 10 prompts que j'utilise pour la production d'un mois, du contrôle à la relance client. Puis la méthode pour que votre IA écrive directement dans votre logiciel."
  ),
  promises: ["Sans inscription", "Prompts prêts à copier", "Claude, ChatGPT ou une autre IA"],
  before: [
    {
      icon: "plug",
      title: "Votre IA branchée au dossier",
      text: fr("Activez le connecteur de votre logiciel dans la conversation, ou joignez l'export utile : balance, grand livre, relevé bancaire."),
    },
    {
      icon: "brackets",
      title: "Les [crochets] à remplacer",
      text: fr("Nom du dossier tel qu'il apparaît dans votre logiciel, période, seuils : le reste du prompt ne change pas."),
    },
    {
      icon: "shieldCheck",
      title: "Un compte professionnel",
      text: fr("Pour des données clients, une offre professionnelle de votre IA, avec un accord de traitement des données."),
    },
  ] satisfies readonly { icon: IconName; title: string; text: string }[],
  families: [
    { id: "controle", label: "Contrôle", icon: "scanSearch" },
    { id: "saisie", label: "Saisie", icon: "receipt", note: fr("Avec un connecteur qui écrit, ces trois-là sont préparés directement dans le logiciel : il ne vous reste qu'à valider.") },
    { id: "analyse", label: "Analyse", icon: "trendingUp" },
    { id: "client", label: "Relation client", icon: "messageSquareText" },
  ] satisfies readonly { id: PromptFamily; label: string; icon: IconName; note?: string }[],
  prompts: prompts.map((p) => ({ ...p, result: fr(p.result), prompt: fr(p.prompt) })),
  /** La seconde moitié du travail, texte du post */
  halfWork: {
    title: "Un prompt seul ne fait que la moitié du travail",
    alone: {
      label: "Prompt seul",
      title: "Votre IA propose",
      text: fr("Elle vous dit quelle catégorie mettre, quel fournisseur affecter, quoi lettrer. Ensuite, quelqu'un doit encore tout ressaisir dans le logiciel."),
    },
    writer: {
      label: "Avec un connecteur qui écrit",
      title: "Votre IA prépare le travail dans votre logiciel",
      done: ["Les transactions sont catégorisées", "Les tiers sont affectés", "Le lettrage est préparé"],
      text: "Vous ouvrez le dossier, vous relisez, vous validez.",
    },
    promise: "Plus de ressaisie. Et rien n'entre dans le dossier sans votre accord.",
  },
  /** Prompt qui suit la relecture d'un prompt de saisie (tableaux numérotés) */
  applyPrompt: {
    title: "Après votre relecture, le prompt qui applique",
    text: fr("À utiliser avec un connecteur qui écrit, sur le tableau numéroté d'un prompt de saisie."),
    prompt: fr(`Applique dans [LOGICIEL] uniquement les lignes que j'ai validées : [NUMÉROS DES LIGNES, OU « TOUTES SAUF 4 ET 7 »].
Avant chaque écriture, vérifie que la ligne n'a pas changé depuis ta proposition.
Ensuite, récapitule ce qui a été écrit et ce qui reste à traiter.`),
  },
  method: {
    title: "Brancher un connecteur qui écrit, en quatre étapes",
    steps: [
      {
        title: "Vérifiez ce que votre logiciel permet",
        text: fr("Lecture, écriture, ou les deux : tout dépend des accès que l'éditeur ouvre. Le point logiciel par logiciel est juste en dessous."),
      },
      {
        title: "Prenez un compte IA professionnel",
        text: fr("Claude ou ChatGPT, sur une offre professionnelle avec un accord de traitement des données : vous travaillez sur des dossiers clients."),
      },
      {
        title: "Gardez la main sur chaque écriture",
        text: fr("Dans Claude, chaque type d'action se règle : autorisé, soumis à votre validation ou bloqué. Dans ChatGPT, les écritures demandent une confirmation par défaut."),
      },
      {
        title: "Commencez par une tâche, sur un dossier",
        text: fr("Les transactions du mois, par exemple. Vous relisez, vous validez, puis vous élargissez aux autres tâches et aux autres dossiers."),
      },
    ],
    /** Phrase du post, en tête de la liste des logiciels */
    coverage: fr("Ça marche sur Pennylane, et sur la plupart des autres logiciels de production, lorsque les accès le permettent."),
  },
  /** Provenance de l'inscription quand la visite n'a pas d'UTM (lien partagé, accès direct) */
  fallbackUtm: { utm_source: "althoce", utm_medium: "ressource", utm_content: "ressource_10_prompts" } satisfies Utm,
  webinarSlug: "connecteurs-mcp-cabinets",
  /** Repli après le direct : l'audit d'installation gratuit */
  rdvSlug: "audit-connecteurs",
  /** Campagnes des liens courts wb1 et au1, pour regrouper les inscriptions */
  campaigns: { webinar: "webinar_connecteurs_mcp_20261105", rdv: "audit_installation_connecteurs" },
  author: "Espoir Mwami",
} as const;
