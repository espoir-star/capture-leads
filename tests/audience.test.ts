import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { audienceUrl } from "@/lib/tracking/audience";
import { SHORT_LINKS, shortLinkTarget } from "@/config/shortLinks";

const SITE = "https://guide-gratuit-pi.vercel.app";

test("audience : le post d'origine est rangé dans le chemin des pages suivies", () => {
  assert.equal(
    audienceUrl(`${SITE}/rdv/agent-pieces?utm_source=linkedin&utm_medium=organic&utm_campaign=agent_pieces_cabinet&utm_content=LI_EC_20261112_01`),
    `${SITE}/rdv/agent-pieces/via-LI_EC_20261112_01`,
  );
  // bouton « réserver » de la page 10 prompts : il reprend les UTM du post (SourceLink)
  assert.equal(
    audienceUrl(`${SITE}/rdv/audit-connecteurs?utm_source=linkedin&utm_campaign=10_prompts_production_cabinet&utm_content=LI_EC_20261103_01#creneaux`),
    `${SITE}/rdv/audit-connecteurs/via-LI_EC_20261103_01`,
  );
  // newsletter : pas d'utm_content, la campagne sert d'étiquette
  assert.equal(
    audienceUrl(`${SITE}/g/10-prompts-production-cabinet?utm_source=brevo&utm_medium=email&utm_campaign=nl_finance_20261117`),
    `${SITE}/g/10-prompts-production-cabinet/via-nl_finance_20261117`,
  );
  assert.equal(audienceUrl(`${SITE}/w/connecteurs-mcp-cabinets`), `${SITE}/w/connecteurs-mcp-cabinets`);
});

test("audience : chaque lien court diffusé arrive étiqueté avec son post", () => {
  for (const [code, l] of Object.entries(SHORT_LINKS)) {
    const target = shortLinkTarget(code);
    if (!target || !l.utm_content) continue;
    assert.ok(audienceUrl(SITE + target).endsWith(`/via-${l.utm_content}`), code);
  }
});

test("audience : jamais de paramètre, de jeton ni de valeur douteuse transmis", () => {
  assert.equal(audienceUrl(`${SITE}/desinscription?token=abc.def&email=x%40y.fr`), `${SITE}/desinscription`);
  assert.equal(audienceUrl(`${SITE}/confirmer-email?t=secret`), `${SITE}/confirmer-email`);
  assert.equal(audienceUrl(`${SITE}/?utm_content=LI_EC_20261112_01`), `${SITE}/`, "accueil : pas d'étiquette");
  assert.equal(audienceUrl(`${SITE}/rdv/agent-pieces?utm_content=%3Cscript%3E`), `${SITE}/rdv/agent-pieces`);
  assert.equal(audienceUrl(`${SITE}/rdv/agent-pieces?utm_campaign=jean.dupont@mail.fr`), `${SITE}/rdv/agent-pieces`);
  for (const url of [`${SITE}/g/x?utm_content=LI_A_1&t=jeton`, `${SITE}/rdv/x/?utm_content=LI_A_1`]) {
    assert.doesNotMatch(audienceUrl(url), /[?#=&]|jeton/);
  }
});

test("audience : l'outil Vercel est chargé sur tout le site, hors bannière cookies", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /<AudienceAnalytics \/>/);
  const component = readFileSync("components/AudienceAnalytics.tsx", "utf8");
  assert.match(component, /beforeSend=\{\(event\) => \(\{ \.\.\.event, url: audienceUrl\(event\.url\) \}\)\}/);
});
