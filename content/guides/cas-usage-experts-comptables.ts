/**
 * « 12 cas d'usage concrets de Claude pour les experts-comptables » : ressource en
 * accès libre, sans formulaire (lecteur /g/12-cas-usage-experts-comptables).
 *
 * Contenu repris du guide Notion d'Espoir (édité le 12/10/2026), à sa demande du
 * 12/11/2026 : la ressource passe sur une page Althoce, comme les autres guides.
 * Les 12 cas, leurs prompts et leurs conseils sont ceux du guide. Retirés : les liens
 * de réservation de l'ancien Cal.com, le tableau des offres Claude et l'hébergement
 * des données (non revérifiés), le calendrier de la facturation électronique (dates
 * passées) et la mention « finançables OPCO » (non vérifiée). « Compte professionnel »
 * repris des faits vérifiés du guide Pennylane (support.claude.com, 19/10/2026).
 */
import type { IconName } from "@/components/icons/lucide";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

export type CasFamily = "production" | "client" | "organisation" | "conseil";

export interface CasUsage {
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

const cases: CasUsage[] = [
  {
    number: "01",
    family: "production",
    title: "Analyser une balance générale",
    result: "Claude lit votre balance exportée en Excel ou CSV et repère ce qui sort de l'ordinaire : soldes inhabituels, comptes qui devraient être soldés, incohérences entre classes.",
    prompt: `Voici la balance générale du dossier [CLIENT] au [DATE].

Analyse-la et identifie :
1. Les comptes avec un solde anormal au regard de leur nature (compte de tiers créditeur qui devrait être débiteur, etc.)
2. Les comptes d'attente ou de régularisation non soldés
3. Les postes dont le montant paraît disproportionné par rapport à l'activité
4. Les écarts de cohérence entre classes (ex : TVA collectée vs CA)

Pour chaque point, indique le numéro de compte, le montant, et ce qu'il faut vérifier.
Classe par ordre de priorité pour la révision.`,
    practice: "Exportez votre balance en CSV plutôt qu'en PDF : la lecture est plus fiable et l'analyse plus précise.",
  },
  {
    number: "02",
    family: "production",
    title: "Comparer deux périodes comptables",
    result: "Vous chargez deux balances ou deux comptes de résultat : Claude sort les variations significatives et propose des hypothèses d'explication.",
    prompt: `Voici deux balances du dossier [CLIENT] : [PÉRIODE 1] et [PÉRIODE 2].

Compare-les et produis :
1. Les 10 variations les plus significatives en valeur absolue
2. Les 10 variations les plus significatives en pourcentage
3. Pour chaque variation notable, une hypothèse d'explication comptable ou métier
4. Les points à challenger avec le dirigeant lors du prochain rendez-vous

Ignore les variations inférieures à [SEUIL] €.`,
    practice: "Ajustez le seuil selon la taille du dossier : sur une TPE, 500 € est pertinent ; sur une PME, 5 000 € évite le bruit.",
  },
  {
    number: "03",
    family: "production",
    title: "Faire la synthèse rapide d'une plaquette",
    result: "Vous chargez une plaquette PDF, la vôtre ou celle d'un tiers, et vous obtenez l'essentiel en une page.",
    prompt: `Voici la plaquette comptable de [SOCIÉTÉ] pour l'exercice [ANNÉE].

Produis une synthèse d'une page comprenant :
- Les chiffres clés (CA, résultat, capitaux propres, trésorerie, endettement)
- L'évolution par rapport à l'exercice précédent
- Les 3 points forts de la situation financière
- Les 3 points de vigilance
- Les questions que je devrais poser au dirigeant

Rédige en français clair, sans jargon technique.`,
    practice: "Très efficace pour prendre connaissance d'un dossier repris, ou pour analyser la plaquette d'un partenaire ou d'une cible d'acquisition.",
  },
  {
    number: "04",
    family: "production",
    title: "Analyser un grand livre fournisseurs",
    result: "Doublons, écritures atypiques et comptes à lettrer, sur un volume que personne ne lit ligne à ligne.",
    prompt: `Voici le grand livre fournisseurs du dossier [CLIENT] sur [PÉRIODE].

Identifie :
1. Les doublons potentiels (même montant, même fournisseur, dates proches)
2. Les écritures au montant rond inhabituel
3. Les comptes fournisseurs non soldés depuis plus de [X] jours
4. Les fournisseurs dont le volume a fortement varié par rapport à la période précédente
5. Les écritures passées en dehors des périodes habituelles (week-end, jours fériés, fin d'exercice)

Présente les résultats sous forme de tableau avec le niveau de vigilance associé.`,
    practice: "C'est l'usage qui impressionne le plus les collaborateurs en formation : sur un grand livre de plusieurs milliers de lignes, l'analyse prend quelques secondes.",
  },
  {
    number: "05",
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

Ton : professionnel mais accessible. Le dirigeant n'est pas comptable.`,
    practice: "C'est le cas d'usage au meilleur retour immédiat : une préparation qui prend habituellement 45 minutes se ramène à une relecture de 10 minutes.",
  },
  {
    number: "06",
    family: "client",
    title: "Créer un visuel pour expliquer les chiffres",
    result: "Claude génère un graphique ou un schéma à partir de vos données, directement dans la conversation, que vous pouvez ensuite exporter.",
    prompt: `À partir de ces données de [CLIENT], crée un graphique qui montre [CE QUE VOUS VOULEZ MONTRER : évolution du CA par trimestre / répartition des charges / évolution de la marge].

Contraintes :
- Le dirigeant n'est pas comptable, le visuel doit être immédiatement lisible
- Utilise des libellés en français clair, pas des numéros de compte
- Ajoute un titre explicite et une légende
- Mets en évidence le point que je veux faire passer : [VOTRE MESSAGE]`,
    practice: "Particulièrement utile pour présenter les comptes annuels : un graphique bien fait remplace vingt minutes d'explication.",
  },
  {
    number: "07",
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
    number: "08",
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
    number: "09",
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

Signale-moi les zones où ma description est ambiguë ou incomplète.`,
    practice: "La dernière ligne rend l'exercice utile : Claude pointe les trous de votre process que vous ne voyiez plus.",
  },
  {
    number: "10",
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
    number: "11",
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

Ignore ce qui ne concerne aucun de mes secteurs.`,
    practice: "Activez la recherche web dans Claude : sans elle, Claude répond depuis ses connaissances internes, qui ont une date limite. Vérifiez systématiquement les sources citées avant de relayer une information à un client.",
    warning: true,
  },
  {
    number: "12",
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

Signale explicitement les points où tu n'es pas certain de la référence, plutôt que d'affirmer.`,
    practice: "Vigilance maximale : un modèle de langage peut produire une référence plausible mais inexacte. Vérifiez toute référence à la source avant de l'intégrer à une note qui engage le cabinet. Utilisez Claude pour la structure et le raisonnement, pas comme source de droit.",
    warning: true,
  },
];

export const CAS_USAGE_EC = {
  slug: "12-cas-usage-experts-comptables",
  metaTitle: "12 cas d'usage concrets de Claude pour les experts-comptables",
  metaDescription: fr(
    "12 cas d'usage testés dans un contexte de cabinet, de la production au conseil, chacun avec son prompt prêt à copier. Accès libre."
  ),
  eyebrow: "Ressource gratuite · 12 cas d'usage",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: "12 cas d'usage concrets de <accent>Claude</accent> pour les experts-comptables",
  subtitle: fr(
    "La question n'est plus « est-ce que l'IA peut m'aider ? » mais « sur quoi je commence ? ». Voici 12 réponses testées dans un contexte de cabinet, chacune avec son prompt prêt à copier."
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
  ] satisfies readonly { icon: IconName; title: string; text: string }[],
  families: [
    { id: "production", label: "Production et révision", icon: "receipt" },
    { id: "client", label: "Relation client", icon: "messageSquareText" },
    { id: "organisation", label: "Organisation interne", icon: "listChecks" },
    { id: "conseil", label: "Conseil et technique", icon: "landmark" },
  ] satisfies readonly { id: CasFamily; label: string; icon: IconName }[],
  cases: cases.map((c) => ({ ...c, result: fr(c.result), prompt: fr(c.prompt), practice: fr(c.practice) })),
  start: {
    title: "Un usage à la fois",
    steps: [
      { title: "Choisissez un usage", text: fr("Celui qui vous coûte le plus d'heures chaque semaine. Ne déployez pas les 12 en même temps.") },
      { title: "Testez-le deux semaines", text: fr("Sur un dossier réel, avec le prompt tel quel, puis ajusté à vos habitudes.") },
      { title: "Mesurez, puis passez au suivant", text: fr("Le temps gagné vous dit où aller ensuite.") },
    ],
    /** Les deux meilleurs points d'entrée selon le guide : cas 5 et cas 1 */
    entry: { title: "Les meilleurs points d'entrée", cases: ["05", "01"], text: fr("Gain immédiat et adoption facile par les collaborateurs.") },
  },
  /** Une autre ressource gratuite, plutôt qu'une prise de rendez-vous (choix d'Espoir, 12/11/2026) */
  next: {
    eyebrow: "Une autre ressource gratuite",
    title: "Les 10 prompts d'un mois de production",
    text: fr("Du contrôle de la balance à la relance client, à utiliser avec le connecteur de votre logiciel ou un simple export."),
    href: "/g/10-prompts-production-cabinet",
    button: "Lire les 10 prompts",
  },
  /** Lien discret de bas de page, comme les autres guides : agenda du pré-audit offert (Google, lu par le CRM) */
  booking: { url: "https://calendar.app.google/JmhxjFqk2kybuFLR9", label: "Échanger 30 minutes" },
  author: "Espoir Mwami",
} as const;
