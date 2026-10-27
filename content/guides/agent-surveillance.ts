/**
 * Fiche de l'agent Surveillance (Agent Althoce), d'après la proposition « Package
 * Surveillance » fournie par Espoir le 27/10/2026 et son post LinkedIn. Le contexte
 * réglementaire (CFE, facturation électronique, BODACC, RNE) est vérifié sur les
 * sources officielles le 27 octobre 2026. Aucun chiffre, prix ni témoignage inventé.
 */

export interface SurveillanceSource {
  id: string;
  name: string;
  /** Où l'agent passe, pour chaque dossier */
  where: string;
  /** Ce qu'il relève (proposition Althoce) */
  reads: string[];
  /** Précision de la proposition Althoce */
  detail?: string;
  /** Contexte officiel vérifié, avec les numéros de ses sources */
  context?: { text: string; sources: number[] };
}

export interface TitledText {
  title: string;
  text: string;
}

const sources: SurveillanceSource[] = [
  {
    id: "impots",
    name: "Impôts",
    where: "Espace professionnel de chaque client",
    reads: ["Avis de CFE", "Avis de taxe foncière", "Compte fiscal : dettes, relances et mises en demeure", "Messages de l'administration"],
    context: { text: "L'avis de CFE n'est pas envoyé par courrier : il se consulte dans l'espace professionnel. La CFE est due au 15 décembre.", sources: [1] },
  },
  {
    id: "urssaf",
    name: "URSSAF",
    where: "Compte URSSAF de chaque client",
    reads: ["Messages et documents du compte", "Avis à payer", "Dettes et mises en demeure"],
    detail: "Chaque pièce téléchargée est rangée dans le dossier d'échange de son client.",
  },
  {
    id: "registres",
    name: "INPI et BODACC",
    where: "Registres publics, à partir du SIREN",
    reads: ["Annonces légales", "Procédures collectives", "Dirigeants et associés connus au registre public"],
    detail: "Avec la source et la date du relevé. On y lit qui est le gérant de ce client.",
    context: { text: "Le BODACC publie notamment les procédures collectives, les ventes et cessions et les radiations. Les données publiques du registre national des entreprises sont consultables par tous.", sources: [3, 4] },
  },
  {
    id: "facturation",
    name: "Facturation électronique",
    where: "Annuaire des plateformes",
    reads: ["Plateforme déclarée contre plateforme relevée", "Mandats", "Raccordement de chaque client"],
    detail: "Avec le prochain geste à poser, client par client.",
    context: { text: "Depuis le 1er septembre 2026, toutes les entreprises concernées doivent pouvoir recevoir leurs factures électroniques par une plateforme agréée. Les PME, TPE et micro-entreprises émettront à partir du 1er septembre 2027.", sources: [2] },
  },
];

export const AGENT_SURVEILLANCE = {
  edition: "27 octobre 2026",
  intro:
    "Chaque matin, vos collaborateurs ouvrent l'espace impôts, puis l'URSSAF, puis le BODACC. Client par client. L'agent Surveillance le fait pendant la nuit, sur chaque dossier du portefeuille. Il range ce qu'il trouve dans le bon dossier et vous remet, le matin, uniquement ce qui est nouveau.",
  sources,
  morning: [
    { title: "Le neuf seulement", text: "Chaque pièce arrive rangée au bon dossier, par date, avec le fichier ouvrable." },
    { title: "Les alertes restent visibles", text: "Un avis à payer, une dette, une mise en demeure ou une procédure collective reste signalé jusqu'à ce que vous le marquiez traité." },
    { title: "Un seul point du matin", text: "Les portails, la production et la boîte mail du cabinet réunis dans la même page, au même moment." },
    { title: "Votre assistant le sait", text: "À la demande, il liste la récolte de la nuit, ouvre la fiche d'un dossier, marque un élément traité ou relance un relevé." },
  ] satisfies TitledText[],
  highlight: "Une mise en demeure URSSAF repérée dès le relevé de la nuit, pas à la clôture.",
  steps: [
    { title: "Votre liste de clients", text: "Vous collez la liste de vos clients. Chaque société sans SIREN est cherchée au registre public." },
    { title: "Les cas douteux", text: "Vous tranchez à l'écran les rapprochements incertains. Le rapport dit ensuite ce qui peut être surveillé, source par source." },
    { title: "Les accès", text: "Le BODACC et l'INPI ne demandent que le SIREN. Les impôts et l'URSSAF s'ouvrent avec l'accès du cabinet à chaque espace." },
  ] satisfies TitledText[],
  launch: "Mise en service sous deux semaines après signature, avec la formation de vos collaborateurs.",
  guarantees: [
    { title: "Lecture seule", text: "L'agent consulte une liste fermée de pages. Il ne paie, ne déclare et ne signe jamais." },
    { title: "Rien ne part sans vous", text: "Rien ne part chez un client sans votre validation. Une relance préparée attend votre accord." },
    { title: "Vos données restent chez vous", text: "La console tourne sur un serveur en France, au nom du cabinet. Les identifiants des espaces officiels restent dans votre console." },
  ] satisfies TitledText[],
  offer:
    "Le package Surveillance des comptes officiels est posé dans votre console avec votre liste de clients, vos accès et votre point du matin. L'abonnement est chiffré selon la taille de l'équipe. Il couvre l'ajout progressif d'autres agents, au rythme du cabinet : collecte, révision, pré-saisie, banque.",
  officialSources: [
    { label: "DGFiP : la cotisation foncière des entreprises, dépliant 2026 (impots.gouv.fr)", url: "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/pro_depliant_cfe_2026.pdf" },
    { label: "DGFiP : facturation électronique, guide pratique de démarrage au 1er septembre 2026 (impots.gouv.fr)", url: "https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf" },
    { label: "DILA : API du Bulletin officiel des annonces civiles et commerciales (data.gouv.fr)", url: "https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-civiles-et-commerciales-bodacc" },
    { label: "INPI : le Registre national des entreprises", url: "https://www.inpi.fr/ressources/formalites-dentreprises/registre-national-entreprises" },
  ],
};
