/**
 * Ressource « Revue de dossier à partir du FEC » (post LinkedIn, experts-comptables, mot clé REVUE, lien rv1).
 * Demande d'Espoir du 22/11/2026 : un post sur Claude et un tableau de bord qui analyse un FEC,
 * sort les anomalies et les points utiles sur un dossier suivi ; un skill qui crée le tableau de
 * bord avec un onglet pour charger le FEC ; une nouvelle page de capture. Pas de FEC fictif
 * (ni démo ni exemple de données sur la page).
 *
 * Le tableau de bord est un seul fichier HTML (content/guides/revue-dossier-fec.html), sans
 * dépendance externe : le FEC est lu dans le navigateur par FileReader, il n'est envoyé nulle part.
 * Le skill (ZIP au format claude.ai) contient SKILL.md et ce fichier en assets/.
 *
 * Faits vérifiés le 22/11/2026 (centre d'aide Claude) :
 * - un artefact peut contenir une commande pour charger un fichier (images, PDF, CSV)
 *   (https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) ;
 * - les artefacts demandent l'exécution de code et la création de fichiers (même article) ;
 * - skills : un skill par ZIP, dossier au nom du skill, Personnaliser > Compétences > « + »,
 *   nom ≤ 64, description ≤ 200 (articles 12512180 et 12512198).
 * Comptes du plan comptable général utilisés par les contrôles : 401, 411, 455, 471 à 475,
 * 512, 53, 4456, 4457, 60 à 69, 70, 641, 645, 681, 20, 21, 23.
 * Le mot « FEC » est employé ici à la demande d'Espoir (le sujet du post), contrairement aux
 * pages des connecteurs où il est proscrit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IconName } from "@/components/icons/lucide";
import { createZip } from "@/lib/zip";

/** Typographie française : espaces insécables avant : ; ? ! » % € et après « */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

/** Le tableau de bord HTML, lu sur disque (build et tests lancés depuis la racine du projet) */
export function dashboardHtml(): string {
  return readFileSync(join(process.cwd(), "content/guides/revue-dossier-fec.html"), "utf8");
}

/** Skill Claude : fichier SKILL.md (nom ≤ 64, description ≤ 200 sans deux-points) */
export interface RevueSkill {
  name: string;
  title: string;
  description: string;
  body: string;
}

const onglets: { icon: IconName; title: string; text: string }[] = [
  { icon: "upload", title: "Charger le FEC", text: "Déposez le FEC du dossier, et celui de N-1 si vous voulez comparer. Réglez vos seuils." },
  { icon: "layoutDashboard", title: "Synthèse", text: "Chiffre d'affaires, résultat, trésorerie, les 10 points à vérifier en priorité et les questions à poser au client." },
  { icon: "scanSearch", title: "Anomalies", text: "Intégrité des écritures et points à vérifier, filtrables par type, avec le compte, la date et le montant." },
  { icon: "users", title: "Tiers", text: "Balance âgée des clients et des fournisseurs, taux de lettrage, plus gros montants non lettrés, dépendance à un client." },
  { icon: "chartColumn", title: "Activité", text: "Chiffre d'affaires mois par mois, marge sur achats, charges par nature, comparaison avec N-1." },
  { icon: "scale", title: "Cohérences", text: "TVA rapportée au chiffre d'affaires et aux achats, charges sociales et salaires, amortissements, banque en fin de mois." },
];

const controles: { title: string; items: string[] }[] = [
  { title: "Intégrité des écritures", items: ["Total débit égal au total crédit", "Écritures déséquilibrées", "Trous dans la numérotation, journal par journal", "Lignes sans référence de pièce, sans libellé ou sans date de validation"] },
  { title: "Soldes anormaux", items: ["Clients créditeurs et fournisseurs débiteurs", "Compte courant d'associé débiteur (455)", "Comptes d'attente non soldés (471 à 475)", "Caisse créditrice en cours d'exercice", "Banque créditrice à la clôture"] },
  { title: "Écritures à regarder", items: ["Doublons possibles : même tiers, même montant, à 3 jours près", "Écritures datées un week-end", "Montants ronds importants", "Achats en charges au-dessus de votre seuil, à immobiliser ?"] },
  { title: "Tiers", items: ["Non lettré par ancienneté : 0 à 30, 31 à 60, 61 à 90, plus de 90 jours", "Taux de lettrage clients et fournisseurs", "Premier client et 5 premiers clients en part des flux"] },
  { title: "Cohérences", items: ["TVA collectée rapportée au chiffre d'affaires", "TVA déductible rapportée aux achats et investissements", "Charges sociales rapportées aux salaires", "Immobilisations sans dotation aux amortissements", "Solde bancaire en fin de mois"] },
];

const skill: RevueSkill = {
  name: "revue-dossier-fec",
  title: "Le skill : le tableau de bord de revue de dossier",
  description:
    "Crée le tableau de bord de revue de dossier, avec un onglet pour charger le FEC, puis rédige la note de revue. À utiliser pour réviser un dossier comptable ou analyser un FEC.",
  body: `# Revue de dossier à partir du FEC

## Rôle

Tu aides un expert-comptable ou un collaborateur à réviser un dossier. Tu crées le tableau de bord de revue de dossier, puis tu rédiges la note de revue à partir de ce qu'il affiche. Les contrôles signalent des points à vérifier : le comptable conclut.

## Procédure

1. Crée un artefact HTML à partir du fichier assets/tableau-de-bord-revue-fec.html de ce skill. Lis le fichier et reprends son contenu exact : ne le réécris pas, ne le raccourcis pas, n'ajoute aucune donnée.
2. Dis à l'utilisateur d'ouvrir l'onglet « Charger le FEC » et d'y déposer le FEC du dossier, et s'il le souhaite celui de N-1. Le fichier est lu par le tableau de bord, dans le navigateur : il n'est pas envoyé dans la conversation.
3. Le tableau de bord affiche alors cinq onglets : Synthèse, Anomalies, Tiers, Activité, Cohérences.
4. Quand l'utilisateur colle la synthèse copiée depuis le tableau de bord (bouton « Copier la synthèse »), rédige la note de revue :
   - les points à traiter avant la clôture, classés par priorité, avec le compte et le montant ;
   - les questions à poser au client ;
   - les pièces à demander ;
   - en distinguant les faits relevés des hypothèses.
5. Si l'utilisateur dépose le FEC directement dans la conversation, rappelle que le tableau de bord le lit sans l'envoyer. S'il confirme, analyse-le avec l'exécution de code en suivant les contrôles ci-dessous, et présente les résultats dans le même ordre que les onglets.
6. Si le cabinet veut un contrôle de plus, ajoute-le à l'artefact en gardant les onglets existants.

## Contrôles du tableau de bord

- Intégrité : total débit égal au total crédit, écritures déséquilibrées, trous de numérotation par journal, lignes sans pièce, sans libellé ou sans date de validation.
- Soldes anormaux : clients créditeurs (411), fournisseurs débiteurs (401), compte courant d'associé débiteur (455), comptes d'attente non soldés (471 à 475), caisse créditrice en cours d'exercice (53), banque créditrice à la clôture (512).
- Écritures à regarder : doublons possibles (même tiers, même montant, même sens, à 3 jours près), écritures datées un week-end, montants ronds importants, achats en charges au-dessus du seuil (6063, 6064, 6068, 615) à immobiliser ?
- Tiers : non lettré par ancienneté (0 à 30, 31 à 60, 61 à 90, plus de 90 jours), taux de lettrage, poids du premier client.
- Activité : chiffre d'affaires (70) mois par mois, achats consommés (601, 602, 603, 607), marge, charges par nature (60 à 69), résultat, comparaison avec N-1.
- Cohérences : TVA collectée (4457) rapportée au chiffre d'affaires, TVA déductible (4456) rapportée aux achats et investissements, charges sociales (645) rapportées aux salaires (641), dotations (681) quand il y a des immobilisations, solde bancaire en fin de mois.

## Règles de vigilance

- Un contrôle signale, il ne conclut pas : un repère dépend de l'activité, du régime de TVA et des réductions de cotisations du dossier.
- N'invente aucun chiffre. Si une colonne du FEC manque, dis quels contrôles ne sont pas fiables.
- Ne modifie aucune écriture et n'envoie rien au client.
- Le FEC contient des données de clients : un compte professionnel, avec un accord de traitement des données.`,
};

export function skillFile(s: RevueSkill): string {
  return `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.body}\n`;
}

/** Avec ChatGPT ou une autre IA : le FEC déposé dans la conversation, analysé avec l'exécution de code */
const prompt = `Voici le FEC du dossier [CLIENT] pour l'exercice [EXERCICE]. Analyse-le avec l'exécution de code, sans rien inventer.

1. Intégrité : total débit et total crédit, écritures déséquilibrées, trous de numérotation par journal, lignes sans pièce ou sans libellé.
2. Soldes anormaux : clients créditeurs (411), fournisseurs débiteurs (401), compte courant d'associé débiteur (455), comptes d'attente non soldés (471 à 475), caisse créditrice en cours d'exercice (53).
3. Écritures à regarder : doublons possibles (même tiers, même montant, à 3 jours près), écritures datées un week-end, achats en charges de plus de [SEUIL] € à immobiliser ?
4. Tiers : non lettré par ancienneté (0 à 30, 31 à 60, 61 à 90, plus de 90 jours), poids du premier client.
5. Activité : chiffre d'affaires mois par mois, charges par nature, résultat.
6. Cohérences : TVA collectée rapportée au chiffre d'affaires, charges sociales rapportées aux salaires, immobilisations sans dotation.

Présente un tableau par partie, puis les 10 points à vérifier en priorité, avec le compte, la date et le montant, et les questions à poser au client. Distingue les faits relevés des hypothèses : c'est moi qui conclus.`;

export const REVUE_FEC = {
  slug: "revue-dossier-fec",
  metaTitle: fr("Revue de dossier : votre FEC analysé par un tableau de bord Claude"),
  metaDescription: fr(
    "Le skill Claude qui crée le tableau de bord de revue de dossier : chargez le FEC, voyez les anomalies, la balance âgée, l'activité et les cohérences, puis la note de revue."
  ),
  eyebrow: "Ressource gratuite · Revue de dossier",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: fr("Chargez le FEC, <accent>voyez ce qu'il faut vérifier</accent> sur le dossier."),
  subtitle: fr(
    "Un tableau de bord créé par Claude, avec un onglet pour charger le FEC : intégrité des écritures, soldes anormaux, doublons possibles, balance âgée, activité mois par mois et cohérences. Vous vérifiez, vous concluez."
  ),
  promises: ["1 skill Claude prêt à installer", "6 onglets, une vingtaine de contrôles", "Le FEC reste dans votre navigateur"],
  onglets: onglets.map((o) => ({ ...o, title: fr(o.title), text: fr(o.text) })),
  controles: controles.map((c) => ({ title: fr(c.title), items: c.items.map(fr) })),
  before: [
    { icon: "shieldCheck" as IconName, title: "Un compte Claude professionnel", text: fr("Le FEC contient les données de vos clients : Claude Team ou Enterprise, avec un accord de traitement des données.") },
    { icon: "folderCheck" as IconName, title: "L'exécution de code activée", text: fr("Le skill et le tableau de bord en ont besoin : Paramètres > Capacités. Sur Team et Enterprise, un propriétaire de l'organisation l'active d'abord.") },
    { icon: "download" as IconName, title: "Le FEC exporté de votre logiciel", text: fr("Le fichier des écritures de l'exercice, avec sa ligne d'en-têtes, séparé par des tabulations ou des barres verticales. Celui de N-1 en plus, si vous voulez comparer.") },
    { icon: "lock" as IconName, title: "Le fichier reste chez vous", text: fr("Le tableau de bord lit le FEC dans votre navigateur et ne l'envoie nulle part. Seule la synthèse que vous copiez va dans la conversation.") },
  ],
  skill: { ...skill, title: fr(skill.title), body: fr(skill.body) },
  zip: {
    href: "/g/revue-dossier-fec/revue-dossier-fec.zip",
    file: "revue-dossier-fec.zip",
    /** Chemin du tableau de bord dans le ZIP du skill */
    asset: "assets/tableau-de-bord-revue-fec.html",
  },
  html: { href: "/g/revue-dossier-fec/tableau-de-bord-revue-fec.html", file: "tableau-de-bord-revue-fec.html" },
  install: {
    steps: [
      fr("Téléchargez le fichier ZIP du skill."),
      fr("Dans Claude, ouvrez Personnaliser > Compétences, cliquez sur « + » puis importez le fichier ZIP tel quel."),
      fr("Demandez ensuite « le tableau de bord de revue de dossier » : Claude le crée, ouvrez l'onglet « Charger le FEC » et déposez le fichier."),
    ],
    seul: fr("Sans Claude, ou si votre navigateur a ouvert le ZIP tout seul : téléchargez le tableau de bord seul et ouvrez-le dans votre navigateur. Il fonctionne de la même façon, sans connexion."),
  },
  prompt: fr(prompt),
  promptNote: fr("Avec ChatGPT ou une autre IA qui exécute du code : déposez le FEC dans la conversation et collez ce prompt. Vous recevez les mêmes contrôles, sous forme de tableaux."),
  guarantee: fr("Le tableau de bord signale, vous concluez. Aucune écriture n'est modifiée, et rien n'est envoyé au client."),
  sources: [
    { label: "Centre d'aide Claude : What are artifacts and how do I use them?", href: "https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them" },
    { label: "Centre d'aide Claude : Using skills in Claude", href: "https://support.claude.com/en/articles/12512180-using-skills-in-claude" },
    { label: "Centre d'aide Claude : How to create custom skills", href: "https://support.claude.com/en/articles/12512198-how-to-create-custom-skills" },
  ],
  verifiedOn: "22/11/2026",
  author: "Espoir Mwami",
};

/** ZIP au format claude.ai : `<nom>/SKILL.md` et le tableau de bord en assets, à importer tel quel */
export function skillZip(): Uint8Array {
  const k = REVUE_FEC.skill;
  return createZip([
    { path: `${k.name}/SKILL.md`, data: skillFile(k) },
    { path: `${k.name}/${REVUE_FEC.zip.asset}`, data: dashboardHtml() },
  ]);
}
