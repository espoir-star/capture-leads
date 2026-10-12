# Contrat Brevo ↔ CRM Althoce — V1

Version contractuelle **1.1 — 12 octobre 2026**. Fichier identique dans le CRM (`docs/integrations/brevo-crm-v1.md`) et les guides (`docs/INTEGRATION_CRM.md`).

Le contrat décrit le fonctionnement attendu du code ; il ne prouve pas son activation. Voir le rapport `brevo-crm-finalisation-2026-10-12.md` côté CRM pour les versions, contrôles et limites observées. Au début de l’audit du 12 octobre, la production CRM n’avait ni migration 0074, ni clé serveur Brevo, ni timer Brevo ; aucun checkpoint n'a été supprimé ou réinitialisé. Les cinq contacts Brevo #1833–1837 sont absents du CRM au rapprochement en lecture seule. Aucun import historique n'est relancé.

## 1. Inventaire et frontière

- CRM existant : Django 5.2, templates serveur, PostgreSQL 17 en production. Source `outputs/althoce-crm`, VPS `/opt/althoce-crm`, Docker Compose, `crm.althoce.fr` via Cloudflare Tunnel.
- Modèles réutilisés : `Organization`, `Contact`, `Dossier`, `Task`, `Appointment`, `Audit`, `NurturingOptOut`. Identités locales : email normalisé exact et téléphone normalisé par `phonenumbers`. Le téléphone n'est **pas** une clé d'identité Brevo.
- Pipeline réel : `qualify`, `discovery`, `scope`, `draft`, `sent`, `signature`, `won`, `lost`. Qualification indépendante : `new`, `contacting`, `unreachable`, `callback`, `qualified`, `unqualified`.
- Rôles existants : administrateur, team lead, commercial, prospecteur, développeur, formateur. MFA obligatoire. Les deux derniers n'accèdent pas au contexte marketing/commercial Brevo.
- Jobs existants : commandes Django exécutées par services/timers systemd. Le connecteur HTTP générique `IntakeChannel` n'est pas un adaptateur Brevo et n'est pas utilisé ici.
- Ancienne base : retrait déjà effectué de 1 095 dossiers encore en prospection, avec conservation des dossiers commerciaux. Cette V1 ne restaure aucun dossier archivé.
- Deux branches de finalisation coordonnées : CRM `feat/brevo-crm-finalisation` et PR #14 des guides `feat/raccordement-crm`, remise sur le main courant sans force-push. Le checkout utilisateur des guides, les modèles #41–44 et les workflows n8n sont préservés.

## 2. Un seul propriétaire de synchronisation

```text
Capture / guides / scoring → Brevo
                               ↓ GET contacts, modifiedSince + recouvrement
                       Job serveur CRM, toutes les 5 min
                               ↓ politique déterministe
                       Contact + Dossier + tâche existants
                               ↓ actions commerciales locales
                       Outbox SQL → attributs commerciaux Brevo
```

Le CRM effectue les deux sens. **Claude ne crée pas de second export/import ni de webhook CRM dans capture-leads.** Aucun déclencheur n8n ni endpoint public supplémentaire n'est nécessaire. Aucune IA, aucun enrichissement payant dans l'admission.

Fichiers : `crm/brevo_policy.py`, `brevo_api.py`, `brevo_sync.py`, `brevo_sales.py`, `brevo_models.py`, `brevo_views.py`, commande `sync_brevo`, timer/service `ops/althoce-crm-brevo.*`.

## 3. Champs, types et propriétaires

### Lecture Brevo → CRM

Tous les champs ci-dessous appartiennent à Brevo / capture / scoring, sauf les attributs explicitement préfixés `CRM_`. Le CRM conserve un instantané dédié et n'écrase pas à chaque lecture les coordonnées corrigées, le besoin rédigé, les notes, le responsable, les participants ou l'étape du dossier.

| Champs Brevo | Type réel / précision (11 octobre 2026) | Usage CRM |
|---|---|---|
| `id` | entier, identifiant natif | Identité externe durable |
| `email` | texte email natif | Rapprochement initial exact, jamais modifié par le connecteur |
| `createdAt`, `modifiedAt` | date-heure native avec fuseau | `createdAt` fournit la date d'inscription ; `modifiedAt` est uniquement technique |
| `PRENOM`, `NOM`, `ENTREPRISE`, `JOB_TITLE` | texte | Identité déclarée ; entreprise jamais inventée depuis un domaine |
| `SMS`, `TEL_DOUBLON` | texte | Candidat principal et repli contrôlé séparément |
| `PHONE_STATUS`, `EMAIL_STATUS` | texte ; catégories décodées si évolution du schéma | Qualité du canal, distincte du consentement |
| `LINKEDIN` | texte URL http(s) | Profil seulement lorsqu'explicitement renseigné |
| `BESOIN_PRIORITAIRE`, `HORIZON_PROJET` | texte ; catégories décodées si évolution du schéma | Réponses **actuelles** du formulaire |
| `LEAD_SCORE`, `FORM_SCORE`, `BEHAVIOR_SCORE` | nombre Brevo (`float`) | Lecture seulement ; pas de recomposition ni bonus CRM |
| `LAST_EMAIL_CLICK_AT`, `LAST_ENGAGEMENT_AT`, `SCORE_UPDATED_AT` | **date**, sans heure ; précision conservée | Pas, à eux seuls, une preuve de projet récent |
| `RESSOURCE`, `GUIDE_INTEREST_LEVEL` | texte | Contexte ; SINGLE / MULTI_KNOWN / MULTI_RECENT |
| `GUIDES_NAMES`, `GUIDES_THEMES` | texte ; listes de textes acceptées | Guides **demandés**, sans prétendre qu'ils ont été lus |
| `GUIDES_COUNT`, `GUIDES_RECENT_30D` | nombre (`float`) | Contexte et tri, aucun score ajouté |
| `LAST_GUIDE_REQUEST_AT` | **date**, sans heure | Dernière demande connue, pas la date de toutes les anciennes demandes |
| `MG_REQ_<listid>` | texte JSON, ou date historique en texte | Projection de la dernière demande du guide ; pas un journal exhaustif |
| `SOURCE_INSCRIPTION`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT` | texte | Première provenance conservée séparément de la dernière |
| `SOURCE_CONTENT_URL` | texte URL http(s) | Publication source, **pas** profil LinkedIn ; paramètres et fragments retirés |
| `MARKETING_STATUS` | texte | CONSENT / B2B_ELIGIBLE / TO_REVIEW / OPPOSED |
| `LIFECYCLE_STAGE`, `STATUT_APPEL`, `ETAPE_COMMERCIALE`, `ETAT_RDV`, `TYPE_RDV`, `NOM_SETTER` | texte | Enrichissement et prévention d'une nouvelle prospection déjà engagée |
| `DATE_APPEL` | texte | Historique lu, sans transformer une date en heure inventée |
| `emailBlacklisted`, `smsBlacklisted` | booléens natifs | Blocage email / portée SMS ambiguë à revoir, jamais contournés |
| `IS_QA`, `SPAM_CONFIRMED`, `BOT_CONFIRMED` | booléens ; IS_QA créé le 12 octobre, les deux autres optionnels | Exclusion des vraies files de travail |
| `CALLBACK_REQUESTED` | booléen proposé, absent du schéma actuel | Demande explicite uniquement ; ne lève aucun refus |

`MG_REQ_*` est un texte JSON. Forme réelle observée : `{v, slug, sequenceId, requestedAt, firstTrackedAt, queued, followupAt, scale, source}` ; `source` contient les UTM de la demande. Le CRM conserve seulement `slug`, `requestedAt` (ou l'ancien `at`) et la provenance autorisée, y compris le `source` imbriqué. Il ignore l'orchestration des séquences et toute clé inconnue. Les dates inconnues restent inconnues. `requestedAt` date une demande de guide : il ne prouve pas à lui seul que le besoin/horizon actuel a été redéclaré à cet instant.

Les catégories Brevo peuvent être retournées sous forme d'IDs : `GET /contacts/attributes` fournit l'énumération pour les décoder. Un code commercial non reconnu met le contact en suivi à revoir ; il ne devient pas un nouveau prospect prêt à appeler.

### Preuves temporelles écrites par les guides

| Champ réservé | Type | Propriétaire et règle |
|---|---|---|
| `INTENT_UPDATED_AT` | **texte ISO UTC** | Capture seulement, à la dernière soumission qui remplace réellement besoin/horizon |
| `LAST_QUALIFYING_ACTIVITY_AT` | **texte ISO UTC** | Moteur marketing, date de l'événement qualifiant validé |
| `LAST_QUALIFYING_ACTIVITY_TYPE` | texte | Type correspondant au même événement |

Types qualifiants : `HUMAN_CONTENT_CLICK`, `HUMAN_GUIDE_CLICK`, `HUMAN_OFFER_CLICK`, `GUIDE_REQUEST`, `WEBINAR_REGISTERED`, `WEBINAR_ATTENDED`, `MEETING_CONFIRMED`.

Ces trois attributs étaient absents au début de l’audit. Ils ont été créés le 12 octobre 2026, avec les huit champs CRM et IS_QA ; la relecture API confirme les douze types attendus avant publication du code. Aucun champ de scoring existant n’a été changé. Le couple activité doit être écrit ensemble, après les contrôles anti-robot et de déduplication du moteur existant. Une ouverture, un import, un recalcul de score ou une écriture du CRM ne doit pas mettre à jour ces champs.

Le champ existant `LAST_EMAIL_CLICK_AT` est actuellement de type Date : il n'apporte pas l'heure requise. Ne pas changer son type ni inventer une heure sur l'historique. Un éventuel timestamp de clic n'est utilisable comme preuve qu'après vérification explicite qu'il exclut robots/clics techniques ; l'option `BREVO_TRUST_FILTERED_CLICKS` vaut `0` par défaut. `LAST_ENGAGEMENT_AT` est affichable en contexte mais n'est pas une preuve faute de type. Le CRM n'utilise jamais `modifiedAt` comme date de nouveau projet.

### Retour CRM → Brevo

| Champ réservé nécessaire | Type Brevo | Propriétaire |
|---|---|---|
| `CRM_CONTACT_ID` | texte | CRM, identifiant local ; donnée rattachable à une personne |
| `CRM_SALES_STATUS` | texte | CRM, valeurs exactes ci-dessous |
| `CRM_SALES_UPDATED_AT` | **texte ISO UTC** | CRM, date de la projection commerciale |
| `CRM_SALES_VERSION` | nombre (`float`) | CRM, version monotone par lien externe |
| `CRM_SALES_EVENT_ID` | texte UUID | CRM, identifiant durable du retour |
| `CRM_DO_NOT_CALL` | booléen | Refus téléphone, monotone |
| `CRM_EMAIL_OPPOSED` | booléen | Refus email, monotone |
| `CRM_GLOBAL_OPPOSED` | booléen | Refus global ou portée ambiguë, monotone |

Les refus sont séparés parce qu'un simple statut commercial ne permettrait pas d'en conserver la portée. **Aucun `false` n'est envoyé pour lever ces refus.** L'opposition email/globale peut également positionner le champ natif `emailBlacklisted` à `true`, jamais à `false`.

Réutilisation des champs commerciaux existants : `BREVO_COMMERCIAL_MAPPING` accepte, pour chaque statut CRM, uniquement les attributs `STATUT_APPEL`, `ETAPE_COMMERCIALE`, `ETAT_RDV`, `TYPE_RDV`, `DATE_APPEL`, `NOM_SETTER`, `LIFECYCLE_STAGE`. Le mapping reste désactivé par défaut. `fixtures/brevo-commercial-mapping.json` prépare quatre correspondances avec les libellés effectivement observés : NO_ANSWER → À rappeler ; CONTACTED → Contacté ; MEETING_PENDING → RDV planifié / Prévu ; DO_NOT_CALL → Ne plus appeler. Le laisser vide pour ce raccordement : les champs CRM sont directement consommés. Ce JSON reste un exemple non activé de compatibilité historique. Les autres états utilisent uniquement `CRM_SALES_STATUS`, afin de ne pas écraser un détail comme R2 ou Négociation avec une étape moins précise. Les catégories sont envoyées avec leur valeur native, pas leur libellé. Toute valeur/type incompatible bloque l'écriture ; la relecture doit confirmer le résultat.

La nouvelle projection explicite `CRM_SALES_*` est le contrat commun stable. Le moteur guides la consomme au moment de décider chaque relance ; elle ne remplace pas les champs marketing. Aucune écriture de `LEAD_SCORE`, `FORM_SCORE`, `BEHAVIOR_SCORE`, `MARKETING_STATUS`, `EMAIL_STATUS`, UTM, intérêts, guides ou tokens. Aucun changement d'EMAIL, forceMerge, ajout de liste ni appel de campagne/SMS.

### Valeurs commerciales effectivement observées

- `STATUT_APPEL` : À appeler, À rappeler, A rappeler, Ne plus appeler, Contacté, RDV planifié, À relancer, Non qualifie, RDV booke.
- `ETAPE_COMMERCIALE` : Projet reporté — à suivre, Négociation, Devis envoyé, R2 — rendez-vous de closing.
- `ETAT_RDV` : À préciser, Prévu.
- `LIFECYCLE_STAGE` : LEAD, HOT_LEAD. HOT_LEAD seul ne prouve ni un contact abouti ni la récence.
- `PHONE_STATUS` : VALID_FORMAT ; `EMAIL_STATUS` : PENDING. Beaucoup d'anciens contacts n'ont aucun statut renseigné.

Les comparaisons acceptent les variantes d'accents/espaces sans réécrire les données sources. « À appeler » est un état initial ; les rappels et RDV sont du suivi existant. Toute autre valeur commerciale non documentée est conservée en revue.

## 4. Admission et files de travail

1. Projet actuel : horizon `IMMEDIAT`, `MOINS_3_MOIS`, `TROIS_SIX_MOIS` ou `SIX_DOUZE_MOIS`, **sans seuil de score**.
2. Proche + besoin concret (`AUTOMATISER_PROCESS`, `DEPLOYER_AGENT_IA`, `FORMER_EQUIPES`, `DIAGNOSTIC_STRATEGIE`) : P1.
3. Projet lointain : P3, à qualifier maintenant. VEILLE_IA/AUTRE avec projet : conservé, besoin à clarifier. Aucun besoin technique inventé.
4. Sans projet : score ≥25 **et** activité qualifiante prouvée dans les 30 jours : P2. Les seuils sont configurables. Un score ancien ne suffit pas.
5. Entrée nouvelle automatique seulement si le signal probant est daté à partir de `BREVO_NEW_SINCE`. Historique/date inconnue : **simulation et comptage**, aucun import automatique ni lien personnel nouveau au fil de la réconciliation.
6. Plusieurs guides enrichissent une seule fiche, sa chronologie et la tâche existante. La déclaration initiale et la première provenance sont conservées.
7. TO_REVIEW/autorisation inconnue : revue administrateur, hors appels. Coordonnées inutilisables : fiche à compléter, tâche suspendue. La validation humaine ne peut lever ni opposition ni verrou historique.
8. SMS contrôlé en premier ; TEL_DOUBLON est contrôlé indépendamment. Métropole et outre-mer sont acceptés. Format plausible ≠ identité vérifiée. EMAIL_STATUS=PENDING n'empêche pas l'entrée. BOUNCED bloque l'email, pas automatiquement le téléphone.
9. QA #1808/#1810 : exclus de toute mutation et de toute file. Spam/bot confirmé : aucun nouveau dossier.
10. Client/RDV/opportunité/prise en charge : enrichissement du suivi existant, aucune tâche proposant un autre RDV. Si le dossier est introuvable, revue, sans nouveau dossier artificiel.
11. Perdu/archivé : jamais rouvert. Une **nouvelle intention datée** donne au responsable un signal à relire sur son accueil ; il peut le marquer relu. Un replay ne le réactive pas.
12. Nouveaux dossiers admissibles : administrateur destinataire, attente d'affectation. L'affectation groupée existante reste disponible, uniquement pour les fiches prêtes. Les tâches suivent le responsable.

Files internes : `ready`, `review`, `coordinates`, `historical`, `existing_followup`, `closed`, `conflict`, `opposed`, `removed`, `excluded`. Ces codes ne sont pas des étapes commerciales Brevo.

## 5. Statuts commerciaux exacts et pauses des relances

| Valeur CRM_SALES_STATUS | Déclencheur réel | Relances guides |
|---|---|---|
| RECEIVED | Réception, encore à distribuer | Pas de pause par simple import |
| ASSIGNED | Responsable attribué, qualification new | Pas de contact abouti déduit |
| TAKEN_IN_CHARGE | contacting/callback, ou découverte sans RDV actif | Suspendre |
| NO_ANSWER | Tentative enregistrée unreachable | Suspendre ; le CRM gère le rappel humain |
| CONTACTED | Qualification positive qualified sans RDV actif | Suspendre |
| MEETING_PENDING | Rendez-vous planned enregistré | Suspendre ; aucun +25 de confirmation |
| MEETING_CONFIRMED | Rendez-vous confirmed enregistré | Suspendre ; événement +25 une seule fois par le journal marketing existant |
| MEETING_CANCELLED | Aucun RDV actif et dernier RDV annulé | Suspendre ; aucun +25 nouveau |
| DISQUALIFIED | qualification unqualified | Suspendre ; distinct d'une opportunité perdue |
| OPPORTUNITY | scope/draft/sent/signature | Suspendre |
| CLIENT | won | Suspendre la prospection |
| LOST | stage lost | Suspendre ; pas de réouverture automatique |
| ARCHIVED | Dossier archivé déjà lié/autorisé | Suspendre ; pas de réouverture automatique |
| DO_NOT_CALL | Opposition téléphone explicite | Suspendre la sollicitation, conserver sa portée |
| OPPOSED | Opposition email/globale/ambiguë | Suspendre ; aucune tentative de contournement par téléphone |

Ordre CRM : opposition > archive > gagné/perdu > non qualifié > opportunité > RDV actif/dernier RDV > qualification > attribution. Un R1 planifié signifie une réservation, pas la preuve que le client l'a accepté. Annuler un RDV actualise l'état commercial existant sans relancer automatiquement les guides.

La projection canonique comporte statut, version entière positive, identifiant d'événement et date ISO avec fuseau. Elle prime sur les anciens libellés commerciaux. Un refus CRM ou historique reste prioritaire. Une projection partielle/inconnue suspend les relances. Une projection initiale RECEIVED/ASSIGNED ne lève pas un ancien état commercial restrictif. `MEETING_BOOKED` reste accepté en lecture comme alias non confirmé de transition ; le CRM n'émet plus cette valeur. `Prévu` et `RDV planifié` ne sont pas des confirmations. Sans version canonique, une annulation historique prime par prudence sur une ancienne confirmation.

L'effacement de champs de qualification ne remet pas un dossier pris en charge à RECEIVED/ASSIGNED : le dernier état restrictif est conservé. Une éventuelle reprise marketing nécessite un futur parcours humain explicite, absent de cette V1. Une étape suspendue est journalisée `commercial_cycle` ; le moteur ne programme ensuite que les étapes transactionnelles. Une nouvelle demande de guide n'efface pas les champs CRM.

**Pause ≠ suppression de la ressource demandée.** Le moteur guides continue de traiter une demande explicite selon ses propres règles transactionnelles et de délivrabilité. Il n'efface aucune opposition pour y parvenir. Les newsletters/webinaires et leurs consentements restent hors périmètre de cette V1.

Le CRM arrête ses séquences de nurturing et annule les brouillons de sollicitation en attente lors d'une opposition. Les factures et notifications transactionnelles financières existantes sont distinctes ; aucun nouveau message n'est envoyé par ce connecteur.

## 6. Identité, permissions et non-écrasement

- Contrainte SQL unique : `(environment, account)` puis `(sync, external_id)`.
- Rapprochement : lien existant, sinon email `strip + casefold` exact dans l'instance Althoce. Pas de fusion par téléphone/nom ; les `+alias` et points restent significatifs.
- Plusieurs contacts/dossiers candidats : conflit visible. L'administrateur peut sélectionner le dossier au même email, sans fusion automatique. Un changement d'email externe ouvre un conflit et bloque les retours vers cette identité.
- Contacts CRM et suivi humain ne sont pas réécrits par Brevo. Les valeurs reçues apparaissent comme telles ; les coordonnées corrigées restent celles du CRM.
- Une tâche Brevo ouverte au maximum par contact : contrainte SQL conditionnelle, verrou partagé avec les imports manuels. Une tâche terminée ne renaît pas à chaque sondage.
- Les refus s'appliquent à tous les dossiers du contact. Un ancien snapshot ne les retire pas. Une correction positive de consentement doit faire l'objet d'un autre processus humain audité, non livré ici.
- Contrôle administrateur à `/integrations/brevo/`; contexte à `/dossiers/<id>/origine-brevo/`, avec les permissions serveur du dossier. Aucun contexte Brevo pour développeurs/formateurs.
- Aucun secret marketing/HTML importé. Allowlist de champs et limites de taille. Logs : codes d'erreur et compteurs ; pas de corps de réponse fournisseur, clé ou liste complète de données personnelles. Rapports privés `0600`, leurs IDs restent des données rattachables.

## 7. Durabilité, reprises et réconciliation

- Lease PostgreSQL 180 secondes, UUID de fencing vérifié sous verrou avant chaque mutation ; renouvellement entre les appels. Timeout HTTP 5s connexion / 25s lecture, pas de redirection de credential.
- Upsert contact/dossier/lien/tâche/signal/outbox dans une transaction. Les actions locales écrivent l'outbox, **jamais l'API**, dans le chemin de sauvegarde.
- Pagination `sort=asc` sur **la création**, avec `modifiedSince` UTC. Curseur = début du run complètement traité, jamais date de la dernière ligne. Recouvrement 10 minutes. Échec partiel / plafond de pages : checkpoint inchangé ; les lignes déjà commises sont rejouées sans doublon.
- Toutes les 5 min : jusqu'à 50 liens existants relus par ID, y compris inéligibles. Un 404 suspend le suivi, ne recrée pas le contact.
- Réconciliation supplémentaire : une page de 100 contacts par run, curseur de balayage indépendant ; tour borné, puis retour au début. Les historiques non liés restent des compteurs, sans import silencieux.
- Priorité et qualité sont réévaluées, même avec une empreinte inchangée, afin de faire vieillir les signaux.
- Outbox : version et UUID persistants, empreinte métier ; les versions en attente dépassées sont conservées comme `superseded`. Les echoes techniques Brevo ne produisent pas de notification ou tâche.
- Après écriture : GET et vérification des valeurs. Relecture incompatible = erreur, pas succès. Une coupure après PUT est rejouable avec le même événement.
- Retours sortants 429/5xx/transport : retry différé, Retry-After honoré jusqu'à 24h, recul exponentiel plafonné à 1h, 12 tentatives puis intervention visible. 401/403/type invalide : erreur permanente à corriger ; bouton de reprise administrateur. Aucun changement de score de RDV par le CRM.
- Les anciens snapshots, suppressions et réattributions sont contrôlés ; pas de promesse de transaction distribuée avec Brevo. Le CRM ne peut garantir un délai de 5 min pendant une panne ; il expose l'erreur et rattrape à la reprise.

## 8. Modes et configuration

| Mode | Effet |
|---|---|
| off | Aucun appel API, aucun traitement |
| dry-run | Lecture et simulation ; aucun Contact/Dossier/Task/Outbox ni checkpoint modifié ; journal du run seulement |
| qa | Écritures limitées à une allowlist explicite hors #1808/#1810 ; environnement `qa`, base PostgreSQL dédiée contenant `_qa` dans son nom |
| on | Production seulement, date de départ explicite ; pas de reprise historique automatique |

Variables : `BREVO_API_KEY` (secret dédié), `BREVO_ACCOUNT` (identifiant stable du compte confirmé), `BREVO_ENVIRONMENT`, `BREVO_SYNC_MODE`, `BREVO_RECEIVER_EMAIL`, `BREVO_NEW_SINCE` (ISO UTC), `BREVO_QA_IDS`, `BREVO_OUTBOUND_ENABLED=0`, `BREVO_HOT_THRESHOLD=25`, `BREVO_ACTIVITY_DAYS=30`, `BREVO_OVERLAP_MINUTES=10`, `BREVO_MAX_PAGES=100`, `BREVO_TRUST_FILTERED_CLICKS=0`, `BREVO_COMMERCIAL_MAPPING={}`.

Saisie privée préparée : `python3 ops/setup-brevo.py --env-file /chemin/serveur/.env`. Le script n'active rien et n'appelle pas Brevo. Ne pas coller la clé dans un chat, argument de shell ou rapport. Le compte déclaré et la clé doivent être vérifiés ensemble dans la console Brevo avant recette.

## 9. Séquence de recette et activation, après accord

1. Comparer les deux fichiers du contrat et exécuter les suites CRM/guides, puis la recette commune isolée. Reprendre PR #14 avec un merge normal de main, sans force-push ni changement du checkout utilisateur.
2. Présenter la validation groupée : 12 attributs additifs, clé serveur dédiée, nouveaux contacts QA identifiés, release guides/CRM et activation future uniquement. Ne modifier aucun des cinq vrais contacts, ni les QA #1808/#1810.
3. Après accord, créer seulement les champs absents avec `brevo:attributes -- --crm-only --apply` et relire **tous** leurs types. Ne jamais recréer/changer un type incompatible. Le jeu de 12 champs contient les huit CRM, les trois preuves temporelles et IS_QA ; aucun champ de scoring n'est ajouté ou modifié.
4. Configurer la clé serveur en saisie masquée et vérifier qu'elle concerne le même compte Brevo que les guides. La clé du connecteur ChatGPT ne constitue pas une configuration du job serveur. Pas de clé dans Git, arguments de commande ou journaux.
5. Déployer d'abord les guides qui consomment les nouveaux états, vérifier le SHA de la production Vercel et la réception de capture QA. Les champs CRM encore absents gardent le traitement historique ; la livraison demandée reste indépendante. Ne changer ni les neuf bascules sans-liste ni l'automation historique n°4.
6. Sauvegarder la base CRM de façon privée, déployer le CRM avec migrations additives, modes off et retours désactivés ; aucune restauration de vieille base. Exécuter la QA dans une base isolée et avec allowlist de nouveaux IDs QA marqués IS_QA. La QA ne crée aucun dossier fictif dans la base commerciale réelle.
7. Effectuer une simulation de production en lecture : `python manage.py sync_brevo --mode dry-run --full --report /chemin/prive/simulation.json`. Présenter compteurs et rapprochements, sans PII dans Git. `--full` est interdit en écriture. Les dates historiques inconnues restent inconnues ; ne pas antidater `BREVO_NEW_SINCE` pour les faire entrer.
8. Activer le job 5 minutes et les retours seulement après validation de la boucle QA. Fixer une seule fois `BREVO_NEW_SINCE` à l'instant convenu de démarrage ; le conserver ensuite. Aucun import initial supplémentaire. Contrôler trois cycles consécutifs, checkpoint, doublons, plus ancien retour et latence d'une action QA réellement consommée. Un déploiement seul ne vaut pas GO complet.

Simulation reproductible locale :

```sh
BREVO_NEW_SINCE=2026-10-10T00:00:00Z python manage.py sync_brevo \
  --fixture docs/integrations/fixtures/brevo-v1.json \
  --as-of 2026-10-11T12:00:00Z --report /chemin/prive/qa-simulation.json
```

Les fixtures sont fictives ; ne pas les importer dans les vraies listes. Exemples : projet score12, projet lointain, HOT récent, HOT ancien, multi-guides, opposant, client, repli outre-mer, TO_REVIEW, téléphone manquant, veille et date inconnue.

## 10. Retour arrière

0. Si seul le retour Brevo pose problème, désactiver `BREVO_OUTBOUND_ENABLED` en conservant l'import et l'outbox. Si une régression menace les relances, `ALTHOCE_SEQUENCES_PAUSED=true` reporte les étapes différées des guides tout en conservant la livraison immédiate. Ne pas revenir à un code qui ignore les restrictions déjà acquises.
1. Arrêter le timer `althoce-crm-brevo.timer` et le service si nécessaire. Passer `BREVO_SYNC_MODE=off` et `BREVO_OUTBOUND_ENABLED=0`, puis recharger uniquement le service web selon la procédure CRM habituelle.
2. Garder les tables, l'outbox, les oppositions et le code de filtrage. Ce retour arrière fonctionnel est immédiat et ne perd ni suivi humain ni refus.
3. Ne pas restaurer une vieille base par-dessus les nouveaux événements commerciaux. Ne pas remettre d'anciens `false` ni d'anciens statuts dans Brevo.
4. En QA uniquement : les migrations sont réversibles ; revenir à `0073`, puis réappliquer la V1. En production après des échanges, exporter et examiner les liens/signaux/retours avant toute suppression structurelle. Revenir aveuglément au code antérieur supprimerait aussi les contrôles d'opposition : interdit tant qu'un dispositif équivalent n'est pas maintenu.
5. Les dossiers éventuellement créés restent identifiables par leur lien Brevo ; les archiver après examen, pas les supprimer ni toucher aux dossiers commerciaux préexistants. Les tâches en pause ne sont pas déclarées « contact abouti ».
6. Après correction, redémarrer depuis le checkpoint conservé ; le recouvrement et les contraintes rendent le replay sans doublon. Aucun retour Brevo réussi n'est « annulé » automatiquement.

## 11. Responsabilités et recette commune

- **Guides** : réponses/INTENT_UPDATED_AT écrits ensemble après capture validée (même PAS_DE_PROJET), preuve GUIDE_REQUEST datée, first touch et demandes par guide préservés. Le couple dernière activité/type est écrit seulement si l'événement est plus récent ; aucune fausse date de migration.
- **Scoring existant** : journal dédupliqué, aucun nouveau calcul CRM. Un clic n'alimente la preuve de récence que si l'heure réelle du clic et l'envoi sont connus et passent le délai anti-robot existant. Le marqueur `human-validated:` dans la référence non personnelle du journal conserve cette preuve. C'est un filtrage heuristique, pas une identité humaine certifiée. Les anciennes lignes dépourvues de preuve ne sont pas antidatées/requalifiées. Ouverture, écriture CRM, clic inconnu ou trop rapide : aucune preuve de récence CRM.
- **CRM** : lecture incrémentale et réconciliation, admission, propriétaire/suivi humain, outbox unique. Les retours futurs ou de même version mais d'un autre événement sont des conflits visibles, jamais écrasés. Une panne externe ne supprime pas l'action sauvegardée ; une relecture des liens réconcilie également l'état métier.
- **Guides** : lecture des champs CRM avant chaque relance et alerte HOT ; aucune mutation marketing pour représenter une action commerciale. Refus préservés, statuts inconnus prudents, livraison demandée séparée.
- **Exploitation** : ni second export n8n, ni campagne, newsletter, SMS ou appel automatique. Les workflows existants de livraison/scoring restent seuls propriétaires de ces fonctions.

Recette isolée reproductible, depuis chaque racine correspondante (Node 22 et environnement Python CRM) :

```sh
# Guides : produit deux captures fictives via buildContactUpdate.
node --import tsx scripts/qa/crm-roundtrip.ts capture /tmp/althoce-joint-capture.json
# CRM : base SQLite en mémoire forcée, transport Brevo fictif, aucune clé/API.
python ops/qa-brevo-roundtrip.py --capture /tmp/althoce-joint-capture.json --output /tmp/althoce-joint-projections.json
# Guides : lit les projections produites par Django, puis vérifie le point HTTP d'envoi.
node --import tsx scripts/qa/crm-roundtrip.ts verify /tmp/althoce-joint-projections.json
CRM_QA_PROJECTIONS=/tmp/althoce-joint-projections.json npm run test:e2e
```

Cette recette lie réellement les deux codes mais utilise un fournisseur simulé. Elle ne remplace pas une preuve Brevo/VPS/Vercel en production. Le rapport sépare ces deux niveaux.

## 12. Sources vérifiées

Documentation officielle consultée le 11 octobre 2026 :
- [GET contacts](https://developers.brevo.com/reference/get-contacts) : modifiedSince UTC, pagination, tri par création.
- [GET contact](https://developers.brevo.com/reference/get-contact-info) : lecture par ID, coordonnées et attributs.
- [PUT contact](https://developers.brevo.com/reference/update-contact) : mise à jour partielle ; mauvais types ignorés ; danger de réinscription lors d'un changement EMAIL, donc ce champ est interdit ici.
- [GET attributes](https://developers.brevo.com/reference/get-attributes) : catégories, types et énumérations réelles.

Résultats antérieurs : `brevo-crm-v1-recette.md` côté CRM ; finalisation : `brevo-crm-finalisation-2026-10-12.md` côté CRM. Un test simulé n'est pas une connexion fournisseur validée.
