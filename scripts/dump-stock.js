/*
 * Dump full national used stock for a brand to fixtures/<brand>-raw.json (raw feed) and <brand>-cars.json (run through mapVehicle) — point-in-time snapshots for offline engine validation/tuning, NOT a live source. Zero-dep node:https, paginates the whole national feed past the app's PAGE_LIMIT. `--remap` skips the network and re-projects the existing raw dump through the current mapVehicle (use after mapping.js gains a field, when you don't want the cars to change).
 * Run:  node scripts/dump-stock.js [bmw|mini|all] [--remap]
 */

import { request } from 'node:https';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BRANDS, normalizeBrand } from '../server/brands.js';
import { mapVehicle } from '../server/mapping.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_PAGES = 200; // national feeds are ~130 pages of 100; generous ceiling
const PAGE_SIZE = 100; // the platform's max page size
const PAGE_DELAY_MS = 400; // be polite — the feed 429s on a fast burst
const MAX_RETRIES = 5; // per page, backing off, when rate-limited

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'GET', headers: { 'User-Agent': USER_AGENT, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(20_000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function csrfFrom(setCookie) {
  for (const c of (Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean))) {
    const m = /(?:^|;\s*)csrftoken=([^;]+)/.exec(c);
    if (m) return m[1];
  }
  return null;
}

async function dumpBrand(brand) {
  const { origin, label } = BRANDS[brand];
  // Bootstrap the CSRF cookie from the site root (the list endpoint is gated).
  const root = await httpsGet(`${origin}/`, { Accept: 'text/html' });
  const token = csrfFrom(root.headers['set-cookie']);
  if (!token) throw new Error(`${label}: no csrftoken from ${origin}`);

  const headers = {
    Accept: 'application/json', Cookie: `csrftoken=${token}`, 'X-CSRFToken': token, Referer: `${origin}/`,
  };
  // Fetch one page with backoff on 429 (the feed rate-limits a fast burst).
  const fetchPage = async (page) => {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const res = await httpsGet(`${origin}/vehicle/api/list/?size=${PAGE_SIZE}&page=${page}`, headers);
      if (res.status === 200) return JSON.parse(res.body);
      if (res.status === 429) {
        const wait = 2000 * (attempt + 1); // linear backoff: 2s, 4s, 6s…
        process.stdout.write(`\r  ${label}: page ${page} rate-limited, waiting ${wait / 1000}s…   `);
        await sleep(wait);
        continue;
      }
      throw new Error(`${label}: list/ HTTP ${res.status} on page ${page}`);
    }
    throw new Error(`${label}: still rate-limited on page ${page} after ${MAX_RETRIES} tries`);
  };

  const vehicles = [];
  let totalPages = 1;
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page += 1) {
    const data = await fetchPage(page);
    if (page === 1) totalPages = Math.min(data.pagination?.total || 1, MAX_PAGES);
    vehicles.push(...(data.results || []));
    process.stdout.write(`\r  ${label}: page ${page}/${totalPages} (${vehicles.length} vehicles)      `);
    await sleep(PAGE_DELAY_MS);
  }
  process.stdout.write('\n');

  const cars = vehicles.map((v) => mapVehicle(v, brand)).filter(Boolean);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${brand}-raw.json`), JSON.stringify(vehicles, null, 2));
  writeFileSync(join(OUT_DIR, `${brand}-cars.json`), JSON.stringify(cars, null, 2));
  console.log(`  ${label}: wrote ${vehicles.length} raw + ${cars.length} mapped → fixtures/${brand}-{raw,cars}.json`);
}

/*
 * Re-project the existing raw dump through the CURRENT mapVehicle with no network
 * (--remap) — same point-in-time cars, new columns, for when mapping.js gains a field.
 */
function remapBrand(brand) {
  const { label } = BRANDS[brand];
  const vehicles = JSON.parse(readFileSync(join(OUT_DIR, `${brand}-raw.json`), 'utf8'));
  const cars = vehicles.map((v) => mapVehicle(v, brand)).filter(Boolean);
  writeFileSync(join(OUT_DIR, `${brand}-cars.json`), JSON.stringify(cars, null, 2));
  console.log(`  ${label}: re-mapped ${vehicles.length} raw → ${cars.length} cars (no network) → fixtures/${brand}-cars.json`);
}

const args = process.argv.slice(2).map((a) => a.toLowerCase());
const remap = args.includes('--remap');
const arg = args.find((a) => !a.startsWith('--')) || 'all';
const brands = arg === 'all' ? Object.keys(BRANDS) : [normalizeBrand(arg)];
for (const b of brands) {
  if (remap) remapBrand(b);
  // eslint-disable-next-line no-await-in-loop
  else await dumpBrand(b);
}
