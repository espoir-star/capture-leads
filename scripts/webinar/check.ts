/**
 * Contrôle de préparation d'un webinar, AVANT d'ouvrir les inscriptions et la
 * veille du direct. Lecture seule : rien n'est créé, envoyé ni modifié.
 *
 *   npm run webinar:check -- --slug ia-cabinet-2026-11 [--site https://…]
 *
 * Vérifie : bloc config/webinars.ts, liste Brevo, modèles #45–49 actifs,
 * attribut WEBINAR_ACTIVITY, séquence, lien court, puis sur le site déployé
 * (route protégée /api/webinar/status) : salle Meet et replay configurés dans
 * Vercel, enregistrement lisible sans compte Google. Aucune adresse de salle affichée.
 */
import { getWebinar } from "@/config/webinars";
import { getSequence, sequenceReady } from "@/config/sequences";
import { EMAIL_TEMPLATES } from "@/config/emailTemplates";
import { SHORT_LINKS } from "@/config/shortLinks";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { siteUrl } from "@/lib/sequences/links";
import { WEBINAR_ACTIVITY_ATTRIBUTE } from "@/lib/webinar/activity";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const slug = arg("slug");
const site = (arg("site") ?? siteUrl()).replace(/\/$/, "");
type Row = { ok: boolean | null; label: string; detail?: string };
const rows: Row[] = [];
const add = (ok: boolean | null, label: string, detail?: string) => rows.push({ ok, label, detail });

async function main() {
  if (!slug) throw new Error("Usage : npm run webinar:check -- --slug <slug> [--site https://…]");
  const w = getWebinar(slug, { ...process.env, VERCEL_ENV: process.env.VERCEL_ENV ?? "preview" });
  if (!w) throw new Error(`Aucun webinar « ${slug} » dans config/webinars.ts`);

  /* Configuration */
  const start = Date.parse(w.startsAt);
  add(/[+-]\d\d:\d\d$|Z$/.test(w.startsAt) && Number.isFinite(start), "Date ISO avec fuseau", w.startsAt);
  add(start > Date.now(), "Événement à venir", new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(start)) + " (Paris)");
  add(w.durationMin >= 30 && w.durationMin <= 180, "Durée", `${w.durationMin} min`);
  add(!!w.title && !!w.description && !!w.speaker && (w.agenda?.length ?? 0) >= 3, "Titre, description, intervenant, programme");
  add(w.platform === "google_meet", "Plateforme Google Meet");
  add(w.status === "open", "Statut « open » (inscriptions ouvertes)", w.status);
  add(w.sequence === "webinar-standard-v1" && !!getSequence(w.sequence) && sequenceReady(getSequence(w.sequence)!), "Séquence webinar-standard-v1 prête");
  const links = Object.entries(SHORT_LINKS).filter(([, l]) => l.kind === "webinar" && l.slug === slug);
  add(links.length > 0 ? true : null, "Lien court LinkedIn", links.map(([c, l]) => `/l/${c} → ${l.utm_content ?? "réservé"}`).join(", ") || "aucun (facultatif)");

  /* Brevo (lecture) */
  if (!getApiKey()) add(false, "Clé Brevo", "BREVO_API_KEY absente : contrôles Brevo sautés");
  else {
    const list = w.brevoListId > 0 ? await brevoRequest<{ name?: string }>(`/contacts/lists/${w.brevoListId}`) : null;
    add(!!list?.ok && list.data?.name === w.brevoListName, "Liste Brevo réelle", list?.ok ? `#${w.brevoListId} « ${list.data?.name} »` : `#${w.brevoListId} introuvable`);
    for (const key of ["webinar.confirmation", "webinar.j-1", "webinar.h-1", "webinar.replay", "webinar.suivi"] as const) {
      const def = EMAIL_TEMPLATES[key];
      const t = def.id ? await brevoRequest<{ isActive?: boolean; name?: string }>(`/smtp/templates/${def.id}`) : null;
      add(!!t?.ok && t.data?.isActive === true, `Modèle ${key}`, t?.ok ? `#${def.id} ${t.data?.isActive ? "actif" : "INACTIF"}` : `#${def.id} introuvable`);
    }
    const attrs = await brevoRequest<{ attributes?: { name: string }[] }>("/contacts/attributes");
    add(!!attrs.data?.attributes?.some((a) => a.name === WEBINAR_ACTIVITY_ATTRIBUTE), `Attribut ${WEBINAR_ACTIVITY_ATTRIBUTE} (suivi CRM)`, "npm run brevo:attributes -- --apply s'il manque");
  }

  /* Site déployé : salle et replay (variables Vercel), sans jamais afficher d'adresse */
  const secret = process.env.SEQUENCE_API_SECRET?.trim();
  if (!secret) add(false, "Statut du site", "SEQUENCE_API_SECRET absent : contrôle distant sauté");
  else {
    try {
      const res = await fetch(`${site}/api/webinar/status?slug=${slug}`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(15000) });
      const s = await res.json().catch(() => null) as null | { join?: { configured: boolean; variable: string }; replay?: { configured: boolean; variable: string; access?: string }; environment?: string; registrationOpen?: boolean };
      if (!res.ok || !s) add(false, "Statut du site", `${site} → HTTP ${res.status}`);
      else {
        add(s.registrationOpen === true, `Inscriptions ouvertes sur ${s.environment}`);
        add(!!s.join?.configured, "Salle Google Meet configurée", s.join?.variable);
        add(s.replay?.configured ? s.replay.access === "public_link" : null, "Replay",
          s.replay?.configured ? `${s.replay.variable} : ${s.replay.access === "public_link" ? "lisible sans compte Google" : "ACCÈS À VÉRIFIER (" + s.replay.access + ")"}` : "pas encore publié (normal avant le direct)");
      }
    } catch (e) {
      add(false, "Statut du site", e instanceof Error ? e.message : String(e));
    }
  }

  console.log(`\nWEBINAR ${slug} — contrôle de préparation (${site})\n`);
  for (const r of rows) console.log(`  ${r.ok === true ? "✓" : r.ok === false ? "✗" : "·"} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  const blocking = rows.filter((r) => r.ok === false);
  console.log(blocking.length ? `\nNO-GO : ${blocking.length} point(s) à corriger.\n` : "\nGO technique : configuration complète.\n");
  process.exitCode = blocking.length ? 1 : 0;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
