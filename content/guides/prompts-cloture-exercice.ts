/**
 * « 10 prompts pour préparer la clôture » : ressource en accès libre, sans formulaire
 * (lecteur /g/10-prompts-cloture-exercice). Post LinkedIn experts-comptables du 18/11/2026,
 * mot clé CLÔTURE, lien court cl1. Sujet proposé par la veille du 16/11/2026 (veille/2026-11-16.md),
 * validé par Espoir le 17/11/2026.
 *
 * Aucun fait daté ni chiffré : les prompts ne citent ni échéance fiscale, ni seuil réglementaire.
 * Les seuils sont entre [crochets], à fixer par le cabinet. Jamais le mot « FEC ».
 * L'audit d'installation gratuit se réserve sur la page même (agenda de la page /rdv/audit-connecteurs,
 * intégré en bas de page, demande d'Espoir du 18/11/2026).
 */
import type { IconName } from "@/components/icons/lucide";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, "\u00a0$1")
    .replace(/« /g, "«\u00a0")
    .replace(/(\d) (\d{3})\b/g, "$1\u00a0$2");
}

export type ClotureFamily = "preparer" | "controler" | "conclure";

export interface ClotureFamilyInfo {
  id: ClotureFamily;
  label: string;
  icon: IconName;
  note?: string;
}

export interface CloturePrompt {
  number: string;
  family: ClotureFamily;
  title: string;
  /** Ce que le prompt produit, en une phrase */
  result: string;
  prompt: string;
}

const prompts: CloturePrompt[] = [
  {
    number: "01",
    family: "preparer",
    title: "Établir la liste des travaux de clôture du dossier",
    result: "La liste des travaux propres à ce dossier, ce qui est déjà fait et ce qui reste, avec l'ordre de passage.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Exercice clos le [JJ/MM/AAAA].
Récupère la balance à date et celle de l'exercice précédent.
À partir des comptes mouvementés, établis la liste des travaux de clôture propres à ce dossier : rapprochement bancaire, stocks, immobilisations et amortissements, charges à payer, produits à recevoir, charges et produits constatés d'avance, créances douteuses, emprunts, comptes d'attente, TVA, social.
Pour chaque travail : ce que montrent déjà les écritures (fait, partiel, à faire), les comptes concernés, la pièce à obtenir.
Présente un tableau trié par ordre de passage. N'invente aucun montant : si une information manque, écris « à obtenir ».`,
  },
  {
    number: "02",
    family: "preparer",
    title: "Demander les pièces de clôture au client",
    result: "Un email clair au dirigeant, avec la liste des pièces propres à son dossier et une date de retour.",
    prompt: `Dossier [NOM DU DOSSIER]. Exercice clos le [JJ/MM/AAAA]. Interlocuteur : [NOM DU DIRIGEANT].
À partir de la balance et des mouvements de l'exercice dans [LOGICIEL], liste les pièces dont j'ai besoin pour la clôture, seulement celles qui concernent ce dossier : relevés bancaires et d'emprunt à la date de clôture, état des stocks, factures d'immobilisations de l'exercice, factures de [MOIS SUIVANT LA CLÔTURE] qui concernent l'exercice, contrats et abonnements payés d'avance, créances clients en litige, éléments de paie de fin d'année.
Rédige un email au dirigeant : une phrase d'introduction, la liste numérotée des pièces avec une ligne d'explication chacune, la date de retour souhaitée : [DATE].
Ton professionnel et simple, sans jargon. C'est un brouillon à relire : n'envoie rien.`,
  },
  {
    number: "03",
    family: "preparer",
    title: "Repérer les dossiers à préparer en priorité",
    result: "Vos dossiers classés du plus en retard au plus avancé, avec ce qui bloque chacun.",
    prompt: `Dossiers : [LISTE DES DOSSIERS CLOS AU JJ/MM/AAAA], dans [LOGICIEL].
Pour chaque dossier, regarde :
1. la date de la dernière écriture et des dernières transactions bancaires rapprochées ;
2. le nombre de transactions non catégorisées ou non rapprochées ;
3. le solde des comptes d'attente ;
4. les factures d'achat sans fournisseur affecté.
Classe les dossiers du plus en retard au plus avancé.
Présente un tableau : dossier | dernière écriture | transactions à traiter | comptes d'attente | point bloquant | action à lancer cette semaine.
Commence par [10] dossiers et montre-moi le résultat avant d'élargir.`,
  },
  {
    number: "04",
    family: "controler",
    title: "Rapprocher la banque à la date de clôture",
    result: "Le solde comptable rapproché du relevé, et chaque écart expliqué ligne par ligne.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date de clôture : [JJ/MM/AAAA]. Compte bancaire : [512…].
Récupère le solde du compte bancaire en comptabilité à cette date et le solde du relevé bancaire à la même date [SOLDE DU RELEVÉ, si tu n'y as pas accès].
Liste les opérations qui expliquent l'écart : chèques émis non encaissés, remises non créditées, prélèvements ou virements non comptabilisés, écritures en double.
Présente l'état de rapprochement : solde comptable | opérations en suspens, une par ligne | solde bancaire | écart restant.
S'il reste un écart non expliqué, dis-le clairement et indique les lignes à vérifier. Ne passe aucune écriture.`,
  },
  {
    number: "05",
    family: "controler",
    title: "Recenser les charges à payer et les factures non parvenues",
    result: "Les charges de l'exercice payées ou facturées après la clôture, avec l'écriture proposée pour chacune.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date de clôture : [JJ/MM/AAAA].
Récupère les factures d'achat et les paiements des [2] mois qui suivent la clôture.
Repère ceux qui concernent l'exercice clos : période de prestation, date de livraison ou libellé qui renvoie à l'exercice. Ajoute les charges récurrentes de l'exercice (loyers, énergie, télécoms, honoraires) dont la dernière échéance manque.
Présente un tableau : fournisseur | pièce | date | montant HT | période concernée | compte de charge | indice | niveau de confiance.
Propose l'écriture de charges à payer correspondante, à valider. Ne passe rien dans le logiciel.`,
  },
  {
    number: "06",
    family: "controler",
    title: "Calculer les charges et produits constatés d'avance",
    result: "Les contrats à cheval sur deux exercices, avec le calcul au prorata et la part à reporter.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date de clôture : [JJ/MM/AAAA].
Repère dans les charges de l'exercice les montants qui couvrent une période postérieure à la clôture : assurances, loyers, abonnements, licences, maintenance, contrats annuels. Fais de même pour les produits facturés d'avance.
Pour chacun, calcule au prorata des jours la part qui concerne l'exercice suivant.
Présente un tableau : tiers | pièce | montant HT | période couverte | jours après clôture | part constatée d'avance | compte.
Ne retiens que les montants supérieurs à [SEUIL EN €]. Montre ton calcul pour chaque ligne et marque « à confirmer » quand la période couverte n'est pas écrite sur la pièce.`,
  },
  {
    number: "07",
    family: "controler",
    title: "Contrôler les immobilisations et les amortissements",
    result: "Les acquisitions et cessions de l'exercice, les achats passés en charges à vérifier et les dotations à recalculer.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Exercice du [JJ/MM/AAAA] au [JJ/MM/AAAA].
1. Liste les acquisitions et cessions d'immobilisations de l'exercice (comptes 2), avec date, montant et mode d'amortissement s'il est renseigné.
2. Repère dans les comptes de charges les achats supérieurs à [SEUIL EN € HT] qui ressemblent à du matériel, du mobilier ou un logiciel durable.
3. Recalcule la dotation de l'exercice pour chaque immobilisation, au prorata de la date de mise en service, et compare-la au montant comptabilisé.
Présente trois tableaux : mouvements de l'exercice | achats à vérifier | dotations (calculée, comptabilisée, écart).
Les durées d'amortissement sont celles du dossier : si l'une manque, demande-la au lieu de la supposer.`,
  },
  {
    number: "08",
    family: "controler",
    title: "Repérer les créances clients douteuses",
    result: "Les créances anciennes ou en litige, classées par risque, avec la pièce qui justifierait une dépréciation.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Date de clôture : [JJ/MM/AAAA].
Récupère les créances clients non lettrées à cette date et les règlements reçus depuis.
Classe-les par ancienneté : moins de 90 jours, 90 à 180 jours, plus de 180 jours. Retire celles réglées après la clôture.
Pour les autres, signale les indices de risque : relances restées sans réponse, échéancier non tenu, client en difficulté connue du dossier, litige noté dans les libellés.
Présente un tableau : client | facture | date | montant TTC | ancienneté | réglé depuis | indice de risque | pièce à obtenir pour justifier une dépréciation.
Ne fixe aucun taux de dépréciation : c'est une décision à prendre avec le dirigeant.`,
  },
  {
    number: "09",
    family: "conclure",
    title: "Faire la revue analytique avant le bilan",
    result: "Les postes qui varient fortement par rapport à N-1, expliqués par les écritures, et ce qui reste à justifier.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Exercice clos le [JJ/MM/AAAA], comparé à l'exercice précédent.
Récupère le bilan et le compte de résultat des deux exercices, après les écritures de clôture déjà passées.
Pour chaque poste dont l'écart dépasse [10 %] et [5 000 €], cherche l'explication dans les écritures : opérations ponctuelles, nouveaux tiers, écritures de clôture.
Calcule aussi les grands ratios des deux exercices : marge brute, poids des charges de personnel, délais clients et fournisseurs.
Présente le tableau des écarts significatifs avec leur explication, puis la liste de ce qui reste à justifier avant de valider le bilan.
Distingue toujours ce que montrent les écritures de ce que tu supposes.`,
  },
  {
    number: "10",
    family: "conclure",
    title: "Préparer le point de clôture avec le dirigeant",
    result: "Une page pour le rendez-vous : résultat provisoire, points en suspens, décisions à prendre et questions à poser.",
    prompt: `Dossier [NOM DU DOSSIER], dans [LOGICIEL]. Rendez-vous de clôture avec [NOM DU DIRIGEANT] le [DATE].
À partir des écritures de l'exercice et des travaux de clôture déjà passés, prépare une page :
- le résultat provisoire et son évolution par rapport à N-1, en 3 lignes ;
- les points encore en suspens (pièces manquantes, écarts non expliqués) ;
- les décisions qui reviennent au dirigeant (dépréciations, stocks, litiges, affectation du résultat) ;
- 5 questions à lui poser sur l'exercice et sur les événements postérieurs à la clôture.
Langage simple, sans jargon comptable. N'affirme rien qui ne soit pas dans les données : marque « à confirmer » ce qui l'est.`,
  },
];

export const PROMPTS_CLOTURE = {
  slug: "10-prompts-cloture-exercice",
  metaTitle: "10 prompts pour préparer la clôture",
  metaDescription: fr(
    "Les 10 prompts pour préparer la clôture d'un dossier : liste des travaux, pièces à demander, contrôles de cut-off, immobilisations, créances, revue analytique. Accès libre."
  ),
  eyebrow: "Ressource gratuite · 10 prompts",
  /** <accent>…</accent> = mot mis en avant (bleu du site) ; accroche du post */
  title: "La clôture se prépare <accent>avant le rush, pas pendant.</accent>",
  subtitle: fr(
    "Les 10 prompts pour préparer la clôture d'un dossier : la liste des travaux, les pièces à demander, les contrôles de fin d'exercice et le point avec le dirigeant."
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
      text: fr("Nom du dossier, date de clôture, seuils de votre cabinet : le reste du prompt ne change pas."),
    },
    {
      icon: "shieldCheck",
      title: "Un compte professionnel",
      text: fr("Pour des données clients, une offre professionnelle de votre IA, avec un accord de traitement des données."),
    },
  ] satisfies readonly { icon: IconName; title: string; text: string }[],
  families: [
    { id: "preparer", label: "Préparer", icon: "scanSearch" },
    { id: "controler", label: "Contrôler", icon: "receipt" },
    { id: "conclure", label: "Conclure", icon: "messageSquareText" },
  ] satisfies readonly ClotureFamilyInfo[],
  prompts: prompts.map((p) => ({ ...p, title: fr(p.title), result: fr(p.result), prompt: fr(p.prompt) })),
  /** Garantie : l'IA propose, le cabinet valide */
  guarantee: fr("Votre IA prépare, vous relisez et vous validez. Aucune écriture ne passe sans votre accord."),
  /** Aller plus loin : le connecteur sur mesure en écriture, présenté pendant l'audit */
  further: {
    title: fr("Aller plus loin : que votre IA prépare les écritures dans votre logiciel"),
    text: fr(
      "Avec un connecteur sur mesure en écriture, les charges à payer, les charges constatées d'avance et les dotations proposées par ces prompts sont préparées directement dans le dossier. Vous relisez, vous validez."
    ),
  },
  /** Agenda repris de cette page de rendez-vous */
  rdvSlug: "audit-connecteurs",
  author: "Espoir Mwami",
} as const;
