"""Génère les workflows n8n Althoce (production + variantes de test). Aucun secret.

    python3 n8n/build.py .            → réécrit n8n/*.json (IDs non secrets : n8n/instance.json)

Les credentials ne sont jamais dans ces fichiers : on les rattache dans n8n
(voir docs/PHASE_MARKETING_N8N.md).
"""
import json, uuid, sys, os
U = lambda: str(uuid.uuid4())
STEP_URL_PROD = "https://guide-gratuit-pi.vercel.app/api/sequences/step"
BASE_PROD = "https://guide-gratuit-pi.vercel.app"
CRED_IN = "Althoce · Vercel → n8n (Bearer)"
CRED_OUT = "Althoce · n8n → Vercel (Bearer)"

def sticky(content, pos, w=520, h=300, color=None):
    p = {"content": content, "height": h, "width": w}
    if color: p["color"] = color
    return {"parameters": p, "id": U(), "name": f"Note {U()[:4]}", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": pos}

def if_node(name, value, pos):
    return {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
             "conditions": [{"id": U(), "leftValue": "={{ $json.route }}", "rightValue": value, "operator": {"type": "string", "operation": "equals"}}],
             "combinator": "and"}, "options": {}},
            "id": U(), "name": name, "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": pos}

c = lambda n: {"node": n, "type": "main", "index": 0}

VALIDER = r"""// Payload envoyé par Vercel (lib/sequences/n8n.ts) : aucune donnée personnelle.
const out = [];
for (const item of $input.all()) {
  const b = item.json.body ?? {};
  const ok =
    typeof b.enrollmentId === 'string' && b.enrollmentId.startsWith('e1.') && b.enrollmentId.length <= 600 &&
    typeof b.stepId === 'string' && b.stepId.length > 0 && b.stepId.length <= 60 &&
    !Number.isNaN(Date.parse(b.at));
  if (!ok) throw new Error('Inscription invalide : enrollmentId, stepId ou at manquant');
  out.push({ json: { enrollmentId: b.enrollmentId, stepId: b.stepId, at: b.at, attempts: 0 } });
}
return out;"""

DECIDER = r"""// Réponse de /api/sequences/step (lib/sequences/run.ts) : Vercel décide, n8n ne fait qu'attendre.
const cfg = $('Config — Paramètres des séquences').first().json;
const r = $json;
const body = r && typeof r.body === 'object' && r.body !== null ? r.body : {};
const code = typeof r.statusCode === 'number' ? r.statusCode : 0; // 0 = réseau / timeout
let prev = {};
try { prev = $("Attendre l'étape").last().json; } catch (e) { prev = {}; }
const enrollmentId = body.enrollmentId ?? prev.enrollmentId;
const stepId = body.requestedStepId ?? prev.stepId;
const attempts = Number(prev.attempts ?? 0);

if (code === 200 && body.action === 'wait' && body.stepId && body.at) {
  return [{ json: { route: 'wait', enrollmentId, stepId: body.stepId, at: body.at, attempts: 0 } }];
}
if (code === 200 && body.action === 'done') {
  return [{ json: { route: 'done', enrollmentId, stepId, reason: body.reason ?? 'done' } }];
}
// Vercel ou Brevo indisponible : nouvel essai plus tard (sans risque : idempotence Brevo)
const retryable = code === 0 || code === 429 || code >= 500;
if (retryable && attempts < cfg.maxAttempts) {
  const at = new Date(Date.now() + cfg.retryDelayMinutes * 60 * 1000).toISOString();
  return [{ json: { route: 'wait', enrollmentId, stepId, at, attempts: attempts + 1 } }];
}
return [{ json: { route: 'error', enrollmentId, stepId, statusCode: code, reason: body.reason ?? body.action ?? 'unknown' } }];"""

def engine(name, step_url, webhook_path, with_auth=True):
    webhook = {"parameters": {"httpMethod": "POST", "path": webhook_path, "authentication": "headerAuth" if with_auth else "none",
                              "responseMode": "onReceived", "options": {}},
               "id": U(), "name": "Recevoir l'inscription (Vercel)", "type": "n8n-nodes-base.webhook", "typeVersion": 2.1,
               "position": [0, 300], "webhookId": U()}
    if not with_auth: webhook["parameters"].pop("authentication")
    config = {"parameters": {"assignments": {"assignments": [
                {"id": U(), "name": "stepUrl", "value": step_url, "type": "string"},
                {"id": U(), "name": "maxAttempts", "value": 48, "type": "number"},
                {"id": U(), "name": "retryDelayMinutes", "value": 30, "type": "number"}]},
              "includeOtherFields": True, "options": {}},
              "id": U(), "name": "Config — Paramètres des séquences", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [220, 300]}
    http = {"parameters": {"method": "POST", "url": "={{ $('Config — Paramètres des séquences').first().json.stepUrl }}",
              "sendBody": True, "specifyBody": "json",
              "jsonBody": "={{ JSON.stringify({ enrollmentId: $json.enrollmentId, stepId: $json.stepId }) }}",
              "options": {"response": {"response": {"fullResponse": True, "neverError": True}}, "timeout": 30000}},
            "id": U(), "name": "Exécuter l'étape (Vercel)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2,
            "position": [880, 300], "onError": "continueRegularOutput"}
    if with_auth:
        http["parameters"]["authentication"] = "genericCredentialType"
        http["parameters"]["genericAuthType"] = "httpHeaderAuth"
    nodes = [
        sticky(f"## {name}\nUn seul workflow pour TOUS les guides et webinars : il ne connaît ni modèles, ni délais, ni règles.\n\n"
               "**Chaîne** : Vercel envoie l'inscription (identifiant signé, aucune donnée personnelle) → attente jusqu'à la date de l'étape → "
               "POST /api/sequences/step → Vercel relit Brevo (désinscrit ? RDV pris ? email valide ?), envoie ou saute, et renvoie l'étape suivante → boucle.\n\n"
               "**Sécurité** : chaque envoi porte une clé d'idempotence Brevo : un rejeu ne crée jamais de doublon.\n"
               "**Erreurs** : Vercel/Brevo indisponible → nouvel essai toutes les 30 min (48 fois) ; erreur définitive → Error Workflow « ALTHOCE | Marketing | Alertes n8n — v1 ».\n\n"
               "Docs : althoce-ressources/docs/PHASE_MARKETING_N8N.md", [-40, -80], 760, 340),
        sticky(f"### Credentials à rattacher\n- **Recevoir l'inscription** : Header Auth « {CRED_IN} » (Authorization = Bearer N8N_WEBHOOK_TOKEN)\n"
               f"- **Exécuter l'étape** : Header Auth « {CRED_OUT} » (Authorization = Bearer SEQUENCE_API_SECRET)\n\n"
               "Les mêmes valeurs sont dans Vercel. Ne jamais les écrire ailleurs.", [760, -80], 520, 240, 5),
        webhook, config,
        {"parameters": {"jsCode": VALIDER}, "id": U(), "name": "Valider l'inscription", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 300]},
        {"parameters": {"resume": "specificTime", "dateTime": "={{ $json.at }}"}, "id": U(), "name": "Attendre l'étape",
         "type": "n8n-nodes-base.wait", "typeVersion": 1.1, "position": [660, 300], "webhookId": U()},
        http,
        {"parameters": {"jsCode": DECIDER}, "id": U(), "name": "Décider la suite", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 300]},
        if_node("Étape suivante ?", "wait", [1320, 300]),
        if_node("Erreur définitive ?", "error", [1540, 420]),
        {"parameters": {"errorMessage": "={{ 'Séquence Althoce bloquée (étape ' + $json.stepId + ', HTTP ' + $json.statusCode + ', ' + $json.reason + ')' }}"},
         "id": U(), "name": "Signaler la séquence bloquée", "type": "n8n-nodes-base.stopAndError", "typeVersion": 1, "position": [1760, 360]},
        {"parameters": {}, "id": U(), "name": "Terminer la séquence", "type": "n8n-nodes-base.noOp", "typeVersion": 1, "position": [1760, 500]},
    ]
    connections = {
        "Recevoir l'inscription (Vercel)": {"main": [[c("Config — Paramètres des séquences")]]},
        "Config — Paramètres des séquences": {"main": [[c("Valider l'inscription")]]},
        "Valider l'inscription": {"main": [[c("Attendre l'étape")]]},
        "Attendre l'étape": {"main": [[c("Exécuter l'étape (Vercel)")]]},
        "Exécuter l'étape (Vercel)": {"main": [[c("Décider la suite")]]},
        "Décider la suite": {"main": [[c("Étape suivante ?")]]},
        "Étape suivante ?": {"main": [[c("Attendre l'étape")], [c("Erreur définitive ?")]]},
        "Erreur définitive ?": {"main": [[c("Signaler la séquence bloquée")], [c("Terminer la séquence")]]},
    }
    return {"name": name, "nodes": nodes, "connections": connections, "settings": {"executionOrder": "v1", "saveManualExecutions": True}}

ALERTE = r"""// Données de l'Error Trigger → message d'alerte (aucune donnée personnelle de prospect).
const e = $json.execution ?? {};
return [{ json: {
  workflow: $json.workflow?.name ?? 'inconnu',
  executionId: e.id ?? '',
  node: e.lastNodeExecuted ?? '',
  message: e.error?.message ?? 'erreur inconnue',
  url: e.url ?? '',
} }];"""

def alerts(name):
    return {"name": name, "settings": {"executionOrder": "v1"}, "nodes": [
        sticky(f"## {name}\nError Workflow des workflows Althoce (séquences, journal, recalcul, quota) : toute erreur envoie un email à espoir@contact.althoce.com "
               "via Vercel (/api/sequences/alert → Brevo). La clé Brevo reste sur Vercel.\n\n"
               f"**Credential à rattacher** sur « Envoyer l'alerte (Vercel) » : Header Auth « {CRED_OUT} ».", [-40, -60], 620, 220),
        {"parameters": {}, "id": U(), "name": "Capter l'erreur", "type": "n8n-nodes-base.errorTrigger", "typeVersion": 1, "position": [0, 240]},
        {"parameters": {"jsCode": ALERTE}, "id": U(), "name": "Préparer l'alerte", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 240]},
        {"parameters": {"method": "POST", "url": f"{BASE_PROD}/api/sequences/alert", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json) }}", "options": {"timeout": 20000}},
         "id": U(), "name": "Envoyer l'alerte (Vercel)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [440, 240],
         "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000},
    ], "connections": {"Capter l'erreur": {"main": [[c("Préparer l'alerte")]]}, "Préparer l'alerte": {"main": [[c("Envoyer l'alerte (Vercel)")]]}}}

PRESENCES = r"""// À ADAPTER à la plateforme (Zoom, Livestorm, Teams…) : un item par inscrit,
// { email, attended: true|false }. Laisser vide tant qu'aucun webinar réel n'a eu lieu.
const cfg = $('Config — Webinar').first().json;
const participants = []; // ← brancher ici l'export ou l'API de la plateforme
return participants.map((p) => ({ json: {
  email: String(p.email).trim().toLowerCase(),
  event: p.attended ? 'webinar_attended' : 'webinar_no_show',
  properties: { webinar: cfg.webinarSlug },
} }));"""

def presences(name):
    return {"name": name, "settings": {"executionOrder": "v1"}, "nodes": [
        sticky(f"## {name}\nAprès un webinar : présences / absences → événements Brevo (webinar_attended / webinar_no_show) via Vercel "
               "(/api/sequences/event), pour le scoring et le suivi commercial. Les rappels et le replay sont envoyés par le moteur de séquences.\n\n"
               f"**Avant usage** : renseigner le slug dans « Config — Webinar », brancher la source des présences, rattacher « {CRED_OUT} ».", [-40, -60], 700, 220),
        {"parameters": {}, "id": U(), "name": "Lancer après le webinar", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 240]},
        {"parameters": {"assignments": {"assignments": [{"id": U(), "name": "webinarSlug", "value": "slug-du-webinar", "type": "string"},
                                                        {"id": U(), "name": "eventUrl", "value": f"{BASE_PROD}/api/sequences/event", "type": "string"}]}, "options": {}},
         "id": U(), "name": "Config — Webinar", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [220, 240]},
        {"parameters": {"jsCode": PRESENCES}, "id": U(), "name": "Lister les présences (à adapter)", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [440, 240]},
        {"parameters": {"method": "POST", "url": "={{ $('Config — Webinar').first().json.eventUrl }}", "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
                        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify({ email: $json.email, event: $json.event, properties: $json.properties }) }}",
                        "options": {"batching": {"batch": {"batchSize": 5, "batchInterval": 1000}}, "timeout": 20000}},
         "id": U(), "name": "Enregistrer l'événement Brevo (Vercel)", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [660, 240],
         "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000},
    ], "connections": {"Lancer après le webinar": {"main": [[c("Config — Webinar")]]}, "Config — Webinar": {"main": [[c("Lister les présences (à adapter)")]]},
                       "Lister les présences (à adapter)": {"main": [[c("Enregistrer l'événement Brevo (Vercel)")]]}}}

FAUX = r"""// Faux /api/sequences/step pour tester la boucle du moteur sans Vercel.
const b = $json.body ?? {};
const echo = { enrollmentId: b.enrollmentId, requestedStepId: b.stepId };
if (b.stepId === 'etape-1') return [{ json: { ...echo, action: 'wait', stepId: 'etape-2', at: new Date(Date.now() + 15000).toISOString() } }];
return [{ json: { ...echo, action: 'done', reason: 'completed' } }];"""

def fake_step(name, path):
    return {"name": name, "settings": {"executionOrder": "v1"}, "nodes": [
        {"parameters": {"httpMethod": "POST", "path": path, "responseMode": "responseNode", "options": {}}, "id": U(), "name": "Recevoir l'appel du moteur",
         "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": [0, 0], "webhookId": U()},
        {"parameters": {"jsCode": FAUX}, "id": U(), "name": "Simuler la réponse Vercel", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 0]},
        {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}}, "id": U(), "name": "Répondre au moteur",
         "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [440, 0]},
    ], "connections": {"Recevoir l'appel du moteur": {"main": [[c("Simuler la réponse Vercel")]]}, "Simuler la réponse Vercel": {"main": [[c("Répondre au moteur")]]}}}

# ── Scoring comportemental : journal des événements (Data table) ─────────────

EVENTS_TABLE = "althoce_marketing_events"
EVENT_COLUMNS = "event_key (string), contact_id (number), category (string), points (number), occurred_at (date), source (string), ref (string)"

def dt(name, op, table_id, pos, params, always=False):
    p = {"resource": "row", "operation": op, "dataTableId": {"__rl": True, "mode": "id", "value": table_id}}
    p.update(params)
    n = {"parameters": p, "id": U(), "name": name, "type": "n8n-nodes-base.dataTable", "typeVersion": 1.1, "position": pos}
    if always: n["alwaysOutputData"] = True
    return n

def http_vercel(name, url_expr, body_expr, pos, with_auth=True, timeout=60000):
    n = {"parameters": {"method": "POST", "url": url_expr, "sendBody": True, "specifyBody": "json", "jsonBody": body_expr,
                        "options": {"timeout": timeout}},
         "id": U(), "name": name, "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": pos,
         "retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000}
    if with_auth:
        n["parameters"]["authentication"] = "genericCredentialType"
        n["parameters"]["genericAuthType"] = "httpHeaderAuth"
    return n

def schedule(name, minute, pos):
    return {"parameters": {"rule": {"interval": [{"field": "hours", "hoursInterval": 1, "triggerAtMinute": minute}]}},
            "id": U(), "name": name, "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": pos}

def webhook_trigger(name, path, pos, with_auth=True, respond=False):
    n = {"parameters": {"httpMethod": "POST", "path": path, "responseMode": "responseNode" if respond else "onReceived", "options": {}},
         "id": U(), "name": name, "type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "position": pos, "webhookId": U()}
    if with_auth: n["parameters"]["authentication"] = "headerAuth"
    return n

VALIDER_EVENTS = r"""// Lot envoyé par Vercel (lib/scoring/ledger.ts) : aucune donnée personnelle
// (ID contact Brevo, catégorie, points, date, clé opaque). Le barème vit dans Vercel.
const KEY = /^(clk|wreg|watt|rdv)\.[A-Za-z0-9_-]{32}$/;
const CATS = ['content_click', 'guide_click', 'offer_click', 'webinar_registered', 'webinar_attended', 'meeting_booked'];
const SOURCES = ['brevo_transactional', 'brevo_marketing', 'capture', 'webinar', 'crm'];
const body = $input.first().json.body ?? {};
const events = Array.isArray(body.events) ? body.events : [];
// Lot refusé → réponse 400 (branche « Lot valide ? »), rien n'est écrit
if (events.length === 0 || events.length > 100) return [{ json: { __invalid: 'Lot invalide : 1 à 100 événements attendus' } }];
const seen = new Set();
const out = [];
for (const e of events) {
  const ok = e && typeof e.event_key === 'string' && KEY.test(e.event_key) &&
    Number.isInteger(e.contact_id) && e.contact_id > 0 &&
    CATS.includes(e.category) && Number.isInteger(e.points) && e.points >= 0 && e.points <= 25 &&
    typeof e.occurred_at === 'string' && !Number.isNaN(Date.parse(e.occurred_at)) &&
    SOURCES.includes(e.source) && typeof e.ref === 'string' && e.ref.length <= 80;
  if (!ok) return [{ json: { __invalid: 'Événement invalide (clé, contact, catégorie, points, date, source ou ref)' } }];
  if (seen.has(e.event_key)) continue; // doublon dans le même lot
  seen.add(e.event_key);
  out.push({ json: { event_key: e.event_key, contact_id: e.contact_id, category: e.category, points: e.points,
    occurred_at: new Date(e.occurred_at).toISOString(), source: e.source, ref: e.ref } });
}
return out;"""

CONTACTS_LOT = r"""// Contacts du lot. Ordre d'exécution v1 : la branche du dessus (journalisation)
// est terminée avant celle-ci, l'historique relu inclut donc les nouveaux événements.
const ids = [...new Set($('Valider les événements').all().map((i) => i.json.contact_id))];
return ids.map((contact_id) => ({ json: { contact_id } }));"""

PICK = "({ event_key: r.event_key, contact_id: r.contact_id, category: r.category, points: r.points, occurred_at: r.occurred_at })"

REPONSE = r"""// Historique complet des contacts → Vercel recalcule le score (lib/scoring/behavior.ts).
let inserted = 0;
try { inserted = $("Journaliser l'événement").all().filter((i) => i.json.event_key).length; } catch (e) { inserted = 0; }
const rows = $input.all().map((i) => i.json).filter((r) => r && r.event_key).map((r) => """ + PICK + r""");
return [{ json: { ok: true, inserted, rows } }];"""

ACTIFS = r"""// Contacts ayant au moins un événement dans la fenêtre (sinon : rien à faire)
const ids = [...new Set($input.all().map((i) => Number(i.json.contact_id)).filter((v) => Number.isInteger(v) && v > 0))];
return ids.map((contact_id) => ({ json: { contact_id } }));"""

DOUBLONS = r"""// Doublons du journal (insertions simultanées : la Data table n'a pas de contrainte d'unicité).
// On garde la ligne la plus ancienne (plus petit id) de chaque clé ; les autres sont supprimées.
const first = new Map();
const extra = [];
for (const r of $input.all().map((i) => i.json).filter((r) => r && r.event_key && r.id !== undefined)) {
  const k = r.event_key;
  if (!first.has(k)) { first.set(k, r.id); continue; }
  const keep = Math.min(first.get(k), r.id);
  extra.push(Math.max(first.get(k), r.id));
  first.set(k, keep);
}
return extra.map((id) => ({ json: { id } }));"""

LOTS = r"""// Lots de 500 lignes au plus pour /api/marketing/score ; l'historique d'un contact n'est jamais coupé.
const by = new Map();
for (const r of $input.all().map((i) => i.json).filter((r) => r && r.event_key)) {
  if (!by.has(r.contact_id)) by.set(r.contact_id, []);
  by.get(r.contact_id).push(""" + PICK + r""");
}
const out = [];
let batch = [];
for (const rows of by.values()) {
  if (batch.length && batch.length + rows.length > 500) { out.push({ json: { rows: batch } }); batch = []; }
  batch.push(...rows);
}
if (batch.length) out.push({ json: { rows: batch } });
return out;"""

def journal(name, table_id, path="althoce-marketing-events", with_auth=True):
    T = "Recevoir les événements (Vercel)"
    nodes = [
        sticky(f"## {name}\nJournal DURABLE des signaux de scoring (clics, webinars, RDV) dans la Data table « {EVENTS_TABLE} ».\n\n"
               "**Chaîne** : Brevo → Vercel (/api/webhooks/brevo : classe le clic, applique le barème, calcule une clé unique) → ce webhook → "
               "insertion si la clé est nouvelle → réponse = historique complet des contacts → Vercel met à jour LEAD_SCORE.\n\n"
               "**Zéro double comptage** : une clé déjà connue n'est pas réinsérée ; et le calcul ignore de toute façon les doublons de clé.\n"
               "**Aucune donnée personnelle** : ID contact Brevo + clé opaque (HMAC).\n"
               "**n8n arrêté ?** Vercel répond 429 à Brevo, qui rejoue plus tard : aucun événement perdu.\n\n"
               f"Colonnes : {EVENT_COLUMNS}.\nDocs : althoce-ressources/docs/PHASE_MARKETING_N8N.md", [-40, -140], 900, 400),
        sticky(f"### Credential\n**{T}** : Header Auth « {CRED_IN} » (Authorization = Bearer N8N_WEBHOOK_TOKEN, même valeur que dans Vercel).", [900, -140], 420, 160, 5),
        webhook_trigger(T, path, [0, 300], with_auth, respond=True),
        {"parameters": {"jsCode": VALIDER_EVENTS}, "id": U(), "name": "Valider les événements", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 300]},
        {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
             "conditions": [{"id": U(), "leftValue": "={{ $json.__invalid }}", "rightValue": "", "operator": {"type": "string", "operation": "empty", "singleValue": True}}],
             "combinator": "and"}, "options": {}},
         "id": U(), "name": "Lot valide ?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [440, 300]},
        {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify({ ok: false, reason: $json.__invalid }) }}", "options": {"responseCode": 400}},
         "id": U(), "name": "Refuser le lot (400)", "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [660, 560]},
        dt("Nouvel événement ?", "rowNotExists", table_id, [660, 200], {"filters": {"conditions": [{"keyName": "event_key", "keyValue": "={{ $json.event_key }}"}]}}),
        dt("Journaliser l'événement", "insert", table_id, [900, 200], {"columns": {"mappingMode": "autoMapInputData", "value": {}, "matchingColumns": [], "schema": []}, "options": {}}),
        {"parameters": {"jsCode": CONTACTS_LOT}, "id": U(), "name": "Contacts du lot", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 400]},
        dt("Lire l'historique du contact", "get", table_id, [900, 400],
           {"matchType": "allConditions", "filters": {"conditions": [{"keyName": "contact_id", "condition": "eq", "keyValue": "={{ $json.contact_id }}"}]}, "returnAll": True}, always=True),
        {"parameters": {"jsCode": REPONSE}, "id": U(), "name": "Préparer la réponse", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1140, 400]},
        {"parameters": {"respondWith": "json", "responseBody": "={{ JSON.stringify($json) }}", "options": {}}, "id": U(), "name": "Répondre à Vercel",
         "type": "n8n-nodes-base.respondToWebhook", "typeVersion": 1.1, "position": [1360, 400]},
    ]
    connections = {
        T: {"main": [[c("Valider les événements")]]},
        "Valider les événements": {"main": [[c("Lot valide ?")]]},
        "Lot valide ?": {"main": [[c("Nouvel événement ?"), c("Contacts du lot")], [c("Refuser le lot (400)")]]},
        "Nouvel événement ?": {"main": [[c("Journaliser l'événement")]]},
        "Contacts du lot": {"main": [[c("Lire l'historique du contact")]]},
        "Lire l'historique du contact": {"main": [[c("Préparer la réponse")]]},
        "Préparer la réponse": {"main": [[c("Répondre à Vercel")]]},
    }
    return {"name": name, "nodes": nodes, "connections": connections, "settings": {"executionOrder": "v1", "timezone": "Europe/Paris"}}

def recalcul(name, table_id, score_url, trigger=None, with_auth=True):
    trig = trigger or schedule("Toutes les heures (h:17)", 17, [0, 300])
    cfg = {"parameters": {"assignments": {"assignments": [
              {"id": U(), "name": "scoreUrl", "value": score_url, "type": "string"},
              {"id": U(), "name": "windowHours", "value": "={{ $now.setZone('Europe/Paris').hour === 3 ? 192 : 3 }}", "type": "number"},
              {"id": U(), "name": "retentionDays", "value": 400, "type": "number"}]},
            "options": {}},
           "id": U(), "name": "Config — Recalcul", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [220, 300]}
    nodes = [
        sticky(f"## {name}\nFILET DE SÉCURITÉ du scoring : recalcule depuis le journal les contacts actifs récemment "
               "(3 dernières heures ; chaque nuit à 3 h : 8 derniers jours) et envoie leur historique COMPLET à Vercel (/api/marketing/score).\n\n"
               "Rattrape tout ce que le temps réel aurait manqué (Brevo indisponible, écriture refusée, alerte non partie). "
               "Idempotent : un contact à jour ne provoque aucune écriture ; un score ne baisse jamais.\n"
               "Entretien : doublons du journal supprimés à chaque passe (la plus ancienne ligne de chaque clé est gardée) ; "
               "la nuit, lignes de plus de 400 jours supprimées (BEHAVIOR_SCORE ne baisse pas pour autant).\n\n"
               "Docs : althoce-ressources/docs/PHASE_MARKETING_N8N.md", [-40, -120], 820, 300),
        sticky(f"### Credential\n**Recalculer les scores (Vercel)** : Header Auth « {CRED_OUT} » (Authorization = Bearer SEQUENCE_API_SECRET).", [800, -120], 420, 160, 5),
        trig, cfg,
        dt("Événements récents", "get", table_id, [440, 300],
           {"matchType": "allConditions", "filters": {"conditions": [{"keyName": "createdAt", "condition": "gte",
             "keyValue": "={{ $now.minus({ hours: $('Config — Recalcul').first().json.windowHours }).toISO() }}"}]}, "returnAll": True}, always=True),
        {"parameters": {"jsCode": ACTIFS}, "id": U(), "name": "Contacts actifs", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 300]},
        dt("Historique complet", "get", table_id, [880, 300],
           {"matchType": "allConditions", "filters": {"conditions": [{"keyName": "contact_id", "condition": "eq", "keyValue": "={{ $json.contact_id }}"}]}, "returnAll": True}),
        {"parameters": {"jsCode": DOUBLONS}, "id": U(), "name": "Doublons du journal", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 120]},
        dt("Supprimer les doublons", "deleteRows", table_id, [1320, 120],
           {"matchType": "allConditions", "filters": {"conditions": [{"keyName": "id", "condition": "eq", "keyValue": "={{ $json.id }}"}]}, "options": {}}),
        {"parameters": {"jsCode": LOTS}, "id": U(), "name": "Lots pour Vercel", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 300]},
        http_vercel("Recalculer les scores (Vercel)", "={{ $('Config — Recalcul').first().json.scoreUrl }}", "={{ JSON.stringify({ rows: $json.rows }) }}", [1320, 300], with_auth),
        {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
             "conditions": [{"id": U(), "leftValue": "={{ $('Config — Recalcul').first().json.windowHours }}", "rightValue": 100, "operator": {"type": "number", "operation": "gt"}}],
             "combinator": "and"}, "options": {}},
         "id": U(), "name": "Passe de nuit ?", "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [440, 520]},
        dt("Conservation 400 jours", "deleteRows", table_id, [660, 520],
           {"matchType": "allConditions", "filters": {"conditions": [{"keyName": "occurred_at", "condition": "lt",
             "keyValue": "={{ $now.minus({ days: $('Config — Recalcul').first().json.retentionDays }).toISO() }}"}]}, "options": {}}),
    ]
    tn = trig["name"]
    connections = {
        tn: {"main": [[c("Config — Recalcul")]]},
        "Config — Recalcul": {"main": [[c("Événements récents"), c("Passe de nuit ?")]]},
        "Passe de nuit ?": {"main": [[c("Conservation 400 jours")], []]},
        "Événements récents": {"main": [[c("Contacts actifs")]]},
        "Contacts actifs": {"main": [[c("Historique complet")]]},
        "Historique complet": {"main": [[c("Doublons du journal"), c("Lots pour Vercel")]]},
        "Doublons du journal": {"main": [[c("Supprimer les doublons")]]},
        "Lots pour Vercel": {"main": [[c("Recalculer les scores (Vercel)")]]},
    }
    return {"name": name, "nodes": nodes, "connections": connections, "settings": {"executionOrder": "v1", "timezone": "Europe/Paris"}}

def maintenance(name, url, trigger=None, with_auth=True):
    trig = trigger or schedule("Toutes les heures (h:07)", 7, [0, 240])
    nodes = [
        sticky(f"## {name}\nUne fois par heure, Vercel (/api/marketing/maintenance) :\n"
               "1. lit le **quota d'envoi Brevo** du jour (offre Free : 300) et alerte UNE fois par jour sous 60 restants ;\n"
               "2. détecte les **RDV confirmés** (ETAT_RDV / STATUT_APPEL, contacts modifiés depuis 3 h) → +25 au score, une seule fois par contact.\n\n"
               f"**Credential** sur l'appel : Header Auth « {CRED_OUT} ».", [-40, -100], 720, 260),
        trig,
        {"parameters": {"assignments": {"assignments": [{"id": U(), "name": "maintenanceUrl", "value": url, "type": "string"}]}, "options": {}},
         "id": U(), "name": "Config — Tâches horaires", "type": "n8n-nodes-base.set", "typeVersion": 3.4, "position": [220, 240]},
        http_vercel("Lancer les tâches (Vercel)", "={{ $('Config — Tâches horaires').first().json.maintenanceUrl }}", "={{ JSON.stringify({}) }}", [440, 240], with_auth),
    ]
    connections = {trig["name"]: {"main": [[c("Config — Tâches horaires")]]}, "Config — Tâches horaires": {"main": [[c("Lancer les tâches (Vercel)")]]}}
    return {"name": name, "nodes": nodes, "connections": connections, "settings": {"executionOrder": "v1", "timezone": "Europe/Paris"}}

NAMES = {
    "althoce-sequences.json": "ALTHOCE | Marketing | Séquences guides et webinars — v1",
    "althoce-alertes-sequences.json": "ALTHOCE | Marketing | Alertes n8n — v1",
    "althoce-webinar-presences.json": "ALTHOCE | Webinar | Présences vers Brevo — v1",
    "althoce-journal-evenements.json": "ALTHOCE | Marketing | Journal des événements — v1",
    "althoce-recalcul-scores.json": "ALTHOCE | Marketing | Recalcul des scores — v1",
    "althoce-quota-rdv.json": "ALTHOCE | Marketing | Quota Brevo et RDV — v1",
}

def production(ids):
    table = ids.get("eventsTableId") or "À_RENSEIGNER"
    wfs = {
        "althoce-sequences.json": engine(NAMES["althoce-sequences.json"], STEP_URL_PROD, "althoce-sequences"),
        "althoce-alertes-sequences.json": alerts(NAMES["althoce-alertes-sequences.json"]),
        "althoce-webinar-presences.json": presences(NAMES["althoce-webinar-presences.json"]),
        "althoce-journal-evenements.json": journal(NAMES["althoce-journal-evenements.json"], table),
        "althoce-recalcul-scores.json": recalcul(NAMES["althoce-recalcul-scores.json"], table, f"{BASE_PROD}/api/marketing/score"),
        "althoce-quota-rdv.json": maintenance(NAMES["althoce-quota-rdv.json"], f"{BASE_PROD}/api/marketing/maintenance"),
    }
    if ids.get("alertWorkflowId"):
        for f, wf in wfs.items():
            if f != "althoce-alertes-sequences.json":
                wf["settings"]["errorWorkflow"] = ids["alertWorkflowId"]
    # Rattachement des credentials par identifiant (aucun secret : la valeur reste dans n8n)
    creds = ids.get("credentials") or {}
    for wf in wfs.values():
        for n in wf["nodes"]:
            if n["type"] == "n8n-nodes-base.webhook" and n["parameters"].get("authentication") == "headerAuth" and creds.get("vercelVersN8n"):
                n["credentials"] = {"httpHeaderAuth": {"id": creds["vercelVersN8n"], "name": CRED_IN}}
            if n["type"] == "n8n-nodes-base.httpRequest" and n["parameters"].get("genericAuthType") == "httpHeaderAuth" and creds.get("n8nVersVercel"):
                n["credentials"] = {"httpHeaderAuth": {"id": creds["n8nVersVercel"], "name": CRED_OUT}}
    return wfs

if __name__ == "__main__":
    repo = sys.argv[1]
    ids = json.load(open(os.path.join(repo, "n8n/instance.json")))
    for fname, wf in production(ids).items():
        open(f"{repo}/n8n/{fname}", "w").write(json.dumps(wf, ensure_ascii=False, indent=2) + "\n")
    print("ok")
