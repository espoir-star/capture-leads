import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leadSchema } from "@/lib/validation/leadSchema";
import { buildContactUpdate } from "@/lib/lead/contactUpdate";
import { checkPhone } from "@/lib/data-quality/phone";
import { DEMO_WEBINAR, WEBINARS, getWebinar } from "@/config/webinars";
import { getSequence } from "@/config/sequences";
import { nextStep, registeredAfter, staleAfterMs, stepAt } from "@/lib/sequences/plan";
import { signEnrollment, type Enrollment } from "@/lib/sequences/enrollment";
import { runStep } from "@/lib/sequences/run";
import { webinarContactParams, webinarParams } from "@/lib/sequences/links";
import { attendanceLabel, mergeWebinarActivity, readWebinarActivity } from "@/lib/webinar/activity";
import { joinEnvName, replayEnvName, webinarJoinUrl, webinarReplayUrl } from "@/lib/webinar/urls";
import { isAutomatedRequest } from "@/lib/webinar/scanner";
import { registrationOpen } from "@/lib/webinar/access";

process.env.SIGNING_SECRET ??= "secret-de-test-webinar-system";
const H = 3_600_000;
const seq = getSequence("webinar-standard-v1")!;
const step = (id: string) => seq.steps.find((s) => s.id === id)!;

/* ── Formulaire court ─────────────────────────────────────────────── */

const webinarInput = { kind: "webinar", slug: "ia-cabinet-2026-11", prenom: "Paul", nom: "Durand", email: "paul@cabinet.fr" };
const guideInput = { slug: "12-cas-usage-experts-comptables", prenom: "Claire", nom: "Martin", email: "c@cabinet.fr", tel: "0645871239", pays: "FR", besoin: "DEPLOYER_AGENT_IA", horizon: "MOINS_3_MOIS" };

test("formulaire webinar : prénom, nom, email suffisent ; entreprise facultative et contrôlée", () => {
  const ok = leadSchema.parse(webinarInput);
  assert.equal(ok.kind, "webinar");
  assert.equal(ok.entreprise, undefined);
  assert.equal(leadSchema.parse({ ...webinarInput, entreprise: "  " }).entreprise, undefined, "vide = non renseignée");
  assert.equal(leadSchema.parse({ ...webinarInput, entreprise: "Cabinet Durand & Associés" }).entreprise, "Cabinet Durand & Associés");
  for (const bad of ["<b>x</b>", "https://spam.example", "www.spam.example", "x".repeat(121)]) {
    assert.equal(leadSchema.safeParse({ ...webinarInput, entreprise: bad }).success, false, bad);
  }
  for (const f of ["prenom", "nom"] as const) assert.equal(leadSchema.safeParse({ ...webinarInput, [f]: "" }).success, false, f);
});

test("formulaire webinar : téléphone, besoin et horizon envoyés quand même → ignorés (aucun projet fabriqué)", () => {
  const v = leadSchema.parse({ ...webinarInput, tel: "0645871239", pays: "FR", besoin: "DEPLOYER_AGENT_IA", horizon: "IMMEDIAT" });
  assert.equal(v.besoin, undefined);
  assert.equal(v.horizon, undefined);
  assert.equal(v.tel, undefined);
});

test("formulaire guide inchangé : téléphone, pays, besoin et horizon toujours obligatoires", () => {
  assert.equal(leadSchema.safeParse(guideInput).success, true);
  for (const f of ["tel", "pays", "besoin", "horizon"] as const) {
    const { [f]: _omit, ...rest } = guideInput;
    void _omit;
    const r = leadSchema.safeParse(rest);
    assert.equal(r.success, false, f);
    assert.ok(!r.success && r.error.issues.some((i) => i.path[0] === f), f);
  }
});

/* ── Attributs Brevo ──────────────────────────────────────────────── */

const source = { slug: "ia-cabinet-2026-11", resource: "ia-cabinet-2026-11", brevoListId: 50, vertical: "FINANCE" as const, subsector: "EXPERTISE_COMPTABLE" as const };
const capture = (over = {}) => ({
  kind: "webinar" as const, prenom: "Paul", nom: "Durand", marketingOpposition: false,
  phone: { status: "INVALID" as const, reason: "empty" as const }, attribution: {}, source, now: new Date("2026-11-01T10:00:00Z"), ...over,
});

test("inscription webinar : déclaration de projet existante jamais touchée, entreprise écrite, score formulaire conservé", () => {
  const existing = { id: 7, email: "paul@cabinet.fr", emailBlacklisted: false, listIds: [], attributes: {
    BESOIN_PRIORITAIRE: "AUTOMATISER_PROCESS", HORIZON_PROJET: "MOINS_3_MOIS", INTENT_UPDATED_AT: "2026-10-01T08:00:00.000Z", FORM_SCORE: 12, LEAD_SCORE: 12 } };
  const u = buildContactUpdate(existing, { ...capture(), entreprise: "Cabinet Durand" });
  for (const k of ["BESOIN_PRIORITAIRE", "HORIZON_PROJET", "INTENT_UPDATED_AT", "SMS", "PHONE_STATUS", "RESSOURCE"]) assert.equal(u.attributes[k], undefined, k);
  assert.equal(u.attributes.ENTREPRISE, "Cabinet Durand");
  assert.equal(u.formScore, 0);
  assert.equal(u.attributes.FORM_SCORE, undefined, "FORM_SCORE jamais abaissé");
  assert.equal(u.leadScore, 12);
  assert.equal(u.attributes.LAST_QUALIFYING_ACTIVITY_TYPE, "WEBINAR_REGISTERED");
});

test("inscription webinar d'un nouveau contact : aucun besoin ni horizon fictif, jamais CONSENT", () => {
  const u = buildContactUpdate(null, capture());
  assert.equal(u.attributes.BESOIN_PRIORITAIRE, undefined);
  assert.equal(u.attributes.HORIZON_PROJET, undefined);
  assert.equal(u.attributes.ENTREPRISE, undefined, "entreprise absente : rien d'écrit");
  assert.notEqual(u.marketingStatus, "CONSENT");
  assert.equal(buildContactUpdate(null, capture({ marketingOpposition: true })).marketingStatus, "OPPOSED");
  assert.equal(checkPhone("", "FR").e164, undefined);
});

/* ── Rappels et replay ────────────────────────────────────────────── */

const EVENT = Date.parse("2026-11-20T12:30:00+01:00");
const enr = (registeredMsBefore: number, extra: Partial<Enrollment> = {}): Enrollment =>
  ({ s: seq.id, c: 42, t: EVENT - registeredMsBefore, r: DEMO_WEBINAR.slug, e: EVENT, ...extra });

test("inscription tardive : aucun rappel déjà passé, jamais de « C'est demain » juste après la confirmation", () => {
  assert.equal(nextStep(seq, enr(30 * H), null, EVENT - 30 * H)?.step.id, "rappel-j-1", "inscrit 30 h avant : J-1 prévu");
  assert.equal(nextStep(seq, enr(20 * H), null, EVENT - 20 * H)?.step.id, "rappel-h-1", "inscrit 20 h avant : J-1 sauté");
  assert.equal(nextStep(seq, enr(30 * 60_000), null, EVENT - 30 * 60_000)?.step.id, "replay", "inscrit 30 min avant : J-1 et H-1 sautés");
  assert.equal(registeredAfter(enr(20 * H), step("rappel-j-1")), true);
  assert.equal(registeredAfter(enr(20 * H), step("rappel-h-1")), false);
});

test("rappels jamais en retard : J-1 au plus tard la veille au soir, H-1 au plus tard 30 min avant, jamais après le début", () => {
  const e = enr(48 * H);
  assert.equal(staleAfterMs(seq, e, step("rappel-j-1")), 12 * H);
  assert.equal(staleAfterMs(seq, e, step("rappel-h-1")), 30 * 60_000);
  const h1 = stepAt(e, step("rappel-h-1"))!;
  assert.ok(h1 + staleAfterMs(seq, e, step("rappel-h-1")) < EVENT, "H-1 abandonné avant le début");
  assert.equal(nextStep(seq, e, "rappel-j-1", EVENT - 20 * 60_000)?.step.id, "replay", "n8n en retard : H-1 sauté");
});

test("replay : attendu jusqu'au suivi J+3 (pas d'abandon à J+20 h), puis le suivi part même sans replay", () => {
  const e = enr(48 * H);
  assert.equal(staleAfterMs(seq, e, step("replay")), (72 - 20) * H);
  assert.equal(nextStep(seq, e, "rappel-h-1", EVENT + 50 * H)?.step.id, "replay", "replay toujours candidat à J+50 h");
  assert.equal(nextStep(seq, e, "replay", EVENT + 72 * H)?.step.id, "suivi");
});

test("runStep replay non publié : nouvel essai 3 h plus tard (aucun envoi, aucun appel réseau)", async () => {
  const id = signEnrollment(enr(48 * H));
  assert.ok(id);
  const now = new Date(EVENT + 21 * H);
  const r = await runStep(id, "replay", now);
  assert.deepEqual(r, { action: "wait", stepId: "replay", at: new Date(now.getTime() + 3 * H).toISOString() });
});

/* ── Salle Meet et replay hors dépôt ──────────────────────────────── */

test("salle Meet et replay : variables d'environnement, formats stricts, jamais dans la configuration publique", () => {
  assert.equal(joinEnvName("ia-cabinet-2026-11"), "WEBINAR_JOIN_URL__IA_CABINET_2026_11");
  assert.equal(replayEnvName("ia-cabinet-2026-11"), "WEBINAR_REPLAY_URL__IA_CABINET_2026_11");
  const env = (v: string) => ({ WEBINAR_JOIN_URL__X: v, WEBINAR_REPLAY_URL__X: v });
  assert.equal(webinarJoinUrl("x", env("https://meet.google.com/abc-defg-hij")), "https://meet.google.com/abc-defg-hij");
  for (const bad of ["http://meet.google.com/abc-defg-hij", "https://meet.google.com.evil.example/abc-defg-hij", "https://evil.example/?u=https://meet.google.com/abc-defg-hij", "https://meet.google.com/abc-defg-hij/../x", ""]) {
    assert.equal(webinarJoinUrl("x", env(bad)), undefined, bad);
  }
  assert.ok(webinarReplayUrl("x", env("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view")));
  assert.ok(webinarReplayUrl("x", env("https://www.youtube.com/watch?v=abcdef123")));
  assert.equal(webinarReplayUrl("x", env("https://dropbox.com/s/abc")), undefined);
  // Dépôt public : aucune salle ni aucun enregistrement dans les fichiers versionnés.
  for (const f of ["config/webinars.ts", "docs/WEBINAIRES.md"]) assert.doesNotMatch(readFileSync(f, "utf8"), /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}|drive\.google\.com\/file\/d\/[\w-]{10,}/, f);
  for (const w of Object.values(WEBINARS)) assert.equal("joinUrl" in w || "replayUrl" in w, false, w.slug);
});

test("emails : liens personnels uniquement, heure de Paris, replay signalé seulement s'il est publié", () => {
  const p = webinarParams(DEMO_WEBINAR.slug, 42)!;
  assert.match(p.JOIN_URL, /\/w\/demonstration-webinar\/rejoindre\?t=w1\./);
  assert.equal(p.REPLAY_AVAILABLE, undefined);
  assert.equal(p.WEBINAR_TIME, "12 h 30");
  assert.match(p.WEBINAR_DATE, /décembre 2026/);
  assert.doesNotMatch(JSON.stringify(p), /meet\.google|drive\.google/);
});

/* ── Participation ────────────────────────────────────────────────── */

const W = { slug: "ia-cabinet-2026-11", title: "IA au cabinet", startsAt: "2026-11-20T12:30:00+01:00" };
const at = (iso: string) => new Date(iso);

test("participation : inscrit, lien ouvert, présence confirmée, replay, présence inconnue — jamais confondus", () => {
  const reg = mergeWebinarActivity(null, W, { registeredAt: at("2026-11-01T10:00:00Z"), source: { utm_source: "linkedin", utm_campaign: "w1" } });
  assert.equal(attendanceLabel(reg), "Présence inconnue");
  const opened = mergeWebinarActivity(reg, W, { joinOpenedAt: at("2026-11-20T11:20:00Z") });
  assert.equal(opened.attendance, "UNKNOWN", "un clic ne prouve pas la présence");
  assert.equal(attendanceLabel(opened), "Lien de connexion ouvert (présence non certifiée)");
  const replay = mergeWebinarActivity(opened, W, { replayViewedAt: at("2026-11-21T09:00:00Z") });
  assert.equal(replay.attendance, "UNKNOWN", "un replay n'est pas une présence au direct");
  const confirmed = mergeWebinarActivity(replay, W, { attended: { at: at("2026-11-20T13:30:00Z"), proof: "poll" } });
  assert.equal(attendanceLabel(confirmed), "Présence confirmée");
  assert.equal(confirmed.attendanceProof, "poll");
  const again = mergeWebinarActivity(confirmed, W, { joinOpenedAt: at("2026-11-20T12:00:00Z"), registeredAt: at("2026-11-02T10:00:00Z"), source: { utm_source: "autre" } });
  assert.equal(again.attendance, "CONFIRMED", "jamais rétrogradée");
  assert.equal(again.registeredAt, "2026-11-01T10:00:00.000Z", "première inscription conservée");
  assert.equal(again.joinOpenedAt, "2026-11-20T11:20:00.000Z");
  assert.equal(again.source?.utm_source, "linkedin", "provenance de l'inscription conservée");
  const other = mergeWebinarActivity(again, { ...W, slug: "autre-webinar" }, { registeredAt: at("2026-12-01T10:00:00Z") });
  assert.equal(other.attendance, "UNKNOWN", "autre webinar : nouveau suivi");
  assert.equal(readWebinarActivity({ WEBINAR_ACTIVITY: JSON.stringify(confirmed) })?.attendance, "CONFIRMED");
  assert.equal(readWebinarActivity({ WEBINAR_ACTIVITY: "pas du json" }), null);
});

test("emails replay et suivi : « merci d'avoir participé » seulement avec une présence confirmée ; projet à court terme mis en avant", () => {
  const confirmed = JSON.stringify(mergeWebinarActivity(null, { ...W, slug: DEMO_WEBINAR.slug }, { attended: { at: at("2026-12-03T13:00:00Z"), proof: "qa" } }));
  const opened = JSON.stringify(mergeWebinarActivity(null, { ...W, slug: DEMO_WEBINAR.slug }, { joinOpenedAt: at("2026-12-03T11:20:00Z") }));
  assert.deepEqual(webinarContactParams({ WEBINAR_ACTIVITY: confirmed }, DEMO_WEBINAR.slug), { ATTENDED: "true" });
  assert.deepEqual(webinarContactParams({ WEBINAR_ACTIVITY: opened }, DEMO_WEBINAR.slug), {}, "lien ouvert ≠ présence");
  assert.deepEqual(webinarContactParams({ HORIZON_PROJET: "MOINS_3_MOIS" }, DEMO_WEBINAR.slug), { HAS_PROJECT: "true" });
  assert.deepEqual(webinarContactParams({ HORIZON_PROJET: "SIX_DOUZE_MOIS" }, DEMO_WEBINAR.slug), {});
  assert.deepEqual(webinarContactParams({ HORIZON_PROJET: "IMMEDIAT" }, "guide-inconnu"), {});
  const replay = readFileSync("emails/sequences/webinar/replay.html", "utf8");
  const suivi = readFileSync("emails/sequences/webinar/suivi.html", "utf8");
  for (const html of [replay, suivi]) assert.doesNotMatch(html, /manqué|absent/i, "jamais « vous avez manqué » sans preuve");
  assert.match(replay, /\{% if params\.ATTENDED %\}/);
  assert.match(replay, /\{% if params\.RESOURCE_1_URL %\}/);
  assert.match(suivi, /\{% if params\.HAS_PROJECT %\}/);
  for (const f of ["confirmation", "rappel-j-1", "rappel-h-1"]) assert.match(readFileSync(`emails/sequences/webinar/${f}.html`, "utf8"), /heure de Paris/, f);
});

test("scanners de messagerie : HEAD et robots ne comptent pas ; un navigateur, si", () => {
  const h = (ua?: string) => new Headers(ua ? { "user-agent": ua } : {});
  assert.equal(isAutomatedRequest(h("Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36"), "HEAD"), true);
  for (const ua of [undefined, "Mozilla/5.0 (compatible; Barracuda Sentinel)", "Mimecast", "python-requests/2.31", "Microsoft Office Existence Discovery", "LinkedInBot/1.0"]) {
    assert.equal(isAutomatedRequest(h(ua), "GET"), true, String(ua));
  }
  assert.equal(isAutomatedRequest(h("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1"), "GET"), false);
});

test("inscriptions : ouvertes jusqu'à la fin du direct ; recette E2E jamais en Production", () => {
  const w = { startsAt: "2026-11-20T12:30:00+01:00", durationMin: 60 };
  assert.equal(registrationOpen(w, new Date(EVENT + 59 * 60_000)), true);
  assert.equal(registrationOpen(w, new Date(EVENT + 60 * 60_000)), false);
  assert.equal(getWebinar("webinar-e2e", { VERCEL_ENV: "production", WEBINAR_E2E_STARTS_AT: "2026-11-20T12:30:00+01:00" }), undefined);
  assert.equal(getWebinar("webinar-e2e", { VERCEL_ENV: "preview" }), undefined);
  assert.equal(getWebinar("webinar-e2e", { WEBINAR_E2E_STARTS_AT: "2026-11-20T12:30:00+01:00" })?.status, "open");
});

test("enregistrement annoncé avant l'inscription et dans la confirmation (consentement Meet exigé)", () => {
  for (const f of ["app/w/[slug]/page.tsx", "app/w/[slug]/confirmation/page.tsx", "emails/sequences/webinar/confirmation.html"]) {
    assert.match(readFileSync(f, "utf8").replace(/\s+/g, " "), /webinar est enregistré/, f);
  }
});

test("webinar de recette interne : réservé aux adresses Althoce, contacts QA, page non indexée", async () => {
  const { isInternalTester, WEBINARS: all } = await import("@/config/webinars");
  for (const ok of ["espoir+webinartest@contact.althoce.com", "Tony@Althoce.fr", "x@althoce.com"]) assert.equal(isInternalTester(ok, {}), true, ok);
  for (const no of ["prospect@cabinet.fr", "espoir@contact.althoce.com.evil.example", "althoce.fr@gmail.com"]) assert.equal(isInternalTester(no, {}), false, no);
  assert.equal(isInternalTester("qa@cabinet.fr", { ALTHOCE_SEQUENCE_QA_EMAILS: "qa@cabinet.fr" }), true);
  const t = all["test-parcours-webinaire"];
  assert.equal(t.internalTest, true);
  assert.equal(t.brevoListId, 20);
  assert.match(t.startsAt, /\+02:00$/, "23/10 : heure d'été");
  assert.match(readFileSync("app/w/[slug]/page.tsx", "utf8"), /w\.internalTest\) && \{ robots: \{ index: false/);
  assert.match(readFileSync("lib/lead/capture.ts", "utf8"), /internalTest\) update\.attributes\.IS_QA = true/);
});

test("score : les liens de service d'un webinar (connexion, replay, agenda) ne rapportent aucun point de clic", async () => {
  const { classifyClick } = await import("@/lib/scoring/behavior");
  for (const url of [
    "https://guide-gratuit-pi.vercel.app/w/test-parcours-webinaire/rejoindre?t=w1.abc",
    "https://guide-gratuit-pi.vercel.app/w/test-parcours-webinaire/replay?t=w1.abc",
    "https://guide-gratuit-pi.vercel.app/w/test-parcours-webinaire/agenda.ics",
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=x",
  ]) assert.equal(classifyClick(url), null, url);
  assert.equal(classifyClick("https://guide-gratuit-pi.vercel.app/w/test-parcours-webinaire"), "content_click", "la page d'inscription reste un contenu");
  assert.equal(classifyClick("https://cal.com/althoce-conseil-4ncbuz/30min"), "offer_click");
});
