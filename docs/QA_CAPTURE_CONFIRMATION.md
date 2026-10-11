# Recette de capture — éviter les faux positifs (11/10/2026)

## Diagnostic

Un ancien compte rendu de navigateur automatisé affirmait une capture réussie sur la seule présence de la page `/merci`, alors que le contact QA était introuvable dans Brevo. Une nouvelle tentative a affiché l'erreur « La vérification anti-robot a échoué. Réessayez. » et n'a pas obtenu de confirmation de capture. Il n'est donc pas établi qu'une capture acceptée par Brevo ait été perdue.

Le code présentait néanmoins un faux positif possible : `CaptureForm` traitait toute réponse HTTP 2xx comme un succès, y compris la réponse volontairement factice du honeypot (`{ ok: true }`, sans écriture CRM).

## Correction limitée

- Avant toute redirection de succès, vérifier `ok === true` et la structure du `leadRef` renvoyé par le serveur après une écriture de contact.
- Les réponses sans référence, malformées ou en erreur n'entraînent ni redirection ni conversion analytics.
- Effacer les références en session de l'ancienne tentative avant une nouvelle soumission.
- Une panne analytics ne doit pas bloquer la redirection d'une capture confirmée.
- Ne changer ni les protections Turnstile/honeypot, ni les préférences marketing, ni les workflows de production.

Le contrôle client valide un contrat de réponse : il ne remplace pas la vérification cryptographique serveur. Une capture confirmée n'est pas encore une preuve de livraison du mail.

## Recette à retenir

1. Utiliser une adresse QA autorisée, jamais celle d'un prospect.
2. Laisser le champ caché `website` vide. Ne pas cliquer sur l'opposition dans le scénario sans opposition.
3. Laisser Turnstile se valider normalement. Si refus, enregistrer un test **bloqué**, sans désactiver la protection en production.
4. Soumettre le formulaire une seule fois. Relever le HTTP et les booléens `ok`, `leadRef présent`, jamais le jeton lui-même.
5. Ne jamais naviguer manuellement vers `/merci` pour prouver une inscription.
6. Vérifier séparément : contact exact dans Brevo, résultat d'envoi/livraison, puis relance n8n et opposition.
7. Si le navigateur automatisé reste bloqué, utiliser un vrai navigateur pour la capture. L'autre possibilité est une Preview isolée avec les clés de test officielles, jamais une exception anti-robot activable sur le site public.

Les alias de test et la cadence QA restent ceux configurés dans Vercel. Aucune modification d'attribut, suppression de contact ou bascule de guide n'est nécessaire pour ce correctif.
