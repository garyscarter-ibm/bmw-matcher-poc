/*
 * Age helper — mingle's swipe card shows a vehicle's AGE not its reg plate, decoded
 * from whatever the card carries per brand (plate code, VRM, date). Pin every format.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ageInYears, registrationDate } from '../../blocks/vehicle-matcher/modes/match-signal.js';

// A fixed "now" so the expected ages never drift with the wall clock.
const NOW = new Date(2026, 7, 13); // 13 Aug 2026, local time (months are 0-based)

test('firstReg date drives the age, before/after the anniversary', () => {
  // 29 Aug 2019: the 2026 anniversary (29 Aug) is still ahead of 13 Aug, so 6.
  assert.equal(ageInYears({ firstReg: '29/08/2019' }, NOW), 6);
  // 20 Sep 2022: anniversary well ahead, so three full years elapsed.
  assert.equal(ageInYears({ firstReg: '20/09/2022' }, NOW), 3);
});

test('a same-year registration reads as brand new (age 0)', () => {
  assert.equal(ageInYears({ firstReg: '02/09/2025' }, NOW), 0);
});

test('a bare year falls to 1 March as a fair midpoint', () => {
  // 1 Mar 2022 -> 1 Mar 2026 has passed, so four years by 13 Aug.
  assert.equal(ageInYears({ year: 2022 }, NOW), 4);
});

test('firstReg wins over a year that disagrees', () => {
  // Prefer the precise date over the coarse year (see registrationDate order).
  const car = { firstReg: '02/09/2025', year: 2019 };
  assert.equal(ageInYears(car, NOW), 0);
});

test('BMW / MINI bare age code decodes (1-50 = March)', () => {
  // "23" -> March 2023; three full years by Aug 2026.
  assert.equal(ageInYears({ plate: '23' }, NOW), 3);
  // "74" -> Sept 2024; the Sept anniversary is still ahead, so one year.
  assert.equal(ageInYears({ plate: '74' }, NOW), 1);
});

test('a 51-99 code is a September plate of code-50', () => {
  // "73" -> Sept 2023 (2000 + 73 - 50). Sept anniversary ahead of 13 Aug -> 2.
  assert.equal(ageInYears({ plate: '73' }, NOW), 2);
  // "72" -> Sept 2022 -> 3.
  assert.equal(ageInYears({ plate: '72' }, NOW), 3);
});

test('Ford plate with a dealer suffix reads the leading code', () => {
  // "73 FRD" -> Sept 2023, same as the bare "73".
  assert.equal(ageInYears({ plate: '73 FRD' }, NOW), 2);
});

test('Honda full VRM reads the age code from the third/fourth chars', () => {
  // "LE68EMX" -> code 68 -> Sept 2018; ~8y elapsed by Aug 2026.
  assert.equal(ageInYears({ plate: 'LE68EMX' }, NOW), 7);
  // "AU19MVG" -> code 19 -> March 2019 -> 7.
  assert.equal(ageInYears({ plate: 'AU19MVG' }, NOW), 7);
});

test('no derivable date returns null so the card can fall back', () => {
  assert.equal(ageInYears({}, NOW), null);
  assert.equal(ageInYears({ plate: 'PERSONAL' }, NOW), null);
  assert.equal(registrationDate({}), null);
});

test('a future-dated registration never goes negative', () => {
  assert.equal(ageInYears({ firstReg: '01/01/2030' }, NOW), 0);
});
