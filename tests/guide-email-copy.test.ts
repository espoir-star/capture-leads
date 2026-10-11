import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guide = "https://espoir-metareglage.notion.site/12-cas-d-usage-concrets-de-Claude-pour-les-experts-comptables-3aac7d01a0e881caabc6c8d9d5555dc2";
const booking = "https://cal.com/althoce-conseil-4ncbuz/30min";
const privacy = "https://althoce.com/confidentialite/";

for (const family of ["guide-12-cas-ec", "generique"]) {
  for (const file of ["delivery.html", "relance-j2.html"]) {
    const path = `emails/sequences/${family}/${file}`;
    const isGeneric = family === "generique";
    test(`${path} : vouvoiement, cabinet de conseil IA et trois accompagnements`, () => {
      const html = readFileSync(path, "utf8");
      const visible = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ");
      assert.match(visible, /cabinet de conseil en intelligence artificielle/i);
      for (const expected of [/l’audit de vos usages/, /la formation de vos équipes/, /l’intégration de solutions/]) assert.match(visible, expected);
      assert.doesNotMatch(visible, /\b(?:tu|ton|tes|ta|salut|bordeaux|agence)\b/i);
      assert.doesNotMatch(visible, /[\u{1F300}-\u{1FAFF}\u2705\uFE0F]/u);
      assert.match(html, /contact\.PRENOM/);
    });
    test(`${path} : guide, RDV, désabonnement et confidentialité conservés`, () => {
      const html = readFileSync(path, "utf8");
      const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(links, [isGeneric ? "{{ params.GUIDE_URL }}" : guide, isGeneric ? "{{ params.CTA_URL }}" : booking, "{{ params.UNSUBSCRIBE_URL }}", privacy]);
      assert.match(html, /Se désinscrire/);
      assert.doesNotMatch(html, /CONFIRM_URL|EMAIL_CONFIRM_TOKEN|confirmer-email|Confirmer mon adresse/i);
      assert.equal((html.match(/\{%\s*if\b/g) ?? []).length, (html.match(/\{%\s*endif\s*%\}/g) ?? []).length);
      assert.match(html, /max-width:620px/);
      assert.doesNotMatch(html, /<script|<iframe|<form|data:image/gi);
      assert.ok(Buffer.byteLength(html) < 30_000, "HTML léger, sans image embarquée");
    });
  }
}
