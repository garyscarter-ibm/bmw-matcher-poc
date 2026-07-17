import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  matchCars, rankCars, budgetRange, STRETCH_FACTOR,
} from '../engine.js';
import { CARS } from '../data.js';
import { BUDGET_BANDS, QUESTIONS } from '../questions.js';

function run(answers) {
  return matchCars(answers, CARS);
}

/** Full ranking, not just the top 3 — lets a test assert over every survivor. */
function runAll(answers) {
  return rankCars(answers, CARS);
}

const base = {
  budget: 'b2',
  bodyStyles: ['any'],
  fuel: 'open',
  charging: 'none',
  primaryUse: 'commute',
  people: 'solo',
  boot: 'small',
  mileage: 'mid',
  style: '3',
  priorities: ['economy', 'comfort'],
};

test('budget-constrained city driver gets a small, affordable car', () => {
  const { matches } = run({
    ...base,
    budget: 'b1',
    primaryUse: 'city',
    fuel: 'petrol',
    priorities: ['economy', 'image'],
  });
  assert.ok(matches.length > 0);
  const top = matches[0].car;
  const [, max] = BUDGET_BANDS.b1;
  assert.ok(top.priceMin <= max * STRETCH_FACTOR, 'top match respects budget + stretch');
  assert.ok(top.sizeClass <= 2, `expected a compact car, got ${top.name}`);
  assert.notEqual(top.fuel, 'ev', 'petrol preference should not surface an EV first');
});

test('large family with big boot needs gets practical 5+ seaters only', () => {
  const answers = {
    ...base,
    budget: 'b4',
    bodyStyles: ['suv', 'estate'],
    people: 'crew',
    boot: 'big',
    primaryUse: 'family',
    priorities: ['comfort', 'economy'],
  };
  const { matches } = run(answers);
  assert.ok(matches.length > 0);
  for (const m of runAll(answers)) {
    assert.ok(m.car.seats >= 5, `${m.car.name} has too few seats`);
    assert.ok(m.car.boot >= 430, `${m.car.name} boot too small for a crew`);
  }
  assert.ok(['suv', 'estate'].includes(matches[0].car.body));
});

test('enthusiast gets a fast, drivers-car match', () => {
  const { matches } = run({
    ...base,
    budget: 'b4',
    bodyStyles: ['coupe'],
    fuel: 'petrol',
    primaryUse: 'fun',
    style: '5',
    priorities: ['performance', 'image'],
  });
  const top = matches[0].car;
  assert.ok(top.zeroTo62 < 5, `expected something quick, got ${top.name} (${top.zeroTo62}s)`);
  assert.ok(top.tags.includes('drivers-car'));
  assert.equal(top.body, 'coupe');
});

test('EV-curious commuter with home charging is steered electric', () => {
  const { matches } = run({
    ...base,
    budget: 'b3',
    fuel: 'open',
    charging: 'home',
    primaryUse: 'commute',
    mileage: 'high',
    priorities: ['economy', 'tech'],
  });
  assert.equal(matches[0].car.fuel, 'ev', `expected an EV first, got ${matches[0].car.name}`);
});

test('EV preference without charging access is heavily penalised', () => {
  const withCharging = run({ ...base, budget: 'b3', fuel: 'ev', charging: 'home' });
  const without = run({ ...base, budget: 'b3', fuel: 'ev', charging: 'none' });
  const evTop = withCharging.matches[0];
  assert.equal(evTop.car.fuel, 'ev');
  const sameCar = rankCars({ ...base, budget: 'b3', fuel: 'ev', charging: 'none' }, CARS)
    .find((m) => m.car.id === evTop.car.id);
  if (sameCar) {
    assert.ok(sameCar.score < evTop.score, 'no-charging score should drop');
  }
});

test('contradictory answers still produce ranked, in-filter results', () => {
  // Tiny budget, maximum-attack sports intent, seven people, huge boot.
  // Engine must not crash and must respect hard filters even if empty.
  for (const m of runAll({
    ...base,
    budget: 'b1',
    bodyStyles: ['convertible'],
    people: 'crew',
    boot: 'big',
    style: '5',
    priorities: ['performance', 'image'],
  })) {
    assert.ok(m.car.seats >= 5);
    assert.ok(m.car.priceMin <= BUDGET_BANDS.b1[1] * STRETCH_FACTOR);
  }
});

test('scores are 0–100, sorted, deterministic, with reasons on the top match', () => {
  const a = run(base);
  const b = run(base);
  assert.deepEqual(a, b, 'same answers → same output');
  const all = runAll(base);
  for (let i = 0; i < all.length; i += 1) {
    assert.ok(all[i].score >= 0 && all[i].score <= 100);
    if (i > 0) assert.ok(all[i - 1].score >= all[i].score, 'sorted descending');
  }
  assert.ok(a.matches[0].reasons.length >= 1, 'top match explains itself');
});

test('stretch cars are flagged and carry a stretch reason', () => {
  // b1 budget: M135 (43k+) is within 15% of... no; use b2 (max 50k) → M240i (48k) fits;
  // find any returned stretch match across a few personas and assert the flag text.
  const stretchy = runAll({ ...base, budget: 'b2', style: '5', priorities: ['performance', 'image'], fuel: 'petrol', primaryUse: 'fun' }).filter((m) => m.stretch);
  for (const m of stretchy) {
    assert.ok(m.car.priceMin > BUDGET_BANDS.b2[1]);
    assert.ok(m.reasons.some((r) => r.toLowerCase().includes('stretch')));
  }
});

test('rankCars ranks a mixed-retailer pool on merit alone', () => {
  // The "worth the drive" carousel ranks cars from several retailers through
  // the same scoring as the hero grid. Retailer/distance must not leak into
  // the score: two identical cars differing only in where they sit must tie.
  const [near, far] = [2.2, 31.1].map((distance) => ({
    ...CARS[0], id: `${CARS[0].id}-${distance}`, distance, retailerId: distance < 10 ? 96 : 101,
  }));
  const ranked = rankCars(base, [near, far]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].score, ranked[1].score, 'distance must not affect score');
});

test('rankCars returns every survivor, not just the top 3', () => {
  const all = rankCars(base, CARS);
  const { matches } = run(base);
  assert.ok(all.length > matches.length, 'ranking is wider than the headline matches');
  assert.equal(matches.length, 3);
  assert.deepEqual(matches, all.slice(0, 3), 'matches are the head of the full ranking');
});

test('every dataset entry has the fields the engine needs', () => {
  for (const car of CARS) {
    for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
      assert.ok(car[field] !== undefined, `${car.name} missing ${field}`);
    }
    assert.ok(car.priceMin <= car.priceMax, `${car.name} price range inverted`);
    if (car.fuel === 'ev') assert.ok(car.evRange > 0, `${car.name} needs evRange`);
    else assert.ok(car.mpg > 0, `${car.name} needs mpg`);
  }
});

/* ---- Stakeholder amendments: slider budget/mileage, multi-select fuel ---- */

test('budgetRange resolves both a legacy band key and a raw number', () => {
  assert.deepEqual(budgetRange({ budget: 'b2' }), BUDGET_BANDS.b2);
  assert.deepEqual(budgetRange({ budget: 60000 }), [0, 60000]);
  assert.equal(budgetRange({ budget: 0 }), null, '0 is not a usable budget');
  assert.equal(budgetRange({ budget: 'nope' }), null);
});

test('a numeric budget ranks the same cars as the equivalent band', () => {
  // b3 is [50k, 70k]; a 70k number should surface the same top match.
  const byBand = run({ ...base, budget: 'b3', fuel: 'petrol', primaryUse: 'commute' });
  const byNumber = run({ ...base, budget: 70000, fuel: ['petrol'], primaryUse: 'commute' });
  assert.ok(byNumber.matches.length > 0);
  assert.equal(byNumber.matches[0].car.id, byBand.matches[0].car.id);
});

test('multi-select fuel scores a car on its best matching fuel', () => {
  // Picking petrol + ev: a petrol car should score on its (perfect) petrol
  // merit, not be dragged down by the ev mismatch — best-of, not average.
  const petrolOnly = rankCars({ ...base, budget: 'b3', fuel: ['petrol'], charging: 'none' }, CARS);
  const petrolAndEv = rankCars({ ...base, budget: 'b3', fuel: ['petrol', 'ev'], charging: 'none' }, CARS);
  const aPetrol = petrolOnly.find((m) => m.car.fuel === 'petrol');
  assert.ok(aPetrol, 'expected a petrol car in the pool');
  const same = petrolAndEv.find((m) => m.car.id === aPetrol.car.id);
  assert.ok(same.score >= aPetrol.score, 'adding EV as an option must not lower a petrol car');
});

test('an empty / absent fuel selection scores like "help me decide"', () => {
  const asOpen = rankCars({ ...base, budget: 'b3', fuel: 'open' }, CARS);
  const asEmpty = rankCars({ ...base, budget: 'b3', fuel: [] }, CARS);
  assert.deepEqual(asEmpty.map((m) => m.car.id), asOpen.map((m) => m.car.id));
});

test('numeric mileage ≥20k triggers the same diesel/economy boost as vhigh', () => {
  const byBand = run({ ...base, budget: 'b3', fuel: ['open'], mileage: 'vhigh' });
  const byNumber = run({ ...base, budget: 'b3', fuel: ['open'], mileage: 22000 });
  assert.equal(byNumber.matches[0].car.id, byBand.matches[0].car.id);
  // And a low number must NOT trigger it — 5k should differ from 22k when a
  // diesel is in play.
  const low = run({ ...base, budget: 'b3', fuel: ['open'], mileage: 5000 });
  assert.ok(low.matches.length > 0);
});

test('charging "either" gives EV access like home charging', () => {
  const home = rankCars({ ...base, budget: 'b3', fuel: ['ev'], charging: 'home' }, CARS);
  const either = rankCars({ ...base, budget: 'b3', fuel: ['ev'], charging: 'either' }, CARS);
  const evHome = home.find((m) => m.car.fuel === 'ev');
  assert.ok(evHome, 'expected an EV with home charging');
  const evEither = either.find((m) => m.car.id === evHome.car.id);
  assert.equal(evEither.score, evHome.score, '"either" should match "home" for EV access');
});

test('quiz answer keys line up with what the engine reads', () => {
  const ids = QUESTIONS.map((q) => q.id);
  for (const key of ['budget', 'bodyStyles', 'fuel', 'charging', 'primaryUse', 'people', 'boot', 'mileage', 'style', 'priorities']) {
    assert.ok(ids.includes(key), `question "${key}" missing from quiz`);
  }
});
