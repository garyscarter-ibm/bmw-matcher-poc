/*
 * Build fixtures/ferrari-cars.json from captured preowned.ferrari.com pages (their __NEXT_DATA__ ships the full inventory as public JSON; see server/ferrari-listing.js) run through the production mapFerrariRaw(). Model specs come from MODEL_SPECS_FERRARI; per-listing facts (price/mileage/year/colour/power/cc/dealer) are real; cover photo is a token-free Thron asset, single frame not the gallery. See DECISIONS.md [ferrari-data].
 * Run:  node scripts/build-ferrari-fixtures.mjs /tmp/ferrari-cap/page*.html   ->  fixtures/ferrari-cars.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseListingHtml } from '../server/ferrari-listing.js';
import { mapFerrariRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'ferrari-cars.json');

const pagePaths = process.argv.slice(2);
if (pagePaths.length === 0) {
  console.error('Usage: node scripts/build-ferrari-fixtures.mjs <page1.html> [page2.html ...]');
  console.error('See the header of this file for how to capture the pages.');
  process.exit(2);
}

const rawRecords = pagePaths.flatMap((p) => parseListingHtml(readFileSync(p, 'utf8')));
if (rawRecords.length === 0) {
  console.error('The captured pages held no listings. Recapture the result pages.');
  process.exit(1);
}

const seen = new Set();
const cars = [];
let noPrice = 0;
let noPhoto = 0;
for (const raw of rawRecords) {
  const car = mapFerrariRaw(raw);
  if (!car) { noPrice += 1; continue; } // mapFerrariRaw drops price-less records
  if (seen.has(car.id)) continue;
  seen.add(car.id);
  if (!car.photo) noPhoto += 1;
  cars.push(car);
}

// Same engine-validity gate as the Ford/Motorrad capture builders: combustion needs
// mpg>0, plug-in needs evRange>0, required fields all present, no em dash in user strings.
const REQUIRED = ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
  'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb'];
for (const c of cars) {
  const missing = REQUIRED.filter((k) => c[k] == null);
  if (missing.length) throw new Error(`ferrari car ${c.id} missing ${missing.join(',')}`);
  if ((c.fuel === 'ev' || c.fuel === 'phev') && !(c.evRange > 0)) {
    throw new Error(`ferrari ${c.fuel} ${c.id} has no evRange`);
  }
  if (c.fuel !== 'ev' && c.fuel !== 'phev' && !(c.mpg > 0)) {
    throw new Error(`ferrari ${c.fuel} ${c.id} has no mpg`);
  }
  if (String(c.blurb).includes('—')) throw new Error(`ferrari car ${c.id} has an em dash in blurb`);
}

writeFileSync(OUT, `${JSON.stringify(cars, null, 2)}\n`);

const byLine = {};
for (const c of cars) byLine[c.line] = (byLine[c.line] || 0) + 1;
const byBody = {};
for (const c of cars) byBody[c.body] = (byBody[c.body] || 0) + 1;
const byFuel = {};
for (const c of cars) byFuel[c.fuel] = (byFuel[c.fuel] || 0) + 1;
const withPhoto = cars.filter((c) => c.photo).length;
const withAge = cars.filter((c) => c.year).length;
const withCc = cars.filter((c) => c.cc).length;
const withPower = cars.filter((c) => c.power).length;
const prices = cars.map((c) => c.priceMin).sort((a, b) => a - b);
process.stdout.write(`Wrote ${cars.length} Ferrari cars to ${OUT} (from ${rawRecords.length} parsed rows)\n`);
process.stdout.write(`  ${withPhoto}/${cars.length} carry a real listing photo\n`);
process.stdout.write(`  ${withAge}/${cars.length} carry a registration year\n`);
process.stdout.write(`  ${withCc}/${cars.length} carry a displacement, ${withPower}/${cars.length} a power figure\n`);
process.stdout.write(`  bodies: ${JSON.stringify(byBody)}\n`);
process.stdout.write(`  fuel:   ${JSON.stringify(byFuel)}\n`);
process.stdout.write(`  lines:  ${JSON.stringify(byLine)}\n`);
process.stdout.write(`  price:  £${prices[0].toLocaleString()}-£${prices[prices.length - 1].toLocaleString()} `
  + `(median £${prices[Math.floor(prices.length / 2)].toLocaleString()})\n`);
if (noPrice) process.stdout.write(`  (dropped ${noPrice} price-less rows)\n`);
if (noPhoto) process.stdout.write(`  (${noPhoto} rows had no resolvable photo — gallery-gated, see header)\n`);
