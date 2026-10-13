# Nouveau guide — Claude Dashboards pour les cabinets (octobre 2026)

Statut : **page de lecture en branche, publication de la capture bloquée tant que les ressources Brevo réelles ne sont pas créées**.

## Page de lecture livrée
`/g/tableaux-de-bord-claude-cabinets` : guide court, mobile, trois prompts copiables, liens officiels et limites comptables/RGPD. Le HTML des premières maquettes a été transposé en page Next.js intégrée à la charte Althoce.

## Connexion exacte au moteur existant, SANS CRÉER DE WORKFLOW

**Ne pas fusionner / activer une page de capture sans liste et attributs Brevo réels.** Le compte ne possède actuellement que les listes Lead Magnets ID 6, 7, 10–16. Le connecteur Brevo accessible à ChatGPT propose la consultation et la création de modèles d'email, mais **pas la création de listes ni d'attributs**. Le navigateur TinyFish n'est pas opérationnel sans crédit ; Vercel retourne 403. Aucune liste ni ID ne sont inventés.

1. Dans Brevo, créer dans le dossier existant « Lead Magnets » la liste `LM - Claude Dashboards cabinets`. Récupérer son **ID réel** `L`.
2. Brevo → attributs contacts : créer trois attributs **texte** `MG_REQ_L`, `MG_SENT_L`, `MG_ENROLLED_L` ; vérifier les trois types via API GET /contacts/attributes. Remplacer `L` par son nombre effectif. Vérifier d'abord qu'ils n'existent pas.
3. Dans `config/leadMagnets.ts`, ajouter `tableaux-de-bord-claude-cabinets` avec `brevoListId: L`, `brevoListName: "LM - Claude Dashboards cabinets"`, `vertical: "FINANCE"`, `subsector: "EXPERTISE_COMPTABLE"`, `resource` identique au slug et `legacy: { automationId:0,deliveryTemplateId:0,followupTemplateIds:[] }`. Donner une **identité dédiée** `guide-claude-dashboards-cabinets-v1` dans `config/sequences.ts` (utilise `generique.delivery` et `generique.relance-j2`), plutôt que `guide-generique-v1` partagé. S'assurer que le typage et les tests tiennent.
4. Ajouter `lib/ressources.ts` avec `slug: "tableaux-de-bord-claude-cabinets"`, `urlRessource: "https://guide-gratuit-pi.vercel.app/g/tableaux-de-bord-claude-cabinets"`, `style:"modal"`, `cta:"Recevoir le guide"`, `vertical` non exposée côté client. Titre « 3 tableaux de bord Claude pour piloter votre cabinet », sous-titre « Un tutoriel de 5 minutes et trois prompts copiables, avec sources officielles et précautions sur les données clients. », pills « 3 prompts prêts à adapter », « Portefeuille, rendez-vous, secteur », « Sources vérifiables ». Le rendu utilise le composant `CaptureForm` existant et la page merci existante.
5. `config/shortLinks.ts` : pour le POST LinkedIn prévu, créer un code court distinct et `utm_content` suivant la date effective de publication ; ne pas inventer d'URL de post dans `config/sourceRegistry.ts`.
6. `ALTHOCE_SEQUENCE_GUIDES` : vérifier la valeur actuelle en prod, ajouter uniquement `tableaux-de-bord-claude-cabinets:qa` d'abord ; puis, après succès, `:sans-liste`. Ne pas enlever les 9 guides en production. `ALTHOCE_MULTI_GUIDES=on` reste inchangé si confirmé. Aucun nouveau workflow n8n et aucune automation Brevo.
7. Recette QA : formulaire complet → fiche Brevo, `MG_REQ_L` → modèle #43 livraison → `MG_SENT_L` → `MG_ENROLLED_L` → J+2 (ou accélération QA explicite) → opposition respectée et CRM selon règles actives ; répéter avec un même email ayant un ancien guide, sans doublon de prospect. Vérifier url réelle et message Gmail, pas seulement accusé d'envoi.
8. `npm run check`, CI, Preview, validation de publication, puis prod et test live avant de diffuser le lien `https://guide-gratuit-pi.vercel.app/r/tableaux-de-bord-claude-cabinets`. Ne pas publier ce lien comme actif avant le test complet.

## Sources et réserves éditoriales

- [Anthropic, 8 octobre 2026, lancement Dashboards](https://claude.com/resources/articles/dashboards-and-motion)
- [Anthropic, démarrer Claude Dashboards](https://support.claude.com/fr/articles/17454700-commencer-avec-claude-dashboards)
- [Insee, ratios annuels Ésane](https://www.insee.fr/fr/statistiques/2015421)
- [Insee, indice de production industrielle : périmètre mensuel](https://www.insee.fr/fr/metadonnees/source/indicateur/p1646/presentation)
- [CNIL, IA générative pour TPE/PME](https://www.cnil.fr/fr/utiliser-lia-generative-dans-les-tpe-et-pme)
- [Anthropic, DPA offres commerciales](https://support.claude.com/fr/articles/7996862-comment-puis-je-consulter-et-signer-votre-addendum-de-traitement-des-donnees-dpa)

Ne pas affirmer que CEGID, Pennylane ou un autre logiciel a nécessairement un connecteur natif Claude Dashboards. Ne pas inférer TVA due, impayés de 30 jours ou tension de trésorerie si les bonnes données ne sont pas accessibles. La disponibilité varie selon plan, rôles et droits d'administration.
