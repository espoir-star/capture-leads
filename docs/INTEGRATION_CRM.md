# Intégration guides ↔ CRM Althoce (côté capture-leads)

État au 12/10/2026, 00 h. **Le contrat Codex `docs/integrations/brevo-crm-v1.md` n'a pas encore été relu.** Il se trouve dans le dépôt du CRM, absent de ce poste et de GitHub.

Ce document décrit ce que capture-leads produit et consomme. Tout nom de champ CRM reste **proposé** tant que le contrat n'est pas relu ; rien n'est activé en production avant cette relecture.

## 1. Répartition des responsabilités

| Sujet | Propriétaire | Remarque |
|---|---|---|
| Capture, besoin/horizon, date de déclaration | capture-leads | `lib/lead/contactUpdate.ts` |
| Score (formulaire + comportement), HOT, intérêts multi-guides | capture-leads + n8n (journal) | Le CRM ne recalcule pas `LEAD_SCORE` |
| Livraison des guides, relances guides | capture-leads (Vercel + n8n) | Modèles Brevo 41–44 |
| Lecture Brevo → CRM (toutes les 5 min, checkpoint, déduplication) | **CRM (Codex)** | Aucun export concurrent dans capture-leads ni n8n |
| Responsable, résultat d'appel, RDV, étape commerciale | **CRM (Codex)** | Écrit dans Brevo uniquement les champs du contrat |
| Pause des relances selon l'état commercial | capture-leads | `config/commercialStates.ts` |

Aucun appel CRM dans `POST /api/lead` : une panne du CRM n'empêche ni la capture ni la livraison. La V1 du CRM lit Brevo.

## 2. Champs produits par la capture (lus par le CRM)

| Attribut Brevo | Type | Écrit quand | Sens |
|---|---|---|---|
| `BESOIN_PRIORITAIRE` | texte | chaque capture validée | dernière réponse : AUTOMATISER_PROCESS, DEPLOYER_AGENT_IA, FORMER_EQUIPES, DIAGNOSTIC_STRATEGIE, VEILLE_IA, AUTRE |
| `HORIZON_PROJET` | texte | chaque capture validée | dernière réponse : IMMEDIAT, MOINS_3_MOIS, TROIS_SIX_MOIS, SIX_DOUZE_MOIS, PAS_DE_PROJET |
| **`INTENT_UPDATED_AT`** (nouveau, à créer) | texte ISO UTC | chaque capture validée, y compris PAS_DE_PROJET | date de **cette** déclaration ; jamais par un clic, un recalcul, un retour CRM ni un backfill |
| `FORM_SCORE` / `LEAD_SCORE` | nombre | capture / scoring | **maximum historique**, jamais à la baisse : à lire avec `INTENT_UPDATED_AT` |
| `MG_REQ_<liste>` | texte JSON | chaque demande de guide (multi-guides actif) | dernière demande de ce guide : date prouvée (`requestedAt`), première observation, provenance UTM de cette visite |
| `GUIDES_COUNT`, `GUIDES_NAMES`, `GUIDES_THEMES`, `GUIDES_RECENT_30D`, `LAST_GUIDE_REQUEST_AT` (date sans heure), `GUIDE_INTEREST_LEVEL` | synthèses | recalculées après relecture | aide au tri ; un thème n'est pas un métier ; une demande n'est pas une lecture |
| `UTM_*`, `SOURCE_CONTENT_URL` | texte | première visite seulement (first touch) | provenance d'origine ; URL d'un post, pas d'un profil |
| `MARKETING_STATUS` | texte | capture / opposition | CONSENT, B2B_ELIGIBLE, TO_REVIEW, OPPOSED ; une nouvelle demande ne lève jamais un refus |
| `EMAIL_STATUS` | texte | capture / webhooks | PENDING n'est pas « invalide » ; BOUNCED : canal email inutilisable |
| `SMS`, `TEL_DOUBLON`, `PHONE_STATUS` | texte | capture | `PHONE_STATUS` décrit `SMS` ; `TEL_DOUBLON` est un repli non vérifié |

Vérifié en production le 11/10 (recette réelle, contacts QA 1811 à 1817) :
- `BESOIN_PRIORITAIRE` et `HORIZON_PROJET` sont réécrits à chaque capture ;
- `MG_REQ_*` porte bien la provenance propre à chaque demande (LinkedIn pour une demande, vide pour une visite directe) ;
- le first touch est conservé et les synthèses sont recalculées.

`INTENT_UPDATED_AT` est codé et testé (branche `feat/raccordement-crm`). Il **n'est pas encore créé dans Brevo** : il doit l'être **avant** le déploiement, sinon Brevo refuserait l'écriture.

## 3. États commerciaux lus par les relances (CRM → Brevo → capture-leads)

Classement explicite dans `config/commercialStates.ts`, à partir des valeurs réellement présentes dans Brevo le 12/10/2026 (1 796 contacts) :

| Valeur Brevo | État | Relance guide | Alerte HOT |
|---|---|---|---|
| (aucune), `NOM_SETTER` seul | NONE (attribution ≠ prise en charge) | oui | oui |
| STATUT_APPEL « À appeler » (495) | IMPORTED | oui (pas de CONTACTED fictif) | oui |
| « À rappeler » (209), « A rappeler », « À relancer » (17) | ATTEMPTED (tentative, pas un échange abouti) | **suspendue** | non |
| « Contacté » (22) | REACHED | suspendue | non |
| « RDV planifié » (18), « RDV booke », ETAT_RDV « Prévu » (14), LIFECYCLE MEETING_BOOKED | MEETING_CONFIRMED (+25 une seule fois) | suspendue | non |
| ETAT_RDV « À préciser » (19), TYPE_RDV seul | MEETING_TBD (pas confirmé, pas de +25) | suspendue | non |
| ETAT_RDV annulé / reporté / absent | MEETING_CANCELLED (pas de reprise automatique) | suspendue | non |
| ETAPE_COMMERCIALE Négociation / Devis envoyé / R2 | OPPORTUNITY | suspendue | non |
| « Projet reporté — à suivre » | DEFERRED | suspendue | non |
| LIFECYCLE CLIENT / LOST | CLIENT / LOST | suspendue | non |
| « Non qualifie » | DISQUALIFIED | suspendue | non |
| « Ne plus appeler » (140) | DO_NOT_CALL (le refus l'emporte sur tout) | suspendue | non |
| toute autre valeur | UNKNOWN : jamais interprétée comme « confirmé » | suspendue (prudence) | non |

Points clés :
- **La livraison d'un guide explicitement demandé ne dépend jamais de ces états.** Elle reste soumise à la qualité de l'adresse (BOUNCED, INVALID…).
- **Pas de double +25.** Le RDV est compté une seule fois par le moteur existant (clé d'événement unique par contact) ; le CRM ne l'ajoute pas.
- **Changement de comportement.** « À rappeler », « À relancer », « Contacté » et « Ne plus appeler » suspendent désormais les relances guides. Avant, seuls `ETAT_RDV`, `TYPE_RDV` et certaines étapes du cycle de vie le faisaient.
- **À valider avec Codex et Espoir :** suspendre dès la première tentative (ATTEMPTED) plutôt qu'au premier échange abouti.

## 4. Champs proposés au contrat (non créés)

- `INTENT_UPDATED_AT` (capture) : à créer.
- `CRM_CONTACT_ID`, `CRM_SALES_STATUS`, `CRM_SALES_UPDATED_AT` (texte ISO UTC) : écrits par le CRM. Ils seront raccordés dans `config/commercialStates.ts` **après** relecture des valeurs exactes du contrat.
- Un seul créateur d'attributs par champ, à convenir avec Codex.

## 5. Tests

**Simulés (unitaires, verts) :**
- `tests/commercial-state.test.ts` : 22 valeurs réelles classées ; relance maintenue pour un import ou une simple attribution ; suspension dès la prise en charge ; livraison indépendante ; opposition prioritaire ; +25 seulement pour un RDV confirmé ; pas de HOT après prise en charge.
- `tests/contactUpdate.test.ts` : déclaration datée, PAS_DE_PROJET rectifié sans baisse de score.
- `tests/behavior-scoring.test.ts` : un clic ou un recalcul ne date jamais une déclaration.

**Réels (11/10, recette guides) :** capture, besoin/horizon, multi-guides et provenance, opposition puis nouvelle demande livrée sans réabonnement (QA 1813), RDV simulé (QA 1816) puis relance suspendue.

**Bloqués en attendant le CRM :** recette commune guide → Brevo → CRM → retour commercial → pause (scénarios 1 à 11 du prompt de raccordement).

## 6. Réglages et actions restantes

**Côté capture-leads (Claude) :**
1. Relire le contrat Codex et aligner les noms et valeurs (`CRM_SALES_STATUS`…).
2. Créer `INTENT_UPDATED_AT` (texte) dans Brevo, puis fusionner la branche `feat/raccordement-crm` (activation après validation).
3. Recette commune en QA avec Codex, sans affectation à de vrais commerciaux.

**Côté CRM (Codex) :**
- Admission, priorité, checkpoint, file de retour et exclusion des contacts QA (1808, 1810 à 1817).
- Écriture des seuls champs commerciaux du contrat, horodatés.

**Contacts QA à exclure du CRM :**
- `espoir+qa-*@contact.althoce.com` (1808, 1810 à 1814, 1816, 1817) ;
- 1815, adresse saisie par erreur et en rebond définitif.
