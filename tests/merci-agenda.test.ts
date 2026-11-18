import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRE_AUDIT_BOOKING_EMBED, PRE_AUDIT_BOOKING_URL, getRdvPage } from "@/config/rdvPages";
import { CTA_URL } from "@/lib/sequences/links";

/** Code sans commentaires : seuls les textes affichés et les composants comptent. */
const code = (path: string) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const page = code("app/r/[slug]/merci/page.tsx");
const status = code("components/DeliveryStatus.tsx");

test("page merci : agenda du pré-audit affiché ouvert, plus de bouton pour lire le guide (Espoir, 18/11)", () => {
  assert.match(page, /<BookingCalendar embedUrl=\{PRE_AUDIT_BOOKING_EMBED\}/);
  assert.match(page, /id="creneaux"/);
  assert.match(page, /100 % gratuit/);
  assert.doesNotMatch(page, /GuideLink|Lire le guide|Accédez au guide/);
  assert.match(page, /dans votre boîte mail/);
});

test("page merci : le statut d'envoi ne renvoie plus vers un bouton ; lien de secours seulement si l'envoi échoue", () => {
  assert.doesNotMatch(status, /bouton/i);
  assert.match(status, /state === "failed" && fallbackHref/);
});

test("agenda du pré-audit : même agenda que les emails et les pages démo et pièces", () => {
  assert.equal(PRE_AUDIT_BOOKING_URL, CTA_URL);
  for (const slug of ["demo-agents-ia", "agent-pieces"]) {
    assert.equal(getRdvPage(slug)?.booking.embedUrl, PRE_AUDIT_BOOKING_EMBED, slug);
  }
});
