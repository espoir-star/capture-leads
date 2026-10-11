# Emails de livraison : supprimer le bouton de confirmation d'adresse

Décision d'Espoir du 11/10/2026 : retirer la demande de confirmation d'adresse des prochains emails de livraison, sans toucher à l'accès au guide, au lien de rendez-vous, au désabonnement ni aux préférences enregistrées.

## Changement versionné

Les fichiers suivants retirent uniquement le bloc visuel facultatif de confirmation et sa phrase explicative :

- `emails/sequences/guide-12-cas-ec/delivery.html` — modèle Brevo #35.
- `emails/sequences/generique/delivery.html` — modèle Brevo #37.

Les trois autres liens de chaque modèle restent exactement identiques. Les modèles de relance #36 et #38 n'ont pas été modifiés. Les tests `tests/guide-email-copy.test.ts` vérifient le contenu des deux fichiers et la conservation des liens.

## Ce qui reste inchangé

- Les anciennes URLs `/confirmer-email` et leur endpoint continuent de fonctionner pour les emails déjà envoyés.
- Aucun contact n'est artificiellement marqué VERIFIED et aucun consentement n'est fabriqué.
- Les règles d'éligibilité marketing, de désabonnement, d'anti-robot, de scoring et de délivrance sont inchangées.
- Le paramètre technique CONFIRM_URL peut encore être transmis par le moteur, mais n'est plus affiché par ces nouveaux HTML. Le conserver évite de modifier le backend et les anciens liens dans ce changement de contenu.

## Publication Brevo : étape distincte, non exécutée par ces commits

Fusionner ces fichiers dans GitHub ne modifie PAS les modèles déjà enregistrés dans Brevo. Le connecteur utilisé pour cette intervention fournit des opérations de lecture/création, mais aucune opération de modification d'un modèle existant.

Pour appliquer le changement en ligne avec un accès autorisé :

1. Relire et sauvegarder les modèles actuels #35 et #37 hors du dépôt (ne pas écraser une modification concurrente).
2. Mettre à jour leur HTML en retirant uniquement le bloc `{% if params.CONFIRM_URL %} ... {% endif %}` et le texte de confirmation qu'il contient.
3. Conserver noms, objets, expéditeurs, Reply-To, statut actif, IDs, guide, lien RDV et désabonnement.
4. Auditer également les 9 anciens modèles de livraison identifiés précédemment (#1, #6, #9, #11, #16, #19, #26, #29, #34). Relire chaque contenu actuel puis supprimer uniquement le bloc conditionnel sur EMAIL_CONFIRM_TOKEN s'il correspond bien au bouton de confirmation d'adresse. Ne jamais supprimer le désabonnement ou modifier un workflow pour ce changement.
5. Contrôler les aperçus avec et sans prénom, puis un envoi QA limité à une adresse de test explicitement autorisée. Ne pas envoyer de campagne ni de relance à la base.
6. Consigner les IDs réellement modifiés et les résultats des contrôles. Ne pas affirmer que la suppression est en production avant relecture des modèles Brevo.

Ne pas lancer aveuglément la synchronisation globale des modèles : le script existant peut aussi créer des modèles de webinaire sans rapport avec cette demande. Privilégier une modification ciblée des HTML réellement concernés.
