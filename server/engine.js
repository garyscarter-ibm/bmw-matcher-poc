/*
 * Matching engine — pure, deterministic, dependency-free.
 *
 * Input:  answers object produced by the quiz (see questions.js)
 * Output: ranked matches with 0–100 scores and human-readable reasons
 *         generated from the actual score components.
 *
 * Tune behaviour in WEIGHTS / PRIORITY_BOOSTS below — the scoring
 * functions themselves shouldn't need touching for weight changes.
 */

import { BUDGET_BANDS } from './questions.js';

/** Base weight of each scoring dimension. */
export const WEIGHTS = {
  budget: 3.0,
  body: 2.5,
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

/** High annual mileage (the old 'vhigh' band): the diesel/economy boost line. */
function isHighMileage(answers) {
  const m = answers.mileage;
  if (typeof m === 'number') return m >= 20000;
  return m === 'vhigh';
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
    // Cheaper than the stated band — fine, mildly off-target.
    return { score: 0.7, reason: 'Comes in under budget' };
  }
  return { score: 0.75 }; // straddles the band edge
}

function scoreBody(car, answers) {
  const picks = answers.bodyStyles || [];
  if (picks.length === 0 || picks.includes('any')) return { score: 0.7 };
  if (picks.includes(car.body)) {
    const labels = {
      hatchback: 'hatchback', saloon: 'saloon', estate: 'estate', suv: 'SUV',
      coupe: 'coupé', convertible: 'convertible', mpv: 'family carrier',
    };
    return { score: 1, reason: `The ${labels[car.body]} shape you asked for` };
  }
  return { score: 0.15 };
}

const FUEL_LABELS = { petrol: 'petrol', diesel: 'diesel', phev: 'plug-in hybrid', ev: 'fully electric' };

const FUEL_TABLE = {
  petrol: { petrol: 1, diesel: 0.7, phev: 0.6, ev: 0.15 },
  diesel: { diesel: 1, petrol: 0.6, phev: 0.5, ev: 0.15 },
  phev: { phev: 1, ev: 0.55, petrol: 0.5, diesel: 0.4 },
  ev: { ev: 1, phev: 0.5, petrol: 0.1, diesel: 0.1 },
};

/** Score one car against a single fuel preference. Returns { score, reason? }. */
function scoreOneFuel(pref, car, answers) {
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
    else if (car.fuel === 'diesel') score = isHighMileage(answers) ? 0.9 : 0.55;
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
    } else if (car.fuel === 'diesel' && isHighMileage(answers)) {
      reason = 'Diesel torque and economy suit your big annual mileage';
    }
  }
  return { score, reason };
}

function scoreFuel(car, answers) {
  // Fuel is multi-select: the user can pick several fuels (or none, which reads
  // as "help me decide"). Score the car against each chosen fuel and take the
  // best — a petrol car matching "Petrol + EV" scores on its petrol merit. An
  // unanswered set falls back to ['open'] (fuelPrefs), so a partial answer set
  // still ranks instead of throwing on FUEL_TABLE[undefined].
  const prefs = fuelPrefs(answers);
  let best = { score: -1 };
  for (const pref of prefs) {
    const r = scoreOneFuel(pref, car, answers);
    if (r.score > best.score) best = r;
  }
  return best;
}

function scorePracticality(car, answers) {
  // Unanswered boot question ⇒ no space requirement yet (treat as "small"),
  // so a partial answer set scores a real number rather than NaN from
  // dividing by an undefined `need`.
  const need = { small: 0, medium: 400, big: 500 }[answers.boot] ?? 0;
  const seatsOk = answers.people === 'solo' || car.seats >= 5;
  let score = need === 0 ? 1 : clamp(car.boot / need);
  if (!seatsOk) score *= 0.3;
  if (answers.people === 'crew' && car.seats >= 7) {
    return { score: 1, reason: `${car.seats} proper seats for the full crew` };
  }
  let reason;
  if (need >= 500 && car.boot >= 500) {
    reason = `${car.boot}-litre boot swallows the dogs, the tip runs, the lot`;
  } else if (need >= 400 && car.boot >= 450) {
    reason = `Big ${car.boot}-litre boot for buggies and the weekly shop`;
  }
  return { score, reason };
}

function scorePerformance(car, answers) {
  const score = clamp((10.5 - car.zeroTo62) / 6);
  const wantsIt = Number(answers.style) >= 4 || (answers.priorities || []).includes('performance');
  let reason;
  if (score >= 0.85 && wantsIt) {
    reason = `0–62 in ${car.zeroTo62}s, as quick as you hoped`;
  }
  return { score, reason };
}

function scoreEconomy(car, answers) {
  const canCharge = canChargeAt(answers.charging);
  let score;
  let reason;
  if (car.fuel === 'ev') {
    score = canCharge ? 1 : 0.5;
    if (canCharge) reason = 'Pennies per mile charging at home or work';
  } else if (car.fuel === 'phev') {
    score = canCharge ? 0.9 : 0.6;
    if (canCharge && car.evRange) reason = `Around ${car.evRange} electric miles covers most daily driving`;
  } else {
    score = clamp((car.mpg - 25) / 35);
    if (score >= 0.8) reason = `Frugal for what it is, around ${car.mpg}mpg`;
  }
  return { score, reason };
}

function scoreSize(car, answers) {
  if (answers.primaryUse === 'city') {
    const score = (6 - car.sizeClass) / 5;
    return {
      score,
      reason: car.sizeClass <= 2 ? 'Compact enough for city streets and tight parking' : undefined,
    };
  }
  if (answers.primaryUse === 'roadtrips') {
    return {
      score: car.sizeClass >= 3 ? 1 : 0.6,
      reason: car.sizeClass >= 3 ? 'Big-car refinement for long motorway days' : undefined,
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

function scoreCharacter(car, answers) {
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

/* ---------------------------------------------------------------- *
 *  Orchestration                                                    *
 * ---------------------------------------------------------------- */

function effectiveWeights(answers) {
  const w = { ...WEIGHTS };
  for (const p of answers.priorities || []) {
    const boosts = PRIORITY_BOOSTS[p] || {};
    for (const [dim, add] of Object.entries(boosts)) w[dim] += add;
  }
  if (isHighMileage(answers)) w.economy += 1;
  if (Number(answers.style) >= 4) w.performance += 1;
  if (Number(answers.style) <= 2) w.performance = Math.max(0.5, w.performance - 0.5);
  return w;
}

function passesHardFilters(car, answers) {
  const [, max] = budgetRange(answers);
  if (car.priceMin > max * STRETCH_FACTOR) return false;
  if (answers.people === 'crew' && (car.seats < 5 || car.boot < 430)) return false;
  if (answers.people === 'family' && car.seats < 4) return false;
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
};

/**
 * Rank every car that survives the hard filters, best first.
 *
 * Callers slice this to taste: the block's hero grid takes the top 3 of the
 * configured retailer's stock, while the "worth the drive" carousel ranks a
 * separate pool (nearby retailers) through the same scoring.
 *
 * @returns {Match[]} Match: { car, score (0–100), stretch, reasons: string[] }
 */
export function rankCars(answers, cars) {
  const weights = effectiveWeights(answers);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  return cars
    .filter((car) => passesHardFilters(car, answers))
    .map((car) => {
      let weighted = 0;
      let stretch = false;
      const candidates = [];
      for (const [dim, scorer] of Object.entries(SCORERS)) {
        const r = scorer(car, answers);
        weighted += weights[dim] * r.score;
        if (r.stretch) stretch = true;
        if (r.reason && r.score >= 0.7) {
          candidates.push({ reason: r.reason, rank: weights[dim] * r.score });
        }
      }
      const reasons = candidates
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 4)
        .map((c) => c.reason);
      if (stretch) reasons.push(`A stretch at ${gbp(car.priceMin)}+, but maybe worth it`);
      return { car, score: Math.round((weighted / totalWeight) * 100), stretch, reasons };
    })
    // Deterministic tie-breaking: score, then cheaper car, then name.
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.car.priceMin - b.car.priceMin ||
        a.car.name.localeCompare(b.car.name),
    );
}

/** How many cars the results screen shows as headline matches. */
export const TOP_MATCHES = 3;

/**
 * The user's top matches from a pool of cars.
 * @returns {{ matches: Match[] }}
 */
export function matchCars(answers, cars) {
  return { matches: rankCars(answers, cars).slice(0, TOP_MATCHES) };
}
