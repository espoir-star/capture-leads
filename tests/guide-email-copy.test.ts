import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cases = [
  {
    name: "pilote experts-comptables",
    file: "emails/sequences/guide-12-cas-ec/delivery.html",
    guide: "https://espoir-metareglage.notion.site/12-cas-d-usage-concrets-de-Claude-pour-les-experts-comptables-3aac7d01a0e881caabc6c8d9d5555dc2",
    booking: "https://cal.com/althoce-conseil-4ncbuz/30min",
  },
  {
    name: "guide générique",
    file: "emails/sequences/generique/delivery.html",
    guide: "{{ params.GUIDE_URL }}",
    booking: "{{ params.CTA_URL }}",
  },
];

for (const entry of cases) {
  test(`email ${entry.name} : pas de bouton de confirmation d'adresse`, () => {
    const html = readFileSync(entry.file, "utf8");
    assert.doesNotMatch(html, /CONFIRM_URL|EMAIL_CONFIRM_TOKEN|confirmer-email|Confirmer mon adresse/i);
    assert.match(html, /Accéder au guide/);
    assert.match(html, /contact\.PRENOM/);
    // Le rendu conserve un nombre équilibré de blocs conditionnels du modèle.
    assert.equal((html.match(/\{%\s*if\b/g) ?? []).length, (html.match(/\{%\s*endif\s*%\}/g) ?? []).length);
  });

  test(`email ${entry.name} : téléchargement, RDV et désabonnement inchangés`, () => {
    const html = readFileSync(entry.file, "utf8");
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(links, [entry.guide, entry.booking, "{{ params.UNSUBSCRIBE_URL }}"]);
    assert.match(html, /Ne plus recevoir nos conseils par email/);
  });
}
