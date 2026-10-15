# Webinaires : procédure

Mise en place du 15 octobre 2026. Elle réutilise la capture, Brevo, le moteur de séquences, le scoring et le CRM existants. Aucune automation Brevo n'est créée par webinar.

## Parcours

```
LinkedIn (post, lien court /l/<code>)  ·  Publicité LinkedIn Ads / Meta Ads (URL suivie)
        ↓  utm_source / utm_medium / utm_campaign / utm_content (first touch conservé)
Page d'inscription /w/<slug>  →  /w/<slug>/confirmation (Google Agenda, .ics)
        ↓  formulaire commun : Turnstile, validation, consentement, score +8
Brevo (moteur de séquences, modèles 45 à 49)
        confirmation · rappel J-1 · rappel H-1 · replay J+20 h · suivi J+3 (marketing)
        ↓  lien de connexion PERSONNEL /w/<slug>/rejoindre
Google Meet (Business Standard : 150 participants, enregistrement)
        ↓  présence = clic du lien personnel pendant la fenêtre → score +15,
        ↓  activité qualifiante WEBINAR_ATTENDED
CRM Althoce : présent avec projet déclaré ou HOT → « À attribuer » ; suivi J+3 avec prise de RDV
```

**Lien personnel.** Le jeton est chiffré : il porte le contact, le webinar et l'usage (connexion ou replay). Il ne contient aucune donnée lisible.

**Fenêtre.** Il ouvre la salle de 15 minutes avant le début jusqu'à 30 minutes après la fin. Un antivirus de messagerie qui ouvre le lien à la livraison des rappels tombe hors fenêtre : aucune présence fausse.

**Hors fenêtre,** une page explique l'état :
- `bientot` ;
- `salle-fermee` ;
- `termine` ;
- `replay-bientot` ;
- `lien-invalide`.

**Salle Meet protégée.** Le lien Meet n'est jamais publié sur la page.

## Créer un webinaire (≈ 15 minutes)

1. **Google Agenda** (compte Althoce) : créer l'événement avec Google Meet et copier le lien de la salle. Business Standard permet 150 participants et l'enregistrement.
2. **Brevo** : créer la liste « WB - <titre> » et noter son ID réel.
3. **`config/webinars.ts`** : ajouter un bloc. Ne rien inventer ; date ISO avec fuseau.
   ```ts
   "ia-cabinet-2026-11": {
     slug: "ia-cabinet-2026-11", resource: "ia-cabinet-2026-11",
     brevoListId: ID_REEL, brevoListName: "WB - …",
     vertical: "FINANCE", subsector: "EXPERTISE_COMPTABLE", note: "Cible annoncée dans le post",
     title: "…", description: "…", audience: "…",
     agenda: ["…", "…", "Questions-réponses en direct"],
     speaker: { name: "Espoir Mwami", role: "Fondateur d'Althoce" },
     startsAt: "2026-11-20T12:30:00+01:00", durationMin: 45, platform: "google_meet",
     joinUrl: "https://meet.google.com/…", sequence: "webinar-standard-v1", status: "open",
   },
   ```
4. **Diffusion** :
   - **Post LinkedIn** : une entrée dans `config/shortLinks.ts`, avec `kind: "webinar"` et `utm_content` au format `LI_<CODE>_<AAAAMMJJ>_<NN>`.
   - **Annonce** : une URL par annonce, à coller telle quelle comme destination.
     ```bash
     npm run utm -- --webinar <slug> --ads meta --code FIN --date 20261105 --n 1 --campaign webinar_ia_finance
     ```
     `--ads linkedin` pour LinkedIn Ads. Résultat : `utm_medium=paid_social`, `utm_content=AD_META_FIN_20261105_01`. Aucun pixel avant consentement.
5. **Contrôles** : `npm run check`, puis vérifier la Preview (page, confirmation, `.ics`), puis fusionner. Faire un test d'inscription avec une adresse QA autorisée.

La page de démonstration `/w/demonstration-webinar` n'existe que hors Production (Preview, local). Son formulaire est fermé.

## Le jour J

- Ouvrir la salle 15 minutes avant et lancer l'enregistrement (manuel en Business Standard).
- Chaque inscrit entre par son lien personnel : la présence est enregistrée une seule fois par contact.

## Après le live

1. **Replay.** Partager l'enregistrement Drive en « Tous les utilisateurs disposant du lien » (lecture). Renseigner `replayUrl` dans le bloc et passer `status: "done"`, puis **déployer moins de 20 heures après le début**. L'email replay part à J+20 h ; si le lien manque à ce moment, l'étape est ignorée (`missing_replay`).
2. **Suivi J+3.** C'est un email marketing. Il est bloqué pour les opposés et pour les contacts déjà pris en charge par le CRM.
3. **CRM.** Les présents qui ont un projet déclaré, ou un score HOT avec activité récente, remontent dans « À attribuer » avec leur priorité. Les alertes P1/HOT s'appliquent.

## Limites connues

- **Présence.** Elle vaut « a rejoint par son lien », pas une durée de présence : le rapport de présence natif de Meet exige Business Plus. Un lien transféré compte pour son destinataire d'origine.
- **Salle Meet.** Après la redirection, le lien de la salle reste visible dans le navigateur de l'inscrit. Garder l'admission des invités externes selon vos réglages Meet.
- **n8n.** Le workflow « Présences » n'est plus nécessaire pour les présences. Il reste disponible pour marquer des absences (`webinar_no_show`) si besoin.
