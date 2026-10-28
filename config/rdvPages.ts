/**
 * Pages de rendez-vous : /rdv/<slug>. Le visiteur réserve directement un créneau
 * dans un agenda de rendez-vous Google, sans formulaire ni email intermédiaire.
 *
 * Premier test le 29/10/2026 : post LinkedIn « Catégoriser, lettrer, saisir »
 * (audit d'installation gratuit, texte d'Espoir). L'agenda est affiché ouvert dès
 * l'arrivée sur la page (choix d'Espoir du 28/10/2026, components/BookingCalendar.tsx).
 *
 * Uniquement des faits vérifiés : logiciels et temps gagné donnés par Espoir le
 * 28/10/2026 (ACD, Cegid Loop, Sage Génération Experts, MyUnisoft, Inqom en écriture
 * comme Pennylane ; logiciels fermés en sur mesure ; aucune mention du fichier FEC ;
 * « une matinée par dossier […] se relit en quelques minutes », texte du post), lecture
 * seule du MCP Pennylane revérifiée sur pennylane.com/fr/mcp le 28/10/2026, Isacompta
 * édité par AGIRIS pour les cabinets (agiris.fr).
 */
import type { IconName } from "@/components/icons/lucide";

export interface RdvPage {
  slug: string;
  /** Métadonnées (onglet, partage) */
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: string;
  subtitle: string;
  booking: {
    /** Lien public de l'agenda (nouvel onglet) */
    url: string;
    /** Même agenda, version intégrable (gv=true) */
    embedUrl: string;
    title: string;
    durationMin: number;
  };
  host: { name: string; role: string; photo: string };
  deliverables: { icon: IconName; title: string; text: string }[];
  /** Phrase d'honnêteté sous les apports de l'audit */
  honesty: string;
  tasks: string[];
  /** Dernière ligne de la liste : elle n'est pas exhaustive */
  tasksMore: string;
  timeSaved: { title: string; text: string };
  validation: { title: string; text: string };
  softwareTitle: string;
  software: { names: string; status: string; text: string; source?: { label: string; url: string } }[];
  /** Webinar proposé à ceux qui ne réservent pas (affiché tant que les inscriptions sont ouvertes) */
  webinarSlug?: string;
}

export const RDV_PAGES: Readonly<Record<string, RdvPage>> = {
  "audit-connecteurs": {
    slug: "audit-connecteurs",
    metaTitle: "Audit d'installation gratuit\u00a0: votre IA dans votre logiciel",
    metaDescription:
      "30 minutes en visio pour savoir ce que votre IA peut lire et écrire dans votre logiciel, et ce qu'elle peut préparer à votre place.",
    eyebrow: "Audit d'installation · 100\u00a0% gratuit",
    title: "Votre IA peut-elle <accent>écrire dans votre logiciel\u00a0?</accent>",
    subtitle: "En 30 minutes de visio, vous savez ce qui est branchable chez vous et par où commencer.",
    booking: {
      // Agenda « Connecteurs IA MCP - By Althoce » (le même que althoce.com/connecteurs) : 30 min, Google Meet.
      url: "https://calendar.app.google/m6thfjDsXzEqKdkKA",
      embedUrl:
        "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1V23SISY0aSuyhcnrP4bc_sW4fiTlVVr4FmYIMIGcBSEmD5RiEkyMrrO4YWE9SY_-YTHJxE6I_?gv=true&hl=fr",
      title: "Audit d'installation",
      durationMin: 30,
    },
    host: { name: "Espoir Mwami", role: "Fondateur d'Althoce", photo: "/webinar/espoir-mwami.jpg" },
    deliverables: [
      { icon: "plug", title: "Ce qui est branchable", text: "Sur votre logiciel\u00a0: lecture, écriture, ou les deux." },
      { icon: "route", title: "La méthode adaptée", text: "Connecteur officiel ou sur mesure, adapté aux spécificités de votre logiciel." },
      { icon: "listChecks", title: "Les tâches à confier en premier", text: "Et le temps gagné sur chacune." },
      { icon: "userCheck", title: "Le bon compte Claude ou ChatGPT", text: "Pour traiter des données clients." },
    ],
    honesty: "Si votre logiciel ne permet pas l'écriture, on vous le dit dès l'audit.",
    tasks: [
      "Catégoriser les transactions",
      "Affecter un tiers",
      "Ventiler une facture fournisseur",
      "Lettrer et rapprocher",
      "Passer des écritures",
    ],
    tasksMore: "Et d'autres tâches, selon vos besoins",
    timeSaved: {
      title: "Une matinée par dossier, relue en quelques minutes",
      text: "Catégoriser, lettrer, saisir\u00a0: votre IA le prépare pendant que vous faites autre chose. Vous relisez, vous validez.",
    },
    validation: {
      title: "Votre IA propose, vous décidez.",
      text: "Rien ne part dans le dossier sans votre accord. Dans Claude, chaque type d'action se règle sur «\u00a0toujours autorisé\u00a0», «\u00a0validation requise\u00a0» ou «\u00a0bloqué\u00a0». Dans ChatGPT, les écritures demandent une confirmation par défaut.",
    },
    softwareTitle: "Chaque connecteur s'adapte à votre logiciel",
    software: [
      {
        names: "Pennylane",
        status: "Lecture et écriture",
        text: "Le connecteur officiel est en lecture seule à ce jour. Le connecteur Althoce ajoute l'écriture.",
        source: { label: "pennylane.com/fr/mcp", url: "https://www.pennylane.com/fr/mcp" },
      },
      {
        names: "ACD, Cegid Loop, Sage Génération Experts, MyUnisoft, Inqom",
        status: "Lecture et écriture",
        text: "Comme pour Pennylane, votre IA lit vos dossiers et y écrit, avec votre validation.",
      },
      {
        names: "Cegid Quadra, Quadratus, Coala, Isacompta (AGIRIS)",
        status: "Sur mesure",
        text: "Logiciels fermés\u00a0: on construit un connecteur sur mesure.",
      },
    ],
    webinarSlug: "connecteurs-mcp-cabinets",
  },
};

export function getRdvPage(slug: string): RdvPage | undefined {
  return Object.hasOwn(RDV_PAGES, slug) ? RDV_PAGES[slug] : undefined;
}

export function getRdvSlugs(): string[] {
  return Object.keys(RDV_PAGES);
}
