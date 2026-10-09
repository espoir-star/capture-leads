/**
 * Expéditeurs Brevo. Domaine d'envoi : althoce.fr (DNS chez Cloudflare,
 * authentification Brevo : brevo-code + DKIM brevo1/brevo2 + DMARC,
 * docs/BREVO_SETUP.md § 21). `npm run brevo:domain` affiche l'état réel.
 *
 * Aucune boîte n'existe derrière newsletter@ / bonjour@ (MX althoce.fr chez
 * IONOS, sans boîte) : un expéditeur d'un domaine authentifié est validé par
 * Brevo sans email de vérification, et toutes les réponses vont sur REPLY_TO
 * (boîte Google Workspace de contact.althoce.com).
 */

export interface Sender {
  name: string;
  email: string;
}

export const SENDING_DOMAIN = "althoce.fr";

/** Seule adresse de réponse, pour tous les expéditeurs */
export const REPLY_TO = "espoir@contact.althoce.com";

export const SENDERS = {
  /** Campagnes newsletter (newsletter-as-code) */
  newsletter: { name: "Althoce", email: "newsletter@althoce.fr" },
  /** Guides, ressources, automatisations de livraison, webinaires */
  resources: { name: "Althoce", email: "bonjour@althoce.fr" },
} satisfies Record<string, Sender>;
