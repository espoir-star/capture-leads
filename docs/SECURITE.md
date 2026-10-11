# Audit de sécurité et de fiabilité — 11/10/2026

Périmètre : site de capture (Next.js / Vercel), Brevo, n8n, échanges entre services.
Statuts :
- **Corrigé** : code modifié et testé, sur la branche `fix/securite-envoi-unique` (PR #3, empilée sur #2 et #1) ;
- **Préparé** : prêt, attend votre accord ;
- **Signalé** : hors périmètre modifiable ;
- **Reste** : non traité.

Rien n'est en production tant que les PR ne sont pas fusionnées.

## P0 — critique

| # | Risque | Statut | Preuve |
| --- | --- | --- | --- |
| 1 | n8n 2.1.5 : plus de 180 avis de sécurité (13 à 17 critiques, une quarantaine sans authentification) | **Corrigé le 11/10/2026** : snapshot, archive du volume, mise à jour vers 2.42.6 figée (`docs/N8N_MISE_A_JOUR.md`) | 31/31 workflows, 2 actifs inchangés, credentials déchiffrés, plus aucun avis corrigible |
| 2 | Double email : l'`idempotencyKey` Brevo ne vaut que 15 à 30 min, n8n réessaie après 30 min ; une double inscription donnait deux clés | **Corrigé** : `lib/brevo/sendOnce.ts` (clé contact × séquence × étape, journal Brevo avant tout envoi, idempotence pour la concurrence, états PENDING / SENDING / SENT / FAILED / UNKNOWN, `messageId` historisé) | 11 tests unitaires, e2e SEC2, tests réels (§ Tests) |
| 3 | Next.js 15.5.20 : vulnérabilité critique (Server Actions : déni de service, SSRF) | **Corrigé** : 15.5.27 | `npm audit` : 0 critique |
| 4 | Webhooks et appels inter-services : jeton accepté dans l'URL et sans « Bearer », corps lu en entier avant contrôle de taille | **Corrigé** : Bearer strict, plus de `?token=`, lecture bornée (413 avant lecture) sur les 10 routes | e2e SEC1 (6 routes × 9 cas), n8n Header Auth en réel, production 401/405 |

## P1 — important

| # | Risque | Statut | Preuve |
| --- | --- | --- | --- |
| 5 | Turnstile en « fail-open » : panne Cloudflare = formulaire ouvert aux robots, qui peuvent faire envoyer des emails à des tiers | **Corrigé** : mode dégradé. Prospect enregistré, guide affiché, **aucun email automatique**, aucun ajout à la liste ; plafonds 2/10 min par IP et 20/h par instance ; soumission marquée non vérifiée | e2e SEC4, tests unitaires (jeton absent, invalide, expiré, réutilisé, 5xx, erreur interne) |
| 6 | Livraison du guide via `after()` : perdue sans trace si la fonction est coupée | **Corrigé** : tâche `GUIDE_DELIVERY_STATUS` écrite avec le contact, reprise horaire sans doublon, expirée après 72 h | 5 tests + e2e S1 |
| 7 | Limitation de débit en mémoire, par instance Vercel | **Préparé** : règle de pare-feu Vercel, incluse dans Hobby (1 règle). Le limiteur en mémoire reste la première barrière | à configurer, voir `MISE_EN_PRODUCTION.md` |
| 8 | Journal n8n : doublons possibles sous concurrence, croissance illimitée | **Corrigé** : doublons supprimés à chaque passe, conservation 400 jours | test réel : 2 lignes ramenées à 1, ancienne supprimée |
| 9 | Clics de robots (antivirus de messagerie) gonflant le score | **Corrigé** : un clic moins de 15 s après l'envoi n'est pas compté. Cas réel relevé : 14 s | test unitaire, e2e SC7 |
| 10 | Webhook abandonné par Brevo = clic perdu | **Corrigé** pour les emails transactionnels : la tâche horaire relit le journal des clics avec la même clé, sans double comptage. Campagnes : voir P2 | e2e SC8 |
| 11 | 2 webhooks métier n8n actifs **sans authentification** : `althoce-contact` (formulaire du site) et « Agent vocal » | **Signalé**, non modifié (workflows métier) | export du 10/10 |
| 12 | Secrets dans les journaux ou dans Git | **Vérifié** | e2e SEC3 (aucun secret dans les journaux du serveur), analyse du diff, export n8n sans secret |

## P2 — à planifier

| # | Sujet | Statut |
| --- | --- | --- |
| 13 | 13 vulnérabilités dans les outils de build (tailwind, eslint, gray-matter/js-yaml sur nos propres fichiers), non atteignables par une requête | Reste : migration Tailwind 4 / eslint 16 |
| 14 | CSP stricte des scripts (nonces) | Reste : CSP minimale en place (`frame-ancestors`, `object-src`, `base-uri`, `form-action`) |
| 15 | n8n → Vercel : jeton Bearer statique, sans signature horodatée | Atténué : toutes les routes sont idempotentes (un rejeu ne produit rien de plus), TLS partout. Rotation des secrets si fuite |
| 16 | Rattrapage des clics de **campagnes** (newsletters) abandonnés par Brevo | Reste : poids faible (+3) |
| 17 | Contrôle du `hostname` renvoyé par Turnstile | Reste |
| 18 | n8n : rétention d'exécutions très courte (1 exécution conservée), passage en 3.0 à préparer | Reste : `docs/N8N_MISE_A_JOUR.md` § 8 |
| 19 | Offre Vercel Hobby réservée à un usage non commercial | À vérifier : Pro = 20 $/mois si nécessaire |

## Désabonnement

`OPPOSED` bloque toute étape marketing : elle est vérifiée **au moment de l'envoi** (une désinscription pendant l'attente est respectée), ainsi que les campagnes (`emailBlacklisted`).
- Aucune réinscription automatique : une nouvelle capture ne lève pas une opposition (e2e E, E2, E3).
- Les guides explicitement demandés restent livrés (transactionnel).
- Une plainte pour spam vaut opposition.

## Tests

Revalidés le 11/10/2026 après chaque correction importante :
- `npm ci`, lint, typecheck et build : OK (Next.js 15.5.27) ;
- **122 tests unitaires** et **41/41 scénarios de bout en bout** OK ;
- CI GitHub : identiques, sans secret ni réseau tiers (faux Brevo, faux n8n, faux Cloudflare).

Tests réels :

| Test | Résultat |
| --- | --- |
| Brevo, adresse QA : 1er envoi puis rejeu immédiat | 1 email (rejeu refusé par l'idempotence) |
| Brevo, adresse QA : 5 appels simultanés | 1 email (1 envoyé, 2 refusés comme doublons, 2 « issue incertaine », non renvoyés) |
| Brevo : délai d'apparition d'un envoi dans le journal | 51 s |
| Brevo : reprise à +31 min (idempotence expirée, passage de minuit) | email retrouvé au journal, **rien renvoyé** |
| Brevo : reprise à +2 h 22 | email retrouvé au journal, **rien renvoyé** ; décompte final au journal Brevo et dans la boîte de réception : 1 email par clé |
| n8n, credential jetable (supprimé) : sans jeton / jeton faux / sans « Bearer » | 403 / 403 / 403 ; mauvaise méthode 404 ; JSON cassé 422 ; lot invalide 400 |
| n8n : journal (11/11) et entretien (5/5) | OK, données et workflows de test supprimés |
| Production actuelle : webhook Brevo sans jeton / jeton faux / GET | 401 / 401 / 405 |

## Coûts

0 € de plus :
- règle de limitation de débit Vercel incluse dans Hobby ;
- Brevo Free (attention : 300 emails/jour) ;
- n8n existant ;
- aucun nouveau service.

À vérifier : l'usage commercial sur Vercel Hobby (P2 n° 19).
