/*
 * Matching engine — pure, deterministic, brand-agnostic: every magic number
 * lives in the per-brand `tuning` arg, which defaults to BMW's constants.
 */

import { BUDGET_BANDS } from './questions.js';
import { brandTuning } from './brands.js';

/** Default tuning = BMW's (the engine's original constants). */
const DEFAULT_TUNING = brandTuning('bmw');

/*
 * Base weight of each scoring dimension. Duplicates the per-brand `tuning`
 * table under the name the README points tuners at — keep the two in step.
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
 * Resolve a budget answer to a [min, max] £ range. Accepts a [min, max] pair, a
 * bare number (→ [0, n]) or the legacy b1–b5 band keys; null for anything unusable.
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
 * Annual mileage as a 0..1 fraction along the brand's ramp (lowMiles → 0,
 * highMiles → 1). Drives running-cost weight for every fuel; unanswered → 0.
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
    // Below the user's minimum. With no real floor (min 0) that's fine; with a
    // deliberate min, penalise in proportion to how far under the floor it sits.
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

/*
 * How acceptable each fuel is as a substitute for the one wanted: compressed but
 * not zeroed (a PHEV is the closest thing to an EV), so a wrong fuel must win big.
 */
const FUEL_TABLE = {
  petrol: { petrol: 1, diesel: 0.25, phev: 0.3, ev: 0.1 },
  diesel: { diesel: 1, petrol: 0.25, phev: 0.25, ev: 0.1 },
  phev: { phev: 1, ev: 0.35, petrol: 0.25, diesel: 0.2 },
  ev: { ev: 1, phev: 0.3, petrol: 0.05, diesel: 0.05 },
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
  // Fuel is multi-select: score against each chosen fuel and take the best.
  // Unanswered falls back to ['open'] (fuelPrefs) so a partial set still ranks.
  const prefs = fuelPrefs(answers);
  let best = { score: -1 };
  for (const pref of prefs) {
    const r = scoreOneFuel(pref, car, answers, tuning);
    if (r.score > best.score) best = r;
  }
  return best;
}

/*
 * Luggage need as a per-brand bootNeed key, derived from people + primaryUse
 * (each scored 0/1/2 and summed to preserve discrimination). Unanswered ⇒ small.
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

/*
 * A reason phrase in the brand's own register (see `reasons` in brands.js),
 * falling back to BMW's base so a brand that overrides nothing still speaks.
 */
function phrase(tuning, key, car) {
  const say = tuning.reasons?.[key] ?? DEFAULT_TUNING.reasons[key];
  return say(car);
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
  // sub-7-seat shortfall is a whole-score penalty in rankCars, not here.
  if (answers.people === 'crew' && car.seats >= crewBonusSeats) {
    return { score: 1, reason: phrase(tuning, 'crew', car) };
  }
  /*
   * Both variants state litres AND that it's seats-up — the qualifier is what
   * makes a boot number believable, and it matches the card's spec line.
   */
  let reason;
  if (need > 0 && car.boot >= need) {
    reason = phrase(tuning, 'boot', car);
  } else if (need > 0 && car.boot >= need * 0.9) {
    reason = phrase(tuning, 'bootTight', car);
  }
  return { score, reason };
}

function scorePerformance(car, answers, tuning) {
  const { zeroBase, span } = tuning.performance;
  const wantsIt = Number(answers.style) >= 4 || (answers.priorities || []).includes('performance');
  // Per-brand 0-62 curve, plus a second faster curve when speed is wanted: the
  // generous default clamps sub-4.5s cars flat, hiding real gaps between fast cars.
  const base = wantsIt ? zeroBase - 3 : zeroBase;
  const range = wantsIt ? span - 2 : span;
  const score = clamp((base - car.zeroTo62) / range);
  let reason;
  if (score >= 0.85 && wantsIt) {
    reason = `0–62 in ${car.zeroTo62}s, as quick as you hoped`;
  }
  return { score, reason };
}

function scoreEconomy(car, answers, tuning) {
  const canCharge = canChargeAt(answers.charging);
  // How much running costs matter, 0..1 by annual mileage: scales the reward for
  // efficiency and the penalty for a guzzler, so mileage now moves every fuel.
  const miles = mileageFraction(answers, tuning);
  let score;
  let reason;
  if (car.fuel === 'ev') {
    // EVs are cheapest per mile — the higher the mileage, the more that wins.
    score = canCharge ? 1 : clamp(0.5 + 0.2 * miles);
    if (canCharge) {
      reason = miles >= 0.66
        ? 'Pennies per mile charging at home or work, ideal for your big annual mileage'
        : 'Pennies per mile charging at home or work';
    }
  } else if (car.fuel === 'phev') {
    score = canCharge ? clamp(0.85 + 0.1 * miles) : clamp(0.6 - 0.1 * miles);
    if (canCharge && car.evRange) reason = `Around ${car.evRange} electric miles covers most daily driving`;
  } else {
    // Petrol/diesel: base on mpg, then tilt by mileage. No consumption figure →
    // neutral 0.5, not NaN (unknown ≠ thirsty, and NaN poisons the whole blend).
    const mpg = Number(car.mpg);
    if (!Number.isFinite(mpg)) return { score: 0.5 };
    const base = clamp((mpg - 25) / 35);
    // At high mileage, pull the score toward its mpg merit harder (thirsty cars
    // sink, frugal cars rise); at low mileage, soften both extremes toward 0.7.
    score = clamp(base + (base - 0.5) * miles);
    if (score >= 0.8) {
      reason = miles >= 0.66
        ? `Frugal at around ${car.mpg}mpg, kind on a big annual mileage`
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
      reason: car.sizeClass <= 2 ? phrase(tuning, 'city', car) : undefined,
    };
  }
  if (answers.primaryUse === 'roadtrips') {
    const big = car.sizeClass >= roadtripMinClass;
    // Was "Big-car refinement for long motorway days", a claim the data can't
    // support. Size is all we know here, so size is all the reason claims.
    return { score: big ? 1 : 0.6, reason: big ? phrase(tuning, 'roadtrip', car) : undefined };
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

/**
 * Character phrases merged key-by-key onto BMW's, so a brand overriding a few
 * tags keeps BMW's wording for the rest (a shallow merge would lose them).
 */
function tagReasons(tuning) {
  return { ...DEFAULT_TUNING.reasons.tags, ...(tuning.reasons?.tags || {}) };
}

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
  return { score, reason: hits.length ? tagReasons(tuning)[hits[0]] : undefined };
}

const STYLE_LINE_LABEL = {
  classic: 'Classic', exclusive: 'Exclusive', sport: 'Sport', jcw: 'John Cooper Works',
};

/**
 * Trim-character match (MINI). A "sport" want is also satisfied by a JCW (the
 * sport line's extreme); unknown trim and untuned brands score neutral, never a miss.
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
 * Door-count preference (MINI Hatch only). 'either'/unanswered/unknown scores
 * neutral; a wrong count is a gentle miss, never a hard filter.
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

/*
 * Constraints eliminate. Fit ranks. Taste chooses. These are the SUBJECTIVE
 * dimensions, scored separately so preferences can't out-vote stated needs.
 */
const TASTE_DIMENSIONS = new Set(['character', 'performance', 'styleLine']);

/*
 * Taste's guaranteed share of the match score, fixed so hardening a constraint
 * can't squeeze it to nothing. 0.2 is calibrated (swept against the harness).
 */
const TASTE_SHARE = Number(process.env.TASTE_SHARE ?? 0.2);

/**
 * Weights for the objective half: how well the car suits stated needs. Free of
 * `priorities` — what someone likes must not change how well a car fits them.
 */
function fitWeights(answers, tuning) {
  const w = {};
  for (const [dim, weight] of Object.entries(tuning.weights)) {
    if (!TASTE_DIMENSIONS.has(dim)) w[dim] = weight;
  }
  // Running costs matter more the further you drive. Objective, so it stays
  // on the fit side.
  w.economy += mileageFraction(answers, tuning);
  // A named fuel binds hard (see the fuelStrictBoost note below).
  const prefs = fuelPrefs(answers);
  if (prefs.length > 0 && !prefs.includes('open')) w.fuel += tuning.fuelStrictBoost;
  // An unanswered/no-preference doors question stays fully inert.
  if (!answers.doors || answers.doors === 'either') delete w.doors;
  return w;
}

/**
 * Weights for the subjective half — the only place `priorities` acts, which is
 * what gives the preference questions something to decide.
 */
function tasteWeights(answers, tuning) {
  const w = {};
  for (const dim of TASTE_DIMENSIONS) {
    if (tuning.weights[dim] != null) w[dim] = tuning.weights[dim];
  }
  for (const p of answers.priorities || []) {
    const boosts = tuning.priorityBoosts[p] || {};
    for (const [dim, add] of Object.entries(boosts)) {
      if (dim in w) w[dim] += add;
    }
  }
  // How spirited they want it — taste by definition.
  if (Number(answers.style) >= 4) w.performance += 1;
  if (Number(answers.style) <= 2) w.performance = Math.max(0.5, w.performance - 0.5);
  // styleLine only weighs in when its question was actually answered.
  if (!answers.styleLine) delete w.styleLine;
  return w;
}

/** @deprecated kept for the audit harness's A/B; see fitWeights/tasteWeights. */
function effectiveWeights(answers, tuning) {
  const w = { ...tuning.weights };
  for (const p of answers.priorities || []) {
    const boosts = tuning.priorityBoosts[p] || {};
    for (const [dim, add] of Object.entries(boosts)) w[dim] += add;
  }
  // Running costs matter more the further you drive — a smooth 0..1 ramp, so it
  // moves every fuel; at max mileage the economy dimension gains a full +1.
  w.economy += mileageFraction(answers, tuning);
  if (Number(answers.style) >= 4) w.performance += 1;
  if (Number(answers.style) <= 2) w.performance = Math.max(0.5, w.performance - 0.5);
  // A named fuel binds hard: without this boost fuel is only ~14% of the blend,
  // so an EV flagship could out-rank the petrol saloon a petrol buyer asked for.
  const prefs = fuelPrefs(answers);
  const specificFuel = prefs.length > 0 && !prefs.includes('open');
  if (specificFuel) w.fuel += tuning.fuelStrictBoost;
  // styleLine/doors only weigh in when their question was answered — an unasked
  // or no-preference dimension stays inert rather than diluting toward neutral.
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
  // (MINI). A brand without the weight contributes 0, so BMW's blend is unchanged.
  styleLine: scoreStyleLine,
  doors: scoreDoors,
};

/**
 * Rank every car that survives the hard filters, best first.
 * @returns {Match[]} { car, score (0–100), stretch, reasons, tradeOffs }
 */
export function rankCars(answers, cars, tuning = DEFAULT_TUNING) {
  const fitW = fitWeights(answers, tuning);
  const tasteW = tasteWeights(answers, tuning);
  const fitTotal = Object.values(fitW).reduce((a, b) => a + b, 0);
  const tasteTotal = Object.values(tasteW).reduce((a, b) => a + b, 0);

  return cars
    .filter((car) => passesHardFilters(car, answers, tuning))
    .map((car) => {
      let fitWeighted = 0;
      let tasteWeighted = 0;
      let stretch = false;
      const candidates = [];
      for (const [dim, scorer] of Object.entries(SCORERS)) {
        // A dimension a brand doesn't weight (styleLine/doors for BMW) contributes
        // nothing and surfaces no reason, so adding a scorer is inert until opted in.
        const weight = (fitW[dim] ?? 0) + (tasteW[dim] ?? 0);
        if (weight === 0) continue;
        const r = scorer(car, answers, tuning);
        if (fitW[dim]) fitWeighted += fitW[dim] * r.score;
        if (tasteW[dim]) tasteWeighted += tasteW[dim] * r.score;
        if (r.stretch) stretch = true;
        if (r.reason && r.score >= 0.7) {
          candidates.push({ reason: r.reason, rank: weight * r.score });
        }
      }
      const reasons = candidates
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 4)
        .map((c) => c.reason);
      // "…but maybe worth it" was a nudge, exactly what a margin-watching buyer
      // reads into it. State the fact and let them price it.
      if (stretch) reasons.push(`A stretch at ${gbp(car.priceMin)}+, over the budget you set`);
      let ratio = fitWeighted / fitTotal;
      // Whole-score penalty for a crew buyer's sub-7-seat car: strong enough that
      // real 7-seaters top when in stock, but 5-seaters still rank — not a filter.
      if (answers.people === 'crew' && car.seats < tuning.practicality.crewBonusSeats) {
        ratio *= tuning.crewSeatShortfall ?? 1;
      }
      const tasteRatio = tasteTotal ? tasteWeighted / tasteTotal : 0;
      return {
        car,
        // The match %: mostly how well the car suits them, plus a guaranteed
        // TASTE_SHARE of how much they'd like it, which constraints can't squeeze.
        score: Math.round((ratio * (1 - TASTE_SHARE) + tasteRatio * TASTE_SHARE) * 100),
        // The two halves kept separately: `fit` is what the honesty layer talks
        // about, `taste` orders cars the fit score can't separate.
        fit: Math.round(ratio * 100),
        taste: Math.round(tasteRatio * 100),
        stretch,
        reasons,
        tradeOffs: tradeOffs(answers, car),
      };
    })
    // Fit first, then taste — within a group of equally suitable cars the buyer's
    // preferences pick the order. Price then name are the deterministic tie-break.
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.taste - a.taste ||
        a.car.priceMin - b.car.priceMin ||
        a.car.name.localeCompare(b.car.name),
    );
}

/*
 * Which stated wants (fuel, body style) have NO car behind them in this pool,
 * measured against the pool as fetched. Returns { question id → unmet values }.
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

/*
 * The stated wants THIS car fails to meet — the per-car companion to unmetWants
 * (same fuel/body scope). Returns [{ dim, wants, got }] in fuel-then-shape order.
 */
export function tradeOffs(answers, car) {
  const trades = [];
  const fuels = fuelPrefs(answers).filter((v) => v !== 'open');
  if (fuels.length && !fuels.includes(car.fuel)) {
    trades.push({ dim: 'fuel', wants: fuels, got: car.fuel });
  }
  const bodies = (answers.bodyStyles || []).filter((v) => v !== 'any');
  if (bodies.length && !bodies.includes(car.body)) {
    trades.push({ dim: 'bodyStyles', wants: bodies, got: car.body });
  }
  return trades;
}

/** How many cars the results screen shows as headline matches. */
export const TOP_MATCHES = 3;

/*
 * When the engine can't separate the top cars (#1 and #2 tie often), results are
 * described by `cluster` (within CLUSTER_PTS of top) and `decisive`, not a "perfect" lie.
 */
export const CLUSTER_PTS = 3;
export const MAX_SHOWN = 6;

/*
 * How far ahead on TASTE a car must be, inside a fit-tie, before we'll name it.
 * Below this the cars are alike on needs AND likes, so the page hands over to refine.
 */
export const TASTE_PTS = 6;

/** How many next-best cars to hold back so a rejection has somewhere to go. */
export const ALTERNATIVES = 6;

/*
 * Collapse repeat listings of the same car into one match, grouped on
 * line+body+fuel+0-62+trim (not `name`, which the feed writes two ways).
 */
export function groupListings(ranked) {
  const key = (c) => [c.line, c.body, c.fuel, c.zeroTo62, c.styleLine ?? ''].join('|');
  const groups = new Map();
  for (const match of ranked) {
    const k = key(match.car);
    if (!groups.has(k)) groups.set(k, { match, listings: [] });
    groups.get(k).listings.push(match.car);
  }
  return [...groups.values()].map(({ match, listings }) => {
    const prices = listings.map((c) => c.priceMin).filter(Number.isFinite);
    const colours = [...new Set(listings
      .map((c) => c.colour?.manufacturerColour || c.colour?.colour)
      .filter(Boolean))];
    return {
      ...match,
      car: {
        ...match.car,
        // The feed's tidiest name for this car wins the card.
        name: listings.reduce((a, b) => (b.name.length < a.length ? b.name : a), match.car.name),
        listingCount: listings.length,
        priceFrom: prices.length ? Math.min(...prices) : match.car.priceMin,
        priceTo: prices.length ? Math.max(...prices) : match.car.priceMin,
        colours,
        features: [...new Set(listings.flatMap((c) => c.features || []))],
      },
      listings,
    };
  });
}

/**
 * The user's top matches from a pool, plus whether naming one winner is honest.
 * @returns {{ matches, decisive, clusterSize }} clusterSize can exceed matches.length.
 */
export function matchCars(answers, cars, tuning = DEFAULT_TUNING) {
  // Group first, so everything downstream — the cluster count, the headline,
  // the taste comparison — is about CARS rather than listings.
  const scored = rankCars(answers, cars, tuning);
  const ranked = groupListings(scored);
  /*
   * The working, so the page can show it: `total` is the whole feed, `eligible`
   * what survived the hard filters, `margin` the lead over the next different car.
   */
  const searched = {
    total: cars.length,
    eligible: scored.length,
    margin: ranked.length > 1 ? Math.round(ranked[0].score - ranked[1].score) : null,
  };
  if (!ranked.length) {
    return {
      matches: [], decisive: true, clusterSize: 0, tasteLead: false, searched,
    };
  }

  const top = ranked[0].score;
  const cluster = ranked.filter((m) => top - m.score <= CLUSTER_PTS);
  const clusterSize = cluster.length;
  const decisive = clusterSize === 1;
  // Fit can't separate them but taste can: the cluster is already taste-sorted,
  // so naming the leader is honest and lets the preference questions matter.
  const tasteLead = !decisive && (cluster[0].taste - cluster[1].taste) >= TASTE_PTS;
  const shown = decisive
    ? TOP_MATCHES
    : Math.min(Math.max(clusterSize, TOP_MATCHES), MAX_SHOWN);
  return {
    matches: ranked.slice(0, shown),
    // The next-best cars, held back so "not this one" has somewhere to go —
    // without them, rejecting the shown cars empties the page.
    alternatives: ranked.slice(shown, shown + ALTERNATIVES),
    decisive,
    clusterSize,
    tasteLead,
    searched,
  };
}
