/*
 * Build fixtures/ford-cars.json from a REAL captured feed response.
 *
 * Ford's live approved-used feed (servicescache.ford.com/api/eUsed/v1) turned out
 * to be reachable after all — the historical HTTP 000 "Akamai block" was a missing
 * browser header block, not a hard edge drop (see the [ford-feed-is-live-reachable]
 * memo). With the full header set plus the x-eusl-consumer / x-eusl-k pair the POST
 * /searchVehicles endpoint returns real listings, real per-listing photos included.
 *
 * We do NOT run an ongoing live adapter for Ford (the x-eusl-k token is minted
 * client-side and expires; we do not forge it). Instead this script bakes a ONE-OFF
 * legitimate capture into the committed fixtures, the same way
 * build-motorrad-fixtures-from-capture.mjs does: it projects each nested API record
 * to the FLAT-raw shape mapFordRaw() reads, then runs it through mapFordRaw() — the
 * exact production projection — so the snapshot is identical in shape to what a live
 * Ford adapter would emit, real images/prices/registration dates and all. Model
 * figures (boot, seats, 0-62, sizeClass, mpg/evRange) come from MODEL_SPECS_FORD in
 * server/mapping.js, honest-but-generic per line; the per-LISTING facts (price,
 * mileage, reg, registration month, photo) are the real captured values.
 *
 * Capture recipe (browser, one minute) — the feed needs a fresh token:
 *   1. Open https://secure.ford.co.uk/ approved-used search and let results load.
 *   2. DevTools > Network > filter "searchVehicles".
 *   3. Right-click the request > Copy > Copy as cURL, and run it (paginate
 *      startingRecord 0 then 48 for the full pool) saving each response to a file.
 *   4. Pass the saved response file(s) to this script. Each file is the raw JSON
 *      envelope: { data: { VehicleInventoryList: { VehicleInventoryItem: [...] } } }.
 *
 * Run:  node scripts/build-ford-fixtures-from-capture.mjs /tmp/ford-capture/page0.json /tmp/ford-capture/page1.json
 * Out:  fixtures/ford-cars.json  (mapped cars the engine scores)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapFordRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'ford-cars.json');

const capturePaths = process.argv.slice(2);
if (capturePaths.length === 0) {
  console.error('Usage: node scripts/build-ford-fixtures-from-capture.mjs <page0.json> [page1.json ...]');
  console.error('See the header of this file for how to capture the feed response.');
  process.exit(2);
}

/* Pull the VehicleInventoryItem array out of one captured response. Accepts the
 * raw searchVehicles envelope; fails loudly rather than commit an empty deck. */
function itemsFrom(path) {
  const root = JSON.parse(readFileSync(path, 'utf8'));
  const list = root?.data?.VehicleInventoryList?.VehicleInventoryItem;
  if (!Array.isArray(list)) {
    throw new Error(`${path}: no data.VehicleInventoryList.VehicleInventoryItem[] — is this a searchVehicles response?`);
  }
  return list;
}

/* "Apr 2025" -> "01/04/2025" (first of the month, dd/mm/yyyy as registrationDate
 * reads it). The feed dates a registration to the month, not the day, so the 1st
 * is an honest midpoint that still beats the year-only fallback. Returns null when
 * the string is absent or unparseable (never guess a date). */
const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
function firstRegFrom(dateOfRegistration = '') {
  const m = String(dateOfRegistration).trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return undefined;
  const mm = MONTHS[m[1].toLowerCase()];
  const yyyy = parseInt(m[2], 10);
  if (!mm || !(yyyy > 1990)) return undefined;
  return `01/${String(mm).padStart(2, '0')}/${yyyy}`;
}

/* Project one nested Ford API record to the FLAT-raw shape mapFordRaw() reads.
 * mapFordRaw derives line/body/fuel/specs/performance from title+derivative and
 * carries the per-listing facts straight through. */
function toFlatRaw(item) {
  const v = item?.Vehicle || {};
  const cfg = v.Configuration || {};
  const vi = item?.VendorInformation || {};
  const model = v.Model?.ShortDescription || '';
  const variant = v.Variant?.ShortDescription || '';
  // Some hosts (googleapis) return the URL with a bare trailing "?" and no query
  // params; strip it so the committed URL is clean.
  const image = ((cfg.Appearance?.ImageRef || [])[0]?.value || '').replace(/\?$/, '') || undefined;
  const history = v.History || {};
  const year = parseInt(history.YearOfProduction, 10);
  // Real per-listing colour. The feed carries a rich marketing name
  // (Appearance.ExteriorColor.ShortDescription, e.g. "Solar Silver (metallic)")
  // on some records and a coarse token (ExteriorColor.Code.value, e.g. "WHITE")
  // on all of them; prefer the rich name, fall back to a tidied token so every
  // real listing surfaces its own paint. Both are captured values, not invented.
  const ec = cfg.Appearance?.ExteriorColor || {};
  const colourShort = String(ec.ShortDescription || '').trim();
  const colourToken = String(ec.Code?.value || '').trim();
  const colour = colourShort
    || (colourToken
      ? colourToken.charAt(0).toUpperCase() + colourToken.slice(1).toLowerCase()
      : undefined);
  const previousOwners = parseInt(history.NumberOfPreviousOwners, 10);

  return {
    // Ford's internal vehicle ID is stable and unique across the pool.
    id: `ford-${v.Identity?.ID ?? v.Identity?.RegistrationNumber ?? model}`,
    // title is the marque + line; derivative is the trim/engine string. Together
    // they drive fordLine/fordBody/fordFuel/fordIsPerformance.
    title: `Ford ${model}`.trim(),
    derivative: variant,
    fuel: cfg.FuelType?.ShortDescription || '',
    price: vi.Price?.value,
    mileage: v.CurrentCondition?.CurrentOdometerReading?.value,
    reg: v.Identity?.RegistrationNumber || undefined,
    doors: cfg.NumberOfDoors,
    transmission: cfg.TransmissionType?.ShortDescription || '',
    firstReg: firstRegFrom(history.DateOfRegistration),
    year: Number.isFinite(year) ? year : undefined,
    image,
    // Real per-listing exterior colour (see derivation above).
    colour,
    // Real per-listing full-service-history flag, the string "Yes"/"No" straight
    // from the feed (present on every captured record); the renderer interprets it.
    fullServiceHistory: history.FullServiceHistory || undefined,
    // Real per-listing previous-owner count; absent on some records, so leave it
    // undefined there rather than default to a number.
    previousOwners: Number.isFinite(previousOwners) ? previousOwners : undefined,
    // Real per-listing dealer name (VendorInformation.VendorName, e.g. "Lawtons of
    // Tadcaster") — the actual retailer holding this car, not the Ford-wide constant.
    dealer: vi.VendorName || undefined,
    // The feed carries no per-listing detail URL (the real pages live on
    // individual dealer sites, not derivable from this payload), so mapFordRaw
    // defaults link to the Ford homepage rather than fabricate a deep link.
  };
}

const rawItems = capturePaths.flatMap(itemsFrom);
if (rawItems.length === 0) {
  console.error('The capture held no vehicle rows. Recapture searchVehicles with a fresh token.');
  process.exit(1);
}

const seen = new Set();
const cars = [];
let noPrice = 0;
let noPhoto = 0;
for (const item of rawItems) {
  const car = mapFordRaw(toFlatRaw(item));
  if (!car) { noPrice += 1; continue; } // mapFordRaw drops price-less records
  if (seen.has(car.id)) continue;
  seen.add(car.id);
  if (!car.photo) noPhoto += 1;
  cars.push(car);
}

// Same engine-validity gate as the synthetic + Motorrad-capture builders: a
// combustion car needs mpg>0, an EV needs evRange>0, the engine-required fields
// must all be present, and no user-facing string may carry an em dash.
const REQUIRED = ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
  'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb'];
for (const c of cars) {
  const missing = REQUIRED.filter((k) => c[k] == null);
  if (missing.length) throw new Error(`ford car ${c.id} missing ${missing.join(',')}`);
  if (c.fuel === 'ev' && !(c.evRange > 0)) throw new Error(`ford EV ${c.id} has no evRange`);
  if (c.fuel !== 'ev' && !(c.mpg > 0)) throw new Error(`ford ${c.fuel} ${c.id} has no mpg`);
  if (String(c.blurb).includes('—')) throw new Error(`ford car ${c.id} has an em dash in blurb`);
}

writeFileSync(OUT, `${JSON.stringify(cars, null, 2)}\n`);

const byLine = {};
for (const c of cars) byLine[c.line] = (byLine[c.line] || 0) + 1;
const byFuel = {};
for (const c of cars) byFuel[c.fuel] = (byFuel[c.fuel] || 0) + 1;
const withPhoto = cars.filter((c) => c.photo).length;
const withAge = cars.filter((c) => c.firstReg || c.year).length;
const prices = cars.map((c) => c.priceMin).sort((a, b) => a - b);
process.stdout.write(`Wrote ${cars.length} Ford cars to ${OUT} (from ${rawItems.length} captured rows)\n`);
process.stdout.write(`  ${withPhoto}/${cars.length} carry a real listing photo\n`);
process.stdout.write(`  ${withAge}/${cars.length} carry a registration date/year\n`);
process.stdout.write(`  lines: ${JSON.stringify(byLine)}\n`);
process.stdout.write(`  fuel:  ${JSON.stringify(byFuel)}\n`);
process.stdout.write(`  price: £${prices[0]}-£${prices[prices.length - 1]} `
  + `(median £${prices[Math.floor(prices.length / 2)]})\n`);
if (noPrice) process.stdout.write(`  (dropped ${noPrice} price-less rows)\n`);
if (noPhoto) process.stdout.write(`  (${noPhoto} rows had no photo field)\n`);
