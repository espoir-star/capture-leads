# Publication des emails de guides : version Conseil IA

## État et périmètre

Le 11/10/2026, l'édition par navigateur des anciens modèles #35–38 a échoué avant sauvegarde. La relecture API a confirmé qu'ils sont restés inchangés. Pour publier sans écraser les modèles de repli, quatre publications ont été créées par l'API, avec `htmlUrl` pointant sur les fichiers approuvés au commit immuable `46a693113dca356f110bac986bae8f168995e66a`.

| Rôle | Ancien ID | ID créé et relu | Objet |
| --- | --- | --- | --- |
| Livraison 12 cas EC | 35 | 41 | Votre guide Claude pour les experts-comptables |
| Relance 12 cas EC | 36 | 42 | Quel premier usage IA pour votre cabinet ? |
| Livraison générique | 37 | 43 | Votre guide : {{ params.GUIDE_TITLE }} |
| Relance générique | 38 | 44 | Votre guide IA : par où commencer ? |

Les noms des publications portent le suffixe « · Conseil IA v2 ». Le HTML complet et les variables ont été relus dans Brevo. Expéditeur : Althoce / bonjour@althoce.fr ; Reply-To : espoir@contact.althoce.com ; tag sequences. Aucune campagne ou envoi de test n'est déclenché par la création des modèles.

Vouvoiement, cabinet de conseil IA, audit/formation/intégration, sans Bordeaux, sans CTA de confirmation. Les liens existants restent fonctionnels. Les anciennes automations de guides ne sont pas modifiées par cette publication.

## Activation après CI

- `ALTHOCE_GUIDE_EMAIL_VERSION=2` dans Vercel puis redeploy sélectionne les IDs 41–44.
- Valeur vide ou 1 : les anciens IDs restent utilisés.
- `ALTHOCE_MULTI_GUIDES` demeure un réglage indépendant, d'abord qa ; ne pas l'activer si le schéma Brevo est incomplet.
- `ALTHOCE_SEQUENCE_GUIDES` reste en `slug:qa` tant que les anciennes entrées Brevo ne sont pas coordonnées et le test réel validé.

La sélection de version est lue au chargement serveur : une modification de variable nécessite un redéploiement. Les noms de `EMAIL_TEMPLATES` suivent la version sélectionnée pour ne pas écraser les anciens modèles lors d'une synchronisation CLI.

## Anti-doublons pendant la publication

Les identités de séquence, étapes et clés métier sont conservées. La recherche du journal d'envoi filtre le destinataire, pas le modèle : un envoi sous #35 reste visible à une reprise utilisant #41. Les pages sont parcourues avec un plafond ; une réponse tronquée/invalide ou un plafond atteint entraîne UNKNOWN, pas un renvoi aveugle.

La conservation du journal Brevo est limitée : ne pas présenter ce dispositif comme une garantie universelle d'envoi exactement une fois pour une durée illimitée.

## Recette restante

Un test réel via capture QA reste nécessaire pour vérifier le rendu personnalisé des publications, leurs liens, la réception et le trajet n8n. Les tests unitaires avec API factice ne sont pas une preuve de délivrabilité ni de rendu dans chaque messagerie. Ne pas basculer les vrais prospects avant les contrôles de désabonnement, double demande et consolidation des relances.

## Retour arrière

Remettre `ALTHOCE_GUIDE_EMAIL_VERSION=1` puis redéployer. Garder la recherche d'idempotence tous modèles : elle doit continuer à voir les emails déjà émis sous les nouveaux IDs. Ne jamais rejouer une séquence pour simplement changer son design.
