# Emails de guides — présentation cabinet de conseil IA (11/10/2026)

## Demande d’Espoir

- Vouvoiement intégral.
- Présenter Althoce comme un **cabinet de conseil en intelligence artificielle**.
- Mentionner trois accompagnements : **audit IA, formation, intégration**.
- Aucune mention de Bordeaux ni de positionnement « agence » dans les nouveaux emails.
- Retirer le bouton facultatif de confirmation d’adresse des prochains emails, tout en laissant les anciens liens fonctionner.
- Design cohérent avec les pages de capture : palette #0A0A0A / #111311 / #1D9E75 / #26C08F, carte de ressource, typographie hiérarchisée, bouton principal unique, signature EM ; pas d’emojis décoratifs.

## Texte commun intégré

> Althoce, cabinet de conseil en intelligence artificielle, vous accompagne dans l’audit de vos usages et opportunités IA, la formation de vos équipes et l’intégration de solutions adaptées à vos métiers.

## Fichiers concernés dans le dépôt

- `emails/sequences/guide-12-cas-ec/delivery.html` — Brevo #35
- `emails/sequences/guide-12-cas-ec/relance-j2.html` — Brevo #36
- `emails/sequences/generique/delivery.html` — Brevo #37
- `emails/sequences/generique/relance-j2.html` — Brevo #38
- `tests/guide-email-copy.test.ts`

Les noms et IDs des modèles sont conservés. Les URLs des guides, du rendez-vous et du désabonnement restent identiques ; un lien de confidentialité est présent dans le pied de page.

## Publication distincte de la modification GitHub

Le navigateur sécurisé a redirigé vers login.brevo.com lors du contrôle de la session. **Aucun HTML enregistré dans Brevo n’a été remplacé pendant cette préparation.** Une fusion GitHub seule ne modifie pas le contenu des modèles Brevo.

Après reconnexion :
1. Sauvegarder le HTML et la configuration des modèles concernés.
2. Publier uniquement les quatre modèles #35–38 et leurs objets validés ; ne pas appliquer aveuglément le script général qui pourrait créer les modèles webinars encore inactifs.
3. Vérifier par relecture API le HTML réellement enregistré, les paramètres, les expéditeurs et le Reply-To.
4. Envoyer un test à une adresse QA autorisée, après validation, et vérifier la réception sur ordinateur/mobile.
5. Harmoniser séparément les 18 anciens emails de livraison/relance mappés dans `config/leadMagnets.ts`. Sauvegarder d’abord et préserver leur mécanisme de désabonnement historique : ne pas substituer `params.UNSUBSCRIBE_URL` si l’ancienne automation ne fournit pas ce paramètre.

## Invariants

Aucune modification du scoring, de l’éligibilité marketing, des routes de confirmation, du formulaire, des automations ou des contacts. Aucun passage automatique de PENDING à VERIFIED. Aucun email réel envoyé pendant la préparation. Ne pas confondre tests navigateur/CI et rendu prouvé dans Outlook/Gmail/Apple Mail.
