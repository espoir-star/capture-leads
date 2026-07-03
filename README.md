# Althoce Ressources

Pages de capture pour les lead magnets Althoce (guides Notion / artifacts Claude distribués via LinkedIn).

**Flux** : Post LinkedIn → lien 1er commentaire → `/r/[slug]` → capture (prénom + email + mobile) → contact poussé dans Brevo (liste dédiée + attributs) → automation Brevo (email #1 = ressource + P.S. call, puis nurture) → page merci (accès direct + CTA Cal.com).

---

## 1. Setup initial (une seule fois)

### a) Compte Brevo (plan gratuit)

1. Créer un compte sur brevo.com (gratuit, sans CB).
2. **Clé API** : Profil → SMTP & API → Clés API → Générer. La copier.
3. **Attributs de contact** : Contacts → Paramètres → Attributs de contact → créer (type Texte) :
   - `RESSOURCE`, `SOURCE_INSCRIPTION`, `DATE_OPTIN`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `TEL_DOUBLON`
   - `PRENOM` et `SMS` existent déjà par défaut.

### b) Authentification du domaine (SPF / DKIM) — OBLIGATOIRE avant tout envoi réel

Sans ça, les emails de délivrance partent en spam et le funnel est mort.

1. Brevo : Expéditeurs, domaines et IP dédiées → Domaines → Ajouter un domaine → `contact.althoce.com`.
2. Brevo affiche des enregistrements DNS (DKIM + autres) à créer.
3. Les ajouter chez le registrar du domaine (copier-coller tel quel).
4. Attendre la validation dans Brevo (peut prendre quelques heures).
5. Créer un expéditeur type `espoir@contact.althoce.com` et l'utiliser pour tous les envois.

> ✅ Fait le 03/07/2026 : domaine `contact.althoce.com` authentifié (DKIM, DNS IONOS),
> expéditeur `espoir@contact.althoce.com` actif.

### c) Déploiement Vercel

1. Pousser ce repo sur GitHub.
2. Vercel → Import du repo → framework Next.js détecté automatiquement.
3. Settings → Environment Variables → `BREVO_API_KEY` = ta clé.
4. Deploy. Les pages sont sur `https://<projet>.vercel.app/r/<slug>`.

---

## 2. Créer une nouvelle ressource (le workflow récurrent)

### Étape 1 — Liste Brevo

Contacts → Listes → Créer une liste, ex. `LM - Guide Meta Ads`.
Noter l'**ID de la liste** (visible dans l'URL ou la colonne ID).

### Étape 2 — Bloc de config

Ajouter un bloc dans `lib/ressources.ts` (copier un existant) :

```ts
"guide-meta-ads": {
  slug: "guide-meta-ads",
  badge: "GUIDE GRATUIT",
  titre: "Piloter vos <accent>Meta Ads</accent> avec Claude",
  sousTitre: "Pour qui + ce que ça contient, concret.",
  pills: ["Fait vérifié 1", "Fait vérifié 2", "Fait vérifié 3"],
  urlRessource: "https://notion.so/...",
  brevoListId: 12, // l'ID noté à l'étape 1
  style: "modal", // ou "page"
  cta: "Recevoir le guide",
},
```

> ⚠️ **RÈGLE ABSOLUE** : chaque affirmation factuelle (chiffres, noms d'outils,
> méthodes, fonctionnalités) doit être **vérifiée** avant mise en ligne.
> Aucune extrapolation. Les prospects testent et détectent toute imprécision.

### Étape 3 — Automation Brevo

Automations → Créer un workflow personnalisé :

1. **Déclencheur** : « Un contact est ajouté à une liste » → sélectionner la liste de l'étape 1.
2. **Action 1** : Envoyer un email → coller le template `emails/email-1-delivrance.html`
   en remplaçant `[URL_RESSOURCE]` et `[NOM_RESSOURCE]`. Envoi immédiat.
3. **Actions suivantes (nurture)** : Attendre 2 jours → email valeur #2,
   attendre 3 jours → email #3 (cas client / CTA call), etc.
4. Activer le workflow.

### Étape 4 — Push et diffusion

```bash
git add . && git commit -m "ressource: guide-meta-ads" && git push
```

Vercel déploie. Lien à coller en 1er commentaire LinkedIn **avec UTM** :

```
https://<projet>.vercel.app/r/guide-meta-ads?utm_source=linkedin&utm_medium=organic&utm_campaign=post-meta-ads-0207
```

Les UTM sont capturés automatiquement et stockés sur le contact Brevo →
tu sais quel post génère quels leads.

### (Optionnel) Image de partage LinkedIn

Ajouter une image 1200×630 dans `public/covers/` et renseigner
`cover: "/covers/mon-image.png"` dans le bloc. Sans cover, la preview
LinkedIn reste correcte (titre + description) mais sans visuel.

---

## 3. Détails techniques

- **Honeypot anti-bot** : champ caché `website` ; s'il est rempli, l'API répond OK sans rien enregistrer.
- **Téléphone** : normalisé côté client en `+336…`/`+337…`, re-validé côté serveur. Si le numéro existe déjà sur un autre contact Brevo (erreur `duplicate_parameter`), le contact est quand même créé et le numéro stocké dans `TEL_DOUBLON`.
- **Consentement** : ligne d'information sous le formulaire (prospection B2B = intérêt légitime, pas de case requise). `DATE_OPTIN` + `SOURCE_INSCRIPTION` stockés comme preuve.
- **La clé Brevo ne transite jamais côté navigateur** : le formulaire poste sur `/api/lead`, qui appelle Brevo côté serveur.
- **`/r/[slug]/merci`** est en `noindex` (pas de fuite du lien ressource via Google).

## 4. Plus tard (hors v1)

- Domaine custom `ressources.althoce.fr` (Vercel → Domains, un CNAME).
- n8n en aval de Brevo : export des mobiles opt-in vers le pipeline cold call (Kaspr / Lemlist), validation humaine avant envoi.
- A/B test `style: "modal"` vs `style: "page"` sur une même ressource.
