/*
 * Build fixtures/motorrad-bikes.json from a REAL captured feed response.
 *
 * The BMW Motorrad approved-used listing is a session-gated AngularJS app: its
 * feed (POST /api/ResultOverview/ShowResultsFilterChanged, authed with a GMB-SID
 * header the server binds to a live browser session + egress IP) answers a
 * scripted request from this environment with a null envelope. So the real rows,
 * and their real per-vehicle photos, can only be captured from a browser (see the
 * [motorrad-images] entry in DECISIONS.md for the recipe).
 *
 * The feed does return real data — but its `ResTable` is a server-rendered HTML
 * <table> string, one <tr> per bike, NOT a JSON array (that assumption is why the
 * old synthetic fixtures had no images: no field ever held a photo URL). This
 * script turns a capture into fixtures WITHOUT re-deriving anything: it runs the
 * saved envelope through the SAME production path the live adapter uses —
 * motorradRowsFromEnvelope (which parses the HTML ResTable) -> mapMotorradRaw —
 * so the committed snapshot is identical in shape to what the feed serves live,
 * real images and all. If the captured markup differs from what the parser reads,
 * fix it in motorrad-listing.js (one place, shared with the live adapter).
 *
 * Capture recipe (browser, one minute):
 *   1. Open https://approvedused.bmw-motorrad.co.uk/ and let the results load.
 *   2. DevTools > Network > filter "ShowResultsFilterChanged" (or "ShowResults").
 *   3. Right-click the request > Copy > Copy response  (or Save all as HAR).
 *   4. Paste the response into a file, e.g. /tmp/motorrad-capture.json. The
 *      response is a JSON envelope whose ResTable field is an HTML string; save
 *      it verbatim. (A HAR works too: this script digs the response body out.)
 *      A bare ResTable HTML fragment is also accepted (wrapped as an envelope).
 *
 * Run:  node scripts/build-motorrad-fixtures-from-capture.mjs /tmp/motorrad-capture.json
 * Out:  fixtures/motorrad-bikes.json  (mapped bikes the engine scores)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapMotorradRaw } from '../server/mapping.js';
import { motorradRowsFromEnvelope } from '../server/stock.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'motorrad-bikes.json');

const capturePath = process.argv[2];
if (!capturePath) {
  console.error('Usage: node scripts/build-motorrad-fixtures-from-capture.mjs <capture.json|.har>');
  console.error('See the header of this file for how to capture the feed response.');
  process.exit(2);
}

const text = readFileSync(capturePath, 'utf8');
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  // Not JSON — accept a bare ResTable HTML fragment and wrap it as an envelope,
  // so a capture saved as raw HTML (e.g. the test fixture) builds the same way.
  if (/<tr\b[^>]*\bergebnissColor\b/i.test(text)) {
    parsed = { SearchFilter: { ResTable: text } };
  } else {
    console.error(`Could not parse ${capturePath} as JSON, and it holds no`);
    console.error('ResTable rows (no ergebnissColor <tr>). Save the feed response');
    console.error('verbatim, or the ResTable HTML fragment on its own.');
    process.exit(1);
  }
}

/* Accept either a raw feed response or a full HAR export. In a HAR, the feed
 * response body is a string under log.entries[].response.content.text on the
 * ShowResults* request; dig it out and re-parse. */
function envelopeFrom(root) {
  if (root?.log?.entries) {
    const entry = root.log.entries.find((e) => /ShowResults/i.test(e?.request?.url || ''));
    const body = entry?.response?.content?.text;
    if (!body) {
      throw new Error('HAR had no ShowResults* response body — capture the feed request, not the page');
    }
    return JSON.parse(body);
  }
  return root;
}

const env = envelopeFrom(parsed);
// motorradRowsFromEnvelope now returns already-flat raw records: it parses the
// HTML ResTable (the real shape) itself, and projects a JSON array through
// motorradRowToRaw for us. So we map straight to the engine schema from here.
const rows = motorradRowsFromEnvelope(env);
if (rows.length === 0) {
  console.error('The capture held no vehicle rows. If SearchFilter is null, the');
  console.error('capture came from a request with no live session — recapture from');
  console.error('the browser AFTER the results grid has populated.');
  process.exit(1);
}

const bikes = rows.map(mapMotorradRaw).filter(Boolean);

// Same engine-validity gate as the synthetic builder: fail loudly rather than
// commit a broken fixture.
for (const b of bikes) {
  const problems = [];
  for (const f of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
    'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    if (b[f] === undefined || b[f] === null) problems.push(`missing ${f}`);
  }
  if (b.fuel === 'ev') {
    if (!(b.evRange > 0)) problems.push('ev with no evRange');
  } else if (!(b.mpg > 0)) problems.push('non-ev with no mpg');
  if (b.blurb.includes('—')) problems.push('em dash in blurb');
  if (problems.length) {
    throw new Error(`build-from-capture: ${b.name} invalid: ${problems.join(', ')}`);
  }
}

writeFileSync(OUT, `${JSON.stringify(bikes, null, 2)}\n`);

const withPhoto = bikes.filter((b) => b.photo).length;
console.log(`Wrote ${bikes.length} bikes to ${OUT}`);
console.log(`  ${withPhoto}/${bikes.length} carry a real listing photo`);
if (withPhoto < bikes.length) {
  console.log('  (rows without a photo field were mapped without one — check the');
  console.log('   image key in motorradRowToRaw against the captured row shape.)');
}
