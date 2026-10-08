# Audit — landing pages Althoce (8 octobre 2026)

Audit réalisé avant la refonte acquisition / nurturing / qualification Brevo.
État Brevo lu en direct le 08/10/2026 (lecture seule).

## 1. Architecture trouvée

| Élément | Constat |
| --- | --- |
| Framework | Next.js 15.5 (App Router), React 19, TypeScript strict, Tailwind 3. Déployé sur Vercel (`guide-gratuit-pi.vercel.app`), repo GitHub `espoir-star/capture-leads`. |
| Routes | `/` → redirection althoce.com · `/r/[slug]` (capture, SSG) · `/r/[slug]/merci` (noindex, accès direct + CTA Cal.com) · `POST /api/lead` · 404 personnalisée. |
| Pages de capture | 9 ressources dans `lib/ressources.ts` (contenu + `brevoListId`), deux gabarits : `modal` (8) et `page` (Meta Ads). |
| Composants partagés | `CaptureForm` (formulaire unique de toutes les pages), `AnalyticsConsent` (case GA4 facultative + pied de page), `GoogleAnalytics`. |
| Formulaire | Prénom, Nom, Email, Téléphone (sélecteur d'indicatif) + honeypot `website`. |
| Envoi Brevo | `/api/lead` côté serveur : `POST /v3/contacts` avec `updateEnabled`, liste = `brevoListId` de la ressource (résolu côté serveur par slug), attributs PRENOM, NOM, SMS, RESSOURCE, SOURCE_INSCRIPTION, DATE_OPTIN, UTM_SOURCE/MEDIUM/CAMPAIGN. Repli `TEL_DOUBLON` si Brevo refuse le SMS. |
| Variables d'env. | `BREVO_API_KEY` (serveur), `NEXT_PUBLIC_GA_MEASUREMENT_ID`. |
| Tracking | GA4 après consentement (`lib/analytics.ts`, testé par `scripts/test-analytics.mjs`). **Meta Pixel chargé sans consentement** dans `app/layout.tsx` (cookie `_fbp`). Aucun tracker Brevo. |
| UTM | 3 UTM lus dans l'URL au moment de la soumission, écrasés à chaque nouvelle soumission (pas de first touch, pas d'`utm_content`). |
| Consentement | Mention d'information sous le formulaire (intérêt légitime B2B), case cookies GA facultative, `localStorage` `althoce-analytics-consent`. `OPT_IN` jamais renseigné. |
| Anti-bot | Honeypot + rate limiting mémoire 5 req/min/IP. Pas de Turnstile. |
| Responsive | Correct (mobile-first Tailwind, typographie resserrée sur mobile). |
| Lint / tests | `next lint` sans configuration ESLint ; un seul test (GA4). |

### Correspondance pages → listes Brevo (vérifiée dans le compte)

| Slug | Liste | Contacts |
| --- | --- | --- |
| 12-cas-usage-experts-comptables | 10 · LM - 12 cas d'usage experts-comptables | 465 |
| guide-claude-pennylane | 6 · LM - Guide Claude Pennylane | 397 |
| guide-claude-meta-ads | 7 · LM - Guide Claude Meta Ads | 1 |
| copilot-8-cas-usage | 11 · LM - Guide Copilot 8 cas d'usage | 15 |
| claude-droit-10-cas-usage | 12 · LM - Guide Claude Droit | 154 |
| 12-skills-claude-finance | 13 · LM - 12 skills Claude finance | 421 |
| claude-data-gouv-20-prompts | 14 · LM - Claude data.gouv | 204 |
| 12-agents-ia-direction-financiere | 15 · LM - 12 agents IA direction financiere | 147 |
| 7-chantiers-ia-cabinet | 16 · LM - 7 chantiers IA cabinet | 56 |

Autres listes : 17 « Suivi commercial — septembre 2026 » (955, import commercial), 8 `identified_contacts` (créée par Brevo, vide), 2 et 4 (techniques).

### État Brevo

- 1 743 contacts, 1 blocklisté, 4 hors listes LM. Aucun segment.
- Attributs en type texte (sauf `OPT_IN` booléen, `DOUBLE_OPT-IN` catégorie Brevo).
- Taux de remplissage : SMS 1 515 · TEL_DOUBLON **232** · UTM_* **0** · OPT_IN **0** · ENTREPRISE 224 · STATUT_APPEL 904 · NOM_SETTER 713 · ETAPE_COMMERCIALE 10.
- Attributs commerciaux existants : STATUT_APPEL (À appeler, À rappeler, Ne plus appeler, Contacté, RDV planifié…), ETAPE_COMMERCIALE (Négociation, Devis envoyé, R2…), ETAT_RDV, TYPE_RDV, DATE_RDV_SOURCE, NOM_SETTER, LOT_ACQUISITION, SUIVI_A_VERIFIER, NOTE_APPEL, DATE_APPEL.
- Aucun des 10 nouveaux attributs n'existait ; aucun doublon anglais (FIRSTNAME, COMPANY, PHONE…).

## 2. Ancien système de filtrage (sept. 2026)

### Ce qu'il faisait

| Fichier | Rôle |
| --- | --- |
| `lib/validationEmail.ts` | 26 domaines jetables en dur (`domaineJetable`, rejet bloquant) + suggestion de typo côté client (`suggestionEmail`, non bloquante). |
| `lib/validationTel.ts` | `construireE164` (client) : indicatif + saisie sans le 0 initial ; `formatE164Valide` : regex générique 8–15 chiffres ; `numeroSuspect` : liste noire de 8 numéros, rejet de 4 chiffres identiques consécutifs ou d'une suite de 4 chiffres ; `partieLocale`. |
| `app/api/lead/route.ts` | Regex email minimale `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, contrôle prénom/nom 2–60, rejet jetable, rejet téléphone, journalisation `journaliser()` avec la **valeur saisie en clair**. |
| `components/CaptureForm.tsx` | Appelle `construireE164` et `suggestionEmail`. |

Dépendances : `CaptureForm` → `construireE164`, `suggestionEmail` ; route → `domaineJetable`, `formatE164Valide`, `numeroSuspect`, `partieLocale`. Aucun autre consommateur.

### Ses limites, mesurées sur la base réelle

- **Aucune vérification de domaine** : 22 contacts ont un email impossible (`.fe`, `.col`, `gmail.comd`, `orange.fe`, `test@test.com`, domaines sans MX).
- **Liste jetable trop courte** : 13 contacts sur des services jetables non listés (robustq.com, hebase.com…), 2 yopmail antérieurs.
- **Faux positifs téléphone** : toute suite de 4 chiffres ou 4 chiffres identiques était refusée (06 81 23 45 90 contient « 12345 », 01 42 00 00 12 contient « 0000 ») — de vrais prospects bloqués.
- **Bug d'indicatif** : le 0 initial était retiré pour tous les pays ; or il fait partie du numéro en Côte d'Ivoire (+225 07…) et pour les fixes italiens → numéros invalides.
- **DOM-TOM** : un 0692… saisi avec +33 devenait +33692…, refusé par Brevo → relégué dans `TEL_DOUBLON` (une partie des 232).
- Logs contenant emails et téléphones en clair.

## 3. Ce qui a été supprimé / conservé

| Élément | Décision |
| --- | --- |
| `lib/validationTel.ts` (4 fonctions) | **Supprimé**. Remplacé par `lib/data-quality/phone.ts` (libphonenumber-js, statuts VALID_FORMAT / SUSPECT / INVALID). |
| `DOMAINES_JETABLES` / `domaineJetable` | **Supprimé** du module client. Les 26 domaines sont **repris** dans `scripts/data-quality/update-disposable-domains.ts` (EXTRA) et fusionnés avec la liste communautaire (9 225 domaines) dans `lib/data-quality/disposable-domains.json`, vérifiée côté serveur uniquement. |
| `suggestionEmail` (typos) | **Conservé tel quel**, déplacé dans `lib/validation/emailSuggestion.ts` (aide de saisie, jamais bloquante). |
| Regex email, `nettoyer()`, contrôles prénom/nom | **Remplacés** par `lib/validation/leadSchema.ts` (Zod) + `lib/validation/email.ts` + `lib/data-quality/email.ts` (DNS/MX). |
| Honeypot `website` | **Conservé** (même champ, même comportement : succès factice). |
| Rate limiting mémoire | **Conservé et généralisé** (`lib/security/rateLimit.ts` : 6/min + 30/h par IP). |
| `journaliser()` | **Conservé** (`lib/lead/log.ts`), valeurs désormais masquées. |
| Repli `TEL_DOUBLON` sur refus SMS Brevo | **Conservé** (contrainte d'unicité Brevo), `lib/brevo/contacts.ts`. |
| Liste `INDICATIFS` (codes d'appel) | **Remplacée** par `PHONE_COUNTRIES` (codes ISO, mêmes pays) dans `config/taxonomy.ts`. |
| `brevoListId` dans `lib/ressources.ts` | **Déplacé** dans `config/leadMagnets.ts` (mapping CRM serveur). |

Il ne reste qu'une seule chaîne de validation : schéma → email (syntaxe, factice, jetable, DNS) → téléphone (libphonenumber) → Brevo.

## 4. Finalisation avant Preview (8 octobre 2026, suite)

| Élément | Décision |
| --- | --- |
| Case « cookies + email » du formulaire | **Supprimée**. Remplacée par une case newsletter facultative, non précochée, qui ne pilote que `OPT_IN`. |
| `components/AnalyticsConsent.tsx`, clés `althoce-analytics-consent` / `althoce-marketing-consent` | **Supprimés / nettoyées**. Remplacés par la bannière `components/CookieConsent.tsx` (Tout accepter / Essentiels uniquement, `althoce_cookie_consent` versionné, ~6 mois, « Gérer mes cookies »). |
| Meta Pixel inline dans `app/layout.tsx` (chargé sans consentement) | **Retiré** du layout. Chargé uniquement après « Tout accepter » via `initializeMarketingTrackers()` (`lib/tracking/marketing.ts`). |
| Clic quelconque dans un email → `VERIFIED` (webhook) | **Retiré**. `VERIFIED` uniquement via le lien dédié `/confirmer-email` (jeton chiffré + bouton). Le webhook ne traite plus que les hard bounces, avec réponse 429 pour les reprises Brevo. |
| `LEAD_TOKEN_SECRET` | **Renommé** `SIGNING_SECRET` (jamais déployé), obligatoire en Production. |
| `scripts/test-analytics.mjs` | **Conservé** ; seul le module de consentement est simulé. |
| Garde-fou Production | **Ajouté** (`next.config.mjs`) : build Production refusé sans Brevo, Turnstile et `SIGNING_SECRET`. |
| Attribut Brevo `EMAIL_CONFIRM_TOKEN` | **Créé** (seul nouvel attribut ; les 10 autres existaient déjà). |
