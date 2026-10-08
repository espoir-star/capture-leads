import { test } from "node:test";
import assert from "node:assert/strict";
import { getLeadMagnet, LEAD_MAGNETS } from "@/config/leadMagnets";
import { getAllSlugs } from "@/lib/ressources";
import { SUBSECTORS, VERTICALS } from "@/config/taxonomy";
import { leadSchema } from "@/lib/validation/leadSchema";

test("chaque page /r/[slug] a son mapping Brevo, et inversement", () => {
  const pages = new Set(getAllSlugs());
  const configs = new Set(Object.keys(LEAD_MAGNETS));
  assert.deepEqual([...pages].filter((s) => !configs.has(s)), [], "pages sans mapping");
  assert.deepEqual([...configs].filter((s) => !pages.has(s)), [], "mappings sans page");
});

test("listes Brevo uniques, valeurs de taxonomie valides, TODO documentés", () => {
  const ids = Object.values(LEAD_MAGNETS).map((l) => l.brevoListId);
  assert.equal(new Set(ids).size, ids.length);
  for (const lm of Object.values(LEAD_MAGNETS)) {
    assert.equal(lm.slug, lm.resource);
    if (lm.vertical) assert.ok((VERTICALS as readonly string[]).includes(lm.vertical));
    if (lm.subsector) assert.ok((SUBSECTORS as readonly string[]).includes(lm.subsector));
    if (!lm.vertical || !lm.subsector) assert.match(lm.note, /TODO|sans cible métier/, lm.slug);
  }
});

test("page pilote : liste 10, FINANCE / EXPERTISE_COMPTABLE", () => {
  const lm = getLeadMagnet("12-cas-usage-experts-comptables");
  assert.equal(lm?.brevoListId, 10);
  assert.equal(lm?.vertical, "FINANCE");
  assert.equal(lm?.subsector, "EXPERTISE_COMPTABLE");
  assert.equal(getLeadMagnet("toString"), undefined, "pas de fuite du prototype");
});

const valid = {
  slug: "12-cas-usage-experts-comptables",
  prenom: "Claire",
  nom: "Martin",
  email: "claire@cabinet.fr",
  tel: "0645871239",
  pays: "FR",
  besoin: "DEPLOYER_AGENT_IA",
  horizon: "MOINS_3_MOIS",
};

test("schéma serveur : le navigateur ne peut imposer ni liste ni valeur hors référentiel", () => {
  const ok = leadSchema.parse({ ...valid, brevoListId: 99, listIds: [1] });
  assert.equal("brevoListId" in ok, false);
  assert.equal("listIds" in ok, false);
  assert.equal(leadSchema.safeParse({ ...valid, besoin: "HACK" }).success, false);
  assert.equal(leadSchema.safeParse({ ...valid, horizon: "" }).success, false);
  assert.equal(leadSchema.safeParse({ ...valid, pays: "XX" }).success, false);
  assert.equal(leadSchema.safeParse({ ...valid, slug: "../etc" }).success, false);
  assert.equal(leadSchema.safeParse({ ...valid, prenom: "<script>" }).success, false);
  assert.equal(leadSchema.safeParse({ ...valid, nom: "http://spam.example" }).success, false);
});
