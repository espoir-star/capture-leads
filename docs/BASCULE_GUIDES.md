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
