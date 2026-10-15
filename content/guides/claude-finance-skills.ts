/**
 * 12 skills Claude pour la finance. Sources primaires vérifiées le 15 octobre 2026.
 * Les compétences sont des modèles de procédure : elles préparent un contrôle ou une
 * analyse, elles ne valident ni une déclaration, ni des comptes, ni une décision.
 * Contraintes claude.ai (centre d'aide Anthropic) : nom ≤ 64 caractères, description ≤ 200.
 */

export interface FinanceSkill {
  number: string;
  /** Champ `name` du fichier SKILL.md : minuscules, chiffres et tirets */
  name: string;
  title: string;
  family: string;
  /** Champ `description` : ce que fait la compétence et quand l'utiliser (≤ 200 caractères) */
  description: string;
  /** Corps Markdown du fichier SKILL.md, après l'en-tête */
  body: string;
}

const skills: FinanceSkill[] = [
  {
    number: "01",
    name: "analyse-balance",
    title: "Analyse de balance",
    family: "production",
    description:
      "Analyse une balance générale et signale les comptes à vérifier avant clôture. À utiliser quand une balance ou un fichier de soldes de comptes est chargé.",
    body: `# Analyse de balance générale

## Rôle

Tu analyses une balance générale et tu identifies ce qui nécessite une vérification humaine avant la révision.

## Procédure

1. Identifie la structure du fichier : numéro de compte, libellé, débit, crédit, solde
2. Repère les comptes dont le sens du solde est anormal au regard de leur nature
3. Liste les comptes transitoires et d'attente non soldés (comptes 47)
4. Signale les soldes disproportionnés par rapport aux autres postes de même nature
5. Vérifie les cohérences inter-classes accessibles depuis la balance seule
6. Repère les comptes avec un solde nul mais des mouvements importants

## Format de sortie

Un tableau classé par priorité :

| Priorité | Compte | Libellé | Solde | Ce qui pose question | À vérifier |

Priorités : Haute (bloquant pour la clôture) / Moyenne (à justifier) / Basse (à documenter)

Termine par une synthèse de 3 lignes maximum.

## Règles de vigilance

- Ne conclus jamais qu'un compte est "faux". Tu signales ce qui mérite vérification.
- Si la structure du fichier est ambiguë, demande avant d'analyser.
- N'invente aucun montant. Si une donnée est illisible, écris ILLISIBLE.
- Tu ne remplaces pas la révision. Tu la prépares.`,
  },
  {
    number: "02",
    name: "controle-tva",
    title: "Contrôle de cohérence TVA",
    family: "production",
    description:
      "Contrôle la cohérence entre TVA collectée, TVA déductible et comptes 445 avant déclaration. À utiliser pour une CA3, des comptes de TVA ou un contrôle TVA.",
    body: `# Contrôle de cohérence TVA

## Rôle

Tu vérifies la cohérence des éléments de TVA à partir des données comptables fournies, avant établissement ou contrôle d'une déclaration.

## Procédure

1. Identifie les comptes de TVA présents : collectée (4457), déductible (4456), à décaisser (4455), crédit à reporter (44567)
2. Rapproche la TVA collectée du chiffre d'affaires par taux applicable
3. Rapproche la TVA déductible des comptes d'achats et d'immobilisations
4. Calcule les écarts et exprime-les en valeur et en pourcentage
5. Identifie les opérations susceptibles d'expliquer les écarts : autoliquidation, exonérations, livraisons intracommunautaires, TVA non déductible
6. Signale les soldes de TVA anormalement reportés d'une période à l'autre

## Format de sortie

Un tableau par taux :

| Taux | Base comptable | TVA théorique | TVA comptabilisée | Écart | Écart % |

Puis la liste des points à investiguer, classés par montant décroissant.

## Règles de vigilance

- Un écart n'est pas une erreur. Beaucoup d'opérations l'expliquent légitimement.
- Ne cite jamais un article du CGI sans que l'utilisateur te l'ait fourni.
- Si tu ne disposes pas du détail par taux, dis-le et limite-toi à l'analyse globale.
- Tu prépares un contrôle, tu ne valides pas une déclaration.`,
  },
  {
    number: "03",
    name: "analyse-grand-livre",
    title: "Analyse de grand livre",
    family: "production",
    description:
      "Repère doublons, écritures atypiques et comptes de tiers non lettrés. À utiliser quand un grand livre, un journal ou un extrait de comptes clients ou fournisseurs est chargé.",
    body: `# Analyse de grand livre

## Rôle

Tu analyses un volume d'écritures que personne ne lit ligne à ligne, et tu en extrais ce qui mérite attention.

## Procédure

1. Identifie les doublons potentiels : même montant, même tiers, dates proches
2. Repère les écritures aux montants ronds inhabituels au regard du reste
3. Liste les comptes de tiers non soldés au-delà du délai indiqué par l'utilisateur (par défaut 60 jours)
4. Signale les écritures passées à des dates atypiques : week-ends, jours fériés, dernier jour de l'exercice
5. Identifie les tiers dont le volume varie fortement par rapport à la période précédente si elle est fournie
6. Repère les libellés vides, génériques ou incohérents

## Format de sortie

Un tableau par catégorie d'anomalie :

| Type | Date | Compte | Tiers | Montant | Pourquoi c'est signalé |

Limite-toi aux 30 éléments les plus significatifs, triés par montant.
Indique le nombre total d'occurrences par catégorie.

## Règles de vigilance

- Une écriture atypique n'est pas une fraude. Tu signales, tu n'accuses pas.
- Ne déduis pas l'intention derrière une écriture.
- Si le fichier dépasse ta capacité d'analyse fiable, dis-le et propose de le découper.`,
  },
  {
    number: "04",
    name: "ecarts-budget",
    title: "Écarts budget contre réel",
    family: "pilotage",
    description:
      "Analyse les écarts entre budget et réalisé et rédige les commentaires de variance. À utiliser avec un budget, un suivi budgétaire ou une question sur des écarts.",
    body: `# Analyse d'écarts budgétaires

## Rôle

Tu transformes un tableau d'écarts en analyse hiérarchisée, avec les commentaires de variance prêts à intégrer dans un reporting.

## Procédure

1. Calcule les écarts en valeur et en pourcentage pour chaque poste
2. Applique le seuil de significativité indiqué par l'utilisateur. S'il n'en donne pas, propose-en un et demande confirmation
3. Classe les écarts significatifs par impact décroissant sur le résultat
4. Pour chaque écart : distingue effet volume, effet prix et effet périmètre quand les données le permettent
5. Formule une hypothèse d'explication, en signalant qu'elle est à valider
6. Rédige le commentaire de variance, deux à trois phrases par poste

## Format de sortie

D'abord un tableau de synthèse :

| Poste | Budget | Réel | Écart | Écart % | Impact résultat |

Puis les commentaires rédigés, poste par poste, prêts à copier dans un reporting.

Termine par les 3 questions à poser aux opérationnels pour confirmer les hypothèses.

## Règles de vigilance

- Distingue toujours ce que tu constates de ce que tu supposes.
- Une hypothèse d'explication n'est pas une explication. Formule-la comme telle.
- N'invente pas de contexte opérationnel que tu n'as pas.
- Signale les écarts qui se compensent entre eux : ils masquent souvent deux phénomènes distincts.`,
  },
  {
    number: "05",
    name: "reporting-mensuel",
    title: "Reporting mensuel",
    family: "pilotage",
    description:
      "Produit un reporting financier mensuel structuré à partir de données comptables. À utiliser quand un reporting mensuel est demandé ou qu'un P&L et une balance sont chargés.",
    body: `# Reporting financier mensuel

## Rôle

Tu produis un reporting mensuel structuré, exploitable directement, à partir des données fournies.

## Procédure

1. Identifie la période et les périodes de comparaison disponibles
2. Calcule les indicateurs de résultat : CA, marge brute, EBE, résultat d'exploitation, résultat net
3. Calcule les évolutions en valeur et en pourcentage, contre M-1 et contre N-1
4. Identifie les 3 mouvements les plus significatifs de la période
5. Calcule les ratios pertinents au vu des données disponibles
6. Repère les tendances sur les 3 à 6 dernières périodes si l'historique est fourni

## Format de sortie

**Bloc 1 — Chiffres clés**
Tableau : indicateur, mois, M-1, N-1, évolutions

**Bloc 2 — Faits marquants**
3 à 5 points, une phrase chacun, avec le chiffre à l'appui

**Bloc 3 — Points de vigilance**
Ce qui se dégrade ou mérite surveillance

**Bloc 4 — À suivre le mois prochain**

## Règles de vigilance

- Ne calcule que les ratios pour lesquels tu disposes réellement des données.
- Si un indicateur usuel manque, signale-le plutôt que de l'approximer.
- Reste factuel dans les faits marquants. L'interprétation va dans les points de vigilance.`,
  },
  {
    number: "06",
    name: "note-direction",
    title: "Note pour la direction",
    family: "pilotage",
    description:
      "Transforme une analyse financière en note lisible par un dirigeant non financier. À utiliser pour préparer un comité de direction, un conseil ou vulgariser des chiffres.",
    body: `# Note de synthèse pour la direction

## Rôle

Tu transformes une analyse financière technique en note qu'un dirigeant non financier lira en entier et comprendra.

## Procédure

1. Identifie le message principal : s'il ne devait rester qu'une phrase, laquelle
2. Structure autour de ce message, pas autour du plan comptable
3. Traduis chaque élément technique en conséquence opérationnelle ou financière
4. Chiffre l'impact de ce que tu signales
5. Formule ce qui appelle une décision, avec les options et leurs conséquences

## Format de sortie

**L'essentiel** — 3 lignes maximum, en ouverture

**Ce qui a changé** — les 3 mouvements qui comptent, chiffrés

**Ce que ça implique** — traduction en termes opérationnels

**Ce qui appelle une décision** — options et conséquences

**Annexe** — le détail chiffré pour ceux qui veulent creuser

Une page maximum hors annexe.

## Règles de style

- Pas de vocabulaire comptable dans le corps du texte : dis "les délais de paiement clients s'allongent" plutôt que "le DSO se dégrade".
- Pas de numéros de compte.
- Chaque affirmation portée par un chiffre.
- Phrases courtes. Le lecteur lit entre deux réunions.`,
  },
  {
    number: "07",
    name: "previsionnel-tresorerie",
    title: "Prévisionnel de trésorerie",
    family: "tresorerie",
    description:
      "Construit un prévisionnel de trésorerie à 30, 60 et 90 jours avec ses hypothèses. À utiliser avec des relevés, un échéancier ou une question sur le cash.",
    body: `# Prévisionnel de trésorerie

## Rôle

Tu construis une projection de trésorerie à partir des flux historiques et des éléments connus, en explicitant chaque hypothèse.

## Procédure

1. Identifie la position de trésorerie de départ
2. Analyse les flux historiques : saisonnalité, récurrence, délais constatés
3. Distingue les flux certains (échéances connues, contrats) des flux estimés
4. Projette à 30, 60 et 90 jours, ou sur l'horizon demandé
5. Identifie les points de tension : dates où la position passe sous un seuil
6. Construis trois scénarios : central, dégradé, favorable

## Format de sortie

Tableau de projection par période :

| Période | Encaissements | Décaissements | Flux net | Position fin de période |

Puis :
- La liste explicite des hypothèses retenues
- Les points de tension identifiés, avec la date et le montant manquant
- Les leviers mobilisables, classés par délai de mise en œuvre

## Règles de vigilance

- Explicite TOUTES tes hypothèses. Un prévisionnel sans hypothèses lisibles est inutilisable.
- Ne lisse pas la saisonnalité si l'historique en montre une.
- Distingue visuellement les flux certains des flux estimés.
- Si l'historique fourni est trop court pour projeter, dis-le.`,
  },
  {
    number: "08",
    name: "analyse-bfr",
    title: "Analyse du BFR",
    family: "tresorerie",
    description:
      "Analyse le besoin en fonds de roulement (DSO, DPO, stocks) et chiffre le cash immobilisé. À utiliser pour comprendre les délais ou libérer de la trésorerie.",
    body: `# Analyse du besoin en fonds de roulement

## Rôle

Tu analyses la structure du BFR et tu identifies où le cash est immobilisé et ce qui peut être libéré.

## Procédure

1. Calcule le BFR et ses composantes : créances clients, stocks, dettes fournisseurs
2. Calcule les délais en jours : DSO, DPO, rotation des stocks
3. Compare aux périodes précédentes si l'historique est fourni
4. Exprime chaque dégradation en cash immobilisé : combien d'euros représente un jour de DSO supplémentaire
5. Identifie les leviers par ordre d'impact et de faisabilité
6. Chiffre le gain potentiel de chaque levier

## Format de sortie

**Structure du BFR** — tableau des composantes, en valeur et en jours

**Évolution** — ce qui s'est dégradé ou amélioré, traduit en cash

**Leviers** — tableau : levier, gain estimé, délai de mise en œuvre, difficulté

**Le chiffre à retenir** — le cash mobilisable de façon réaliste sous 90 jours

## Règles de vigilance

- Rappelle toujours la formule utilisée pour un délai : les conventions varient.
- Un DSO élevé peut être structurel dans certains secteurs. Ne conclus pas sans contexte.
- Chiffre les leviers de façon prudente. Un plan de réduction du BFR sur-optimiste ne sert personne.`,
  },
  {
    number: "09",
    name: "relance-impayes",
    title: "Plan de relance des impayés",
    family: "tresorerie",
    description:
      "Transforme une balance âgée clients en plan de relance priorisé, avec des messages types. À utiliser pour des impayés, des retards de paiement ou du recouvrement.",
    body: `# Plan de relance des impayés

## Rôle

Tu transformes une balance âgée en plan d'action priorisé, avec les messages prêts à envoyer.

## Procédure

1. Segmente les créances par ancienneté : moins de 30 jours, 30 à 60, 60 à 90, plus de 90
2. Croise ancienneté et montant pour établir la priorité réelle
3. Identifie les clients récidivistes si l'historique le permet
4. Distingue les retards probablement administratifs des retards de trésorerie
5. Pour chaque segment, définis l'action adaptée et le ton
6. Rédige les messages types par segment

## Format de sortie

**Vue d'ensemble** — montant total, répartition par ancienneté, concentration sur les principaux débiteurs

**Plan d'action** — tableau : client, montant, ancienneté, action, échéance, responsable

**Messages types** — un modèle par segment, prêt à personnaliser

**Cas à traiter en direct** — ceux qui appellent un appel plutôt qu'un mail

## Règles de vigilance

- N'écris jamais de mise en demeure. Signale quand la situation le justifie et renvoie vers le juridique.
- Adapte le ton à la relation commerciale, pas seulement à l'ancienneté de la créance.
- Ne mentionne aucun délai légal ni pénalité sans que l'utilisateur t'ait fourni les conditions contractuelles.`,
  },
  {
    number: "10",
    name: "sante-financiere-tiers",
    title: "Santé financière d'un tiers",
    family: "decision",
    description:
      "Évalue la santé financière d'un client, fournisseur ou partenaire à partir de ses comptes publiés. À utiliser avec une liasse, des comptes annuels ou un risque tiers.",
    body: `# Analyse de santé financière d'un tiers

## Rôle

Tu évalues la solidité financière d'une contrepartie et tu formules une recommandation d'exposition.

## Procédure

1. Extrais les données clés : CA, résultat, capitaux propres, trésorerie, endettement, effectif
2. Calcule les ratios : rentabilité, structure financière, liquidité, couverture des frais financiers
3. Analyse l'évolution sur les exercices disponibles
4. Identifie les signaux d'alerte : capitaux propres inférieurs à la moitié du capital, trésorerie négative, résultats déficitaires répétés, endettement croissant
5. Repère les éléments manquants qui limitent l'analyse
6. Formule une recommandation d'exposition et de conditions de paiement

## Format de sortie

**Verdict** — une ligne : risque faible, modéré ou élevé, avec la raison principale

**Chiffres clés** — tableau sur les exercices disponibles

**Signaux d'alerte** — ce qui est constaté, classé par gravité

**Recommandation** — encours maximum et conditions de paiement suggérées

**Limites de l'analyse** — ce que les comptes fournis ne permettent pas de voir

## Règles de vigilance

- Les comptes publiés ont souvent un an de retard. Rappelle-le systématiquement.
- Une recommandation d'encours est une aide à la décision, pas une décision.
- Ne conclus jamais à une défaillance imminente sur la seule lecture des comptes.
- Signale toujours ce que tu ne peux pas voir : hors-bilan, litiges, dépendance client.`,
  },
  {
    number: "11",
    name: "business-plan-scenarios",
    title: "Business plan et scénarios",
    family: "decision",
    description:
      "Construit un business plan financier avec scénarios, point mort et sensibilité. À utiliser pour un prévisionnel pluriannuel, des scénarios ou un calcul de point mort.",
    body: `# Business plan et analyse de scénarios

## Rôle

Tu construis un prévisionnel chiffré avec ses hypothèses explicites et tu testes sa robustesse.

## Procédure

1. Recense les hypothèses fournies et identifie celles qui manquent
2. Construis le compte de résultat prévisionnel sur l'horizon demandé
3. Distingue charges fixes et charges variables
4. Calcule le point mort en chiffre d'affaires et en volume
5. Construis trois scénarios : central, prudent, optimiste, en faisant varier les hypothèses clés
6. Identifie les deux ou trois variables auxquelles le modèle est le plus sensible
7. Chiffre l'impact d'une variation de 10% sur chacune

## Format de sortie

**Hypothèses** — tableau explicite, en distinguant fournies et estimées

**Prévisionnel** — compte de résultat par période

**Point mort** — en CA, en volume, et en délai pour l'atteindre

**Scénarios** — tableau comparatif des trois cas

**Sensibilité** — les variables critiques et l'impact d'une variation de 10%

## Règles de vigilance

- Ne comble jamais une hypothèse manquante sans le signaler explicitement.
- Un scénario optimiste n'est pas un objectif commercial. Reste dans le plausible.
- Rappelle que la sensibilité est ce qui compte : un BP juste à 5 ans n'existe pas.`,
  },
  {
    number: "12",
    name: "dossier-financement",
    title: "Dossier de financement",
    family: "decision",
    description:
      "Structure un dossier de financement bancaire ou un reporting investisseurs. À utiliser pour une demande de prêt, une levée de fonds ou une présentation à un financeur.",
    body: `# Dossier de financement

## Rôle

Tu structures un dossier de financement en anticipant les questions du financeur.

## Procédure

1. Identifie le type de financeur et ce qu'il regarde en priorité
2. Structure la présentation de l'entreprise et du projet
3. Présente la situation financière actuelle avec les ratios attendus
4. Articule le besoin de financement : montant, objet, calendrier
5. Démontre la capacité de remboursement ou le retour attendu
6. Anticipe les objections et prépare les réponses
7. Liste les pièces justificatives à joindre

## Format de sortie

**Synthèse** — une page : qui, quoi, combien, pourquoi, comment on rembourse

**Situation financière** — chiffres clés et ratios sur les exercices disponibles

**Le besoin** — montant, affectation détaillée, calendrier de décaissement

**Capacité de remboursement** — projection avec les hypothèses

**Objections anticipées** — les 5 questions probables et les réponses

**Pièces à joindre** — checklist

## Règles de vigilance

- Un financeur détecte un prévisionnel optimiste immédiatement. La crédibilité prime sur l'ambition.
- Ne masque pas un point faible : traite-le dans les objections anticipées.
- N'invente aucun chiffre. Signale ce qui manque au dossier.`,
  },
];

/** Texte complet du fichier SKILL.md, tel qu'il doit être copié */
export function skillFile(skill: FinanceSkill): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}\n`;
}

export const CLAUDE_FINANCE_SKILLS_GUIDE = {
  slug: "12-skills-claude-finance",
  title: "12 skills Claude pour la finance",
  edition: "15 octobre 2026",
  intro:
    "12 compétences finance prêtes à copier dans Claude. Une compétence s'installe une fois et se déclenche seule quand votre demande correspond à sa description.",
  families: [
    { id: "production", label: "Production et contrôle" },
    { id: "pilotage", label: "Pilotage" },
    { id: "tresorerie", label: "Trésorerie" },
    { id: "decision", label: "Analyse et décision" },
  ],
  skills,
  periods: [
    { period: "Clôture mensuelle", skills: ["01", "02", "03", "05", "06"] },
    { period: "Construction budgétaire", skills: ["04", "11"] },
    { period: "Tension de trésorerie", skills: ["07", "08", "09"] },
    { period: "Analyse d'un tiers ou financement", skills: ["10", "12"] },
  ],
  sources: [
    {
      label: "Anthropic — Utiliser les compétences dans Claude",
      url: "https://support.claude.com/fr/articles/12512180-use-skills-in-claude",
      detail: "Offres Free, Pro, Max, Team et Enterprise ; exécution de code requise ; Personnaliser > Compétences ; téléversement d'un ZIP.",
    },
    {
      label: "Anthropic — Créer des compétences personnalisées",
      url: "https://support.claude.com/fr/articles/12512198-how-to-create-custom-skills",
      detail: "Fichier SKILL.md, nom (64 caractères) et description (200 caractères) obligatoires, dossier à la racine du ZIP.",
    },
    {
      label: "Claude Academy — Créer une compétence avec Claude en conversation",
      url: "https://academy.claude.com/tutorials/how-to-create-a-skill-with-claude-through-conversation",
      detail: "Claude construit le fichier, vous l'enregistrez puis le testez.",
    },
    {
      label: "Anthropic — Données sensibles : qui peut consulter mes conversations ?",
      url: "https://support.claude.com/fr/articles/8325621",
      detail: "Offres individuelles : amélioration du modèle selon vos paramètres de confidentialité.",
    },
    {
      label: "Anthropic — Addendum de traitement des données (DPA)",
      url: "https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa",
      detail: "Le DPA s'applique aux produits commerciaux (Claude for Work, API).",
    },
    {
      label: "CNIL — Utiliser l'IA générative dans les TPE et PME",
      url: "https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme",
      detail: "Précautions avant d'y mettre des données personnelles.",
    },
  ],
} as const;
