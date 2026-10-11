# n8n : sécurité, sauvegarde, mise à jour et restauration

Instance : `https://n8n.srv1242605.hstgr.cloud` (VPS Hostinger KVM 2, Paris). Diagnostic du 10/10/2026.

## ✅ Mise à jour effectuée le 11/10/2026 (0 h 52 → 1 h 03, avec votre accord)

| Étape | Résultat |
| --- | --- |
| Snapshot hPanel | `ct_snapshot_create` réussi à 0 h 51 (VPS complet : n8n **et** althoce-crm) |
| Export logique (dans le volume) | 31 workflows, 6 credentials (chiffrés) → `/home/node/.n8n/sauvegarde-2026-10-11/` |
| Archive du volume `n8n_data` (n8n arrêté) | `/root/sauvegardes/n8n_data-2026-10-11-v2.1.5.tgz` (base SQLite, clé de chiffrement, binaires) |
| Configuration d'origine | `/root/sauvegardes/docker-compose.yml.avant-2.42.6` ; ancienne image étiquetée `docker.n8n.io/n8nio/n8n:2.1.5-avant-maj` |
| Image | `/docker/n8n/docker-compose.yml` : `docker.n8n.io/n8nio/n8n` (non figée) → **`:2.42.6` figée** |
| Démarrage | « Recorded version change → 2.42.6 », migrations OK ; coupure ≈ 2 min (n8n seul ; traefik et althoce-crm non touchés) |
| Contrôles | API 200, 31 workflows sur 31, les 2 mêmes actifs, webhook du formulaire du site toujours enregistré, `/healthz` ok, credential Google Sheets déchiffré (connecté), éditeur « Version 2.42.6 », audit sans « Outdated instance » |
| Avis de sécurité restants sur 2.42.6 | aucun corrigible ; seul reste l'avis « Execute Command » (par conception, nœud désactivé par défaut en 2.x) |

**Retour arrière n8n seul** (sans toucher au CRM, contrairement au snapshot) :
```bash
cd /docker/n8n && docker compose stop n8n
docker run --rm -v n8n_data:/data -v /root/sauvegardes:/backup alpine sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/n8n_data-2026-10-11-v2.1.5.tgz -C /data"
cp /root/sauvegardes/docker-compose.yml.avant-2.42.6 docker-compose.yml
sed -i -E 's#(image: *docker\.n8n\.io/n8nio/n8n)[[:space:]]*$#\1:2.1.5-avant-maj#' docker-compose.yml
docker compose up -d n8n
```

À noter :
- `althoce-crm` tourne sur le même VPS (`/opt/althoce-crm`). Une restauration du snapshot le ramènerait aussi au 11/10 à 0 h 51.
- Ubuntu signale 66 mises à jour système et un redémarrage requis : hors périmètre, à planifier séparément.
- Aucun nœud communautaire n'est installé, alors que « Shorts - Post on Socials » (inactif) utilise Blotato : l'installer seulement si ce workflow sert.
- Avertissements 3.0 au démarrage : `WEBHOOK_URL` → `N8N_WEBHOOK_URL`, mode des task runners, timeouts. À traiter avec *Settings → Migration Report* avant la 3.0.

---

Diagnostic initial (10/10/2026) :

## 1. Diagnostic

| Point | Constat |
| --- | --- |
| Version | **2.1.5** (décembre 2025) |
| Avis de sécurité officiels touchant 2.1.5 | **plus de 180** (13 à 17 critiques selon la lecture des plages de versions, une quarantaine exploitables sans authentification) — source : avis GitHub de n8n-io/n8n |
| Version minimale corrigeant tous ces avis | 2.41.4 |
| Version cible recommandée | **2.42.6** (étiquette Docker `stable` = `latest` au 10/10, même empreinte `sha256:526daa38b68e`) |
| Hébergement | VPS Hostinger, modèle n8n (Docker Compose + Traefik : en-têtes HSTS `max-age=315360000; includeSubDomains; preload` caractéristiques) — à confirmer par `docker compose ls` |
| Workflows | 31 (dont 6 Althoce), **2 actifs** : « Site Althoce — Lead Contact Form → Google Sheets — v1 », « Agent vocal » |
| Webhooks actifs sans authentification | `althoce-contact` (formulaire du site) et le webhook de « Agent vocal » (chemin aléatoire) : workflows métier, signalés, **non modifiés** |
| Historique d'exécutions | 1 exécution conservée (28/09) : rétention très courte |

Exemples d'avis critiques touchant 2.1.5 : exécution de code via le nœud Merge en mode SQL (CVE-2026-33660), pollution de prototype du parseur XML des webhooks (CVE-2026-42231), du nœud HTTP Request (CVE-2026-44789), lecture de fichiers via le nœud Git (CVE-2026-44790), évasion du bac à sable Python (CVE-2026-25115). Liste complète : `scratchpad` de la session, reproductible par `gh api /repos/n8n-io/n8n/security-advisories`.

## 2. Pourquoi épingler 2.42.6 (et pas `latest`)

n8n 3.0 est annoncée pour octobre 2026 (images `v3-nightly` déjà publiées). Dès qu'elle deviendra `latest`, un simple `docker compose pull` y basculerait, avec ses changements cassants :
- les nœuds historiques sont supprimés, dont l'ancien nœud OpenAI, présent dans « 🧾 Relance Factures Impayées » ;
- le dossier `binaryData` est renommé en `storage` ;
- les nœuds communautaires non vérifiés sont désactivés, dont Blotato, présent dans « Shorts - Post on Socials » ;
- le jeton de signature Slack devient obligatoire ;
- la Chat Trigger utilise un nouveau protocole.

Épingler `n8nio/n8n:2.42.6` garantit une mise à jour de sécurité sans changement de version majeure. Le passage en 3.0 se décidera plus tard, après lecture de *Settings → Migration Report*.

## 3. Compatibilité 2.1.5 → 2.42.6 (notes de version GitHub lues de 2.2.0 à 2.42.6)

Aucun changement annoncé comme cassant dans la ligne 2.x. Points à surveiller sur vos workflows :

| Changement | Version | Impact chez vous |
| --- | --- | --- |
| Création / modification bloquée pour les workflows contenant un nœud déprécié | 2.42.6 | « 🧾 Relance Factures Impayées » (nœud OpenAI historique), inactif : il tourne encore mais ne sera plus modifiable sans remplacer ce nœud |
| Outil HTTP Request v1 remplacé | — | « Althoce — Moteur de contenu agentic » (inactif) : à vérifier à la prochaine édition |
| Nœud communautaire Blotato | — | « Shorts - Post on Socials » (inactif) : vérifier qu'il se charge après mise à jour |
| Endpoints API activate/deactivate dépréciés (toujours fonctionnels) | 2.33 | scripts Althoce : à migrer vers publish/unpublish plus tard |
| Politique d'appel « Any workflow » dépréciée | 2.37 | aucune occurrence |

Les 2 workflows actifs n'utilisent que des nœuds standards (Webhook, Code, Google Sheets, Chat Trigger, agents IA).

## 4. Sauvegarde

### Déjà fait (10/10/2026, par l'API, sans secret)

- Les 31 workflows sont exportés, avec un manifeste et leurs empreintes SHA-256, dans `Desktop/Prospect pharrow/Claude code/sauvegardes-n8n/2026-10-10-avant-maj-2.1.5/`. Ce dossier est hors de tout dépôt Git.
- **Restauration vérifiée** : 3 workflows (les 2 actifs et le moteur Althoce) ont été réimportés en copies inactives. Ils sont identiques à l'original (nœuds, paramètres, connexions, credentials référencés). Les copies ont ensuite été supprimées.
- Limite : l'API n'exporte ni les credentials, ni la clé de chiffrement, ni la base (exécutions, Data tables, utilisateurs). Pour ceux-là, il faut l'accès au serveur (ci-dessous).

### À faire par vous avant la mise à jour (terminal du navigateur hPanel ou SSH)

Les commandes ci-dessous n'affichent aucun secret, sauf l'étape 3, à lire seul.

```bash
# 1. Trouver le projet Compose et le volume de données
docker compose ls
cd /root            # dossier indiqué par la commande précédente (souvent /root)
docker compose ps
docker compose exec n8n n8n --version          # doit afficher 2.1.5
docker volume ls | grep -i n8n
grep -nE "image:|DB_TYPE|N8N_ENCRYPTION_KEY" docker-compose.yml .env 2>/dev/null | sed -E 's/(KEY=).*/\1****/'

# 2. Export logique complet (workflows + credentials CHIFFRÉS)
docker compose exec -u node n8n n8n export:workflow --all --backup --output=/home/node/.n8n/sauvegarde-2026-10-10/workflows/
docker compose exec -u node n8n n8n export:credentials --all --backup --output=/home/node/.n8n/sauvegarde-2026-10-10/credentials/

# 3. Clé de chiffrement : à copier dans votre gestionnaire de mots de passe (jamais dans un chat, un mail ou Git)
docker compose exec n8n sh -c 'cat /home/node/.n8n/config'

# 4. Copie physique du volume (courte coupure, ~1 min)
docker compose stop n8n
docker run --rm -v <VOLUME_N8N>:/data -v /root/sauvegardes:/backup alpine tar czf /backup/n8n-data-2026-10-10.tgz -C /data .
docker compose start n8n
ls -lh /root/sauvegardes/

# 5. Si DB_TYPE=postgresdb (modèle « queue mode ») : en plus
docker compose exec postgres pg_dump -U <utilisateur> -d <base> -Fc > /root/sauvegardes/n8n-db-2026-10-10.dump
```

Puis, dans hPanel → VPS → **Snapshots** : créer un instantané complet du serveur. C'est le filet de sécurité le plus simple : il restaure tout en un clic.

## 5. Mise à jour (après votre accord)

```bash
cd /root
cp docker-compose.yml docker-compose.yml.avant-2.42.6
# Épingler la version : remplacer l'image n8n par n8nio/n8n:2.42.6 (ou docker.n8n.io/n8nio/n8n:2.42.6)
sed -i -E 's#(image: *)(docker\.n8n\.io/)?n8nio/n8n(:[^ ]*)?#\1docker.n8n.io/n8nio/n8n:2.42.6#' docker-compose.yml
grep -n "image:" docker-compose.yml
docker compose pull
docker compose up -d
docker compose logs --tail=80 n8n          # migrations de base puis « Editor is now accessible »
docker compose exec n8n n8n --version      # 2.42.6
```

Coupure attendue : 1 à 3 minutes (migrations de la base). Créneau conseillé : soir ou week-end. Le formulaire du site peut perdre les soumissions envoyées pendant la coupure, si le site ne réessaie pas.

## 6. Contrôles après mise à jour

1. Connexion à l'éditeur et 2FA fonctionnels.
2. Les 31 workflows sont présents. Comparer avec `manifest.json` : `GET /api/v1/workflows` doit donner le même nombre, et les 2 actifs doivent l'être toujours.
3. Les credentials s'ouvrent sans erreur « could not decrypt » : c'est la preuve que la clé de chiffrement est intacte.
4. Envoyer une soumission de test au formulaire du site : vérifier la ligne dans Google Sheets et une exécution en succès.
5. Agent vocal : un message de test.
6. Data table `althoce_marketing_events` présente avec ses 7 colonnes.
7. Workflows Althoce (inactifs) : ouverture sans avertissement.
8. Nœud communautaire Blotato : chargé (Settings → Community nodes).

## 7. Retour arrière

Les migrations de base sont **à sens unique** : on ne revient pas en arrière en remettant l'ancienne image seule.

- **Option A (la plus sûre)** : restaurer le snapshot hPanel pris juste avant.
- **Option B** :
  ```bash
  docker compose down
  cp docker-compose.yml.avant-2.42.6 docker-compose.yml   # image 2.1.5
  docker run --rm -v <VOLUME_N8N>:/data -v /root/sauvegardes:/backup alpine sh -c "rm -rf /data/* /data/.[!.]* ; tar xzf /backup/n8n-data-2026-10-10.tgz -C /data"
  docker compose up -d
  ```
  Puis refaire les contrôles du § 6. Les exécutions survenues entre la sauvegarde et le retour arrière sont perdues.
- **Option C (perte du serveur)** : nouvelle instance avec la même `N8N_ENCRYPTION_KEY`, puis `n8n import:credentials --separate --input=…` et `n8n import:workflow --separate --input=…` depuis l'export du § 4.

## 8. Ensuite

- Mettre à jour chaque mois : surveiller les avis de sécurité, épingler la version, faire un snapshot avant.
- Protéger les 2 webhooks métier sans authentification (Header Auth), en coordination avec le site et l'agent vocal. Ne le faites pas sans tester l'appelant.
- Préparer le passage en 3.0 : *Settings → Migration Report*, remplacer l'ancien nœud OpenAI, vérifier le nœud Blotato.
