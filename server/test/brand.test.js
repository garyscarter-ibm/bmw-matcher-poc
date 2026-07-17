import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapVehicle } from '../mapping.js';
import { questionsForBrand } from '../questions.js';
import { normalizeBrand, brandConfig } from '../brands.js';

/* Feed-shaped fixtures (the fields mapVehicle actually reads). */
const bmwVehicle = {
  advert_id: 202500001,
  title: 'BMW X3',
  derivative: 'X3 M40d',
  fuel: 'Diesel',
  cash_price: { value: 45990 },
  mileage: 12000,
  identification: { plate: '73' },
  consumption: { fuel: { values: { combined: 42.1 } } },
  media: { items: [{ type: 'image', url: 'https://img/x3.jpg' }] },
  retailer_site: { id: 96, name: 'Grassicks BMW', dealer_number: '11107' },
};

const miniVehicle = {
  advert_id: 202500002,
  title: 'MINI Countryman',
  derivative: 'Countryman S ALL4',
  fuel: 'Petrol',
  cash_price: { value: 28750 },
  mileage: 9681,
  identification: { plate: '74' },
  consumption: { fuel: { values: { combined: 42.2 } } },
  media: { items: [{ type: 'image', url: 'https://img/countryman.jpg' }] },
  retailer_site: { id: 92, name: 'Sytner Luton MINI', dealer_number: '15127' },
};

const miniElectric = {
  advert_id: 202500003,
  title: 'MINI Aceman',
  derivative: 'Aceman E',
  fuel: 'ELECTRIC',
  cash_price: { value: 26950 },
  mileage: 1580,
  consumption: { range: { values: { total: 250 } } },
  media: { items: [{ type: 'image', url: 'https://img/aceman.jpg' }] },
  retailer_site: { id: 92, name: 'Sytner Luton MINI', dealer_number: '15127' },
};

test('normalizeBrand defaults unknown/absent to bmw, accepts mini case-insensitively', () => {
  assert.equal(normalizeBrand(undefined), 'bmw');
  assert.equal(normalizeBrand('nope'), 'bmw');
  assert.equal(normalizeBrand('MINI'), 'mini');
  assert.equal(normalizeBrand('Mini'), 'mini');
});

test('brand config carries the right origin + default retailer', () => {
  assert.match(brandConfig('bmw').origin, /usedcars\.bmw\.co\.uk/);
  assert.equal(brandConfig('bmw').defaultRetailer, '96');
  assert.match(brandConfig('mini').origin, /approvedusedminis\.co\.uk/);
  assert.equal(brandConfig('mini').defaultRetailer, '92');
});

test('mapVehicle(bmw) produces a BMW car with a BMW PDP link', () => {
  const car = mapVehicle(bmwVehicle, 'bmw');
  assert.equal(car.body, 'suv');
  assert.equal(car.fuel, 'diesel');
  assert.equal(car.priceMin, 45990);
  assert.ok(car.seats >= 5);
  assert.match(car.link, /usedcars\.bmw\.co\.uk\/vehicle\/202500001/);
});

test('mapVehicle(mini) resolves a MINI spec, body and MINI PDP link', () => {
  const car = mapVehicle(miniVehicle, 'mini');
  assert.equal(car.line, 'Countryman');
  assert.equal(car.body, 'suv'); // Countryman is a crossover
  assert.equal(car.fuel, 'petrol');
  assert.equal(car.priceMin, 28750);
  assert.ok(car.seats >= 5 && car.boot > 0 && car.zeroTo62 > 0, 'MINI specs filled from MODEL_SPECS_MINI');
  assert.match(car.name, /MINI/);
  assert.match(car.link, /approvedusedminis\.co\.uk\/vehicle\/202500002/);
});

test('mapVehicle(mini) maps ELECTRIC fuel and an electric line', () => {
  const car = mapVehicle(miniElectric, 'mini');
  assert.equal(car.fuel, 'ev');
  assert.equal(car.line, 'Aceman');
  assert.equal(car.body, 'suv');
  assert.ok(car.tags.includes('tech'));
});

test('questionsForBrand(mini) drops options MINI does not sell', () => {
  const q = questionsForBrand('mini');
  const byId = Object.fromEntries(q.map((x) => [x.id, x]));
  const bodyValues = byId.bodyStyles.options.map((o) => o.value);
  const fuelValues = byId.fuel.options.map((o) => o.value);
  assert.ok(!bodyValues.includes('saloon'), 'MINI has no saloon');
  assert.ok(!bodyValues.includes('coupe'), 'MINI has no coupé');
  assert.ok(!bodyValues.includes('mpv'), 'MINI has no 7-seat MPV');
  assert.ok(bodyValues.includes('hatchback') && bodyValues.includes('suv'));
  assert.ok(!fuelValues.includes('diesel'), 'MINI has no diesel');
  assert.ok(fuelValues.includes('ev') && fuelValues.includes('petrol'));
  // The internal `brands` marker must never reach the client.
  for (const opt of byId.bodyStyles.options) assert.equal(opt.brands, undefined);
});

test('the budget slider is capped lower for MINI than for BMW', () => {
  const bmwBudget = questionsForBrand('bmw').find((q) => q.id === 'budget');
  const miniBudget = questionsForBrand('mini').find((q) => q.id === 'budget');
  assert.equal(bmwBudget.max, 150000, 'BMW keeps the full range');
  assert.ok(miniBudget.max <= 50000, 'MINI budget is capped near its price ceiling');
  assert.ok(miniBudget.max < bmwBudget.max, 'MINI cap is below BMW');
  // Shared base fields are untouched, so the client renders it identically.
  assert.equal(miniBudget.type, 'slider');
  assert.equal(miniBudget.range, true);
  assert.equal(miniBudget.step, 1000);
  // The MINI default bracket sits within its own range.
  const [lo, hi] = miniBudget.default;
  assert.ok(lo >= miniBudget.min && hi <= miniBudget.max, 'MINI default is inside its range');
});

test('MINI copy differs from BMW in words but keeps identical option values', () => {
  const bmw = questionsForBrand('bmw');
  const mini = questionsForBrand('mini');
  const bmwById = Object.fromEntries(bmw.map((q) => [q.id, q]));
  const miniById = Object.fromEntries(mini.map((q) => [q.id, q]));

  // Titles are reworded for MINI (e.g. budget, style, priorities).
  assert.notEqual(miniById.budget.title, bmwById.budget.title);
  assert.notEqual(miniById.priorities.title, bmwById.priorities.title);
  assert.match(miniById.style.title, /DRIVE/i);

  // But every option VALUE is unchanged for questions common to both brands,
  // so the scoring engine sees the same answer space.
  for (const id of ['primaryUse', 'people', 'boot', 'style', 'priorities', 'charging']) {
    const bmwVals = (bmwById[id].options || []).map((o) => o.value).sort();
    const miniVals = (miniById[id].options || []).map((o) => o.value).sort();
    assert.deepEqual(miniVals, bmwVals, `${id} option values must match across brands`);
  }
  // A reworded label actually changed (style value '5').
  const miniS5 = miniById.style.options.find((o) => o.value === '5');
  const bmwS5 = bmwById.style.options.find((o) => o.value === '5');
  assert.notEqual(miniS5.label, bmwS5.label);
  assert.match(miniS5.label, /go-kart/i);
});

test('questionsForBrand(bmw) keeps the full option set', () => {
  const q = questionsForBrand('bmw');
  const byId = Object.fromEntries(q.map((x) => [x.id, x]));
  const bodyValues = byId.bodyStyles.options.map((o) => o.value);
  const fuelValues = byId.fuel.options.map((o) => o.value);
  assert.ok(bodyValues.includes('saloon') && bodyValues.includes('coupe') && bodyValues.includes('mpv'));
  assert.ok(fuelValues.includes('diesel'));
});
