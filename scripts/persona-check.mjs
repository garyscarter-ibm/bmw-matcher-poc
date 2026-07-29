/*
 * Persona replay — run every persona in fixtures/personas.json through a
 * LIVE matcher API and report what each of them would actually see.
 *
 * For each persona: the result state the page would render (decree / tie /
 * closest-here / unmet / empty), the lead cars, whether their stated wants
 * were honoured, and a deep-link hash for eyeballing the real page. The
 * narrative half of each persona (who they are, what success looks like)
 * lives in docs/personas.md; judgement against THAT stays human.
 *
 * Needs the API up:  cd server && PORT=8787 node index.js
 * Run:               node scripts/persona-check.mjs [key ...]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const API = process.env.MATCHER_API || 'http://localhost:8787';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { personas } = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'personas.json'), 'utf8'));
const only = process.argv.slice(2);
const selected = only.length ? personas.filter((p) => only.includes(p.key)) : personas;

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
};

/*
 * Below this the page stops calling the leader a match at all. Mirrors
 * WEAK_SCORE in blocks/bmw-matcher/bmw-matcher.js, which carries the
 * measurement behind the number; re-measure with `npm run audit conf`.
 */
const WEAK_SCORE = 68;

/** Mirror of the block's state test (docs/results-page-states.md). */
function stateOf(match, nearby) {
  if (!match.matches?.length) return '5 EMPTY';
  const fit = (match.matches[0].tradeOffs || []).length === 0;
  if (fit) {
    if (match.decisive) return '1 DECREE';
    // Fit tied, but their priorities picked a winner — the page names it.
    return match.tasteLead ? '2b TASTE PICK' : '2 FIT TIE';
  }
  const agreed = Object.entries(match.unmet || {}).some(([k, v]) =>
    v.some((x) => (nearby.unmet?.[k] || []).includes(x)));
  if (agreed) return '4 UNMET ANYWHERE';
  // The leader misses the brief AND is nowhere near it, so the page says so
  // rather than offering it as the closest thing.
  return match.matches[0].score < WEAK_SCORE ? '3b NOTHING HERE IS CLOSE' : '3 CLOSEST HERE';
}

for (const p of selected) {
  const { brand, retailer, answers } = p;
  let match; let nearby;
  try {
    [match, nearby] = await Promise.all([
      post('/api/match', { answers, retailer, brand }),
      post('/api/nearby', { answers, retailer, brand }),
    ]);
  } catch (err) {
    console.log(`\n${p.name} (${p.tagline}) — API ERROR: ${err.message}`);
    continue;
  }

  const state = stateOf(match, nearby);
  console.log(`\n${'='.repeat(72)}`);
  console.log(`${p.name} — ${p.tagline} [${brand} @ ${retailer}]  =>  STATE ${state}`);
  console.log(`  decisive: ${match.decisive}  cluster: ${match.clusterSize}  tasteLead: ${match.tasteLead}  retailer unmet: ${JSON.stringify(match.unmet)}`);

  for (const m of (match.matches || []).slice(0, 6)) {
    const paint = m.car.colour?.manufacturerColour || m.car.colour?.colour || 'colour n/a';
    const trades = (m.tradeOffs || []).map((t) => `${t.dim}:${t.got}`).join(',') || 'meets brief';
    console.log(`   ${String(m.score).padStart(3)}%  ${m.car.name.slice(0, 36).padEnd(36)} ${paint.padEnd(20)} ${trades}`);
  }
  const first = (nearby.nearby || [])[0];
  if (first) {
    console.log(`  nearby #1: ${first.score}% ${first.car.name.slice(0, 34)} (${first.car.distance ?? '?'} mi, ${first.car.retailerName || '?'})`);
  }

  const page = brand === 'mini' ? 'index-mini.html' : 'index.html';
  const hash = Buffer.from(JSON.stringify(answers)).toString('base64url');
  console.log(`  view: http://localhost:3000/${page}?api=${API}#m=${hash}`);
}
console.log();
