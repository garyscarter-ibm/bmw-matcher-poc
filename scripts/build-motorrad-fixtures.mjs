/*
 * Build fixtures/motorrad-bikes.json — curated, not scraped.
 *
 * BMW Motorrad's live approved-used feed (approvedused.bmw-motorrad.co.uk) is an
 * AngularJS SPA whose only data path is a session-bound POST
 * (ResultOverview/ShowResultsFilterChanged) that needs a live GMB-SID cookie the
 * server issues to a real browser session; harvested out-of-band it 302s to a
 * not-found (see the [motorrad-data] entry in DECISIONS.md). So, like Ford, there
 * is no raw dump to replay. This script SYNTHESISES a realistic flat-raw dataset
 * — a spread of models across every category, with representative used prices,
 * mileages and plates — and projects it through mapMotorradRaw(), the SAME
 * flat-raw -> mapped-bike projection the live adapter will use once a session is
 * reachable. The fixtures are deterministic, regenerable, and exercise the whole
 * range: the GS adventure line, RT/K tourers, S/M sport, the naked/roadster
 * street bikes, R heritage boxers, and the electric CE 04 scooter.
 *
 * Model figures live in server/mapping.js (MODEL_SPECS_MOTORRAD); this file only
 * decides WHICH bikes exist and at what price/mileage, so a mapping change
 * re-projects here for free. Spec figures were reconciled against BMW Motorrad UK
 * / MCN / Bennetts (see the Motorrad section of DECISIONS.md).
 *
 * Deterministic: no Date.now()/Math.random() — a fixed mulberry32 seeded per
 * index — so the committed JSON is stable across runs and diffs stay readable.
 *
 * Run:  node scripts/build-motorrad-fixtures.mjs
 * Out:  fixtures/motorrad-bikes.json  (mapped bikes the engine scores)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapMotorradRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'motorrad-bikes.json');

/* A small deterministic PRNG (mulberry32) so prices/mileage vary believably
 * without Date/Math.random — same seed, same fixtures, every run. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Each line: how many to emit, the model title as an approved-used listing reads
 * it, and a price band [min, max] for a 1-4 year-old example. The mapper derives
 * category, specs, fuel and tags from the title alone (motorradLine ->
 * MODEL_SPECS_MOTORRAD), so this table just populates a realistic, varied deck
 * spanning every riding style a rider might pick.
 *
 * Prices reflect the UK approved-used market: a 3-year-old R 1250 GS around
 * £13-16k, a current R 1300 GS £17-19k, the halo M 1000 RR north of £25k, the
 * learner-friendly G 310s under £5k. */
const LINES = [
  // Adventure / GS — the core of the range, the widest spread of ages/prices.
  { title: 'BMW R 1300 GS', count: 4, priceBand: [17000, 19500] },
  { title: 'BMW R 1250 GS', count: 5, priceBand: [12500, 16500] },
  { title: 'BMW F 900 GS', count: 3, priceBand: [9500, 12500] },
  { title: 'BMW F 850 GS', count: 3, priceBand: [7500, 10500] },
  { title: 'BMW G 310 GS', count: 3, priceBand: [3800, 5200] },

  // Tourers — distance, two-up, luggage.
  { title: 'BMW R 1300 RT', count: 2, priceBand: [16500, 19000] },
  { title: 'BMW R 1250 RT', count: 3, priceBand: [12000, 16000] },
  { title: 'BMW K 1600 GT', count: 2, priceBand: [15000, 21000] },

  // Sport — S/M superbikes and the sport-touring S/F XR.
  { title: 'BMW S 1000 RR', count: 3, priceBand: [11000, 16000] },
  { title: 'BMW M 1000 RR', count: 1, priceBand: [24000, 29000] }, // the halo
  { title: 'BMW S 1000 XR', count: 2, priceBand: [9500, 13500] },
  { title: 'BMW F 900 XR', count: 2, priceBand: [7000, 9500] },

  // Naked / roadster — everyday street bikes.
  { title: 'BMW S 1000 R', count: 2, priceBand: [8500, 12000] },
  { title: 'BMW R 1250 R', count: 2, priceBand: [9000, 12500] },
  { title: 'BMW F 900 R', count: 3, priceBand: [6000, 8500] },
  { title: 'BMW G 310 R', count: 3, priceBand: [3500, 4800] }, // A2/learner

  // Heritage — classic boxer character.
  { title: 'BMW R 12 nineT', count: 2, priceBand: [10000, 14000] },
  { title: 'BMW R 18', count: 2, priceBand: [12000, 18000] },

  // Electric — the CE 04 scooter, scored on range not mpg.
  { title: 'BMW CE 04', count: 2, priceBand: [7500, 10500] },
];

/* A believable UK plate for a used bike: two letters, an age identifier in the
 * 20-24 / 70-74 range, three letters. Deterministic from the PRNG. */
const AZ = 'ABCDEFGHJKLMNOPRSTUVWXYZ'; // no I/Q, per DVLA convention
function plate(r) {
  const L = () => AZ[Math.floor(r() * AZ.length)];
  const ages = ['20', '70', '21', '71', '22', '72', '23', '73', '24'];
  const age = ages[Math.floor(r() * ages.length)];
  return `${L()}${L()}${age} ${L()}${L()}${L()}`;
}

const raws = [];
let seed = 1;
for (const line of LINES) {
  for (let i = 0; i < line.count; i += 1) {
    const r = rng(seed);
    seed += 1;
    const [lo, hi] = line.priceBand;
    // Price to the nearest £50 within the band.
    const price = Math.round((lo + r() * (hi - lo)) / 50) * 50;
    // Mileage inversely correlated with price within the band: cheaper example,
    // more miles. Bikes cover far fewer miles than cars — 2k-24k is typical used.
    const frac = (price - lo) / Math.max(1, hi - lo);
    const miles = Math.round((2000 + (1 - frac) * 22000 + r() * 3000) / 100) * 100;
    raws.push({
      id: `mtr-${String(seed).padStart(3, '0')}`,
      title: line.title,
      price,
      mileage: miles,
      reg: plate(r),
      // The live feed carries a fuel string; leave it unset here and let the
      // mapper derive electric for the CE 04, petrol otherwise (motorradFuel).
    });
  }
}

const bikes = raws.map(mapMotorradRaw).filter(Boolean);

// Sanity: every projected bike must be engine-valid (the shape brand.test.js and
// the engine assert). Fail the build loudly rather than commit a broken fixture.
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
    throw new Error(`build-motorrad-fixtures: ${b.name} invalid: ${problems.join(', ')}`);
  }
}

writeFileSync(OUT, `${JSON.stringify(bikes, null, 2)}\n`);

// A short summary to stdout so a run is legible.
const byCat = {};
let evCount = 0;
for (const b of bikes) {
  byCat[b.body] = (byCat[b.body] || 0) + 1;
  if (b.fuel === 'ev') evCount += 1;
}
const prices = bikes.map((b) => b.priceMin).sort((a, b) => a - b);
const median = prices[Math.floor(prices.length / 2)];
console.log(`Wrote ${bikes.length} bikes to ${OUT}`);
console.log('  by category:', JSON.stringify(byCat));
console.log(`  ${evCount} electric, ${bikes.length - evCount} petrol`);
console.log(`  price £${prices[0].toLocaleString()}-£${prices[prices.length - 1].toLocaleString()}, median £${median.toLocaleString()}`);
