/**
 * Ressource « Saisie des pièces comptables » (post du 20/11/2026, experts-comptables, lien sp1).
 * Demandes d'Espoir du 19/11 : la saisie des pièces comptables, avec des exemples de pièces ;
 * 10 prompts et un skill qui regroupe tout, page ressource derrière une page de capture
 * (d'abord pensée sur le seul relevé bancaire scanné). Pièce scannée ou PDF → données
 * contrôlées → écritures proposées → fichier d'import. Le comptable valide les comptes.
 *
 * Faits vérifiés le 19/11/2026 (centre d'aide Claude) :
 * - Claude analyse le texte ET les images des PDF de 100 pages au plus ; de 101 à 1 000 pages,
 *   le texte seul (un scan n'a pas de texte) ; au-delà, refusé
 *   (https://support.claude.com/en/articles/8241126-upload-files-to-claude).
 * - Skills : un skill par ZIP, dossier au nom du skill, Personnaliser > Compétences > « + »,
 *   exécution de code requise ; nom ≤ 64, description ≤ 200 (articles 12512180 et 12512198).
 * Comptes du plan comptable général cités à titre de proposition (401, 411, 44566, 44562,
 * 44571, 512, 164, 661, classes 2, 6 et 7) : toujours « à valider » par le comptable.
 */
import type { IconName } from "@/components/icons/lucide";
import { createZip } from "@/lib/zip";

/** Typographie française : espaces insécables avant : ; ? ! » % € et après « */
function fr(s: string): string {
  return s
    .replace(/ ([:;?!»%€])/g, " $1")
    .replace(/« /g, "« ")
    .replace(/(\d) (\d{3})\b/g, "$1 $2");
}

export interface SaisiePrompt {
  number: string;
  title: string;
  result: string;
  prompt: string;
}

/** Skill Claude : fichier SKILL.md (nom ≤ 64, description ≤ 200 sans deux-points) */
export interface SaisieSkill {
  name: string;
  title: string;
  description: string;
  body: string;
}

/** Les pièces que la méthode sait traiter, avec ce que l'IA en tire */
const pieces: { title: string; text: string }[] = [
  { title: "Factures d'achat", text: "Fournisseur, numéro, date, HT, TVA par taux, TTC, échéance." },
  { title: "Factures de vente", text: "Client, numéro, date, HT, TVA collectée, TTC." },
  { title: "Tickets de caisse et notes de frais", text: "Restaurant, carburant, péage, parking : montant, TVA quand elle figure." },
  { title: "Relevés bancaires scannés", text: "Chaque opération sur une ligne, solde de départ et solde de fin contrôlés." },
  { title: "Échéanciers de prêt et de crédit-bail", text: "Capital, intérêts, assurance et loyer, échéance par échéance." },
  { title: "Factures d'immobilisation", text: "Matériel, véhicule, informatique : la pièce part en classe 2, pas en charge." },
  { title: "Quittances de loyer et avis de taxe foncière", text: "Bailleur ou administration, période, montant, échéance." },
];

const prompts: SaisiePrompt[] = [
  {
    number: "01",
    title: "Trier un lot de pièces",
    result: "Chaque fichier classé par type de pièce, avec les pièces illisibles mises de côté.",
    prompt: `Voici un lot de pièces de [CLIENT] pour [PÉRIODE].

Classe chaque fichier par type : facture d'achat, facture de vente, ticket ou note de frais, relevé bancaire, échéancier de prêt ou de crédit-bail, facture d'immobilisation, autre.
Pour chaque fichier, donne : nom du fichier, type, tiers, date.
Mets à part les pièces illisibles ou incomplètes, avec la raison.
N'invente rien.`,
  },
  {
    number: "02",
    title: "Saisir les factures d'achat",
    result: "Une ligne par facture et l'écriture proposée, comptes marqués « à valider ».",
    prompt: `Pour chaque facture d'achat, relève : fournisseur, numéro, date, montant HT, TVA par taux, montant TTC, échéance.
Recopie les montants à l'identique : n'arrondis pas, ne recalcule rien. Écris ILLISIBLE si un caractère ne se lit pas.

Propose ensuite l'écriture : compte de charge (classe 6) au débit pour le HT, 44566 au débit pour la TVA, 401 au crédit pour le TTC.
Marque « à valider » chaque compte que tu choisis.`,
  },
  {
    number: "03",
    title: "Saisir les factures de vente",
    result: "Une ligne par facture de vente et l'écriture proposée, équilibrée.",
    prompt: `Pour chaque facture de vente, relève : client, numéro, date, montant HT, TVA par taux, montant TTC.
Recopie les montants à l'identique.

Propose l'écriture : 411 au débit pour le TTC, compte de produit (classe 7) au crédit pour le HT, 44571 au crédit pour la TVA.
Signale les numéros de facture qui ne se suivent pas.
Marque « à valider » chaque compte que tu choisis.`,
  },
  {
    number: "04",
    title: "Saisir les tickets et les notes de frais",
    result: "Les dépenses classées par nature, la TVA récupérable signalée « à valider ».",
    prompt: `Pour chaque ticket ou note de frais (restaurant, carburant, péage, parking, hôtel, fournitures), relève : date, commerçant, nature de la dépense, montant TTC, TVA si elle figure sur le ticket.

Propose un compte de charge par nature.
La TVA récupérable dépend de la dépense : ne la retiens que si elle figure sur la pièce, et marque-la « à valider ».
Signale les tickets sans TVA lisible et les dépenses sans justificatif.`,
  },
  {
    number: "05",
    title: "Recopier un relevé bancaire scanné",
    result: "Une ligne par opération, solde de départ et solde de fin contrôlés.",
    prompt: `Recopie chaque opération du relevé dans un tableau : date d'opération, date de valeur, libellé complet, débit, crédit.
Une ligne par opération, dans l'ordre du relevé, montants à l'identique. Écris ILLISIBLE si besoin, avec la page.

Relève le solde de départ et le solde de fin, puis contrôle :
solde de départ + total des crédits - total des débits = solde de fin.
Donne l'écart en euros s'il y en a un. Ne corrige rien toi-même.`,
  },
  {
    number: "06",
    title: "Saisir un échéancier de prêt ou de crédit-bail",
    result: "Les échéances de la période, capital, intérêts et assurance séparés.",
    prompt: `Voici l'échéancier de [PRÊT ou CRÉDIT-BAIL] de [CLIENT].

Pour chaque échéance de [PÉRIODE], relève : date, capital, intérêts, assurance, montant total.
Vérifie que capital + intérêts + assurance = montant de l'échéance.

Propose l'écriture : pour un prêt, 164 pour le capital, 661 pour les intérêts, un compte d'assurance, 512 au crédit. Pour un crédit-bail, le loyer en charge (612).
Marque « à valider » chaque compte que tu choisis.`,
  },
  {
    number: "07",
    title: "Repérer les immobilisations",
    result: "Les factures à immobiliser, mises à part des charges, avec la question à trancher.",
    prompt: `Parmi les factures d'achat, repère celles qui peuvent être des immobilisations : matériel, véhicule, informatique, mobilier, travaux.

Pour chacune, donne : fournisseur, date, désignation, montant HT, et pourquoi elle pourrait s'immobiliser.
Propose un compte de classe 2 et la TVA en 44562, marqués « à valider ».
Ne décide pas toi-même : le seuil d'immobilisation et la durée d'amortissement sont à valider par le cabinet.`,
  },
  {
    number: "08",
    title: "Contrôler avant de saisir",
    result: "Le résultat de chaque contrôle et la liste des pièces à revoir.",
    prompt: `Contrôle toutes les pièces relevées :
1. HT + TVA = TTC pour chaque facture et chaque ticket.
2. Taux de TVA cohérents avec la pièce (20, 10, 5,5 ou 2,1).
3. Doublons possibles : même tiers, même numéro ou même montant à la même date.
4. Dates hors de la période demandée.
5. Cellules ILLISIBLE.

Pour chaque contrôle, donne le résultat (juste ou faux) et l'écart en euros.
Liste les pièces à revoir, avec la raison. Ne corrige rien toi-même.`,
  },
  {
    number: "09",
    title: "Rapprocher le relevé et les factures",
    result: "Les paiements sans facture et les factures sans paiement, prêts pour la demande de pièces.",
    prompt: `Compare les opérations du relevé bancaire avec les factures relevées.

Donne trois listes :
1. Les opérations rapprochées d'une facture (montant et tiers identiques).
2. Les opérations sans facture : ce sont les pièces à demander au client.
3. Les factures sans paiement sur la période.

Prépare à la fin un message court au client qui liste les pièces manquantes, à relire avant envoi.`,
  },
  {
    number: "10",
    title: "Préparer le fichier d'import",
    result: "Des écritures équilibrées au format de votre logiciel, sans les pièces en écart.",
    prompt: `Pour les pièces contrôlées sans écart, rassemble les écritures :
colonnes journal, date, numéro de pièce, compte, libellé, débit, crédit.
Vérifie que chaque écriture est équilibrée : total débit = total crédit.

Prépare le fichier d'import pour [LOGICIEL] : colonnes de votre logiciel, date au format JJ/MM/AAAA, décimales avec une virgule, séparateur point-virgule, UTF-8.
Laisse de côté les pièces en écart et liste-les à la fin.`,
  },
];

const skill: SaisieSkill = {
  name: "saisie-pieces-comptables",
  title: "Le skill qui regroupe les 10 prompts",
  description:
    "Lit des pièces comptables (factures, tickets, relevés, échéanciers) même scannées, les contrôle et propose des écritures prêtes à importer. À utiliser quand des pièces sont chargées.",
  body: `# Saisie des pièces comptables

## Rôle

Tu prépares la saisie de pièces comptables, même scannées : factures d'achat et de vente, tickets et notes de frais, relevés bancaires, échéanciers de prêt ou de crédit-bail, factures d'immobilisation. Le comptable valide avant tout import.

## Procédure

1. Trie les pièces par type. Mets à part les pièces illisibles ou incomplètes.
2. Relève les données de chaque pièce, montants recopiés à l'identique. Écris ILLISIBLE si un caractère ne se lit pas, avec le fichier et la page. N'invente rien.
   - Facture d'achat ou de vente : tiers, numéro, date, HT, TVA par taux, TTC, échéance.
   - Ticket ou note de frais : date, commerçant, nature, TTC, TVA si elle figure.
   - Relevé bancaire : une ligne par opération, solde de départ et solde de fin.
   - Échéancier : date, capital, intérêts, assurance, total de chaque échéance de la période.
3. Contrôle : HT + TVA = TTC ; taux de TVA cohérents (20, 10, 5,5 ou 2,1) ; doublons possibles ; dates hors période ; pour un relevé, solde de départ + crédits - débits = solde de fin ; pour un échéancier, capital + intérêts + assurance = échéance.
4. Une pièce en écart n'est pas saisie : liste-la avec la raison.
5. Propose les écritures dans le plan comptable général :
   - achat : classe 6 et 44566 au débit, 401 au crédit ;
   - vente : 411 au débit, classe 7 et 44571 au crédit ;
   - note de frais : charge par nature, TVA seulement si elle figure sur la pièce ;
   - prêt : 164, 661 et assurance au débit, 512 au crédit ; crédit-bail : loyer en 612 ;
   - immobilisation possible : classe 2 et 44562, à trancher par le cabinet (seuil, durée d'amortissement).
   Chaque compte choisi est marqué « à valider ».
6. Rapproche le relevé et les factures : opérations sans facture (pièces à demander au client), factures sans paiement.
7. Vérifie que chaque écriture est équilibrée, demande le logiciel de destination et ses colonnes si tu ne les connais pas, puis produis le fichier CSV.

## Format de sortie

- Le résumé des contrôles, avec les écarts en euros.
- Le tableau des écritures : journal, date, numéro de pièce, compte, libellé, débit, crédit.
- Le fichier CSV : date JJ/MM/AAAA, décimales avec une virgule, séparateur point-virgule, UTF-8.
- La liste des pièces laissées de côté et des pièces à demander au client.

## Règles de vigilance

- Ne modifie jamais un montant pour faire tomber un contrôle.
- Un PDF de plus de 100 pages n'est lu qu'en texte : un scan n'en contient pas. Demande de découper le fichier.
- C'est une proposition : le comptable choisit les comptes et valide avant l'import. Aucun message n'est envoyé au client.`,
};

export function skillFile(s: SaisieSkill): string {
  return `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.body}\n`;
}

export const SAISIE_PIECES = {
  slug: "saisie-pieces-comptables",
  metaTitle: fr("Saisie des pièces comptables : de la pièce scannée à l'écriture"),
  metaDescription: fr(
    "Les 10 prompts et le skill Claude pour saisir vos pièces comptables, même scannées : factures, tickets, relevés, échéanciers. Contrôles avant saisie, écritures à valider, fichier d'import."
  ),
  eyebrow: "Ressource gratuite · Saisie des pièces comptables",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: fr("Saisie des pièces comptables : <accent>1 heure → quelques minutes</accent> de relecture."),
  subtitle: fr(
    "Factures, tickets, relevés scannés, échéanciers : votre IA lit la pièce, contrôle les montants et propose l'écriture au format d'import de votre logiciel. Vous relisez, vous validez les comptes, vous importez."
  ),
  promises: ["10 prompts prêts à copier", "1 skill qui regroupe tout", "Claude, ChatGPT ou une autre IA"],
  pieces: pieces.map((p) => ({ title: fr(p.title), text: fr(p.text) })),
  before: [
    { icon: "shieldCheck" as IconName, title: "Un compte IA professionnel", text: fr("Les pièces contiennent des données de vos clients : Claude Team ou Enterprise, ChatGPT Business ou Enterprise, avec un accord de traitement des données.") },
    { icon: "receipt" as IconName, title: "100 pages au plus par fichier", text: fr("Claude lit les images d'un PDF jusqu'à 100 pages. Au-delà, il ne lit que le texte, et un scan n'en contient pas : découpez les gros lots.") },
    { icon: "folderCheck" as IconName, title: "Pour recevoir un fichier CSV", text: fr("Activez l'exécution de code et la création de fichiers (Paramètres > Capacités). Sur Team et Enterprise, un propriétaire de l'organisation l'active d'abord.") },
    { icon: "scanSearch" as IconName, title: "Des scans lisibles", text: fr("Une page droite et nette donne moins de cellules illisibles. Une photo de travers donne plus de pièces à revoir.") },
  ],
  skill: { ...skill, title: fr(skill.title), body: fr(skill.body) },
  zip: { href: "/g/saisie-pieces-comptables/saisie-pieces-comptables.zip", file: "saisie-pieces-comptables.zip" },
  install: {
    steps: [
      fr("Téléchargez le fichier ZIP du skill."),
      fr("Dans Claude, ouvrez Personnaliser > Compétences, cliquez sur « + » puis importez le fichier ZIP tel quel."),
      fr("Déposez ensuite vos pièces dans une conversation et demandez « les écritures de ces pièces » : Claude applique le skill."),
    ],
    safari: fr("Votre navigateur a ouvert le ZIP tout seul (Safari) ? Copiez le skill ci-dessous et collez-le dans une conversation Claude avec la phrase à copier."),
    phrase: fr("Crée une compétence à partir de ce fichier SKILL.md. Garde exactement le nom, la description et la procédure, sans rien ajouter."),
  },
  prompts: prompts.map((p) => ({ ...p, title: fr(p.title), result: fr(p.result), prompt: fr(p.prompt) })),
  promptsNote: fr("Dans la même conversation, après avoir déposé les pièces : commencez par le tri (01), contrôlez (08) avant de préparer l'import (10). Pour Claude, ChatGPT ou une autre IA."),
  guarantee: fr("Votre IA prépare, vous validez. Une pièce en écart n'est pas saisie, et aucun compte n'est retenu sans votre accord."),
  sources: [
    { label: "Centre d'aide Claude : Upload files to Claude", href: "https://support.claude.com/en/articles/8241126-upload-files-to-claude" },
    { label: "Centre d'aide Claude : Using skills in Claude", href: "https://support.claude.com/en/articles/12512180-using-skills-in-claude" },
    { label: "Centre d'aide Claude : How to create custom skills", href: "https://support.claude.com/en/articles/12512198-how-to-create-custom-skills" },
  ],
  verifiedOn: "19/11/2026",
  author: "Espoir Mwami",
};

/** ZIP au format claude.ai : `<nom>/SKILL.md`, à importer tel quel */
export function skillZip(): Uint8Array {
  const k = SAISIE_PIECES.skill;
  return createZip([{ path: `${k.name}/SKILL.md`, data: skillFile(k) }]);
}
