# Newsletters (as code)

Un fichier = une campagne Brevo. Rythme visé : ~2 emails / semaine, préparés
plusieurs semaines à l'avance. Ce sont des **campagnes** Brevo, pas une
automation : rien ne part tant qu'on ne l'a pas explicitement programmé.

## Nom de fichier

`AAAA-MM-JJ-audience.md` — ex. `2026-11-03-finance.md`. Le nom de campagne
Brevo en est dérivé (`NL 2026-11-03-finance`) et sert d'anti-doublon.

## Frontmatter

| Champ          | Obligatoire | Exemple / règle                                        |
| -------------- | ----------- | ------------------------------------------------------ |
| `title`        | oui         | Hook affiché en titre de l'email                       |
| `subject`      | oui         | Objet                                                  |
| `previewText`  | non         | Texte d'aperçu (pré-en-tête)                           |
| `scheduledAt`  | pour programmer | `2026-11-03T08:30:00+01:00` (toujours avec fuseau) |
| `audience`     | oui         | clé de `config/newsletter.ts` : `finance`, `expertise-comptable`, `daf` |
| `tag`          | oui         | `NL_FINANCE`, `NL_EXPERT_COMPTABLE`, `NL_MARKETING`, `WEBINAR_FINANCE`, `CASE_STUDY`, `COMMERCIAL` |
| `utmCampaign`  | oui         | `nl_finance_20261103` (minuscules, chiffres, `_`)      |
| `utmContent`   | non         | appliqué aux liens du corps (le CTA reçoit `cta`)      |
| `status`       | oui         | `draft` → `ready` → (`created` / `scheduled`, écrits par le script) |
| `cta`          | non         | `{ label, url }`                                       |
| `signature`    | non         | défaut : « Espoir Mwami / Althoce »                    |

Tous les liens reçoivent `utm_source=brevo&utm_medium=email&utm_campaign=…`
sauf les paramètres déjà présents (jamais de doublon).

## Corps (Markdown)

Intro, intertitres `##`, listes, liens, puis deux blocs spéciaux :

```
:::usecase Titre du cas d'usage
Texte…
:::

:::insight Titre de l'insight
Texte…
:::
```

Le HTML brut est ignoré (le template reste maîtrisé).

## Commandes

```bash
npm run newsletter -- content/newsletters/2026-11-03-finance.md
```
Dry run : affiche sujet, audience, date, heure, tag, UTM, expéditeur et écrit
un aperçu dans `.newsletter-previews/`.

```bash
npm run newsletter -- content/newsletters/2026-11-03-finance.md --create
```
Crée un **brouillon** Brevo (exige `status: ready` et un segment configuré).

```bash
npm run newsletter -- content/newsletters/2026-11-03-finance.md --create --schedule
```
Crée et programme à `scheduledAt`. Toujours envoyer un test depuis Brevo avant.
