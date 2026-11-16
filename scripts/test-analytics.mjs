import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = fs.readFileSync('lib/analytics.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let consent = null;
let cookies = '_ga=test; _ga_TEST=test; unrelated=keep';
const writes = [], scripts = [], window = {};
const document = { title: 'Contact | Althoce', referrer: 'https://example.com/page?email=private@example.com', getElementById: id => scripts.find(script => script.id === id), createElement: () => ({}), head: { appendChild: s => scripts.push(s) }, get cookie() { return cookies; }, set cookie(value) { writes.push(value); } };
const exports = {};
// Le consentement vient désormais de la bannière (lib/tracking/consent.ts) : « yes » = choix « Tout accepter »
const require = (id) => { if (id === '@/lib/tracking/consent') return { hasMarketingConsent: () => consent === 'yes' }; throw new Error(`module inattendu : ${id}`); };
vm.runInNewContext(code, { exports, require, process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST12345' } }, window, document, location: { href: 'https://althoce.com/contact/?email=private@example.com#secret', search: '?email=private@example.com', origin: 'https://althoce.com', hostname: 'althoce.com' }, localStorage: { getItem: () => consent }, URL, URLSearchParams, Date });
exports.trackPageView('/contact/'); exports.trackLead('contact');
assert.equal(scripts.length, 0, 'No Google script before consent');
consent = 'no'; exports.trackLead('contact'); assert.equal(scripts.length, 0);
consent = 'yes'; exports.trackPageView('/contact/'); exports.trackPageView('/contact/'); exports.trackPageView('/services/'); exports.trackLead('contact'); exports.trackLead('guide', 'finance-guide'); exports.trackLead('guide', 'private@example.com');
assert.equal(scripts.length, 1);
const commands = window.dataLayer.map(args => Array.from(args));
const pages = commands.filter(args => args[0] === 'event' && args[1] === 'page_view');
assert.equal(pages.length, 2, 'One page view per route, no duplicate initialization');
assert.equal(pages[1][2].page_referrer, 'https://althoce.com/contact/');
const leads = commands.filter(args => args[1] === 'generate_lead');
assert.equal(leads[1][2].resource_slug, 'finance-guide');
assert.equal(leads[2][2].resource_slug, undefined);
assert.ok(!JSON.stringify(commands).includes('private@'));
assert.ok(!JSON.stringify(commands).includes('#secret'));
assert.equal(commands.find(args => args[0] === 'config')[2].send_page_view, false);
exports.revokeAnalytics(); consent = 'no';
const count = window.dataLayer.length; exports.trackLead('contact');
assert.equal(window.dataLayer.length, count);
assert.equal(window['ga-disable-G-TEST12345'], true);
assert.ok(writes.some(value => value.startsWith('_ga=')));
assert.ok(!writes.some(value => value.startsWith('unrelated=')));
console.log('GA4: consent, page deduplication, lead events, URL sanitization and withdrawal passed. No external requests.');

consent = 'yes'; exports.trackPageView('/contact/'); assert.equal(scripts.length, 1, 'Reaccepting does not insert a second script');

// Parcours vers l'agenda : les UTM (identifiant du post) passent, jamais un jeton, une adresse ni le fragment
{
  let ok = null;
  const w2 = {}, s2 = [];
  const doc2 = { title: 'RDV | Althoce', referrer: 'https://www.linkedin.com/feed/?trk=private', getElementById: id => s2.find(s => s.id === id), createElement: () => ({}), head: { appendChild: s => s2.push(s) }, cookie: '' };
  const ex2 = {};
  const req2 = (id) => { if (id === '@/lib/tracking/consent') return { hasMarketingConsent: () => ok === 'yes' }; throw new Error(`module inattendu : ${id}`); };
  const href = 'https://guide-gratuit-pi.vercel.app/rdv/agent-pieces?utm_source=linkedin&utm_medium=organic&utm_campaign=agent_pieces_cabinet&utm_content=LI_EC_20261112_01&t=jeton-prive&email=a%40b.fr#creneaux';
  vm.runInNewContext(code, { exports: ex2, require: req2, process: { env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST12345' } }, window: w2, document: doc2, location: { href, search: new URL(href).search, origin: 'https://guide-gratuit-pi.vercel.app', hostname: 'guide-gratuit-pi.vercel.app' }, localStorage: { getItem: () => ok }, URL, URLSearchParams, Date });
  ex2.trackJourney('agenda_vu', 'agent-pieces');
  assert.equal(s2.length, 0, 'Aucune étape mesurée sans consentement');
  ok = 'yes';
  ex2.trackPageView('/rdv/agent-pieces');
  ex2.trackJourney('agenda_vu', 'agent-pieces');
  ex2.trackJourney('agenda_clic', 'agent-pieces');
  ex2.trackJourney('clic_rdv', 'private@example.com');
  const cmds = w2.dataLayer.map(args => Array.from(args));
  const expected = 'https://guide-gratuit-pi.vercel.app/rdv/agent-pieces?utm_source=linkedin&utm_medium=organic&utm_campaign=agent_pieces_cabinet&utm_content=LI_EC_20261112_01';
  assert.equal(cmds.find(a => a[0] === 'config')[2].page_location, expected);
  assert.equal(cmds.find(a => a[1] === 'page_view')[2].page_location, expected);
  assert.equal(cmds.find(a => a[1] === 'agenda_vu')[2].rdv_slug, 'agent-pieces');
  assert.equal(cmds.find(a => a[1] === 'agenda_clic')[2].page_location, expected);
  assert.equal(cmds.filter(a => a[1] === 'clic_rdv').length, 0, 'Slug invalide : rien envoyé');
  const all = JSON.stringify(cmds);
  for (const leak of ['jeton', 'a%40b', 'a@b', '#creneaux', 'trk=']) assert.ok(!all.includes(leak), leak);
  console.log('GA4 : UTM conservés, jetons et adresses retirés, étapes du parcours après consentement uniquement.');
}
