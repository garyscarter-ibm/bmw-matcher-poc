/*
 * Build fixtures/honda-cars.json from fixtures/honda-raw.json.
 *
 * Honda has no clean feed API to replay, so its stock is scraped from the
 * server-rendered listing pages (scripts/scrape-honda.mjs → honda-raw.json,
 * flat records) and then projected here through mapHondaRaw() into the engine's
 * already-mapped car schema — the SAME shape mapVehicle() produces for BMW/MINI
 * and the fixtures loader (server/stock.js) serves. This is the Honda analogue
 * of dump-stock.js's `--remap`: no network, just re-project the raw dump through
 * the current mapping so the fixtures stay in step when mapping.js changes.
 *
 * Run:  node scripts/build-honda-fixtures.mjs
 * In:   fixtures/honda-raw.json   (scrape output)
 * Out:  fixtures/honda-cars.json  (mapped cars the engine scores)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapHondaRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(REPO_ROOT, 'fixtures', 'honda-raw.json');
const OUT = join(REPO_ROOT, 'fixtures', 'honda-cars.json');

function main() {
  const raw = JSON.parse(readFileSync(RAW, 'utf8'));
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${RAW} is empty or not an array — run scripts/scrape-honda.mjs first`);
  }

  // Project, drop the priceless (unscorable on budget), and de-dupe by id so a
  // car that appeared on two sampled pages is counted once.
  const seen = new Set();
  const cars = [];
  for (const r of raw) {
    const car = mapHondaRaw(r);
    if (!car) continue; // no price → can't be scored on budget
    if (seen.has(car.id)) continue;
    seen.add(car.id);
    cars.push(car);
  }

  writeFileSync(OUT, JSON.stringify(cars, null, 0));
  process.stdout.write(`Mapped ${cars.length} Honda cars → ${OUT} (from ${raw.length} raw)\n`);

  // A quick readout: model spread and price band, so a bad scrape is obvious.
  const byLine = {};
  for (const c of cars) byLine[c.line] = (byLine[c.line] || 0) + 1;
  const prices = cars.map((c) => c.priceMin).sort((a, b) => a - b);
  process.stdout.write(`  lines: ${JSON.stringify(byLine)}\n`);
  process.stdout.write(`  price: £${prices[0]}–£${prices[prices.length - 1]} `
    + `(median £${prices[Math.floor(prices.length / 2)]})\n`);

  // Guard: every mapped car must carry the fields the engine scores, so a
  // schema drift fails the build rather than surfacing as a bad ranking later.
  const REQUIRED = ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
    'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb'];
  const bad = cars.find((c) => REQUIRED.some((k) => c[k] == null));
  if (bad) {
    throw new Error(`mapped car missing required field(s): ${JSON.stringify(bad)}`);
  }
}

main();
