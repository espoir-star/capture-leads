/**
 * Pages de rendez-vous : /rdv/<slug>. Le visiteur réserve directement un créneau
 * dans un agenda de rendez-vous Google, sans formulaire ni email intermédiaire.
 * L'agenda est affiché ouvert dès l'arrivée sur la page (choix d'Espoir du
 * 28/10/2026, components/BookingCalendar.tsx).
 *
 * Une page = un bloc de configuration : tous les textes affichés sont ici, la mise
 * en page est commune (app/rdv/[slug]/page.tsx). Uniquement des faits vérifiés ou
 * le texte du post qui mène à la page.
 *
 * audit-connecteurs, post du 29/10/2026 « Catégoriser, lettrer, saisir » (audit
 * d'installation gratuit, texte d'Espoir) : logiciels et temps gagné donnés par
 * Espoir le 28/10/2026 (ACD, Cegid Loop, Sage Génération Experts, MyUnisoft, Inqom en
 * écriture comme Pennylane ; logiciels fermés en sur mesure ; aucune mention du
 * fichier FEC ; « une matinée par dossier […] se relit en quelques minutes », texte
 * du post), lecture seule du MCP Pennylane revérifiée sur pennylane.com/fr/mcp le
 * 28/10/2026, Isacompta édité par AGIRIS pour les cabinets (agiris.fr).
 *
 * demo-agents-ia, post du 10/11/2026 « Saisie, rapprochement, collecte des pièces »
 * (démo de la plateforme d'agents IA, texte d'Espoir, dont « plus de 20 cabinets ») :
 * agenda « Pré-audit IA offert - Althoce » vérifié le 10/11/2026 (30 min, Google Meet,
 * le même que les guides et les emails) ; « ce qui prend trop de place aujourd'hui »
 * repris du pré-audit offert d'althoce.com.
 */
import type { IconName } from "@/components/icons/lucide";

/** Carte ou encadré : icône, titre, texte */
export interface RdvPoint {
  icon: IconName;
  title: string;
  text: string;
}

/** Ligne de la liste détaillée : tuile d'icône à gauche et pastille à droite, facultatives */
export interface RdvDetail {
  icon?: IconName;
  title: string;
  status?: string;
  text: string;
  source?: { label: string; url: string };
}

export interface RdvPage {
  slug: string;
  /** Métadonnées (onglet, partage) */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: string;
  subtitle: string;
  /** Pastille après la durée et Google Meet (« Gratuit », « Offert ») */
  priceLabel: string;
  booking: {
    /** Lien public de l'agenda (nouvel onglet) */
    url: string;
    /** Même agenda, version intégrable (gv=true) */
    embedUrl: string;
    title: string;
    durationMin: number;
  };
  host: { name: string; role: string; photo: string };
  /** Cartes sous l'en-tête : ce que le rendez-vous apporte */
  deliverablesTitle: string;
  deliverables: RdvPoint[];
  /** Phrase sous les cartes (honnêteté, preuve) */
  note: { icon: IconName; text: string };
  /** Le travail confié à l'IA : encadré mis en avant, liste des tâches, carte à côté */
  work: {
    eyebrow: string;
    title: string;
    highlight: RdvPoint;
    tasks: string[];
    /** Dernière ligne de la liste : elle n'est pas exhaustive */
    tasksMore: string;
    aside: RdvPoint;
  };
  /** Liste détaillée (logiciels, données…), puis relance vers les créneaux */
  details: {
    /** Ancre de la section */
    id: string;
    eyebrow: string;
    title: string;
    items: RdvDetail[];
    /** Phrase à côté du second bouton « Choisir mon créneau » */
    cta: string;
  };
  /** Webinar proposé à ceux qui ne réservent pas (affiché tant que les inscriptions sont ouvertes) */
  webinarSlug?: string;
}

const ESPOIR = { name: "Espoir Mwami", role: "Fondateur d'Althoce", photo: "/webinar/espoir-mwami.jpg" };

export const RDV_PAGES: Readonly<Record<string, RdvPage>> = {
  "audit-connecteurs": {
    slug: "audit-connecteurs",
    metaTitle: "Audit d'installation gratuit : votre IA dans votre logiciel",
    metaDescription:
      "30 minutes en visio pour savoir ce que votre IA peut lire et écrire dans votre logiciel, et ce qu'elle peut préparer à votre place.",
    eyebrow: "Audit d'installation · 100 % gratuit",
    title: "Votre IA peut-elle <accent>écrire dans votre logiciel ?</accent>",
    subtitle: "En 30 minutes de visio, vous savez ce qui est branchable chez vous et par où commencer.",
    priceLabel: "Gratuit",
    booking: {
      // Agenda « Connecteurs IA MCP - By Althoce » (le même que althoce.com/connecteurs) : 30 min, Google Meet.
      url: "https://calendar.app.google/m6thfjDsXzEqKdkKA",
      embedUrl:
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1V23SISY0aSuyhcnrP4bc_sW4fiTlVVr4FmYIMIGcBSEmD5RiEkyMrrO4YWE9SY_-YTHJxE6I_?gv=true&hl=fr",
      title: "Audit d'installation",
      durationMin: 30,
    },
    host: ESPOIR,
    deliverablesTitle: "Ce que l'audit vous apporte",
    deliverables: [
      { icon: "plug", title: "Ce qui est branchable", text: "Sur votre logiciel : lecture, écriture, ou les deux." },
      { icon: "route", title: "La méthode adaptée", text: "Connecteur officiel ou sur mesure, adapté aux spécificités de votre logiciel." },
      { icon: "listChecks", title: "Les tâches à confier en premier", text: "Et le temps gagné sur chacune." },
      { icon: "userCheck", title: "Le bon compte Claude ou ChatGPT", text: "Pour traiter des données clients." },
    ],
    note: { icon: "shieldCheck", text: "Si votre logiciel ne permet pas l'écriture, on vous le dit dès l'audit." },
    work: {
      eyebrow: "Ce que votre IA prépare à votre place",
      title: "Vous ne saisissez plus, vous validez",
      highlight: {
        icon: "clock",
        title: "Une matinée par dossier, relue en quelques minutes",
        text: "Catégoriser, lettrer, saisir : votre IA le prépare pendant que vous faites autre chose. Vous relisez, vous validez.",
      },
      tasks: [
        "Catégoriser les transactions",
        "Affecter un tiers",
        "Ventiler une facture fournisseur",
        "Lettrer et rapprocher",
        "Passer des écritures",
      ],
      tasksMore: "Et d'autres tâches, selon vos besoins",
      aside: {
        icon: "shieldCheck",
        title: "Votre IA propose, vous décidez.",
        text: "Rien ne part dans le dossier sans votre accord. Dans Claude, chaque type d'action se règle sur « toujours autorisé », « validation requise » ou « bloqué ». Dans ChatGPT, les écritures demandent une confirmation par défaut.",
      },
    },
    details: {
      id: "logiciels",
      eyebrow: "Votre logiciel",
      title: "Chaque connecteur s'adapte à votre logiciel",
      items: [
        {
          title: "Pennylane",
          status: "Lecture et écriture",
          text: "Le connecteur officiel est en lecture seule à ce jour. Le connecteur Althoce ajoute l'écriture.",
          source: { label: "pennylane.com/fr/mcp", url: "https://www.pennylane.com/fr/mcp" },
        },
        {
          title: "ACD, Cegid Loop, Sage Génération Experts, MyUnisoft, Inqom",
          status: "Lecture et écriture",
          text: "Comme pour Pennylane, votre IA lit vos dossiers et y écrit, avec votre validation.",
        },
        {
          title: "Cegid Quadra, Quadratus, Coala, Isacompta (AGIRIS)",
          status: "Sur mesure",
          text: "Logiciels fermés : on construit un connecteur sur mesure.",
        },
      ],
      cta: "Votre logiciel n'est pas dans la liste ? C'est l'objet de l'audit.",
    },
    webinarSlug: "connecteurs-mcp-cabinets",
  },
  "demo-agents-ia": {
    slug: "demo-agents-ia",
    metaTitle: "Démo : tous les agents IA du cabinet sur une seule plateforme",
    metaDescription:
      "30 minutes en visio : la plateforme d'agents IA montrée sur de vrais dossiers, et votre pré-audit offert. Vos données ne quittent jamais l'Europe.",
    eyebrow: "Démo en visio · Pré-audit offert",
    title: "Ce qui prend des jours au cabinet <accent>tourne désormais tout seul</accent>",
    subtitle: "Tous les agents IA du cabinet sur une seule plateforme, installée chez vous. Vos données ne quittent jamais l'Europe.",
    priceLabel: "Offert",
    booking: {
      // Agenda « Pré-audit IA offert - Althoce » (le même que les guides et les emails) : 30 min, Google Meet.
      url: "https://calendar.app.google/JmhxjFqk2kybuFLR9",
      embedUrl:
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3fJwV7FRh514CDPeI7xaMilYOxLNenoXdF9ZNlL4NRkEUuO5fK3TUzHRcdNsf4A3IwA8Xx0Xbl?gv=true&hl=fr",
      title: "Démo et pré-audit",
      durationMin: 30,
    },
    host: ESPOIR,
    deliverablesTitle: "Ce que la démo vous apporte",
    deliverables: [
      { icon: "video", title: "La plateforme en action", text: "Des cas d'usage concrets, sur de vrais dossiers." },
      { icon: "scanSearch", title: "Votre pré-audit", text: "Ce qui prend trop de place à votre cabinet aujourd'hui." },
      { icon: "route", title: "Par où commencer", text: "Les premiers agents à mettre en place chez vous." },
      { icon: "messageSquareText", title: "Vos questions", text: "Installation, données, validation : on y répond en direct." },
    ],
    note: { icon: "building", text: "La solution tourne déjà dans plus de 20 cabinets." },
    work: {
      eyebrow: "La plateforme",
      title: "Ce qu'elle prend en charge",
      highlight: {
        icon: "listChecks",
        title: "Tous les agents IA du cabinet, au même endroit",
        text: "Un seul endroit pour suivre tous les dossiers.",
      },
      tasks: [
        "La saisie et la production",
        "Le rapprochement bancaire",
        "La collecte des pièces auprès de vos clients",
        "La récupération des documents sur les espaces officiels : impôts, URSSAF, BODACC",
      ],
      tasksMore: "Et bien d'autres tâches du quotidien",
      aside: {
        icon: "userCheck",
        title: "Les agents préparent, vos collaborateurs valident.",
        text: "Plus de copier-coller entre cinq outils.",
      },
    },
    details: {
      id: "donnees",
      eyebrow: "Vos données",
      title: "Vos données restent chez vous",
      items: [
        {
          icon: "server",
          title: "En Europe, ou sur votre serveur",
          text: "Les agents tournent sur des modèles hébergés en Europe, ou directement sur votre serveur.",
        },
        { icon: "lock", title: "Pas d'IA grand public", text: "Aucune donnée client n'y est envoyée." },
        { icon: "shieldCheck", title: "Votre validation d'abord", text: "Rien ne part chez un client sans votre validation." },
      ],
      cta: "Votre cabinet a des exigences particulières ? C'est l'objet du pré-audit.",
    },
  },
};

export function getRdvPage(slug: string): RdvPage | undefined {
  return Object.hasOwn(RDV_PAGES, slug) ? RDV_PAGES[slug] : undefined;
}

export function getRdvSlugs(): string[] {
  return Object.keys(RDV_PAGES);
}
