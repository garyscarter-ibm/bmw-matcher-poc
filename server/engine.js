/*
 * Matching engine — pure, deterministic, dependency-free.
 *
 * Input:  answers object produced by the quiz (see questions.js) + a per-brand
 *         `tuning` object (see brands.js) holding every calibration constant.
 * Output: ranked matches with 0–100 scores and human-readable reasons
 *         generated from the actual score components.
 *
 * The engine is brand-agnostic: every magic number lives in `tuning`, so a
 * brand is calibrated by config, not by forking the scorers. `tuning` defaults
 * to BMW's values (the engine's original constants), so a caller that omits it
 * gets the original behaviour.
 */

import { BUDGET_BANDS } from './questions.js';
import { brandTuning } from './brands.js';

/** Default tuning = BMW's (the engine's original constants). */
const DEFAULT_TUNING = brandTuning('bmw');

/*
 * Base weight of each scoring dimension. The engine itself reads the weights
 * off the per-brand `tuning` argument (brands.js) — this export is the same
 * table under the name the README points tuners at, so keep the two in step.
 */
export const WEIGHTS = {
  budget: 3.0,
  body: 4.5,
  fuel: 2.5,
  practicality: 2.0,
  performance: 1.5,
  economy: 1.5,
  size: 1.0,
  character: 2.0,
};

/** How the user's two stated priorities reweight the engine. */
export const PRIORITY_BOOSTS = {
  economy: { economy: 1.5, budget: 0.5 },
  performance: { performance: 1.8, character: 0.5 },
  comfort: { character: 1.0, size: 0.5 },
  tech: { character: 1.0 },
  image: { character: 1.0 },
};

/** Stretch tolerance: cars up to this factor over budget survive, flagged. */
export const STRETCH_FACTOR = 1.15;

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const gbp = (n) => `£${Math.round(n / 1000)}k`;

/**
 * Resolve a budget answer to a [min, max] £ range. Budget is a dual-thumb range
 * from the quiz slider — a [min, max] pair — but we also accept a bare number
 * (→ [0, n], the earlier single-slider shape) and the legacy b1–b5 band keys, so
 * old shared #m= links (and existing callers/tests) keep working. Returns null
 * for anything unusable, which the caller turns into a 400.
 */
export function budgetRange(answers) {
  const b = answers.budget;
  if (Array.isArray(b) && b.length === 2) {
    const [lo, hi] = b.map(Number);
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > 0) {
      return [Math.max(0, Math.min(lo, hi)), Math.max(lo, hi)];
    }
    return null;
  }
  if (typeof b === 'number' && Number.isFinite(b) && b > 0) return [0, b];
  return BUDGET_BANDS[b] || null;
}

/**
 * Annual mileage as a 0..1 fraction along the brand's ramp: at/under lowMiles
 * → 0, at/over highMiles → 1. Drives how much running costs matter (see
 * scoreEconomy / effectiveWeights) — for EVERY fuel now, not just diesel. The
 * legacy string band 'vhigh' maps to 1; an unanswered mileage → 0 (no strong
 * running-cost signal yet).
 */
function mileageFraction(answers, tuning) {
  const { lowMiles, highMiles } = tuning.mileage;
  const m = answers.mileage;
  if (typeof m === 'number') return clamp((m - lowMiles) / (highMiles - lowMiles));
  // Legacy string bands (old shared links / tests).
  return { low: 0, mid: 0.35, high: 0.7, vhigh: 1 }[m] ?? 0;
}

/** Convenience: is this a high-mileage buyer? (top third of the ramp). */
function isHighMileage(answers, tuning) {
  return mileageFraction(answers, tuning) >= 0.66;
}

/** Normalise a fuel answer to an array of preference values (multi-select). */
function fuelPrefs(answers) {
  const f = answers.fuel;
  const picks = Array.isArray(f) ? f : (f != null ? [f] : []);
  return picks.length ? picks : ['open'];
}

/** Charging access good enough for an EV/PHEV to make sense. */
function canChargeAt(charging) {
  return charging === 'home' || charging === 'work' || charging === 'either';
}

/* ---------------------------------------------------------------- *
 *  Per-dimension scorers. Each returns { score: 0..1, reason? }.    *
 * ---------------------------------------------------------------- */

function scoreBudget(car, answers) {
  const [min, max] = budgetRange(answers);
  // A slider budget has min 0, so phrase the "in budget" reason as an upper
  // limit ("up to £62k") rather than a "£0k–£62k" band.
  const budgetReason = min > 0 ? `Sits right in your ${gbp(min)}–${gbp(max)} budget` : `Comfortably within your ${gbp(max)} budget`;
  if (car.priceMin > max) {
    // Survivor of the hard filter → it's a stretch buy.
    return { score: 0.35, stretch: true };
  }
  if (car.priceMax <= max && car.priceMax >= min) {
    return { score: 1, reason: budgetReason };
  }
  if (car.priceMax < min) {
    // Below the user's minimum. When there's no real floor (min 0, the old
    // "up to £X" slider) this is fine — just mildly off-target. But when the
    // user has deliberately set a min (a range), a car well under it is NOT
    // what they asked for, so penalise in proportion to how far below the floor
    // it sits: right at the floor ≈ 0.7, half the floor ≈ 0.35, far below → ~0.1.
    // Without this, a car £50k under a £92k floor still scored 0.7 and, since
    // budget is only ~1/5 of the blend, out-ranked in-budget cars on merit.
    if (!min) return { score: 0.7, reason: 'Comes in under budget' };
    const shortfall = (min - car.priceMax) / min; // 0 at the floor → 1 at £0
    const score = clamp(0.7 - shortfall, 0.1, 0.7);
    return { score };
  }
  return { score: 0.75 }; // straddles the band edge
}

function scoreBody(car, answers, tuning) {
  const b = tuning.body;
  const picks = answers.bodyStyles || [];
  if (picks.length === 0 || picks.includes('any')) return { score: b.neutral };
  if (picks.includes(car.body)) {
    const labels = {
      hatchback: 'hatchback', saloon: 'saloon', estate: 'estate', suv: 'SUV',
      coupe: 'coupé', convertible: 'convertible', mpv: 'family carrier',
    };
    return { score: b.match, reason: `The ${labels[car.body]} shape you asked for` };
  }
  return { score: b.miss };
}

const FUEL_LABELS = { petrol: 'petrol', diesel: 'diesel', phev: 'plug-in hybrid', ev: 'fully electric' };

const FUEL_TABLE = {
  petrol: { petrol: 1, diesel: 0.7, phev: 0.6, ev: 0.15 },
  diesel: { diesel: 1, petrol: 0.6, phev: 0.5, ev: 0.15 },
  phev: { phev: 1, ev: 0.55, petrol: 0.5, diesel: 0.4 },
  ev: { ev: 1, phev: 0.5, petrol: 0.1, diesel: 0.1 },
};

/** Score one car against a single fuel preference. Returns { score, reason? }. */
function scoreOneFuel(pref, car, answers, tuning) {
  const charging = answers.charging || 'none';
  const canCharge = canChargeAt(charging);
  // EVs and PHEVs make much less sense with no charging access. "either" and
  // "home" both imply home access — the best case.
  const evAccess = (charging === 'home' || charging === 'either') ? 1 : charging === 'work' ? 0.85 : 0.3;

  let score;
  if (pref === 'open') {
    // "Help me decide": recommend by circumstance.
    if (car.fuel === 'ev') score = canCharge ? 0.95 : 0.25;
    else if (car.fuel === 'phev') score = canCharge ? 0.85 : 0.6;
    else if (car.fuel === 'diesel') score = isHighMileage(answers, tuning) ? 0.9 : 0.55;
    else score = 0.7;
  } else {
    score = FUEL_TABLE[pref][car.fuel];
    if (car.fuel === 'ev') score *= evAccess;
    if (car.fuel === 'phev' && !canCharge) score *= 0.7;
  }

  let reason;
  if (score >= 0.85) {
    if (car.fuel === 'ev') {
      reason = canCharge
        ? `Fully electric with a ${car.evRange}-mile range, ideal with your charging setup`
        : `Fully electric with a ${car.evRange}-mile range`;
    } else if (pref !== 'open') {
      reason = `The ${FUEL_LABELS[car.fuel]} power you wanted`;
    } else if (car.fuel === 'diesel' && isHighMileage(answers, tuning)) {
      reason = 'Diesel torque and economy suit your big annual mileage';
    }
  }
  return { score, reason };
}

function scoreFuel(car, answers, tuning) {
  // Fuel is multi-select: the user can pick several fuels (or none, which reads
  // as "help me decide"). Score the car against each chosen fuel and take the
  // best — a petrol car matching "Petrol + EV" scores on its petrol merit. An
  // unanswered set falls back to ['open'] (fuelPrefs), so a partial answer set
  // still ranks instead of throwing on FUEL_TABLE[undefined].
  const prefs = fuelPrefs(answers);
  let best = { score: -1 };
  for (const pref of prefs) {
    const r = scoreOneFuel(pref, car, answers, tuning);
    if (r.score > best.score) best = r;
  }
  return best;
}

/*
 * How much luggage space this buyer needs, expressed as one of the per-brand
 * bootNeed keys (small/medium/big — see tuning.practicality.bootNeed).
 *
 * There is no "how much boot space?" question any more: it changed the top 3
 * in only 13% of BMW cases and ~25% of MINI's (docs/question-stock-audit.md),
 * because it asked for something the rest of the answers already imply. The
 * need is instead derived from the two answers that genuinely carry it, each
 * scored 0/1/2 and summed:
 *
 *   people      solo 0, family 1, crew 2 — people displace luggage, and a
 *               "full crew" is the one answer that asks for everything a car
 *               has (it already drives the seat/boot hard filters too).
 *   primaryUse  family duties and long motorway trips 1 (buggies, weekly
 *               shops, a week's luggage); city, commuting and weekend
 *               driving 0 — those are a bag and a coat.
 *
 * Summing rather than taking the larger is what preserves the discrimination
 * the question used to provide: a small family on the school run (1+1 → big)
 * genuinely needs more room than the same family commuting (1+0 → medium),
 * a distinction the old three-way question could only capture if the user
 * stopped to think about it. Unanswered ⇒ 0 ⇒ "small" ⇒ no space requirement,
 * so a partial answer set (the mid-quiz preview) still scores a real number.
 *
 * A legacy shared link may still carry a `boot` answer. It is deliberately
 * ignored, not honoured: every buyer's need is derived the same way, so two
 * people who answer identically get identical results.
 */
const PEOPLE_SPACE = { solo: 0, family: 1, crew: 2 };
const USE_SPACE = {
  city: 0, commute: 0, fun: 0, family: 1, roadtrips: 1,
};
const SPACE_KEYS = ['small', 'medium', 'big'];

function bootNeedKey(answers) {
  const level = (PEOPLE_SPACE[answers.people] ?? 0) + (USE_SPACE[answers.primaryUse] ?? 0);
  return SPACE_KEYS[Math.min(level, SPACE_KEYS.length - 1)];
}

function scorePracticality(car, answers, tuning) {
  const { bootNeed, seatsFloor, crewBonusSeats } = tuning.practicality;
  // Boot targets are per-brand (a MINI's "big" is smaller than a BMW's), so
  // the derived key is looked up in the brand's own table.
  const need = bootNeed[bootNeedKey(answers)] ?? 0;
  const seatsOk = answers.people === 'solo' || car.seats >= seatsFloor;
  let score = need === 0 ? 1 : clamp(car.boot / need);
  if (!seatsOk) score *= 0.3;
  // A crew buyer with the bonus seats gets a perfect practicality score; the
  // shortfall for a sub-7-seat crew car is applied as a whole-score penalty in
  // rankCars (crewSeatShortfall), not here — practicality alone is too small a
  // lever to overcome a 7-seater's budget/economy headwind.
  if (answers.people === 'crew' && car.seats >= crewBonusSeats) {
    return { score: 1, reason: `${car.seats} proper seats for the full crew` };
  }
  let reason;
  if (need > 0 && car.boot >= need) {
    reason = `${car.boot}-litre boot swallows the dogs, the tip runs, the lot`;
  } else if (need > 0 && car.boot >= need * 0.9) {
    reason = `Big ${car.boot}-litre boot for buggies and the weekly shop`;
  }
  return { score, reason };
}

function scorePerformance(car, answers, tuning) {
  const { zeroBase, span } = tuning.performance;
  // Per-brand 0-62 curve: a MINI is quick for its class but never fast in
  // absolute BMW terms, so its curve tops out at a slower time.
  const score = clamp((zeroBase - car.zeroTo62) / span);
  const wantsIt = Number(answers.style) >= 4 || (answers.priorities || []).includes('performance');
  let reason;
  if (score >= 0.85 && wantsIt) {
    reason = `0–62 in ${car.zeroTo62}s, as quick as you hoped`;
  }
  return { score, reason };
}

function scoreEconomy(car, answers, tuning) {
  const canCharge = canChargeAt(answers.charging);
  // How much running costs matter, 0..1 by annual mileage. High-mileage buyers
  // want genuinely cheap-per-mile cars; low-mileage buyers can indulge a
  // thirsty one. `miles` scales the reward for efficiency and the penalty for a
  // gas-guzzler, so mileage now moves the ranking for EVERY fuel.
  const miles = mileageFraction(answers, tuning);
  let score;
  let reason;
  if (car.fuel === 'ev') {
    // EVs are cheapest per mile — the higher the mileage, the more that wins.
    score = canCharge ? 1 : clamp(0.5 + 0.2 * miles);
    if (canCharge) {
      reason = miles >= 0.66
        ? 'Pennies per mile charging at home or work — ideal for your big annual mileage'
        : 'Pennies per mile charging at home or work';
    }
  } else if (car.fuel === 'phev') {
    score = canCharge ? clamp(0.85 + 0.1 * miles) : clamp(0.6 - 0.1 * miles);
    if (canCharge && car.evRange) reason = `Around ${car.evRange} electric miles covers most daily driving`;
  } else {
    // Petrol/diesel: base on mpg, then tilt by mileage — a frugal car is worth
    // more the further you drive, a thirsty one worth less.
    const base = clamp((car.mpg - 25) / 35);
    // At high mileage, pull the score toward its mpg merit harder (thirsty cars
    // sink, frugal cars rise); at low mileage, soften both extremes toward 0.7.
    score = clamp(base + (base - 0.5) * miles);
    if (score >= 0.8) {
      reason = miles >= 0.66
        ? `Frugal at around ${car.mpg}mpg — kind on a big annual mileage`
        : `Frugal for what it is, around ${car.mpg}mpg`;
    }
  }
  return { score, reason };
}

function scoreSize(car, answers, tuning) {
  const { roadtripMinClass, cityDivisor } = tuning.size;
  if (answers.primaryUse === 'city') {
    const score = (cityDivisor + 1 - car.sizeClass) / cityDivisor;
    return {
      score: clamp(score),
      reason: car.sizeClass <= 2 ? 'Compact enough for city streets and tight parking' : undefined,
    };
  }
  if (answers.primaryUse === 'roadtrips') {
    const big = car.sizeClass >= roadtripMinClass;
    return {
      score: big ? 1 : 0.6,
      reason: big ? 'Big-car refinement for long motorway days' : undefined,
    };
  }
  return { score: 0.7 };
}

const USE_TAGS = {
  fun: ['drivers-car'],
  family: ['family', 'practical'],
  commute: ['efficient', 'cruiser'],
  city: ['urban'],
  roadtrips: ['cruiser'],
};

const TAG_REASONS = {
  'drivers-car': 'One of the sharpest-handling cars in the range',
  family: 'Built around family life',
  cruiser: 'A relaxed, refined long-distance companion',
  urban: 'Right-sized for urban life',
  efficient: 'Easy on running costs day to day',
  tech: 'Packed with the latest cabin tech',
  image: 'Serious kerb appeal',
  practical: 'Genuinely practical day to day',
};

function scoreCharacter(car, answers, tuning) {
  const wanted = new Set(USE_TAGS[answers.primaryUse] || []);
  const style = Number(answers.style);
  if (style >= 4) wanted.add('drivers-car');
  if (style <= 2) wanted.add('cruiser');
  for (const p of answers.priorities || []) {
    if (p === 'tech') wanted.add('tech');
    if (p === 'image') wanted.add('image');
    if (p === 'comfort') wanted.add('cruiser');
    if (p === 'economy') wanted.add('efficient');
    if (p === 'performance') wanted.add('drivers-car');
  }
  const hits = car.tags.filter((t) => wanted.has(t));
  const score = clamp(hits.length / 2);
  return { score, reason: hits.length ? TAG_REASONS[hits[0]] : undefined };
}

const STYLE_LINE_LABEL = {
  classic: 'Classic', exclusive: 'Exclusive', sport: 'Sport', jcw: 'John Cooper Works',
};

/**
 * Trim-character match (MINI). The user's vibe answer arrives as answers.styleLine
 * (folded in by applyBespokeAnswers); the car carries its own from the derivative.
 * A "sport" want is satisfied by a JCW too — JCW is the sport line's extreme, so a
 * go-kart-minded buyer shouldn't be marked down for landing on one.
 *
 * No-ops safely for any brand that doesn't tune it (no tuning.styleLine → neutral,
 * multiplied by a zero weight), and treats an unknown car trim as neutral, never a
 * miss — an unparsed derivative isn't a wrong answer. See docs/mini-first-questions.md.
 */
function scoreStyleLine(car, answers, tuning) {
  const cfg = tuning.styleLine;
  if (!cfg || !answers.styleLine || !car.styleLine) return { score: cfg?.neutral ?? 0.7 };
  const want = answers.styleLine;
  const hit = want === 'sport'
    ? (car.styleLine === 'sport' || car.styleLine === 'jcw')
    : car.styleLine === want;
  return hit
    ? { score: cfg.match, reason: `${STYLE_LINE_LABEL[car.styleLine]} trim, just the character you asked for` }
    : { score: cfg.miss };
}

/**
 * Door-count preference (MINI Hatch only). answers.doors is '3' | '5' | 'either';
 * 'either' (or unanswered, or a non-hatch car with no door count) scores neutral.
 * A soft preference: a wrong count is a gentle miss, never a hard filter, and an
 * unknown car door count is neutral, not penalised.
 */
function scoreDoors(car, answers, tuning) {
  const cfg = tuning.doors;
  const want = Number(answers.doors);
  if (!cfg || !want || !car.doors) return { score: cfg?.neutral ?? 0.7 };
  return car.doors === want
    ? { score: cfg.match, reason: `${want}-door body, exactly the shape you wanted` }
    : { score: cfg.miss };
}

/* ---------------------------------------------------------------- *
 *  Orchestration                                                    *
 * ---------------------------------------------------------------- */

function effectiveWeights(answers, tuning) {
  const w = { ...tuning.weights };
  for (const p of answers.priorities || []) {
    const boosts = tuning.priorityBoosts[p] || {};
    for (const [dim, add] of Object.entries(boosts)) w[dim] += add;
  }
  // Running costs matter more the further you drive — a smooth ramp (0..1)
  // rather than the old diesel-only step, so it moves the ranking for every
  // fuel. At max mileage the economy dimension gains a full +1.
  w.economy += mileageFraction(answers, tuning);
  if (Number(answers.style) >= 4) w.performance += 1;
  if (Number(answers.style) <= 2) w.performance = Math.max(0.5, w.performance - 0.5);
  // When the user names specific fuel(s) — not "help me decide" — fuel binds
  // hard: a car of the wrong fuel (however strong elsewhere) shouldn't top a
  // matching-fuel car. Without this boost fuel is only ~14% of the blend, so an
  // EV flagship could out-rank the petrol saloon a petrol buyer asked for.
  // "open"/unanswered leaves fuel at its base weight (a range of fuels is fine).
  const prefs = fuelPrefs(answers);
  const specificFuel = prefs.length > 0 && !prefs.includes('open');
  if (specificFuel) w.fuel += tuning.fuelStrictBoost;
  // styleLine/doors only weigh in when their question was actually answered —
  // an unasked (BMW never sets them) or no-preference dimension stays fully
  // inert rather than diluting every score toward neutral. Once answered, the
  // scorer still returns neutral for a car whose own trim/doors are unknown
  // (unknown ≠ wrong), just at the now-active weight.
  if (!answers.styleLine) delete w.styleLine;
  if (!answers.doors || answers.doors === 'either') delete w.doors;
  return w;
}

function passesHardFilters(car, answers, tuning) {
  const { crewBoot, crewSeats, familySeats } = tuning.hardFilter;
  const [, max] = budgetRange(answers);
  if (car.priceMin > max * tuning.stretchFactor) return false;
  if (answers.people === 'crew' && (car.seats < crewSeats || car.boot < crewBoot)) return false;
  if (answers.people === 'family' && car.seats < familySeats) return false;
  return true;
}

const SCORERS = {
  budget: scoreBudget,
  body: scoreBody,
  fuel: scoreFuel,
  practicality: scorePracticality,
  performance: scorePerformance,
  economy: scoreEconomy,
  size: scoreSize,
  character: scoreCharacter,
  // Brand-optional dimensions: only weighted where a brand's tuning names them
  // (MINI). A brand without the weight contributes 0 (see the `?? 0` in rankCars),
  // so BMW's blend is unchanged and the scorers above never fire for it.
  styleLine: scoreStyleLine,
  doors: scoreDoors,
};

/* ---------------------------------------------------------------- *
 *  Match checklist — the user-facing "how many of my asks did it    *
 *  meet?" view, distinct from the blended score below.              *
 * ---------------------------------------------------------------- */

/*
 * The blended `score` answers "how good is this car for you, weighted by your
 * priorities" — a panel of judges, some grading on a curve, so a real car tops
 * out in the low 90s and a literal 100 never happens. That's honest but it
 * doesn't match the model a buyer walks in with: "I asked for N things — how
 * many did I get?" The checklist answers *that* question, and it CAN read 100%.
 *
 * The split that makes it work: not every answer is an ASK. Some are things a
 * car can meet or miss (budget, body, fuel, seats, doors, trim); others are
 * CONTEXT about the buyer that steer the ranking but that no car "meets"
 * (charging access, annual mileage, the two priorities, primary use, the
 * comfort/sport lean). Only asks count toward the checklist; context still
 * moves the blended score, which orders cars of equal satisfaction.
 *
 * Applicability is per-car for the stock-derived asks: a trim or door count we
 * couldn't read from the derivative is UNKNOWN, not a miss — it simply doesn't
 * appear on that car's checklist (unknown ≠ wrong, the same rule the scorers
 * follow). A "no preference" answer (`any`, `open`, solo) states no ask at all.
 */
const BODY_ASK_LABEL = {
  hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
  coupe: 'Coupé', convertible: 'Convertible', mpv: 'People carrier',
};
const FUEL_ASK_LABEL = {
  petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Fully electric',
};

/**
 * The user's stated asks scored against one car: which it meets, which it
 * misses. Context answers and no-preference answers are excluded; unknowns are
 * left off entirely (not counted as a miss).
 *
 * @returns {{ met: {id,label}[], missed: {id,label}[] }}
 */
export function matchChecklist(answers, car, tuning = DEFAULT_TUNING) {
  const met = [];
  const missed = [];
  // Each ask pushes an outcome-appropriate label: the met list feeds the "X of
  // Y asks" count, the missed list is shown verbatim as the trade-offs, so a
  // miss must read as a shortfall ("Above your budget"), not the bare ask.
  const mark = (hit, id, metLabel, missLabel) => (hit
    ? met.push({ id, label: metLabel })
    : missed.push({ id, label: missLabel }));

  // Budget: within the stated ceiling is met; a stretch buy (survived the hard
  // filter but sits above the max) is an honest miss. A car under the floor is
  // still "within my means", so it counts as met.
  const [, max] = budgetRange(answers) || [0, Infinity];
  mark(car.priceMin <= max, 'budget', `Within your ${gbp(max)} budget`, `Above your ${gbp(max)} budget`);

  // Body style: an ask only when a specific shape was named ("any" states none).
  const bodies = (answers.bodyStyles || []).filter((v) => v !== 'any');
  if (bodies.length) {
    const carBody = BODY_ASK_LABEL[car.body] || car.body;
    mark(bodies.includes(car.body), 'bodyStyles', `${carBody} body`, `A ${carBody}, not the shape you picked`);
  }

  // Fuel: an ask unless "help me decide" (open) or unanswered.
  const fuels = fuelPrefs(answers).filter((v) => v !== 'open');
  if (fuels.length) {
    const carFuel = FUEL_ASK_LABEL[car.fuel] || car.fuel;
    mark(fuels.includes(car.fuel), 'fuel', carFuel, `${carFuel}, not the fuel you picked`);
  }

  // Seats: only family/crew state a real requirement ("just me" asks nothing).
  // Shown cars have already cleared the seat hard filter, so this reads as met —
  // it's still a genuine ask the buyer made and the car satisfies.
  if (answers.people === 'family') {
    mark(car.seats >= tuning.hardFilter.familySeats, 'people', 'Room for the family', 'Tight on family space');
  } else if (answers.people === 'crew') {
    const ok = car.seats >= tuning.hardFilter.crewSeats && car.boot >= tuning.hardFilter.crewBoot;
    mark(ok, 'people', 'Seats for the crew', 'Not quite crew-sized');
  }

  // Doors (MINI): an ask only when a count was chosen (not "either") AND the
  // car has a known count — a non-hatch or unparsed derivative is N/A.
  const wantDoors = Number(answers.doors);
  if (wantDoors && car.doors) {
    mark(car.doors === wantDoors, 'doors', `${wantDoors} doors`, `${car.doors} doors, not the ${wantDoors} you wanted`);
  }

  // Trim character (MINI, via the vibe → styleLine): an ask only when a vibe was
  // picked AND the car's trim was readable. "sport" is met by a JCW too.
  if (answers.styleLine && car.styleLine) {
    const hit = answers.styleLine === 'sport'
      ? (car.styleLine === 'sport' || car.styleLine === 'jcw')
      : car.styleLine === answers.styleLine;
    mark(hit, 'styleLine', `${STYLE_LINE_LABEL[car.styleLine]} character`,
      `${STYLE_LINE_LABEL[car.styleLine]} trim, not the ${STYLE_LINE_LABEL[answers.styleLine]} you picked`);
  }

  return { met, missed };
}

/** Checklist satisfaction as a 0–100%, or null when no asks apply to this car
 *  (all "no preference", or every stock-derived ask was unknown). 100 = a car
 *  that meets every ask the buyer actually stated. */
function satisfactionPct({ met, missed }) {
  const total = met.length + missed.length;
  return total ? Math.round((met.length / total) * 100) : null;
}

/**
 * Rank every car that survives the hard filters, best first.
 *
 * Ordering is satisfaction-first: a car that meets more of the buyer's stated
 * asks (higher matchPct) outranks one that meets fewer, and the blended `score`
 * breaks ties among equally-satisfying cars (so the quickest/best-charactered
 * of the cars that tick every box still leads). A null matchPct (no asks
 * stated) sorts as fully satisfied — there's nothing unmet to demote it.
 *
 * Callers slice this to taste: the block's hero grid takes the top 3 of the
 * configured retailer's stock, while the "worth the drive" carousel ranks a
 * separate pool (nearby retailers) through the same scoring.
 *
 * @returns {Match[]} Match: { car, score, matchPct, checklist, stretch, reasons }
 */
export function rankCars(answers, cars, tuning = DEFAULT_TUNING) {
  const weights = effectiveWeights(answers, tuning);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return cars
    .filter((car) => passesHardFilters(car, answers, tuning))
    .map((car) => {
      let weighted = 0;
      let stretch = false;
      const candidates = [];
      for (const [dim, scorer] of Object.entries(SCORERS)) {
        // A dimension a brand doesn't weight (e.g. styleLine/doors for BMW)
        // contributes nothing and can't surface a reason — so adding a scorer
        // is inert for every brand that doesn't opt in via its tuning weights.
        const weight = weights[dim] ?? 0;
        if (weight === 0) continue;
        const r = scorer(car, answers, tuning);
        weighted += weight * r.score;
        if (r.stretch) stretch = true;
        if (r.reason && r.score >= 0.7) {
          candidates.push({ reason: r.reason, rank: weight * r.score });
        }
      }
      const reasons = candidates
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 4)
        .map((c) => c.reason);
      if (stretch) reasons.push(`A stretch at ${gbp(car.priceMin)}+, but maybe worth it`);
      let ratio = weighted / totalWeight;
      // Whole-score penalty for a "crew" buyer's sub-7-seat car: strong enough
      // that genuine 7-seaters top when in stock, but 5-seaters still rank (and
      // win when no 7-seater exists) — so it's stock-safe, not a hard filter.
      if (answers.people === 'crew' && car.seats < tuning.practicality.crewBonusSeats) {
        ratio *= tuning.crewSeatShortfall ?? 1;
      }
      const checklist = matchChecklist(answers, car, tuning);
      const matchPct = satisfactionPct(checklist);
      return {
        car, score: Math.round(ratio * 100), matchPct, checklist, stretch, reasons,
      };
    })
    // Satisfaction-first ordering: fewest-broken-promises wins, the blended
    // score breaks ties among equally-satisfying cars, then cheaper, then name.
    // A null matchPct (no asks stated) counts as fully satisfied (100).
    .sort(
      (a, b) => (b.matchPct ?? 100) - (a.matchPct ?? 100)
        || b.score - a.score
        || a.car.priceMin - b.car.priceMin
        || a.car.name.localeCompare(b.car.name),
    );
}

/*
 * Which of the user's stated wants have NO car behind them in this pool.
 *
 * The engine already drags a wrong-fuel or wrong-shape car's score down, but a
 * results page that silently shows petrol heroes to someone who asked for
 * electric is quietly dishonest — the same family of sin as inventing a
 * distance. So each pool reports what it couldn't offer, and the page says so
 * (see the unmet note in bmw-matcher.js).
 *
 * Scoped to the two wants that are genuine stock facts: fuel and body style.
 * "No preference" values (`any`, `open`) state no want and can never be unmet.
 *
 * Measured against the pool as fetched, NOT the survivors of the hard filters:
 * "no fully electric cars at this retailer" is a fact about the stock, and
 * saying it because the only EV happened to sit above the budget would be a
 * different lie. Budget mismatch is already visible in the results themselves.
 *
 * @returns {Object} question id → the unmet values, omitting met ones entirely.
 *   An empty object means every stated want has something behind it.
 */
export function unmetWants(answers, cars) {
  const unmet = {};
  // fuelPrefs turns "unanswered" into ['open'], which filters out to nothing.
  const fuels = fuelPrefs(answers).filter((v) => v !== 'open');
  const missingFuel = fuels.filter((v) => !cars.some((c) => c.fuel === v));
  if (missingFuel.length) unmet.fuel = missingFuel;

  const bodies = (answers.bodyStyles || []).filter((v) => v !== 'any');
  const missingBody = bodies.filter((v) => !cars.some((c) => c.body === v));
  if (missingBody.length) unmet.bodyStyles = missingBody;

  return unmet;
}

/** How many cars the results screen shows as headline matches. */
export const TOP_MATCHES = 3;

/**
 * The user's top matches from a pool of cars.
 * @returns {{ matches: Match[] }}
 */
export function matchCars(answers, cars, tuning = DEFAULT_TUNING) {
  return { matches: rankCars(answers, cars, tuning).slice(0, TOP_MATCHES) };
}
