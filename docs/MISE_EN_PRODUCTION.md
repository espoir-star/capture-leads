# Plan de mise en production progressive (avec retour arrière)

Ordre : PR #1 → #2 → #3, une étape à la fois. Chaque étape est réversible et se vérifie avant de passer à la suivante.
- « Vous » : action qui touche des secrets ou un serveur auquel je n'ai pas accès.
- « Validation » : vous me donnez votre accord avant que je l'exécute.

**État au 11/10/2026, 1 h 40.**
- ✅ Étapes 0, 1, 2, 3 et 4 faites.
- ✅ Étape 6 en partie : les workflows « Journal » et « Recalcul » sont actifs et les 2 webhooks Brevo complétés.
- ⏳ Étape 5 (pilote QA) et fin de l'étape 6 : il reste à enregistrer 4 variables Vercel, puis à redéployer. Le classifieur de sécurité m'a interdit d'enregistrer moi-même des variables de production :
  - `N8N_EVENTS_WEBHOOK_URL` = `https://n8n.srv1242605.hstgr.cloud/webhook/althoce-marketing-events`
  - `ALTHOCE_SEQUENCE_GUIDES` = `12-cas-usage-experts-comptables:qa`
  - `ALTHOCE_SEQUENCE_QA_EMAILS` = `espoir+qa-pilote@contact.althoce.com,espoir+qa-pilote-optout@contact.althoce.com`
  - `ALTHOCE_SEQUENCE_QA_TIME_SCALE` = `120`

Vérifications de la nuit (11/10) :
- Workflows actifs : Alertes, Quota Brevo et RDV, Journal, Recalcul, Séquences. Leurs webhooks refusent toute requête sans jeton (403).
- Première exécution de « Quota » à 2 h 07 : OK (223 envois restants sur 300, aucune livraison en attente).
- Première exécution de « Recalcul » à 2 h 17 : OK.
- Jeton n8n → Vercel vérifié en réel (200). Jeton Vercel → n8n : vérifié au premier événement après l'enregistrement de `N8N_EVENTS_WEBHOOK_URL`.
- Webhooks Brevo complétés : la production reçoit bien les événements (200, ignorés tant que le scoring n'est pas branché).
- ⚠️ **Email d'alerte (contenu HTML, sans modèle)** : accepté et « sent » par Brevo à 1 h 26, mais **toujours pas délivré une heure plus tard**. Un email à modèle part, lui, en 1 s. Les alertes « lead chaud » et « quota » utilisent le même procédé. À vérifier :
  - s'il est arrivé au réveil, rien à faire ;
  - sinon, faire passer les alertes internes par un modèle Brevo, comme les autres emails.

| # | Étape | Qui | Contrôle | Retour arrière |
| --- | --- | --- | --- | --- |
| 0 | **n8n** : snapshot hPanel, sauvegarde serveur, mise à jour vers 2.42.6 (`docs/N8N_MISE_A_JOUR.md` § 4 à 6) | Vous (validation) | 31 workflows, credentials lisibles, formulaire du site OK | Snapshot ou archive du volume (§ 7) |
| 1 | **Secrets** : 2 credentials Header Auth n8n et variables Vercel `N8N_WEBHOOK_TOKEN`, `SEQUENCE_API_SECRET`, `N8N_SEQUENCE_WEBHOOK_URL` (`PHASE_MARKETING_N8N.md` § 3). Laisser **vides** `ALTHOCE_SEQUENCE_GUIDES` et `N8N_EVENTS_WEBHOOK_URL` | Vous | Credentials rattachés aux nœuds listés | Supprimer les variables |
| 2 | **Attributs Brevo** : `npm run brevo:attributes -- --apply` (8 attributs, aucun contact modifié). **Avant** le déploiement : la capture écrit `FORM_SCORE` | Moi (validation) | Nouvelle simulation : « Rien à créer » | Attributs vides et inutilisés : sans effet |
| 3 | **Fusion** PR #1, puis #2, puis #3 → déploiement Production. Livraisons inchangées (automations Brevo) ; les correctifs de sécurité sont actifs | Moi (validation) | Formulaire réel, page merci, email du guide reçu (automation), `npm run brevo:smoke` | « Instant Rollback » Vercel vers le déploiement précédent |
| 4 | **n8n** : activer « Alertes n8n », puis « Quota Brevo et RDV » | Moi (validation) | Exécution horaire en succès : quota affiché, 0 livraison en attente | Désactiver le workflow |
| 5 | **Pilote en mode QA** : `ALTHOCE_SEQUENCE_GUIDES=12-cas-usage-experts-comptables:qa`, adresses QA, accélération 120 ; activer « Séquences » | Vous (variables) + moi (activation) | Avec 2 adresses QA : livraison, relance J+2 (≈ 24 min), désinscription avant la relance, double inscription → 1 email | Vider la variable, désactiver le workflow |
| 6 | **Scoring** : `N8N_EVENTS_WEBHOOK_URL`, activer « Journal » et « Recalcul », puis `npm run brevo:webhooks -- --url … --apply` (complète les 2 webhooks existants) | Vous (variable) + moi (validation) | Clic QA → ligne dans la Data table, `BEHAVIOR_SCORE` sur la fiche, aucune alerte en double | Vider `N8N_EVENTS_WEBHOOK_URL` : le scoring s'arrête, les scores restent |
| 7 | **Bascule du pilote** : fermer l'entrée de l'automation #4, retirer `:qa` (`PHASE_MARKETING_N8N.md` § 4) | Validation | 48 h : `guide_delivered`, `GUIDE_DELIVERY_STATUS=SENT`, relances J+2 | Remettre la liste 10 dans le déclencheur de #4, retirer le slug |
| 8 | **Pare-feu Vercel** (Hobby : 1 règle) : `POST /api/lead`, 10 requêtes/min par IP, réponse 429 | Vous ou moi (validation) | 11e requête/min → 429 ; formulaire normal OK | Supprimer la règle |
| 9 | Migration des 8 autres guides, un par un (`PHASE_MARKETING_N8N.md` § 5) | Validation par guide | Comme l'étape 7 | Comme l'étape 7 |

## Après chaque étape

- `npm run brevo:smoke`, un formulaire réel, et la boîte `espoir@contact.althoce.com` (alertes).
- Vercel → Logs : aucune erreur `brevo`, `sequence_step error` ou `Journal n8n indisponible`.
- n8n → Executions : aucun échec ; sinon, l'alerte email arrive.
