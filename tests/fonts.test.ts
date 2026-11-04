import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/fonts/geist-v1";

test("polices : Geist auto-hébergée, la compilation ne contacte plus Google Fonts", () => {
  // next/font/google téléchargeait les polices pendant la compilation et l'a fait échouer par intermittence
  for (const dir of ["app", "components", "lib"]) {
    for (const f of readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((p) => /\.(tsx?|css)$/.test(p))) {
      assert.doesNotMatch(readFileSync(join(dir, f), "utf8"), /from ["']next\/font|fonts\.googleapis\.com|fonts\.gstatic\.com/, join(dir, f));
    }
  }
});

test("polices : chaque règle @font-face pointe vers un fichier WOFF2 du dépôt, aucun fichier orphelin", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const urls = [...css.matchAll(/url\("(\/fonts\/[^"]+)"\)/g)].map((m) => m[1]);
  assert.equal(urls.length, 11, "5 sous-ensembles Geist + 6 Geist Mono, comme Google Fonts");
  for (const url of urls) {
    const file = join("public", url);
    assert.ok(existsSync(file), file);
    assert.equal(readFileSync(file).toString("latin1", 0, 4), "wOF2", file);
  }
  const files = readdirSync(DIR).filter((f) => f.endsWith(".woff2"));
  assert.deepEqual(files.map((f) => `/fonts/geist-v1/${f}`).sort(), [...urls].sort());
  assert.match(css, /--font-geist: "Geist", "Geist Fallback"/);
  assert.match(css, /--font-geist-mono: "Geist Mono", "Geist Mono Fallback"/);
  assert.match(readFileSync(join(DIR, "OFL.txt"), "utf8"), /Copyright 2024 The Geist Project Authors[\s\S]*SIL OPEN FONT LICENSE Version 1\.1/);
});

test("polices : sous-ensembles latins préchargés, cache d'un an sur /fonts", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const preloads = [...layout.matchAll(/"(\/fonts\/[^"]+\.woff2)"/g)].map((m) => m[1]);
  assert.deepEqual(preloads, ["/fonts/geist-v1/geist-latin.woff2", "/fonts/geist-v1/geist-mono-latin.woff2"]);
  for (const p of preloads) assert.ok(existsSync(join("public", p)), p);
  const config = readFileSync("next.config.mjs", "utf8");
  assert.match(config, /source: "\/fonts\/:path\*",\s*headers: \[\{ key: "Cache-Control", value: "public, max-age=31536000, immutable" \}\]/);
});
