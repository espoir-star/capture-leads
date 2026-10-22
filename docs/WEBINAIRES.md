# Webinaires Althoce : exploitation

Version du 20 octobre 2026. Ce document remplace la procédure du 15 octobre.

Le système réutilise la capture, Brevo (transactionnel), le moteur de séquences, n8n, le scoring et le CRM. **Aucune automation Brevo n'est créée par webinaire.**

> Système techniquement prêt ≠ webinaire ouvert. Un webinaire n'existe qu'une fois son bloc ajouté dans `config/webinars.ts` et ses deux variables Vercel renseignées. Aucune date n'est inventée.

## 1. Parcours

```
Post LinkedIn (/l/<code>) · annonce LinkedIn/Meta (URL suivie)   → UTM + first touch
Page /w/<slug> : formulaire court (prénom, nom, email, entreprise facultative), Turnstile
   → Brevo : contact + liste « WB - … » + WEBINAR_ACTIVITY (suivi CRM), +8 au score
   → #45 confirmation (lien personnel, Google Agenda, .ics) ─ email de service
   → n8n attend → Vercel décide : #46 J-1 · #47 H-1 ─ emails de service
Lien personnel /w/<slug>/rejoindre → salle Google Meet (lue côté serveur)
   → « lien de connexion ouvert » noté (signal, AUCUN point)
Après le direct : présences confirmées (rapport de sondage/Q&R) → +15, WEBINAR_ATTENDED
   → #48 replay dès sa publication (attente jusqu'à J+3, puis reprise contrôlée)
   → #49 suivi J+3 (marketing) adapté : présent / non certifié / projet déclaré
CRM : fiche enrichie (webinar, date, participation, replay, provenance)
```

Format : 60 minutes, soit environ 45 minutes de présentation et 15 minutes de questions-réponses (`durationMin: 60`).

## 2. Règles du parcours

| Situation | Comportement |
|---|---|
| **Formulaire** | Prénom, nom et email obligatoires ; entreprise facultative. Pas de téléphone, de besoin ni d'horizon. Des valeurs envoyées malgré tout sont ignorées par le serveur. Le formulaire des guides est inchangé. |
| **Projet déjà déclaré** | Jamais modifié par une inscription (`BESOIN_PRIORITAIRE`, `HORIZON_PROJET`, `INTENT_UPDATED_AT` intacts). Aucun projet n'est fabriqué. |
| **Consentement** | Une inscription ne crée jamais `CONSENT`. Le statut marketing suit la règle des captures métier : mention et opposition proposées sur le formulaire, opposition définitive. Confirmation, rappels et replay sont des **emails de service**, envoyés même en cas d'opposition marketing. Le suivi J+3 est **marketing** : il est bloqué pour les opposés et pour les contacts déjà pris en charge. |
| **Inscription tardive** | Un rappel dont le moment est passé à l'inscription n'est pas envoyé : inscrit la veille au soir, pas de « C'est demain » ; inscrit 30 minutes avant, ni J-1 ni H-1. |
| **Rappel en retard** (n8n arrêté) | J-1 abandonné au-delà de la veille au soir (12 h après son heure), H-1 au-delà de 30 minutes avant le début. Jamais après le début. |
| **Double inscription** | Un seul contact. Une seule confirmation par jour (clé d'envoi Brevo). Une seule séquence de rappels (déjà dans la liste = pas de nouvelle séquence). |
| **Erreur temporaire Brevo** | L'étape renvoie une erreur 5xx ; n8n réessaie toutes les 30 minutes pendant 24 heures. Clé d'idempotence Brevo + journal : aucun doublon. |
| **Reprise n8n** | Les attentes sont persistées par n8n ; une étape exécutée en retard suit les règles ci-dessus. |
| **Fuseau** | Dates ISO avec fuseau dans la configuration ; tous les emails et pages affichent l'heure de Paris, en toutes lettres (changement d'heure géré par `Intl`). |
| **Désinscription** | Le lien « Ne plus recevoir nos conseils » coupe le marketing, pas les emails de service du webinaire demandé. Un désabonnement survenu pendant l'attente est relu au moment de chaque envoi. |
| **Après le direct** | Inscriptions closes (la page l'annonce ; le serveur répond 410). |

## 3. Sécurité de la salle et des liens

- **Le dépôt GitHub est public** : aucune adresse Meet ni aucun enregistrement dans le code. Ils vivent dans les variables Vercel (Production), lues côté serveur :
  - `WEBINAR_JOIN_URL__<SLUG>` : salle Meet (adresse `meet.google.com` donnée par Google Agenda) ;
  - `WEBINAR_REPLAY_URL__<SLUG>` : fichier Drive (`…/file/d/…/view`) ou vidéo YouTube non répertoriée.
  
  `<SLUG>` : majuscules, tirets remplacés par `_`. Une valeur au mauvais format est ignorée.
- **Jamais sur une page publique**, dans les métadonnées, le `.ics`, Google Agenda, les UTM ou les URL de partage. Les emails ne contiennent que des liens personnels `/w/<slug>/rejoindre?t=…` et `/w/<slug>/replay?t=…`.
- **Jeton** : chiffré (AES-256-GCM), lié au contact, au webinaire et à l'usage. Un jeton de connexion n'ouvre pas le replay. Un jeton altéré mène à « lien invalide ».
- **Fenêtre** : la salle s'ouvre 15 minutes avant le début et se ferme 30 minutes après la fin. Avant : page « pas encore commencé » avec Google Agenda. Après : replay s'il est publié, sinon « terminé ».
- **Scanners de messagerie** : requêtes `HEAD` (réponse 204, sans redirection) et robots identifiés. Rien n'est noté. Le H-1 part 45 minutes avant l'ouverture de la fenêtre.
- **Lien transféré** : il ouvre la salle à son destinataire. Le signal « lien ouvert » est rattaché à l'inscrit d'origine, et c'est pour cette raison qu'il ne vaut jamais présence. La salle reste protégée par l'admission Meet (voir § 9).
- **Contrôle** : `npm run webinar:check -- --slug <slug>` interroge `/api/webinar/status`. Cette route est protégée par `SEQUENCE_API_SECRET` et ne renvoie jamais d'adresse.

## 4. Participation : cinq états distincts

| État | Source | Score | CRM |
|---|---|---|---|
| Inscrit | formulaire | +8 (`webinar_registered`) | activité qualifiante `WEBINAR_REGISTERED` |
| Lien de connexion ouvert | clic sur le lien personnel pendant la fenêtre | **0** | « présence non certifiée » |
| Présence confirmée | rapport de sondage ou de Q&R, constat de l'organisateur | +15 une fois (`webinar_attended`) | activité qualifiante `WEBINAR_ATTENDED`, avec sa preuve |
| Replay consulté | clic sur le lien personnel de replay | 0 | date de consultation, distincte du direct |
| Présence inconnue | aucun signal suffisant | — | aucune absence conclue |

Avant le 20/10/2026, un clic sur le lien de connexion donnait +15. Aucun webinaire réel n'ayant eu lieu, aucun événement historique n'est concerné. Rien n'a été effacé ni recalculé.

### Confirmer les présences (procédure)

Google Workspace **Business Standard n'a pas de rapport de présence** : il est réservé à Business Plus et aux éditions supérieures. En revanche, le **modérateur reçoit par email, après la réunion**, le rapport des **sondages** (nom et réponse de chaque participant, si le sondage n'est pas anonyme) et celui des **questions-réponses** (noms des auteurs).

1. Pendant le direct, lancez un sondage **non anonyme** au début, par exemple « Quel est votre métier ? ». Relancez-en un à la fin.
2. Après le direct, copiez dans un fichier les noms du rapport de sondage, une personne par ligne. Ajoutez ceux du rapport de Q&R et les personnes que vous avez vues, avec leur email si vous l'avez.
3. Lancez la simulation :
   ```bash
   npm run webinar:presences -- --slug <slug> --file presences.txt --proof poll
   ```
   Les noms sont rapprochés des **inscrits** : seule une correspondance unique est retenue, les homonymes et les inconnus sont signalés. Un non-inscrit n'est jamais créé.
4. Après relecture, relancez la même commande avec `--apply`. La commande est idempotente : la relancer ne rajoute aucun point.

Alternative : le workflow n8n « Présences » (`POST /api/sequences/event`, `webinar_attended`, `properties: { webinar: <slug>, proof }`).

## 5. Replay

1. **Enregistrement** : il se lance à la main en Business Standard et se range dans le Drive de l'organisateur, dossier « Meet Recordings ».
2. **Permissions** : vérifiez le contenu, puis partagez le fichier en « Tous les utilisateurs disposant du lien », en lecture. Désactivez le téléchargement si besoin. Ne partagez jamais par défaut, et jamais avant d'avoir relu.
3. **Publication** : ajoutez `WEBINAR_REPLAY_URL__<SLUG>` dans Vercel (Production), puis redéployez. `npm run webinar:check` confirme que l'enregistrement s'ouvre sans compte Google.
4. **Envoi** : l'email #48 part à J+20 h s'il est publié. Sinon, le moteur réessaie toutes les 3 heures jusqu'au suivi J+3. Rien n'est perdu.
5. **Publication après J+3** :
   ```bash
   npm run webinar:replay -- --slug <slug>
   ```
   Lancez d'abord la simulation, puis la même commande avec `--apply`. La commande refuse d'envoyer si le replay n'est pas lisible sans compte. Elle utilise la même clé que la séquence : personne ne le reçoit deux fois.

L'email de replay dit « Merci de votre participation » **uniquement** si la présence est confirmée ; sinon, il annonce simplement le replay. Il ajoute les ressources annoncées (`resources` dans la configuration, liens publics uniquement).

## 6. CRM

- **Attribut** : `WEBINAR_ACTIVITY` (JSON, dernier webinaire). Il contient le titre, la date, l'inscription et sa provenance (UTM), le lien ouvert, la présence (`UNKNOWN` ou `CONFIRMED` avec sa preuve) et le replay. Écrit au mieux : une erreur Brevo ne bloque ni l'inscription ni l'accès.
- **Fiche CRM** (« Contexte Brevo ») : lignes Webinar, Participation et Inscription au webinar.
- **Admission inchangée** (contrat CRM) :
  - une inscription seule n'est jamais une opportunité ;
  - un projet déclaré est admis quel que soit le score (P1 si court terme) ;
  - sans projet, il faut un score de 25 ou plus et une activité qualifiante datée de moins de 30 jours ;
  - un dossier déjà contacté, avec RDV ou client reste dans son suivi existant : aucune nouvelle tâche, et le suivi J+3 est suspendu.

## 7. Relances après le direct

| Profil | #48 replay | #49 suivi J+3 (marketing) |
|---|---|---|
| Présence confirmée | « Merci de votre participation » + ressources | « Merci d'avoir participé » + proposition d'échange |
| Inscrit sans preuve de présence | Replay et ressources, sans « vous avez manqué » | « Suite au webinar… » |
| Projet à court terme déclaré | — | « Parlons de votre projet » + « Échanger sur mon projet » |
| Déjà pris en charge (RDV, opportunité, client) | Envoyé (service) | **Bloqué** (cycle commercial) |
| Opposé au marketing | Envoyé (service) | **Bloqué** |

## 8. Créer un webinaire : une seule demande de configuration

Informations à réunir **en une fois** ; ne rien inventer :

1. Titre, description (une phrase), public visé, programme (3 à 5 points), intervenant ou intervenante (nom, rôle).
2. Date et heure (heure de Paris) ; durée (60 minutes par défaut).
3. Organisateur Google (compte Althoce) et URL de la salle Meet créée dans Google Agenda.
4. Liste Brevo « WB - <titre> » créée, avec son ID réel.
5. Ressources annoncées (liens publics), le cas échéant.
6. Diffusion : date du post LinkedIn (code court `/l/…`) et annonces éventuelles (`npm run utm -- --webinar <slug> --ads meta|linkedin`).

Mise en place :

1. Ajoutez le bloc dans `config/webinars.ts`, avec `status: "open"` et `sequence: "webinar-standard-v1"`. N'y mettez **aucune URL Meet**.
2. Dans Vercel (Production), créez `WEBINAR_JOIN_URL__<SLUG>`.
3. Lancez `npm run check`, poussez, puis vérifiez la Preview : page, confirmation, `.ics`.
4. Fusionnez, puis lancez `npm run webinar:check -- --slug <slug>` jusqu'au **GO technique**.
5. Faites un test d'inscription avec une adresse QA : confirmation reçue, lien personnel fonctionnel 15 minutes avant.

La démonstration `/w/demonstration-webinar` n'existe que hors Production, avec le formulaire fermé.

## 9. Google Workspace Business Standard : réglages à vérifier

**Capacités :**
- 150 participants ;
- réunions de 24 heures au maximum ;
- enregistrement dans Drive ;
- sondages et questions-réponses, avec rapports envoyés au modérateur ;
- **pas** de rapport de présence (réservé à Business Plus).

**Console d'administration** (Applications > Google Workspace > Google Meet), relue le 22/10/2026 :
- **Enregistrement** autorisé ; **autorisation explicite des participants exigée** avant tout enregistrement (activée le 22/10/2026 avec l'accord d'Espoir).
- **Sondages** et **questions-réponses** activés.
- **Domaine** : tous les utilisateurs, même sans compte Google. **Type d'accès « Approuvé »** : les externes demandent à entrer, un lien transféré ne suffit pas.
- **Téléphone** : accès par téléphone ouvert aux externes (secours).
- Restent volontairement inchangés au niveau de l'organisation : la gestion par l'organisateur (désactivée par défaut), la prise de notes Gemini automatique (réunions d'au moins 3 invités) et le téléchargement des enregistrements. Ils se règlent **par événement** ci-dessous, sans toucher aux rendez-vous commerciaux.

**Dans l'événement Agenda du webinaire** (Options de l'organisateur) :
- **Gestion par l'organisateur** activée ; partage d'écran réservé aux organisateurs ; chat et Q&R ouverts ;
- **co-organisateur** Althoce ajouté (admission des participants, modération) ;
- **prise de notes Gemini désactivée** pour l'événement : elle capterait les noms et questions de prospects externes ;
- **enregistrement** prévu ; les participants donnent leur accord au lancement (réglage de la console).

Les participants sont informés de l'enregistrement sur la page d'inscription, la page de confirmation et l'email de confirmation.

## 10. Checklist organisateur

**J-7**
- [ ] `npm run webinar:check` : GO technique.
- [ ] Inscription de test avec une adresse QA.
- [ ] Sondages préparés dans l'événement.

**J-1**
- [ ] Rappels J-1 partis (journal Brevo, tag `seq:webinar-standard-v1:rappel-j-1`).
- [ ] Support prêt, ressources publiées.

**H-30 min**
- [ ] Ouvrir la salle depuis le compte organisateur.
- [ ] Tester micro, caméra, son et partage d'écran (onglet ou fenêtre, pas l'écran entier).
- [ ] Co-animateur connecté, rôle de co-organisateur confirmé.

**Ouverture**
- [ ] Lancer l'**enregistrement**.
- [ ] Sondage de bienvenue **non anonyme** (preuve de présence).
- [ ] Rappeler la règle des questions (Q&R).

**Pendant**
- [ ] Le co-animateur admet les participants qui attendent.
- [ ] Il modère le chat et les questions, et met en sourdine si besoin.
- [ ] Réserver 15 minutes aux questions-réponses.

**Panne**
- **Organisateur déconnecté** : le co-organisateur garde la salle et relance l'enregistrement.
- **Partage impossible** : envoyer le support dans le chat.
- **Salle inutilisable** : créer une salle de secours, mettre à jour `WEBINAR_JOIN_URL__<SLUG>` et redéployer. Les liens personnels pointent alors vers la nouvelle salle sans renvoyer d'email.

**Fin**
- [ ] Sondage de clôture.
- [ ] Arrêter l'enregistrement.

**Après**
- [ ] Rapports de sondage et de Q&R, puis `webinar:presences`.
- [ ] Vérifier le replay, le partager en lecture **avec le téléchargement désactivé** (partage du fichier Drive), publier la variable Vercel, puis `webinar:check`.
- [ ] Après J+3 : `webinar:replay` si besoin.
- [ ] Passer `status: "done"`.

## 11. Commandes

| Commande | Rôle | Écrit ? |
|---|---|---|
| `npm run webinar:check -- --slug <slug>` | Contrôle de préparation, GO / NO-GO | Non |
| `npm run webinar:presences -- --slug <slug> --file <f> --proof poll\|qa\|manual` | Présences confirmées | Avec `--apply` |
| `npm run webinar:replay -- --slug <slug>` | Reprise du replay publié après J+3 | Avec `--apply` |
| `npm run brevo:attributes` | Crée `WEBINAR_ACTIVITY` s'il manque | Avec `--apply` |
| `npm run brevo:templates` | Compare et publie les modèles #45 à #49 | Avec `--apply` |
