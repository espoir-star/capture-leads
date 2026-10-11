import { test } from "node:test";
import assert from "node:assert/strict";
import { alertParams, fallbackAlertHtml, type InternalAlert } from "@/lib/brevo/internalAlert";
import { EMAIL_TEMPLATES } from "@/config/emailTemplates";

const base: InternalAlert = {
  subject: "[Lead chaud] Léa — Cabinet <Test> (score 27)",
  title: "Un contact vient de passer le seuil",
  rows: [{ label: "Entreprise", value: "Cabinet <Test>" }],
  items: ["2026-10-11 — Clic offre (+10)"],
  link: { url: "https://app.brevo.com/contact/index/1", label: "Ouvrir la fiche" },
  tag: "alerte-lead-chaud",
  idempotencyKey: "hot.x",
};

test("alerte interne : passe par le modèle Brevo 40 (délivré en 2 s, contre 6 h pour du HTML brut)", () => {
  assert.equal(EMAIL_TEMPLATES["interne.alerte"].id, 40);
});

test("paramètres : valeurs brutes (échappées par Brevo), bornées, lien https uniquement", () => {
  const p = alertParams(base);
  assert.deepEqual(p.ROWS, [{ LABEL: "Entreprise", VALUE: "Cabinet <Test>" }]);
  assert.equal(p.LINK_URL, "https://app.brevo.com/contact/index/1");
  assert.equal(alertParams({ ...base, link: { url: "javascript:alert(1)", label: "x" } }).LINK_URL, undefined);
  const long = alertParams({ ...base, rows: Array.from({ length: 50 }, (_, i) => ({ label: `L${i}`, value: "v".repeat(900) })) });
  assert.equal((long.ROWS as unknown[]).length, 20);
  assert.equal(((long.ROWS as { VALUE: string }[])[0].VALUE).length, 500);
  assert.equal(alertParams({ ...base, intro: undefined, items: [] }).ITEMS, undefined);
});

test("repli HTML (modèle absent) : tout est échappé", () => {
  const html = fallbackAlertHtml(base);
  assert.match(html, /Cabinet &lt;Test&gt;/);
  assert.doesNotMatch(html, /<Test>/);
  assert.equal(fallbackAlertHtml({ ...base, link: { url: "http://x", label: "x" } }).includes("http://x"), false);
});
