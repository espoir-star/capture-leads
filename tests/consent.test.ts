import { test, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

/* Faux navigateur minimal : localStorage, cookies, scripts insérés */
const store = new Map<string, string>();
const scripts: { id?: string; src?: string }[] = [];
let cookieJar: string[] = [];
const g = globalThis as Record<string, unknown>;
g.window = Object.assign(globalThis, { dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {} });
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
g.location = { hostname: "guide.althoce.com", origin: "https://guide.althoce.com", pathname: "/r/x", href: "https://guide.althoce.com/r/x" };
g.document = {
  title: "Test",
  referrer: "",
  head: { appendChild: (s: { id?: string; src?: string }) => scripts.push(s) },
  createElement: () => ({}),
  getElementById: (id: string) => scripts.find((s) => s.id === id) ?? null,
  get cookie() {
    return cookieJar.join("; ");
  },
  set cookie(v: string) {
    const [pair] = v.split(";");
    const [name] = pair.split("=");
    cookieJar = cookieJar.filter((c) => !c.startsWith(`${name}=`));
    if (!/Max-Age=0/.test(v)) cookieJar.push(pair.trim());
  },
};
g.CustomEvent = class { constructor(public type: string, public init?: unknown) {} };
process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST12345";

let consent: typeof import("@/lib/tracking/consent");
let marketing: typeof import("@/lib/tracking/marketing");
before(async () => {
  consent = await import("@/lib/tracking/consent");
  marketing = await import("@/lib/tracking/marketing");
});

const srcs = () => scripts.map((s) => s.src ?? "");
const has = (part: string) => srcs().some((s) => s.includes(part));

beforeEach(() => {
  store.clear();
  scripts.length = 0;
  cookieJar = [];
  delete (globalThis as Record<string, unknown>).fbq;
  delete (globalThis as Record<string, unknown>).gtag;
});

test("A · première visite sans choix : ESSENTIAL, aucun traceur chargé", () => {
  assert.equal(consent.readConsent(), null);
  assert.equal(consent.getCookieChoice(), "ESSENTIAL");
  marketing.initializeMarketingTrackers();
  assert.deepEqual(srcs(), [], "ni GA, ni Meta, ni Brevo");
});

test("B · Essentiels uniquement : aucun traceur", () => {
  consent.saveConsent("ESSENTIAL");
  marketing.initializeMarketingTrackers();
  assert.equal(has("googletagmanager"), false);
  assert.equal(has("fbevents"), false);
  assert.equal(has("brevo"), false);
});

test("C · Tout accepter : GA et Meta chargés (Brevo seulement si sa clé est configurée)", () => {
  consent.saveConsent("ALL");
  marketing.initializeMarketingTrackers();
  assert.equal(has("googletagmanager.com/gtag/js?id=G-TEST12345"), true);
  assert.equal(has("connect.facebook.net"), true);
  assert.equal(has("cdn.brevo.com"), false, "NEXT_PUBLIC_BREVO_CLIENT_KEY absente dans ce test");
});

test("stockage : structure, version, expiration ~6 mois", () => {
  const saved = consent.saveConsent("ALL", new Date("2026-10-08T10:00:00Z"));
  assert.deepEqual(Object.keys(saved).sort(), ["choice", "timestamp", "version"]);
  const raw = store.get(consent.COOKIE_CONSENT_KEY)!;
  assert.deepEqual(JSON.parse(raw), { version: 1, choice: "ALL", timestamp: "2026-10-08T10:00:00.000Z" });
  const day = 24 * 3600 * 1000;
  const t0 = Date.parse("2026-10-08T10:00:00Z");
  assert.equal(consent.parseConsent(raw, t0 + 30 * day)?.choice, "ALL");
  assert.equal(consent.parseConsent(raw, t0 + 183 * day), null, "expiré → bannière réaffichée");
  assert.equal(consent.parseConsent(JSON.stringify({ version: 2, choice: "ALL", timestamp: "2026-10-08T10:00:00Z" })), null);
  assert.equal(consent.parseConsent(JSON.stringify({ version: 1, choice: "YES", timestamp: "2026-10-08T10:00:00Z" })), null);
  assert.equal(consent.parseConsent("pas du json"), null);
});

test("F · Gérer mes cookies ALL → ESSENTIAL : plus de traceurs, cookies non essentiels supprimés", () => {
  consent.saveConsent("ALL");
  marketing.initializeMarketingTrackers();
  cookieJar = ["_ga=GA1.1.1", "_ga_TEST12345=GS1", "_fbp=fb.1.2", "session_utile=1"];
  consent.saveConsent("ESSENTIAL");
  marketing.disableMarketingTrackers();
  assert.deepEqual(cookieJar, ["session_utile=1"]);
  const before = scripts.length;
  marketing.initializeMarketingTrackers();
  assert.equal(scripts.length, before, "aucune réinitialisation après ESSENTIAL");
  assert.equal((globalThis as Record<string, unknown>)["ga-disable-G-TEST12345"], true);
});

test("anciennes clés de consentement nettoyées", () => {
  store.set("althoce-analytics-consent", "yes");
  consent.cleanupLegacyConsent();
  assert.equal(store.has("althoce-analytics-consent"), false);
  assert.equal(consent.getCookieChoice(), "ESSENTIAL", "l'ancienne case ne vaut pas « Tout accepter »");
});
