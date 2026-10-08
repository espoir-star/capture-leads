/**
 * Génère l'URL trackée d'un post (LinkedIn par défaut).
 *
 *   npm run utm -- --slug 12-cas-usage-experts-comptables --code EC --date 20261008 --n 1 \
 *                  --campaign guide_experts_comptables
 *
 * → https://guide-gratuit-pi.vercel.app/r/12-cas-usage-experts-comptables?utm_source=linkedin&utm_medium=organic&utm_campaign=guide_experts_comptables&utm_content=LI_EC_20261008_01
 */

import { getLeadMagnet } from "@/config/leadMagnets";
import { CONTENT_CODES, LINKEDIN_UTM_CONTENT_PATTERN } from "@/config/sourceRegistry";

const BASE_URL = "https://guide-gratuit-pi.vercel.app";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const slug = arg("slug");
const code = (arg("code") ?? "").toUpperCase();
const date = arg("date") ?? new Date().toISOString().slice(0, 10).replace(/-/g, "");
const n = String(arg("n") ?? "1").padStart(2, "0");

if (!slug || !getLeadMagnet(slug)) {
  console.error("--slug inconnu (voir config/leadMagnets.ts)");
  process.exit(1);
}
if (!code) {
  console.error(`--code requis (codes connus : ${Object.keys(CONTENT_CODES).join(", ")})`);
  process.exit(1);
}

const campaign = arg("campaign") ?? slug.replace(/-/g, "_");
const content = `LI_${code}_${date}_${n}`;
if (!LINKEDIN_UTM_CONTENT_PATTERN.test(content)) {
  console.error(`utm_content invalide : ${content} (attendu LI_[CODE]_[AAAAMMJJ]_[NN])`);
  process.exit(1);
}

const url = new URL(`/r/${slug}`, BASE_URL);
url.searchParams.set("utm_source", arg("source") ?? "linkedin");
url.searchParams.set("utm_medium", arg("medium") ?? "organic");
url.searchParams.set("utm_campaign", campaign);
url.searchParams.set("utm_content", content);

console.log(`\n${url.toString()}\n`);
console.log(`utm_content : ${content}${CONTENT_CODES[code] ? ` (${CONTENT_CODES[code]})` : " (code non référencé dans CONTENT_CODES)"}`);
console.log("Une fois le post publié, ajouter son URL dans config/sourceRegistry.ts :");
console.log(`  "${content}": { platform: "linkedin", url: "<URL du post>", campaign: "${campaign}", resource: "${slug}", publishedAt: "${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}" },\n`);
