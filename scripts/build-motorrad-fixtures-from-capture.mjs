/*
 * Build fixtures/motorrad-bikes.json from a REAL browser-captured feed response (the session-gated BMW Motorrad feed returns null to scripted requests). Its ResTable is a server-rendered HTML table, not JSON, so this runs the saved envelope through the live adapter's own path — motorradRowsFromEnvelope -> mapMotorradRaw — deriving nothing here; fix parser drift in motorrad-listing.js. Capture recipe in DECISIONS.md [motorrad-images]; accepts a raw envelope, a HAR, or a bare ResTable fragment.
 * Run:  node scripts/build-motorrad-fixtures-from-capture.mjs /tmp/motorrad-capture.json   ->  fixtures/motorrad-bikes.json
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

/* Accept either a raw feed response or a full HAR export; in a HAR, the feed body
 * lives under log.entries[].response.content.text on the ShowResults* request. */
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
// motorradRowsFromEnvelope returns already-flat raw records (it parses the HTML
// ResTable itself), so we map straight to the engine schema from here.
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
