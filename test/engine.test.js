import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchCars, STRETCH_FACTOR } from '../blocks/bmw-matcher/engine.js';
import { CARS } from '../blocks/bmw-matcher/data.js';
import { BUDGET_BANDS, QUESTIONS } from '../blocks/bmw-matcher/questions.js';

function run(answers) {
  return matchCars(answers, CARS);
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
  const { matches, contenders } = run({
    ...base,
    budget: 'b4',
    bodyStyles: ['suv', 'estate'],
    people: 'crew',
    boot: 'big',
    primaryUse: 'family',
    priorities: ['comfort', 'economy'],
  });
  assert.ok(matches.length > 0);
  for (const m of [...matches, ...contenders]) {
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
  const sameCar = without.matches.concat(without.contenders)
    .find((m) => m.car.id === evTop.car.id);
  if (sameCar) {
    assert.ok(sameCar.score < evTop.score, 'no-charging score should drop');
  }
});

test('contradictory answers still produce ranked, in-filter results', () => {
  // Tiny budget, maximum-attack sports intent, seven people, huge boot.
  const { matches, contenders } = run({
    ...base,
    budget: 'b1',
    bodyStyles: ['convertible'],
    people: 'crew',
    boot: 'big',
    style: '5',
    priorities: ['performance', 'image'],
  });
  // Engine must not crash and must respect hard filters even if empty.
  for (const m of [...matches, ...contenders]) {
    assert.ok(m.car.seats >= 5);
    assert.ok(m.car.priceMin <= BUDGET_BANDS.b1[1] * STRETCH_FACTOR);
  }
});

test('scores are 0–100, sorted, deterministic, with reasons on the top match', () => {
  const a = run(base);
  const b = run(base);
  assert.deepEqual(a, b, 'same answers → same output');
  const all = [...a.matches, ...a.contenders];
  for (let i = 0; i < all.length; i += 1) {
    assert.ok(all[i].score >= 0 && all[i].score <= 100);
    if (i > 0) assert.ok(all[i - 1].score >= all[i].score, 'sorted descending');
  }
  assert.ok(a.matches[0].reasons.length >= 1, 'top match explains itself');
});

test('stretch cars are flagged and carry a stretch reason', () => {
  // b1 budget: M135 (43k+) is within 15% of... no; use b2 (max 50k) → M240i (48k) fits;
  // find any returned stretch match across a few personas and assert the flag text.
  const { matches, contenders } = run({ ...base, budget: 'b2', style: '5', priorities: ['performance', 'image'], fuel: 'petrol', primaryUse: 'fun' });
  const stretchy = [...matches, ...contenders].filter((m) => m.stretch);
  for (const m of stretchy) {
    assert.ok(m.car.priceMin > BUDGET_BANDS.b2[1]);
    assert.ok(m.reasons.some((r) => r.toLowerCase().includes('stretch')));
  }
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

test('quiz answer keys line up with what the engine reads', () => {
  const ids = QUESTIONS.map((q) => q.id);
  for (const key of ['budget', 'bodyStyles', 'fuel', 'charging', 'primaryUse', 'people', 'boot', 'mileage', 'style', 'priorities']) {
    assert.ok(ids.includes(key), `question "${key}" missing from quiz`);
  }
});
