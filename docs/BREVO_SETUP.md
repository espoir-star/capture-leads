# Althoce × Brevo — acquisition, nurturing, qualification

Référence technique et opérationnelle. Audit de départ : [AUDIT.md](AUDIT.md). Textes de politique de confidentialité à reprendre : [POLITIQUE_CONFIDENTIALITE.md](POLITIQUE_CONFIDENTIALITE.md).

**Rôles** : Vercel / Next.js = expérience utilisateur · Brevo = CRM, newsletter, segments, scoring, automations · n8n = automatisations avancées (futur) · commercial = validation humaine finale. Les landing pages ne sont pas reconstruites dans Brevo.

---

## 1. Architecture

```
Post LinkedIn ── URL trackée (utm_source / medium / campaign / content)
      ↓
Landing /r/[slug] ── first touch mémorisé 90 j (localStorage, sans donnée personnelle)
      │             bannière cookies : ESSENTIAL par défaut, traceurs seulement après « Tout accepter »
      ↓
Formulaire (prénom, nom, email, mobile, objectif IA, horizon + case newsletter facultative)
      ↓
POST /api/lead (serveur) : rate limit → honeypot → schéma Zod → Turnstile
      → email (syntaxe, factice, jetable, capacité de réception) → téléphone (libphonenumber)
      → slug → config serveur → liste Brevo + verticale (jamais choisie par le navigateur)
      → lecture du contact (dédoublonnage email) → fusion → upsert + ajout à la liste
      → réponse OK → page merci (guide accessible immédiatement)
      → après la réponse : événement lead_magnet_submitted
      ↓
Brevo : LISTE = provenance · ATTRIBUTS = profil · ÉVÉNEMENTS = comportement · SEGMENTS = audience
      ↓
Email de bienvenue (automation par liste) ── lien « Confirmer mon adresse » → EMAIL_STATUS = VERIFIED
Newsletter (campagnes, OPT_IN = true) · Webinars · Site althoce.com
      ↓
LEAD_SCORE → segment LEADS — HOT → (futur) n8n enrichissement LinkedIn → commercial → appel → RDV
```

| Dossier | Contenu |
| --- | --- |
| `config/` | `leadMagnets.ts` (slug → liste/verticale), `taxonomy.ts`, `brevoAttributes.ts`, `sourceRegistry.ts`, `newsletter.ts` (segments, audiences, tags), `webinars.ts` |
| `lib/brevo/` | `api.ts`, `contacts.ts`, `events.ts`, `segments.ts`, `webhook.ts`, `server.ts` (garde `server-only`) |
| `lib/validation/` | `leadSchema.ts` (Zod), `email.ts`, `emailSuggestion.ts` |
| `lib/data-quality/` | `email.ts`, `phone.ts`, `disposableDomains.ts` + `disposable-domains.json` |
| `lib/tracking/` | `consent.ts`, `marketing.ts` (`initializeMarketingTrackers`), `utm.ts`, `firstTouch.ts`, `brevoTracker.ts`, `metaPixel.ts` (+ `lib/analytics.ts` pour GA4) |
| `lib/security/` | `turnstile.ts`, `rateLimit.ts`, `leadToken.ts`, `emailConfirm.ts`, `secret.ts` |
| `lib/lead/` | `capture.ts` (pipeline), `contactUpdate.ts` (règles de fusion), `log.ts` |
| `lib/scoring/`, `lib/backfill/`, `lib/newsletter/` | scoring, plan de backfill, rendu newsletter |
| `components/` | `CaptureForm`, `CookieConsent` (bannière + « Gérer mes cookies »), `Turnstile`, `GuideLink`, `ConfirmEmail`, `GoogleAnalytics` |
| `app/` | `/r/[slug]`, `/r/[slug]/merci`, `/w/[slug]`, `/confirmer-email`, API `lead`, `events`, `email/confirm`, `webhooks/brevo` |
| `scripts/` | `brevo/*` (attributs, segments, webhooks, backfill, smoke test, suppression du contact de test), `newsletter/campaign.ts`, `tracking/build-url.ts`, `data-quality/update-disposable-domains.ts` |

---

## 2. Variables d'environnement

| Variable | Où | Production | Rôle |
| --- | --- | --- | --- |
| `BREVO_API_KEY` | serveur | **obligatoire** | API Brevo v3. Jamais exposée au navigateur. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | navigateur | **obligatoire** | Clé publique Turnstile. |
| `TURNSTILE_SECRET_KEY` | serveur | **obligatoire** | Secret Turnstile (toujours avec la clé publique). |
| `SIGNING_SECRET` | serveur | **obligatoire** | Signe le jeton « guide ouvert », chiffre les liens de confirmation. Stable : le changer invalide les liens déjà envoyés. |
| `BREVO_WEBHOOK_SECRET` | serveur | recommandé | Active `/api/webhooks/brevo` (hard bounce). |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | navigateur | optionnel | GA4 (défaut du code si non définie, désactivé si vide). |
| `NEXT_PUBLIC_META_PIXEL_ID` | navigateur | optionnel | Meta Pixel (défaut du code si non définie, désactivé si vide). |
| `NEXT_PUBLIC_BREVO_CLIENT_KEY` | navigateur | optionnel | Tracker Brevo (désactivé si vide). |
| `BREVO_API_BASE_URL` | tests | **interdite** | Faux Brevo local. |

**Garde-fou** (`next.config.mjs`) : un build Vercel **Production** échoue si `BREVO_API_KEY`, les deux clés Turnstile ou `SIGNING_SECRET` manquent, ou si `BREVO_API_BASE_URL` est définie. La version en ligne reste alors inchangée. Preview / local : non bloquant.

Modèle sans secret : `.env.example`.

---

## 3. Attributs Brevo

### Existants réutilisés (aucun doublon)

`NOM`, `PRENOM`, `SMS`, `ENTREPRISE`, `JOB_TITLE`, `LINKEDIN`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `SOURCE_INSCRIPTION`, `RESSOURCE`, `DATE_OPTIN`, `OPT_IN` (booléen), `TEL_DOUBLON`. Les attributs commerciaux (`STATUT_APPEL`, `ETAPE_COMMERCIALE`, `ETAT_RDV`, `NOM_SETTER`…) ne sont jamais modifiés par le site.

### Créés pour cette architecture (`npm run brevo:attributes`, dry run puis `--apply`)

| Attribut | Type | Valeurs |
| --- | --- | --- |
| `VERTICAL` | texte | FINANCE, MARKETING, SALES, RH, CUSTOMER_CARE, LEGAL, GENERAL |
| `SUBSECTOR` | texte | EXPERTISE_COMPTABLE, AUDIT_CAC, DAF_FINANCE, PRIVATE_EQUITY_VC, BANQUE, ASSURANCE, M_AND_A, ASSET_MANAGEMENT, ECOMMERCE, AGENCE_MARKETING (extensible : `config/taxonomy.ts`) |
| `BESOIN_PRIORITAIRE` | texte | AUTOMATISER_PROCESS, DEPLOYER_AGENT_IA, FORMER_EQUIPES, DIAGNOSTIC_STRATEGIE, VEILLE_IA, AUTRE |
| `HORIZON_PROJET` | texte | IMMEDIAT, MOINS_3_MOIS, TROIS_SIX_MOIS, SIX_DOUZE_MOIS, PAS_DE_PROJET |
| `UTM_CONTENT` | texte | identifiant du post, ex. `LI_EC_20261008_01` |
| `SOURCE_CONTENT_URL` | texte | URL du post si connue |
| `LIFECYCLE_STAGE` | texte | SUBSCRIBER, LEAD, MQL, HOT_LEAD, CONTACTED, MEETING_BOOKED, OPPORTUNITY, CLIENT, LOST |
| `LEAD_SCORE` | nombre | score d'intention |
| `EMAIL_STATUS` | texte | PENDING, VERIFIED, INVALID, DISPOSABLE, BOUNCED |
| `PHONE_STATUS` | texte | VALID_FORMAT, SUSPECT, INVALID, VERIFIED |
| `EMAIL_CONFIRM_TOKEN` | texte | jeton chiffré du lien « Confirmer mon adresse » |

Tous créés le 08/10/2026 ; le script ne crée que les attributs manquants, jamais de doublon.

### Écriture à chaque soumission

| Attribut | Règle |
| --- | --- |
| PRENOM, NOM | dernière saisie |
| SMS | numéro E.164 ; si Brevo le refuse (déjà porté par un autre contact) → `TEL_DOUBLON` |
| RESSOURCE | dernier guide demandé (l'historique est dans les listes) |
| SOURCE_INSCRIPTION (`page-capture`), DATE_OPTIN | seulement si vides |
| VERTICAL, SUBSECTOR | depuis la config, seulement si vides (ou VERTICAL = GENERAL) |
| BESOIN_PRIORITAIRE, HORIZON_PROJET | dernière déclaration |
| UTM_*, SOURCE_CONTENT_URL | first touch : écrits **uniquement si aucun UTM n'existe** |
| OPT_IN | case newsletter cochée → `true` ; non cochée → `false`, sauf si le contact avait déjà `true` (ne pas cocher n'est pas se désinscrire) |
| EMAIL_STATUS | `PENDING` (VERIFIED et BOUNCED conservés) — jamais VERIFIED depuis le formulaire |
| EMAIL_CONFIRM_TOKEN | écrit s'il est vide (lien stable) |
| PHONE_STATUS | statut du numéro **réellement stocké dans SMS** ; vide si aucun SMS |
| LEAD_SCORE | `max(existant, score formulaire)` |
| LIFECYCLE_STAGE | LEAD à la création, jamais rétrogradé |

---

## 4. Listes et mapping des lead magnets

Listes existantes conservées (aucune suppression ni renommage). Principe : **LISTE** = provenance · **ATTRIBUTS** = profil · **ÉVÉNEMENTS** = comportement · **SEGMENTS** = audience dynamique.

Source de vérité : `config/leadMagnets.ts`. Le navigateur n'envoie que le slug ; `npm test` vérifie que chaque page a son entrée.

| Page `/r/…` | Liste | VERTICAL | SUBSECTOR | Statut |
| --- | --- | --- | --- | --- |
| 12-cas-usage-experts-comptables | 10 | FINANCE | EXPERTISE_COMPTABLE | pilote |
| guide-claude-pennylane | 6 | FINANCE | EXPERTISE_COMPTABLE | sous-titre « experts-comptables et cabinets » |
| 12-agents-ia-direction-financiere | 15 | FINANCE | DAF_FINANCE | « direction financière » |
| copilot-8-cas-usage | 11 | GENERAL | — | guide sans cible métier |
| guide-claude-meta-ads | 7 | MARKETING | **TODO** | PME + agences : sous-secteur non prouvé |
| claude-droit-10-cas-usage | 12 | LEGAL | **TODO** | avocats / juristes mélangés |
| 12-skills-claude-finance | 13 | FINANCE | **TODO** | cabinet ou DAF |
| claude-data-gouv-20-prompts | 14 | **TODO** | **TODO** | aucune cible explicite |
| 7-chantiers-ia-cabinet | 16 | **TODO** | **TODO** | « cabinet » ambigu |

Arbitrer un TODO = renseigner la valeur dans `config/leadMagnets.ts` (preuve à l'appui), puis relancer le backfill en dry run.

**Nouvelle ressource** : contenu dans `lib/ressources.ts` + liste Brevo `LM - …` + entrée `config/leadMagnets.ts` + `npm test`.

---

## 5. Segments (création manuelle)

L'API officielle Brevo permet seulement de **lire** les segments (`GET /v3/contacts/segments`) : aucune création par API. Étapes :

1. Brevo → **Contacts** → **Segments** → **Créer un segment**.
2. Nom : **exactement** celui du tableau (les scripts le retrouvent par ce nom).
3. Conditions : *Attributs du contact* → attribut → opérateur → valeur ; combiner avec **ET** / **OU** comme indiqué.
4. Enregistrer.
5. `npm run brevo:segments` → affiche l'ID réel de chaque segment trouvé → le recopier dans `config/newsletter.ts` (`SEGMENTS.<clé>.id`). Tant que l'ID n'est pas recopié, les scripts résolvent par le nom exact et refusent si le segment est introuvable : aucun ID fictif.

| Nom exact | Conditions |
| --- | --- |
| FINANCE — ALL | VERTICAL = FINANCE |
| FINANCE — EXPERTISE COMPTABLE | VERTICAL = FINANCE **ET** SUBSECTOR = EXPERTISE_COMPTABLE |
| FINANCE — DAF | VERTICAL = FINANCE **ET** SUBSECTOR = DAF_FINANCE |
| DATA QUALITY — REVIEW | EMAIL_STATUS = PENDING **OU** PHONE_STATUS = SUSPECT |
| DATA QUALITY — REJECTED | EMAIL_STATUS = INVALID **OU** = DISPOSABLE **OU** = BOUNCED |
| LEADS — HOT | LEAD_SCORE ≥ 25 **ET** LIFECYCLE_STAGE ≠ CLIENT **ET** ≠ LOST **ET** EMAIL_STATUS ≠ INVALID, ≠ DISPOSABLE, ≠ BOUNCED **ET** PHONE_STATUS ≠ INVALID |
| NEWSLETTER — FINANCE | VERTICAL = FINANCE **ET** OPT_IN = Oui **ET** EMAIL_STATUS ≠ INVALID, ≠ DISPOSABLE, ≠ BOUNCED |
| NEWSLETTER — EXPERTISE COMPTABLE | NEWSLETTER — FINANCE **ET** SUBSECTOR = EXPERTISE_COMPTABLE |
| NEWSLETTER — DAF | NEWSLETTER — FINANCE **ET** SUBSECTOR = DAF_FINANCE |

- Désabonnés et blocklistés sont exclus d'office par Brevo de toute campagne.
- **OPT_IN = Oui est obligatoire pour la newsletter** ; EMAIL_STATUS n'est jamais un substitut de consentement. Les contacts historiques ont OPT_IN vide : ils n'entrent pas dans les segments newsletter tant qu'ils n'ont pas coché la case (formulaire ou page de confirmation).
- Appels prioritaires : LEADS — HOT en excluant aussi STATUT_APPEL = « Ne plus appeler ».

---

## 6. Formulaire

Champs : Prénom, Nom (côte à côte), Email, Mobile (indicatif pays), **Quel est votre principal objectif avec l'IA ?** (→ BESOIN_PRIORITAIRE), **À quel horizon souhaitez-vous avancer ?** (→ HORIZON_PROJET), puis :

> ☐ Je souhaite recevoir les actualités, conseils, ressources et invitations aux webinaires d'Althoce par email. Je peux me désinscrire à tout moment.

Case **facultative, non précochée**, qui ne contrôle **que OPT_IN**. Le guide est délivré quelle que soit la réponse. Aucun lien avec les cookies, GA, Meta, le tracker Brevo ou Turnstile.

Mention sous le bouton : « Vous recevrez le guide par email. Althoce peut vous recontacter au sujet de votre demande. Vos données ne sont jamais revendues. Politique de confidentialité ».

---

## 7. Cookies

### Bannière (`components/CookieConsent.tsx`)

- Titre « Votre confidentialité », texte court, lien discret « En savoir plus » (althoce.com/confidentialite).
- **Tout accepter** : bouton principal plein, couleur Althoce. **Essentiels uniquement** : même taille, même niveau, fond transparent et contour blanc visible, un seul clic. Côte à côte dès 640 px, empilés en dessous.
- Non bloquante (bas de page), réaffichée tant qu'aucun choix valide n'existe.

### Stockage

`localStorage["althoce_cookie_consent"] = { "version": 1, "choice": "ALL" | "ESSENTIAL", "timestamp": "…" }` — valable **~6 mois (182 jours)**, puis bannière réaffichée. Les anciennes clés (`althoce-analytics-consent`, `althoce-marketing-consent`) sont supprimées et ne valent pas « Tout accepter ».

### Comportement

| | Avant choix | Essentiels uniquement | Tout accepter |
| --- | --- | --- | --- |
| Page, formulaire, guide, Turnstile, honeypot, rate limit | ✓ | ✓ | ✓ |
| UTM, first touch (localStorage, sans donnée perso), choix cookie | ✓ | ✓ | ✓ |
| Création du contact Brevo + événements serveur (`lead_magnet_submitted`, `lead_magnet_downloaded`) | ✓ | ✓ | ✓ |
| Google Analytics 4 (`_ga`, `_ga_*`) | — | — | ✓ |
| Meta Pixel (`_fbp`) | — | — | ✓ |
| Tracker Brevo (si `NEXT_PUBLIC_BREVO_CLIENT_KEY`) | — | — | ✓ |

Aucun script non essentiel n'est chargé avant le choix : rien à « nettoyer après coup ». Un seul point d'entrée : `initializeMarketingTrackers()` (`lib/tracking/marketing.ts`), protégé par une double vérification du consentement. Une panne de GA, Meta ou Brevo est interceptée et ne casse jamais le formulaire.

### Gérer mes cookies

Lien « Gérer mes cookies » en pied de toutes les pages → rouvre la bannière. Passage **ALL → ESSENTIAL** : GA désactivé (`ga-disable`), Meta en `consent revoke`, file du tracker Brevo neutralisée, cookies `_ga*`, `_gid`, `_gat`, `_fbp`, `_fbc`, `sib_*`, `brevo*` supprimés sur notre domaine. Aux pages suivantes, plus rien n'est chargé. (Un script tiers déjà chargé ne peut pas être retiré de la page en cours ; il n'envoie plus rien.)

---

## 8. Data quality

### Email (`lib/data-quality/email.ts`, serveur, gratuit)

1. trim + minuscules (domaine accentué → punycode) → 2. syntaxe → 3. valeurs manifestement factices, détection prudente (`test@test.com`, `fake@fake.com`, `abc@abc.com`, `email@email.com`, `test@…`, domaines réservés `example.*`, `.test`…) — une vraie boîte n'est jamais rejetée sur son seul nom (`azerty123@gmail.com` passe) → 4. domaine jetable → 5. **capacité de réception** :

| Situation DNS | Verdict |
| --- | --- |
| Domaine inexistant (NXDOMAIN) | refus |
| MX nul `.` (RFC 7505) | refus |
| MX présents, au moins un serveur MX avec une adresse IP joignable | accepté |
| MX présents mais tous vers des noms inexistants ou vers 127.0.0.1 / 0.0.0.0 | refus |
| **Aucun MX** mais une adresse A/AAAA joignable (MX implicite, RFC 5321 § 5.1) | **accepté** |
| Aucun MX ni adresse | refus |
| DNS muet / lent (budget global 4 s) | accepté en PENDING (fail-open journalisé) |

Pas d'API payante (ZeroBounce, NeverBounce, Hunter, Kickbox…), pas de sonde SMTP. Grands fournisseurs sans requête DNS ; cache 1 h par instance.

| Résultat | Brevo | Message affiché |
| --- | --- | --- |
| syntaxe / factice / domaine inexistant / aucune réception | rien n'est créé | « Veuillez vérifier votre adresse email. » |
| jetable | rien n'est créé | « Merci d'utiliser une adresse email personnelle ou professionnelle valide. » |
| valide | EMAIL_STATUS = PENDING | — |

### Domaines jetables

| | |
| --- | --- |
| Liste | `lib/data-quality/disposable-domains.json` — 9 225 domaines |
| Provenance | liste communautaire CC0 [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) + ajouts maison (`EXTRA`) − exceptions (`ALLOW`) |
| Module | `lib/data-quality/disposableDomains.ts` (seul point d'accès, serveur, domaines parents inclus) |
| Mise à jour | `npm run data:disposable` → relire le diff → commiter. Le script refuse une liste anormale (< 1 000) et laisse le fichier intact. |
| Échec de chargement | fichier absent/corrompu : `next build` échoue (jamais déployé cassé). Contenu vide/anormal : liste de secours (29 services courants) + erreur dans les logs ; le formulaire continue de fonctionner. |

### EMAIL_STATUS

```
formulaire valide ───────────────────────────► PENDING  (guide accessible immédiatement)
lien dédié « Confirmer mon adresse » + bouton ► VERIFIED
hard bounce (webhook Brevo) ─────────────────► BOUNCED  (prioritaire, définitif)
```

- **VERIFIED** ne vient QUE du lien de confirmation dédié : ni d'une syntaxe ou d'un MX valides, ni d'un clic quelconque dans une newsletter, ni d'une ouverture.
- INVALID / DISPOSABLE ne sont jamais créés par le formulaire (soumission refusée) ; ils ne viennent que du backfill, sur preuve.
- BOUNCED : exclu newsletter, leads chauds, automations.

### Lien de confirmation d'adresse

- À la capture, `EMAIL_CONFIRM_TOKEN` = jeton **chiffré** (AES-256-GCM, clé dérivée de `SIGNING_SECRET`) : aucune donnée personnelle lisible dans l'URL, infalsifiable.
- Dans l'email de bienvenue de chaque workflow « LM - … » (Brevo → Automations → workflow → email), ajouter un bouton :
  - texte : **« Confirmer mon adresse email »**
  - lien : `https://<domaine>/confirmer-email?t={{ contact.EMAIL_CONFIRM_TOKEN }}`
- La page `/confirmer-email` affiche l'adresse masquée, une case newsletter facultative et un bouton **Confirmer mon adresse**. Seul ce clic (POST `/api/email/confirm`) passe le contact en VERIFIED : les antivirus et aperçus qui ouvrent le lien ne confirment rien. Cocher la case passe OPT_IN à `true` (jamais l'inverse).
- Idempotent : une 2e confirmation ne réécrit rien et ne renvoie pas l'événement `email_confirmed`.
- Si le libellé du bouton évoque « recevoir les prochaines ressources », c'est la case de la page qui recueille ce consentement.

### Téléphone (`lib/data-quality/phone.ts`, libphonenumber-js, gratuit)

E.164 (`06 12 34 56 78` → `+33612345678`), pays / longueur / préfixe / plan de numérotation, repli DOM-TOM (0692… avec +33 → +262 692…), Côte d'Ivoire à 10 chiffres. Pas de Twilio Lookup, pas d'API payante, pas d'OTP SMS : la vérification réelle est faite par le commercial.

**PHONE_STATUS décrit le numéro réellement stocké dans SMS. Aucun SMS → PHONE_STATUS vide.**

| Cas | SMS | PHONE_STATUS | Formulaire |
| --- | --- | --- | --- |
| valide | stocké | VALID_FORMAT (format seulement : ne prouve pas la possession) | accepté |
| doute raisonnable (06 12 34 56 78, 06 06 06 06 06, 6 chiffres identiques, surtaxé) | stocké | SUSPECT | accepté, signalé |
| impossible (longueur, préfixe, lettres) ou faux manifeste (0000000000, 1111111111, 9999999999, 0123456789) | — | — | refusé : « Ce numéro ne semble pas valide. Vérifiez la saisie. » |
| refusé par Brevo (déjà porté par un autre contact) | non → `TEL_DOUBLON` | statut de l'ancien SMS s'il existe, sinon vide | accepté |
| appel abouti | inchangé | VERIFIED (saisi par le commercial) | — |

En cas de doute : SUSPECT plutôt qu'INVALID. INVALID ne vient que du backfill ou du commercial et exclut des appels.

### Anti-bot et résilience

- **Honeypot** rempli → succès factice, aucun contact. **Rate limit** : 6/min et 30/h par IP. **Turnstile** (mode Managed, `interaction-only`) vérifié côté serveur (`siteverify`) : jeton absent ou refusé → 403, aucun contact. Indépendant des cookies, d'OPT_IN, de GA, Meta et du tracker.
- Turnstile sans clés : local → désactivé (avertissement) ; Preview → clés de test Cloudflare automatiques ; Production → vraies clés obligatoires (garde-fou de build). Cloudflare injoignable : fail-open journalisé.
- Priorité : sécurité → validation essentielle → création du lead → accès au guide → événements CRM → analytics. Erreur fondamentale (email invalide, Turnstile invalide, payload invalide) : blocage propre avec message. Brevo indisponible : message « Réessayez », double clic neutralisé, une nouvelle tentative serveur.

**Mise en place Turnstile** : Cloudflare → Turnstile → *Add widget* → domaines `guide-gratuit-pi.vercel.app` (+ `vercel.app` pour les Preview, + domaine personnalisé) → mode *Managed* → copier les deux clés dans Vercel.

---

## 9. UTM, first touch, posts LinkedIn

```
https://guide-gratuit-pi.vercel.app/r/12-cas-usage-experts-comptables?utm_source=linkedin&utm_medium=organic&utm_campaign=guide_experts_comptables&utm_content=LI_EC_20261008_01
```
→ UTM_SOURCE = linkedin · UTM_MEDIUM = organic · UTM_CAMPAIGN = guide_experts_comptables · UTM_CONTENT = LI_EC_20261008_01

- Générateur : `npm run utm -- --slug … --code EC --date 20261008 --n 1 --campaign guide_experts_comptables`.
- `utm_content` = identifiant unique du post : `LI_[CODE]_[AAAAMMJJ]_[NN]` (codes : EC, DAF, FIN, DRT, MKT, GEN).
- `config/sourceRegistry.ts` : `LI_… → { platform, campaign, url }`. URL connue → SOURCE_CONTENT_URL au premier contact ; sinon vide. Jamais bloquant.
- **First touch** : à la première visite avec UTM, `localStorage.althoce_first_touch` = { 4 UTM, page d'arrivée, date }, 90 jours, jamais écrasé, actif quel que soit le choix cookies (attribution sans identifiant). Côté Brevo, aucun UTM n'est réécrit si le contact en a déjà un ; les visites suivantes sont dans les événements.

---

## 10. Tracker Brevo, Google Analytics, Meta Pixel

Tous trois chargés **uniquement** par `initializeMarketingTrackers()` après « Tout accepter ».

- **GA4** (`lib/analytics.ts`) : pages vues + `generate_lead`, sans signaux publicitaires, URLs sans paramètres.
- **Meta Pixel** (`lib/tracking/metaPixel.ts`) : snippet officiel, `PageView`. N'est plus chargé sans consentement.
- **Tracker Brevo** (`lib/tracking/brevoTracker.ts`) : `https://cdn.brevo.com/js/sdk-loader.js`, `Brevo.push(["init", { client_key }])`, puis `Brevo.push(["identify", { identifiers: { email_id } }])` après inscription. Désactivé tant que `NEXT_PUBLIC_BREVO_CLIENT_KEY` est vide. Pour `service_page_viewed` / `case_study_viewed` / `booking_page_viewed`, installer le même snippet sur althoce.com (après consentement) : `Brevo.push(["track", "service_page_viewed", {}, { data: { page: location.pathname } }])`.

---

## 11. Événements Brevo

| Événement | Statut | Déclencheur |
| --- | --- | --- |
| `lead_magnet_submitted` | actif (serveur) | soumission valide — resource, vertical, subsector, besoin, horizon, scores, opt_in, phone_status, utm_*, landing_page |
| `lead_magnet_downloaded` | actif (serveur, jeton signé) | clic « Lire le guide » sur la page merci |
| `email_confirmed` | actif (serveur) | confirmation d'adresse (1 seule fois) |
| `webinar_registered` | prêt | inscription `/w/[slug]` |
| `service_page_viewed`, `case_study_viewed`, `booking_page_viewed` | préparés | tracker althoce.com |
| `webinar_attended`, `webinar_no_show`, `webinar_replay_clicked`, `webinar_cta_clicked` | préparés | plateforme webinar → n8n → `POST /v3/events` |

Les événements serveur servent le parcours CRM demandé (provenance, guide, confirmation) ; ce ne sont pas des traceurs publicitaires et ils ne déposent aucun cookie.

Chaque envoi est journalisé (`{"type":"brevo_event","ok":…}` dans les logs Vercel). **Brevo indexe les événements avec quelques minutes de délai** (≈ 5 min constatées en recette) : un événement absent juste après un test n'est pas une erreur ; l'horodatage reste celui de l'envoi.

---

## 12. Scoring

| HORIZON_PROJET | pts | BESOIN_PRIORITAIRE | pts |
| --- | --- | --- | --- |
| IMMEDIAT | 10 | DEPLOYER_AGENT_IA | 5 |
| MOINS_3_MOIS | 7 | AUTOMATISER_PROCESS | 5 |
| TROIS_SIX_MOIS | 4 | DIAGNOSTIC_STRATEGIE | 4 |
| SIX_DOUZE_MOIS | 2 | FORMER_EQUIPES | 3 |
| PAS_DE_PROJET | 0 | VEILLE_IA / AUTRE | 1 |

Score formulaire ≤ 15. Contact existant : `max(existingScore, formIntentScore)` — jamais de baisse automatique (30 reste 30 face à 12). HOT_LEAD ≥ 25, jamais avec EMAIL_STATUS INVALID / DISPOSABLE / BOUNCED. PHONE_STATUS = INVALID ne génère jamais d'appel.
Webinar (préparé, **désactivé** : `EVENT_SCORING_ENABLED = false`) : registered +5, attended +8, replay_clicked +5, cta_clicked +10.

---

## 13. Webhooks Brevo

Route `POST /api/webhooks/brevo` (404 tant que `BREVO_WEBHOOK_SECRET` est vide).

| Événement | Effet |
| --- | --- |
| `hard_bounce` / `hardBounce` | EMAIL_STATUS → BOUNCED |
| `click`, `opened`, autres | aucun (journalisés ; prêts pour un futur scoring) |

- **Sécurité** : Brevo ne signe pas ses webhooks (pas de HMAC). Protection retenue : jeton **Bearer** configuré dans le webhook (`auth: { type: "bearer", token }`) et vérifié en temps constant ; payload revalidé champ par champ, taille bornée. Option : restreindre en plus aux plages IP publiées par Brevo (help.brevo.com, article 208848409).
- **Idempotence** : effet = état absolu, jamais d'incrément ni de score ; un événement rejoué répond `unchanged` sans écriture.
- **Reprises** : Brevo ne retente que sur **429** ou absence de réponse (tout autre 4xx/5xx abandonne l'événement). Erreur temporaire → la route répond 429.
- **Création** (une fois la route déployée sur l'URL cible) :
  ```bash
  npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo          # dry run
  npm run brevo:webhooks -- --url https://<domaine>/api/webhooks/brevo --apply  # crée marketing + transactionnel
  ```
  (API officielle `POST /v3/webhooks`, événement `hardBounce`, auth Bearer = `BREVO_WEBHOOK_SECRET` local, même valeur que sur Vercel.)

---

## 14. Newsletter

Campagnes Brevo (pas une automation), ~2/semaine, préparées à l'avance. Expéditeur : Espoir Mwami `<espoir@contact.althoce.com>` (domaine authentifié). Tags : `NL_FINANCE`, `NL_EXPERT_COMPTABLE`, `NL_MARKETING`, `WEBINAR_FINANCE`, `CASE_STUDY`, `COMMERCIAL`. Audiences = segments NEWSLETTER (OPT_IN = Oui), exclusion DATA QUALITY — REJECTED.

**Newsletter-as-code** : `content/newsletters/AAAA-MM-JJ-audience.md` (frontmatter title, subject, previewText, scheduledAt, audience, tag, utmCampaign, status + Markdown avec blocs `:::usecase` / `:::insight`) → template `emails/templates/newsletter.html` (Althoce · hook · intro · contenu · cas d'usage · insight · CTA · signature · footer `{{ unsubscribe }}` ; tables, CSS inline, sans JS). Détails : `content/newsletters/README.md`.

UTM automatiques : `utm_source=brevo&utm_medium=email&utm_campaign=…` (+ `utm_content` optionnel, `cta` sur le bouton), jamais en doublon d'un paramètre existant.

| Commande | Effet |
| --- | --- |
| `npm run newsletter -- <fichier>` | **DRY RUN** : sujet, audience (segment résolu), tag, date, heure, expéditeur, UTM + aperçu HTML local |
| `… --create` | brouillon Brevo (aucun envoi) |
| `… --create --schedule` | création + programmation |

Refus si : `status` ≠ `ready`, segment introuvable, date passée, campagne du même nom existante, `brevoCampaignId` déjà présent. Un fichier Markdown seul n'envoie jamais rien.

---

## 15. Webinars (fondation)

Rien n'est publié tant qu'un webinar réel (date, heure, plateforme, URL) n'est pas renseigné.

1. Liste Brevo `WB - <titre>`. 2. Bloc dans `config/webinars.ts` (`status: "open"`). 3. Automation sur la liste : confirmation, J-1, H-1. 4. `/w/[slug]` → `webinar_registered` → `/w/[slug]/confirmation`. 5. Après le live : plateforme → n8n → `webinar_attended` / `webinar_no_show` → replay → `webinar_replay_clicked` → `webinar_cta_clicked`. 6. Activer `EVENT_SCORING_ENABLED` quand ces données existent.

---

## 16. Backfill des contacts historiques

**Non exécuté.** À lancer séparément, après observation du nouveau système en Production.

```bash
npm run brevo:backfill                                # DRY RUN, aucune écriture
npm run brevo:backfill -- --with-commercial-mapping   # + proposition STATUT_APPEL → LIFECYCLE_STAGE
npm run brevo:backfill -- --apply                     # plus tard, sur validation
```

Règles (`lib/backfill/plan.ts`) : uniquement ce qui est prouvé, uniquement des attributs vides.

| Attribut | Écrit seulement si | Jamais |
| --- | --- | --- |
| VERTICAL / SUBSECTOR | listes LM non ambiguës, sans conflit | depuis les listes 14, 16 |
| LIFECYCLE_STAGE = LEAD | liste LM et aucun statut commercial au-delà de « À appeler » | pour un contact déjà travaillé, client, opportunité |
| EMAIL_STATUS | preuve négative : BOUNCED (Brevo), DISPOSABLE, INVALID | VERIFIED, PENDING |
| PHONE_STATUS | SMS stocké et preuve dans le numéro : INVALID / SUSPECT | VALID_FORMAT, VERIFIED |
| OPT_IN, LEAD_SCORE, UTM | — | jamais |

Dry run du 08/10/2026 : **1 759 contacts lus, 1 725 concernés, aucune modification appliquée.**

| Attribut | Proposé |
| --- | --- |
| VERTICAL | FINANCE 1 365 · LEGAL 147 · GENERAL 14 · MARKETING 1 |
| SUBSECTOR | EXPERTISE_COMPTABLE 838 · DAF_FINANCE 132 |
| LIFECYCLE_STAGE | LEAD 1 343 |
| EMAIL_STATUS | BOUNCED 29 · INVALID 21 · DISPOSABLE 13 |
| PHONE_STATUS | SUSPECT 16 · INVALID 1 |

22 conflits laissés vides ; listes 14 (204 contacts) et 16 (56) non déduites. Plan détaillé avec valeurs précédentes dans `backfill-reports/` (ignoré par git).

Proposition commerciale (non appliquée, à valider) : Négociation / Devis envoyé / R2 → OPPORTUNITY · RDV planifié / RDV booke → MEETING_BOOKED · Contacté / À rappeler / À relancer → CONTACTED · Non qualifie → LOST · « Ne plus appeler », « Projet reporté — à suivre » → TODO.

---

## 17. Futur n8n : enrichissement LinkedIn des leads chauds

Pas d'automatisation LinkedIn aujourd'hui, pas de scraping. Sélection future :
`LEAD_SCORE ≥ 25` **et** `UTM_SOURCE = linkedin` **et** `UTM_CONTENT` non vide **et** `LINKEDIN` vide.
Données disponibles : PRENOM, NOM, EMAIL, SMS, ENTREPRISE, JOB_TITLE, UTM_CONTENT, SOURCE_CONTENT_URL, VERTICAL, SUBSECTOR. Résultat à écrire dans `LINKEDIN`.

---

## 18. Tests

| Commande | Contenu |
| --- | --- |
| `npm test` | 72 tests unitaires (cookies A/B/C/F, scoring, téléphone, email/DNS, jetables, fusion des contacts, OPT_IN, PHONE_STATUS, confirmation, webhooks, backfill, config, UTM, sécurité, newsletter) + test GA4 existant |
| `npm run test:e2e` | 21 scénarios : app en production locale + faux Brevo (nécessite `npm run build`) |
| `npm run brevo:smoke -- --email qa-capture-test@example.com` | vrai Brevo, contact de QA **sans liste** (aucun email) |
| `npm run check` | lint + typecheck + tests + build |

Navigateur : `npx tsx tests/e2e/serve.ts` (app sur faux Brevo, http://localhost:3100 ; build avec `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, clé de test Cloudflare).

---

## 19. Procédure Preview

1. Branche dédiée poussée sur GitHub → Vercel crée un déploiement **Preview** automatiquement (URL de branche stable : `capture-leads-git-feat-brevo-a-c06368-espoirs-projects-0a605452.vercel.app`).
2. **Accès** : Preview protégée par Vercel Authentication (à conserver). Se connecter à Vercel dans le navigateur suffit. Shareable Link : bouton *Share* du déploiement → « Anyone with the link » — ⚠️ sur le plan Hobby, **un seul lien actif par compte** : en créer un révoque les autres.
3. Variables **Preview** sur Vercel : `BREVO_API_KEY` (présente). Turnstile en Preview : sans vraies clés, le code utilise automatiquement les clés de **test** publiques Cloudflare (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`, uniquement si `VERCEL_ENV=preview`) : le widget se charge et la vérification serveur `siteverify` a bien lieu (le secret de test accepte tout jeton non vide ; un jeton absent est refusé). De vraies clés définies sur Vercel priment toujours. En Production, les vraies clés sont obligatoires (garde-fou de build).
4. ⚠️ Avec la vraie clé Brevo, un test crée un **vrai contact** ajouté à la **vraie liste** → l'email #1 part. Utiliser une adresse de QA, un nom explicite (« Test QA ne pas appeler ») et un numéro réservé à la fiction ARCEP (ex. `01 99 00 47 21`, `02 61 91 47 21`).
5. Vérifier : bannière, formulaire, guide, contact Brevo (attributs, OPT_IN, UTM, score, PENDING, EMAIL_CONFIRM_TOKEN), événements (après quelques minutes), mobile, URL LinkedIn trackée.
6. Nettoyage : `npm run brevo:delete-test-contact` (dry run) puis `-- --apply` — ne supprime que les contacts de QA listés, vérifiés par email exact + empreinte.

## 20. Procédure Production (après validation explicite)

1. Créer le widget Turnstile ; poser en **Production** : `BREVO_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `SIGNING_SECRET`, `BREVO_WEBHOOK_SECRET`.
2. Fusionner la branche dans `main` → Vercel déploie (le build échoue si une variable obligatoire manque).
3. `npm run brevo:webhooks -- --url https://guide-gratuit-pi.vercel.app/api/webhooks/brevo` puis `--apply`.
4. Ajouter le bouton « Confirmer mon adresse email » dans l'email #1 de chaque workflow LM.
5. Créer les segments (§ 5), `npm run brevo:segments`, recopier les IDs.
6. Mettre à jour la politique de confidentialité ([POLITIQUE_CONFIDENTIALITE.md](POLITIQUE_CONFIDENTIALITE.md)).
7. Observer les nouveaux leads ; **ensuite seulement** : backfill (dry run, puis `--apply`).
8. Supprimer les contacts de QA : `npm run brevo:delete-test-contact -- --apply` (3 contacts listés, email exact + empreinte vérifiés, aucun autre contact touché).
