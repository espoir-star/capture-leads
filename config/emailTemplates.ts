/**
 * Modèles email « as code » du moteur de séquences (emails/sequences/*.html).
 *
 * `npm run brevo:templates` (dry run) compare chaque fichier au modèle Brevo
 * du même NOM EXACT ; `-- --apply` crée les absents et met à jour ceux qui
 * diffèrent, puis affiche les IDs à recopier ici. Tant qu'un ID est null, la
 * séquence qui l'utilise ne peut pas être activée (aucun ID fictif).
 *
 * Ces modèles n'utilisent jamais {{ unsubscribe }} (désinscription Brevo
 * transactionnelle = blocage de TOUS les emails, guides compris) : le lien
 * passe par params.UNSUBSCRIBE_URL → /desinscription (opposition marketing).
 */

export interface EmailTemplateDef {
  /** Nom exact dans Brevo (clé de rapprochement) */
  name: string;
  subject: string;
  /** Fichier HTML, relatif à la racine du dépôt */
  file: string;
  /** ID Brevo réel (null tant que non créé) */
  id: number | null;
}

export const EMAIL_TEMPLATES = {
  "guide-12-cas-ec.delivery": {
    name: "SEQ · 12 cas EC · Livraison",
    subject: "Guide - 12 cas d'usages Claude Expert-Comptable",
    file: "emails/sequences/guide-12-cas-ec/delivery.html",
    id: 35,
  },
  "guide-12-cas-ec.relance-j2": {
    name: "SEQ · 12 cas EC · Relance J+2",
    subject: "Tu as eu le temps de regarder le guide ?",
    file: "emails/sequences/guide-12-cas-ec/relance-j2.html",
    id: 36,
  },
  "generique.delivery": {
    name: "SEQ · Générique · Livraison",
    subject: "Votre guide : {{ params.GUIDE_TITLE }}",
    file: "emails/sequences/generique/delivery.html",
    id: 37,
  },
  "generique.relance-j2": {
    name: "SEQ · Générique · Relance J+2",
    subject: "Avez-vous pu ouvrir le guide ?",
    file: "emails/sequences/generique/relance-j2.html",
    id: 38,
  },
} satisfies Record<string, EmailTemplateDef>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

export function templateId(key: EmailTemplateKey): number | null {
  return EMAIL_TEMPLATES[key].id;
}
