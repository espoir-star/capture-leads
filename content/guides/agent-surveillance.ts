/**
 * Fiche de l'agent Surveillance (Agent Althoce), d'après la proposition « Package
 * Surveillance » fournie par Espoir le 27/10/2026 et son post LinkedIn.
 * Les délais et sanctions (« Ce que coûte un oubli ») sont vérifiés le 27 octobre 2026
 * sur Légifrance et impots.gouv.fr. Aucun prix ni témoignage. Le point du matin est un
 * exemple fictif ; le calcul du relevé manuel part des chiffres saisis par le lecteur.
 */

export type PortalIcon = "landmark" | "building" | "newspaper" | "receipt";

export interface SurveillanceSource {
  id: string;
  name: string;
  icon: PortalIcon;
  /** Où l'agent passe, pour chaque dossier */
  where: string;
  /** Ce qu'il relève (proposition Althoce) */
  reads: string[];
}

export interface Stake {
  /** Portail et pièce concernée */
  source: string;
  icon: PortalIcon;
  event: string;
  /** Le chiffre ou le délai à retenir, affiché en badge */
  key: string;
  /** Délai ou conséquence, vérifié */
  rule: string;
  /** Numéros des sources officielles */
  refs: number[];
}

export interface TitledText {
  title: string;
  text: string;
}

export interface MorningItem {
  portal: string;
  file: string;
  event: string;
  status: string;
  alert: boolean;
}

const sources: SurveillanceSource[] = [
  {
    id: "impots",
    name: "Impôts",
    icon: "landmark",
    where: "Espace professionnel de chaque client",
    reads: ["Avis de CFE et de taxe foncière", "Compte fiscal : dettes, relances, mises en demeure", "Messages de l'administration"],
  },
  {
    id: "urssaf",
    name: "URSSAF",
    icon: "building",
    where: "Compte URSSAF de chaque client",
    reads: ["Avis à payer", "Dettes et mises en demeure", "Messages et documents du compte"],
  },
  {
    id: "registres",
    name: "INPI et BODACC",
    icon: "newspaper",
    where: "Registres publics, à partir du SIREN",
    reads: ["Annonces légales", "Procédures collectives", "Dirigeants et associés, avec la date du relevé"],
  },
  {
    id: "facturation",
    name: "Facturation électronique",
    icon: "receipt",
    where: "Annuaire des plateformes",
    reads: ["Plateforme déclarée contre plateforme relevée", "Mandats", "Raccordement et prochain geste à poser"],
  },
];

export const AGENT_SURVEILLANCE = {
  edition: "27 octobre 2026",
  intro:
    "Impôts, URSSAF, BODACC : l'agent passe chaque nuit sur les espaces officiels de vos clients. Le matin, vous ne recevez que le nouveau.",
  stakes: [
    { source: "Impôts", icon: "landmark", event: "Avis de CFE", key: "+5\u00a0%", rule: "Pas envoyé par courrier : il est déposé dans l'espace professionnel. Solde dû au 15 décembre, puis majoration de 5\u00a0%.", refs: [1, 2] },
    { source: "Impôts", icon: "landmark", event: "Avis de taxe foncière", key: "+10\u00a0%", rule: "Tout retard de paiement entraîne une majoration de 10\u00a0%.", refs: [3] },
    { source: "URSSAF", icon: "building", event: "Mise en demeure", key: "Avant poursuite", rule: "Étape obligatoire avant toute action ou poursuite. Elle chiffre les sommes, les majorations et les pénalités.", refs: [4, 5] },
    { source: "BODACC", icon: "newspaper", event: "Procédure collective d'un client", key: "2 mois", rule: "Les créanciers, dont le cabinet s'il lui reste des honoraires dus, ont deux mois après la publication au BODACC pour déclarer leur créance.", refs: [6] },
    { source: "Facturation électronique", icon: "receipt", event: "Client sans plateforme agréée", key: "3 mois", rule: "Réception obligatoire depuis le 1er septembre 2026. À défaut, mise en demeure de se conformer sous trois mois, puis amende.", refs: [7] },
  ] satisfies Stake[],
  sources,
  /** Exemple fictif : dossiers anonymes, aucune donnée réelle */
  morningExample: [
    { portal: "URSSAF", file: "Dossier 014 · SARL", event: "Mise en demeure, PDF rangé au dossier", status: "Alerte ouverte", alert: true },
    { portal: "BODACC", file: "Dossier 041 · EURL", event: "Jugement d'ouverture publié", status: "Alerte ouverte", alert: true },
    { portal: "Impôts", file: "Dossier 027 · SAS", event: "Avis de CFE 2026 en ligne", status: "À payer au 15 décembre", alert: false },
    { portal: "Facturation électronique", file: "Dossier 008 · SARL", event: "Aucune plateforme relevée", status: "Prochain geste : choisir une plateforme", alert: false },
  ] satisfies MorningItem[],
  morning: [
    { title: "Le neuf seulement", text: "Rangé au bon dossier, avec le fichier." },
    { title: "Les alertes restent", text: "Jusqu'à ce que vous les marquiez traitées." },
    { title: "Un seul point du matin", text: "Portails, production et boîte mail réunis." },
    { title: "Votre assistant le sait", text: "Il liste la récolte et relance un relevé." },
  ] satisfies TitledText[],
  steps: [
    { title: "Votre liste de clients", text: "Vous la collez. Chaque société sans SIREN est cherchée au registre public." },
    { title: "Les cas douteux", text: "Vous tranchez à l'écran les rapprochements incertains. Le rapport dit ce qui peut être surveillé, source par source." },
    { title: "Les accès", text: "Le BODACC et l'INPI ne demandent que le SIREN. Les impôts et l'URSSAF s'ouvrent avec l'accès du cabinet à chaque espace." },
  ] satisfies TitledText[],
  launch: "Mise en service sous deux semaines après signature, avec la formation de vos collaborateurs.",
  guarantees: [
    { title: "Lecture seule", text: "Une liste fermée de pages. L'agent ne paie, ne déclare et ne signe jamais." },
    { title: "Rien ne part sans vous", text: "Rien ne part chez un client sans votre validation. Une relance préparée attend votre accord." },
    { title: "Vos données chez vous", text: "Un serveur en France, au nom du cabinet. Les identifiants des espaces officiels restent dans votre console." },
  ] satisfies TitledText[],
  offer:
    "Le package Surveillance des comptes officiels est posé dans votre console avec votre liste de clients, vos accès et votre point du matin. L'abonnement est chiffré selon la taille de l'équipe. Il couvre l'ajout progressif d'autres agents, au rythme du cabinet : collecte, révision, pré-saisie, banque.",
  officialSources: [
    { label: "DGFiP : la cotisation foncière des entreprises, dépliant 2026", url: "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/pro_depliant_cfe_2026.pdf" },
    { label: "Code général des impôts, art. 1731 B (majoration de la CFE, renvoi à l'art. 1731 : 5 %)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000023376534" },
    { label: "Code général des impôts, art. 1730 (majoration de 10 %, dont taxes foncières)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051219475" },
    { label: "Code de la sécurité sociale, art. L244-2 (mise en demeure préalable)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037947880" },
    { label: "Code de la sécurité sociale, art. R244-1 (contenu de la mise en demeure)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053220402" },
    { label: "Code de commerce, art. R622-24 (déclaration des créances : deux mois)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029175247" },
    { label: "DGFiP : facturation électronique, guide pratique de démarrage au 1er septembre 2026", url: "https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf" },
  ],
};

/** Relevé à la main : dossiers × portails × minutes × passages par mois, en heures (arrondi à l'heure). */
export function manualReviewHours(v: { files: number; portals: number; minutes: number; perMonth: number }) {
  const ok = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const month = (ok(v.files) * ok(v.portals) * ok(v.minutes) * ok(v.perMonth)) / 60;
  return { month: Math.round(month), year: Math.round(month * 12) };
}
