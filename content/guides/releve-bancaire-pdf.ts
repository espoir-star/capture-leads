/**
 * Ressource « Relevé bancaire PDF » (post du 20/11/2026, experts-comptables, lien rb1).
 * Un relevé scanné devient un fichier d'import, avec le contrôle des soldes avant tout import.
 *
 * Faits vérifiés le 19/11/2026 (centre d'aide Claude) :
 * - Claude analyse le texte ET les images des PDF de 100 pages au plus ; de 101 à 1 000 pages,
 *   le texte seul (un scan n'a pas de texte) ; au-delà de 1 000 pages, refusé
 *   (https://support.claude.com/en/articles/8241126-upload-files-to-claude).
 * - Skills : un skill par ZIP, dossier au nom du skill, Personnaliser > Compétences > « + »,
 *   exécution de code requise ; nom ≤ 64, description ≤ 200
 *   (articles 12512180 et 12512198).
 * Aucune promesse de taux de lecture : la méthode repose sur le contrôle des soldes.
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

export interface RelevePrompt {
  number: string;
  title: string;
  result: string;
  prompt: string;
}

/** Skill Claude : fichier SKILL.md (nom ≤ 64, description ≤ 200 sans deux-points) */
export interface ReleveSkill {
  name: string;
  title: string;
  description: string;
  body: string;
}

const prompts: RelevePrompt[] = [
  {
    number: "01",
    title: "Recopier le relevé en tableau",
    result: "Chaque opération sur une ligne, montants recopiés à l'identique, lignes illisibles signalées.",
    prompt: `Voici le relevé bancaire de [CLIENT], banque [BANQUE], période [MOIS].

Recopie chaque opération dans un tableau avec ces colonnes : date d'opération, date de valeur, libellé complet, débit, crédit.
- Une ligne par opération, dans l'ordre du relevé.
- Recopie les montants à l'identique : n'arrondis pas, ne recalcule rien.
- Si un caractère est illisible, écris ILLISIBLE dans la cellule et indique la page.
- N'invente aucune ligne.

Relève aussi le solde de départ, le solde de fin et les totaux indiqués sur le relevé.`,
  },
  {
    number: "02",
    title: "Contrôler les soldes avant tout import",
    result: "Le résultat de chaque contrôle, l'écart en euros et les lignes à revoir sur le PDF.",
    prompt: `Contrôle le tableau du relevé :
1. Solde de départ + total des crédits - total des débits = solde de fin.
2. Les totaux de chaque page, s'ils figurent sur le relevé.
3. Les doublons possibles : même date, même montant, même libellé.
4. Les cellules ILLISIBLE.

Pour chaque contrôle, donne le résultat (juste ou faux) et l'écart en euros.
Liste les lignes à revoir sur le PDF, avec la page.
Ne corrige rien toi-même.`,
  },
  {
    number: "03",
    title: "Préparer le fichier d'import",
    result: "Un fichier CSV aux colonnes de votre logiciel, produit seulement si les soldes sont justes.",
    prompt: `Prépare le fichier d'import pour [LOGICIEL] :
- colonnes : [Date ; Libellé ; Montant] (remplace par les colonnes de votre logiciel) ;
- date au format JJ/MM/AAAA ;
- montant signé : débit en négatif, crédit en positif ;
- décimales avec une virgule, séparateur point-virgule, encodage UTF-8.

Produis le fichier CSV seulement si le contrôle des soldes est juste.
Sinon, ne produis rien et liste ce qui bloque.`,
  },
];

const skill: ReleveSkill = {
  name: "releve-bancaire-vers-import",
  title: "Le skill : relevé PDF vers fichier d'import",
  description:
    "Convertit un relevé bancaire PDF, même scanné, en fichier CSV prêt à importer, après contrôle des soldes. À utiliser quand un relevé bancaire est chargé ou cité.",
  body: `# Relevé bancaire vers fichier d'import

## Rôle

Tu transformes un relevé bancaire en PDF, même scanné, en fichier CSV prêt à importer dans un logiciel comptable. Tu ne produis le fichier que si les soldes sont justes.

## Procédure

1. Recopie chaque opération dans un tableau : date d'opération, date de valeur, libellé complet, débit, crédit. Une ligne par opération, dans l'ordre du relevé. Montants recopiés à l'identique, sans arrondir ni recalculer.
2. Si un caractère est illisible, écris ILLISIBLE dans la cellule et note la page. N'invente aucune ligne.
3. Relève le solde de départ, le solde de fin et les totaux du relevé.
4. Contrôle : solde de départ + total des crédits - total des débits = solde de fin ; totaux par page s'ils existent ; doublons possibles (même date, même montant, même libellé) ; cellules ILLISIBLE.
5. Si un contrôle est faux, arrête-toi : donne l'écart en euros et les lignes à revoir sur le PDF, avec la page.
6. Si tout est juste, demande le logiciel de destination et ses colonnes si tu ne les connais pas, puis produis le fichier CSV.

## Format de sortie

- Un résumé des contrôles : juste ou faux, avec les écarts.
- Le fichier CSV : date JJ/MM/AAAA, montant signé (débit négatif, crédit positif), décimales avec une virgule, séparateur point-virgule, UTF-8. Colonnes par défaut : Date ; Libellé ; Montant.

## Règles de vigilance

- Ne corrige jamais un montant pour faire tomber les soldes.
- Un PDF de plus de 100 pages n'est lu qu'en texte : un scan n'en contient pas. Demande de découper le fichier.
- C'est un brouillon à relire : l'utilisateur contrôle avant l'import.`,
};

export function skillFile(s: ReleveSkill): string {
  return `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.body}\n`;
}

/** ZIP au format claude.ai : `<nom>/SKILL.md`, à importer tel quel */
export function skillZip(): Uint8Array {
  const k = RELEVE_BANCAIRE.skill;
  return createZip([{ path: `${k.name}/SKILL.md`, data: skillFile(k) }]);
}

export const RELEVE_BANCAIRE = {
  slug: "releve-bancaire-pdf",
  metaTitle: fr("Relevé bancaire scanné : le fichier d'import en quelques minutes"),
  metaDescription: fr(
    "Le skill Claude et les 3 prompts pour transformer un relevé bancaire PDF, même scanné, en fichier d'import, avec le contrôle des soldes avant tout import."
  ),
  eyebrow: "Ressource gratuite · Relevé bancaire PDF",
  /** <accent>…</accent> = mot mis en avant (bleu du site) */
  title: fr("Relevé bancaire scanné : <accent>1 heure → quelques minutes</accent>, soldes contrôlés."),
  subtitle: fr(
    "Le client envoie son relevé en PDF scanné, sans export ni synchronisation. Votre IA recopie les opérations, contrôle les soldes et prépare le fichier d'import de votre logiciel. Vous relisez, vous importez."
  ),
  promises: ["1 skill à installer", "3 prompts prêts à copier", "Claude, ChatGPT ou une autre IA"],
  before: [
    { icon: "shieldCheck" as IconName, title: "Un compte IA professionnel", text: fr("Un relevé contient des données personnelles de vos clients : Claude Team ou Enterprise, ChatGPT Business ou Enterprise, avec un accord de traitement des données.") },
    { icon: "receipt" as IconName, title: "100 pages au plus par fichier", text: fr("Claude lit les images d'un PDF jusqu'à 100 pages. Au-delà, il ne lit que le texte, et un scan n'en contient pas : découpez les gros relevés.") },
    { icon: "folderCheck" as IconName, title: "Pour recevoir un fichier CSV", text: fr("Activez l'exécution de code et la création de fichiers (Paramètres > Capacités). Sur Team et Enterprise, un propriétaire de l'organisation l'active d'abord.") },
    { icon: "scanSearch" as IconName, title: "Un scan lisible", text: fr("Une page droite et nette donne moins de cellules illisibles. Une photo de travers donne plus de lignes à revoir.") },
  ],
  skill: { ...skill, title: fr(skill.title), body: fr(skill.body) },
  zip: { href: "/g/releve-bancaire-pdf/releve-bancaire-vers-import.zip", file: "releve-bancaire-vers-import.zip" },
  install: {
    steps: [
      fr("Téléchargez le fichier ZIP du skill."),
      fr("Dans Claude, ouvrez Personnaliser > Compétences, cliquez sur « + » puis importez le fichier ZIP tel quel."),
      fr("Déposez ensuite un relevé dans une conversation et demandez « le fichier d'import de ce relevé » : Claude applique le skill."),
    ],
    safari: fr("Votre navigateur a ouvert le ZIP tout seul (Safari) ? Copiez le skill ci-dessous et collez-le dans une conversation Claude avec la phrase à copier."),
    phrase: fr("Crée une compétence à partir de ce fichier SKILL.md. Garde exactement le nom, la description et la procédure, sans rien ajouter."),
  },
  prompts: prompts.map((p) => ({ ...p, title: fr(p.title), result: fr(p.result), prompt: fr(p.prompt) })),
  promptsNote: fr("À utiliser dans l'ordre, dans la même conversation, après avoir déposé le relevé. Pour Claude, ChatGPT ou une autre IA."),
  guarantee: fr("Votre IA prépare, vous contrôlez. Si les soldes ne tombent pas juste, le fichier ne part pas."),
  sources: [
    { label: "Centre d'aide Claude : Upload files to Claude", href: "https://support.claude.com/en/articles/8241126-upload-files-to-claude" },
    { label: "Centre d'aide Claude : Using skills in Claude", href: "https://support.claude.com/en/articles/12512180-using-skills-in-claude" },
    { label: "Centre d'aide Claude : How to create custom skills", href: "https://support.claude.com/en/articles/12512198-how-to-create-custom-skills" },
  ],
  verifiedOn: "19/11/2026",
  author: "Espoir Mwami",
};
