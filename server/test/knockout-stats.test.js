/*
 * Pure row-builders behind knockout's head-to-head stat panel: each returns null
 * unless a metric is on both cars, names the winner, and stamps a listing/model tier.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { _stat } from '../../blocks/vehicle-matcher/modes/knockout.js';

const {
  lowerBetterRow, higherBetterRow, zeroTo62Row, ageRow, fshRow, firstRows,
  mileageOf, powerOf, ccOf, topSpeedOf, milesText, secsText, ageText,
} = _stat;

// A fixed "now" so age expectations never drift with the wall clock.
const NOW = new Date(2026, 7, 13); // 13 Aug 2026 (months are 0-based)

test('lowerBetterRow: the smaller value wins, and the text is formatted', () => {
  const row = lowerBetterRow('Mileage', { mileage: 12000 }, { mileage: 30000 }, mileageOf, milesText);
  assert.equal(row.winner, 'a');
  assert.equal(row.aText, '12,000 miles');
  assert.equal(row.bText, '30,000 miles');
  assert.equal(row.tier, 'listing'); // real per-listing by default
});

test('lowerBetterRow: equal values are a tie (no side crowned)', () => {
  const row = lowerBetterRow('Mileage', { mileage: 20000 }, { mileage: 20000 }, mileageOf, milesText);
  assert.equal(row.winner, null);
});

test('lowerBetterRow / higherBetterRow: a missing value on either car nulls the row', () => {
  assert.equal(lowerBetterRow('Mileage', { mileage: 12000 }, {}, mileageOf, milesText), null);
  assert.equal(lowerBetterRow('Mileage', {}, { mileage: 12000 }, mileageOf, milesText), null);
  assert.equal(higherBetterRow('Power', { power: 300 }, { power: NaN }, powerOf, (n) => `${n} bhp`), null);
});

test('higherBetterRow: the larger value wins (power / cc / top speed)', () => {
  const power = higherBetterRow('Power', { power: 641 }, { power: 592 }, powerOf, (n) => `${n} bhp`);
  assert.equal(power.winner, 'a');
  assert.equal(power.aText, '641 bhp');

  const cc = higherBetterRow('Engine', { cc: 3902 }, { cc: 2992 }, ccOf, (n) => `${n.toLocaleString('en-GB')}cc`);
  assert.equal(cc.winner, 'a');
  assert.equal(cc.aText, '3,902cc');

  const top = higherBetterRow('Top speed', { topSpeed: 205 }, { topSpeed: 211 }, topSpeedOf, (n) => `${n} mph`);
  assert.equal(top.winner, 'b');
  assert.equal(top.bText, '211 mph');
});

test('zeroTo62Row: quicker (lower) wins, is labelled "0 to 62", and is tier:model', () => {
  const row = zeroTo62Row({ zeroTo62: 2.9 }, { zeroTo62: 3.5 });
  assert.equal(row.label, '0 to 62');
  assert.equal(row.winner, 'a'); // quicker
  assert.equal(row.aText, '2.9s');
  assert.equal(row.tier, 'model'); // a shared model spec, not a listing fact
});

test('zeroTo62Row: nulls when either car has no 0-62', () => {
  assert.equal(zeroTo62Row({ zeroTo62: 3.5 }, {}), null);
});

test('ageRow: the younger car wins, with a fixed now, and reads in whole years', () => {
  // A registered 2024 vs 2021 (bare year -> 1 March midpoint).
  const row = ageRow({ year: 2024 }, { year: 2021 }, NOW);
  assert.equal(row.winner, 'a'); // younger
  assert.equal(row.aText, '2 yrs');
  assert.equal(row.bText, '5 yrs');
  assert.equal(row.tier, 'listing');
});

test('ageRow: same age is a tie; an undecodable car nulls the row', () => {
  assert.equal(ageRow({ year: 2022 }, { year: 2022 }, NOW).winner, null);
  assert.equal(ageRow({ year: 2022 }, {}, NOW), null);
});

test('ageText: under a year reads plainly (no negative, no em dash)', () => {
  assert.equal(ageText(0), 'Under a year');
  assert.equal(ageText(1), '1 yr');
  assert.equal(ageText(4), '4 yrs');
  assert.equal(secsText(3.4), '3.4s');
});

test('fshRow: a documented history beats a partial/absent one', () => {
  const row = fshRow({ fullServiceHistory: 'Yes' }, { fullServiceHistory: 'No' });
  assert.equal(row.winner, 'a');
  assert.equal(row.aText, 'Full service history');
  assert.equal(row.bText, 'Partial or none');
});

test('fshRow: level history (or neither car carrying it) nulls, so the caller falls back', () => {
  assert.equal(fshRow({ fullServiceHistory: 'Yes' }, { fullServiceHistory: 'Yes' }), null);
  assert.equal(fshRow({}, {}), null);
});

test('firstRows: keeps the first n non-null rows, skipping nulls', () => {
  const rows = [
    lowerBetterRow('Mileage', { mileage: 1 }, { mileage: 2 }, mileageOf, milesText),
    null, // a dropped metric
    higherBetterRow('Power', { power: 300 }, { power: 200 }, powerOf, (n) => `${n} bhp`),
    ageRow({ year: 2024 }, { year: 2020 }, NOW),
    zeroTo62Row({ zeroTo62: 3 }, { zeroTo62: 4 }),
  ];
  const kept = firstRows(rows, 3);
  assert.equal(kept.length, 3);
  assert.deepEqual(kept.map((r) => r.label), ['Mileage', 'Power', 'Age']);
});

/*
 * The panel-level rules buildStatPanel enforces, over the pure rows: model-only
 * sets drop, and a set caps at three with the real per-listing rows leading.
 */

test('a Ferrari-shaped set leads on real per-listing rows, keeps 0-62 as support, caps at 3', () => {
  const a = { power: 641, cc: 3902, topSpeed: 211, zeroTo62: 2.9 };
  const b = { power: 592, cc: 2992, topSpeed: 205, zeroTo62: 3.5 };
  // The same order the ferrari statRows hook composes.
  const rows = [
    higherBetterRow('Power', a, b, powerOf, (n) => `${n} bhp`),
    higherBetterRow('Engine', a, b, ccOf, (n) => `${n.toLocaleString('en-GB')}cc`),
    higherBetterRow('Top speed', a, b, topSpeedOf, (n) => `${n} mph`),
    zeroTo62Row(a, b),
  ];
  const kept = firstRows(rows, 3);
  assert.equal(kept.length, 3);
  // Power + Engine + Top speed win the three slots; 0-62 is pushed out (support).
  assert.deepEqual(kept.map((r) => r.label), ['Power', 'Engine', 'Top speed']);
  assert.ok(kept.every((r) => r.tier === 'listing'));
});

test('model-tier-only rule: a set with no surviving listing row keeps nothing', () => {
  // Mimics buildStatPanel: no per-listing metric present on both cars, only 0-62.
  const a = { zeroTo62: 3.0 };
  const b = { zeroTo62: 3.4 };
  const rows = [
    lowerBetterRow('Mileage', a, b, mileageOf, milesText), // null (no mileage)
    higherBetterRow('Engine', a, b, ccOf, (n) => `${n}cc`), // null (no cc)
    zeroTo62Row(a, b), // the only survivor, tier:model
  ];
  const valid = rows.filter(Boolean);
  const hasListing = valid.some((r) => r.tier !== 'model');
  const kept = firstRows(hasListing ? valid : valid.filter((r) => r.tier !== 'model'), 3);
  assert.equal(hasListing, false);
  assert.equal(kept.length, 0); // model-only => the panel doesn't paint
});
