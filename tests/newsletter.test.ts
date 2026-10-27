import { test } from "node:test";
import assert from "node:assert/strict";
import { frontmatterSchema, loadNewsletter, renderMarkdown, renderNewsletterHtml } from "@/lib/newsletter";
import { WEBINARS } from "@/config/webinars";
import { AUDIENCES } from "@/config/newsletter";
import { isAnnouncementRecipient, listDiff } from "@/lib/newsletter/audienceList";

test("exemple versionné : frontmatter valide, statut brouillon", () => {
  const nl = loadNewsletter("content/newsletters/2026-11-03-finance.md");
  assert.equal(nl.name, "NL 2026-11-03-finance");
  assert.equal(nl.meta.status, "draft");
  assert.equal(nl.meta.audience, "finance");
  assert.equal(nl.meta.tag, "NL_FINANCE");
});

test("rendu : UTM sur les liens, blocs cas d'usage / insight, pas de HTML brut", () => {
  const html = renderMarkdown(
    "Intro [guide](https://althoce.com/x?utm_source=linkedin)\n\n:::usecase Relances clients\nTexte **gras**\n:::\n\n<script>alert(1)</script>",
    { utm_source: "brevo", utm_medium: "email", utm_campaign: "nl_test" }
  );
  assert.match(html, /utm_source=linkedin/);
  assert.doesNotMatch(html, /utm_source=brevo/, "UTM existant jamais doublé");
  assert.match(html, /utm_campaign=nl_test/);
  assert.match(html, /CAS D’USAGE/);
  assert.match(html, /Relances clients/);
  assert.doesNotMatch(html, /<script>/);
});

test("email complet : désinscription Brevo, CTA tracé, aucun marqueur restant", () => {
  const nl = loadNewsletter("content/newsletters/2026-11-03-finance.md");
  const html = renderNewsletterHtml(nl);
  assert.match(html, /\{\{ unsubscribe \}\}/);
  assert.match(html, /\{\{ mirror \}\}/);
  assert.match(html, /cal\.com\/althoce-conseil-4ncbuz\/30min\?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=nl_finance_20261103&amp;utm_content=cta/);
  assert.doesNotMatch(html, /%%[A-Z_]+%%/);
  assert.doesNotMatch(html, /<script/i);
});

const OCTOBER = [
  ["2026-10-19", "+02:00", "Actualité IA & Finance", "/g/tableaux-de-bord-claude-cabinets"],
  ["2026-10-21", "+02:00", "Conseil pratique", "/g/tableaux-de-bord-claude-cabinets"],
  ["2026-10-23", "+02:00", "Pourquoi Althoce ?", "/g/mini-diagnostic-ia-finance"],
  ["2026-10-26", "+01:00", "Actualité IA & Finance", "ai-act-service-desk.ec.europa.eu"],
  ["2026-10-28", "+01:00", "Conseil pratique", "/g/12-skills-claude-finance"],
  ["2026-10-30", "+01:00", "Pourquoi Althoce ?", "/g/mini-diagnostic-ia-finance"],
] as const;

// Seules les éditions dont la programmation a été explicitement accordée (les six : accords d'Espoir du 18/10).
const SCHEDULED_WITH_CONSENT = new Set(["2026-10-19", "2026-10-21", "2026-10-23", "2026-10-26", "2026-10-28", "2026-10-30"]);

test("newsletters d'octobre : brouillons Brevo, programmés seulement sur accord, Finance, 8 h 30 à Paris (heure d'hiver le 25/10), un seul CTA", () => {
  for (const [date, offset, rubric, ctaPart] of OCTOBER) {
    const nl = loadNewsletter(`content/newsletters/${date}-finance.md`);
    if (SCHEDULED_WITH_CONSENT.has(date)) assert.ok(["created", "scheduled"].includes(nl.meta.status), `${date} : ${nl.meta.status}`);
    else assert.equal(nl.meta.status, "created", `${date} : ${nl.meta.status}`);
    assert.equal(nl.meta.audience, "finance");
    assert.equal(nl.meta.tag, "NL_FINANCE");
    assert.equal(nl.meta.utmCampaign, `nl_finance_${date.replaceAll("-", "")}`);
    assert.equal(nl.meta.scheduledAt, `${date}T08:30:00${offset}`);
    assert.equal(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(nl.meta.scheduledAt!)), "08:30");
    assert.equal(nl.meta.rubric, rubric);
    assert.ok(nl.meta.cta?.url.includes(ctaPart), date);
    const html = renderNewsletterHtml(nl);
    assert.match(html, /\{\{ unsubscribe \}\}/);
    assert.match(html, new RegExp(`utm_campaign=nl_finance_${date.replaceAll("-", "")}&amp;utm_content=cta`));
    assert.equal((html.match(/background-color:#1D9E75;border-radius:8px/g) ?? []).length, 1, `${date} : un seul bouton`);
    assert.doesNotMatch(html, /%%[A-Z_]+%%/);
    assert.ok(html.includes(rubric.replace("&", "&amp;")), `${date} : rubrique affichée`);
  }
});

test("newsletters Althoce du vendredi : la ressource mène à l'échange, pas de lien de réservation", () => {
  for (const date of ["2026-10-23", "2026-10-30"]) {
    const html = renderNewsletterHtml(loadNewsletter(`content/newsletters/${date}-finance.md`));
    assert.doesNotMatch(html, /cal\.com/);
  }
});

test("annonce du connecteur Pennylane : toute la base envoyable, mardi 27/10 à 9 h, un seul CTA : rendez-vous avec un conseiller", () => {
  const nl = loadNewsletter("content/newsletters/2026-10-27-annonce.md");
  assert.equal(nl.meta.audience, "annonce");
  assert.equal(nl.meta.scheduledAt, "2026-10-27T09:00:00+01:00", "27/10 : heure d'hiver");
  assert.equal(nl.meta.cta?.url, "https://calendar.app.google/m6thfjDsXzEqKdkKA", "calendrier dédié aux connecteurs");
  assert.equal(AUDIENCES.annonce.segment, undefined);
  assert.equal(AUDIENCES.annonce.list?.name, "ANNONCES — BASE ENVOYABLE");
  assert.deepEqual(AUDIENCES.annonce.exclude.map((s) => s.name), ["DATA QUALITY — REJECTED"]);
  const html = renderNewsletterHtml(nl);
  assert.equal((html.match(/calendar\.app\.google\/m6thfjDsXzEqKdkKA/g) ?? []).length, 1, "un seul lien de rendez-vous");
  assert.match(html, /utm_campaign=lancement_connecteur_pennylane_20261027/);
  assert.doesNotMatch(nl.body, /—/, "pas de tiret long dans le corps");
});

test("liste d'annonce : seuls les contacts autorisés au marketing, hors recette ; le diff retire les opposés", () => {
  const c = (id: number, a: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ id, email: `c${id}@cabinet.fr`, emailBlacklisted: false, listIds: [] as number[], attributes: a, ...extra }) as never;
  const contacts = [
    c(1, { MARKETING_STATUS: "B2B_ELIGIBLE", VERTICAL: "FINANCE" }),
    c(2, { MARKETING_STATUS: "CONSENT", VERTICAL: "MARKETING" }),
    c(3, { MARKETING_STATUS: "TO_REVIEW" }),
    c(4, { MARKETING_STATUS: "OPPOSED" }, { listIds: [77] }),
    c(5, { MARKETING_STATUS: "B2B_ELIGIBLE" }, { emailBlacklisted: true }),
    c(6, { MARKETING_STATUS: "B2B_ELIGIBLE", EMAIL_STATUS: "BOUNCED" }),
    c(7, { MARKETING_STATUS: "B2B_ELIGIBLE", IS_QA: true }),
    c(8, { MARKETING_STATUS: "CONSENT" }, { listIds: [77] }),
  ];
  assert.deepEqual(contacts.filter(isAnnouncementRecipient).map((x: { id: number }) => x.id), [1, 2, 8]);
  assert.deepEqual(listDiff(contacts, 77), { add: [1, 2], remove: [4] });
  assert.deepEqual(listDiff(contacts, null), { add: [1, 2, 8], remove: [] }, "liste à créer : tout est à ajouter");
});

test("annonce du connecteur : vente sur rendez-vous, aucun prix ni essai dans le mail", () => {
  const nl = loadNewsletter("content/newsletters/2026-10-27-annonce.md");
  assert.doesNotMatch(nl.body, /€|essai|Tarif/i);
  assert.match(nl.body, /Un conseiller Althoce le branche avec vous sur votre cabinet/);
});

const WEBINAR_MAILS = [
  ["2026-10-29-annonce-webinar", "2026-10-29T09:00:00+01:00", "email_annonce"],
  ["2026-11-02-annonce-webinar-ecriture", "2026-11-02T09:00:00+01:00", "email_ecriture"],
  ["2026-11-03-annonce-webinar-relance", "2026-11-03T09:00:00+01:00", "email_relance"],
  ["2026-11-05-annonce-webinar-jour-j", "2026-11-05T08:00:00+01:00", "email_jour_j"],
] as const;

test("annonces du webinar du 5/11 : toute la base envoyable sauf les inscrits, avant le direct, encadré repris de la page", () => {
  const w = WEBINARS["connecteurs-mcp-cabinets"];
  for (const [file, scheduledAt, utmContent] of WEBINAR_MAILS) {
    const nl = loadNewsletter(`content/newsletters/${file}.md`);
    assert.equal(nl.meta.audience, "annonce", file);
    assert.equal(nl.meta.webinar, "connecteurs-mcp-cabinets", `${file} : inscrits exclus (liste ${w.brevoListId})`);
    assert.equal(nl.meta.scheduledAt, scheduledAt, file);
    assert.ok(Date.parse(scheduledAt) < Date.parse(w.startsAt), `${file} : avant le direct`);
    assert.equal(nl.meta.utmCampaign, "webinar_connecteurs_mcp_20261105", "même campagne que le lien LinkedIn wb1");
    assert.equal(nl.meta.utmContent, utmContent);
    assert.equal(nl.meta.cta?.url, "https://guide-gratuit-pi.vercel.app/w/connecteurs-mcp-cabinets");
    assert.doesNotMatch(nl.body, /—/, `${file} : pas de tiret long`);
    assert.match(nl.body, /Pennylane, ACD, Cegid Quadra, Cegid Loop, Sage et AGIRIS/, `${file} : Pennylane cité`);
    // Objectif : la présence en direct. Le replay n'est jamais mis en avant dans les invitations (demande d'Espoir, 27/10).
    assert.doesNotMatch(`${nl.meta.previewText} ${nl.body}`, /replay|enregistr/i, `${file} : pas de raison de ne pas venir`);
    const html = renderNewsletterHtml(nl);
    assert.equal((html.match(/background-color:#1D9E75;border-radius:8px/g) ?? []).length, 1, `${file} : un seul bouton`);
    assert.match(html, /w\/connecteurs-mcp-cabinets\?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=webinar_connecteurs_mcp_20261105&amp;utm_content=email_/);
    assert.ok(html.includes("Jeudi 5 novembre&nbsp;· 11\u00a0h – 12\u00a0h (heure de Paris)&nbsp;· Google Meet"), `${file} : date et horaire`);
    assert.match(html, /Espoir Mwami/);
    for (const img of ["/webinar/espoir-mwami.jpg", "/webinar/activateur-france-num.png", "/webinar/french-tech-bordeaux.png"]) {
      assert.ok(html.includes(`https://guide-gratuit-pi.vercel.app${img}`), `${file} : ${img} en URL absolue`);
    }
    assert.doesNotMatch(html, /%%[A-Z_]+%%/);
  }
  const annonce = loadNewsletter("content/newsletters/2026-10-29-annonce-webinar.md");
  assert.equal(w.agenda?.length, 4);
  for (const item of w.agenda ?? []) assert.ok(annonce.body.includes(item.replace(/\u00a0/g, " ")), `programme de la page : ${item}`);
});

test("frontmatter : un webinar inconnu est refusé", () => {
  const base = { title: "Titre", subject: "Objet", audience: "annonce", tag: "WEBINAR_FINANCE", utmCampaign: "x_1", status: "draft" };
  assert.equal(frontmatterSchema.safeParse({ ...base, webinar: "connecteurs-mcp-cabinets" }).success, true);
  assert.equal(frontmatterSchema.safeParse({ ...base, webinar: "inexistant" }).success, false);
});
