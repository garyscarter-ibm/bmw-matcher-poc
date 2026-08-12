/*
 * Build fixtures/ford-cars.json — curated, not scraped.
 *
 * Ford's live approved-used feed (servicescache.ford.com) is behind an Akamai
 * edge that drops the connection from this environment (verified repeatedly:
 * HTTP 000 regardless of method/UA/headers), so unlike Honda there is no raw
 * dump to replay. Instead this script SYNTHESISES a realistic flat-raw dataset
 * — a spread of derivatives per model line, with representative used prices,
 * mileages and plates — and projects it through mapFordRaw(), the same flat-raw
 * → mapped-car projection the live adapter will use once it is reachable. So the
 * fixtures are deterministic, regenerable, and exercise the whole Ford range:
 * the ST/Mustang performance halo, the EV + PHEV split, MPVs, a pickup.
 *
 * Model figures live in server/mapping.js (MODEL_SPECS_FORD); this file only
 * decides WHICH cars exist and at what price/mileage, so a mapping change
 * re-projects here for free. Spec figures were reconciled against carwow /
 * Auto Express / Parkers (see the Ford section of DECISIONS.md).
 *
 * Deterministic: no Date.now()/Math.random() — a fixed LCG seeded per index —
 * so the committed JSON is stable across runs and diffs stay readable.
 *
 * Run:  node scripts/build-ford-fixtures.mjs
 * Out:  fixtures/ford-cars.json  (mapped cars the engine scores)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mapFordRaw } from '../server/mapping.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(REPO_ROOT, 'fixtures', 'ford-cars.json');

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

/* Each line: how many to emit, the model's title, its derivative variants
 * (trim + engine string as a used listing would read), a fuel hint, and a
 * price band [min, max] for a 2-4 year-old example. The mapper derives body,
 * fuel, specs and the performance halo from title+derivative — this table just
 * populates a realistic, varied deck. */
const LINES = [
  {
    title: 'Fiesta', count: 7, priceBand: [8500, 15500],
    variants: [
      { derivative: '1.0 EcoBoost Titanium 5dr', fuel: 'Petrol' },
      { derivative: '1.0 EcoBoost mHEV ST-Line 5dr', fuel: 'Petrol' },
      { derivative: '1.5 EcoBoost ST-3 3dr', fuel: 'Petrol' }, // the hot hatch
      { derivative: '1.1 Trend 5dr', fuel: 'Petrol' },
    ],
  },
  {
    title: 'Focus', count: 7, priceBand: [12500, 24000],
    variants: [
      { derivative: '1.0 EcoBoost mHEV 125 Titanium 5dr', fuel: 'Petrol' },
      { derivative: '1.0 EcoBoost mHEV 155 ST-Line 5dr', fuel: 'Petrol' },
      { derivative: '1.5 EcoBlue Titanium 5dr', fuel: 'Diesel' },
      { derivative: '2.3 EcoBoost ST 5dr', fuel: 'Petrol' }, // Focus ST
      { derivative: '1.0 EcoBoost mHEV 155 Titanium Estate 5dr', fuel: 'Petrol' }, // estate body
    ],
  },
  {
    title: 'Puma', count: 7, priceBand: [14000, 23000],
    variants: [
      { derivative: '1.0 EcoBoost mHEV Titanium 5dr', fuel: 'Petrol' },
      { derivative: '1.0 EcoBoost mHEV ST-Line X 5dr', fuel: 'Petrol' },
      { derivative: '1.5 EcoBoost ST 5dr', fuel: 'Petrol' }, // Puma ST
    ],
  },
  {
    title: 'Puma Gen-E', count: 3, priceBand: [23000, 29000],
    variants: [
      { derivative: 'Premium 5dr Auto', fuel: 'Electric' },
      { derivative: 'Select 5dr Auto', fuel: 'Electric' },
    ],
  },
  {
    title: 'Kuga', count: 6, priceBand: [16000, 27000],
    variants: [
      { derivative: '1.5 EcoBoost Titanium 5dr', fuel: 'Petrol' },
      { derivative: '2.5 PHEV ST-Line X 5dr Auto', fuel: 'Plug-in Hybrid' }, // PHEV
      { derivative: '1.5 EcoBlue Titanium Edition 5dr', fuel: 'Diesel' },
    ],
  },
  {
    title: 'EcoSport', count: 3, priceBand: [8500, 14000],
    variants: [
      { derivative: '1.0 EcoBoost Titanium 5dr', fuel: 'Petrol' },
      { derivative: '1.0 EcoBoost ST-Line 5dr', fuel: 'Petrol' },
    ],
  },
  {
    title: 'Mondeo', count: 3, priceBand: [9500, 16000],
    variants: [
      { derivative: '2.0 EcoBlue 150 Titanium Edition 5dr', fuel: 'Diesel' },
      { derivative: '2.0 EcoBlue 150 Titanium Estate 5dr', fuel: 'Diesel' }, // estate body
    ],
  },
  {
    title: 'Mustang', count: 3, priceBand: [32000, 46000],
    variants: [
      { derivative: '5.0 V8 GT 2dr Auto', fuel: 'Petrol' },
      { derivative: '5.0 V8 GT Convertible 2dr Auto', fuel: 'Petrol' }, // convertible body
    ],
  },
  {
    title: 'Mustang Mach-E', count: 4, priceBand: [26000, 40000],
    variants: [
      { derivative: 'Extended Range RWD Premium 5dr Auto', fuel: 'Electric' },
      { derivative: 'Standard Range RWD 5dr Auto', fuel: 'Electric' },
      { derivative: 'GT AWD 5dr Auto', fuel: 'Electric' }, // Mach-E GT halo
    ],
  },
  {
    title: 'Explorer', count: 3, priceBand: [34000, 44000],
    variants: [
      { derivative: 'Extended Range RWD Premium 5dr Auto', fuel: 'Electric' },
      { derivative: 'Standard Range RWD 5dr Auto', fuel: 'Electric' },
    ],
  },
  {
    title: 'Capri', count: 3, priceBand: [35000, 45000],
    variants: [
      { derivative: 'Extended Range RWD Premium 5dr Auto', fuel: 'Electric' },
      { derivative: 'Standard Range RWD 5dr Auto', fuel: 'Electric' },
    ],
  },
  {
    title: 'Galaxy', count: 2, priceBand: [15000, 23000],
    variants: [
      { derivative: '2.0 EcoBlue 150 Titanium 5dr', fuel: 'Diesel' },
    ],
  },
  {
    title: 'S-Max', count: 2, priceBand: [15000, 22000],
    variants: [
      { derivative: '2.0 EcoBlue 150 Titanium 5dr', fuel: 'Diesel' },
    ],
  },
  {
    title: 'Tourneo Connect', count: 2, priceBand: [18000, 26000],
    variants: [
      { derivative: '2.0 EcoBlue 122 Titanium 5dr Auto', fuel: 'Diesel' },
    ],
  },
  {
    title: 'Ranger', count: 3, priceBand: [24000, 38000],
    variants: [
      { derivative: '2.0 EcoBlue Wildtrak Double Cab Auto', fuel: 'Diesel' },
      { derivative: '2.0 EcoBlue Limited Double Cab Auto', fuel: 'Diesel' },
    ],
  },
];

// Plate suffixes by rough age, so a used deck reads as a spread of years.
const PLATES = ['20', '70', '21', '71', '22', '72', '23', '73'];
const COLOURS = ['Frozen White', 'Agate Black', 'Magnetic Grey', 'Blue',
  'Solar Silver', 'Race Red', 'Fantastic Red', 'Sedona Orange'];

function main() {
  const raw = [];
  let n = 0;
  for (const line of LINES) {
    const rand = rng(0x5EED + n * 97);
    for (let i = 0; i < line.count; i += 1) {
      const v = line.variants[i % line.variants.length];
      const [lo, hi] = line.priceBand;
      const price = Math.round((lo + (hi - lo) * rand()) / 50) * 50; // to nearest £50
      const mileage = Math.round((6000 + rand() * 46000) / 100) * 100; // 6k–52k
      const plate = PLATES[Math.floor(rand() * PLATES.length)];
      const colour = COLOURS[Math.floor(rand() * COLOURS.length)];
      raw.push({
        id: `ford-${line.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}`,
        title: `Ford ${line.title}`,
        derivative: v.derivative,
        fuel: v.fuel,
        price,
        mileage,
        reg: `${plate} FRD`,
        colour,
      });
      n += 1;
    }
  }

  const seen = new Set();
  const cars = [];
  for (const r of raw) {
    const car = mapFordRaw(r);
    if (!car) continue;
    if (seen.has(car.id)) continue;
    seen.add(car.id);
    cars.push(car);
  }

  writeFileSync(OUT, JSON.stringify(cars, null, 0));
  process.stdout.write(`Mapped ${cars.length} Ford cars → ${OUT} (from ${raw.length} seed records)\n`);

  const byLine = {};
  for (const c of cars) byLine[c.line] = (byLine[c.line] || 0) + 1;
  const byFuel = {};
  for (const c of cars) byFuel[c.fuel] = (byFuel[c.fuel] || 0) + 1;
  const prices = cars.map((c) => c.priceMin).sort((a, b) => a - b);
  process.stdout.write(`  lines: ${JSON.stringify(byLine)}\n`);
  process.stdout.write(`  fuel:  ${JSON.stringify(byFuel)}\n`);
  process.stdout.write(`  price: £${prices[0]}–£${prices[prices.length - 1]} `
    + `(median £${prices[Math.floor(prices.length / 2)]})\n`);

  // Same schema guard as the Honda builder: a combustion car needs mpg>0, an EV
  // needs evRange>0, and the engine-required fields must all be present.
  const REQUIRED = ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax',
    'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb'];
  for (const c of cars) {
    const missing = REQUIRED.filter((k) => c[k] == null);
    if (missing.length) throw new Error(`ford car ${c.id} missing ${missing.join(',')}`);
    if (c.fuel === 'ev' && !(c.evRange > 0)) throw new Error(`ford EV ${c.id} has no evRange`);
    if (c.fuel !== 'ev' && !(c.mpg > 0)) throw new Error(`ford ${c.fuel} ${c.id} has no mpg`);
  }
}

main();
