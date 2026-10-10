# Publier un nouveau guide

Objectif : une page de capture, la livraison par email, la segmentation, la relance J+2 et le suivi, **sans nouveau workflow** (n8n ni Brevo). Compter 20 à 30 minutes.

## 1. Contenu de la page — `lib/ressources.ts`

Ajouter un bloc (copier un existant) : `slug`, `titre`, `sousTitre`, `pills` ou `points`, **`urlRessource`** (lien du guide, utilisé aussi dans les emails), `resourceCard.titre` (titre court repris dans les emails), `style`, `cover` (optionnel).

Règle : chaque affirmation factuelle est vérifiée avant la mise en ligne.

## 2. Liste Brevo

Brevo → Contacts → Listes → dossier « Lead Magnets » → Créer « LM - <titre> ». Noter son ID. **Ne pas créer d'automation** : le moteur livre et relance.

## 3. Mapping CRM et séquence — `config/leadMagnets.ts`

```ts
"mon-nouveau-guide": {
  slug: "mon-nouveau-guide",
  resource: "mon-nouveau-guide",
  brevoListId: 19,                      // ID réel de l'étape 2
  brevoListName: "LM - Mon nouveau guide",
  vertical: "FINANCE",                  // null + note TODO si ambigu (jamais deviner)
  subsector: "DAF_FINANCE",             // idem
  note: "Pourquoi cette verticale",
  sequence: "guide-generique-v1",       // modèles génériques : rien d'autre à faire
  legacy: { automationId: 0, deliveryTemplateId: 0, followupTemplateIds: [] }, // aucune automation historique
},
```

La verticale pilote la segmentation newsletter et le statut `B2B_ELIGIBLE` (un guide sans verticale donne `TO_REVIEW`).

### Emails personnalisés (optionnel)

Par défaut, les modèles génériques (#37 livraison, #38 relance J+2, vouvoiement) reprennent `resourceCard.titre` et `urlRessource`. Pour un texte propre au guide :

1. Créer `emails/sequences/<guide>/delivery.html` et `relance-j2.html` (partir de `emails/sequences/generique/`). Garder `{{ params.UNSUBSCRIBE_URL }}` et `{% if params.CONFIRM_URL %}…{% endif %}` ; **jamais `{{ unsubscribe }}`**.
2. Les déclarer dans `config/emailTemplates.ts` (`id: null`) et une séquence dans `config/sequences.ts` (copier `guide-12-cas-ec-v1`).
3. `npm run brevo:templates` (aperçu) puis `npm run brevo:templates -- --apply` ; recopier les IDs affichés.

## 4. Vérifier et publier

```bash
npm run check
```

(`npm test` vérifie que chaque page a son mapping, que chaque séquence existe et que ses modèles ont un ID réel.)

Pousser la branche, vérifier la Preview, fusionner.

## 5. Activer la séquence

Vercel → Environment Variables (Production) → `ALTHOCE_SEQUENCE_GUIDES` : ajouter le slug (séparé par une virgule) → Redeploy.

Option prudente : d'abord `mon-nouveau-guide:qa` avec une adresse QA dans `ALTHOCE_SEQUENCE_QA_EMAILS`, puis retirer `:qa`.

Sans cette étape, la page fonctionne (contact, liste, guide affiché sur la page merci) mais **aucun email n'est envoyé** : un nouveau guide n'a pas d'automation Brevo.

## 6. Diffuser

```bash
npm run utm -- --slug mon-nouveau-guide --post <id-du-post>
```

Le lien tracé alimente les UTM, le first touch et le registre des posts (`config/sourceRegistry.ts`).

## Récapitulatif de ce que vous obtenez automatiquement

| Étape | Qui |
| --- | --- |
| Capture, validation email/téléphone, anti-bot, UTM, score | Vercel |
| Contact + liste + verticale + statut marketing | Brevo (via Vercel) |
| Guide par email (immédiat, même si n8n est arrêté) | Vercel → Brevo transactionnel |
| Relance J+2 (si éligible, non désinscrit, pas en cycle commercial) | n8n (workflow générique) → Vercel |
| Newsletter métier | segments Brevo `NEWSLETTER — …` |
| Lead chaud | segment `LEADS — HOT` |
