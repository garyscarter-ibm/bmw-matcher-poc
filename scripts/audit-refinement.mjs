/*
 * Results-refinement audit — is the "YOUR PERFECT <brand> IS…" decree earned,
 * and is there material to refine with when it isn't?
 *
 * Companion to audit-questions.mjs, which asks whether each QUESTION earns its
 * screen. This one asks the same of the RESULTS: when the page names a single
 * winner, can the model actually tell it from the runners-up — and when it
 * can't, what could a refinement step ask about? Same machinery (real engine,
 * national fixture dumps, seeded PRNG, retailers sampled across the stock-size
 * distribution) so the two audits are directly comparable.
 *
 *   decree    For random answer sets: the #1-vs-#2 score gap, how often that
 *             gap is zero (winner decided by tie-break, not merit), how many
 *             cars sit within CLUSTER_PTS of #1 (the set the model treats as
 *             interchangeable), how often that cluster overflows the three the
 *             page shows — and whether granular attributes the quiz never asks
 *             about (gearbox, equipment) actually differ inside it.
 *   features  Per equipment concept: national coverage, and the split rate —
 *             the share of retailers where SOME but not all cars carry it.
 *             A concept everyone has can't refine anything; one nobody has is
 *             dead. Only the ones that split are requireable.
 *   vocab     The raw feed's option vocabulary: how big, what's most common,
 *             and — the maintenance signal — which frequent strings NO concept
 *             in mapping.js currently matches. Reads the big raw dumps, so
 *             it's slower than the other two passes.
 *
 * Findings + what they imply are written up in docs/refinement-audit.md; the
 * design they support is docs/refinement-plan.md. Re-run after a fixture
 * refresh to see whether they still hold.
 *
 * Run:  node scripts/audit-refinement.mjs [decree|features|vocab|all]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { rankCars } from '../server/engine.js';
import { questionsForBrand, applyBespokeAnswers } from '../server/questions.js';
import { brandTuning, brandConfig } from '../server/brands.js';
import { FEATURE_CONCEPTS, featureStrings } from '../server/mapping.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const BRANDS = ['bmw', 'mini'];
const MODE = process.argv[2] || 'all';

const N_ANSWERS = 200; // random answer sets per retailer
const N_RETAILERS = 40; // retailers sampled per brand, spread across sizes
const CLUSTER_PTS = 3; // within N points of #1 = the model can't separate them
const MIN_POOL = 10; // retailers smaller than this are too noisy for split rates
const SHOWN = 3; // cars the results page shows today (engine TOP_MATCHES)

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : '—');
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

// Same deterministic LCG as audit-questions.mjs, so both audits replay the
// same answer sets and their numbers can be read side by side.
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function loadBrand(brand) {
  const raw = JSON.parse(readFileSync(join(FIXTURES, `${brand}-cars.json`), 'utf8'));
  const cars = Array.isArray(raw) ? raw : raw.cars;
  const byRetailer = new Map();
  for (const c of cars) {
    if (!byRetailer.has(c.retailerId)) byRetailer.set(c.retailerId, []);
    byRetailer.get(c.retailerId).push(c);
  }
  return {
    cars,
    byRetailer,
    tuning: brandTuning(brand),
    budgetCfg: brandConfig(brand).budget,
    questions: questionsForBrand(brand),
  };
}

/** A random full answer set, uniform over each question's options. */
function randomAnswers(qs, budgetCfg) {
  const a = {};
  for (const q of qs) {
    if (q.id === 'budget') {
      const lo = Math.round((budgetCfg.max * 0.1 + rnd() * budgetCfg.max * 0.4) / 1000) * 1000;
      a.budget = [lo, lo + Math.round((budgetCfg.max * 0.2) / 1000) * 1000];
    } else if (q.id === 'mileage') {
      a.mileage = 1000 + Math.floor(rnd() * 24) * 1000;
    } else if (q.multi) {
      const n = q.id === 'priorities' ? 2 : 1 + Math.floor(rnd() * 2);
      const vals = new Set();
      while (vals.size < Math.min(n, q.options.length)) vals.add(pick(q.options).value);
      a[q.id] = [...vals];
    } else {
      a[q.id] = pick(q.options).value;
    }
  }
  return a;
}

/** Sample retailers evenly across the stock-size distribution. */
function sampleRetailers(byRetailer, n) {
  const all = [...byRetailer.values()].sort((a, b) => a.length - b.length);
  const step = Math.max(1, Math.floor(all.length / n));
  return all.filter((_, i) => i % step === 0).slice(0, n);
}

const sizeBucket = (n) => (n < 25 ? 'small (<25)' : n <= 60 ? 'medium (25-60)' : 'large (>60)');
const BUCKETS = ['small (<25)', 'medium (25-60)', 'large (>60)'];

// -------------------------------------------------------------- decree ----

function auditDecree(brand) {
  const { byRetailer, tuning, budgetCfg, questions: qs } = loadBrand(brand);
  const sample = sampleRetailers(byRetailer, N_RETAILERS);

  const stats = {};
  const bucketOf = (name) => (stats[name] ??= {
    sets: 0, gaps: [], ties: 0, weak: 0, clusters: [], overflow: 0,
    multi: 0, splits: { gearbox: 0, equipment: 0, any: 0 },
  });

  for (const stock of sample) {
    const b = bucketOf(sizeBucket(stock.length));
    for (let i = 0; i < N_ANSWERS; i += 1) {
      const answers = applyBespokeAnswers(brand, randomAnswers(qs, budgetCfg));
      const ranked = rankCars(answers, stock, tuning);
      if (ranked.length < 2) continue;

      b.sets += 1;
      const gap = ranked[0].score - ranked[1].score;
      b.gaps.push(gap);
      if (gap === 0) b.ties += 1;
      if (gap <= CLUSTER_PTS) b.weak += 1;

      // The cars the model is treating as interchangeable.
      const cluster = ranked.filter((m) => ranked[0].score - m.score <= CLUSTER_PTS);
      b.clusters.push(cluster.length);
      if (cluster.length > SHOWN) b.overflow += 1;

      // Would a refinement step have anything to ask THIS cluster about?
      if (cluster.length >= 2) {
        b.multi += 1;
        const cars = cluster.map((m) => m.car);
        const gearbox = new Set(cars.map((c) => c.transmission)).size > 1;
        const equipment = FEATURE_CONCEPTS.some(([key]) =>
          new Set(cars.map((c) => (c.features || []).includes(key))).size > 1);
        if (gearbox) b.splits.gearbox += 1;
        if (equipment) b.splits.equipment += 1;
        if (gearbox || equipment) b.splits.any += 1;
      }
    }
  }

  console.log(`\n${'='.repeat(74)}`);
  console.log(`${brand.toUpperCase()} — ${sample.length} retailers sampled, ${N_ANSWERS} answer sets each`);
  console.log(`(cluster = cars within ${CLUSTER_PTS} pts of #1; the page shows ${SHOWN})`);
  for (const name of BUCKETS) {
    const b = stats[name];
    if (!b?.sets) continue;
    console.log(`\n  ${name} — ${b.sets} rankings`);
    console.log(`    #1 vs #2 gap:  median ${median(b.gaps)} pts, p90 ${quantile(b.gaps, 0.9)}`);
    console.log(`    dead tie (gap 0, winner is the tie-break): ${pct(b.ties, b.sets)}   gap<=${CLUSTER_PTS}: ${pct(b.weak, b.sets)}`);
    console.log(`    cluster size:  median ${median(b.clusters)}, p90 ${quantile(b.clusters, 0.9)}   overflows the ${SHOWN} shown: ${pct(b.overflow, b.sets)}`);
    console.log(`    of clusters with 2+ cars, share where they differ on:`);
    console.log(`      gearbox ${pct(b.splits.gearbox, b.multi)} | equipment ${pct(b.splits.equipment, b.multi)} | either ${pct(b.splits.any, b.multi)}`);
  }
}

// ------------------------------------------------------------ features ----

function auditFeatures(brand) {
  const { cars, byRetailer } = loadBrand(brand);
  const pools = [...byRetailer.values()].filter((s) => s.length >= MIN_POOL);
  const has = (car, key) => (car.features || []).includes(key);

  console.log(`\n${'='.repeat(74)}`);
  console.log(`${brand.toUpperCase()} — ${cars.length} cars; split rate across ${pools.length} retailers (>=${MIN_POOL} cars)`);
  console.log('\n  A concept is requireable where it splits the pool: some cars have it,');
  console.log('  some don\'t. Universal or absent = nothing to refine with.\n');
  console.log(`    ${'concept'.padEnd(22)} ${'national'.padStart(8)} ${'splits at'.padStart(10)}   verdict`);

  const rows = [];
  for (const [key] of FEATURE_CONCEPTS) {
    const national = cars.filter((c) => has(c, key)).length / cars.length;
    let splits = 0;
    for (const stock of pools) {
      const share = stock.filter((c) => has(c, key)).length / stock.length;
      if (share >= 0.05 && share <= 0.95) splits += 1;
    }
    rows.push([key, national, splits / pools.length]);
  }
  // Gearbox isn't an equipment concept (it's a clean feed field), but it's the
  // same kind of refinement axis, so it's measured on the same scale.
  {
    const national = cars.filter((c) => c.transmission === 'manual').length / cars.length;
    let splits = 0;
    for (const stock of pools) {
      const share = stock.filter((c) => c.transmission === 'manual').length / stock.length;
      if (share >= 0.05 && share <= 0.95) splits += 1;
    }
    rows.push(['(manual gearbox)', national, splits / pools.length]);
  }

  for (const [key, national, splitRate] of rows.sort((a, b) => b[2] - a[2])) {
    const verdict = national < 0.02 ? 'too rare'
      : national > 0.95 ? 'universal — dead'
        : splitRate >= 0.5 ? 'REQUIREABLE'
          : splitRate >= 0.25 ? 'marginal'
            : 'rarely splits';
    console.log(`    ${key.padEnd(22)} ${`${(national * 100).toFixed(0)}%`.padStart(8)} ${`${(splitRate * 100).toFixed(0)}%`.padStart(10)}   ${verdict}`);
  }
}

// --------------------------------------------------------------- vocab ----

function auditVocab(brand) {
  const raw = JSON.parse(readFileSync(join(FIXTURES, `${brand}-raw.json`), 'utf8'));
  const freq = new Map();
  let withFeatures = 0;
  for (const v of raw) {
    const feats = featureStrings(v.features);
    if (feats.length) withFeatures += 1;
    for (const s of new Set(feats)) freq.set(s, (freq.get(s) || 0) + 1);
  }

  console.log(`\n${'='.repeat(74)}`);
  console.log(`${brand.toUpperCase()} — ${raw.length} cars, ${pct(withFeatures, raw.length)} carry an options list; ${freq.size} distinct strings`);
  const common = [...freq.entries()].filter(([, n]) => n >= raw.length * 0.01);
  console.log(`  strings on >=1% of stock: ${common.length} (the rest is long tail)`);

  console.log('\n  Most common option strings:');
  [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([s, n]) => console.log(`    ${pct(n, raw.length).padStart(4)}  ${s.slice(0, 62)}`));

  // The maintenance signal: frequent strings no concept matches. Most are
  // rightly ignored (every car has DAB radio), but a genuinely requireable
  // want appearing here is a concept we can't yet parse.
  console.log('\n  Frequent (>=10%) strings NO concept matches — candidates + noise:');
  const unmatched = [...freq.entries()]
    .filter(([s, n]) => n >= raw.length * 0.1 && !FEATURE_CONCEPTS.some(([, re]) => re.test(s)))
    .sort((a, b) => b[1] - a[1]);
  unmatched.slice(0, 20).forEach(([s, n]) => console.log(`    ${pct(n, raw.length).padStart(4)}  ${s.slice(0, 62)}`));
  if (!unmatched.length) console.log('    (none)');
}

// ----------------------------------------------------------------- run ----

const PASSES = {
  decree: [auditDecree],
  features: [auditFeatures],
  vocab: [auditVocab],
  all: [auditDecree, auditFeatures, auditVocab],
};
const passes = PASSES[MODE];
if (!passes) {
  console.error('Usage: node scripts/audit-refinement.mjs [decree|features|vocab|all]');
  process.exit(1);
}
for (const pass of passes) {
  console.log(`\n${'#'.repeat(74)}\n# ${pass.name.replace('audit', '').toUpperCase()}\n${'#'.repeat(74)}`);
  for (const brand of BRANDS) pass(brand);
}
