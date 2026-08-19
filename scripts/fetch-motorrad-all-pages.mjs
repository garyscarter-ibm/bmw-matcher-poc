/*
 * Fetch the WHOLE BMW Motorrad approved-used deck by replaying a captured cURL (DevTools > the ShowResults request > Copy as cURL), which carries the session-bound GMB-SID a cold request lacks. Replays it once per page bumping ResOverviewData.selectedPage, reads totalItemCount off page 1, parses each HTML ResTable with the production parser (motorrad-listing.js), dedupes by offer id and maps through mapMotorradRaw. Build-time tool; a null page means the captured session expired — recapture the cURL and re-run.
 * Run:  node scripts/fetch-motorrad-all-pages.mjs /tmp/motorrad.curl   ->  fixtures/motorrad-bikes.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseResTable } from '../server/motorrad-listing.js';
import { mapMotorradRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'motorrad-bikes.json');

const curlPath = process.argv[2] || '/tmp/motorrad.curl';
const raw = readFileSync(curlPath, 'utf8');

/* Parse the copied cURL into { url, headers, body }, tolerating both multi-line and
 * single-line forms. Values are single-quoted; a literal ' is escaped by Chrome as '\'' — unwrap it. */
function parseCurl(text) {
  const unquote = (s) => s.replace(/^'/, '').replace(/'$/, '').replace(/'\\''/g, "'");
  const url =
    (text.match(/--url\s+'([^']*(?:'\\''[^']*)*)'/) || [])[1] ||
    (text.match(/curl\s+'([^']*(?:'\\''[^']*)*)'/) || [])[1];
  const headers = {};
  for (const m of text.matchAll(/-H\s+'([^']*(?:'\\''[^']*)*)'/g)) {
    const h = unquote(m[1]);
    const i = h.indexOf(':');
    if (i > 0) headers[h.slice(0, i).trim()] = h.slice(i + 1).trim();
  }
  const cookie = (text.match(/-b\s+'([^']*(?:'\\''[^']*)*)'/) || [])[1];
  if (cookie) headers.Cookie = unquote(cookie);
  const bodyM = text.match(/--data-raw\s+'([^']*(?:'\\''[^']*)*)'/);
  const body = bodyM ? unquote(bodyM[1]) : null;
  return { url: url && unquote(url), headers, body };
}

const { url, headers, body } = parseCurl(raw);
if (!url || !body) {
  console.error('Could not parse a URL and --data-raw body from the cURL.');
  console.error('Re-copy the ShowResults request as cURL and try again.');
  process.exit(2);
}

const bodyObj = JSON.parse(body);
const setPage = (n) => {
  const o = JSON.parse(JSON.stringify(bodyObj));
  o.ResOverviewData = { ...o.ResOverviewData, selectedPage: n };
  return JSON.stringify(o);
};

async function fetchPage(n) {
  const res = await fetch(url, { method: 'POST', headers, body: setPage(n) });
  if (!res.ok) throw new Error(`page ${n}: HTTP ${res.status}`);
  const env = await res.json();
  const table = env?.ResTable;
  const total = env?.ResOverviewData?.totalItemCount ?? null;
  if (table == null) {
    throw new Error(
      `page ${n}: null ResTable — the captured session has expired. ` +
        'Recapture the ShowResults cURL from the browser and re-run.',
    );
  }
  return { rows: parseResTable(table), total };
}

const byId = new Map();
const pageSize = bodyObj?.ResOverviewData?.pagingSize || 20;

// Page 1 tells us the real total, so we walk exactly the right number of pages.
process.stdout.write('page 1 ');
const first = await fetchPage(1);
for (const r of first.rows) if (r?.id) byId.set(r.id, r);
const total = first.total || first.rows.length;
const pages = Math.max(1, Math.ceil(total / pageSize));
console.log(`- ${first.rows.length} rows (total ${total}, ${pages} pages)`);

for (let n = 2; n <= pages; n += 1) {
  process.stdout.write(`page ${n} `);
  try {
    const { rows } = await fetchPage(n);
    let fresh = 0;
    for (const r of rows) {
      if (r?.id && !byId.has(r.id)) { byId.set(r.id, r); fresh += 1; }
    }
    console.log(`- ${rows.length} rows (+${fresh} new, ${byId.size} total)`);
  } catch (err) {
    console.error(`\n${err.message}`);
    console.error(`Stopping. ${byId.size} rows captured before the failure.`);
    break;
  }
}

const rawRows = [...byId.values()];
const bikes = rawRows.map(mapMotorradRaw).filter(Boolean);

// Same engine-validity gate as the other builders: fail loudly, never commit a
// broken fixture. Also surface any model line that fell to the default spec.
const lineCounts = {};
for (const b of bikes) {
  const problems = [];
  for (const f of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
    'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    if (b[f] === undefined || b[f] === null) problems.push(`missing ${f}`);
  }
  if (b.fuel === 'ev') {
    if (!(b.evRange > 0)) problems.push('ev with no evRange');
  } else if (!(b.mpg > 0)) problems.push('non-ev with no mpg');
  if (b.blurb.includes('\u2014')) problems.push('em dash in blurb');
  if (problems.length) {
    throw new Error(`fetch-all-pages: ${b.name} invalid: ${problems.join(', ')}`);
  }
  lineCounts[b.line] = (lineCounts[b.line] || 0) + 1;
}

writeFileSync(OUT, `${JSON.stringify(bikes, null, 2)}\n`);

const withPhoto = bikes.filter((b) => b.photo).length;
console.log(`\nWrote ${bikes.length} bikes to ${OUT}`);
console.log(`  ${withPhoto}/${bikes.length} carry a real listing photo`);
console.log(`  captured ${rawRows.length} unique rows, mapped ${bikes.length}`);
console.log('  by line:');
for (const [line, n] of Object.entries(lineCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${line}`);
}
