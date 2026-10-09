# Althoce Ressources

Pages de capture pour les lead magnets Althoce (guides Notion / artifacts Claude distribués via LinkedIn).

**Flux** : Post LinkedIn (URL trackée) → `/r/[slug]` (bannière cookies : Essentiels par défaut) → capture (prénom, nom, email, mobile, objectif IA, horizon, case newsletter facultative → OPT_IN) → validation serveur (DNS/MX, jetables, libphonenumber, Turnstile) → contact dédoublonné dans Brevo (liste dédiée + verticale + first touch + score) → automation Brevo (email #1 = ressource, puis nurture) → page merci (accès direct + CTA Cal.com).

📘 **Documentation complète : [docs/BREVO_SETUP.md](docs/BREVO_SETUP.md)** (architecture, attributs, segments, data quality, scoring, newsletter-as-code, webinars, backfill, actions manuelles) · audit de départ : [docs/AUDIT.md](docs/AUDIT.md).

---

## 1. Setup initial (une seule fois)

### a) Compte Brevo (plan gratuit)

1. Créer un compte sur brevo.com (gratuit, sans CB).
2. **Clé API** : Profil → SMTP & API → Clés API → Générer. La copier.
3. **Attributs de contact** : `npm run brevo:attributes` (dry run) puis `-- --apply` crée uniquement les attributs manquants (liste dans `config/brevoAttributes.ts`).

### b) Authentification du domaine (SPF / DKIM) — OBLIGATOIRE avant tout envoi réel

Sans ça, les emails de délivrance partent en spam et le funnel est mort.

1. Brevo : Expéditeurs, domaines et IP dédiées → Domaines → Ajouter un domaine → `contact.althoce.com`.
2. Brevo affiche des enregistrements DNS (DKIM + autres) à créer.
3. Les ajouter chez le registrar du domaine (copier-coller tel quel).
4. Attendre la validation dans Brevo (peut prendre quelques heures).
5. Créer un expéditeur type `espoir@contact.althoce.com` et l'utiliser pour tous les envois.

> ✅ Fait le 03/07/2026 : domaine `contact.althoce.com` authentifié (DKIM, DNS IONOS),
> expéditeur `espoir@contact.althoce.com` actif.
>
> Nouveau domaine d'envoi `althoce.fr` (DNS chez Cloudflare) : expéditeurs `newsletter@althoce.fr`
> et `bonjour@althoce.fr`, réponses sur `espoir@contact.althoce.com`. Procédure et état :
> [docs/BREVO_SETUP.md § 21](docs/BREVO_SETUP.md), `npm run brevo:domain`.

### c) Déploiement Vercel

1. Pousser ce repo sur GitHub.
2. Vercel → Import du repo → framework Next.js détecté automatiquement.
3. Settings → Environment Variables → voir `.env.example` (Production : `BREVO_API_KEY`, clés Turnstile et `SIGNING_SECRET` obligatoires, sinon le build échoue).
4. Deploy. Les pages sont sur `https://<projet>.vercel.app/r/<slug>`.

---

## 2. Créer une nouvelle ressource (le workflow récurrent)

### Étape 1 — Liste Brevo

Contacts → Listes → Créer une liste, ex. `LM - Guide Meta Ads`.
Noter l'**ID de la liste** (visible dans l'URL ou la colonne ID).

### Étape 2 — Contenu + mapping CRM

a) Ajouter le contenu de la page dans `lib/ressources.ts` (copier un existant) :

```ts
"guide-meta-ads": {
  slug: "guide-meta-ads",
  badge: "GUIDE GRATUIT",
  titre: "Piloter vos <accent>Meta Ads</accent> avec Claude",
  sousTitre: "Pour qui + ce que ça contient, concret.",
  pills: ["Fait vérifié 1", "Fait vérifié 2", "Fait vérifié 3"],
  urlRessource: "https://notion.so/...",
  style: "modal", // ou "page"
  cta: "Recevoir le guide",
},
```

b) Ajouter le mapping CRM dans `config/leadMagnets.ts` : `brevoListId` (l'ID noté à l'étape 1), `vertical`, `subsector` (`null` + TODO si ambigu, ne jamais deviner).

c) `npm test` vérifie que la page et son mapping existent tous les deux.

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

Vercel déploie. Générer le lien du post **avec UTM** (dont `utm_content` = identifiant du post) :

```bash
npm run utm -- --slug guide-claude-meta-ads --code MKT --date 20261008 --n 1 --campaign guide_meta_ads
```

Le first touch (source, campagne, post) est stocké sur le contact Brevo et
n'est jamais écrasé → tu sais quel post génère quels leads. Ajouter ensuite
l'URL du post dans `config/sourceRegistry.ts`.

### (Optionnel) Image de partage LinkedIn

Ajouter une image 1200×630 dans `public/covers/` et renseigner
`cover: "/covers/mon-image.png"` dans le bloc. Sans cover, la preview
LinkedIn reste correcte (titre + description) mais sans visuel.

---

## 3. Détails techniques

- **Anti-bot** : honeypot `website` (succès factice), rate limiting par IP, Cloudflare Turnstile vérifié côté serveur.
- **Email** : syntaxe, valeurs factices, 9 225 domaines jetables, DNS/MX — sans service payant. Suggestion de typo côté client.
- **Téléphone** : libphonenumber-js côté serveur (E.164, repli DOM-TOM) → `PHONE_STATUS` VALID_FORMAT / SUSPECT / INVALID. Numéro déjà porté par un autre contact Brevo → lead gardé, numéro dans `TEL_DOUBLON`.
- **Newsletter** : case facultative non précochée → `OPT_IN` (jamais forcé, jamais lié aux cookies).
- **Cookies** : bannière Tout accepter / Essentiels uniquement ; GA4, Meta Pixel et tracker Brevo chargés seulement après « Tout accepter » ; « Gérer mes cookies » en pied de page.
- **La clé Brevo ne transite jamais côté navigateur** : `/api/lead` appelle Brevo côté serveur (`server-only`). La liste Brevo est déduite du slug côté serveur.
- **`/r/[slug]/merci`** est en `noindex` (pas de fuite du lien ressource via Google).
- **Qualité** : `npm run check` (lint, typecheck, tests, build) ; `npm run test:e2e` (scénarios complets sur faux Brevo).

## 4. Plus tard (hors v1)

- Domaine custom `ressources.althoce.com` (Vercel → Domains, un CNAME).
- n8n en aval de Brevo : enrichissement LinkedIn des leads chauds (voir docs/BREVO_SETUP.md § 14), validation humaine avant envoi.
- A/B test `style: "modal"` vs `style: "page"` sur une même ressource.
