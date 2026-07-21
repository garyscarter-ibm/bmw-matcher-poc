/*
 * Brand registry — the one place that knows how BMW and MINI differ.
 *
 * Both brands' used stock is served by the *same* Auto Trader/Django platform
 * (same CSRF handshake, same /vehicle/api/list/ JSON, same dealer_number join),
 * so the only per-brand facts are:
 *   - origin:          which site to fetch from / link to
 *   - defaultRetailer: retailer_site ID used when a request omits one
 *   - label:           human name for logs/errors
 *
 * The per-brand vehicle→spec mapping (MODEL_SPECS + derivations) lives in
 * mapping.js, selected by brand there. Everything else — engine, cache, warmer,
 * dealer directory (which is a combined BMW+MINI feed) — is brand-agnostic.
 */

/*
 * Engine tuning per brand — the calibration constants the scorers read
 * (server/engine.js). BMW_TUNING holds the engine's original hardcoded values,
 * so BMW output is unchanged; MINI overrides only what must differ because its
 * cars are small, light and quick-for-their-class rather than big and fast.
 * Adding a third brand = another tuning block, no engine change.
 *
 * Every field maps to a specific scorer:
 *   weights/priorityBoosts/stretchFactor — orchestration (effectiveWeights,
 *     passesHardFilters).
 *   performance.{zeroBase,span} — scorePerformance's (zeroBase - 0-62s)/span
 *     curve. Lower zeroBase + tighter span = a slower absolute car still reads
 *     as brisk (MINI is quick for its class, never fast in BMW terms).
 *   practicality.{bootNeed,seatsFloor,crewSeats,crewBonusSeats} — scorePracticality.
 *   size.{roadtripMinClass,cityDivisor} — scoreSize.
 *   hardFilter.{crewBoot,crewSeats,familySeats} — passesHardFilters (a HARD
 *     exclusion, so MINI needs lower floors or it's filtered out entirely).
 *   mileage.{lowMiles,highMiles} — the annual-mileage ramp (scoreEconomy /
 *     effectiveWeights); shared shape, tunable per brand.
 */
const BMW_TUNING = {
  weights: {
    // Body at 4.5 (was 2.5) — see the body block below for why.
    budget: 3.0, body: 4.5, fuel: 2.5, practicality: 2.0,
    performance: 1.5, economy: 1.5, size: 1.0, character: 2.0,
  },
  /*
   * Body-match scores. `neutral` = no preference / "any"; `miss` = wrong shape.
   *
   * At the original 2.5 / miss 0.15, BMW honoured a named body style in the
   * top 3 only 53% of the time (docs/question-stock-audit.md): a shape is the
   * most concrete thing a user asks for, and nearly half of them didn't get
   * it. MINI had already solved this for itself with 6.0 / miss 0, so the
   * question was how much of that BMW needs — its stock is far richer (median
   * 93 cars per retailer vs MINI's 33), and over-binding a rich pool would
   * flatten the results to one shape.
   *
   * Swept over 40 retailers × 300 answer sets (honesty / outcome diversity):
   *   2.5 / 0.15  53% / 62%   ← the old base
   *   2.5 / 0     55% / 62%
   *   3.5 / 0     61% / 64%
   *   4.0 / 0     63% / 64%
   *   4.5 / 0     66% / 66%   ← chosen
   *   5.0 / 0     67% / 65%
   *   6.0 / 0     71% / 63%   ← MINI's values, copied blind
   *
   * 4.5 / miss 0 is where diversity peaks: honesty +13 points and the results
   * get *more* varied, not less, because a wrong-shape car can no longer
   * out-muscle a right-shape one on the other dimensions. MINI's 6.0 buys 5
   * more points of honesty but starts costing diversity, which BMW's deeper
   * stock has no reason to pay. Dropping `miss` to 0 is worth ~2 points on its
   * own and is what stops a wrong shape scoring at all — it can still surface
   * when NO right-shape car satisfies the other answers, the honest "closest
   * we've got".
   */
  body: { match: 1, neutral: 0.7, miss: 0 },
  priorityBoosts: {
    economy: { economy: 1.5, budget: 0.5 },
    performance: { performance: 1.8, character: 0.5 },
    comfort: { character: 1.0, size: 0.5 },
    tech: { character: 1.0 },
    image: { character: 1.0 },
  },
  stretchFactor: 1.15,
  // Added to the fuel weight when the user names specific fuel(s) (not "help me
  // decide"), so fuel binds hard: a wrong-fuel car can't top a matching-fuel
  // one. At base 2.5 fuel is only ~14% of the blend, letting an EV flagship
  // out-rank the petrol saloon a petrol buyer asked for; +4 fixes that.
  fuelStrictBoost: 4.0,
  // 0-62 curve: (zeroBase - t) / span, clamped 0..1. BMW: 10.5s→0, 4.5s→1.
  performance: { zeroBase: 10.5, span: 6 },
  practicality: {
    bootNeed: { small: 0, medium: 400, big: 500 },
    seatsFloor: 5, // below this (unless solo) → *0.3
    crewBonusSeats: 7, // 7+ seats for a crew → perfect
  },
  // A "crew" buyer ("5+ seats, regularly") really wants a 7-seater. A car below
  // crewBonusSeats gets its FINAL blended score multiplied by this (applied in
  // rankCars, like the stretch flag) — strong enough that genuine 7-seaters top
  // when they're in stock, but 5-seaters still appear and win when none are (so
  // it's stock-safe, not a hard filter). MINI keeps 1 (no 7-seaters; its
  // crewBonusSeats is 5, so a 5-seat MINI is already the "full house").
  crewSeatShortfall: 0.7,
  size: { roadtripMinClass: 3, cityDivisor: 5 },
  hardFilter: { crewBoot: 430, crewSeats: 5, familySeats: 4 },
  // Annual-mileage ramp: miles at/under lowMiles → 0, at/over highMiles → 1.
  mileage: { lowMiles: 4000, highMiles: 20000 },
};

// MINI overrides. Recalibrated so a well-matched MINI reaches the same 85–95%
// a well-matched BMW does — scored against MINI's own class. Any weight MINI
// lists here replaces just that dimension's weight (mergeTuning deep-merges the
// weights object), so MINI tunes its own weighting without disturbing BMW.
const MINI_TUNING = {
  weights: {
    // Body is MINI's heaviest soft dimension. MINI's thin, EV-heavy stock let a
    // wrong-shape car that's strong elsewhere (the only EV, a JCW) top a search
    // for a different shape — e.g. the JCW Aceman SUV beating hatchbacks on a
    // "hatchback" search. At weight 6.0, paired with body.miss = 0, a wrong
    // shape can't reach #1 while any right-shape car that also fits exists
    // (empirically the Aceman drops from ~#2 to ~#12 on a "hatchback" search);
    // it can still surface when NO right-shape car satisfies the other answers
    // — the honest "closest we've got". BMW has since adopted the same
    // calibration at a lower weight (4.5 — see BMW_TUNING), because its deeper
    // stock doesn't need binding this hard to honour a shape. MINI keeps 6.0:
    // with a 33-car median pool the extra force is what earns it 72% honesty.
    body: 6.0,
  },
  // Wrong shape scores nothing on the (now heaviest) body dimension for MINI.
  // This now matches the BMW base's own miss of 0, so the field is currently
  // redundant — kept stated rather than inherited because MINI's whole body
  // calibration is deliberate, and it must not silently follow BMW if the base
  // is ever softened again.
  body: { match: 1, neutral: 0.7, miss: 0 },
  // 0-62: MINI range is ~6.0s (JCW) to ~8.5s. Solved so a JCW at 6.0s reads
  // ~0.9 and a brisk 7.7s Cooper ~0.6 (BMW's curve gives that 7.7s car only
  // 0.47): (11 - t)/5.5 → 6.0s=0.91, 7.7s=0.60, 8.3s=0.49.
  performance: { zeroBase: 11, span: 5.5 },
  practicality: {
    // MINI boots are small (160–460L). Scale needs down so a Countryman (460L)
    // satisfies "big" and a Hatch (210L) isn't crushed for "medium".
    bootNeed: { small: 0, medium: 220, big: 350 },
    seatsFloor: 4, // MINIs are 4/5 seats; don't punish a 4-seat Hatch
    crewBonusSeats: 5, // 5 seats is a full house for a MINI
  },
  // A Countryman/Clubman (class 2) is "big" for a MINI, so road trips top out
  // at class 2 rather than the BMW class-3 SUV expectation.
  size: { roadtripMinClass: 2, cityDivisor: 5 },
  // Don't hard-exclude MINIs for family/crew: a 5-seat Countryman (460L) should
  // survive, and 4-seat MINIs shouldn't be filtered out of a "family" search.
  hardFilter: { crewBoot: 350, crewSeats: 5, familySeats: 4 },
};

/** Deep-merge a brand's overrides onto the BMW base so partial tuning works. */
function mergeTuning(overrides) {
  const out = { ...BMW_TUNING };
  for (const key of Object.keys(overrides || {})) {
    const base = BMW_TUNING[key];
    out[key] = (base && typeof base === 'object' && !Array.isArray(base))
      ? { ...base, ...overrides[key] }
      : overrides[key];
  }
  return out;
}

export const BRANDS = {
  bmw: {
    label: 'BMW',
    origin: 'https://usedcars.bmw.co.uk',
    defaultRetailer: '96', // Grassicks Garage, Perth
    // Budget slider bounds. BMW used stock genuinely reaches £100k+, so the
    // full £0–150k range is right. (This is the base defined in questions.js.)
    budget: { max: 150000, default: [40000, 75000] },
    tuning: BMW_TUNING,
  },
  mini: {
    label: 'MINI',
    origin: 'https://approvedusedminis.co.uk',
    defaultRetailer: '92', // Sytner Luton MINI
    // MINI used stock runs ~£10k–£40k nationally (median ~£24.5k; nothing over
    // £40k in the feed), so a £150k slider leaves both thumbs bunched at the far
    // left. Cap at £50k with a default bracket around the median.
    budget: { max: 50000, default: [15000, 30000] },
    tuning: mergeTuning(MINI_TUNING),
    // Bespoke per-brand questions. This is the extensibility hook: a brand can
    // add questions the shared pool doesn't have. Each added question is a
    // normal question object (the client renders it generically) PLUS a
    // `scoresAs` map: value → partial standard-answers that the engine already
    // understands. applyBespokeAnswers (questions.js) folds those into the
    // answer set before scoring, so the ENGINE never learns a new question id —
    // a MINI "vibe" pick just contributes the same style/priorities/fuel
    // signals a normal answer would. `insertAfter` places it in the flow.
    questions: {
      add: [
        {
          id: 'miniVibe',
          title: 'WHAT’S YOUR MINI VIBE?',
          help: 'Sets the character we lean towards. Pick the one that’s most you.',
          insertAfter: 'style',
          options: [
            {
              value: 'classic',
              label: 'Classic charm',
              sub: 'Iconic looks, easy-going',
              scoresAs: { priorities: ['image'] },
            },
            {
              value: 'electric',
              label: 'Electric era',
              sub: 'Quiet, clever, low-running-cost',
              scoresAs: { priorities: ['tech', 'economy'] },
            },
            {
              value: 'jcw',
              label: 'John Cooper Works',
              sub: 'Full go-kart, maximum attack',
              scoresAs: { style: '5', priorities: ['performance'] },
            },
          ],
        },
      ],
    },
  },
};

/** The default brand when a request/config doesn't specify one. */
export const DEFAULT_BRAND = 'bmw';

/**
 * Normalise an arbitrary brand input to a known key, defaulting to BMW.
 * Accepts case-insensitively ("MINI", "Mini", "mini") so DA config and query
 * strings are forgiving.
 */
export function normalizeBrand(brand) {
  const key = String(brand || '').toLowerCase();
  return BRANDS[key] ? key : DEFAULT_BRAND;
}

/** The config record for a brand (always resolves — falls back to the default). */
export function brandConfig(brand) {
  return BRANDS[normalizeBrand(brand)];
}

/** The engine tuning for a brand (defaults to BMW's, which are the engine's
 * original constants). */
export function brandTuning(brand) {
  return brandConfig(brand).tuning;
}
