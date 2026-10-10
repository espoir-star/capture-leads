# Phase marketing B2B + moteur de séquences (Vercel + n8n)

Branche `feat/b2b-marketing-optout-n8n-pilot` (PR #1). **Rien n'est en Production** tant que la PR n'est pas fusionnée ; aucun guide n'a basculé (`ALTHOCE_SEQUENCE_GUIDES` vide).

## 1. Ce qui change

| Sujet | Avant | Après |
| --- | --- | --- |
| Formulaire | case newsletter facultative (OPT_IN) | mention métier + lien « Ne pas recevoir ces communications » ; confirmation affichée **après** enregistrement serveur (page merci) |
| Statut marketing | `OPT_IN` | `MARKETING_STATUS` : `CONSENT` / `B2B_ELIGIBLE` / `TO_REVIEW` / `OPPOSED` (`lib/marketing/status.ts`) |
| Désinscription | lien Brevo des campagnes | + `/desinscription` (bouton, POST) et désinscription **en un clic** des messageries (`List-Unsubscribe`, RFC 8058) → `OPPOSED` + blocage marketing |
| Livraison du guide | automation Brevo (liste → email #1) | guide basculé : **email transactionnel envoyé par Vercel** à l'inscription |
| Relances | automation Brevo (limite 2 000 contacts) | **un seul workflow n8n générique** + `/api/sequences/step` (Vercel décide) |

### Règles de statut

- `OPPOSED` : opposition au formulaire, `/desinscription`, désinscription Brevo (webhook `unsubscribed`), contact bloqué. Jamais levé par une nouvelle capture.
- `CONSENT` : ancien `OPT_IN = true`, conservé.
- `TO_REVIEW` : ancien `OPT_IN = false` (jamais converti), ou guide sans verticale connue.
- `B2B_ELIGIBLE` : capture sur un guide métier, mention affichée, pas d'opposition. Un `TO_REVIEW` sans refus historique le devient à sa prochaine capture métier.
- Newsletters et étapes marketing : `CONSENT` ou `B2B_ELIGIBLE`, non bloqué, email ni INVALID ni DISPOSABLE ni BOUNCED.
- Backfill (à blanc) : `CONSENT` si `OPT_IN = true`, `OPPOSED` si bloqué, sinon `TO_REVIEW` (jamais `B2B_ELIGIBLE` : l'information lors de la collecte historique n'est pas prouvée).

## 2. Constats vérifiés sur le compte Brevo réel (10/10/2026, contacts QA)

1. **`emailBlacklisted` = blocage marketing seulement** : un contact bloqué reçoit toujours un email transactionnel (`/smtp/email`). Utilisé pour livrer le guide demandé, jamais pour contourner une opposition (les étapes marketing sont filtrées par le moteur).
2. **Une automation Brevo envoie aussi à un contact bloqué** : l'email #9 est parti 30 s après l'ajout d'un contact bloqué à la liste 10 (relance J+2 en observation jusqu'au 12/10). Conséquence : tant qu'un guide est sur son automation, un opposant n'est **pas ajouté à la liste** et reçoit le guide en transactionnel (modèle générique).
3. **`idempotencyKey` est respecté** : un 2e envoi avec la même clé est refusé (`400 duplicate_parameter`). C'est la protection durable contre les doublons (rejeu n8n, reprise réseau, double inscription). La clé est visible dans les en-têtes de l'email : elle ne contient aucune donnée personnelle (empreinte SHA-256).
4. **`List-Unsubscribe` personnalisé remplace celui de Brevo** : le bouton « Se désabonner » des messageries appelle notre opposition marketing, pas le blocage transactionnel Brevo (qui couperait aussi les guides).
5. **`{{ unsubscribe }}` du modèle newsletter** : syntaxe vérifiée (envoi de test d'une campagne QA, lien `…/mk/un/…`). Effet réel du clic : à vérifier par un envoi réel à la liste QA (bloqué sans validation, voir § 9).
6. **Brevo Free refuse l'option `tag` sur les campagnes** : `scripts/newsletter/campaign.ts` ne l'envoie plus (sauf `BREVO_CAMPAIGN_TAGS=true` sur une offre payante).
7. Désinscription via le lien Brevo d'un email transactionnel = blocage transactionnel (tous les emails, guides compris) : les modèles du moteur n'utilisent jamais `{{ unsubscribe }}`.

## 3. Moteur de séquences

```
Formulaire → /api/lead → Brevo (contact, liste) → réponse → page merci
                     └─ after() : 1. livraison transactionnelle (Vercel → Brevo)   ← ne dépend jamais de n8n
                                  2. inscription n8n (1er téléchargement seulement)
n8n « Althoce · Séquences (moteur) » : attend la date → POST /api/sequences/step
   Vercel relit Brevo (désinscrit ? qualifié ? email valide ?) → envoie ou saute → renvoie l'étape suivante
```

- **Configuration** : `config/sequences.ts` (étapes, catégorie `transactional` / `marketing`, délais, ancre inscription ou événement), `config/leadMagnets.ts` (séquence + automation historique par guide), `config/emailTemplates.ts` (modèles as code, `emails/sequences/`).
- **Identifiant d'inscription signé** (`lib/sequences/enrollment.ts`) : séquence, contact, dates — aucun état à stocker côté Vercel, infalsifiable par n8n.
- **Historique durable** : événements Brevo sur la fiche du contact (`guide_delivered`, `sequence_enrolled`, `sequence_step_sent`, `sequence_step_skipped`, `sequence_enroll_failed`) + exécutions n8n + clés d'idempotence Brevo.
- **Arrêt** : désinscrit / non éligible (`marketing_not_allowed`), `LIFECYCLE_STAGE` ∈ MEETING_BOOKED, OPPORTUNITY, CLIENT, LOST ou `TYPE_RDV` / `ETAT_RDV` renseigné (`commercial_cycle`), email INVALID/DISPOSABLE/BOUNCED, contact supprimé.
- **Re-téléchargement** : livraison renvoyée (sauf même jour : idempotence), **pas de nouvelle séquence** si le contact était déjà dans la liste du guide (couvre aussi les contacts engagés dans l'ancienne séquence Brevo).
- **n8n indisponible** : 3 tentatives, puis `sequence_enroll_failed` (avec l'`enrollment_id` pour rejouer). Le guide est déjà livré.
- **Brevo / Vercel indisponible pendant une étape** : n8n réessaie toutes les 30 min (24 h), sans risque de doublon.

### Variables (Vercel, jamais affichées ni commitées)

| Variable | Rôle |
| --- | --- |
| `ALTHOCE_SEQUENCE_GUIDES` | slugs basculés (vide = aucun) — **bascule explicite** ; `slug:qa` = actif seulement pour les adresses QA |
| `ALTHOCE_SEQUENCE_QA_EMAILS` | adresses de test du mode QA (jamais de vrais prospects) |
| `ALTHOCE_SEQUENCE_QA_TIME_SCALE` | mode QA : délais divisés (120 → relance J+2 après 24 min) |
| `ALTHOCE_SEQUENCES_PAUSED` | `true` = étapes reportées de 6 h (pause d'urgence), livraison maintenue |
| `N8N_SEQUENCE_WEBHOOK_URL` | URL de production du webhook n8n |
| `N8N_WEBHOOK_TOKEN` | Bearer Vercel → n8n (`openssl rand -hex 32`) |
| `SEQUENCE_API_SECRET` | Bearer n8n → Vercel (`openssl rand -hex 32`) |
| `SITE_URL` | domaine des liens (défaut : URL de branche en Preview, sinon Production) |
| `N8N_EVENTS_WEBHOOK_URL` | journal du scoring : `https://n8n.srv1242605.hstgr.cloud/webhook/althoce-marketing-events` (vide = scoring comportemental désactivé) |

Garde-fous de build : en Production, `ALTHOCE_SEQUENCE_GUIDES` non vide sans les trois variables n8n → build refusé ; `N8N_EVENTS_WEBHOOK_URL` sans `N8N_WEBHOOK_TOKEN` et `SEQUENCE_API_SECRET` → build refusé.

### Mise en place n8n (instance existante `n8n.srv1242605.hstgr.cloud`, rien d'existant modifié)

Workflows créés par API (inactifs, aucun secret ; sources générées par `n8n/build.py`, IDs non secrets dans `n8n/instance.json`, conventions de `règle du jeu - automatisation n8n.md`) :

| Workflow | ID | Rôle |
| --- | --- | --- |
| `ALTHOCE \| Marketing \| Séquences guides et webinars — v1` | `PLyOhSt5zreUoBKW` | webhook d'inscription → attente → `/api/sequences/step` → boucle |
| `ALTHOCE \| Marketing \| Alertes n8n — v1` | `XDp4BEtctA5ogbDg` | Error Workflow de tous les workflows ci-dessous → `/api/sequences/alert` → email à `espoir@contact.althoce.com` |
| `ALTHOCE \| Webinar \| Présences vers Brevo — v1` | `77IigBEDaaGro2Xa` | modèle manuel : présences / absences → `/api/sequences/event` (+15 au score) |
| `ALTHOCE \| Marketing \| Journal des événements — v1` | `XFDILN56cJw3XPuF` | webhook `althoce-marketing-events` : journal du scoring (Data table), voir § 7 |
| `ALTHOCE \| Marketing \| Recalcul des scores — v1` | `ZGbvCLVrJItTXqSS` | toutes les heures (h:17) : filet de sécurité du scoring → `/api/marketing/score` |
| `ALTHOCE \| Marketing \| Quota Brevo et RDV — v1` | `TN4d97jsaiCxvgVt` | toutes les heures (h:07) : quota d'envoi + RDV confirmés → `/api/marketing/maintenance` |

Data table `althoce_marketing_events` (`7IVWbyzYpzdvHA4W`, projet Personal) : `event_key` (texte), `contact_id` (nombre), `category` (texte), `points` (nombre), `occurred_at` (date), `source` (texte), `ref` (texte).

Boucle du moteur validée dans n8n le 10/10/2026 avec un faux point d'entrée Vercel ; journal et recalcul validés le même jour (§ 7). Workflows de test et lignes de test supprimés ensuite.

**À faire par vous (secrets : jamais dans le chat, jamais dans Git)** :
1. Générer deux jetons dans votre terminal : `openssl rand -hex 32` (deux fois).
2. n8n → Credentials → New → Header Auth :
   - `Althoce · Vercel → n8n (Bearer)` : Name `Authorization`, Value `Bearer <jeton 1>`
   - `Althoce · n8n → Vercel (Bearer)` : Name `Authorization`, Value `Bearer <jeton 2>`
3. Rattacher le credential 1 aux nœuds de réception : « Recevoir l'inscription (Vercel) », « Recevoir les événements (Vercel) ». Rattacher le credential 2 aux appels vers Vercel : « Exécuter l'étape (Vercel) », « Envoyer l'alerte (Vercel) », « Enregistrer l'événement Brevo (Vercel) », « Recalculer les scores (Vercel) », « Lancer les tâches (Vercel) ».
4. Vercel (Production) : `N8N_WEBHOOK_TOKEN` = jeton 1, `SEQUENCE_API_SECRET` = jeton 2, `N8N_SEQUENCE_WEBHOOK_URL` = `https://n8n.srv1242605.hstgr.cloud/webhook/althoce-sequences`, `N8N_EVENTS_WEBHOOK_URL` = `https://n8n.srv1242605.hstgr.cloud/webhook/althoce-marketing-events`. Copier aussi les deux jetons dans `althoce-ressources/.env` (non commité) pour les tests locaux.
5. Activer « Alertes n8n » en premier, puis les autres au moment voulu (§ 4 pour le moteur, § 7 pour le scoring).

## 4. Pilote : `12-cas-usage-experts-comptables`

- Automation historique **#4** « Guide Claude 12 cas d'usage comptable » : email #9 (livraison) + #8 (relance J+2), liste 10.
- Séquence `guide-12-cas-ec-v1` : modèles **#35** (livraison, copie fidèle de #9) et **#36** (relance J+2, copie de #8), expéditeur `bonjour@althoce.fr`, désinscription Althoce.

### Test réel en mode QA (Production, vrais prospects inchangés)

1. Déployer la branche en Production avec `ALTHOCE_SEQUENCE_GUIDES` **vide** (aucun changement de livraison).
2. Vercel (Production) : `ALTHOCE_SEQUENCE_GUIDES=12-cas-usage-experts-comptables:qa`, `ALTHOCE_SEQUENCE_QA_EMAILS=<adresses QA>`, `ALTHOCE_SEQUENCE_QA_TIME_SCALE=120`, + variables n8n → Redeploy.
3. Inscription depuis un navigateur normal avec une adresse QA : guide livré (modèle 35), `sequence_enrolled`, exécution n8n en attente ; relance J+2 reçue ~24 min plus tard ; puis désinscription d'une 2e adresse QA avant sa relance → aucune relance ; 2e inscription → aucun doublon. Les adresses QA ne sont pas ajoutées à la liste 10 : l'automation #4 ne leur envoie rien. Tous les autres prospects restent sur l'automation #4.

### Bascule (avec votre validation)

1. Retirer `:qa` et `ALTHOCE_SEQUENCE_QA_*` à l'étape 4 ci-dessous.
2. `npm run brevo:webhooks -- --url https://guide-gratuit-pi.vercel.app/api/webhooks/brevo --apply` (complète les 2 webhooks existants : désinscription, plainte, clics…, § 7).
3. Brevo → Automatisations → #4 : fermer l'entrée de nouveaux contacts **sans couper ceux en cours** (déclencheur « Ajouté à une liste » déplacé vers une liste vide « LM - 12 cas (ancien parcours fermé) »), puis immédiatement :
4. Vercel : `ALTHOCE_SEQUENCE_GUIDES=12-cas-usage-experts-comptables` → Redeploy (~1 min). Un doublon de livraison n'est possible que dans cette minute.
5. Contrôle 48 h : `guide_delivered` / `sequence_enrolled` sur les nouveaux leads, exécutions n8n en attente, relance J+2 reçue par un contact QA.

**Retour arrière** : retirer le slug de `ALTHOCE_SEQUENCE_GUIDES` (Redeploy) + remettre la liste 10 dans le déclencheur de #4. Pause immédiate des relances : désactiver le workflow n8n ou `ALTHOCE_SEQUENCES_PAUSED=true`.

### Tests

| Test | Où | Résultat |
| --- | --- | --- |
| Création du contact, liste, statut B2B, UTM, score | e2e 65, D | ✅ |
| Livraison immédiate (modèle 35, liens signés, One-Click) | unitaire + e2e S1 | ✅ |
| Confirmation d'adresse (bouton absent si déjà confirmée) | unitaire + e2e 54 | ✅ |
| Relance J+2 envoyée une fois, rejeu sans doublon | unitaire (horloge contrôlée) | ✅ |
| Désinscription avant la relance → aucune relance | unitaire + e2e E3, S4 | ✅ |
| 2e inscription du même contact : ni 2e email (même jour), ni 2e séquence | unitaire + e2e S1 | ✅ |
| Contact qualifié (RDV) / bounce → arrêt | unitaire | ✅ |
| n8n indisponible → livraison maintenue, échec tracé | unitaire | ✅ |
| Parcours réel Vercel ↔ n8n ↔ Brevo (mode QA, délais accélérés) | Production, adresses QA | ⏳ accès n8n + validation |

## 5. Migration des 8 autres guides (un par un, après validation du pilote)

Ordre par volume (envois des 90 derniers jours) : Skills Finance (#8, ~409), Pennylane (#2, ~393), data.gouv (#9, ~203), Droit (#7, ~153), Agents DAF (#10, ~147), 7 chantiers (#11, ~56), Copilot (#6, ~16), Meta Ads (#3, ~1).

Par guide :
1. Modèles : copier l'email de livraison et la relance de son automation (HTML sauvegardé dans `brevo-backups/2026-10-09/`) dans `emails/sequences/<guide>/`, remplacer le pied de page par `{{ params.UNSUBSCRIBE_URL }}` et le bouton de confirmation par `{{ params.CONFIRM_URL }}` ; à défaut, garder la séquence générique (`guide-generique-v1`, déjà configurée).
2. `config/emailTemplates.ts` + `config/sequences.ts` + `sequence:` dans `config/leadMagnets.ts` ; `npm run brevo:templates -- --apply` ; recopier les IDs.
3. `npm run check`, déploiement, puis bascule § 4 (étapes 3 à 5) avec l'automation du guide.
4. Une fois les 9 guides basculés et les anciennes séquences terminées : désactiver les automations historiques (validation).

## 6. Webinars

- Séquence `webinar-standard-v1` (même moteur, même workflow n8n) : confirmation (immédiate), rappels J-1 et H-1, replay (seulement si `replayUrl` est publié), suivi commercial (marketing, 72 h après). Ancre = date du webinar ; une inscription tardive saute les rappels dépassés.
- Confirmation et rappels = messages pratiques liés à l'inscription (envoyés même à un opposant) ; le suivi commercial respecte l'opposition.
- Modèles : `emails/sequences/webinar/*.html` (IDs `null` : créés par `npm run brevo:templates -- --apply` quand un webinar réel est planifié). Tant qu'ils n'existent pas, le parcours est inactif.
- Un webinar = un bloc dans `config/webinars.ts` avec `sequence: "webinar-standard-v1"`, une date **validée** et `status: "open"`. Aucun webinar n'est programmé.
- Présences / absences : `n8n/althoce-webinar-presences.json` (modèle à brancher sur la plateforme) → `/api/sequences/event` → événements `webinar_attended` / `webinar_no_show` ; une présence ajoute +15 au score (une fois par webinar).

## 7. Scoring comportemental (journal durable dans n8n)

### Chaîne

```
Brevo (webhooks marketing + transactionnels, TOUS les événements)
  → Vercel /api/webhooks/brevo   (point d'entrée unique, Bearer BREVO_WEBHOOK_SECRET)
       bounce → BOUNCED ; désinscription / plainte spam → OPPOSED ; ouverture, délivré… → reçus, 0 point
       clic → catégorie (config/scoring.ts) + clé unique (HMAC, sans email) + points du barème
  → n8n « Journal des événements » (Data table althoce_marketing_events)
       insère si la clé est nouvelle, renvoie l'historique complet du contact
  → Vercel recalcule depuis l'historique et écrit Brevo (jamais à la baisse)
  → alerte « lead chaud » à espoir@contact.althoce.com, une seule fois
Toutes les heures : n8n « Recalcul des scores » renvoie l'historique des contacts actifs (3 h ; la nuit, 8 jours) → rattrapage
Toutes les heures : n8n « Quota Brevo et RDV » → quota d'envoi + RDV confirmés (+25)
```

Les règles (barème, classification, calcul) vivent dans le code Vercel testé (`config/scoring.ts`, `lib/scoring/behavior.ts`) ; n8n stocke et planifie. Aucune donnée personnelle dans n8n : ID contact Brevo, catégorie, points, date, clé opaque.

### Barème appliqué

| Événement | Points | Clé (compté une fois par…) |
| --- | ---: | --- |
| Formulaire | 0 à 15 | `FORM_SCORE` (meilleur score formulaire) |
| Email ouvert | 0 | — (non fiable : Apple Mail, antivirus) |
| Clic contenu (newsletter, post, article) | +3 | email × catégorie |
| Clic guide (page Notion, page `/r/…`) | +5 | email × catégorie |
| Clic offre (prise de RDV cal.com) | +10 | email × catégorie |
| Inscription webinar | +8 | webinar × contact |
| Participation webinar | +15 | webinar × contact |
| RDV confirmé (`ETAT_RDV` = Prévu, `STATUT_APPEL` = RDV planifié / RDV booke, `LIFECYCLE_STAGE` = MEETING_BOOKED) | +25 | contact |

Jamais comptés : liens de désinscription, de confirmation d'adresse, `mailto:`, emails internes (tags `alerte-*`).
`LEAD_SCORE = max(LEAD_SCORE actuel, min(100, FORM_SCORE + BEHAVIOR_SCORE))`. Un contact antérieur au scoring garde son score : son score formulaire est figé à `min(LEAD_SCORE, 15)` au premier calcul. Seuil HOT : 25 → `LIFECYCLE_STAGE = HOT_LEAD` (jamais au-delà d'une étape commerciale).

### Anti-doublons (testé en réel)

- Même clic rejoué par Brevo, deux clics sur le même lien ou deux articles d'un même email : **même clé** → compté une fois.
- La Data table n8n n'a pas de contrainte d'unicité : sous 5 envois simultanés de la même clé, elle a stocké jusqu'à 5 lignes. Le calcul ignore les doublons de clé : score juste (18, pas 30). C'est pourquoi le calcul repart **toujours** de l'historique complet.
- n8n arrêté → Vercel répond 429 à Brevo, qui rejoue plus tard : aucun événement perdu, aucun double comptage au rejeu.
- Écriture Brevo refusée → l'événement est déjà journalisé : la passe horaire rattrape.

### Alerte « lead chaud »

Une seule fois par contact (`HOT_ALERT_SENT_AT` + clé d'idempotence Brevo), seulement avant toute prise en charge commerciale (étape SUBSCRIBER, LEAD, MQL ou HOT_LEAD, aucun RDV, pas « Ne plus appeler », email utilisable). Contenu : nom, entreprise, téléphone, ressource, score (formulaire + comportement), 10 derniers signaux, lien vers la fiche Brevo. Aucun contact n'a aujourd'hui un score ≥ 25 : pas de vague d'alertes au démarrage.

### Quota Brevo

`/api/marketing/maintenance` lit les crédits d'envoi restants du jour (`GET /account`, offre Free : 300/jour, 237 restants au relevé du 10/10). Sous 60 restants : un email d'alerte, une fois par jour. Au-delà du quota, Brevo refuse les envois : livraisons et relances sont réessayées par n8n (30 min × 48).

### Attributs Brevo (créés par `npm run brevo:attributes -- --apply`, avec validation)

`FORM_SCORE` (nombre), `BEHAVIOR_SCORE` (nombre, ne baisse jamais), `LAST_EMAIL_CLICK_AT`, `LAST_ENGAGEMENT_AT`, `SCORE_UPDATED_AT`, `HOT_ALERT_SENT_AT` (dates). Le segment `LEADS — HOT` (id 6, `LEAD_SCORE ≥ 25`) reste inchangé et intègre désormais le comportement.

### Tests

| Test | Où | Résultat |
| --- | --- | --- |
| Barème, classification des liens, clés sans email, agrégat sans doublon, jamais de baisse, plafond, alerte unique | unitaire (`tests/behavior-scoring.test.ts`, 11 tests) | ✅ |
| Clic RDV → +10 ; rejeu → rien ; clic guide → lead chaud + alerte unique ; clic newsletter +3 sans 2e alerte | e2e SC1 | ✅ |
| n8n arrêté → 429, rien écrit ; rejeu → compté une fois | e2e SC2 | ✅ |
| Liens de désinscription / confirmation / mailto ignorés ; plainte spam → opposition | e2e SC3 | ✅ |
| Passe horaire : secret exigé, idempotente, score manuel conservé, étape commerciale intouchée | e2e SC4 | ✅ |
| Quota bas → alerte unique ; RDV → +25 une fois, sans alerte | e2e SC5 | ✅ |
| Présence webinar → +15 une fois | e2e SC6 | ✅ |
| **Journal réel n8n** : insertion, rejeu ignoré, doublon de lot, lot invalide → 400, 5 envois simultanés, panne interne jamais vue comme un succès, passe horaire | instance n8n, 10/10/2026 (11/11) | ✅ |
| Chaîne réelle Brevo → Vercel → n8n → Brevo | Production, après credentials et validation | ⏳ |

### Mise en service (avec votre validation)

1. Credentials n8n et variables Vercel (§ 3), dont `N8N_EVENTS_WEBHOOK_URL`.
2. `npm run brevo:attributes` (à blanc) puis `-- --apply` : création des 6 attributs.
3. Déploiement de la branche.
4. Activer « Journal des événements », « Recalcul des scores », « Quota Brevo et RDV ».
5. `npm run brevo:webhooks -- --url https://guide-gratuit-pi.vercel.app/api/webhooks/brevo` (à blanc) puis `--apply` : complète les deux webhooks existants (#2241079 marketing, #2241080 transactionnel) avec tous les événements, sans en créer de nouveaux.
6. Test réel avec une adresse QA : clic dans un email → ligne dans la Data table, `BEHAVIOR_SCORE` sur la fiche.

**Retour arrière** : vider `N8N_EVENTS_WEBHOOK_URL` (Redeploy) → plus aucun scoring comportemental ; les scores déjà écrits restent.

## 8. Coûts et limites réelles

| Brique | Coût | Limite qui compte |
| --- | --- | --- |
| Brevo Free | 0 € | **300 emails / jour, tous types confondus** (livraisons, relances, newsletters). Volume actuel ≈ 40 emails/jour (≈ 20 livraisons + ≈ 20 relances). |
| n8n (instance existante) | 0 € de plus | 1 exécution par inscription (en attente jusqu'à la relance). Auto-hébergé : sans limite ; n8n Cloud : quota d'exécutions mensuel de l'offre. |
| Vercel (projet existant) | 0 € | Fonctions largement suffisantes, y compris ≈ 1 appel par événement email (≈ 500/jour au plafond de 300 emails). ⚠️ L'offre Hobby est réservée à un usage non commercial selon les conditions Vercel : à vérifier pour Althoce. |
| n8n Data table | 0 € | 50 Mo par défaut pour toutes les tables de l'instance ; ≈ 200 octets par événement scoré (clics, webinars, RDV seulement) → des années au volume actuel. |
| Appels API Brevo du scoring | 0 € | 1 lecture + 1 écriture par contact actif et par heure au plus (aucune écriture si rien ne change). |

**Limite majeure : la newsletter.** Avec 300 emails/jour, une newsletter ne peut pas dépasser ≈ 250 destinataires par jour une fois les livraisons servies. Deux newsletters par semaine vers les segments FINANCE (838 experts-comptables, 132 DAF une fois le backfill fait) imposent soit d'envoyer par lots sur plusieurs jours, soit une offre Brevo payante (sans limite quotidienne). Le moteur sort de la limite des 2 000 contacts des automations, **pas** de celle des 300 emails/jour.

## 9. Reste à valider ou à faire

- Credentials n8n (2 Header Auth) et variables Vercel Production (§ 3) : à faire par vous, secrets hors chat.
- Fusion de la PR, puis mode QA du pilote (§ 4) → test réel avec des contacts QA, puis bascule.
- Scoring (§ 7) : création des 6 attributs Brevo, activation des 3 workflows, mise à jour des 2 webhooks Brevo, test QA réel.
- À valider : « RDV confirmé » = `ETAT_RDV` Prévu / `STATUT_APPEL` RDV planifié ou RDV booke ; pages d'offre althoce.com à ajouter à `OFFER_URL_PREFIXES` (aujourd'hui : prise de RDV cal.com seulement).
- Segments Brevo 7, 8, 9 : remplacer `OPT_IN = Vrai` par `MARKETING_STATUS est égal à CONSENT, B2B_ELIGIBLE` (même conditions sinon), vérifier les effectifs, puis `MARKETING_SEGMENTS_REVIEWED=true`.
- Backfill du statut marketing des contacts historiques (à blanc puis `--apply`) : décision juridique sur les 1 772 contacts sans statut (`TO_REVIEW` par défaut).
- Effet réel du lien de désinscription newsletter : envoyer la campagne QA #39 à la liste QA #18 (1 contact).
- Contact QA `espoir+qa-optout@contact.althoce.com` (#1802, dans l'automation #4) : vérifier le 12/10 si la relance J+2 lui a été envoyée, puis le supprimer.
- Instance n8n en 2.1.5 (39 versions de retard) : mise à jour à planifier (sauvegarde avant) ; 2 webhooks non protégés existent sur des workflows qui ne sont pas les nôtres (signalé, non modifié).
