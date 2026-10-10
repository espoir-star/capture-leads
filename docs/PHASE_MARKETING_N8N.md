# Phase marketing B2B — branche de préparation (NE PAS déployer directement)

## Objet

Le formulaire n'affiche plus de case opt-in newsletter. Il informe les professionnels du suivi métier et donne une opposition immédiate « Ne pas recevoir ces communications ». Le consentement aux cookies est indépendant et inchangé.

- `MARKETING_STATUS` : `CONSENT`, `B2B_ELIGIBLE`, `OPPOSED`, `TO_REVIEW`
- `MARKETING_OPTOUT_TOKEN` : jeton chiffré pour la future relance externe et `/desinscription`
- Une opposition inscrit `OPPOSED` et `emailBlacklisted=true` dans Brevo. Ne jamais lever automatiquement ce blocage au téléchargement d'un autre guide.
- Les contacts anciens `OPT_IN=false` ou sans statut qualifié ne doivent pas être ajoutés en masse à une newsletter. Les emails liés à un métier restent soumis aux critères professionnels, à l'information lors de la collecte et à l'opposition.
- Les campagnes `newsletter-as-code` sont bloquées en création tant que les critères réels des segments ne sont pas vérifiés dans Brevo (variable de contrôle `MARKETING_SEGMENTS_REVIEWED=true`).

## IMPORTANT : encore incomplet, ne pas merger

1. **Vérifier le comportement réel du champ `emailBlacklisted` de Brevo** en création/mise à jour et la distinction marketing/transactionnel. Tester sur la maquette et avec un compte QA, jamais sur la base réelle.
2. **Mettre à jour tous les tests** (`tests/e2e/run.ts` et autres) pour la suppression du champ `optIn`. Vérifier le formulaire en mode `marketingOpposition` et l'état des contacts précédemment bloqués.
3. **Synchroniser le désabonnement des campagnes marketing** via le webhook Brevo (types exacts, authentification, déduplication), et valider la propagation vers les workflows externes.
4. **Reconfigurer manuellement les segments Brevo 7, 8, 9** : ils filtrent actuellement `OPT_IN=true`, et doivent filtrer `MARKETING_STATUS` éligible, hors `OPPOSED`, hors blocklistés et statuts email invalides. Tester les effectifs avant tout envoi.
5. **Compléter le moteur externe d'envoi** : API transactionnelle Brevo pour le guide demandé, orchestration n8n avec suivi durable des étapes, retries et arrêt sur opposition. Le code actuel ne remplace pas encore les workflows Brevo.
6. Migrer le guide pilote par étapes ; **ne pas couper l'automation existante** avant tests de livraison, timing et absence de double envoi. Quotas Free 300 emails/jour à conserver.
7. **Ne pas ajouter automatiquement les anciens contacts**. La liste historique ne prouve pas l'éligibilité marketing.
8. Vérifier les flux de **re-confirmation** : une ancienne page `/confirmer-email` offre peut-être un opt-in ; éviter les contradictions si l'utilisateur s'était opposé.

## Validation exigée

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`. Tests navigateur Preview sur guide pilote, newsletter opt-out, Brevo réel limité à QA. Aucun déploiement ni modification d'automation réelle avant revue.

Ce fichier suit la première itération et signale explicitement qu'elle n'est **pas prête à merger**.
