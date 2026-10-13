# Claude Dashboards pour les cabinets

## État au 13 octobre 2026

Raccordement préparé dans la PR [#21](https://github.com/espoir-star/capture-leads/pull/21), branche `feat/guide-claude-dashboards-cabinets`, basée sur `main` `a964906`. Le checkout utilisateur `feat/liens-courts` reste intact. **Pas encore de GO public : réception réelle, callback n8n et recette CRM restent à confirmer.**

## Brevo réellement configuré

Après dry-run, création additive par API puis relecture :

| Objet | Valeur vérifiée |
| --- | --- |
| Dossier | `Lead Magnets`, ID **5** |
| Liste | `LM - Claude Dashboards cabinets`, ID **19** |
| Attributs normaux texte | `MG_REQ_19`, `MG_SENT_19`, `MG_ENROLLED_19` |
| Modèle livraison | **43**, actif, titre/lien du guide et désabonnement paramétrés |
| Modèle relance | **44**, actif, titre/lien du guide et désabonnement paramétrés |

Le deuxième dry-run ne prévoit aucune création. Aucun contact, liste historique, template ou automation n'a été modifié par le script.

```bash
# BREVO_API_KEY dans l'environnement serveur sécurisé, jamais en argument ni dans Git.
npm run brevo:dashboard-guide            # aperçu, aucune écriture
npm run brevo:dashboard-guide -- --apply # liste + 3 attributs manquants uniquement
```

Le script pagine les dossiers/listes, refuse les homonymes ambigus, un dossier différent, les types incompatibles et le dépassement de capacité. Il ne déplace ni ne renomme rien. Les créations ne sont pas réessayées aveuglément après erreur réseau : relancer le dry-run. Une seule instance à la fois, l'API de création de liste n'offrant pas de verrou distribué. Toute reprise relit la liste et les types.

## Raccordement au moteur commun

- Capture : `/r/tableaux-de-bord-claude-cabinets`, via `lib/ressources.ts`, formulaire et page merci existants.
- Lecture : `/g/tableaux-de-bord-claude-cabinets`, trois prompts copiables, six sources primaires.
- Mapping serveur : liste 19, `FINANCE`, `EXPERTISE_COMPTABLE`.
- Séquence dédiée : `guide-claude-dashboards-cabinets-v1`. Livraison `generique.delivery`, relance `generique.relance-j2`, à 48 heures si autorisée.
- Publication email : `ALTHOCE_GUIDE_EMAIL_VERSION=2` pour #43/#44. Aucun nouvel email, workflow n8n ou automation Brevo créé.
- Multi-guides : les champs 19 sont calculés par la configuration existante ; les demandes/reçus des neuf autres guides gardent leurs noms. Une seule fiche par email et mêmes clés anti-doublons par guide.
- Sans flag de livraison, ou adresse hors QA : réponse 503 avant écriture contact pour ce guide sans ancien moteur. Cela évite un faux succès sans livraison. Les guides historiques conservent leur repli existant.
- Lien interne relatif : reste sur la Preview depuis la page merci ; les emails utilisent un lien absolu construit côté serveur. `SITE_URL` ne doit pas forcer le domaine de production pendant une recette Preview du nouveau guide.
- Qualification, scoring, first touch, protections, opposition et consentement : parcours commun inchangé.

## LinkedIn

Code **db1 réservé** dans `config/shortLinks.ts`, campagne `guide_claude_dashboards_cabinets`, source `linkedin`, medium `organic`. La date réelle du post a été demandée, pas déduite de la création du guide. `utm_content: null` empêche la diffusion du code tant qu'elle n'est pas confirmée. Renseigner alors `LI_EC_AAAAMMJJ_01` (ou le numéro disponible ce jour-là). Ne pas partager `/l/db1` avant activation et recette. Aucune URL de post inventée dans `sourceRegistry.ts`.

## CRM

Le connecteur existant côté CRM est l'unique propriétaire de la synchronisation. Son parseur lit `MG_REQ_\d+`, la ressource, les noms de guides et la provenance imbriquée ; il n'est pas limité aux IDs 6–16. Le nouveau champ 19 respecte ce format. Le formulaire conserve `INTENT_UPDATED_AT`, besoin/horizon et le score nécessaires à sa politique d'admission. Aucune règle commerciale ni synchronisation supplémentaire créée.

Compatibilité du contrat/code ne signifie pas remontée réelle : vérifier le contact QA exact dans l'environnement de recette CRM, sans injecter de fausses tâches dans les files commerciales. Respecter les exclusions `IS_QA` existantes.

## Vérifications et limites de recette

- Sources Anthropic, Insee et CNIL relues le 13/10/2026 ; pas de promesse de connecteur comptable universel, de temps réel garanti ni d'autorisation juridique par le seul abonnement payant.
- Tests HTTP contre doubles locaux : nouveau guide QA → contact / champs 19 / livraison #43 / inscription dédiée / relance #44 ; rejeu sans doublon ; deux guides même email ; score 30 et first touch conservés ; opposition bloque la relance ; hors QA refusé sans contact. Ces tests n'envoient aucun email réel.
- Les suites communes vérifient aussi validation, anti-bot, cookies, scoring, sécurité et neuf guides existants. Voir le rapport de session pour le résultat du dernier commit.
- Les statuts `MG_SENT=SENT` et `MG_ENROLLED=ENROLLED` prouvent respectivement acceptation d'envoi et acceptation du webhook, **pas** réception en boîte ni succès du callback différé.

## Déploiement et portes de validation

Production Vercel relue dans le navigateur le 13/10 : neuf slugs en `:sans-liste`, `ALTHOCE_MULTI_GUIDES=on`, version email `2`. Le connecteur API Vercel renvoie 403 pour cette équipe ; la session navigateur a été reconnectée. Aucune valeur de production changée à ce stade.

1. Contrôler lint, types, tests, build, CI et Preview de la branche.
2. Recette limitée aux emails autorisés : `tableaux-de-bord-claude-cabinets:qa`, conserver l'ensemble des neuf flags actuels. Vérifier Turnstile sans le désactiver.
3. **Frontière n8n :** le workflow actuel rappelle `https://guide-gratuit-pi.vercel.app/api/sequences/step`. Avant fusion, la production ne connaît pas la séquence Dashboards. Ne pas inscrire un QA dans ce workflow depuis une Preview en prétendant valider sa relance. Prévoir un déploiement du code avec activation QA seulement, après accord explicite sur cette étape, ou un routage QA autorisé ; ne pas changer le callback commun des neuf guides.
4. Vérifier séparément : contact exact, MG_REQ_19, email #43 reçu avec lien fonctionnel, MG_SENT_19, inscription n8n, exécution et réception #44, deux guides/une fiche, opposition, contrôle CRM et responsive.
5. Après recette complète seulement : remplacer uniquement le suffixe du nouveau slug par `:sans-liste`, redéployer, vérifier l'environnement réellement pris en compte et refaire une capture QA. Aucun ancien workflow réactivé.
6. Confirmer date/UTM et alors diffuser le lien public. Aucun backfill, aucune campagne newsletter, aucun contact réel supprimé.

Retour arrière du seul nouveau guide : retirer son flag et redéployer ; les nouvelles soumissions seront refusées proprement. Préserver les neuf flags historiques et examiner séparément toute relance QA déjà inscrite. Aucune automation historique n'existe pour la liste 19.

## Sources

- [Anthropic : annonce Dashboards du 8 octobre](https://claude.com/resources/articles/dashboards-and-motion)
- [Anthropic : guide Dashboards, disponibilité, requêtes et actualisation](https://support.claude.com/fr/articles/17454700-commencer-avec-claude-dashboards)
- [Insee : ratios annuels Ésane 2023](https://www.insee.fr/fr/statistiques/2015421)
- [Insee : indice de production industrielle mensuel](https://www.insee.fr/fr/metadonnees/source/indicateur/p1646/presentation)
- [CNIL : précautions IA pour TPE/PME](https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme)
- [Anthropic : DPA des offres commerciales](https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa)
- [Brevo : création de liste](https://developers.brevo.com/reference/create-list)
