# Bascule des 9 guides vers le moteur Althoce (Vercel + n8n)

## État relevé dans Brevo le 11/10/2026 vers 22:45 (lecture seule)

Les 9 automations ont la même structure : déclencheur « Ajouté à la liste » → email de livraison (anciens modèles, tutoiement) → attente de 2 jours → relance → sortie.
Brevo affiche « plus de 80 % de la limite de 2 000 contacts en automation » (environ 1 897 entrées cumulées). Une fois cette limite atteinte, les nouveaux inscrits risquent de ne plus entrer dans les automations, donc de ne plus recevoir le guide.

| Slug | Liste | Automation | Entrées / terminées | En cours |
|---|---:|---:|---:|---:|
| 12-cas-usage-experts-comptables | 10 | 4 | 518 / 504 | **11** (attente J+2) |
| guide-claude-pennylane | 6 | 2 | 394 / 394 | 0 |
| guide-claude-meta-ads | 7 | 3 | 1 / 1 | 0 |
| copilot-8-cas-usage | 11 | 6 | 16 / 15 | 0 |
| claude-droit-10-cas-usage | 12 | 7 | 153 / 153 | 0 |
| 12-skills-claude-finance | 13 | 8 | 409 / 406 | 0 |
| claude-data-gouv-20-prompts | 14 | 9 | 203 / 203 | 0 |
| 12-agents-ia-direction-financiere | 15 | 10 | 147 / 147 | 0 |
| 7-chantiers-ia-cabinet | 16 | 11 | 56 / 56 | 0 |

## Principe : aucun trou de livraison, aucun double envoi

Le mode `slug:sans-liste` de `ALTHOCE_SEQUENCE_GUIDES` active le nouveau moteur pour tous les prospects du guide **sans les ajouter à sa liste**.

- L'automation historique, déclenchée par l'ajout à la liste, ne reçoit donc plus d'entrées.
- Elle n'envoie rien de plus, et elle peut finir ses contacts en cours avant d'être mise en pause.
- Les relances sont à J+2 réel (`timeScale` 1), sauf pour les adresses QA.

## Déroulé par étapes

1. **Prérequis.** Recette QA verte, avec les correctifs #1810 et la page merci déployés.
2. **Variables Vercel (Production), puis redéploiement :**

   ```dotenv
   ALTHOCE_SEQUENCE_GUIDES=12-cas-usage-experts-comptables:sans-liste,guide-claude-pennylane:sans-liste,guide-claude-meta-ads:sans-liste,copilot-8-cas-usage:sans-liste,claude-droit-10-cas-usage:sans-liste,12-skills-claude-finance:sans-liste,claude-data-gouv-20-prompts:sans-liste,12-agents-ia-direction-financiere:sans-liste,7-chantiers-ia-cabinet:sans-liste
   ALTHOCE_MULTI_GUIDES=on
   ```

   Les variables `ALTHOCE_GUIDE_EMAIL_VERSION=2`, `ALTHOCE_SEQUENCE_QA_EMAILS` et `ALTHOCE_SEQUENCE_QA_TIME_SCALE=120` sont inchangées : l'accélération ne concerne que les adresses QA en mode `:qa`, qui disparaît.
3. **Contrôle immédiat.** Faire une capture QA par moteur, puis vérifier dans l'ordre :
   - livraison par le modèle n°41 ou n°43 ;
   - contact hors liste ;
   - aucune entrée dans l'automation ;
   - inscription n8n à J+2 réel.
4. **Mise en pause des automations sans contact en cours :** 2, 3, 6, 7, 8, 9, 10 et 11. Utiliser « Mettre en pause », pas « Désactiver » et pas de suppression.
5. **Automation 4 (12 cas).** La laisser active jusqu'à la fin de ses 11 relances en cours (48 h au plus) : elle ne reçoit plus d'entrées. La mettre en pause ensuite.
6. **Plus tard, une fois les automations en pause :** on pourra repasser en mode `slug` (sans suffixe) pour réalimenter les listes, utiles pour la segmentation. Ne jamais réactiver une automation en pause.

## Coexistence et données

- Les anciennes `GUIDE_DELIVERY_REF` restées en PENDING sont reprises par la maintenance (aucune n'est présente le 11/10).
- Les inscriptions n8n déjà signées restent valides.
- Une nouvelle demande d'un contact déjà dans la liste (ancienne automation terminée) donne la livraison du guide, mais aucune nouvelle relance (`wasInList`).
- La consolidation multi-guides ne voit pas les relances d'une automation historique encore en cours : c'est seulement le cas des 11 contacts de l'automation 4, pendant 48 h au plus.

## Retour arrière (par guide ou global)

1. Retirer le slug de `ALTHOCE_SEQUENCE_GUIDES` (ou remettre `:qa`) et `ALTHOCE_MULTI_GUIDES=qa`, puis redéployer.
2. Réactiver l'automation correspondante.

Les contacts capturés pendant la période « sans liste » ne sont pas dans la liste : ils ne recevront pas l'ancienne relance, mais ils ont reçu le guide et leur relance n8n reste planifiée. Pour l'arrêter, mettre `ALTHOCE_SEQUENCES_PAUSED=true`.

## Journal de bascule

### Recette réelle du 11/10/2026 (production, contacts QA, J+2 accéléré à 24 min)

| Scénario | Contact QA | Résultat |
|---|---|---|
| Incident #1810 : 2 demandes en attente reprises par la maintenance | 1810 | modèles 41 et 43 acceptés 23:07:59 / 23:08:01, reçus en boîte de réception ; une seule relance (Pennylane, 23:31:58) ; 12 cas : `multi_guide_consolidated` |
| Adresse neuve venant de LinkedIn | 1811 | livré environ 2 s après la demande ; UTM LinkedIn enregistré ; relance 42 à 00:04:47 |
| Demande répétée | 1811 | nouvelle demande enregistrée, aucun second email |
| Deux guides, même adresse | 1812 | 2 livraisons ; Copilot (verticale GENERAL) sans relance ; une relance Droit à 00:10:23 |
| Soumissions rapprochées (2,1 s) | 1813 | un email, une inscription |
| Provenance par demande / first touch | 1814 | MG_REQ_16 = LinkedIn LI_GEN, MG_REQ_6 = vide (visite directe) ; first touch conservé |
| RDV pris avant relance | 1816 | +25 une seule fois (maintenance 00:07), pas d'alerte HOT ; relance `commercial_cycle` |
| Désabonnement avant relance, puis nouvelle demande | 1813 | relance `marketing_not_allowed` ; 12 skills livré après opposition, toujours OPPOSED, sans liste ni relance |
| Guide sans verticale (data.gouv) | 1817 | livré ; TO_REVIEW, sans relance |
| Adresse mal saisie (vrai prospect, ancien parcours) | 1815 | automation 8 : email envoyé en 6 s, rebond définitif → `EMAIL_STATUS=BOUNCED` |
| Clic guide puis second clic | 1810 | +5 une seule fois |
| Routes protégées | — | 401 / 405 / 413 / 400 / 403, sans création de contact |

Les 12 emails au nouveau modèle sont arrivés en boîte de réception (Gmail, aucun en indésirables).

### Bascule du 12/10/2026, vers 00 h 30

- **Variables Vercel (Production) :** `ALTHOCE_SEQUENCE_GUIDES` = les 9 guides en `:sans-liste` ; `ALTHOCE_MULTI_GUIDES=on`. Les autres variables sont inchangées.
- **Redéploiement :** ce commit sur `main`.
- **Automations Brevo :** laissées actives cette nuit. Elles ne reçoivent plus d'entrées du site, car celui-ci n'ajoute plus personne aux listes. À mettre en pause après la première capture réelle validée sur le nouveau moteur : la 4 après ses relances en cours, les autres dès la validation. En cas d'erreur de configuration, l'ancien parcours (liste → automation) reste donc un filet de sécurité, sans double envoi.

### Capture de contrôle et mise en pause (12/10/2026, matin)

- **Capture de contrôle (09:10) :** contact 1818 `espoir+qa-bascule`, guide Pennylane, après la bascule.
  - Livraison par le nouveau moteur (modèle 43), acceptée à 09:10:13 et remise à 09:10:14, arrivée en boîte de réception.
  - Contact ajouté à **aucune liste**, et aucun email de l'ancienne automation n°2.
  - Relance n8n à **J+2 réel** : 14/10 à 09:10.
- **Nuit du 11 au 12/10 :** 8 maintenances et 8 recalculs en succès, aucune alerte.
- **Automations mises en pause vers 09:20 :** 2, 3, 6, 7, 8, 9, 10 et 11, avec « Mettre en pause », sans désactivation ni suppression.
  - Aucune n'avait de contact en cours, sauf la n°8 : 1 contact, le test 1815 (adresse mal saisie, en rebond).
  - Compteurs Brevo après l'opération : 8 en pause, 1 active.
- **Automation 4 (12 cas) : encore active.** Ses 10 contacts en cours terminent leur relance J+2 et elle ne reçoit plus d'entrées (toujours 518). La mettre en pause **à partir du 14/10 à 01:00**.
- **Ne jamais réactiver une automation en pause** : elle reprendrait l'envoi des anciens emails au tutoiement.
