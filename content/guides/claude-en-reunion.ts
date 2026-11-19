/**
 * « Claude en réunion » : fiche pratique (lecteur /g/claude-en-reunion, accès par la page de
 * capture /r/claude-en-reunion). Post LinkedIn du 19/11/2026 pour les dirigeants et les
 * commerciaux, mot clé RÉUNION, lien court re1. Sujet validé par Espoir le 17/11/2026.
 *
 * Faits vérifiés le 18/11/2026 sur les sources officielles :
 * - https://claude.com/resources/articles/claude-meetings (12/11/2026) ;
 * - https://support.claude.com/en/articles/18325154-use-claude-meetings (« Use Claude Meetings »).
 * Bêta, offres Team et Enterprise, Google Meet seulement ; pas pour les organisations en ZDR,
 * HIPAA ou CMEK ; Google Calendar activé par un propriétaire ; « Add Claude » ou participation
 * automatique (Settings > Capabilities > Meetings) ; par défaut, Claude ne rejoint pas une
 * réunion avec un invité extérieur et la quitte si un extérieur arrive ; un propriétaire peut
 * l'autoriser (« Meetings with external guests ») ; les invités extérieurs n'ont ni la page de
 * réunion ni l'email de récapitulatif ; transcription, résumé et descriptions d'écran conservés,
 * pas l'audio ; accord des participants à obtenir avant ; notes et transcriptions gratuites,
 * documents et tableaux blancs gratuits jusqu'au 10/02/2027.
 * Claude n'envoie pas d'email de suivi : le skill 02 en prépare un brouillon.
 * Skills (demande d'Espoir du 18/11 : « partage plutôt des skills que des prompts ») : offres
 * Free à Enterprise, exécution de code requise (activée par un propriétaire sur Team et
 * Enterprise), installés une fois, déclenchés par leur description ; nom ≤ 64, description ≤ 200
 * (https://support.claude.com/en/articles/12512180-using-skills-in-claude, vérifié le 17/11).
 */
import type { IconName } from "@/components/icons/lucide";
import { createZip } from "@/lib/zip";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

/** Skill Claude : fichier SKILL.md (nom ≤ 64 caractères, description ≤ 200, centre d'aide Claude). */
export interface ReunionSkill {
  number: string;
  /** Champ `name` du fichier SKILL.md : minuscules, chiffres et tirets */
  name: string;
  title: string;
  /** Ce que le skill produit, en une phrase (affiché sur la page) */
  result: string;
  /** Champ `description` : ce que fait le skill et quand l'utiliser (≤ 200 caractères, sans deux-points : en-tête YAML) */
  description: string;
  /** Corps Markdown du fichier SKILL.md, après l'en-tête */
  body: string;
}

const skills: ReunionSkill[] = [
  {
    number: "01",
    name: "compte-rendu-reunion-client",
    title: "Le compte rendu à envoyer au client",
    result: "Une page claire : contexte, décisions, prochaines étapes, sans le bruit de la discussion.",
    description: "Rédige le compte rendu d'une réunion à envoyer au client, avec contexte, décisions, points en suspens et prochaines étapes. À utiliser après une réunion avec un client ou un prospect.",
    body: `# Compte rendu de réunion client

## Rôle

Tu rédiges le compte rendu d'une réunion, prêt à être relu puis envoyé au client.

## Procédure

1. Retrouve la réunion demandée (notes, transcription, résumé). Si plusieurs réunions correspondent, demande laquelle.
2. Résume le contexte en 2 phrases.
3. Liste les décisions prises.
4. Liste les points restés en suspens.
5. Liste les prochaines étapes avec un responsable et une date pour chacune.

## Format de sortie

Un email d'une page au maximum : objet, puis les quatre parties avec un titre court chacune. Ton professionnel et simple, vouvoiement.

## Règles

- N'écris que ce qui a été dit pendant la réunion. Marque « à confirmer » ce qui n'est pas clair.
- Pas de détail interne à l'entreprise (prix de revient, remarques sur le client).
- C'est un brouillon : n'envoie rien.`,
  },
  {
    number: "02",
    name: "mail-suivi-reunion",
    title: "Le mail de suivi, prêt à relire",
    result: "Un brouillon de mail de suivi personnalisé, avec les engagements pris de chaque côté.",
    description: "Prépare le brouillon du mail de suivi après une réunion, avec les points clés, les engagements de chaque côté et le prochain rendez-vous. À utiliser pour un mail de suivi ou de relance.",
    body: `# Mail de suivi après une réunion

## Rôle

Tu prépares le mail de suivi que l'utilisateur envoie à son interlocuteur après une réunion.

## Procédure

1. Retrouve la réunion et l'interlocuteur concernés.
2. Remercie en une phrase.
3. Rappelle les 3 points clés de la réunion.
4. Liste ce que l'utilisateur s'engage à envoyer et ce qu'il attend de son interlocuteur, avec les dates évoquées.
5. Propose un prochain rendez-vous. Si aucun créneau n'est donné, laisse [CRÉNEAUX] à compléter.

## Format de sortie

Objet, puis le mail : 10 lignes au plus, phrases courtes, vouvoiement sauf si l'échange était au tutoiement.

## Règles

- N'invente aucun engagement ni aucune date.
- C'est un brouillon à relire : n'envoie rien.`,
  },
  {
    number: "03",
    name: "actions-reunion",
    title: "Les actions, avec un responsable et une date",
    result: "Le tableau des actions de la réunion, prêt à coller dans votre outil de suivi.",
    description: "Extrait les actions décidées en réunion dans un tableau avec responsable, échéance et statut. À utiliser quand on demande les actions, le plan d'action ou le suivi d'une réunion.",
    body: `# Actions de la réunion

## Rôle

Tu extrais toutes les actions décidées pendant une réunion pour qu'aucune ne se perde.

## Procédure

1. Retrouve la réunion demandée.
2. Relève chaque action décidée, même évoquée rapidement.
3. Pour chacune : qui la fait, pour quand, ce dont elle dépend.
4. Classe les actions par échéance.

## Format de sortie

| Action | Responsable | Échéance | Dépend de | Statut |

Termine par les 3 actions à lancer en premier.

## Règles

- Si un responsable ou une échéance n'a pas été dit, écris « à préciser » au lieu de le supposer.
- Une action par ligne, formulée avec un verbe.`,
  },
  {
    number: "04",
    name: "fiche-crm-reunion",
    title: "La fiche prospect mise à jour",
    result: "Les informations utiles pour votre CRM : besoin, budget, décideurs, calendrier, objections.",
    description: "Prépare la mise à jour de la fiche prospect du CRM après une réunion (besoin, décideurs, budget, calendrier, objections). À utiliser après un rendez-vous commercial.",
    body: `# Fiche prospect après une réunion

## Rôle

Tu prépares la mise à jour de la fiche d'un prospect dans le CRM à partir d'une réunion commerciale.

## Procédure

1. Retrouve la réunion avec ce prospect.
2. Remplis chaque champ à partir de ce qui a été dit :
   - besoin exprimé et enjeu pour le prospect ;
   - décideurs et interlocuteurs cités ;
   - budget évoqué ;
   - calendrier ;
   - objections soulevées ;
   - concurrents mentionnés ;
   - prochaine étape.
3. Pour chaque champ, cite la phrase de la réunion qui le justifie.

## Format de sortie

| Champ | Valeur | Phrase de la réunion |

## Règles

- Laisse vide un champ qui n'a pas été abordé. N'invente rien.
- Ne modifie rien dans le CRM : tu prépares, l'utilisateur saisit ou valide.`,
  },
  {
    number: "05",
    name: "preparation-rendez-vous",
    title: "La préparation du prochain rendez-vous",
    result: "Ce qu'il faut apporter, les questions à poser et les objections à anticiper.",
    description: "Prépare le prochain rendez-vous à partir des réunions passées, avec engagements, questions ouvertes, objections et objectif. À utiliser avant de revoir un client ou un prospect.",
    body: `# Préparation du prochain rendez-vous

## Rôle

Tu prépares un rendez-vous à partir des réunions passées avec le même interlocuteur.

## Procédure

1. Retrouve les réunions passées avec cet interlocuteur.
2. Liste ce qui a été promis par l'utilisateur et doit être prêt.
3. Liste les questions restées sans réponse.
4. Liste les objections soulevées, avec la réponse à préparer pour chacune.
5. Formule l'objectif du rendez-vous en une phrase.

## Format de sortie

Une page au maximum, avec ces quatre parties et l'objectif en tête.

## Règles

- Distingue ce qui a été dit de ce que tu supposes.
- Si aucune réunion passée n'est trouvée, dis-le et demande les éléments utiles.`,
  },
];

/** Texte complet du fichier SKILL.md, tel qu'il doit être copié */
export function skillFile(skill: ReunionSkill): string {
  return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}\n`;
}

export const CLAUDE_REUNION = {
  slug: "claude-en-reunion",
  metaTitle: "5 skills pour automatiser vos comptes rendus avec Claude et Google Meet",
  metaDescription: fr(
    "5 skills Claude à installer en une fois : compte rendu client, mail de suivi, actions, fiche prospect et prochain rendez-vous. Avec les réglages de Claude dans Google Meet et l'accord des participants."
  ),
  eyebrow: "Fiche gratuite · Claude en réunion",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: "5 skills pour automatiser vos comptes rendus avec <accent>Claude et Google Meet.</accent>",
  subtitle: fr(
    "Claude rejoint vos réunions Google Meet, prend les notes et liste les actions. Installez ces 5 skills en une fois : chaque réunion devient un compte rendu client, un mail de suivi, une liste d'actions et une fiche prospect, sans rien recopier. Les réglages et l'accord des participants sont expliqués pas à pas."
  ),
  promises: ["5 skills à installer en une fois", "Réglages pas à pas", "Message d'accord prêt à copier"],
  /** Ce que Claude fait pendant et après l'appel */
  does: [
    { icon: "video", title: "Il rejoint l'appel", text: fr("Il apparaît comme un participant et l'annonce dans le chat de la réunion.") },
    { icon: "listChecks", title: "Il prend les notes", text: fr("Résumé et actions à mener, sur la page de la réunion, avec la transcription.") },
    { icon: "messageSquareText", title: "Il répond pendant l'appel", text: fr("Dites « Claude » suivi de votre question, ou écrivez-la dans le chat : il répond par écrit.") },
    { icon: "folderCheck", title: "Il crée pendant la réunion", text: fr("Un document, un tableau blanc, des slides : « Claude, fais un document ».") },
    { icon: "mail", title: "Il envoie le récapitulatif", text: fr("Les membres de votre organisation invités reçoivent un email avec le lien vers la page.") },
  ] satisfies readonly { icon: IconName; title: string; text: string }[],
  /** Ce qu'il faut savoir avant de se lancer */
  before: [
    fr("Une offre Claude Team ou Enterprise. La fonction est en bêta."),
    fr("Google Meet uniquement pour l'instant, avec Google Agenda activé par un propriétaire de l'organisation."),
    fr("Pas disponible pour les organisations en rétention zéro des données, en configuration HIPAA ou avec des clés de chiffrement gérées par le client."),
    fr("Claude conserve la transcription, le résumé et des descriptions de l'écran partagé. Il ne conserve pas l'audio."),
    fr("Notes et transcriptions gratuites pendant la bêta. Documents et tableaux blancs gratuits jusqu'au 10 février 2027."),
  ],
  steps: [
    { title: "Connectez votre agenda", text: fr("Dans Claude, ouvrez Meetings et connectez Google Agenda.") },
    { title: "Ajoutez Claude à une réunion", text: fr("Choisissez la réunion dans votre agenda, puis cliquez sur « Add Claude ».") },
    { title: "Ou laissez-le venir seul", text: fr("Dans les paramètres (Settings > Capabilities > Meetings > Auto-join) : toutes vos réunions, ou toutes sauf les tête-à-tête. C'est votre réglage, personne ne le choisit pour vous.") },
    { title: "Gardez la main pendant l'appel", text: fr("Demandez-lui d'arrêter d'écouter, mettez-le en pause depuis la page de la réunion, ou retirez-le avec « Remove Claude ».") },
  ],
  consent: {
    title: "L'accord des participants",
    text: fr("Avant d'ajouter Claude, tous les participants doivent accepter d'être transcrits. Prévenez-les dans l'invitation, puis rappelez-le en ouvrant la réunion."),
    invitation: fr(`Pour ne rien perdre de nos échanges, l'assistant Claude rejoindra la réunion pour prendre les notes et lister les actions. Il conserve la transcription et un résumé, pas l'enregistrement audio.
Si vous préférez qu'il ne participe pas, répondez simplement à ce message : je le retirerai.`),
    opening: fr("Avant de commencer : Claude prend les notes de la réunion, vous le voyez dans la liste des participants. Tout le monde est d'accord ? Sinon je le retire tout de suite."),
  },
  /** Commerciaux : réunions avec un client ou un prospect */
  external: {
    title: "Avec un client ou un prospect",
    points: [
      fr("Par défaut, Claude ne rejoint pas une réunion où un invité extérieur à votre organisation est présent, et la quitte si un extérieur arrive en cours de route."),
      fr("Un propriétaire de l'organisation peut l'autoriser : réglage « Meetings with external guests » de Claude Meetings (bêta)."),
      fr("Dans ce cas, Claude prend les notes et l'annonce dans le chat, mais n'y répond pas. Vos invités n'ont accès ni à la page de la réunion ni à l'email de récapitulatif."),
      fr("Demandez l'accord du client avant la réunion : le message ci-dessus convient tel quel."),
    ],
  },
  skills: skills.map((k) => ({ ...k, title: fr(k.title), result: fr(k.result), body: fr(k.body) })),
  /**
   * Installation des 5 skills en une fois : un ZIP qui contient un ZIP par skill (claude.ai :
   * un skill par ZIP, dossier au nom du skill ; plusieurs ZIP sélectionnables d'un coup à
   * l'import, cf. anthropics/claude-code#82044 du 28/07/2026). Les propriétaires Team et
   * Enterprise peuvent aussi les ajouter pour toute l'organisation (centre d'aide 12512180).
   */
  zip: {
    href: "/g/claude-en-reunion/5-skills-claude-reunion.zip",
    file: "5-skills-claude-reunion.zip",
    folder: "5-skills-claude-reunion",
    steps: [
      fr("Téléchargez le fichier et ouvrez-le : il contient 5 fichiers ZIP, un par skill."),
      fr("Dans Claude, ouvrez Personnaliser > Compétences, cliquez sur « + » puis importez une compétence."),
      fr("Sélectionnez les 5 fichiers ZIP en même temps : les 5 skills apparaissent dans votre liste."),
    ],
    team: fr("Propriétaire d'une organisation Team ou Enterprise ? Vous pouvez aussi les ajouter pour toute l'équipe : ils apparaissent dans la liste de chaque membre."),
  },
  /** Installation d'un skill à la main, en copier-coller (même méthode que le guide 12 skills finance) */
  install: {
    prerequisite: fr("Prérequis : l'exécution de code activée (Paramètres > Capacités). Sur Team et Enterprise, un propriétaire de l'organisation l'active d'abord pour tous."),
    steps: [
      fr("Copiez un skill dans la liste ci-dessus."),
      fr("Dans une nouvelle conversation Claude, collez-le avec la phrase à copier."),
      fr("Enregistrez le fichier proposé par Claude : le skill apparaît dans Personnaliser > Compétences."),
    ],
    phrase: fr("Crée une compétence à partir de ce fichier SKILL.md. Garde exactement le nom, la description et la procédure, sans rien ajouter."),
    use: fr("Ensuite, après une réunion, demandez simplement « le compte rendu client de la réunion avec Dupont » : Claude retrouve la réunion et applique le skill. Pas de déclenchement ? Nommez le skill dans votre demande."),
  },
  sources: [
    { label: "Claude Meetings, annonce du 12/11/2026", href: "https://claude.com/resources/articles/claude-meetings" },
    { label: "Centre d'aide Claude : Use Claude Meetings", href: "https://support.claude.com/en/articles/18325154-use-claude-meetings" },
    { label: "Centre d'aide Claude : Using skills in Claude", href: "https://support.claude.com/en/articles/12512180-using-skills-in-claude" },
  ],
  verifiedOn: "18/11/2026",
  author: "Espoir Mwami",
} as const;

/** Fichier ZIP d'un skill, au format attendu par claude.ai : `<nom>/SKILL.md` */
export function skillZip(skill: ReunionSkill): Uint8Array {
  return createZip([{ path: `${skill.name}/SKILL.md`, data: skillFile(skill) }]);
}

/** Le téléchargement « 5 skills » : un dossier avec un ZIP par skill, à importer d'un coup */
export function skillsBundleZip(): Uint8Array {
  const { folder } = CLAUDE_REUNION.zip;
  return createZip(CLAUDE_REUNION.skills.map((k) => ({ path: `${folder}/${k.name}.zip`, data: skillZip(k) })));
}
