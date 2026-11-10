/**
 * Pages de rendez-vous : /rdv/<slug>. Le visiteur réserve directement un créneau
 * dans un agenda de rendez-vous Google, sans formulaire ni email intermédiaire.
 * L'agenda est affiché ouvert dès l'arrivée sur la page (choix d'Espoir du
 * 28/10/2026, components/BookingCalendar.tsx).
 *
 * Une page = un bloc de configuration : tous les textes affichés sont ici, et les
 * blocs sous l'en-tête s'affichent dans l'ordre de `blocks`. La mise en page est
 * commune (app/rdv/[slug]/page.tsx). Uniquement des faits vérifiés ou le texte du
 * post qui mène à la page.
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
 * d'abord les tâches automatisées, puis l'agenda, puis ce que la démo apporte, pour
 * que le visiteur se projette avant de réserver (demande d'Espoir du 10/11/2026).
 * Chaque tâche décrit le travail nommé dans le post, avec sa règle « les agents
 * préparent, vos collaborateurs valident ». Agenda « Pré-audit IA offert - Althoce »
 * vérifié le 10/11/2026 (30 min, Google Meet, le même que les guides et les emails) ;
 * « ce qui prend trop de place aujourd'hui » repris du pré-audit offert d'althoce.com.
 */
import type { IconName } from "@/components/icons/lucide";

/** Carte : icône, titre, texte */
export interface RdvPoint {
  icon: IconName;
  title: string;
  text: string;
}

/** Phrase précédée d'une icône (honnêteté, preuve) */
export interface RdvNote {
  icon: IconName;
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

/** Blocs affichés sous l'en-tête, dans l'ordre choisi pour chaque page */
export type RdvBlock =
  /** Cartes juste sous l'en-tête : titre discret en petites capitales, phrase en dessous */
  | { kind: "apports"; title: string; items: RdvPoint[]; note: RdvNote }
  /** Section titrée de cartes ; ligne « et d'autres », encadré de points forts et phrase facultatifs */
  | {
      kind: "cartes";
      id: string;
      eyebrow: string;
      title: string;
      items: RdvPoint[];
      more?: string;
      points?: { title: string; items: string[] };
      note?: RdvNote;
    }
  /** Encadré mis en avant, liste des tâches (la dernière ligne dit qu'elle n'est pas exhaustive) et carte à côté */
  | {
      kind: "travail";
      id: string;
      eyebrow: string;
      title: string;
      highlight: RdvPoint;
      tasks: string[];
      tasksMore: string;
      aside: RdvPoint;
    }
  /** Liste détaillée (logiciels, données…), puis relance vers les créneaux */
  | { kind: "liste"; id: string; eyebrow: string; title: string; items: RdvDetail[]; cta: string }
  /** L'agenda (ancre #creneaux) */
  | { kind: "agenda" };

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
  blocks: RdvBlock[];
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
    blocks: [
      {
        kind: "apports",
        title: "Ce que l'audit vous apporte",
        items: [
          { icon: "plug", title: "Ce qui est branchable", text: "Sur votre logiciel : lecture, écriture, ou les deux." },
          { icon: "route", title: "La méthode adaptée", text: "Connecteur officiel ou sur mesure, adapté aux spécificités de votre logiciel." },
          { icon: "listChecks", title: "Les tâches à confier en premier", text: "Et le temps gagné sur chacune." },
          { icon: "userCheck", title: "Le bon compte Claude ou ChatGPT", text: "Pour traiter des données clients." },
        ],
        note: { icon: "shieldCheck", text: "Si votre logiciel ne permet pas l'écriture, on vous le dit dès l'audit." },
      },
      { kind: "agenda" },
      {
        kind: "travail",
        id: "ia",
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
      {
        kind: "liste",
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
    ],
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
    blocks: [
      {
        kind: "cartes",
        id: "plateforme",
        eyebrow: "La plateforme",
        title: "Ce qu'elle automatise dans votre cabinet",
        items: [
          {
            icon: "receipt",
            title: "La saisie et la production",
            text: "Les pièces sont saisies, la production avance. Vos collaborateurs relisent et valident.",
          },
          {
            icon: "arrowLeftRight",
            title: "Le rapprochement bancaire",
            text: "Les opérations bancaires sont rapprochées des pièces et des écritures. Vous validez les propositions.",
          },
          {
            icon: "mail",
            title: "La collecte des pièces auprès de vos clients",
            text: "Les pièces manquantes sont demandées à vos clients et réunies dans le dossier. Rien ne part sans votre validation.",
          },
          {
            icon: "landmark",
            title: "Les documents des espaces officiels",
            text: "Impôts, URSSAF, BODACC : les documents sont récupérés pour vous, sans vous connecter site par site.",
          },
        ],
        more: "Et bien d'autres tâches du quotidien",
        points: {
          title: "Ce qui change pour le cabinet",
          items: [
            "Les agents préparent, vos collaborateurs valident",
            "Plus de copier-coller entre cinq outils",
            "Un seul endroit pour suivre tous les dossiers",
          ],
        },
        note: { icon: "building", text: "La solution tourne déjà dans plus de 20 cabinets." },
      },
      { kind: "agenda" },
      {
        kind: "cartes",
        id: "demo",
        eyebrow: "En 30 minutes",
        title: "Ce que la démo vous apporte",
        items: [
          { icon: "video", title: "Des cas d'usage concrets", text: "Montrés en direct, sur de vrais dossiers." },
          { icon: "scanSearch", title: "Votre pré-audit", text: "Ce qui prend trop de place à votre cabinet aujourd'hui." },
          { icon: "route", title: "Par où commencer", text: "Les premiers agents à mettre en place chez vous." },
          { icon: "messageSquareText", title: "Vos questions", text: "Installation, données, validation : on y répond en direct." },
        ],
      },
      {
        kind: "liste",
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
    ],
  },
};

export function getRdvPage(slug: string): RdvPage | undefined {
  return Object.hasOwn(RDV_PAGES, slug) ? RDV_PAGES[slug] : undefined;
}

export function getRdvSlugs(): string[] {
  return Object.keys(RDV_PAGES);
}
