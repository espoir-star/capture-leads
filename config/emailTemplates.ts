/**
 * Modèles email « as code ». Les noms sont les clés de rapprochement Brevo.
 * `npm run brevo:templates` compare en lecture seule ; --apply écrit :
 * ne pas lancer le script global avant d'avoir revu son périmètre (webinars).
 *
 * Guides : ALTHOCE_GUIDE_EMAIL_VERSION=2 choisit les publications #41–44,
 * créées depuis les HTML validés et relues via API. Vide/1 = #35–38 historiques.
 * La sélection ne change pas les identifiants de séquence ni les clés métier.
 * Désabonnement marketing : params.UNSUBSCRIBE_URL, pas {{ unsubscribe }}.
 */
import { guideEmailPublication } from "@/config/guideEmailPublications";

export interface EmailTemplateDef {
  name: string;
  subject: string;
  file: string;
  id: number | null;
}

export const EMAIL_TEMPLATES = {
  "guide-12-cas-ec.delivery": {
    ...guideEmailPublication("guide-12-cas-ec.delivery"),
    subject: "Votre guide Claude pour les experts-comptables",
    file: "emails/sequences/guide-12-cas-ec/delivery.html",
  },
  "guide-12-cas-ec.relance-j2": {
    ...guideEmailPublication("guide-12-cas-ec.relance-j2"),
    subject: "Quel premier usage IA pour votre cabinet ?",
    file: "emails/sequences/guide-12-cas-ec/relance-j2.html",
  },
  "generique.delivery": {
    ...guideEmailPublication("generique.delivery"),
    subject: "Votre guide : {{ params.GUIDE_TITLE }}",
    file: "emails/sequences/generique/delivery.html",
  },
  "generique.relance-j2": {
    ...guideEmailPublication("generique.relance-j2"),
    subject: "Votre guide IA : par où commencer ?",
    file: "emails/sequences/generique/relance-j2.html",
  },
  "interne.alerte": {
    name: "INTERNE · Alerte",
    subject: "{{ params.SUBJECT }}",
    file: "emails/interne/alerte.html",
    id: 40,
  },
  "webinar.confirmation": {
    name: "SEQ · Webinar · Confirmation",
    subject: "Inscription confirmée : {{ params.WEBINAR_TITLE }}",
    file: "emails/sequences/webinar/confirmation.html",
    id: null,
  },
  "webinar.j-1": {
    name: "SEQ · Webinar · Rappel J-1",
    subject: "Demain : {{ params.WEBINAR_TITLE }}",
    file: "emails/sequences/webinar/rappel-j-1.html",
    id: null,
  },
  "webinar.h-1": {
    name: "SEQ · Webinar · Rappel H-1",
    subject: "On commence dans une heure : {{ params.WEBINAR_TITLE }}",
    file: "emails/sequences/webinar/rappel-h-1.html",
    id: null,
  },
  "webinar.replay": {
    name: "SEQ · Webinar · Replay",
    subject: "Le replay : {{ params.WEBINAR_TITLE }}",
    file: "emails/sequences/webinar/replay.html",
    id: null,
  },
  "webinar.suivi": {
    name: "SEQ · Webinar · Suivi",
    subject: "Et maintenant, on l'applique chez vous ?",
    file: "emails/sequences/webinar/suivi.html",
    id: null,
  },
} satisfies Record<string, EmailTemplateDef>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
export function templateId(key: EmailTemplateKey): number | null {
  return EMAIL_TEMPLATES[key].id;
}
