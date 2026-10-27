/**
 * Fiche de l'agent Surveillance (Agent Althoce), d'après la proposition « Package
 * Surveillance » et les précisions d'Espoir du 27/10/2026 : déjà en service dans plusieurs
 * cabinets, une seule connexion avec les accès du cabinet, relié à la boîte mail avec
 * envois sous validation, prix sur rendez-vous.
 *
 * La checklist et le tableau de suivi sont utilisables sans l'agent. Règles, rubriques et
 * délais vérifiés le 27 octobre 2026 sur Légifrance, impots.gouv.fr et bodacc.fr.
 * Le point du matin est un exemple fictif ; le calcul part des chiffres saisis par le lecteur.
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

export interface ChecklistItem {
  portal: string;
  icon: PortalIcon;
  item: string;
  /** Moment à retenir, affiché en badge */
  when: string;
  /** Où le trouver, quand la rubrique est documentée */
  where?: string;
  /** Ce que fait le cabinet, appuyé sur la règle officielle */
  action: string;
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
    "La méthode pour ne rien laisser passer sur les portails de vos clients, puis l'agent qui l'applique chaque nuit à votre place.",
  proof: "Déjà en service dans plusieurs cabinets.",
  checklist: [
    { portal: "Impôts", icon: "landmark", item: "Avis de CFE", when: "Solde au 15 déc.", where: "Espace professionnel, Consulter > Avis C.F.E. Il n'arrive pas par courrier.", action: "Prévenir le client, ou l'inscrire au prélèvement à l'échéance avant le 30 novembre. Après le 15 décembre, majoration de 5 %.", refs: [1, 2, 3] },
    { portal: "Impôts", icon: "landmark", item: "Compte fiscal et messages", when: "En continu", action: "Relances, dettes et mises en demeure se traitent avec le client avant toute majoration. Une taxe foncière payée en retard est majorée de 10 %.", refs: [4] },
    { portal: "URSSAF", icon: "building", item: "Mise en demeure", when: "Dès réception", action: "La traiter avec le client sans attendre : elle précède obligatoirement toute poursuite et chiffre les sommes, les majorations et les pénalités.", refs: [5, 6] },
    { portal: "BODACC", icon: "newspaper", item: "Procédure collective d'un client", when: "2 mois", where: "bodacc.fr, recherche par SIREN, catégorie « Procédures collectives ».", action: "Déclarer la créance d'honoraires du cabinet dans les deux mois qui suivent la publication du jugement d'ouverture.", refs: [7, 8] },
    { portal: "Facturation électronique", icon: "receipt", item: "Client sans plateforme agréée", when: "Depuis le 1/9/2026", action: "L'aider à désigner sa plateforme et garder la trace de la démarche. À défaut, mise en demeure de se conformer sous trois mois, puis amende.", refs: [9] },
  ] satisfies ChecklistItem[],
  /** Tableau de suivi : les étapes que le guide DGFiP demande de pouvoir prouver */
  einvoiceTable: {
    columns: ["Client", "SIREN", "Solution de réception", "Plateforme agréée confirmée", "Raccordement ou désignation (date)", "Trace conservée", "Prochain geste"],
    example: ["Dossier 008 · SARL", "à compléter", "Logiciel de facturation", "Non", "", "Mail au client du 12/10", "Choisir une plateforme agréée"],
    note: "Une entreprise sans plateforme doit engager la démarche et pouvoir le montrer : solution choisie, raccordement, échanges conservés.",
    refs: [9],
  },
  sources,
  mail: "Il prépare les relances aux clients depuis la boîte du cabinet. Elles partent seulement après votre validation.",
  /** Exemple fictif : dossiers anonymes, aucune donnée réelle */
  morningExample: [
    { portal: "URSSAF", file: "Dossier 014 · SARL", event: "Mise en demeure, PDF rangé au dossier", status: "Alerte ouverte", alert: true },
    { portal: "BODACC", file: "Dossier 041 · EURL", event: "Jugement d'ouverture publié", status: "Alerte ouverte", alert: true },
    { portal: "Impôts", file: "Dossier 027 · SAS", event: "Avis de CFE 2026 en ligne", status: "À payer au 15 décembre", alert: false },
    { portal: "Facturation électronique", file: "Dossier 008 · SARL", event: "Aucune plateforme relevée", status: "Relance prête à valider", alert: false },
  ] satisfies MorningItem[],
  morning: [
    { title: "Le neuf seulement", text: "Rangé au bon dossier, avec le fichier." },
    { title: "Les alertes restent", text: "Jusqu'à ce que vous les marquiez traitées." },
    { title: "Portails et boîte mail", text: "Réunis dans le même point du matin." },
    { title: "À la demande", text: "Il ouvre la fiche d'un dossier ou relance un relevé." },
  ] satisfies TitledText[],
  steps: [
    { title: "Votre liste de clients", text: "Vous la collez. Chaque société sans SIREN est cherchée au registre public." },
    { title: "Les cas douteux", text: "Vous tranchez à l'écran les rapprochements incertains. Le rapport dit ce qui peut être surveillé, source par source." },
    { title: "Une seule connexion", text: "Le BODACC et l'INPI ne demandent que le SIREN. Pour les impôts et l'URSSAF, le cabinet se connecte une fois avec ses accès, puis l'agent prend le relais chaque nuit." },
  ] satisfies TitledText[],
  launch: "Mise en service sous deux semaines après signature, avec la formation de vos collaborateurs.",
  guarantees: [
    { title: "Lecture seule sur les portails", text: "Une liste fermée de pages. L'agent ne paie, ne déclare et ne signe jamais." },
    { title: "Aucun envoi sans vous", text: "Rien ne part chez un client sans votre validation. Chaque relance préparée attend votre accord." },
    { title: "Vos données chez vous", text: "La console de l'agent tourne sur un serveur en France, au nom du cabinet. Les identifiants y restent." },
  ] satisfies TitledText[],
  offer:
    "En 30 minutes, nous regardons votre portefeuille, vos accès et ce que l'agent relèverait pour vous. Le package Surveillance est chiffré sur rendez-vous, selon la taille de l'équipe. Il s'ouvre ensuite à d'autres agents, au rythme du cabinet : collecte, révision, pré-saisie, banque.",
  officialSources: [
    { label: "DGFiP : la cotisation foncière des entreprises, dépliant 2026", url: "https://www.impots.gouv.fr/sites/default/files/media/3_Documentation/depliants/pro_depliant_cfe_2026.pdf" },
    { label: "impots.gouv.fr : avis de CFE dans l'espace professionnel (Consulter > Avis C.F.E)", url: "https://www.impots.gouv.fr/actualite/cfe-etou-ifer-2025-mise-en-ligne-des-avis-dimpot-dans-lespace-professionnel" },
    { label: "Code général des impôts, art. 1731 B (majoration de la CFE, renvoi à l'art. 1731 : 5 %)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000023376534" },
    { label: "Code général des impôts, art. 1730 (majoration de 10 %, dont taxes foncières)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051219475" },
    { label: "Code de la sécurité sociale, art. L244-2 (mise en demeure préalable)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037947880" },
    { label: "Code de la sécurité sociale, art. R244-1 (contenu de la mise en demeure)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053220402" },
    { label: "Code de commerce, art. R622-24 (déclaration des créances : deux mois)", url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029175247" },
    { label: "bodacc.fr : recherche des annonces commerciales par SIREN", url: "https://www.bodacc.fr/pages/annonces-commerciales-recherche/" },
    { label: "DGFiP : facturation électronique, guide pratique de démarrage au 1er septembre 2026", url: "https://www.impots.gouv.fr/sites/default/files/media/1_metier/2_professionnel/EV/2_gestion/290_facturation_electronique/guide_pratique_facturation_electronique.pdf" },
  ],
};

/** Tableau de suivi au format tableur (tabulations) : l'en-tête et l'exemple se collent dans Excel ou Sheets. */
export function einvoiceTableTsv(t: { columns: readonly string[]; example: readonly string[] } = AGENT_SURVEILLANCE.einvoiceTable): string {
  return [t.columns, t.example].map((row) => row.join("\t")).join("\n");
}

/** Relevé à la main : dossiers × portails × minutes × passages par mois, en heures (arrondi à l'heure). */
export function manualReviewHours(v: { files: number; portals: number; minutes: number; perMonth: number }) {
  const ok = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const month = (ok(v.files) * ok(v.portals) * ok(v.minutes) * ok(v.perMonth)) / 60;
  return { month: Math.round(month), year: Math.round(month * 12) };
}
