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
 * Claude n'envoie pas d'email de suivi : le prompt 02 en prépare un brouillon.
 */
import type { IconName } from "@/components/icons/lucide";

/** Typographie française : espace insécable avant « : ; ? ! % € », dans les guillemets et entre les milliers. */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

export interface ReunionPrompt {
  number: string;
  title: string;
  result: string;
  prompt: string;
}

const prompts: ReunionPrompt[] = [
  {
    number: "01",
    title: "Le compte rendu à envoyer au client",
    result: "Une page claire : contexte, décisions, prochaines étapes, sans le bruit de la discussion.",
    prompt: `À partir de la réunion [NOM DE LA RÉUNION] du [DATE], rédige le compte rendu à envoyer à [NOM DU CLIENT].
Structure : contexte en 2 phrases, décisions prises, points en suspens, prochaines étapes avec un responsable et une date pour chacune.
Ton professionnel et simple, une page au maximum.
N'écris que ce qui a été dit pendant la réunion : marque « à confirmer » ce qui n'est pas clair.`,
  },
  {
    number: "02",
    title: "Le mail de suivi, prêt à relire",
    result: "Un brouillon de mail de suivi personnalisé, avec les engagements pris de chaque côté.",
    prompt: `À partir de la réunion [NOM DE LA RÉUNION], rédige le mail de suivi que j'envoie à [NOM DU CONTACT].
Remercie en une phrase, rappelle les 3 points clés, liste ce que je m'engage à envoyer et ce que j'attends de lui, avec les dates évoquées.
Termine par une proposition de prochain rendez-vous : [CRÉNEAUX].
C'est un brouillon que je relis : n'envoie rien.`,
  },
  {
    number: "03",
    title: "Les actions, avec un responsable et une date",
    result: "Le tableau des actions de la réunion, prêt à coller dans votre outil de suivi.",
    prompt: `Liste toutes les actions décidées pendant la réunion [NOM DE LA RÉUNION].
Présente un tableau : action | responsable | échéance | dépend de | statut.
Si un responsable ou une échéance n'a pas été dit, écris « à préciser » au lieu de le supposer.
Termine par les 3 actions à lancer en premier.`,
  },
  {
    number: "04",
    title: "La fiche prospect mise à jour",
    result: "Les informations utiles pour votre CRM : besoin, budget, décideurs, calendrier, objections.",
    prompt: `À partir de la réunion avec [NOM DU PROSPECT], prépare la mise à jour de sa fiche dans mon CRM.
Champs : besoin exprimé, enjeu pour lui, décideurs et interlocuteurs cités, budget évoqué, calendrier, objections soulevées, concurrents mentionnés, prochaine étape.
Pour chaque champ, cite la phrase de la réunion qui le justifie. Laisse vide ce qui n'a pas été abordé.`,
  },
  {
    number: "05",
    title: "La préparation du prochain rendez-vous",
    result: "Ce qu'il faut apporter, les questions à poser et les objections à anticiper.",
    prompt: `Je revois [NOM DU CONTACT] le [DATE]. À partir de nos réunions passées dans Claude, prépare ce rendez-vous :
- ce qui a été promis de notre côté et doit être prêt ;
- les questions restées sans réponse ;
- les objections soulevées et la réponse à préparer pour chacune ;
- l'objectif du rendez-vous en une phrase.
Une page au maximum. Distingue ce qui a été dit de ce que tu supposes.`,
  },
];

export const CLAUDE_REUNION = {
  slug: "claude-en-reunion",
  metaTitle: fr("Claude en réunion : la fiche pratique"),
  metaDescription: fr(
    "Claude rejoint vos réunions Google Meet, prend les notes et liste les actions. Les réglages, l'accord des participants, le cas des réunions avec un client et 5 prompts pour l'après-réunion."
  ),
  eyebrow: "Fiche gratuite · Claude en réunion",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: "Le compte rendu et les actions, <accent>prêts à la fin de la réunion.</accent>",
  subtitle: fr(
    "Claude rejoint vos réunions Google Meet, prend les notes et liste les actions. Voici comment le régler, comment prévenir vos participants, et 5 prompts pour transformer la réunion en compte rendu, en mail de suivi et en fiche prospect."
  ),
  promises: ["Réglages pas à pas", "Message d'accord prêt à copier", "5 prompts pour l'après-réunion"],
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
  prompts: prompts.map((p) => ({ ...p, title: fr(p.title), result: fr(p.result), prompt: fr(p.prompt) })),
  promptsNote: fr("À utiliser dans le chat de la page de la réunion, ou dans un chat Claude classique : il retrouve les réunions passées auxquelles vous avez accès."),
  sources: [
    { label: "Claude Meetings, annonce du 12/11/2026", href: "https://claude.com/resources/articles/claude-meetings" },
    { label: "Centre d'aide Claude : Use Claude Meetings", href: "https://support.claude.com/en/articles/18325154-use-claude-meetings" },
  ],
  verifiedOn: "18/11/2026",
  author: "Espoir Mwami",
} as const;
