# Claude Dashboards pour les cabinets

## État au 13 octobre 2026

Raccordement fusionné dans la PR [#21](https://github.com/espoir-star/capture-leads/pull/21), commit de production `c46f36a887123054bd38fb791839672a629f23a9`. Déploiement effectué après accord explicite pour **QA uniquement** : `tableaux-de-bord-claude-cabinets:qa`. Les neuf guides historiques restent actifs sans changement. Le checkout utilisateur `feat/liens-courts` est intact. L'ouverture publique nécessite un accord distinct.

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

Date de publication confirmée par Espoir : **13/10/2026**. Code **db1** dans `config/shortLinks.ts`, campagne `guide_claude_dashboards_cabinets`, source `linkedin`, medium `organic`, contenu **LI_EC_20261013_01**. La cible exacte est couverte par un test.

Lien préparé : `https://guide-gratuit-pi.vercel.app/l/db1`.

Cible : `https://guide-gratuit-pi.vercel.app/r/tableaux-de-bord-claude-cabinets?utm_source=linkedin&utm_medium=organic&utm_campaign=guide_claude_dashboards_cabinets&utm_content=LI_EC_20261013_01`.

Ne pas diffuser le lien tant que la capture reste réservée aux adresses QA. Aucune URL de post inventée dans `sourceRegistry.ts`.

## CRM

Le connecteur existant côté CRM est l'unique propriétaire de la synchronisation. Son parseur lit `MG_REQ_\d+`, la ressource, les noms de guides et la provenance imbriquée ; il n'est pas limité aux IDs 6–16. Le nouveau champ 19 respecte ce format. Le formulaire conserve `INTENT_UPDATED_AT`, besoin/horizon et le score nécessaires à sa politique d'admission. Aucune règle commerciale ni synchronisation supplémentaire créée.

La recette réelle utilise les contacts QA existants 1811, 1812 et 1814, marqués `IS_QA=true`. Import du contact 1811 par la commande existante `sync_brevo --mode qa`, limité à cet ID, dans la base isolée `brevo_live_qa`, avec les retours CRM vers Brevo désactivés. Résultat : une fiche, un dossier, une tâche, priorité P1 ; objectif, horizon, guide 19 et first touch reconnus. Une deuxième ressource et les rejouements enrichissent la même fiche. Les coordonnées restent à vérifier : aucun faux numéro conservé. Contrôle ciblé en lecture seule dans le CRM de production pour confirmer l'exclusion des QA.

## Vérifications et limites de recette

- Sources Anthropic, Insee et CNIL relues le 13/10/2026 ; pas de promesse de connecteur comptable universel, de temps réel garanti ni d'autorisation juridique par le seul abonnement payant.
- Tests HTTP contre doubles locaux : nouveau guide QA → contact / champs 19 / livraison #43 / inscription dédiée / relance #44 ; rejeu sans doublon ; deux guides même email ; score 30 et first touch conservés ; opposition bloque la relance ; hors QA refusé sans contact. Ces tests n'envoient aucun email réel.
- Les suites communes vérifient aussi validation, anti-bot, cookies, scoring, sécurité et neuf guides existants. Voir le rapport de session pour le résultat du dernier commit.
- Les statuts `MG_SENT=SENT` et `MG_ENROLLED=ENROLLED` prouvent respectivement acceptation d'envoi et acceptation du webhook, **pas** réception en boîte ni succès du callback différé.

Recette réelle du 13/10 :

- Formulaire avec Turnstile actif, sans contournement : accepté pour les adresses QA.
- Email #43 Dashboards reçu dans la boîte Althoce à 17:50 (Paris), lien ouvert vers le bon guide. Email #43 Pennylane reçu après demande avec la même adresse. Nouvelle demande Dashboards : aucune deuxième livraison.
- `MG_REQ_19`, `MG_SENT_19`, `MG_ENROLLED_19` relus dans Brevo. Même contact 1811 ; score initial 12, puis 15 après interaction et conservé lors de la nouvelle soumission à 12. First touch historique LinkedIn conservé. Le clic générique ne transforme pas `PENDING` en `VERIFIED`.
- Second QA 1812 : livraison reçue, lien de désabonnement puis confirmation utilisés ; `OPPOSED` et `emailBlacklisted=true` relus.
- Formulaire, guide, copie des prompts et bannière contrôlés à 360/390 px et sur ordinateur ; aucun débordement horizontal. « Gérer mes cookies », ALL, ESSENTIAL et retour ALL → ESSENTIAL fonctionnent. En ESSENTIAL : scripts du site et Turnstile uniquement observés. GA/Meta/Brevo navigateur ne sont pas configurés sur ce déploiement ; aucun chargement ALL de ces services n'est donc revendiqué.
- 220 tests unitaires et 49 scénarios HTTP E2E réussis, ainsi que lint, types, analytics et build. CI de la branche et du commit fusionné réussies. Les dix routes de capture répondent HTTP 200.
- Consolidation multi-guides : exécution n8n 491 terminée le 13/10 à 16:14:16 UTC, raison `multi_guide_consolidated`. La demande Pennylane plus récente supprime la relance Dashboards du contact 1811 ; le rejeu d'un guide ne recommence pas son délai.
- Test isolé du guide sur le QA 1814, sans deuxième guide demandé pendant l'attente : provenance `LI_EC_20261013_01` enregistrée dans `MG_REQ_19`, first touch historique conservé et score 12. Callback et opposition sont vérifiés à leurs échéances réelles, sans raccourcir le délai existant ni simuler le callback.
- La session macOS s'est verrouillée après la vérification en boîte des livraisons #43. La lecture des emails #44 dans Gmail nécessite donc une confirmation humaine ultérieure, distincte du statut `delivered` fourni par Brevo.

## Déploiement et portes de validation

Production Vercel vérifiée via la session navigateur autorisée : neuf slugs en `:sans-liste`, nouveau slug en `:qa`, `ALTHOCE_MULTI_GUIDES=on`, version email `2`. Seul le flag du nouveau guide a été ajouté. Le connecteur API Vercel n'a pas accès à cette équipe ; le déploiement a été suivi dans Vercel et via les statuts GitHub.

Le workflow n8n existant `PLyOhSt5zreUoBKW` rappelle `https://guide-gratuit-pi.vercel.app/api/sequences/step`. C'est pourquoi le déploiement sur ce domaine, limité à la QA, a été expressément autorisé. Aucun callback ni workflow commun modifié. Échelle QA existante 120 : attente de 24 minutes pour J+2 ; le délai réel des prospects reste 48 heures.

Preview du code raccordé : `https://capture-leads-bqt16zh0e-espoirs-projects-0a605452.vercel.app/r/tableaux-de-bord-claude-cabinets`.

Avant l'ouverture publique :

1. Terminer la recette réelle de relance et d'opposition, présenter le rapport.
2. Obtenir l'accord d'ouverture publique. L'accord de déploiement QA ne vaut pas autorisation `:sans-liste`.
3. Remplacer uniquement le suffixe du nouveau slug par `:sans-liste`, redéployer, vérifier l'environnement effectivement pris en compte et refaire une capture QA. Aucun ancien workflow réactivé.
4. Diffuser `/l/db1` avec la date confirmée. Aucun backfill, aucune campagne newsletter, aucun contact réel supprimé.

Retour arrière du seul nouveau guide : retirer son flag et redéployer ; les nouvelles soumissions seront refusées proprement. Préserver les neuf flags historiques et examiner séparément toute relance QA déjà inscrite. Aucune automation historique n'existe pour la liste 19.

## Sources

- [Anthropic : annonce Dashboards du 8 octobre](https://claude.com/resources/articles/dashboards-and-motion)
- [Anthropic : guide Dashboards, disponibilité, requêtes et actualisation](https://support.claude.com/fr/articles/17454700-commencer-avec-claude-dashboards)
- [Insee : ratios annuels Ésane 2023](https://www.insee.fr/fr/statistiques/2015421)
- [Insee : indice de production industrielle mensuel](https://www.insee.fr/fr/metadonnees/source/indicateur/p1646/presentation)
- [CNIL : précautions IA pour TPE/PME](https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme)
- [Anthropic : DPA des offres commerciales](https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa)
- [Brevo : création de liste](https://developers.brevo.com/reference/create-list)
