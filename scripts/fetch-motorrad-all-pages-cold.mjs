/*
 * Fetch the WHOLE BMW Motorrad approved-used deck COLD — no browser, no pasted
 * cURL. This supersedes fetch-motorrad-all-pages.mjs (which replayed a
 * human-captured cURL): the feed's GMB-SID session is not minted by JS, the
 * server embeds a fresh one in the results landing page as a hidden field
 * <input id="hfSID" value="…"> (UTF-16LE base64 of "<caller-ip>;<guid>"). So the
 * whole chain self-issues: GET the landing page, scrape #hfSID, send it as the
 * GMB-SID header, loop POST ShowResults by selectedPage. This is the same
 * self-mint the live adapter (server/stock.js mintMotorradSid) uses, wired to
 * full pagination + the shared parser/mapper so the committed fixture matches
 * what the live feed serves, real per-listing photos, cc and power included.
 *
 * Run:  node scripts/fetch-motorrad-all-pages-cold.mjs
 * Out:  fixtures/motorrad-bikes.json   (every mappable bike)
 *
 * Build-time tool, not a live server path. If a page returns a null ResTable the
 * minted session was refused (rare, egress-IP bound); just re-run.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseResTable } from '../server/motorrad-listing.js';
import { mapMotorradRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'motorrad-bikes.json');

const BASE = 'https://approvedused.bmw-motorrad.co.uk';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const PAGE_SIZE = 20;

/* Self-issue a GMB-SID: the landing page embeds a fresh one bound to this
 * caller's egress IP. No browser, no paste. (Mirror of server/stock.js.) */
async function mintSid() {
  const res = await fetch(`${BASE}/UK/ergebnisse.cshtml`, { headers: { 'User-Agent': UA } });
  const html = await res.text();
  const sid = (html.match(/id="hfSID"[^>]*value="([^"]*)"/) || [])[1];
  if (!sid) throw new Error('no #hfSID in landing page — the mint path changed');
  return sid;
}

const bodyFor = (page, total) => JSON.stringify({
  InitFilter: false, IsFirstCall: false, MarktId: '2', BuNo: '', Culture: 'en-gb',
  Segment: [], FuelType: [], Marke: 10, Modell: [], Fahrzeugart: 0, Antrieb: 0,
  EZV: 0, EZB: 0, PreisVon: '', PreisBis: '', KMVon: '', KMBis: '', KWVon: '', KWBis: '',
  PowerUnit: 'HP', Farbe1Auswahl: [], Merkmale: '', Umkreis: 1, UmkreisPLZ: '',
  AngebotsNo: '', DetailAngebotsNo: '', Sonderausstattung: '', isSondermodell: false,
  Pakete: '', FilterHMFAChanged: false, FilterEZChanged: 0, FilterColorChanged: false,
  ResOverviewData: {
    pagingSize: PAGE_SIZE, currResultCountToShow: PAGE_SIZE, selectedPage: page,
    totalItemCount: total, tableSortColumn: 16, tableSortDirection: 0, pageItemsToShow: 9,
  },
  DetailData: { RowNumber: 0 }, currRequest: 1,
});

async function fetchPage(sid, page, total) {
  const res = await fetch(`${BASE}/api/ResultOverview/ShowResults`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'GMB-SID': sid,
      Origin: BASE,
      Referer: `${BASE}/UK/ergebnisse.cshtml`,
      'User-Agent': UA,
    },
    body: bodyFor(page, total),
  });
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const env = await res.json();
  const table = env?.ResTable;
  if (table == null) {
    throw new Error(`page ${page}: null ResTable — minted session refused, re-run`);
  }
  return { rows: parseResTable(table), total: env?.ResOverviewData?.totalItemCount ?? total };
}

const sid = await mintSid();
console.log('minted GMB-SID cold (no browser)');

const byId = new Map();

process.stdout.write('page 1 ');
const first = await fetchPage(sid, 1, 963);
for (const r of first.rows) if (r?.id) byId.set(r.id, r);
const total = first.total || first.rows.length;
const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
console.log(`- ${first.rows.length} rows (total ${total}, ${pages} pages)`);

for (let n = 2; n <= pages; n += 1) {
  process.stdout.write(`page ${n} `);
  try {
    const { rows } = await fetchPage(sid, n, total);
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

// Same engine-validity gate as the other builders: never commit a broken fixture.
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
  if (b.blurb.includes('—')) problems.push('em dash in blurb');
  if (problems.length) {
    throw new Error(`fetch-all-pages-cold: ${b.name} invalid: ${problems.join(', ')}`);
  }
  lineCounts[b.line] = (lineCounts[b.line] || 0) + 1;
}

writeFileSync(OUT, `${JSON.stringify(bikes, null, 2)}\n`);

const withPhoto = bikes.filter((b) => b.photo).length;
const withCc = bikes.filter((b) => b.cc).length;
const withPower = bikes.filter((b) => b.power).length;
console.log(`\nWrote ${bikes.length} bikes to ${OUT}`);
console.log(`  ${withPhoto}/${bikes.length} carry a real listing photo`);
console.log(`  ${withCc}/${bikes.length} carry a real per-listing cc`);
console.log(`  ${withPower}/${bikes.length} carry a real per-listing power (kW)`);
console.log('  by line:');
for (const [line, n] of Object.entries(lineCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(n).padStart(3)}  ${line}`);
}
