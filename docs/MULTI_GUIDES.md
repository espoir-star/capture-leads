# Prospects multi-guides — périmètre de finalisation des guides

Demande d’Espoir du 11/10/2026 : identifier les prospects demandant plusieurs guides et exploiter ce signal, avant la diffusion LinkedIn. La newsletter reste hors périmètre.

## Première correction et identification

- Un contact Brevo reste unique par email. Ne jamais fusionner des personnes sur leur téléphone partagé ni enrichir leur identité sans preuve.
- Les listes de capture existantes permettent de retrouver les ressources associées. RESSOURCE reste la dernière demande, pas la ressource d’origine.
- `lib/guides/interests.ts` construit une synthèse dédupliquée des guides connus. Une resoumission identique ne crée pas un deuxième guide.
- Le contexte est inclus dans l’alerte HOT existante : nombre de guides, titres, dernière ressource et thèmes d’intérêt. Aucune notification supplémentaire et aucun changement des règles marketing ou du score.
- Un rapport en lecture seule est disponible : `npx tsx --tsconfig tsconfig.json scripts/brevo/report-multi-guides.ts`. Un export privé facultatif contient les IDs, jamais les emails/téléphones. Ne pas versionner cet export.
- Correction du défaut de configuration : les huit guides non pilotes partageaient `guide-generique-v1`, donc les mêmes clés d’envoi pour un contact le même jour. Ils possèdent désormais chacun une identité de séquence distincte, tout en réutilisant les modèles #37–38 et le workflow n8n commun. L’ancienne identité reste définie pour les inscriptions signées en cours. Ne pas rejouer ces anciennes inscriptions sous une nouvelle identité.

## Limites explicites de cette première correction

Les listes ne fournissent pas les dates de chaque demande : ne pas annoncer « trois guides en sept jours » sur cette seule base. Une demande n’est ni un téléchargement ni une lecture. Les captures QA sans liste ne permettent de retrouver que la dernière ressource sans un journal complémentaire.

Aucun bonus de score n’est activé pour la simple appartenance à plusieurs anciennes listes. Le prospect ne devient pas automatiquement HOT pour ce seul motif, et une opposition n’est jamais levée.

## À raccorder avant une exploitation complète

1. Journal horodaté par contact × guide × événement : demande validée, envoi, clic fiable. Conservation de l’attribution LinkedIn de chaque nouvelle demande, sans écraser le first touch.
2. Champs de synthèse filtrables Brevo : nombre de guides distincts, guides associés, dernière demande ; fenêtre de récence uniquement pour les événements réellement datés.
3. Réconciliation des événements concurrents et des synthèses ; ne pas faire un simple compteur +1 ni une union de listes en mémoire non atomique.
4. Priorité commerciale combinant multi-guides récents, clics, besoin, horizon et absence de prise en charge. Présenter un contexte concret au commercial, pas un simple score opaque.
5. Limite de fréquence des relances : chaque guide demandé est livré, mais plusieurs demandes rapprochées ne doivent pas multiplier les sollicitations commerciales. Préférer une relance consolidée portant sur le dernier besoin. Les workflows Brevo historiques doivent être pris en compte pendant la transition.

## Bloquants de robustesse à traiter avant bascule des huit guides

- `GUIDE_DELIVERY_REF` et `GUIDE_DELIVERY_STATUS` sont un emplacement unique par contact. Deux guides en attente peuvent s’écraser si les traitements différés échouent ou se croisent. Il faut une file durable par ressource, ou un stockage offrant une isolation équivalente, avant de qualifier le parcours multi-guides comme entièrement fiable.
- Le repli des opposants sur les automations historiques utilise encore l’ancienne séquence générique. Ne pas prétendre que les nouvelles identités corrigent ce chemin tant que ce repli n’est pas adapté.
- Les HTML validés sont fusionnés dans GitHub mais doivent encore être publiés dans Brevo. L’accès d’édition du navigateur doit être reconnecté.

## Recette exigée

Même email + guide A + guide B le même jour : un contact, deux bonnes ressources, deux livraisons distinctes. Même guide soumis cinq fois : une ressource et pas de doublon d’envoi. Deux soumissions concurrentes : aucun guide perdu, y compris si l’un des envois échoue. Désabonnement après A puis demande B : B reste accessible/livré, aucune relance marketing. Plusieurs thèmes : enrichir les intérêts, pas réécrire arbitrairement le métier. Anciennes listes : conserver les faits mais ne pas inventer de date.

Cette branche est une première correction testable. Elle n’active aucune bascule de guide, ne publie aucun email Brevo et ne modifie aucun contact historique.
