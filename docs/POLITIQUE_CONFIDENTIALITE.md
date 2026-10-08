# Éléments pour la politique de confidentialité (althoce.com/confidentialite)

Description **factuelle** de ce que fait le site des guides (guide-gratuit-pi.vercel.app), à intégrer
dans la politique publiée sur althoce.com. Ce document ne contient aucune qualification juridique
(bases légales, durées de conservation des contacts, transferts hors UE…) : ces points sont à rédiger
ou valider par Althoce / son conseil. Les passages `[À COMPLÉTER]` sont volontairement laissés ouverts.

---

## 1. Formulaire de demande de guide

- **Données saisies** : prénom, nom, adresse email, numéro de mobile (avec indicatif pays), objectif
  principal avec l'IA, horizon de projet, et la réponse à la case newsletter.
- **Utilisation** : envoi du guide par email, accès immédiat au guide sur la page de remerciement,
  prise de contact éventuelle au sujet de la demande, qualification commerciale (score d'intention
  calculé à partir de l'objectif et de l'horizon).
- **Contrôles automatiques** : vérification que l'adresse email est techniquement capable de recevoir
  des messages (syntaxe, existence du domaine, serveurs de messagerie déclarés, liste de services
  d'email jetables) et que le numéro respecte le plan de numérotation du pays. Aucun service payant
  de vérification n'est utilisé, aucun SMS de vérification n'est envoyé.
- **Outil** : les données sont enregistrées dans Brevo (CRM et emailing). [À COMPLÉTER : durée de
  conservation des contacts, base légale, droits et contact DPO.]

## 2. Newsletter (OPT_IN)

- Case facultative, non précochée : « Je souhaite recevoir les actualités, conseils, ressources et
  invitations aux webinaires d'Althoce par email. Je peux me désinscrire à tout moment. »
- Cochée : la newsletter peut être envoyée. Non cochée : le guide est délivré, aucune newsletter.
- Désinscription : lien présent dans chaque email (gestion Brevo).

## 3. Confirmation d'adresse email

- L'email de bienvenue peut contenir un lien « Confirmer mon adresse email ». La confirmation se fait
  par un bouton sur la page ouverte ; elle enregistre que l'adresse est confirmée.
- Le lien contient un jeton chiffré : l'adresse email n'y apparaît pas en clair.

## 4. Provenance de la visite (UTM et premier contact)

- Les paramètres de campagne présents dans le lien (utm_source, utm_medium, utm_campaign,
  utm_content) et la page d'arrivée sont mémorisés **dans le navigateur** (stockage local) pendant
  **90 jours**, sans identifiant ni donnée personnelle, pour attribuer une future demande à la
  publication d'origine (par exemple un post LinkedIn).
- Lors d'une demande de guide, cette provenance est enregistrée avec le contact dans Brevo
  (premier contact uniquement, jamais remplacée ensuite).

## 5. Cookies et traceurs

Bannière « Votre confidentialité » avec deux choix de même niveau : **Tout accepter** et
**Essentiels uniquement**. Le choix est mémorisé **environ 6 mois** dans le navigateur, puis redemandé.
Il peut être modifié à tout moment via le lien **« Gérer mes cookies »** en bas de chaque page.

| Élément | Chargé | Rôle |
| --- | --- | --- |
| Fonctionnement du site, formulaire, mémorisation du choix cookies, provenance (§ 4) | toujours | nécessaires au service demandé |
| Cloudflare Turnstile | toujours | protection anti-robot du formulaire (§ 6) |
| Google Analytics 4 | seulement après « Tout accepter » | mesure d'audience des pages et des demandes de guide |
| Meta Pixel | seulement après « Tout accepter » | mesure et optimisation des campagnes publicitaires Meta |
| Tracker Brevo | seulement après « Tout accepter » (s'il est activé) | suivi des pages consultées par un contact identifié |

- Avant tout choix, aucun outil de mesure ni de publicité n'est chargé.
- Passer de « Tout accepter » à « Essentiels uniquement » arrête ces outils et supprime les cookies
  qu'ils ont déposés sur le domaine du site.
- [À COMPLÉTER : durées de vie des cookies Google et Meta selon leurs documentations, transferts
  de données éventuels, liens vers les politiques de Google, Meta et Brevo.]

## 6. Protection anti-robot

- Cloudflare Turnstile vérifie que le formulaire est envoyé par un humain ; la vérification est
  contrôlée par le serveur du site. Un champ invisible piège les robots et le nombre d'envois par
  adresse IP est limité.
- [À COMPLÉTER : données traitées par Cloudflare selon sa documentation Turnstile.]

## 7. Événements enregistrés dans Brevo

Indépendamment des cookies, le serveur du site enregistre dans Brevo, pour un contact ayant envoyé
le formulaire : la demande de guide (ressource, provenance), l'ouverture du guide depuis la page de
remerciement, et la confirmation d'adresse email. Ces enregistrements ne déposent aucun cookie.
