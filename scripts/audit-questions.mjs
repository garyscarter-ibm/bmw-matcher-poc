/*
 * Question-vs-stock audit: replays the real engine over national fixture dumps to check each quiz question earns its screen. Modes dead/sens/size/fuel/stick/taste/conf; findings in docs/question-stock-audit.md.
 * Run:  node scripts/audit-questions.mjs [dead|sens|size|fuel|stick|taste|conf|all]
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  rankCars, matchCars, TOP_MATCHES, TASTE_PTS,
} from '../server/engine.js';
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
 * Does this car satisfy this answer option? Mirrors the engine's hard filters,
 * kept deliberately simple (an option is alive if ANY car satisfies it).
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


// ---------------------------------------------------------------- fuel ----

/*
 * Does a named fuel actually bind? Tests engine.js's fuelStrictBoost claim that a wrong-fuel car shouldn't top a matching one, reporting honesty, violations, margin and wanted→got pairs.
 * Cases where no matching car survives are excluded: that's an unmet want (its own results copy), not a ranking failure.
 */
function auditFuel(brand) {
  const { byRetailer, tuning: t, budgetCfg, questions: qs } = loadBrand(brand);
  const sample = sampleRetailers(byRetailer, N_RETAILERS);

  let named = 0; let honoured = 0;
  let testable = 0; let violations = 0; let explained = 0;
  const margins = [];
  const pairs = new Map();

  for (const stock of sample) {
    for (let i = 0; i < N_ANSWERS; i += 1) {
      const a = randomAnswers(qs, budgetCfg);
      const picks = Array.isArray(a.fuel) ? a.fuel : [a.fuel].filter(Boolean);
      // Mirror the engine's own test for "the user named a fuel".
      if (!picks.length || picks.includes('open')) continue;
      const ranked = rankCars(applyBespokeAnswers(brand, a), stock, t);
      if (!ranked.length) continue;
      const match = ranked.filter((m) => picks.includes(m.car.fuel));
      if (!match.length) continue; // unmet want, not a ranking failure

      named += 1;
      if (ranked.slice(0, TOP_MATCHES).some((m) => picks.includes(m.car.fuel))) honoured += 1;

      testable += 1;
      if (!picks.includes(ranked[0].car.fuel)) {
        // Wanting an EV/PHEV with nowhere to charge is penalised ON PURPOSE
        // (scoreOneFuel's evAccess), so count it separately from real violations.
        const canCharge = ['home', 'work', 'either'].includes(a.charging);
        const plugWanted = picks.every((v) => v === 'ev' || v === 'phev');
        if (plugWanted && !canCharge) {
          explained += 1;
        } else {
          violations += 1;
          margins.push(ranked[0].score - match[0].score);
          const k = `${picks.join('+')} → ${ranked[0].car.fuel}`;
          pairs.set(k, (pairs.get(k) || 0) + 1);
        }
      }
    }
  }

  console.log(`\n${'='.repeat(72)}\n${brand.toUpperCase()} — ${sample.length} retailers, ${N_ANSWERS} answer sets each`);
  console.log(`  (only cases where a matching-fuel car survived the filters: ${testable})`);
  console.log(`\n  Fuel honesty (named a fuel, got one in the top ${TOP_MATCHES}): ${pct(honoured, named)}`);
  console.log(`  Steered off a plug for lack of charging (deliberate): ${pct(explained, testable)}`);
  console.log(`  INTENT VIOLATIONS (wrong fuel tops a matching car, unjustified): ${pct(violations, testable)}`);
  if (margins.length) {
    console.log(`  Margin when it happens: median ${median(margins)} pts, p90 ${quantile(margins, 0.9)}`);
  }
  console.log('\n  Which swaps (violations only):');
  [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    .forEach(([k, n]) => console.log(`    ${k.padEnd(26)} ${String(n).padStart(4)}  ${pct(n, violations)}`));
}


// --------------------------------------------------------------- stick ----

/*
 * "It always recommends the same car." Starts from real personas (not uniform-random, which flatters the questions), flips ONE answer at a time, and asks: did the WINNER change?
 * Reports overall stickiness (looks deaf to input) and per-question move rate (0% = that question can't change the pick for these buyers).
 */
function auditStickiness(brand) {
  const { byRetailer, tuning, questions: qs } = loadBrand(brand);
  const personasPath = join(FIXTURES, 'personas.json');
  const { personas } = JSON.parse(readFileSync(personasPath, 'utf8'));
  const people = personas.filter((p) => p.brand === brand);

  const perQuestion = new Map(qs.map((q) => [q.id, { moved: 0, tried: 0 }]));
  let same = 0;
  let total = 0;
  const lines = [];

  for (const p of people) {
    const stock = byRetailer.get(Number(p.retailer)) || byRetailer.get(p.retailer);
    if (!stock?.length) continue;
    const winner = (answers) => {
      const { matches } = matchCars(applyBespokeAnswers(brand, answers), stock, tuning);
      return matches.length ? matches[0].car.name : '(none)';
    };
    const base = winner(p.answers);
    let pSame = 0;
    let pTotal = 0;

    for (const q of qs) {
      let values = [];
      if (q.id === 'budget') values = [[10000, 25000], [15000, 35000], [25000, 50000], [40000, 80000]];
      else if (q.id === 'mileage') values = [4000, 9000, 15000, 25000];
      else if (q.options) values = q.multi ? q.options.map((o) => [o.value]) : q.options.map((o) => o.value);
      for (const v of values) {
        const answers = { ...p.answers, [q.id]: v };
        if (JSON.stringify(answers) === JSON.stringify(p.answers)) continue;
        const stat = perQuestion.get(q.id);
        stat.tried += 1;
        pTotal += 1;
        if (winner(answers) === base) { pSame += 1; } else { stat.moved += 1; }
      }
    }
    same += pSame;
    total += pTotal;
    lines.push(`    ${p.key.padEnd(8)} ${pct(pSame, pTotal).padStart(4)} unchanged over ${String(pTotal).padStart(3)} tweaks  (${base.slice(0, 34)})`);
  }

  console.log(`\n${'='.repeat(72)}\n${brand.toUpperCase()} — winner stickiness under realistic answers`);
  console.log(`\n  Change ONE answer, same car still wins: ${pct(same, total)} of ${total} tweaks`);
  lines.forEach((l) => console.log(l));
  console.log('\n  How often changing a question moves the WINNER:');
  [...perQuestion.entries()]
    .map(([id, s]) => [id, s.tried ? s.moved / s.tried : 0])
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, rate]) => {
      const bar = '█'.repeat(Math.round(rate * 26)).padEnd(26, '·');
      console.log(`    ${id.padEnd(12)} ${bar} ${(rate * 100).toFixed(0)}%`);
    });
}


/*
 * Taste pass — is TASTE_PTS set anywhere useful? TASTE_PTS is consulted only in a fit tie (naming #1 vs handing off to refine chips), so this prints the #1-vs-#2 taste-gap distribution across real ties and what each threshold would do.
 * The gaps don't collapse to 1–2 pts as an early review predicted (that came from one unrepresentative pair) — re-run after a fixture refresh rather than reasoning from a sample of one.
 */
function auditTaste(brand) {
  const { byRetailer, tuning: t, budgetCfg, questions: qs } = loadBrand(brand);
  const gaps = [];
  let decisive = 0;
  let ties = 0;
  for (const stock of sampleRetailers(byRetailer, N_RETAILERS)) {
    if (stock.length < 15) continue; // too thin to produce a meaningful tie
    for (let i = 0; i < 40; i += 1) {
      const answers = applyBespokeAnswers(brand, randomAnswers(qs, budgetCfg));
      const r = matchCars(answers, stock, t);
      if (!r.matches.length) continue;
      if (r.decisive) { decisive += 1; continue; }
      ties += 1;
      if (r.matches.length >= 2) gaps.push(r.matches[0].taste - r.matches[1].taste);
    }
  }
  gaps.sort((a, b) => a - b);
  const share = (n) => pct(n, gaps.length);
  console.log(`\n${brand.toUpperCase()} — ${decisive} decisive, ${ties} ties`);
  console.log(`  taste gap in a tie: median ${median(gaps).toFixed(1)}`
    + `  p75 ${quantile(gaps, 0.75).toFixed(1)}  p90 ${quantile(gaps, 0.9).toFixed(1)}`);
  console.log('  distribution:');
  for (const [lo, hi] of [[0, 1], [1, 2], [2, 3], [3, 4], [4, 6], [6, 8], [8, 12], [12, 20], [20, Infinity]]) {
    const n = gaps.filter((g) => g >= lo && g < hi).length;
    const label = `${String(lo).padStart(2)}–${hi === Infinity ? ' ∞' : String(hi).padStart(2)}`;
    console.log(`    ${label}  ${'█'.repeat(Math.round((n / gaps.length) * 60)).padEnd(30)} ${share(n)}`);
  }
  console.log(`  threshold → share of ties given a named pick (TASTE_PTS is ${TASTE_PTS}):`);
  for (const th of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
    const n = gaps.filter((g) => g >= th).length;
    console.log(`    ${String(th).padStart(2)}${th === TASTE_PTS ? ' ←' : '  '} `
      + `${'█'.repeat(Math.round((n / gaps.length) * 30)).padEnd(30)} ${share(n)}`);
  }
}

/*
 * Confidence pass — where does "nothing here is close" begin? Prints the top-score distribution of CLOSEST pages (what WEAK_SCORE thresholds; only fires over a leader with a trade-off), sampled both uniformly and from personas.
 * Findings 2026-07-29: no cliff, so the threshold is a policy choice — the defensible spot is the population's median, which three samples put at 67–69.
 */
const WEAK_SCORE = 68; // mirrors blocks/vehicle-matcher/vehicle-matcher.js

function auditConfidence(brand) {
  const {
    byRetailer, tuning: t, budgetCfg, questions: qs,
  } = loadBrand(brand);
  const { personas } = JSON.parse(readFileSync(join(FIXTURES, 'personas.json'), 'utf8'));
  const pages = { uniform: [], personas: [] };

  const record = (bucket, stock, answers, tag) => {
    const r = matchCars(applyBespokeAnswers(brand, answers), stock, t);
    if (!r.matches.length) return;
    pages[bucket].push({
      score: r.matches[0].score,
      closest: (r.matches[0].tradeOffs || []).length > 0,
      tag,
    });
  };

  for (const stock of sampleRetailers(byRetailer, N_RETAILERS)) {
    for (let i = 0; i < 25; i += 1) record('uniform', stock, randomAnswers(qs, budgetCfg));
  }
  for (const p of personas.filter((x) => x.brand === brand)) {
    const stock = byRetailer.get(Number(p.retailer)) || byRetailer.get(p.retailer);
    if (!stock?.length) continue;
    record('personas', stock, p.answers, p.key);
    for (const q of qs) {
      let values = [];
      if (q.id === 'budget') values = [[10000, 25000], [15000, 35000], [25000, 50000], [40000, 80000]];
      else if (q.id === 'mileage') values = [4000, 9000, 15000, 25000];
      else if (q.options) values = q.multi ? q.options.map((o) => [o.value]) : q.options.map((o) => o.value);
      for (const v of values) record('personas', stock, { ...p.answers, [q.id]: v });
    }
  }

  console.log(`\n${'='.repeat(72)}\n${brand.toUpperCase()}`);
  for (const [bucket, rows] of Object.entries(pages)) {
    const closest = rows.filter((r) => r.closest);
    const scores = closest.map((r) => r.score);
    if (!scores.length) { console.log(`\n  ${bucket}: no closest pages`); continue; }
    console.log(`\n  ${bucket}: ${rows.length} pages, ${closest.length} of them CLOSEST (${pct(closest.length, rows.length)})`);
    console.log(`    closest-page top score: p25 ${quantile(scores, 0.25)}`
      + `  MEDIAN ${median(scores)}  p75 ${quantile(scores, 0.75)}`);
    for (let lo = 35; lo < 100; lo += 5) {
      const n = scores.filter((s) => s >= lo && s < lo + 5).length;
      console.log(`      ${String(lo).padStart(2)}–${lo + 4}  ${'█'.repeat(Math.round((n / scores.length) * 60)).padEnd(30)} ${pct(n, scores.length)}`);
    }
    console.log(`    threshold → share of ALL pages that say "nothing here is close" (WEAK_SCORE is ${WEAK_SCORE}):`);
    for (const th of [60, 62, 64, 66, 68, 70, 72, 75]) {
      const n = closest.filter((r) => r.score < th).length;
      console.log(`      ${th}${th === WEAK_SCORE ? ' ←' : '  '} `
        + `${'█'.repeat(Math.round((n / rows.length) * 60)).padEnd(30)} ${pct(n, rows.length)}`
        + `   (${pct(n, closest.length)} of closest pages)`);
    }
  }
  const named = pages.personas.filter((r) => r.tag);
  console.log('\n  personas as answered:');
  named.forEach((r) => console.log(`    ${r.tag.padEnd(8)} ${String(r.score).padStart(3)}%  `
    + `${r.closest ? 'misses a stated want' : 'meets the brief'}  →  `
    + `${r.closest && r.score < WEAK_SCORE ? 'NOTHING HERE IS CLOSE' : (r.closest ? 'closest here' : '—')}`));
}

// ----------------------------------------------------------------- run ----

const PASSES = {
  dead: [auditDead],
  sens: [auditSensitivity],
  size: [auditBySize],
  fuel: [auditFuel],
  stick: [auditStickiness],
  taste: [auditTaste],
  conf: [auditConfidence],
  all: [
    auditDead, auditSensitivity, auditBySize, auditFuel,
    auditStickiness, auditTaste, auditConfidence,
  ],
};
const passes = PASSES[MODE];
if (!passes) {
  console.error('Usage: node scripts/audit-questions.mjs [dead|sens|size|fuel|stick|taste|conf|all]');
  process.exit(1);
}
for (const pass of passes) {
  console.log(`\n${'#'.repeat(74)}\n# ${pass.name.replace('audit', '').toUpperCase()}\n${'#'.repeat(74)}`);
  for (const brand of BRANDS) pass(brand);
}
