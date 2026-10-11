/**
 * Publications réellement créées et relues dans Brevo le 11/10/2026.
 * Les modèles #35–38 sont conservés intacts pour retour arrière.
 * ALTHOCE_GUIDE_EMAIL_VERSION=2 sélectionne les nouveaux modèles #41–44.
 * Aucun changement d'identité de séquence ni de clé d'envoi.
 */
export const GUIDE_EMAIL_PUBLICATIONS = {
  "guide-12-cas-ec.delivery": { name: "SEQ · 12 cas EC · Livraison", legacyId: 35, publishedId: 41 },
  "guide-12-cas-ec.relance-j2": { name: "SEQ · 12 cas EC · Relance J+2", legacyId: 36, publishedId: 42 },
  "generique.delivery": { name: "SEQ · Générique · Livraison", legacyId: 37, publishedId: 43 },
  "generique.relance-j2": { name: "SEQ · Générique · Relance J+2", legacyId: 38, publishedId: 44 },
} as const;

export type GuideEmailKey = keyof typeof GUIDE_EMAIL_PUBLICATIONS;
export function guideEmailPublication(key: GuideEmailKey, version = process.env.ALTHOCE_GUIDE_EMAIL_VERSION) {
  const p = GUIDE_EMAIL_PUBLICATIONS[key];
  return version === "2"
    ? { name: `${p.name} · Conseil IA v2`, id: p.publishedId }
    : { name: p.name, id: p.legacyId };
}
