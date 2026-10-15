import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_WEBINAR, getWebinar, getWebinarPageSlugs, type WebinarConfig } from "@/config/webinars";
import { createWebinarToken, googleCalendarUrl, joinState, personalWebinarLinks, readWebinarToken, webinarIcs } from "@/lib/webinar/access";
import { PAID_UTM_CONTENT_PATTERN } from "@/config/sourceRegistry";

process.env.SIGNING_SECRET ??= "secret-de-test-webinar";

const W: WebinarConfig = {
  ...DEMO_WEBINAR,
  slug: "ia-cabinet-test",
  title: "IA, cabinet; test",
  status: "open",
  startsAt: "2026-12-03T12:30:00+01:00",
  durationMin: 45,
  joinUrl: "https://meet.google.com/abc-defg-hij",
  replayUrl: "https://drive.google.com/file/d/replay-test/view",
};
const BASE = "https://qa.althoce.example";

test("lien personnel : jeton chiffré, lié au contact, au webinar et à l'usage", () => {
  const t = createWebinarToken(42, W.slug, "join")!;
  assert.match(t, /^w1\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(t, /42|ia-cabinet/);
  assert.equal(readWebinarToken(t, W.slug, "join"), 42);
  assert.equal(readWebinarToken(t, "autre-webinar", "join"), null, "autre webinar");
  assert.equal(readWebinarToken(t, W.slug, "replay"), null, "autre usage");
  const altered = t.slice(0, -2) + (t.endsWith("AA") ? "BB" : "AA");
  assert.equal(readWebinarToken(altered, W.slug, "join"), null, "jeton altéré");
  for (const bad of [undefined, "", "w1.", "x".repeat(700), 42]) assert.equal(readWebinarToken(bad, W.slug, "join"), null);
  assert.equal(createWebinarToken(0, W.slug, "join"), undefined);
});

test("fenêtre d'accès : 15 min avant, fin + 30 min ; un antivirus à la livraison du rappel H-1 ne compte pas", () => {
  const start = Date.parse(W.startsAt);
  assert.equal(joinState(W, new Date(start - 60 * 60_000)), "too_early");
  assert.equal(joinState(W, new Date(start - 16 * 60_000)), "too_early");
  assert.equal(joinState(W, new Date(start - 15 * 60_000)), "open");
  assert.equal(joinState(W, new Date(start + (45 + 30) * 60_000)), "open");
  assert.equal(joinState(W, new Date(start + (45 + 31) * 60_000)), "ended");
});

test("emails : liens personnels de connexion et de replay, jamais la salle Meet en clair", () => {
  const links = personalWebinarLinks(W, 42, BASE);
  assert.match(links.JOIN_URL!, /^https:\/\/qa\.althoce\.example\/w\/ia-cabinet-test\/rejoindre\?t=w1\./);
  assert.match(links.REPLAY_URL!, /\/w\/ia-cabinet-test\/replay\?t=w1\./);
  assert.doesNotMatch(JSON.stringify(links), /meet\.google|drive\.google/);
  assert.equal(readWebinarToken(new URL(links.JOIN_URL!).searchParams.get("t"), W.slug, "join"), 42);
  assert.equal(personalWebinarLinks({ ...W, replayUrl: undefined }, 42, BASE).REPLAY_URL, undefined);
});

test("agenda : .ics conforme (UTC, CRLF, lignes ≤ 75 octets, échappement) et Google Agenda, sans lien de connexion", () => {
  const ics = webinarIcs(W, BASE, new Date("2026-11-01T10:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /DTSTART:20261203T113000Z\r\n/);
  assert.match(ics, /DTEND:20261203T121500Z\r\n/);
  assert.ok(ics.includes("SUMMARY:IA\\, cabinet\\; test — Webinar Althoce\r\n"), "échappement , et ;");
  assert.match(ics, /TRIGGER:-PT15M/);
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.doesNotMatch(ics.replace(/\r\n /g, ""), /meet\.google|rejoindre/);
  const g = new URL(googleCalendarUrl(W, BASE));
  assert.equal(g.searchParams.get("dates"), "20261203T113000Z/20261203T121500Z");
  assert.doesNotMatch(g.toString(), /meet\.google/);
});

test("démonstration : visible hors Production seulement, jamais ouverte aux inscriptions", () => {
  assert.equal(DEMO_WEBINAR.status, "draft");
  assert.equal(getWebinar(DEMO_WEBINAR.slug, { VERCEL_ENV: "preview" })?.slug, DEMO_WEBINAR.slug);
  assert.equal(getWebinar(DEMO_WEBINAR.slug, { VERCEL_ENV: "production" }), undefined);
  assert.deepEqual(getWebinarPageSlugs({ VERCEL_ENV: "production" }), []);
  assert.ok(getWebinarPageSlugs({ VERCEL_ENV: "preview" }).includes(DEMO_WEBINAR.slug));
});

test("annonces payantes : identifiant AD_[LI|META]_CODE_AAAAMMJJ_NN", () => {
  for (const ok of ["AD_META_FIN_20261105_01", "AD_LI_EC_20261105_12"]) assert.match(ok, PAID_UTM_CONTENT_PATTERN);
  for (const bad of ["AD_TIKTOK_FIN_20261105_01", "LI_EC_20261105_01", "AD_META_FIN_2026115_01"]) assert.doesNotMatch(bad, PAID_UTM_CONTENT_PATTERN);
});
