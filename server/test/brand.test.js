import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  mapVehicle, mapHondaRaw, mapFordRaw, mapMotorradRaw,
} from '../mapping.js';
import { questionsForBrand, applyBespokeAnswers } from '../questions.js';
import { normalizeBrand, brandConfig, brandTuning } from '../brands.js';
import { rankCars } from '../engine.js';
import { motorradRowsFromEnvelope, motorradRowToRaw } from '../stock.js';
import { parseListingHtml, parseCard, listingUrl } from '../honda-listing.js';

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

  // Titles are reworded for MINI (e.g. budget, priorities).
  assert.notEqual(miniById.budget.title, bmwById.budget.title);
  assert.notEqual(miniById.priorities.title, bmwById.priorities.title);

  // But every option VALUE is unchanged for questions common to both brands
  // (style is MINI-dropped, so it's not in this list), so the scoring engine
  // sees the same answer space where a question is shared.
  for (const id of ['primaryUse', 'people', 'priorities', 'charging']) {
    const bmwVals = (bmwById[id].options || []).map((o) => o.value).sort();
    const miniVals = (miniById[id].options || []).map((o) => o.value).sort();
    assert.deepEqual(miniVals, bmwVals, `${id} option values must match across brands`);
  }
  // A reworded label actually changed (primaryUse value 'fun') while its value held.
  const miniFun = miniById.primaryUse.options.find((o) => o.value === 'fun');
  const bmwFun = bmwById.primaryUse.options.find((o) => o.value === 'fun');
  assert.notEqual(miniFun.label, bmwFun.label);
  assert.match(miniFun.sub, /go-kart/i);
});

test('questionsForBrand(bmw) keeps the full option set', () => {
  const q = questionsForBrand('bmw');
  const byId = Object.fromEntries(q.map((x) => [x.id, x]));
  const bodyValues = byId.bodyStyles.options.map((o) => o.value);
  const fuelValues = byId.fuel.options.map((o) => o.value);
  assert.ok(bodyValues.includes('saloon') && bodyValues.includes('coupe') && bodyValues.includes('mpv'));
  assert.ok(fuelValues.includes('diesel'));
});

/* ---- brand tuning: MINI scored against its own class ---- */

// A small, quick-for-its-class MINI hatch (the kind the BMW curve under-scores).
const miniHatch = {
  id: 'h', name: 'MINI Cooper', line: 'Hatch', body: 'hatchback', fuel: 'petrol',
  priceMin: 22000, priceMax: 22000, sizeClass: 1, seats: 4, boot: 210,
  zeroTo62: 7.7, mpg: 45, tags: ['urban', 'drivers-car'], blurb: '',
};

test('brand tuning: BMW default is unchanged (no tuning arg == BMW tuning)', () => {
  const answers = {
    budget: [15000, 35000], bodyStyles: ['hatchback'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'city', people: 'solo', mileage: 8000, style: '5', priorities: ['performance'],
  };
  const noArg = rankCars(answers, [miniHatch])[0].score;
  const bmwArg = rankCars(answers, [miniHatch], brandTuning('bmw'))[0].score;
  assert.equal(noArg, bmwArg, 'omitting tuning must equal the BMW tuning');
});

test('brand tuning: a sporty MINI scores higher under MINI tuning than BMW tuning', () => {
  // A JCW — genuinely quick for a MINI (6.0s) — is exactly the car the BMW
  // curve under-scores and MINI tuning should reward.
  const jcw = {
    ...miniHatch, id: 'jcw', name: 'MINI John Cooper Works', zeroTo62: 6.0, tags: ['urban', 'drivers-car', 'image'],
  };
  const answers = {
    budget: [15000, 35000], bodyStyles: ['hatchback'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'fun', people: 'solo', mileage: 8000, style: '5', priorities: ['performance', 'image'],
  };
  const bmwScore = rankCars(answers, [jcw], brandTuning('bmw'))[0].score;
  const miniScore = rankCars(answers, [jcw], brandTuning('mini'))[0].score;
  assert.ok(miniScore > bmwScore, `MINI tuning should lift a JCW (${miniScore} vs ${bmwScore})`);
  assert.ok(miniScore >= 80, `a well-matched sporty MINI should reach a high score, got ${miniScore}`);
});

test('brand tuning: MINI hard-filters do not exclude a Countryman for a family', () => {
  const countryman = {
    ...miniHatch, id: 'cm', name: 'MINI Countryman', body: 'suv', sizeClass: 2, seats: 5, boot: 460, zeroTo62: 8.3,
  };
  const familyAnswers = {
    budget: [15000, 40000], bodyStyles: ['suv'], fuel: ['open'], charging: 'none',
    primaryUse: 'family', people: 'family', mileage: 10000, style: '3', priorities: ['comfort'],
  };
  const survivors = rankCars(familyAnswers, [countryman], brandTuning('mini'));
  assert.equal(survivors.length, 1, 'the Countryman survives the MINI family filter');
});

test('body binding applies to BMW too, but still yields when no right shape fits', () => {
  // BMW honoured a named shape in only 53% of top-3s until body moved to
  // 4.5 / miss 0 (see BMW_TUNING). A right-shape car that fits the brief must
  // beat a wrong-shape one that's stronger everywhere else...
  const estate = {
    id: 'touring', name: 'BMW 320d Touring', line: '3 Series', body: 'estate', fuel: 'diesel',
    priceMin: 34000, priceMax: 34000, sizeClass: 2, seats: 5, boot: 500, zeroTo62: 7.4,
    mpg: 55, tags: ['practical', 'family'], blurb: '',
  };
  const suv = {
    id: 'x5', name: 'BMW X5 xDrive40d', line: 'X5', body: 'suv', fuel: 'diesel',
    priceMin: 34000, priceMax: 34000, sizeClass: 4, seats: 5, boot: 500, zeroTo62: 6.5,
    mpg: 48, tags: ['practical', 'family', 'cruiser', 'image'], blurb: '',
  };
  const wantsEstate = {
    budget: [30000, 45000], bodyStyles: ['estate'], fuel: ['diesel'], charging: 'none',
    primaryUse: 'family', people: 'family', mileage: 15000, style: '3',
    priorities: ['comfort', 'image'],
  };
  const ranked = rankCars(wantsEstate, [suv, estate], brandTuning('bmw'));
  assert.equal(ranked[0].car.id, 'touring', 'the estate the buyer asked for tops, not the plusher SUV');
  // ...but the binding is a weighting, not a filter: with no estate in stock
  // the SUV is still offered as the closest available fit.
  assert.equal(rankCars(wantsEstate, [suv], brandTuning('bmw')).length, 1,
    'a wrong-shape car is never filtered out, only out-ranked');
});

test('body binding: a wrong-shape car cannot top the list when a right-shape one exists', () => {
  // Regression: a JCW EV crossover was topping "hatchback" searches because
  // body was only lightly weighted. A wrong-shape car (however strong on fuel/
  // performance/character) must rank below a right-shape car that also fits.
  const jcwEvSuv = {
    ...miniHatch, id: 'aceman', name: 'MINI JCW Aceman', body: 'suv', fuel: 'ev',
    sizeClass: 2, seats: 5, boot: 300, zeroTo62: 6.4, evRange: 250,
    tags: ['urban', 'drivers-car', 'image', 'tech', 'efficient'],
  };
  const plainHatchEv = {
    ...miniHatch, id: 'hatchev', name: 'MINI Hatch Electric', body: 'hatchback', fuel: 'ev',
    zeroTo62: 7.3, evRange: 200, tags: ['urban', 'tech', 'efficient'],
  };
  const wantsHatchEv = {
    budget: [15000, 35000], bodyStyles: ['hatchback'], fuel: ['ev'], charging: 'home',
    primaryUse: 'city', people: 'solo', mileage: 8000, style: '5',
    priorities: ['performance', 'image'],
  };
  const ranked = rankCars(wantsHatchEv, [jcwEvSuv, plainHatchEv], brandTuning('mini'));
  assert.equal(ranked[0].car.id, 'hatchev', 'the right-shape hatchback tops, not the SUV');
  assert.ok(
    ranked.find((m) => m.car.id === 'hatchev').score > ranked.find((m) => m.car.id === 'aceman').score,
    'right-shape scores strictly higher than the stronger-elsewhere wrong shape',
  );
});

/* ---- mileage now moves the ranking for all fuels ---- */

test('annual mileage changes the ranking (efficient cars rise at high mileage)', () => {
  const thirstyPetrol = {
    ...miniHatch, id: 'p', name: 'MINI JCW', fuel: 'petrol', mpg: 34, zeroTo62: 6.1, tags: ['urban', 'drivers-car', 'image'],
  };
  const ev = {
    ...miniHatch, id: 'e', name: 'MINI Electric', fuel: 'ev', mpg: 0, evRange: 200, tags: ['urban', 'tech', 'efficient'],
  };
  const base = {
    budget: [15000, 40000], bodyStyles: ['hatchback'], fuel: ['open'], charging: 'home',
    primaryUse: 'commute', people: 'solo', style: '3', priorities: ['economy'],
  };
  const low = rankCars({ ...base, mileage: 3000 }, [thirstyPetrol, ev], brandTuning('mini'));
  const high = rankCars({ ...base, mileage: 24000 }, [thirstyPetrol, ev], brandTuning('mini'));
  const evLow = low.find((m) => m.car.id === 'e').score;
  const evHigh = high.find((m) => m.car.id === 'e').score;
  const petrolLow = low.find((m) => m.car.id === 'p').score;
  const petrolHigh = high.find((m) => m.car.id === 'p').score;
  // The EV should gain (or the petrol lose) ground as mileage climbs — i.e. the
  // EV-minus-petrol gap widens in the EV's favour. (Old engine: no change.)
  assert.ok((evHigh - petrolHigh) > (evLow - petrolLow),
    `high mileage should favour the EV more (low gap ${evLow - petrolLow}, high gap ${evHigh - petrolHigh})`);
});

/* ---- bespoke per-brand question ---- */

test('MINI question surgery: drops mileage/style, adds doors + miniVibe; BMW keeps its full set', () => {
  const mini = questionsForBrand('mini');
  const ids = mini.map((q) => q.id);
  // Dropped for MINI (dead against its range), kept for BMW.
  assert.ok(!ids.includes('mileage'), 'MINI drops mileage');
  assert.ok(!ids.includes('style'), 'MINI drops style (folded into miniVibe)');
  const bmwIds = questionsForBrand('bmw').map((q) => q.id);
  assert.ok(bmwIds.includes('mileage') && bmwIds.includes('style'), 'BMW keeps both');
  // Added for MINI: doors right after bodyStyles, miniVibe after people.
  assert.equal(ids.indexOf('doors'), ids.indexOf('bodyStyles') + 1, 'doors follows bodyStyles');
  assert.equal(ids.indexOf('miniVibe'), ids.indexOf('people') + 1, 'miniVibe follows people');
  assert.ok(!bmwIds.includes('doors') && !bmwIds.includes('miniVibe'), 'BMW has neither');
  // scoresAs is engine-internal and must never cross to the client.
  for (const o of mini.find((q) => q.id === 'miniVibe').options) {
    assert.equal(o.scoresAs, undefined, 'miniVibe scoresAs stripped');
  }
});

test('miniVibe folds trim + style into the standard answer set without overriding explicit answers', () => {
  // "sport" carries the styleLine (for scoreStyleLine) AND supplies the style
  // value the dropped style question no longer collects — the fold that keeps
  // comfort-vs-sporty signal alive without its own screen.
  const folded = applyBespokeAnswers('mini', { priorities: ['image'], miniVibe: 'sport' });
  assert.equal(folded.styleLine, 'sport', 'sport sets the trim line');
  assert.equal(folded.style, '5', 'sport fills the sporty style');
  assert.ok(folded.priorities.includes('performance'), 'sport adds the performance priority');
  assert.ok(folded.priorities.includes('image'), 'existing priority preserved');
  // classic/exclusive map to their own trim + a calmer style.
  assert.equal(applyBespokeAnswers('mini', { miniVibe: 'classic' }).styleLine, 'classic');
  assert.equal(applyBespokeAnswers('mini', { miniVibe: 'exclusive' }).style, '3');
  // An explicit style still wins over the bespoke nudge (legacy shared links).
  const explicit = applyBespokeAnswers('mini', { style: '1', miniVibe: 'sport' });
  assert.equal(explicit.style, '1', 'explicit style is not overridden');
  // The doors answer passes straight through (no scoresAs) for scoreDoors.
  assert.equal(applyBespokeAnswers('mini', { doors: '3' }).doors, '3');
  // BMW has no bespoke questions → answers pass through untouched.
  assert.deepEqual(applyBespokeAnswers('bmw', { style: '3' }), { style: '3' });
});

/* ---- BMW spec-gap fill + fuel/crew binding (from the used-stock eval) ---- */

test('BMW spec gaps: I Series / Z3 / Z8 / Alpina map to real lines, not defaults', () => {
  const line = (title, derivative) => mapVehicle(
    { title, derivative, cash_price: { value: 40000 }, retailer_site: { id: 1 } },
    'bmw',
  );
  // "I Series" generic title → real i-line from the derivative (was the bug).
  assert.equal(line('BMW I Series', 'iX xDrive50 M Sport Edition').line, 'iX');
  assert.equal(line('BMW I Series', 'iX xDrive50 M Sport Edition').body, 'suv');
  // Z3/Z8 "… Series" titles fold to the bare spec keys, seats 2, convertible.
  assert.equal(line('BMW Z3 Series', 'Z3 2.8i Roadster').seats, 2);
  assert.equal(line('BMW Z8 Series', 'Z8 Roadster').body, 'convertible');
  // Alpina normalises (incl. the "Unspecified Models" catch-all via derivative).
  assert.equal(line('BMW Alpina Unspecified Models', 'ALPINA D3 2.0D TOURING').line, 'Alpina D3');
  assert.equal(line('BMW Alpina XB7', 'ALPINA XB7').body, 'suv');
  // A filled line no longer uses the default 0-62 (8.0); i8 is a 4.4s coupe.
  assert.equal(line('BMW i8', 'i8 Coupe').zeroTo62, 4.4);
});

test('fuel binds hard when a specific fuel is chosen (wrong-fuel car cannot top)', () => {
  const petrolSaloon = {
    id: 'p', name: 'BMW 520i', line: '5 Series', body: 'saloon', fuel: 'petrol',
    priceMin: 45000, priceMax: 45000, sizeClass: 3, seats: 5, boot: 520, zeroTo62: 7.5,
    mpg: 45, tags: ['cruiser'], blurb: '',
  };
  const evFlagship = {
    id: 'e', name: 'BMW i7 M70', line: 'i7', body: 'saloon', fuel: 'ev',
    priceMin: 45000, priceMax: 45000, sizeClass: 5, seats: 5, boot: 500, zeroTo62: 3.9,
    evRange: 350, tags: ['tech', 'cruiser', 'efficient'], blurb: '',
  };
  const wantsPetrol = {
    budget: [40000, 120000], bodyStyles: ['saloon'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'roadtrips', people: 'solo', mileage: 8000, style: '1',
    priorities: ['comfort', 'tech'],
  };
  const ranked = rankCars(wantsPetrol, [petrolSaloon, evFlagship], brandTuning('bmw'));
  assert.equal(ranked[0].car.id, 'p', 'petrol saloon tops for a petrol buyer, not the EV');
  // "help me decide" leaves fuel unbound → the strong EV can win again.
  const openMinded = rankCars({ ...wantsPetrol, fuel: ['open'], charging: 'home' }, [petrolSaloon, evFlagship], brandTuning('bmw'));
  assert.equal(openMinded[0].car.id, 'e', 'open-minded buyer with home charging can top the EV');
});

test('crew buyer: a 7-seater tops when one exists, but 5-seaters still rank (stock-safe)', () => {
  const sevenSeat = {
    id: 'x7', name: 'BMW X7', line: 'X7', body: 'suv', fuel: 'diesel',
    priceMin: 55000, priceMax: 55000, sizeClass: 5, seats: 7, boot: 750, zeroTo62: 5.9,
    mpg: 40, tags: ['family', 'practical', 'cruiser'], blurb: '',
  };
  const fiveSeat = {
    id: 'x1', name: 'BMW X1', line: 'X1', body: 'suv', fuel: 'diesel',
    priceMin: 35000, priceMax: 35000, sizeClass: 2, seats: 5, boot: 540, zeroTo62: 8.3,
    mpg: 55, tags: ['family', 'practical', 'urban'], blurb: '',
  };
  const crew = {
    budget: [30000, 60000], bodyStyles: ['suv'], fuel: ['diesel'], charging: 'none',
    primaryUse: 'family', people: 'crew', mileage: 15000, style: '3',
    priorities: ['comfort', 'economy'],
  };
  const both = rankCars(crew, [sevenSeat, fiveSeat], brandTuning('bmw'));
  assert.equal(both[0].car.id, 'x7', 'the 7-seater tops a crew search');
  // With no 7-seater in stock the 5-seater still appears (not filtered out).
  const only5 = rankCars(crew, [fiveSeat], brandTuning('bmw'));
  assert.equal(only5.length, 1, 'a 5-seater is not hard-excluded from a crew search');
});

/* ---- MINI-first: styleLine + doors parsing and scoring ---- */

test('mapVehicle parses MINI styleLine + doors from the derivative; BMW leaves them null', () => {
  const map = (derivative, title = 'MINI Hatch') => mapVehicle(
    { advert_id: 1, title, derivative, fuel: 'Petrol', cash_price: { value: 22000 }, retailer_site: { id: 92 } },
    'mini',
  );
  // Style LINE (Classic/Exclusive/Sport/JCW) is distinct from the perf TIER
  // (Cooper C / Cooper S): ~47% of stock uses the older "Cooper S 3 Door"
  // naming that states only the tier, no style word → styleLine null (neutral,
  // never penalised). Doors still parse from either naming.
  assert.deepEqual(
    [map('Cooper S 3 Door').styleLine, map('Cooper S 3 Door').doors], [null, 3],
    'Cooper S 3 Door states a tier, not a style line → styleLine null, 3 doors',
  );
  assert.deepEqual(
    [map('3-Door Hatch Cooper S Sport').styleLine, map('3-Door Hatch Cooper S Sport').doors], ['sport', 3],
    'the newer naming carries the Sport style word',
  );
  assert.deepEqual(
    [map('5-Door Hatch Cooper Exclusive').styleLine, map('5-Door Hatch Cooper Exclusive').doors], ['exclusive', 5],
  );
  assert.equal(map('3-Door Hatch Cooper Classic').styleLine, 'classic');
  assert.equal(map('Hatch John Cooper Works').styleLine, 'jcw', 'JCW is its own trim');
  // Non-hatch bodies never carry a door count; edition names name no style line.
  assert.equal(map('Countryman C', 'MINI Countryman').doors, null, 'SUV has no door question');
  assert.equal(map('Cooper Untamed Edition').styleLine, null, 'unknown edition → null, not a guess');
  // BMW never sets either — the fields exist but stay null.
  const bmw = mapVehicle({ advert_id: 2, title: 'BMW X3', derivative: 'X3 M40d M Sport', fuel: 'Diesel', cash_price: { value: 45000 }, retailer_site: { id: 96 } }, 'bmw');
  assert.deepEqual([bmw.styleLine, bmw.doors], [null, null], 'BMW styleLine/doors are null');
});

test('styleLine + doors move MINI ranking, and neither touches BMW', () => {
  const sportHatch = {
    id: 'sp', name: 'MINI Cooper S', line: 'Hatch', body: 'hatchback', fuel: 'petrol',
    priceMin: 24000, priceMax: 24000, sizeClass: 1, seats: 4, boot: 210, zeroTo62: 6.6,
    mpg: 44, tags: ['urban', 'drivers-car'], blurb: '', styleLine: 'sport', doors: 3,
  };
  const classicHatch = {
    id: 'cl', name: 'MINI Cooper Classic', line: 'Hatch', body: 'hatchback', fuel: 'petrol',
    priceMin: 24000, priceMax: 24000, sizeClass: 1, seats: 4, boot: 210, zeroTo62: 7.7,
    mpg: 49, tags: ['urban'], blurb: '', styleLine: 'classic', doors: 5,
  };
  const base = {
    budget: [15000, 30000], bodyStyles: ['hatchback'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'fun', people: 'solo', priorities: ['image'],
  };
  // A "classic" vibe should lift the classic-trim car over the otherwise-punchier
  // sport car (which the 0-62 curve would otherwise favour).
  const wantsClassic = applyBespokeAnswers('mini', { ...base, miniVibe: 'classic' });
  const rankedC = rankCars(wantsClassic, [sportHatch, classicHatch], brandTuning('mini'));
  assert.equal(rankedC[0].car.id, 'cl', 'classic vibe tops the Classic-trim car');
  assert.ok(rankedC[0].reasons.some((r) => /Classic trim/i.test(r)), 'and says why');
  // A 3-door preference reorders two otherwise-equal-trim hatches.
  const equalTrim = { ...classicHatch, id: 'cl5', styleLine: 'classic', doors: 5 };
  const equalTrim3 = { ...classicHatch, id: 'cl3', styleLine: 'classic', doors: 3 };
  const wants3 = applyBespokeAnswers('mini', { ...base, miniVibe: 'classic', doors: '3' });
  const rankedD = rankCars(wants3, [equalTrim, equalTrim3], brandTuning('mini'));
  assert.equal(rankedD[0].car.id, 'cl3', '3-door preference tops the 3-door car');

  // The same styleLine/doors answers must not change BMW output at all: build
  // two BMWs, rank with and without the MINI-only answers under BMW tuning.
  const bmwA = {
    id: 'a', name: 'BMW 320i', line: '3 Series', body: 'saloon', fuel: 'petrol',
    priceMin: 30000, priceMax: 30000, sizeClass: 2, seats: 5, boot: 480, zeroTo62: 7.4,
    mpg: 45, tags: ['cruiser'], blurb: '', styleLine: null, doors: null,
  };
  const bmwB = { ...bmwA, id: 'b', name: 'BMW 330i', zeroTo62: 5.8, tags: ['drivers-car'] };
  const bmwAnswers = {
    budget: [20000, 50000], bodyStyles: ['saloon'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'commute', people: 'solo', mileage: 10000, style: '3', priorities: ['comfort'],
  };
  const plain = rankCars(bmwAnswers, [bmwA, bmwB], brandTuning('bmw'));
  const withMiniAnswers = rankCars(
    { ...bmwAnswers, styleLine: 'sport', doors: '3' }, [bmwA, bmwB], brandTuning('bmw'),
  );
  assert.deepEqual(
    plain.map((m) => [m.car.id, m.score]), withMiniAnswers.map((m) => [m.car.id, m.score]),
    'styleLine/doors answers are inert for BMW — identical ids and scores',
  );
});

/* ---- equipment concepts: the granular facts refinement will need ---- */

/** A feed vehicle carrying the three option shapes the real feed mixes. */
const equipped = (...strings) => ({
  ...miniVehicle,
  features: {
    interior: { standard: strings.slice(0, 1), additional: [] },
    exterior: { standard: [], additional: strings.slice(1, 2) },
    additional: strings.slice(2).map((s) => ({ category: 'other', description: s })),
  },
});

test('mapVehicle parses equipment concepts from every feed shape', () => {
  const car = mapVehicle(equipped('Panoramic glass roof', 'Head-Up Display', 'Harman Kardon speakers'), 'mini');
  assert.deepEqual(car.features, ['headUpDisplay', 'panoRoof', 'premiumAudio'], 'sorted concept keys, all three nestings read');
  // A car with no options list is an absence of facts, not a car with nothing.
  assert.deepEqual(mapVehicle(miniVehicle, 'mini').features, []);
});

test('concepts match per string, so context can exclude a false positive', () => {
  // The blob-matching bug this replaced: a leather WHEEL read as leather seats,
  // and "heated steering wheel" + "sport seats" combined into heated seats.
  const car = mapVehicle(equipped('Sport leather steering wheel', 'Heated steering wheel', 'Sport seats'), 'mini');
  assert.ok(car.features.includes('leatherWheel') && car.features.includes('heatedWheel'));
  assert.ok(!car.features.includes('heatedSeats'), 'must not pair "heated steering" with a separate "seats" string');
  // A panoramic roof is not what someone picturing a small sunroof means.
  assert.deepEqual(mapVehicle(equipped('Panoramic sunroof'), 'mini').features, ['panoRoof']);
});

test('BMW names the parking pack its own way and still matches', () => {
  // "Parking Assistant" (59% of BMW stock) vs MINI/plain "Park Distance Control".
  assert.ok(mapVehicle(equipped('Parking Assistant'), 'bmw').features.includes('parkingSensors'));
  assert.ok(mapVehicle(equipped('Park Distance Control'), 'mini').features.includes('parkingSensors'));
});

test('transmission normalises to auto/manual, undefined when the feed is silent', () => {
  assert.equal(mapVehicle({ ...miniVehicle, transmission: 'Automatic' }, 'mini').transmission, 'auto');
  assert.equal(mapVehicle({ ...miniVehicle, transmission: 'Manual' }, 'mini').transmission, 'manual');
  assert.equal(mapVehicle(miniVehicle, 'mini').transmission, undefined);
});

test('contrast roof reads as styling, not as any string with a colour in it', () => {
  // MINI's one aesthetic fact: a contrast roof vs one painted body colour.
  assert.ok(mapVehicle(equipped('Roof in Black'), 'mini').features.includes('contrastRoof'));
  assert.ok(mapVehicle(equipped('Black Roof and Mirror Caps'), 'mini').features.includes('contrastRoof'));
  assert.ok(mapVehicle(equipped('Roof and Mirror Caps in Chili Red'), 'mini').features.includes('contrastRoof'));
  // Same roof, no contrast — the buyer who wants one hasn't got one here.
  assert.ok(!mapVehicle(equipped('Roof in Body Colour'), 'mini').features.includes('contrastRoof'));
  // Things that merely mention a roof or a colour are not a contrast roof.
  assert.ok(!mapVehicle(equipped('Roof Rails', 'Anthracite Roof Lining'), 'mini').features.includes('contrastRoof'));
  assert.ok(!mapVehicle(equipped('19" M Double-spoke Jet Black Alloy Wheels'), 'bmw').features.includes('contrastRoof'));
});

/* ================================================================== *
 * Honda — the first fixtures-source brand. Honda has no Auto Trader
 * feed shape; its stock is scraped into a flat record and projected by
 * mapHondaRaw (not BRAND_MAPPERS), then served as-is by the fixtures
 * source. These prove the projection is engine-valid and the config /
 * tuning resolve, so the brand can't silently rot behind the render test.
 * ================================================================== */

// The raw scrape shape mapHondaRaw consumes: flat, string-ish fields.
const hondaRaw = (overrides = {}) => ({
  id: 'HND-TEST-1',
  title: 'Honda Civic 1.5 VTEC Turbo Sport',
  price: 18995,
  fuel: 'Petrol',
  mileage: 14200,
  mpg: 47.1,
  reg: 'LX21 ABC',
  doors: 5,
  transmission: 'Manual',
  image: 'https://img/honda-civic.jpg',
  link: 'https://usedcars.honda.co.uk/vehicle/HND-TEST-1',
  ...overrides,
});

test('brand config: honda is a live-source brand with a Honda origin', () => {
  const cfg = brandConfig('honda');
  assert.equal(cfg.source, 'live-honda', 'honda fetches its listing live, degrading to fixtures');
  assert.match(cfg.origin, /honda\.co\.uk/);
  assert.equal(normalizeBrand('Honda'), 'honda');
  assert.equal(normalizeBrand('HONDA'), 'honda');
});

test('mapHondaRaw projects a flat scrape record into the engine car schema', () => {
  const car = mapHondaRaw(hondaRaw());
  for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    assert.ok(car[field] !== undefined, `mapped Honda missing ${field}`);
  }
  assert.equal(car.line, 'Civic');
  assert.equal(car.body, 'hatchback');
  assert.equal(car.fuel, 'petrol');
  assert.equal(car.priceMin, 18995);
  assert.equal(car.priceMax, 18995, 'a used car is a single price, not a range');
  assert.equal(car.transmission, 'manual');
  assert.equal(car.retailerName, 'Honda Approved Used');
  assert.match(car.name, /^Honda /, 'the display name leads with the marque');
  assert.match(car.link, /usedcars\.honda\.co\.uk/);
});

test('mapHondaRaw folds Honda hybrids onto the petrol axis, carries hybrid identity in tags', () => {
  // The engine fuel axis is petrol|diesel|phev|ev; Honda's self-charging
  // i-MMD/e:HEV is not plug-in, so it scores as petrol but must still read as
  // efficient so a mileage-conscious buyer is steered to it.
  const hybrid = mapHondaRaw(hondaRaw({ fuel: 'Petrol Hybrid', title: 'Honda Jazz 1.5 i-MMD Advance' }));
  assert.equal(hybrid.fuel, 'petrol', 'a self-charging hybrid is petrol on the engine axis');
  assert.ok(hybrid.tags.includes('efficient'), 'hybrid identity survives as the efficient tag');
  assert.match(hybrid.blurb, /hybrid/i, 'the blurb still tells the buyer it is a hybrid');
});

test('mapHondaRaw maps a real EV line to ev + evRange, an SUV line to suv', () => {
  const ev = mapHondaRaw(hondaRaw({ fuel: 'Electric', title: 'Honda e:Ny1 Advance' }));
  assert.equal(ev.fuel, 'ev');
  assert.ok(ev.evRange > 0, 'an EV needs a range for the engine economy axis');
  const suv = mapHondaRaw(hondaRaw({ title: 'Honda CR-V 2.0 i-MMD Hybrid EX', fuel: 'Petrol Hybrid' }));
  assert.equal(suv.body, 'suv');
  assert.match(suv.name, /Honda CR-V/, 'CR-V casing is preserved, not lower-cased');
});

test('mapHondaRaw returns null for a priceless record (nothing to rank)', () => {
  assert.equal(mapHondaRaw(hondaRaw({ price: 0 })), null);
  assert.equal(mapHondaRaw(hondaRaw({ price: undefined })), null);
});

test('every Honda fixture is engine-valid (real shipped stock, not a synthetic sample)', () => {
  const path = fileURLToPath(new URL('../../fixtures/honda-cars.json', import.meta.url));
  const cars = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(cars.length > 0, 'honda fixtures are not empty');
  for (const car of cars) {
    for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
      assert.ok(car[field] !== undefined, `${car.name || car.id} missing ${field}`);
    }
    assert.ok(car.priceMin <= car.priceMax, `${car.name} price range inverted`);
    if (car.fuel === 'ev') assert.ok(car.evRange > 0, `${car.name} (ev) needs evRange`);
    else assert.ok(car.mpg > 0, `${car.name} needs mpg`);
    assert.ok(!car.blurb.includes('—'), `${car.name} blurb has an em dash`);
    assert.ok(!car.name.includes('—'), `${car.name} name has an em dash`);
  }
});

test('honda tuning ranks a thrifty hatch a real family buyer would pick', () => {
  // Honda tuning leans economy + practicality. A frugal Jazz should out-rank a
  // thirstier, sportier car for a value-minded family, where BMW's image-leaning
  // curve would not separate them the same way.
  const jazz = {
    id: 'jazz', name: 'Honda Jazz', line: 'Jazz', body: 'hatchback', fuel: 'petrol',
    priceMin: 17000, priceMax: 17000, sizeClass: 1, seats: 5, boot: 304, zeroTo62: 9.4,
    mpg: 62, tags: ['urban', 'efficient'], blurb: '',
  };
  const thirsty = {
    ...jazz, id: 'thirsty', name: 'Thirsty Hatch', mpg: 34, zeroTo62: 7.0,
    tags: ['urban', 'drivers-car'],
  };
  const valueFamily = {
    budget: [12000, 22000], bodyStyles: ['hatchback'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'commute', people: 'couple', mileage: 18000, style: '3',
    priorities: ['economy'],
  };
  const ranked = rankCars(valueFamily, [thirsty, jazz], brandTuning('honda'));
  assert.equal(ranked[0].car.id, 'jazz', 'the economical Honda tops for a value buyer under Honda tuning');
});

/* ------------------------------------------------------------------ *
 * Honda live listing adapter (honda-listing.js). Honda runs genuinely
 * live now: stock.js fetches usedcars.honda.co.uk and parses the
 * server-rendered cards with these functions, degrading to the fixtures
 * snapshot on any failure. The parser is the fragile seam (it reads real
 * HTML), so it's pinned here against a card in the site's real shape, and
 * the parseCard -> mapHondaRaw handoff is proven so the live path and the
 * snapshot path stay contract-compatible.
 * ------------------------------------------------------------------ */

// One vehicle card in the shape the real listing renders: a "vehicle-inner"
// wrapper, a Honda detail link + title attr, a monthly then a cash £, a spec
// <li> list (label tag then value tag), a reg data-attr and a /picserver image.
const hondaCardHtml = `
<div class="vehicle-inner">
  <a href="/en/used-cars/approved-cars/honda/civic/1-0-vtec-turbo-se-500243" title="Honda Civic 1.0 VTEC Turbo SE 5dr">
    <img src="/picserver1/userdata/46/500243/Y.jpg" alt="Honda Civic">
  </a>
  <span class="monthly">&pound;189</span>
  <span class="price">&pound;8,799</span>
  <ul>
    <li><span>Mileage</span><span>72,500&nbsp;miles</span></li>
    <li><span>Fuel Type</span><span>Petrol</span></li>
    <li><span>Transmission</span><span>Manual</span></li>
    <li><span>Doors</span><span>5</span></li>
    <li><span>mpg combined</span><span>47.1</span></li>
    <li><span>Exterior colour</span><span>Crystal Black</span></li>
    <li><span>First registration date</span><span>01/03/2021</span></li>
  </ul>
  <div data-modix-360-reg="LX21ABC"></div>
</div>`;

test('parseCard reads one real-shape Honda listing card into the flat raw record', () => {
  const raw = parseCard(hondaCardHtml.split('class="vehicle-inner"')[1]);
  assert.ok(raw, 'a real vehicle card parses');
  assert.match(raw.title, /^Honda Civic 1\.0 VTEC Turbo SE/);
  assert.equal(raw.price, 8799, 'the cash price wins over the smaller monthly figure');
  assert.equal(raw.mileage, 72500);
  assert.equal(raw.fuel, 'Petrol');
  assert.equal(raw.transmission, 'Manual');
  assert.equal(raw.doors, 5);
  assert.equal(raw.colour, 'Crystal Black');
  assert.equal(raw.year, 2021, 'the year comes from the first-registration date');
  assert.match(raw.link, /^https:\/\/usedcars\.honda\.co\.uk\/en\/used-cars\//, 'link is absolute');
  assert.match(raw.image, /^https:\/\/usedcars\.honda\.co\.uk\/picserver/, 'image is absolute');
});

test('parseListingHtml keeps real vehicle cards and drops chrome', () => {
  // A page is real cards plus a trailing chunk with no Honda link/title.
  const page = `<html><body>${hondaCardHtml}
    <div class="vehicle-inner"><div class="pager">Next page</div></div>
  </body></html>`;
  const raw = parseListingHtml(page);
  assert.equal(raw.length, 1, 'the pager chunk is not a vehicle and is dropped');
  assert.equal(raw[0].price, 8799);
});

test('a parsed Honda card feeds mapHondaRaw into an engine-valid car (live == snapshot contract)', () => {
  // This is the seam that matters: whatever the live parse produces must satisfy
  // the same projection the committed snapshot went through, or the live deck and
  // the fixtures deck would disagree in shape.
  const [raw] = parseListingHtml(hondaCardHtml);
  const car = mapHondaRaw(raw);
  assert.ok(car, 'a live-parsed card maps to a car');
  for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    assert.ok(car[field] !== undefined, `live-mapped Honda missing ${field}`);
  }
  assert.equal(car.line, 'Civic');
  assert.equal(car.body, 'hatchback');
  assert.equal(car.fuel, 'petrol');
  assert.equal(car.priceMin, 8799);
  assert.equal(car.priceMax, 8799);
  assert.match(car.photo, /picserver/, 'the live photo survives into the car');
  assert.ok(!car.blurb.includes('—'), 'no em dash in a live-derived blurb');
});

test('listingUrl carries the approved-used programme and the location facet, page as a path', () => {
  const p1 = listingUrl(1);
  assert.match(p1, /warrantyProgram=22/, 'page 1 keeps the approved-used filter');
  assert.ok(!/\/page/.test(p1), 'page 1 is the bare base, no /pageN');

  const p2 = listingUrl(2);
  assert.match(p2, /\/page2\?/, 'later pages are a /pageN path segment, not a query param');

  const near = listingUrl(1, { zip: 'PH1 3GA', radius: 25 });
  assert.match(near, /zip=PH1\+3GA/, 'the postcode is the location facet (zip)');
  assert.match(near, /radius=25/, 'radius is in miles');
  assert.match(near, /warrantyProgram=22/, 'the location facet does not drop the programme filter');
});

/* ================================================================== *
 * Ford — the second fixtures-source brand, and the broadest range we
 * carry. Its live feed is Akamai-blocked here, so fixtures are curated
 * and projected by mapFordRaw (a flat-raw → mapped-car projection, the
 * same shape the live adapter will feed). Ford's mapper is richer than
 * Honda's: a real performance halo (ST/GT speed-up), a genuine EV+PHEV
 * split, and body derivation across estate/convertible/pickup/mpv. These
 * prove all of that, plus the same engine-validity guard the render test
 * relies on. See the Ford section of DECISIONS.md.
 * ================================================================== */

// The flat-raw shape mapFordRaw consumes (curated fixtures, or the live adapter).
const fordRaw = (overrides = {}) => ({
  id: 'FRD-TEST-1',
  title: 'Ford Focus',
  derivative: '1.0 EcoBoost mHEV 125 Titanium 5dr',
  fuel: 'Petrol',
  price: 16500,
  mileage: 18400,
  reg: '72 FRD',
  colour: 'Frozen White',
  ...overrides,
});

test('brand config: ford is a fixtures-source brand with a Ford origin', () => {
  const cfg = brandConfig('ford');
  assert.equal(cfg.source, 'fixtures', 'ford serves from fixtures, not the live feed');
  assert.match(cfg.origin, /ford\.co\.uk/);
  assert.equal(normalizeBrand('Ford'), 'ford');
  assert.equal(normalizeBrand('FORD'), 'ford');
});

test('mapFordRaw projects a flat record into the engine car schema', () => {
  const car = mapFordRaw(fordRaw());
  for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    assert.ok(car[field] !== undefined, `mapped Ford missing ${field}`);
  }
  assert.equal(car.line, 'Focus');
  assert.equal(car.body, 'hatchback');
  assert.equal(car.fuel, 'petrol');
  assert.equal(car.priceMin, 16500);
  assert.equal(car.priceMax, 16500, 'a used car is a single price, not a range');
  assert.ok(car.mpg > 0, 'a combustion Ford is scored on mpg');
  assert.equal(car.retailerName, 'Ford Approved Used');
  assert.match(car.name, /^Ford Focus /, 'the display name leads with marque + line');
  assert.match(car.name, /Titanium/, 'the derivative is carried so trims are distinguishable');
});

test('mapFordRaw fires the ST/GT performance halo, but not on ST-Line', () => {
  // ST-Line is a styling pack, not the hot car; only ST/GT get the 0-62 speed-up.
  const base = mapFordRaw(fordRaw());
  const stLine = mapFordRaw(fordRaw({ derivative: '1.0 EcoBoost mHEV 155 ST-Line 5dr' }));
  assert.equal(stLine.zeroTo62, base.zeroTo62, 'ST-Line is NOT sped up (it is a look, not the hot car)');
  assert.ok(!stLine.tags.includes('drivers-car'), 'ST-Line is not a performance flag');

  const focusST = mapFordRaw(fordRaw({ derivative: '2.3 EcoBoost ST 5dr' }));
  assert.ok(focusST.zeroTo62 < base.zeroTo62, 'the real Focus ST is quicker than the mainstream trim');
  assert.ok(focusST.zeroTo62 <= 6.0, 'Focus ST 0-62 is a hot-hatch figure (~5.7s)');
  assert.ok(focusST.tags.includes('drivers-car'), 'the ST reads as a performance car');

  const machEgt = mapFordRaw(fordRaw({ title: 'Ford Mustang Mach-E', derivative: 'GT AWD 5dr Auto', fuel: 'Electric', price: 38000 }));
  assert.ok(machEgt.zeroTo62 < 5, 'the Mach-E GT is properly fast');
  assert.equal(machEgt.fuel, 'ev');
});

test('mapFordRaw splits EV, PHEV and petrol correctly', () => {
  const ev = mapFordRaw(fordRaw({ title: 'Ford Explorer', derivative: 'Extended Range RWD Premium 5dr Auto', fuel: 'Electric', price: 38000 }));
  assert.equal(ev.fuel, 'ev');
  assert.ok(ev.evRange > 0, 'an EV needs a range for the economy axis');
  assert.ok(!ev.mpg, 'an EV carries no usable mpg (scored on range instead)');

  // Kuga PHEV: a real plug-in, NOT folded to petrol (unlike Honda's self-charging
  // hybrids). It carries both a plug-in range and an mpg.
  const phev = mapFordRaw(fordRaw({ title: 'Ford Kuga', derivative: '2.5 PHEV ST-Line X 5dr Auto', fuel: 'Plug-in Hybrid', price: 24000 }));
  assert.equal(phev.fuel, 'phev', 'a plug-in hybrid keeps its own fuel category');
  assert.ok(phev.evRange > 0, 'the PHEV carries an electric-only range');
  assert.ok(phev.mpg > 0, 'the PHEV also carries a combustion mpg');

  // Mild-hybrid EcoBoost is petrol, not phev/ev.
  const mhev = mapFordRaw(fordRaw({ derivative: '1.0 EcoBoost mHEV ST-Line 5dr' }));
  assert.equal(mhev.fuel, 'petrol', 'mild-hybrid EcoBoost scores as petrol');
});

test('mapFordRaw derives body from line + derivative (estate, convertible, pickup, mpv)', () => {
  const estate = mapFordRaw(fordRaw({ derivative: '1.0 EcoBoost mHEV 155 Titanium Estate 5dr' }));
  assert.equal(estate.body, 'estate');
  assert.ok(estate.boot >= 550, 'the estate carries more boot than the hatch');

  const convertible = mapFordRaw(fordRaw({ title: 'Ford Mustang', derivative: '5.0 V8 GT Convertible 2dr Auto', price: 40000 }));
  assert.equal(convertible.body, 'convertible');

  const coupe = mapFordRaw(fordRaw({ title: 'Ford Mustang', derivative: '5.0 V8 GT 2dr Auto', price: 40000 }));
  assert.equal(coupe.body, 'coupe');
  assert.equal(coupe.seats, 4, 'the Mustang is a 4-seat coupe');

  const pickup = mapFordRaw(fordRaw({ title: 'Ford Ranger', derivative: '2.0 EcoBlue Wildtrak Double Cab Auto', fuel: 'Diesel', price: 30000 }));
  assert.equal(pickup.body, 'pickup');

  const mpv = mapFordRaw(fordRaw({ title: 'Ford Galaxy', derivative: '2.0 EcoBlue 150 Titanium 5dr', fuel: 'Diesel', price: 19000 }));
  assert.equal(mpv.body, 'mpv');
  assert.equal(mpv.seats, 7, 'the Galaxy is a 7-seat MPV');
});

test('mapFordRaw returns null for a priceless record (nothing to rank)', () => {
  assert.equal(mapFordRaw(fordRaw({ price: 0 })), null);
  assert.equal(mapFordRaw(fordRaw({ price: undefined })), null);
});

test('every Ford fixture is engine-valid (the curated stock the app serves)', () => {
  const path = fileURLToPath(new URL('../../fixtures/ford-cars.json', import.meta.url));
  const cars = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(cars.length > 0, 'ford fixtures are not empty');
  for (const car of cars) {
    for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
      assert.ok(car[field] !== undefined, `${car.name || car.id} missing ${field}`);
    }
    assert.ok(car.priceMin <= car.priceMax, `${car.name} price range inverted`);
    if (car.fuel === 'ev') assert.ok(car.evRange > 0, `${car.name} (ev) needs evRange`);
    else assert.ok(car.mpg > 0, `${car.name} needs mpg`);
    assert.ok(!car.blurb.includes('—'), `${car.name} blurb has an em dash`);
    assert.ok(!car.name.includes('—'), `${car.name} name has an em dash`);
  }
});

test('ford tuning ranks a practical family SUV a real Ford buyer would pick', () => {
  // Ford tuning leans practicality + economy + body fit, lighter on image than
  // BMW. For a family needing space, a roomy Kuga should out-rank a sporty but
  // impractical Mustang under Ford tuning.
  const kuga = {
    id: 'kuga', name: 'Ford Kuga', line: 'Kuga', body: 'suv', fuel: 'petrol',
    priceMin: 20000, priceMax: 20000, sizeClass: 4, seats: 5, boot: 475, zeroTo62: 9.5,
    mpg: 45, tags: ['family', 'practical'], blurb: '',
  };
  const mustang = {
    id: 'mustang', name: 'Ford Mustang', line: 'Mustang', body: 'coupe', fuel: 'petrol',
    priceMin: 20000, priceMax: 20000, sizeClass: 5, seats: 4, boot: 408, zeroTo62: 5.3,
    mpg: 28, tags: ['image', 'drivers-car'], blurb: '',
  };
  const family = {
    budget: [15000, 25000], bodyStyles: ['suv'], fuel: ['petrol'], charging: 'none',
    primaryUse: 'family', people: 'family', mileage: 15000, style: '3',
    priorities: ['practicality'],
  };
  const ranked = rankCars(family, [mustang, kuga], brandTuning('ford'));
  assert.equal(ranked[0].car.id, 'kuga', 'the practical Ford SUV tops for a family under Ford tuning');
});

/* ==================================================================
 * Motorrad — the first NON-CAR brand: BMW's used-bike range on the
 * same engine. It proves the engine is vehicle-agnostic, not just
 * multi-marque. The mapped shape is the identical engine schema, but
 * every field carries a bike meaning: `body` is the riding category
 * (adventure/tourer/sport/naked/roadster/heritage/scooter), `boot` is
 * luggage litres, `seats` is pillion capability, `sizeClass` is a
 * licence-and-manageability band, and only the CE 04 is electric. The
 * live feed is a session-gated SPA (unreachable here), so fixtures are
 * curated and projected by mapMotorradRaw. See the Motorrad section of
 * DECISIONS.md for the full field-by-field axis map and the tuning
 * recalibration (bike 0-62 curve, luggage bootNeed, seat floors).
 * ================================================================== */

// The flat-raw shape mapMotorradRaw consumes (curated fixtures, or the live
// adapter): a listing title, a ride-away price, mileage and a plate.
const motorradRaw = (overrides = {}) => ({
  id: 'MOT-TEST-1',
  title: 'BMW R 1250 GS',
  price: 13500,
  mileage: 9200,
  reg: 'MOT 1',
  ...overrides,
});

test('brand config: motorrad is a fixtures-source brand serving a bikes file', () => {
  const cfg = brandConfig('motorrad');
  assert.equal(cfg.source, 'fixtures', 'motorrad serves from fixtures, not the live feed');
  assert.equal(cfg.fixturesFile, 'motorrad-bikes.json', 'motorrad reads the bikes file, not <brand>-cars.json');
  assert.match(cfg.origin, /bmw-motorrad\.co\.uk/);
  assert.equal(normalizeBrand('Motorrad'), 'motorrad');
  assert.equal(normalizeBrand('MOTORRAD'), 'motorrad');
});

test('mapMotorradRaw projects a flat bike record into the engine schema', () => {
  const bike = mapMotorradRaw(motorradRaw());
  for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    assert.ok(bike[field] !== undefined, `mapped Motorrad missing ${field}`);
  }
  assert.equal(bike.line, 'R 1250 GS');
  assert.equal(bike.body, 'adventure', 'the GS is an adventure bike, and body carries the category');
  assert.equal(bike.fuel, 'petrol');
  assert.equal(bike.priceMin, 13500);
  assert.equal(bike.priceMax, 13500, 'a used bike is a single ride-away price, not a range');
  assert.ok(bike.mpg > 0, 'a combustion bike is scored on mpg');
  assert.equal(bike.seats, 2, 'the GS carries a pillion');
  assert.equal(bike.retailerName, 'BMW Motorrad Approved Used');
  assert.match(bike.name, /^BMW /, 'the display name leads with the marque');
  assert.equal(bike.cc, 1254, 'engine capacity is surfaced for the card');
  assert.match(bike.blurb, /ride away/, 'bikes ride away, they do not drive away');
});

test('mapMotorradRaw derives the category (body) from the model across the range', () => {
  const cases = [
    ['BMW R 1300 GS', 'adventure'],
    ['BMW R 1250 RT', 'tourer'],
    ['BMW S 1000 RR', 'sport'],
    ['BMW S 1000 R', 'naked'],
    ['BMW R 1250 R', 'roadster'],
    ['BMW R 18', 'heritage'],
    ['BMW CE 04', 'scooter'],
  ];
  for (const [title, category] of cases) {
    const bike = mapMotorradRaw(motorradRaw({ title }));
    assert.equal(bike.body, category, `${title} should map to the ${category} category`);
    assert.ok(bike.tags.includes(category), `${title} carries its category as a tag`);
  }
});

test('mapMotorradRaw makes only the CE 04 electric; everything else is petrol', () => {
  const ce04 = mapMotorradRaw(motorradRaw({ title: 'BMW CE 04', price: 11000 }));
  assert.equal(ce04.fuel, 'ev', 'the CE 04 is the one electric bike in the range');
  assert.ok(ce04.evRange > 0, 'an electric bike needs a range for the economy axis');
  assert.ok(!ce04.mpg, 'an EV carries no mpg (scored on range instead)');
  assert.equal(ce04.body, 'scooter');
  // The scooter blurb already says "electric"; it must not double it up.
  assert.ok(!/electric electric/i.test(ce04.blurb), 'the scooter blurb does not double "electric"');

  const gs = mapMotorradRaw(motorradRaw());
  assert.equal(gs.fuel, 'petrol');
  assert.ok(gs.mpg > 0);
  assert.equal(gs.evRange, undefined, 'a petrol bike carries no ev range');
});

test('mapMotorradRaw returns null for a priceless record (never invents a price)', () => {
  assert.equal(mapMotorradRaw(motorradRaw({ price: 0 })), null);
  assert.equal(mapMotorradRaw(motorradRaw({ price: undefined })), null);
});

test('every Motorrad fixture is engine-valid (the curated bikes the app serves)', () => {
  const path = fileURLToPath(new URL('../../fixtures/motorrad-bikes.json', import.meta.url));
  const bikes = JSON.parse(readFileSync(path, 'utf8'));
  assert.ok(bikes.length > 0, 'motorrad fixtures are not empty');
  for (const bike of bikes) {
    for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
      assert.ok(bike[field] !== undefined, `${bike.name || bike.id} missing ${field}`);
    }
    assert.ok(bike.priceMin <= bike.priceMax, `${bike.name} price range inverted`);
    if (bike.fuel === 'ev') assert.ok(bike.evRange > 0, `${bike.name} (ev) needs evRange`);
    else assert.ok(bike.mpg > 0, `${bike.name} needs mpg`);
    assert.ok(!bike.blurb.includes('—'), `${bike.name} blurb has an em dash`);
    assert.ok(!bike.name.includes('—'), `${bike.name} name has an em dash`);
  }
});

/* ---- Motorrad bespoke bike questions ---- */

test('questionsForBrand(motorrad) drops car-only questions and adds the bike ones', () => {
  const ids = questionsForBrand('motorrad').map((q) => q.id);
  // Car-only questions Motorrad drops (a bike has no charging plug question,
  // no "how many people", and comfort<->sporty is folded into ridingStyle).
  for (const dropped of ['charging', 'people', 'style']) {
    assert.ok(!ids.includes(dropped), `motorrad should drop the car-only "${dropped}" question`);
  }
  // Bike-native questions Motorrad adds.
  assert.ok(ids.includes('ridingStyle'), 'motorrad asks what kind of riding it is for');
  assert.ok(ids.includes('licence'), 'motorrad asks which licence you ride on');
  // The bespoke questions are spliced in after bodyStyles, in order.
  assert.ok(ids.indexOf('ridingStyle') > ids.indexOf('bodyStyles'), 'ridingStyle follows bodyStyles');
  assert.ok(ids.indexOf('licence') > ids.indexOf('ridingStyle'), 'licence follows ridingStyle');
});

test('applyBespokeAnswers(motorrad) folds ridingStyle into standard engine fields', () => {
  // "Adventure" must resolve to primaryUse:roadtrips (not fun) so the GS range's
  // big-frame + luggage strengths surface — see brands.js for the rationale.
  const adv = applyBespokeAnswers('motorrad', { ridingStyle: 'adventure' });
  assert.equal(adv.primaryUse, 'roadtrips', 'adventure riding folds to roadtrips so GS bikes surface');
  assert.equal(adv.style, '3');
  assert.deepEqual(adv.priorities, ['comfort']);

  const sport = applyBespokeAnswers('motorrad', { ridingStyle: 'sport' });
  assert.equal(sport.primaryUse, 'fun');
  assert.deepEqual(sport.priorities, ['performance']);

  // An explicit standard answer still wins over the bespoke nudge (a scalar only
  // fills a blank; it never overwrites what the rider set directly).
  const explicit = applyBespokeAnswers('motorrad', { primaryUse: 'city', ridingStyle: 'sport' });
  assert.equal(explicit.primaryUse, 'city', 'an explicit primaryUse is not overwritten by the bespoke fold');
});

test('motorrad tuning surfaces a go-anywhere GS for an adventure rider, over a sportbike', () => {
  // The riskiest product claim of the whole bike adaptation: an adventure rider
  // should be shown a GS, not an S 1000 RR. The GS wins on category fit + size +
  // luggage once "adventure" folds to roadtrips; the sportbike is quicker but
  // impractical for the stated use. This is the tuning end-to-end, through the
  // real bespoke fold and the real rankCars.
  const gs = {
    id: 'gs', name: 'BMW R 1250 GS', line: 'R 1250 GS', body: 'adventure', fuel: 'petrol',
    priceMin: 13500, priceMax: 13500, sizeClass: 5, seats: 2, boot: 68, zeroTo62: 3.4,
    mpg: 56, tags: ['adventure', 'touring'], blurb: '',
  };
  const rr = {
    id: 'rr', name: 'BMW S 1000 RR', line: 'S 1000 RR', body: 'sport', fuel: 'petrol',
    priceMin: 13500, priceMax: 13500, sizeClass: 4, seats: 1, boot: 0, zeroTo62: 2.9,
    mpg: 42, tags: ['sport', 'sporty'], blurb: '',
  };
  const rider = applyBespokeAnswers('motorrad', {
    budget: [8000, 18000], bodyStyles: ['adventure'], fuel: ['petrol'],
    ridingStyle: 'adventure', licence: 'a', mileage: 8000,
  });
  const ranked = rankCars(rider, [rr, gs], brandTuning('motorrad'));
  assert.equal(ranked[0].car.id, 'gs', 'the GS tops for an adventure rider under Motorrad tuning');
});

/* ---- Motorrad live-feed adapter (dormant until hosted, but guarded) ---- */

test('motorradRowsFromEnvelope reads both envelope shapes and null-safes the rest', () => {
  const rows = [{ id: 1 }, { id: 2 }];
  // The documented nested shape: SearchFilter.ResOverviewData.ResTable.Items.
  assert.deepEqual(
    motorradRowsFromEnvelope({ SearchFilter: { ResOverviewData: { ResTable: { Items: rows } } } }),
    rows,
    'reads the nested ResOverviewData.ResTable shape',
  );
  // The flatter capture some responses use: SearchFilter.ResTable.items.
  assert.deepEqual(
    motorradRowsFromEnvelope({ SearchFilter: { ResTable: { items: rows } } }),
    rows,
    'reads the flatter ResTable shape',
  );
  // The null envelope a session-less request gets back — no rows, no throw.
  assert.deepEqual(motorradRowsFromEnvelope({ SearchFilter: null, ResTable: null }), []);
  assert.deepEqual(motorradRowsFromEnvelope(null), [], 'a null body is empty, not a crash');
  assert.deepEqual(motorradRowsFromEnvelope({}), [], 'an unknown shape degrades to empty');
});

test('a live Motorrad row projects and maps to the same engine schema as a fixture', () => {
  // Prove the adapter feeds mapMotorradRaw the shape it expects: a live row, read
  // by motorradRowToRaw, then mapped, lands as a valid engine bike identical in
  // shape to a fixture. When the real field names arrive, only the row->raw step
  // changes; this test pins the contract between the two.
  const liveRow = {
    Id: 'LIVE-1', Title: 'BMW R 1250 GS', Price: 14250, Mileage: 6100,
    Registration: '23 BMW', FuelType: 'Petrol',
  };
  const raw = motorradRowToRaw(liveRow);
  assert.equal(raw.id, 'LIVE-1');
  assert.equal(raw.title, 'BMW R 1250 GS');
  assert.equal(raw.price, 14250);

  const bike = mapMotorradRaw(raw);
  for (const field of ['id', 'name', 'line', 'body', 'fuel', 'priceMin', 'priceMax', 'sizeClass', 'seats', 'boot', 'zeroTo62', 'tags', 'blurb']) {
    assert.ok(bike[field] !== undefined, `mapped live bike missing ${field}`);
  }
  assert.equal(bike.body, 'adventure');
  assert.equal(bike.priceMin, 14250);
});
