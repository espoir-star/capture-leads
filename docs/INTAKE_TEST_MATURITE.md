# Test de maturité IA → base marketing (entrée n8n)

Le test de maturité IA d'althoce.com envoie ses leads à n8n, qui livre le résultat en PDF par Brevo transactionnel (hors de ce dépôt). Décision du 19/11/2026 : un visiteur **sans demande de rappel et sans opposition** entre dans la base marketing Brevo gérée ici, pour un nurturing ultérieur par mailing classique. Un contact déjà connu de Brevo ne change pas : il reçoit seulement son PDF. Les demandes de rappel sont traitées directement par Espoir et ne passent pas par ici.

Code : `app/api/intake/test-maturite/route.ts` → `lib/intake/testMaturite.ts` ; configuration `config/testMaturite.ts` ; tests `tests/intake-test-maturite.test.ts`.

## Route

```
POST https://guide-gratuit-pi.vercel.app/api/intake/test-maturite
Authorization: Bearer <SEQUENCE_API_SECRET>
Content-Type: application/json
```

Même secret et même contrôle (temps constant) que `/api/sequences/step` : credential n8n existant **« Althoce · n8n → Vercel (Bearer) »**, aucun nouveau secret. Corps limité à 8 Ko ; garde-fou de 60 appels par minute et par instance.

## Corps (clés inconnues refusées)

| Champ | Type | Règle |
| --- | --- | --- |
| `email` | texte | contrôles de la capture : syntaxe, valeurs factices, jetables, DNS/MX |
| `prenom` | texte | 1 à 100 caractères, ni balise, ni lien, ni `@` |
| `secteur_slug` | texte | `finance`, `comptabilite`, `droit`, `medical`, `assurance-patrimoine`, `immobilier`, `commerce-distribution`, `hotellerie`, `retail-luxe`, `industrie`, `marketing-communication`, `associations`, `secteur-public`, `autre` |
| `secteur_personnalise` | texte, facultatif | ≤ 80 caractères, sans balise ; vide accepté |
| `taille` | texte | identifiant : `solo`, `2-9`, `10-49`, `50-199`, `200+` |
| `role` | texte | libellé affiché (« Dirigeant ou associé »…), écrit dans `JOB_TITLE` |
| `score` | entier 0–100 ou `null` | jamais écrit dans `LEAD_SCORE` / `FORM_SCORE` |
| `stade` | entier 1–4 ou `null` | |
| `stade_nom` | texte ou `null` | |
| `offre_recommandee` | texte | ≤ 120 caractères |
| `lien_resultat` | texte | commence par `https://althoce.com/test-maturite-ia/#resultat=` suivi du code de partage (≤ 80 caractères `A-Z a-z 0-9 . _ -`) |
| `opposition_marketing` | booléen | |
| `source_url` | texte | URL http(s) ou chaîne vide |

## Réponses

| Code | Corps | Sens |
| --- | --- | --- |
| 200 | `{ "status": "created", "marketingStatus": "B2B_ELIGIBLE" \| "TO_REVIEW" }` | contact créé et ajouté à la liste dédiée |
| 200 | `{ "status": "existing" }` | contact déjà dans Brevo : **aucune** écriture (ni attribut, ni liste) |
| 200 | `{ "status": "ignored" }` | `opposition_marketing = true` : Brevo n'est pas lu |
| 200 | `{ "status": "skipped", "reason": "qa" }` | mode `qa`, adresse hors recette |
| 400 | `{ "status": "invalid_body", "field"? }` | schéma (`field` = champ en cause, `unknown_keys` pour une clé inconnue) ou JSON |
| 413 | `{ "status": "invalid_body", "reason": "size" }` | corps > 8 Ko |
| 422 | `{ "status": "invalid_email", "reason" }` | adresse refusée (`disposable`, `syntax`, `domain_not_found`…) |
| 401 / 404 / 429 | — / — / `{ "status": "rate_limited" }` | secret faux / secret absent côté Vercel / débit |
| 503 | `{ "status": "disabled" }` ou `{ "status": "misconfigured" }` | bascule fermée / liste ou clé Brevo absente |
| 502 | `{ "status": "error" }` | Brevo indisponible, sans détail ; réessayer sans risque |

## Contact créé

Attributs calculés par `buildContactUpdate` (`lib/lead/contactUpdate.ts`), exactement comme une nouvelle capture, puis complétés :

| Attribut | Valeur |
| --- | --- |
| `PRENOM` | prénom saisi (aucun `NOM`, aucun `SMS`) |
| `SOURCE_INSCRIPTION` | `test-maturite-ia` |
| `RESSOURCE` | `Test de maturité IA` |
| `JOB_TITLE` | `role` |
| `VERTICAL`, `SUBSECTOR` | correspondance ci-dessous |
| `MARKETING_STATUS` | règles de `lib/marketing/status.ts` : le test affiche la mention métier et propose l'opposition → `B2B_ELIGIBLE` si verticale métier, `TO_REVIEW` si `GENERAL`. Jamais `CONSENT` |
| `EMAIL_STATUS`, `LIFECYCLE_STAGE` | `PENDING`, `LEAD` |
| `MARKETING_OPTOUT_TOKEN`, `EMAIL_CONFIRM_TOKEN` | jetons chiffrés, comme une capture |
| `FORM_SCORE`, `LEAD_SCORE` | `0` (aucune déclaration besoin/horizon) |
| `LAST_QUALIFYING_ACTIVITY_AT` / `_TYPE` | date de l'appel / `GUIDE_REQUEST` (demande d'une ressource, type du contrat CRM) |
| `IS_QA` | `true` seulement pour une adresse de `ALTHOCE_SEQUENCE_QA_EMAILS` |

Liste : `BREVO_LIST_TEST_MATURITE` uniquement. Création avec `updateEnabled: false` : un contact apparu entre la lecture et l'écriture n'est jamais modifié (réponse `existing`).

Ni email, ni séquence, ni appel n8n. Après la réponse, événement `lead_magnet_submitted` (liste blanche `BREVO_EVENTS`, aucune automation ne l'écoute) : `resource`, `vertical`, `subsector`, `secteur`, `secteur_personnalise`, `taille`, `role`, `score`, `stade`, `stade_nom`, `offre_recommandee`, `lien_resultat`, `is_new_contact`, `marketing_status`, `landing_page`. Les données propres au test restent ainsi sur la fiche sans nouvel attribut.

## Correspondance des secteurs (`config/testMaturite.ts`)

| `secteur_slug` | VERTICAL | SUBSECTOR | MARKETING_STATUS |
| --- | --- | --- | --- |
| `finance` | FINANCE | — | B2B_ELIGIBLE |
| `comptabilite` | FINANCE | EXPERTISE_COMPTABLE | B2B_ELIGIBLE |
| `assurance-patrimoine` | FINANCE | ASSURANCE | B2B_ELIGIBLE |
| `droit` | LEGAL | — | B2B_ELIGIBLE |
| `marketing-communication` | MARKETING | AGENCE_MARKETING | B2B_ELIGIBLE |
| tous les autres | GENERAL | — | TO_REVIEW |

`finance` n'a pas de sous-secteur : la page secteur du site vise « Établissements financiers · Fintech · Directions financières », que `DAF_FINANCE` ne couvre qu'en partie. Règle du dépôt : un sous-secteur ambigu reste vide (il n'est jamais réécrit ensuite). `droit` : aucun code juridique dans la taxonomie.

## À savoir avant d'ouvrir

- **Newsletter et annonces** : un contact `B2B_ELIGIBLE` entre dans les segments `NEWSLETTER — …` de sa verticale et, au prochain `npm run newsletter:list -- annonce --apply`, dans « ANNONCES — BASE ENVOYABLE ». C'est le « mailing classique » demandé ; cela remplace la note du 18/11/2026 du site (`docs/test-maturite-ia/emails.md` : « hors newsletter générale »).
- **Liste sans automation** : toutes les automations Brevo démarrent sur « ajouté à une liste ». N'en attacher aucune à « LM - Test de maturité IA » tant que le nurturing n'est pas prêt.
- **CRM** : le contact est lu par la synchronisation CRM, mais sans projet ni score il n'entre dans aucune file d'appel (`INTEGRATION_CRM.md` § 4).
- **Ordre dans n8n** : un envoi transactionnel Brevo ne crée pas de contact. Si n8n écrivait lui-même le contact dans Brevo, il faudrait appeler cette route **avant**, sinon elle répondrait toujours `existing`.

## Mise en service

1. Brevo → Contacts → Listes → dossier « Lead Magnets » → créer **« LM - Test de maturité IA »**, sans automation. Noter son ID.
2. Fusionner et déployer avec la bascule **vide** (route fermée, 503).
3. Vercel (Production) : `BREVO_LIST_TEST_MATURITE=<ID>`, `ALTHOCE_INTAKE_TEST_MATURITE=qa`, une adresse de recette dans `ALTHOCE_SEQUENCE_QA_EMAILS` → Redeploy. Le build refuse `qa` / `on` sans `SEQUENCE_API_SECRET` ni ID numérique.
4. n8n (flux du test) : nœud HTTP Request dans la branche « plan sans rappel et sans opposition », après l'envoi du PDF ; credential « Althoce · n8n → Vercel (Bearer) » ; **On Error : Continue** (la livraison du PDF ne dépend jamais de cet appel) ; 2 essais espacés de 5 s sur 502.
5. Recette : test avec l'adresse QA → `created`, fiche relue dans Brevo (attributs, liste, `IS_QA`) ; deuxième envoi → `existing`, fiche inchangée ; adresse ordinaire → `skipped`.
6. `ALTHOCE_INTAKE_TEST_MATURITE=on` → Redeploy.

Retour arrière : vider `ALTHOCE_INTAKE_TEST_MATURITE` (Redeploy) ; n8n reçoit 503 et continue.

## Corps envoyé par n8n

Le nœud Code du flux n8n (`docs/test-maturite-ia/n8n/inscrire-base.js` côté site) construit le corps à partir du contact transmis par le site, champ pour champ, sans conversion :

| Champ envoyé | Valeur du contact transmis par le site |
| --- | --- |
| `email`, `prenom` | `email`, `prenom` |
| `secteur_slug` | `secteur_slug` |
| `secteur_personnalise` | `secteur_personnalise`, seulement s'il est présent |
| `taille` | `taille_code` (`solo`, `2-9`, `10-49`, `50-199`, `200+`), tel quel |
| `role` | `role` (libellé) |
| `score`, `stade`, `stade_nom` | `score`, `stade`, `stade_nom` (`null` si non établis) |
| `offre_recommandee`, `lien_resultat` | `offre_recommandee`, `lien_resultat` |
| `opposition_marketing` | `false` (seuls les visiteurs sans opposition sont envoyés) |
| `source_url` | `source_url` |

Le nœud HTTP Request qui appelle la route est configuré en **On Error : Continue** : un refus ou une panne de cette route n'interrompt jamais le flux ni la livraison du PDF. La route n'est appelée que pour `demande = "plan"`, `rappel = false` et `opposition_marketing = false`.

## Suite possible (hors de cette PR)

Attributs propres au test pour segmenter le nurturing, à créer seulement après décision : `MATURITE_SCORE` (nombre), `MATURITE_STADE` (nombre), `MATURITE_OFFRE` (texte), `MATURITE_SECTEUR` (texte), `MATURITE_TAILLE` (texte). Les ajouter à `NEW_ATTRIBUTES` (`config/brevoAttributes.ts`), puis `npm run brevo:attributes` (à blanc) et `npm run brevo:attributes -- --apply` ; enfin les écrire à la création dans `lib/intake/testMaturite.ts`.
