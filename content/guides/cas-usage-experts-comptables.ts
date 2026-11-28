/**
 * « 15 cas d'usage concrets de Claude pour les experts-comptables » : ressource en
 * accès libre, sans formulaire (lecteur /g/12-cas-usage-experts-comptables ; le slug
 * garde « 12 » pour ne casser ni les liens, ni la liste Brevo, ni les tags).
 *
 * Contenu repris du guide Notion d'Espoir (édité le 12/10/2026), à sa demande du
 * 12/11/2026 : la ressource passe sur une page Althoce, comme les autres guides.
 * Retirés : les liens de réservation de l'ancien Cal.com, le tableau des offres Claude
 * et l'hébergement des données (non revérifiés), le calendrier de la facturation
 * électronique (dates passées) et la mention « finançables OPCO » (non vérifiée).
 * « Compte professionnel » repris des faits vérifiés du guide Pennylane
 * (support.claude.com, 19/10/2026).
 *
 * Enrichi le 28/11/2026 à la demande d'Espoir :
 * - 3 cas de saisie (pièces, banque, lettrage) en tête, avec une mention discrète du
 *   connecteur qui écrit (Althoce) et un lien vers l'agenda de démo ;
 * - les résultats lourds sortent en fichiers propres (Excel, PDF, Word) plutôt qu'en
 *   texte dans la conversation. Création de fichiers par Claude (.xlsx, .docx, .pdf),
 *   activée par défaut : support.claude.com, article 12111783, vérifié le 28/11/2026.
 * Les numéros des cas sont calculés dans l'ordre du tableau.
 */
import type { IconName } from "@/components/icons/lucide";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

export type CasFamily = "saisie" | "production" | "client" | "organisation" | "conseil";

export interface CasUsage {
  /** Calculé : « 01 », « 02 »… dans l'ordre du tableau */
  number: string;
  family: CasFamily;
  title: string;
  /** Ce que ça fait, en une ou deux phrases */
  result: string;
  prompt: string;
  /** Conseil « En pratique » du guide */
  practice: string;
  /** Point de vigilance (affiché avec un triangle) plutôt qu'un simple conseil */
  warning?: boolean;
}

const cases: Omit<CasUsage, "number">[] = [
  {
    family: "saisie",
    title: "Saisir les pièces comptables",
    result: "Claude lit les factures, tickets et notes de frais, contrôle les montants et propose l'écriture de chaque pièce : compte, TVA, tiers. Avec un connecteur qui écrit, il la prépare directement dans votre logiciel.",
    prompt: `Voici les pièces du dossier [CLIENT] pour [PÉRIODE] : [FACTURES D'ACHAT / FACTURES DE VENTE / TICKETS / NOTES DE FRAIS].

Pour chaque pièce :
1. Relève la date, le tiers, le numéro et les montants HT, TVA et TTC
2. Vérifie que HT + TVA = TTC et signale tout écart
3. Propose l'écriture : compte de charge ou de produit, compte de TVA, compte de tiers, selon les habitudes du dossier : [PLAN DE COMPTES OU RÈGLES D'IMPUTATION]
4. Indique ton niveau de confiance, et la raison quand tu hésites

Une pièce en écart ou illisible n'est pas saisie : mets-la de côté avec la raison.

Si tu as accès à mon logiciel comptable par un connecteur, prépare les écritures sans les valider : je les valide moi-même.
Sinon, livre un fichier Excel (.xlsx) au format d'import de [LOGICIEL] : une ligne par écriture, et un onglet « À traiter » pour les pièces mises de côté.`,
    practice: "Donnez à Claude vos règles d'imputation une fois pour toutes (fournisseurs récurrents, comptes du dossier) : les propositions deviennent justes dès le premier mois.",
  },
  {
    family: "saisie",
    title: "Catégoriser et rapprocher la banque",
    result: "Chaque opération du relevé est catégorisée, rattachée au bon tiers et rapprochée de sa facture. Ce qui reste sans pièce est isolé, avec la question à poser au client.",
    prompt: `Voici le relevé bancaire du dossier [CLIENT] sur [PÉRIODE], et la liste des factures clients et fournisseurs non réglées.

Pour chaque opération :
1. Propose le compte et le tiers
2. Rapproche-la de la facture correspondante (montant, date, libellé)
3. Signale les opérations sans pièce et les écarts de montant

Termine par le contrôle : le solde du relevé doit être égal au solde du compte de banque après imputation.

Si tu as accès à mon logiciel comptable par un connecteur, prépare les imputations et les rapprochements sans les valider.
Sinon, livre un fichier Excel (.xlsx) avec trois onglets : « Rapprochées », « À justifier » (avec la question à poser au client) et « Contrôle du solde ».`,
    practice: "Commencez par les opérations récurrentes (loyers, abonnements, salaires) : une fois vos règles posées, Claude les applique à chaque nouveau relevé.",
  },
  {
    family: "saisie",
    title: "Préparer le lettrage clients et fournisseurs",
    result: "Claude associe factures et règlements, propose le lettrage et liste ce qui reste ouvert, tiers par tiers, avec l'ancienneté.",
    prompt: `Voici le grand livre des comptes [CLIENTS / FOURNISSEURS] du dossier [CLIENT] au [DATE].

1. Propose les lettrages évidents : même tiers, même montant
2. Propose les lettrages groupés ou partiels (plusieurs factures pour un règlement, acomptes)
3. Liste ce qui reste non lettré, par tiers, avec l'ancienneté en jours
4. Signale les écarts de règlement (escompte, frais bancaires, erreur de montant) et l'écriture de régularisation à prévoir

Si tu as accès à mon logiciel comptable par un connecteur, prépare le lettrage sans le valider.
Sinon, livre un fichier Excel (.xlsx) avec trois onglets : « Lettrages proposés », « Restes ouverts » (trié par ancienneté) et « Écarts ».`,
    practice: "Validez d'abord les lettrages évidents, puis traitez les cas groupés : c'est là que Claude fait gagner le plus de temps.",
  },
  {
    family: "production",
    title: "Analyser une balance générale",
    result: "Claude lit votre balance exportée en Excel ou CSV, repère ce qui sort de l'ordinaire (soldes inhabituels, comptes qui devraient être soldés, incohérences entre classes) et vous livre un fichier Excel trié par priorité.",
    prompt: `Voici la balance générale du dossier [CLIENT] au [DATE].

Analyse-la et identifie :
1. Les comptes avec un solde anormal au regard de leur nature (compte de tiers créditeur qui devrait être débiteur, etc.)
2. Les comptes d'attente ou de régularisation non soldés
3. Les postes dont le montant paraît disproportionné par rapport à l'activité
4. Les écarts de cohérence entre classes (ex : TVA collectée vs CA)

Livre le résultat dans un fichier Excel (.xlsx) : une ligne par point, avec les colonnes compte, libellé, solde, anomalie, ce qu'il faut vérifier et priorité. En-têtes figés, filtres activés, montants au format comptable, tri par priorité pour la révision.
Dans la conversation, donne seulement les 5 points les plus urgents.`,
    practice: "Exportez votre balance en CSV plutôt qu'en PDF : la lecture est plus fiable et l'analyse plus précise.",
  },
  {
    family: "production",
    title: "Comparer deux périodes comptables",
    result: "Vous chargez deux balances ou deux comptes de résultat : Claude sort les variations significatives dans un fichier Excel et propose des hypothèses d'explication.",
    prompt: `Voici deux balances du dossier [CLIENT] : [PÉRIODE 1] et [PÉRIODE 2].

Compare-les et produis :
1. Les 10 variations les plus significatives en valeur absolue
2. Les 10 variations les plus significatives en pourcentage
3. Pour chaque variation notable, une hypothèse d'explication comptable ou métier
4. Les points à challenger avec le dirigeant lors du prochain rendez-vous

Ignore les variations inférieures à [SEUIL] €.

Livre le tout dans un fichier Excel (.xlsx) avec trois onglets : « En valeur », « En pourcentage » et « Questions au dirigeant ». Hausses en vert, baisses en rouge, montants au format comptable.
Dans la conversation, résume seulement les 3 variations à retenir.`,
    practice: "Ajustez le seuil selon la taille du dossier : sur une TPE, 500 € est pertinent ; sur une PME, 5 000 € évite le bruit.",
  },
  {
    family: "production",
    title: "Faire la synthèse rapide d'une plaquette",
    result: "Vous chargez une plaquette PDF, la vôtre ou celle d'un tiers, et vous obtenez l'essentiel dans un PDF d'une page, propre et prêt à partager.",
    prompt: `Voici la plaquette comptable de [SOCIÉTÉ] pour l'exercice [ANNÉE].

Produis une synthèse d'une page comprenant :
- Les chiffres clés (CA, résultat, capitaux propres, trésorerie, endettement)
- L'évolution par rapport à l'exercice précédent
- Les 3 points forts de la situation financière
- Les 3 points de vigilance
- Les questions que je devrais poser au dirigeant

Rédige en français clair, sans jargon technique.

Livre la synthèse dans un PDF d'une seule page, sobre et aéré : les chiffres clés dans un encadré en haut, points forts et points de vigilance en deux colonnes, les questions en bas. Pas de pavé de texte.`,
    practice: "Très efficace pour prendre connaissance d'un dossier repris, ou pour analyser la plaquette d'un partenaire ou d'une cible d'acquisition.",
  },
  {
    family: "production",
    title: "Analyser un grand livre fournisseurs",
    result: "Doublons, écritures atypiques et comptes à lettrer, sur un volume que personne ne lit ligne à ligne, livrés dans un fichier Excel filtrable.",
    prompt: `Voici le grand livre fournisseurs du dossier [CLIENT] sur [PÉRIODE].

Identifie :
1. Les doublons potentiels (même montant, même fournisseur, dates proches)
2. Les écritures au montant rond inhabituel
3. Les comptes fournisseurs non soldés depuis plus de [X] jours
4. Les fournisseurs dont le volume a fortement varié par rapport à la période précédente
5. Les écritures passées en dehors des périodes habituelles (week-end, jours fériés, fin d'exercice)

Livre les résultats dans un fichier Excel (.xlsx) : un onglet par contrôle, plus un onglet « Synthèse » avec le nombre de cas et le niveau de vigilance de chacun. En-têtes figés, filtres activés, cas sensibles surlignés.
Dans la conversation, donne seulement la synthèse.`,
    practice: "C'est l'usage qui impressionne le plus les collaborateurs en formation : sur un grand livre de plusieurs milliers de lignes, l'analyse prend quelques secondes.",
  },
  {
    family: "client",
    title: "Préparer un rendez-vous client",
    result: "Votre dossier comptable devient une note de préparation exploitable, avec les sujets à aborder et les questions à poser.",
    prompt: `Je reçois [CLIENT] la semaine prochaine. Voici sa balance et son P&L sur les 12 derniers mois.

Prépare ma note de rendez-vous :
1. La situation en 5 lignes, telle que je peux la présenter au dirigeant
2. Les 3 sujets prioritaires à aborder, avec les chiffres qui les justifient
3. Les 5 questions ouvertes à lui poser pour comprendre son activité
4. Les 2 opportunités de conseil que je pourrais lui proposer
5. Les points de vigilance à mentionner sans l'alarmer

Ton : professionnel mais accessible. Le dirigeant n'est pas comptable.

Livre la note dans un document Word (.docx) d'une page, prêt à imprimer pour le rendez-vous.`,
    practice: "C'est le cas d'usage au meilleur retour immédiat : une préparation qui prend habituellement 45 minutes se ramène à une relecture de 10 minutes.",
  },
  {
    family: "client",
    title: "Créer un visuel pour expliquer les chiffres",
    result: "Claude transforme vos données en graphique propre et lisible, livré dans un PDF prêt à présenter au dirigeant.",
    prompt: `À partir de ces données de [CLIENT], crée un graphique qui montre [CE QUE VOUS VOULEZ MONTRER : évolution du CA par trimestre / répartition des charges / évolution de la marge].

Contraintes :
- Le dirigeant n'est pas comptable : le message doit se lire en 5 secondes
- Un seul message par graphique, écrit en titre : [VOTRE MESSAGE]
- Libellés en français clair, pas de numéros de compte ; montants arrondis en k€
- 2 ou 3 couleurs sobres, la couleur forte uniquement sur le point important
- Pas de 3D, pas de quadrillage chargé ; une légende seulement si elle est utile

Livre-le dans un PDF au format paysage, un graphique par page, avec la source et la date en bas de page.
Vérifie le rendu avant de me l'envoyer : aucun texte coupé, superposé ou illisible.`,
    practice: "Particulièrement utile pour présenter les comptes annuels : un graphique bien fait remplace vingt minutes d'explication.",
  },
  {
    family: "client",
    title: "Rédiger des comptes rendus",
    result: "Vos notes brutes prises pendant un rendez-vous deviennent un compte rendu structuré, prêt à envoyer.",
    prompt: `Voici mes notes brutes du rendez-vous avec [CLIENT] du [DATE] :

[COLLER LES NOTES]

Rédige le compte rendu :
- Objet et participants
- Points abordés, structurés par thème
- Décisions prises
- Actions à mener, avec le responsable et l'échéance pour chacune
- Prochaine étape

Ton professionnel, formaté pour un envoi par mail. Reste factuel, n'invente aucun élément qui ne figure pas dans mes notes.`,
    practice: "La dernière instruction est importante : sans elle, Claude a tendance à compléter les zones floues de vos notes.",
  },
  {
    family: "client",
    title: "Préparer des emails et relances clients",
    result: "Vos relances, avec le ton adapté au contexte : premier rappel courtois ou relance ferme.",
    prompt: `Rédige un email de relance pour [CLIENT] concernant [OBJET : pièces manquantes / facture impayée / validation d'un document].

Contexte :
- Relation : [ancienne et bonne / récente / tendue]
- Nombre de relances déjà envoyées : [X]
- Enjeu : [ÉCHÉANCE OU CONSÉQUENCE]

Ton souhaité : [courtois / ferme mais cordial / formel]
Longueur : 8 lignes maximum.
Propose deux objets de mail différents.`,
    practice: "Créez une fois pour toutes vos trois modèles (première relance, deuxième relance, dernière relance avant procédure) : vous ne repartez plus jamais de zéro.",
  },
  {
    family: "organisation",
    title: "Créer des procédures internes",
    result: "Un savoir-faire oral devient une procédure écrite, utilisable par un nouveau collaborateur.",
    prompt: `Je veux formaliser la procédure de [SUJET : révision d'un dossier TPE / accueil d'un nouveau client / clôture mensuelle].

Voici comment on procède aujourd'hui, tel que je le décris à l'oral :
[DÉCRIRE LIBREMENT, MÊME EN VRAC]

Structure ça en procédure claire :
- Objectif et périmètre
- Prérequis
- Étapes numérotées, avec le rôle responsable de chacune
- Points de contrôle obligatoires
- Cas particuliers et exceptions
- Durée estimée

Livre la procédure dans un document Word (.docx) : titres, étapes numérotées et un tableau des points de contrôle.

Signale-moi les zones où ma description est ambiguë ou incomplète.`,
    practice: "La dernière ligne rend l'exercice utile : Claude pointe les trous de votre process que vous ne voyiez plus.",
  },
  {
    family: "organisation",
    title: "Créer un assistant interne au cabinet",
    result: "Un espace de travail dans Claude où vous déposez vos procédures, vos modèles et vos règles internes. Vos collaborateurs y posent leurs questions et obtiennent des réponses cohérentes avec les pratiques du cabinet.",
    prompt: `Tu es l'assistant interne du cabinet [NOM].

Tu réponds aux questions des collaborateurs en te basant exclusivement sur les documents du projet.

Règles :
- Si l'information ne figure pas dans les documents, dis-le clairement et indique qui contacter en interne
- Cite toujours le document source de ta réponse
- Pour toute question engageant la responsabilité du cabinet, rappelle qu'une validation par un expert-comptable inscrit est nécessaire
- Ton : direct et professionnel, tutoiement`,
    practice: "Créez un Projet dans Claude, déposez-y vos documents de référence (procédures internes, modèles de courriers, grille tarifaire, checklists de révision), collez ces instructions, puis partagez le projet avec votre équipe (offres Team et Enterprise). Un nouveau collaborateur y trouve les réponses aux questions qu'il n'ose pas poser trois fois.",
  },
  {
    family: "conseil",
    title: "Faire sa veille réglementaire",
    result: "Claude recherche sur le web les évolutions récentes et vous les restitue, filtrées sur les secteurs réellement présents dans votre portefeuille.",
    prompt: `Recherche les évolutions réglementaires comptables et fiscales françaises publiées depuis [DATE].

Filtre sur ce qui concerne mes clients : [LISTER VOS SECTEURS, ex : BTP, restauration, professions libérales, holdings].

Pour chaque évolution :
- De quoi il s'agit, en 3 lignes
- Qui est concerné
- La date d'entrée en vigueur
- Ce que je dois faire ou dire à mes clients
- La source officielle

Ignore ce qui ne concerne aucun de mes secteurs.

Livre le résultat dans un fichier Excel (.xlsx) : une ligne par évolution, avec les colonnes sujet, clients concernés, date d'entrée en vigueur, action et lien vers la source.`,
    practice: "Activez la recherche web dans Claude : sans elle, Claude répond depuis ses connaissances internes, qui ont une date limite. Vérifiez systématiquement les sources citées avant de relayer une information à un client.",
    warning: true,
  },
  {
    family: "conseil",
    title: "Rédiger une note technique",
    result: "La structure et le premier jet d'une note sur le traitement comptable d'une opération, que vous complétez et validez.",
    prompt: `Je dois rédiger une note technique sur le traitement comptable de [OPÉRATION].

Contexte du dossier :
- Forme juridique : [X]
- Secteur : [X]
- Référentiel : [PCG / IFRS]
- Spécificités : [X]

Produis :
1. La position du problème
2. Les textes et principes applicables, avec leurs références précises
3. Les traitements possibles et leurs conséquences
4. Le traitement recommandé et sa justification
5. Les écritures comptables associées
6. Les points d'attention pour le contrôle

Livre la note dans un document Word (.docx), avec les références en notes de bas de page.

Signale explicitement les points où tu n'es pas certain de la référence, plutôt que d'affirmer.`,
    practice: "Vigilance maximale : un modèle de langage peut produire une référence plausible mais inexacte. Vérifiez toute référence à la source avant de l'intégrer à une note qui engage le cabinet. Utilisez Claude pour la structure et le raisonnement, pas comme source de droit.",
    warning: true,
  },
];

export const CAS_USAGE_EC = {
  slug: "12-cas-usage-experts-comptables",
  metaTitle: "15 cas d'usage concrets de Claude pour les experts-comptables",
  metaDescription: fr(
    "15 cas d'usage testés dans un contexte de cabinet, de la saisie au conseil, chacun avec son prompt prêt à copier. Accès libre."
  ),
  eyebrow: "Ressource gratuite · 15 cas d'usage",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: "15 cas d'usage concrets de <accent>Claude</accent> pour les experts-comptables",
  subtitle: fr(
    "La question n'est plus « est-ce que l'IA peut m'aider ? » mais « sur quoi je commence ? ». Voici 15 réponses testées dans un contexte de cabinet, de la saisie au conseil, chacune avec son prompt prêt à copier."
  ),
  promises: ["Sans inscription", "Prompts prêts à copier", "Claude propose, vous validez"],
  before: [
    {
      icon: "shieldCheck",
      title: "Un compte professionnel",
      text: fr("Pour des données clients, une offre professionnelle de Claude (Team ou Enterprise) : elle relève des conditions commerciales, qui intègrent l'accord de traitement des données."),
    },
    {
      icon: "lock",
      title: "Anonymisez ce qui peut l'être",
      text: fr("Pour une analyse de balance ou de grand livre, les noms de tiers ne sont souvent pas nécessaires : un numéro de compte et un montant suffisent à détecter une anomalie."),
    },
    {
      icon: "userCheck",
      title: "Claude propose, vous validez",
      text: fr("Aucun de ces usages ne remplace votre jugement professionnel. L'IA produit un premier jet ou une piste d'analyse ; la revue, la décision et la signature restent les vôtres."),
    },
    {
      icon: "download",
      title: "Des fichiers, pas des pavés de texte",
      text: fr("Quand le résultat est lourd, les prompts demandent un fichier propre : Excel (.xlsx, qui s'ouvre aussi dans Google Sheets), PDF ou Word. La création de fichiers est activée par défaut dans Claude ; sur une offre Team, l'administrateur peut l'avoir désactivée."),
    },
  ] satisfies readonly { icon: IconName; title: string; text: string }[],
  families: [
    {
      id: "saisie",
      label: "Saisie et écritures",
      icon: "receipt",
      /** Mention discrète du connecteur (demande d'Espoir, 28/11/2026) : lien vers l'agenda de démo, calendrier affiché directement */
      note: {
        text: fr("Ces trois usages vont jusqu'à l'écriture dans votre logiciel : il faut un connecteur qui écrit. Althoce en installe sur Pennylane, ACD et d'autres logiciels. Sans connecteur, Claude vous livre un fichier d'import."),
        label: "Réserver une démo du connecteur",
        url: "https://calendar.app.google/m6thfjDsXzEqKdkKA",
      },
    },
    { id: "production", label: "Révision et analyse", icon: "scanSearch" },
    { id: "client", label: "Relation client", icon: "messageSquareText" },
    { id: "organisation", label: "Organisation interne", icon: "listChecks" },
    { id: "conseil", label: "Conseil et technique", icon: "landmark" },
  ] satisfies readonly { id: CasFamily; label: string; icon: IconName; note?: { text: string; label: string; url: string } }[],
  cases: cases.map((c, i) => ({
    ...c,
    number: String(i + 1).padStart(2, "0"),
    result: fr(c.result),
    prompt: fr(c.prompt),
    practice: fr(c.practice),
  })) as CasUsage[],
  start: {
    title: "Un usage à la fois",
    steps: [
      { title: "Choisissez un usage", text: fr("Celui qui vous coûte le plus d'heures chaque semaine. Ne déployez pas les 15 en même temps.") },
      { title: "Testez-le deux semaines", text: fr("Sur un dossier réel, avec le prompt tel quel, puis ajusté à vos habitudes.") },
      { title: "Mesurez, puis passez au suivant", text: fr("Le temps gagné vous dit où aller ensuite.") },
    ],
    /** Les deux meilleurs points d'entrée selon le guide : préparer un rendez-vous client, puis analyser une balance */
    entry: { title: "Les meilleurs points d'entrée", cases: ["08", "04"], text: fr("Gain immédiat et adoption facile par les collaborateurs.") },
  },
  /**
   * Bas de page : l'agenda du pré-audit IA offert, affiché ouvert (choix d'Espoir du
   * 28/11/2026, à la place de « Une autre ressource gratuite »). Agenda Google
   * PRE_AUDIT_BOOKING_* (config/rdvPages.ts), le même que la page merci et les autres guides.
   */
  rdv: {
    eyebrow: fr("Pré-audit IA · 100 % gratuit"),
    title: fr("Appliquer ces usages à votre cabinet ?"),
    text: fr("30 minutes pour regarder votre production, vos dossiers et vos logiciels, et voir ce que l'IA peut prendre en charge. Sans engagement."),
  },
  author: "Espoir Mwami",
} as const;
