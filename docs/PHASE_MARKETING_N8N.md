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

Garde-fou de build : en Production, `ALTHOCE_SEQUENCE_GUIDES` non vide sans les trois variables n8n → build refusé.

### Mise en place n8n (instance existante `n8n.srv1242605.hstgr.cloud`, rien d'existant modifié)

Workflows créés par API (inactifs, aucun secret ; sources dans `n8n/`, conventions de `règle du jeu - automatisation n8n.md`) :

| Workflow | Rôle |
| --- | --- |
| `Marketing — Séquences guides et webinars (moteur) — v1` (`PLyOhSt5zreUoBKW`) | webhook d'inscription → attente → `/api/sequences/step` → boucle ; Error Workflow = alertes |
| `Marketing — Alertes séquences — v1` (`XDp4BEtctA5ogbDg`) | Error Trigger → `/api/sequences/alert` → email à `espoir@contact.althoce.com` (la clé Brevo reste sur Vercel) |
| `Webinar — Présences vers Brevo — v1` (`77IigBEDaaGro2Xa`) | modèle manuel : présences / absences → `/api/sequences/event` |

Boucle validée dans n8n le 10/10/2026 avec un faux point d'entrée Vercel : exécution réussie, 2 attentes, 2 appels, décisions « attendre » puis « terminé » (workflows de test supprimés ensuite).

**À faire par vous (secrets : jamais dans le chat, jamais dans Git)** :
1. Générer deux jetons dans votre terminal : `openssl rand -hex 32` (deux fois).
2. n8n → Credentials → New → Header Auth :
   - `Althoce · Vercel → n8n (Bearer)` : Name `Authorization`, Value `Bearer <jeton 1>`
   - `Althoce · n8n → Vercel (Bearer)` : Name `Authorization`, Value `Bearer <jeton 2>`
3. Rattacher : « Recevoir l'inscription (Vercel) » → credential 1 ; « Exécuter l'étape (Vercel) », « Envoyer l'alerte (Vercel) », « Enregistrer l'événement Brevo (Vercel) » → credential 2.
4. Vercel (Production, au moment du test QA) : `N8N_WEBHOOK_TOKEN` = jeton 1, `SEQUENCE_API_SECRET` = jeton 2, `N8N_SEQUENCE_WEBHOOK_URL` = `https://n8n.srv1242605.hstgr.cloud/webhook/althoce-sequences`. Copier aussi les deux jetons dans `althoce-ressources/.env` (non commité) pour les tests locaux.
5. Activer « Marketing — Séquences… » et « Marketing — Alertes séquences » seulement au test QA (§ 4).

## 4. Pilote : `12-cas-usage-experts-comptables`

- Automation historique **#4** « Guide Claude 12 cas d'usage comptable » : email #9 (livraison) + #8 (relance J+2), liste 10.
- Séquence `guide-12-cas-ec-v1` : modèles **#35** (livraison, copie fidèle de #9) et **#36** (relance J+2, copie de #8), expéditeur `bonjour@althoce.fr`, désinscription Althoce.

### Test réel en mode QA (Production, vrais prospects inchangés)

1. Déployer la branche en Production avec `ALTHOCE_SEQUENCE_GUIDES` **vide** (aucun changement de livraison).
2. Vercel (Production) : `ALTHOCE_SEQUENCE_GUIDES=12-cas-usage-experts-comptables:qa`, `ALTHOCE_SEQUENCE_QA_EMAILS=<adresses QA>`, `ALTHOCE_SEQUENCE_QA_TIME_SCALE=120`, + variables n8n → Redeploy.
3. Inscription depuis un navigateur normal avec une adresse QA : guide livré (modèle 35), `sequence_enrolled`, exécution n8n en attente ; relance J+2 reçue ~24 min plus tard ; puis désinscription d'une 2e adresse QA avant sa relance → aucune relance ; 2e inscription → aucun doublon. Les adresses QA ne sont pas ajoutées à la liste 10 : l'automation #4 ne leur envoie rien. Tous les autres prospects restent sur l'automation #4.

### Bascule (avec votre validation)

1. Retirer `:qa` et `ALTHOCE_SEQUENCE_QA_*` à l'étape 4 ci-dessous.
2. `npm run brevo:webhooks -- --url https://guide-gratuit-pi.vercel.app/api/webhooks/brevo --apply` (ajoute `unsubscribed`).
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
- Présences / absences : `n8n/althoce-webinar-presences.json` (modèle à brancher sur la plateforme) → `/api/sequences/event` → événements `webinar_attended` / `webinar_no_show`.

## 7. Scoring et enrichissement (points d'extension)

- `/api/sequences/event` (Bearer `SEQUENCE_API_SECRET`) enregistre un événement de la liste blanche (webinar, replay, pages commerciales) sur la fiche Brevo. Aucun score modifié tant que `EVENT_SCORING_ENABLED` est faux.
- Détection des leads chauds : segment Brevo `LEADS — HOT` (id 6), inchangé. Enrichissement LinkedIn : non branché (aucun service payant).

## 8. Coûts et limites réelles

| Brique | Coût | Limite qui compte |
| --- | --- | --- |
| Brevo Free | 0 € | **300 emails / jour, tous types confondus** (livraisons, relances, newsletters). Volume actuel ≈ 40 emails/jour (≈ 20 livraisons + ≈ 20 relances). |
| n8n (instance existante) | 0 € de plus | 1 exécution par inscription (en attente jusqu'à la relance). Auto-hébergé : sans limite ; n8n Cloud : quota d'exécutions mensuel de l'offre. |
| Vercel (projet existant) | 0 € | Fonctions largement suffisantes. ⚠️ L'offre Hobby est réservée à un usage non commercial selon les conditions Vercel : à vérifier pour Althoce. |

**Limite majeure : la newsletter.** Avec 300 emails/jour, une newsletter ne peut pas dépasser ≈ 250 destinataires par jour une fois les livraisons servies. Deux newsletters par semaine vers les segments FINANCE (838 experts-comptables, 132 DAF une fois le backfill fait) imposent soit d'envoyer par lots sur plusieurs jours, soit une offre Brevo payante (sans limite quotidienne). Le moteur sort de la limite des 2 000 contacts des automations, **pas** de celle des 300 emails/jour.

## 9. Reste à valider ou à faire

- Accès n8n : importer le workflow, créer les deux credentials, fournir l'URL du webhook (dans Vercel).
- Variables Production (après fusion) : `N8N_SEQUENCE_WEBHOOK_URL`, `N8N_WEBHOOK_TOKEN`, `SEQUENCE_API_SECRET`, puis mode QA du pilote (§ 4) → test réel avec des contacts QA.
- Segments Brevo 7, 8, 9 : remplacer `OPT_IN = Vrai` par `MARKETING_STATUS est égal à CONSENT, B2B_ELIGIBLE` (même conditions sinon), vérifier les effectifs, puis `MARKETING_SEGMENTS_REVIEWED=true`.
- Backfill du statut marketing des contacts historiques (à blanc puis `--apply`) : décision juridique sur les 1 772 contacts sans statut (`TO_REVIEW` par défaut).
- Effet réel du lien de désinscription newsletter : envoyer la campagne QA #39 à la liste QA #18 (1 contact).
- Mise en Production (fusion de la PR) puis bascule du pilote (§ 4).
- Contact QA `espoir+qa-optout@contact.althoce.com` (#1802, dans l'automation #4) : vérifier le 12/10 si la relance J+2 lui a été envoyée, puis le supprimer.
