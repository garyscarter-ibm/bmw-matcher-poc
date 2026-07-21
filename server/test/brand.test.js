import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mapVehicle } from '../mapping.js';
import { questionsForBrand, applyBespokeAnswers } from '../questions.js';
import { normalizeBrand, brandConfig, brandTuning } from '../brands.js';
import { rankCars } from '../engine.js';

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
