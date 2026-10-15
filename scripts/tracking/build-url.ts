/**
 * Génère l'URL trackée d'un post LinkedIn ou d'une annonce payante, vers un guide ou un webinar.
 *
 *   Post LinkedIn (organique) :
 *   npm run utm -- --slug 12-cas-usage-experts-comptables --code EC --date 20261008 --n 1 \
 *                  --campaign guide_experts_comptables
 *
 *   Annonce payante (LinkedIn Ads ou Meta Ads : Facebook + Instagram) :
 *   npm run utm -- --webinar <slug> --ads meta --code FIN --date 20261105 --n 1 --campaign webinar_ia_finance
 *   → utm_source=meta (ou linkedin), utm_medium=paid_social, utm_content=AD_META_FIN_20261105_01
 *
 * Une valeur utm_content par post ou par annonce : c'est elle qui relie chaque inscrit à sa source.
 */

import { getLeadMagnet } from "@/config/leadMagnets";
import { getWebinar } from "@/config/webinars";
import { CONTENT_CODES, LINKEDIN_UTM_CONTENT_PATTERN, PAID_UTM_CONTENT_PATTERN } from "@/config/sourceRegistry";

const BASE_URL = "https://guide-gratuit-pi.vercel.app";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const webinarSlug = arg("webinar");
const slug = webinarSlug ?? arg("slug");
const ads = arg("ads")?.toLowerCase();
const code = (arg("code") ?? "").toUpperCase();
const date = arg("date") ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
const n = String(arg("n") ?? "1").padStart(2, "0");

if (webinarSlug ? getWebinar(webinarSlug)?.status !== "open" : !slug || !getLeadMagnet(slug)) {
  console.error(webinarSlug ? "--webinar inconnu ou non ouvert (voir config/webinars.ts)" : "--slug inconnu (voir config/leadMagnets.ts)");
  process.exit(1);
}
if (ads && ads !== "linkedin" && ads !== "meta") {
  console.error("--ads attend linkedin ou meta");
  process.exit(1);
}
if (!code) {
  console.error(`--code requis (codes connus : ${Object.keys(CONTENT_CODES).join(", ")})`);
  process.exit(1);
}

const campaign = arg("campaign") ?? slug!.replace(/-/g, "_");
const content = ads ? `AD_${ads === "meta" ? "META" : "LI"}_${code}_${date}_${n}` : `LI_${code}_${date}_${n}`;
const pattern = ads ? PAID_UTM_CONTENT_PATTERN : LINKEDIN_UTM_CONTENT_PATTERN;
if (!pattern.test(content)) {
  console.error(`utm_content invalide : ${content}`);
  process.exit(1);
}

const url = new URL(`/${webinarSlug ? "w" : "r"}/${slug}`, BASE_URL);
url.searchParams.set("utm_source", arg("source") ?? (ads === "meta" ? "meta" : "linkedin"));
url.searchParams.set("utm_medium", arg("medium") ?? (ads ? "paid_social" : "organic"));
url.searchParams.set("utm_campaign", campaign);
url.searchParams.set("utm_content", content);

console.log(`\n${url.toString()}\n`);
console.log(`utm_content : ${content}${CONTENT_CODES[code] ? ` (${CONTENT_CODES[code]})` : " (code non référencé dans CONTENT_CODES)"}`);
if (ads) {
  console.log("À coller tel quel comme URL de destination de l'annonce (une URL par annonce).");
} else {
  console.log("Une fois le post publié, ajouter son URL dans config/sourceRegistry.ts :");
  console.log(`  "${content}": { platform: "linkedin", url: "<URL du post>", campaign: "${campaign}", resource: "${slug}", publishedAt: "${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}" },\n`);
}
