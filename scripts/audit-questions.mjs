/*
 * Question-vs-stock audit — does each quiz question earn its screen?
 *
 * Replays the real engine (rankCars + brand tuning) against the national
 * fixture dumps (fixtures/<brand>-cars.json — refresh with
 * `node scripts/dump-stock.js all`) and measures, per brand and per retailer:
 *
 *   dead   Dead options: answer values with zero cars behind them at a
 *          retailer (e.g. fuel:phev at 60% of MINI retailers), plus how much
 *          of the budget slider's range real prices actually span.
 *   sens   Sensitivity: for random answer sets, flip ONE question at a time —
 *          how often does the top-3 change? 0% = the question is theatre.
 *          Also outcome diversity (distinct top-3s across N answer sets) and
 *          body-style honesty (you named a shape — is it in your top 3?).
 *   size   The `sens` measure split by retailer stock size (small/medium/
 *          large), which is the test for stock-*level*-dependent questions.
 *
 * Findings + the adapt-to-which-pool decision framework are written up in
 * docs/question-stock-audit.md — re-run this after a fixture refresh to see
 * whether they still hold. Zero-dep; seeded PRNG so runs are reproducible.
 *
 * Run:  node scripts/audit-questions.mjs [dead|sens|size|all]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { rankCars, TOP_MATCHES } from '../server/engine.js';
import { questionsForBrand, applyBespokeAnswers } from '../server/questions.js';
import { brandTuning, brandConfig } from '../server/brands.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const BRANDS = ['bmw', 'mini'];
const MODE = process.argv[2] || 'all';

// Sampling knobs. `sens` is the expensive pass (~answer sets × options × cars);
// these keep a full run to a couple of minutes on the current dumps.
const N_ANSWERS = 300; // random answer sets per retailer (diversity/honesty)
const N_BASES = 30; // of those, how many get the flip-one-question sweep
const N_RETAILERS = 40; // retailers sampled per brand, spread across sizes

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(0)}%` : '—');
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const quantile = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};

// Deterministic PRNG (LCG) so two runs over the same fixtures agree exactly.
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/** Identity of a result page: the top-3 car ids, order-sensitive. */
const key = (matches) => matches.slice(0, TOP_MATCHES).map((m) => m.car.id).join('|');

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

/*
 * Does this car satisfy this answer option? Mirrors the engine's hard filters
 * and the thresholds at which the scorers treat an option as "met" — kept
 * deliberately simple (an option is alive if ANY car satisfies it).
 */
function satisfies(qid, value, car, t) {
  switch (qid) {
    case 'bodyStyles':
      return value === 'any' ? true : car.body === value;
    case 'fuel':
      return value === 'open' ? true : car.fuel === value;
    case 'people':
      if (value === 'solo') return true;
      if (value === 'family') return car.seats >= t.hardFilter.familySeats;
      // 'crew': survives the hard filter (the score penalty is separate)
      return car.seats >= t.hardFilter.crewSeats && car.boot >= t.hardFilter.crewBoot;
    case 'boot':
      return car.boot >= t.practicality.bootNeed[value];
    default:
      return true; // charging/style/priorities/… aren't stock filters
  }
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

/** Every value one question can take, for the flip-one-question sweep. */
function valuesFor(q, budgetCfg) {
  if (q.id === 'budget') {
    return [0.15, 0.3, 0.5, 0.75].map((f) => {
      const lo = Math.round((budgetCfg.max * f * 0.6) / 1000) * 1000;
      return [lo, Math.round((budgetCfg.max * f) / 1000) * 1000];
    });
  }
  if (q.id === 'mileage') return [3000, 9000, 15000, 25000];
  if (q.multi) return q.options.map((o) => [o.value]);
  return q.options.map((o) => o.value);
}

/** % of base answer sets where sweeping q's values changes the top-3. */
function sensitivityFor(q, bases, stock, brand, tuning, budgetCfg) {
  let changed = 0;
  for (const base of bases) {
    const results = new Set();
    for (const v of valuesFor(q, budgetCfg)) {
      results.add(key(rankCars(applyBespokeAnswers(brand, { ...base, [q.id]: v }), stock, tuning)));
    }
    if (results.size > 1) changed += 1;
  }
  return changed / bases.length;
}

/** Sample retailers evenly across the stock-size distribution. */
function sampleRetailers(byRetailer, n) {
  const all = [...byRetailer.values()].sort((a, b) => a.length - b.length);
  const step = Math.max(1, Math.floor(all.length / n));
  return all.filter((_, i) => i % step === 0).slice(0, n);
}

// ---------------------------------------------------------------- dead ----

function auditDead(brand) {
  const { cars, byRetailer, tuning: t, budgetCfg, questions } = loadBrand(brand);
  const qs = questions.filter((q) => q.options);
  console.log(`\n${'='.repeat(72)}\n${brand.toUpperCase()} — ${cars.length} cars, ${byRetailer.size} retailers`);

  // Nationally dead options are brand-intrinsic: candidates for a static cut.
  console.log('\n  National dead options (brand-intrinsic candidates):');
  let anyNational = false;
  for (const q of qs) {
    const dead = q.options.filter((o) => !cars.some((c) => satisfies(q.id, o.value, c, t)));
    if (dead.length) { anyNational = true; console.log(`    ${q.id}: ${dead.map((o) => o.value).join(', ')}`); }
  }
  if (!anyNational) console.log('    (none — every option has national stock)');
  const idealCrew = cars.filter((c) => c.seats >= t.practicality.crewBonusSeats).length;
  console.log(`    people:'crew' ideal (${t.practicality.crewBonusSeats}+ seats) nationally: ${idealCrew} cars (${pct(idealCrew, cars.length)})`);

  const sizes = [];
  const deadCounts = [];
  const perOption = new Map();
  let withAnyDead = 0;
  let chargingWaste = 0;
  const budgetUse = [];

  for (const stock of byRetailer.values()) {
    sizes.push(stock.length);
    let dead = 0;
    for (const q of qs) {
      for (const o of q.options) {
        if (!stock.some((c) => satisfies(q.id, o.value, c, t))) {
          dead += 1;
          const k = `${q.id}:${o.value}`;
          perOption.set(k, (perOption.get(k) || 0) + 1);
        }
      }
    }
    deadCounts.push(dead);
    if (dead) withAnyDead += 1;
    if (!stock.some((c) => c.fuel === 'ev' || c.fuel === 'phev')) chargingWaste += 1;
    const prices = stock.map((c) => c.priceMin);
    budgetUse.push((quantile(prices, 0.95) - quantile(prices, 0.05)) / budgetCfg.max);
  }

  console.log(`\n  Retailer stock size: median ${median(sizes)}, p10 ${quantile(sizes, 0.1)}, p90 ${quantile(sizes, 0.9)}`);
  console.log(`  Dead options per retailer: median ${median(deadCounts)}, p90 ${quantile(deadCounts, 0.9)}, max ${Math.max(...deadCounts)}`);
  console.log(`  Retailers with >=1 dead option: ${withAnyDead}/${byRetailer.size} (${pct(withAnyDead, byRetailer.size)})`);
  console.log(`  Retailers where 'charging' is pure waste (0 EV+PHEV): ${chargingWaste}/${byRetailer.size} (${pct(chargingWaste, byRetailer.size)})`);
  console.log(`  Budget slider actually used (p5–p95 price span / slider max): median ${(median(budgetUse) * 100).toFixed(0)}%`);

  console.log('\n  Most-often-dead options (retailers affected):');
  [...perOption.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([k, n]) => console.log(`    ${k.padEnd(28)} dead at ${String(n).padStart(3)}/${byRetailer.size} retailers (${pct(n, byRetailer.size)})`));
}

// ---------------------------------------------------------------- sens ----

function auditSensitivity(brand) {
  const { byRetailer, tuning: t, budgetCfg, questions: qs } = loadBrand(brand);
  const sample = sampleRetailers(byRetailer, N_RETAILERS);

  const diversity = [];
  const topScores = [];
  const bodyHonesty = [];
  const sens = new Map(qs.map((q) => [q.id, []]));

  for (const stock of sample) {
    const sets = Array.from({ length: N_ANSWERS }, () => randomAnswers(qs, budgetCfg));
    const outs = sets.map((a) => rankCars(applyBespokeAnswers(brand, a), stock, t));
    diversity.push(new Set(outs.map(key)).size / N_ANSWERS);
    for (const o of outs) if (o.length) topScores.push(o[0].score);

    // Honesty: the user named specific body style(s) — did the top 3 include one?
    let named = 0;
    let honoured = 0;
    sets.forEach((a, i) => {
      const wanted = (a.bodyStyles || []).filter((v) => v !== 'any');
      if (!wanted.length || !outs[i].length) return;
      named += 1;
      if (outs[i].slice(0, TOP_MATCHES).some((m) => wanted.includes(m.car.body))) honoured += 1;
    });
    if (named) bodyHonesty.push(honoured / named);

    const bases = sets.slice(0, N_BASES);
    for (const q of qs) sens.get(q.id).push(sensitivityFor(q, bases, stock, brand, t, budgetCfg));
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log(`${brand.toUpperCase()} — ${sample.length} retailers sampled (${sample[0].length}–${sample.at(-1).length} cars), ${N_ANSWERS} answer sets each`);
  console.log(`\n  Outcome diversity (distinct top-3s / ${N_ANSWERS} answer sets): median ${(median(diversity) * 100).toFixed(0)}%`);
  console.log(`  Top-1 score: median ${median(topScores)}, mean ${mean(topScores).toFixed(1)}`);
  console.log(`  Body-style honesty (named a shape, got it in top 3): median ${(median(bodyHonesty) * 100).toFixed(0)}%`);
  console.log('\n  Per-question sensitivity — % of cases where changing ONLY this question changes the top 3:');
  [...sens.entries()]
    .map(([id, v]) => [id, median(v)])
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, v]) => {
      const bar = '█'.repeat(Math.round(v * 30)).padEnd(30, '·');
      console.log(`    ${id.padEnd(12)} ${bar} ${(v * 100).toFixed(0)}%`);
    });
}

// ---------------------------------------------------------------- size ----

function auditBySize(brand) {
  const { byRetailer, tuning: t, budgetCfg, questions: qs } = loadBrand(brand);

  const buckets = { 'small (<25)': [], 'medium (25-60)': [], 'large (>60)': [] };
  for (const stock of byRetailer.values()) {
    if (stock.length < 25) buckets['small (<25)'].push(stock);
    else if (stock.length <= 60) buckets['medium (25-60)'].push(stock);
    else buckets['large (>60)'].push(stock);
  }

  console.log(`\n${'='.repeat(72)}\n${brand.toUpperCase()}`);
  console.log(`  ${Object.entries(buckets).map(([k, v]) => `${k}: ${v.length} retailers`).join(' | ')}`);
  console.log(`\n  ${'question'.padEnd(12)} ${Object.keys(buckets).map((k) => k.padStart(15)).join('')}   <- % top-3 changes`);

  const perBucket = {};
  for (const [name, stocks] of Object.entries(buckets)) {
    const sampled = stocks.filter((_, i) => i % Math.max(1, Math.floor(stocks.length / 12)) === 0).slice(0, 12);
    const sens = new Map(qs.map((q) => [q.id, []]));
    const div = [];
    for (const stock of sampled) {
      const bases = Array.from({ length: 25 }, () => randomAnswers(qs, budgetCfg));
      const outs = bases.map((a) => rankCars(applyBespokeAnswers(brand, a), stock, t));
      div.push(new Set(outs.map(key)).size / bases.length);
      for (const q of qs) sens.get(q.id).push(sensitivityFor(q, bases, stock, brand, t, budgetCfg));
    }
    perBucket[name] = { sens, div: median(div) };
  }

  for (const q of qs) {
    const row = Object.values(perBucket)
      .map(({ sens }) => `${(median(sens.get(q.id)) * 100).toFixed(0)}%`.padStart(15)).join('');
    console.log(`  ${q.id.padEnd(12)} ${row}`);
  }
  console.log(`  ${'DIVERSITY'.padEnd(12)} ${Object.values(perBucket).map(({ div }) => `${(div * 100).toFixed(0)}%`.padStart(15)).join('')}`);
}

// ----------------------------------------------------------------- run ----

const PASSES = {
  dead: [auditDead],
  sens: [auditSensitivity],
  size: [auditBySize],
  all: [auditDead, auditSensitivity, auditBySize],
};
const passes = PASSES[MODE];
if (!passes) {
  console.error('Usage: node scripts/audit-questions.mjs [dead|sens|size|all]');
  process.exit(1);
}
for (const pass of passes) {
  console.log(`\n${'#'.repeat(74)}\n# ${pass.name.replace('audit', '').toUpperCase()}\n${'#'.repeat(74)}`);
  for (const brand of BRANDS) pass(brand);
}
