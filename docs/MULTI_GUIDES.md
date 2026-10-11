# Multi-guides — finalisation du parcours Althoce

## Objectif métier

Une fiche Brevo par email ; chaque ressource explicitement demandée reste livrée. Plusieurs demandes ne doivent ni s'écraser ni multiplier mécaniquement les relances commerciales. La newsletter est hors périmètre.

## Implémentation sur la PR #8

### 1. Identité par ressource

Les neuf guides ont chacun une identité de séquence, mais partagent le workflow n8n et les modèles génériques #37–38. L'ancienne identité `guide-generique-v1` reste lisible pour les inscriptions signées déjà en cours. Ne pas les rejouer sous une nouvelle identité.

### 2. Demande et tâche durables par guide

`config/multiGuides.ts` définit trois champs techniques par ressource, à partir de l'ID de sa liste : `MG_REQ_<id>`, `MG_SENT_<id>`, `MG_ENROLLED_<id>`.

- La demande validée est écrite avec le contact, avant la réponse au formulaire.
- Elle conserve le guide, la première date observée par le nouveau suivi, la dernière date et les UTM de cette dernière demande (le first touch historique est inchangé).
- Le reçu de livraison contient la clé de sa demande. Terminer le guide A ne peut pas solder le guide B. Une ancienne fin d'envoi ne confirme pas une nouvelle demande du lendemain.
- L'inscription n8n confirmée dispose de son reçu indépendant ; si elle échoue après une bonne livraison, seule l'inscription est reprise.
- Les captures restées sur l'automation historique sont tracées avec `queued=false` : ne pas doubler leur livraison.
- Turnstile dégradé ne crée pas de nouvelle tâche email automatique.

C'est une projection de la DERNIÈRE demande par ressource et un reçu, pas une base événementielle exhaustive. Les événements de capture Brevo complètent l'historique. Un même guide redemandé plusieurs fois reste un seul intérêt distinct. Les IDs contact, intérêts et UTM sont des données rattachables au prospect : ce n'est pas une anonymisation.

### 3. Champs visibles et filtres

- `GUIDES_COUNT` : nombre de ressources distinctes connues.
- `GUIDES_NAMES` : titres correspondants.
- `GUIDES_THEMES` : thèmes d'intérêt, pas métier déduit.
- `GUIDES_RECENT_30D` : demandes distinctes réellement datées sur 30 jours.
- `LAST_GUIDE_REQUEST_AT` : dernière demande datée.
- `GUIDE_INTEREST_LEVEL` : SINGLE, MULTI_KNOWN ou MULTI_RECENT.

Les anciennes listes ne donnent pas les dates : aucun signal récent n'est inventé. Les synthèses sont recalculées après relecture et à la maintenance ; elles convergent, mais plusieurs écritures de projection ne sont pas une transaction atomique. Les champs techniques sont à masquer de l'affichage commercial.

### 4. Relances regroupées

Au moment de la relance marketing, Vercel relit les demandes et les oppositions. Pour les nouvelles inscriptions multi-guides, seule la dernière demande candidate conserve son J+2. Les autres sont terminées avec `multi_guide_consolidated`.

Le champ `MG_LAST_FOLLOWUP_AT` limite les relances proches (48 h, accélérées seulement en QA). Une relance redondante est supprimée plutôt qu'accumulée dans une file. Les livraisons de guides ne sont jamais limitées par cette règle.

Cette consolidation ne couvre pas les automations Brevo historiques qui continueraient en parallèle. Leur fermeture d'entrée et leur vidage font partie de la migration. Une vérification de concurrence réelle reste obligatoire ; les champs Brevo ne constituent pas un verrou distribué universel.

### 5. Priorité commerciale

Le rapport et l'alerte HOT existants présentent les guides, leurs thèmes et le nombre de demandes récentes. Il n'y a aucun bonus arbitraire de score pour une simple appartenance à une ancienne liste, aucun changement de métier ni de consentement. Le commercial croise MULTI_RECENT avec le score, l'horizon, les clics et le statut d'appel.

## Activation progressive (désactivée par défaut)

1. CI verte et inspection du diff.
2. Préparer les attributs, EN LECTURE SEULE :
   `npx tsx --tsconfig tsconfig.json scripts/brevo/setup-multi-guides.ts`
3. Vérifier les types et la capacité du compte. La première version ajoute 34 attributs (27 techniques, 7 de synthèse/fréquence). Seuls les champs utiles au commercial doivent être affichés.
4. Après validation, ajouter `--apply`. Le script ne modifie aucun contact et n'envoie aucun email. Si la création est partielle, ne pas activer ; corriger puis relancer.
5. Vérifier en QA le stockage/relecture INTACTE des champs JSON et titres dans le vrai Brevo (limites de taille et typage). Un mock ne suffit pas.
6. Fusionner/déployer avec `ALTHOCE_MULTI_GUIDES` vide : aucune nouvelle écriture.
7. Passer `ALTHOCE_MULTI_GUIDES=qa`, avec les alias autorisés, sans changer les autres prospects. Ajouter deux guides en `slug:qa` dans ALTHOCE_SEQUENCE_GUIDES pour le test multi-ressources.
8. Vérifier les livraisons, la relance unique, l'opposition, les reprises et les projections.
9. Avant `on` : traiter les anciennes tâches GUIDE_DELIVERY_REF restées PENDING, et les inscriptions de l'ancienne séquence générique ; éviter deux propriétaires de la même livraison. Fermer les entrées des automations historiques lors de chaque bascule de guide. Ne pas effacer les files en cours.

**Créer les attributs ne publie pas les HTML Brevo.** Les modèles professionnels #35–38 restent un chantier de publication distinct via l'accès Brevo autorisé.

## Maintenance et charge

La route horaire existante appelle `maintainMultiGuides` après ses tâches actuelles. Pagination des contacts, budget résiduel, nombre de reprises limité, rotation horaire pour les contacts en erreur. Les demandes ne sont pas supprimées lorsqu'un budget est épuisé. Suivre `pending`, `failed`, `budgetExceeded`, `deferred` ; ne pas interpréter HTTP 200 comme « toute la file vidée ».

Les demandes de plus de 72 h sont marquées EXPIRED et ne partent pas tardivement ; le guide reste accessible sur sa page. Mesurer la durée de la maintenance avec le vrai compte avant généralisation. À charge plus importante, isoler le worker/cursor et adopter un stockage transactionnel plutôt que multiplier indéfiniment les attributs.

## Recette obligatoire

- Même email, guides A/B le même jour : un contact, deux URLs et deux livraisons.
- A/B en parallèle : champs indépendants ; aucun guide écrasé.
- Même guide soumis cinq fois : une ressource, pas cinq emails.
- Envoi A OK, B indisponible : B reste à reprendre, A n'est pas renvoyé.
- n8n indisponible : guide délivré, inscription rejouable sans renvoi du guide.
- Désabonnement après A, demande B : B livré, zéro relance marketing.
- A puis B avant J+2 : deux livraisons, une relance portant sur B.
- Nouvelle demande le lendemain pendant la fin de l'ancienne : reçu distinct.
- Dates absentes sur anciens contacts : pas de récence inventée.
- Feature flag absent : flux existant inchangé.

Les tests automatiques utilisent un Brevo simulé. Ne pas annoncer le multi-guides opérationnel dans le compte réel avant une recette QA de bout en bout. Aucun backfill marketing ou campagne n'est déclenché par cette branche.
