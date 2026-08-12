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
  /*
   * The handful of reason strings whose REGISTER differs between brands, not
   * just their numbers. Everything else the engine says is built from live
   * figures (mpg, 0-62, litres, £) and reads the same in either voice, so it
   * stays in engine.js; only these carry a marque's temperature.
   *
   * BMW's are the base and MINI overrides individual keys (see MINI_TUNING).
   * `tags` is merged key-by-key in engine.js rather than by mergeTuning, whose
   * shallow merge would let a brand silently blank the tags it didn't restate.
   */
  reasons: {
    boot: (car) => `${car.boot} litres of boot with all ${car.seats} seats up`,
    // Fires between 90% and 100% of the space the answers imply. Saying so is
    // the point: Sam & Jordan Reyes walk away when practicality claims read
    // like brochure copy, and a reason that admits it is only just enough is
    // the opposite of a brochure.
    bootTight: (car) => `${car.boot} litres of boot with the seats up, which is `
      + 'enough for what you described rather than generous',
    crew: (car) => `${car.seats} seats, and ${car.boot} litres behind them`,
    roadtrip: () => 'Big enough to be comfortable on a long motorway run',
    city: () => 'Compact enough for city streets and tight parking',
    /*
     * Character, the taste dimension. These were the page's purest brochure
     * copy ("Serious kerb appeal", "Packed with the latest cabin tech",
     * "Genuinely practical day to day") — unfalsifiable adjectives asserting a
     * verdict rather than giving a reason. Rewritten to state the basis, and
     * the two practicality ones now point at the seats and boot figures the
     * card prints, so the buyer can check the claim instead of believing it.
     * Only one of these ever reaches a card (scoreCharacter takes hits[0]).
     */
    tags: {
      'drivers-car': 'Tuned for the driving rather than the ride',
      family: 'A family shape, and the seats and boot above are the size of it',
      cruiser: 'A big car, and quiet with it at motorway speed',
      urban: 'Short enough to park without thinking about it',
      efficient: 'Cheap per mile next to the rest of the range',
      tech: 'The current cabin, not the outgoing one',
      image: 'A car people look at twice',
      practical: 'A load-carrier first, as the boot figure above says',
    },
  },
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
    // MINI-only dimensions BMW leaves unweighted, so they no-op for BMW (see
    // scoreStyleLine/scoreDoors — a brand that doesn't weight a dimension
    // contributes 0). styleLine is the trim-character match the repointed
    // `miniVibe` feeds; it carries signal the engine can't get elsewhere
    // (Classic vs Exclusive share a 0-62 and price, so nothing else separates
    // them), hence a near-character weight. doors is a lighter, Hatch-only
    // use-case lean. Both tuned against the audit A/B (docs/mini-first-questions.md).
    styleLine: 2.5,
    doors: 1.5,
  },
  // Trim-character scores (scoreStyleLine), same shape as body: a right trim is
  // perfect, an unknown/neutral one middling, a wrong one weak but not zero —
  // trim is a lean, not a hard requirement like shape, so miss stays off the floor.
  styleLine: { match: 1, neutral: 0.7, miss: 0.25 },
  // Door-count scores (scoreDoors). Gentler miss than styleLine: being shown a
  // 5-door when you wanted 3 is a mild mismatch, not a character clash.
  doors: { match: 1, neutral: 0.7, miss: 0.4 },
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
  /*
   * Only the lines whose TEMPERATURE differs (docs/tone-style-guide.md): MINI
   * smiles, and "go-kart" is its sanctioned way of being emotional the way
   * "driving pleasure" is BMW's. The numbers and the honesty are identical —
   * `bootTight` still owns up to being only just enough — because those are
   * the brand-neutral part. `tags` is merged key-by-key in engine.js, so the
   * three MINI leaves alone keep BMW's wording.
   */
  reasons: {
    boot: (car) => `${car.boot} litres in the back with all ${car.seats} seats up`,
    crew: (car) => `All ${car.seats} seats, and ${car.boot} litres behind them`,
    roadtrip: () => 'One of the bigger MINIs, which is what a long run wants',
    city: () => 'Small enough for town streets and awkward parking spaces',
    tags: {
      'drivers-car': 'The go-kart end of the range, and it drives like it',
      family: 'A family MINI, and the seats and boot above are the size of it',
      cruiser: 'The comfortable end of the range rather than the firm one',
      urban: 'Short enough to park anywhere in town',
      image: 'A MINI people look at twice, which is rather the point',
    },
  },
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
    // Where stock comes from. 'feed' = the live Auto Trader/Django platform
    // (stock.js does the CSRF fetch); 'fixtures' = read fixtures/<brand>-cars.json
    // (already-mapped cars, no network) for brands whose live feed we can't reach
    // yet. BMW and MINI are live.
    source: 'feed',
    // Budget slider bounds. BMW used stock genuinely reaches £100k+, so the
    // full £0–150k range is right. (This is the base defined in questions.js.)
    budget: { max: 150000, default: [40000, 75000] },
    tuning: BMW_TUNING,
  },
  mini: {
    label: 'MINI',
    origin: 'https://approvedusedminis.co.uk',
    defaultRetailer: '92', // Sytner Luton MINI
    source: 'feed',
    // MINI used stock runs ~£10k–£40k nationally (median ~£24.5k; nothing over
    // £40k in the feed), so a £150k slider leaves both thumbs bunched at the far
    // left. Cap at £50k with a default bracket around the median.
    budget: { max: 50000, default: [15000, 30000] },
    tuning: mergeTuning(MINI_TUNING),
    // Per-brand question surgery — the extensibility hook that lets MINI's set
    // diverge from the shared pool without the engine learning a thing (see
    // docs/mini-first-questions.md for the evidence behind each change):
    //
    //  drop — questions the shared pool asks but MINI's range makes near-dead.
    //    `mileage` arbitrates diesel-vs-petrol running costs, and MINI sells no
    //    diesel to speak of; `style` (comfort↔sporty) barely separates cars on a
    //    one-model-per-shape range, so it's folded into `miniVibe` instead of
    //    asked. BMW keeps both. The engine still *reads* mileage/style if a value
    //    arrives (legacy links), so nothing breaks — they're just not asked.
    //
    //  add — questions MINI's range needs that BMW's doesn't:
    //    `doors` (3- vs 5-door, a real split of MINI's biggest line, the Hatch;
    //    BMW body style already implies doors) as a normal conditional question
    //    scored by scoreDoors, and `miniVibe` repointed at MINI's real trim lines
    //    (Classic/Exclusive/Sport). Each vibe option's `scoresAs` folds into the
    //    standard answer set: `styleLine` feeds scoreStyleLine, and it also
    //    supplies the `style` value the dropped question no longer collects —
    //    which is exactly how `style` survives as signal without its own screen.
    questions: {
      drop: ['mileage', 'style'],
      add: [
        {
          id: 'doors',
          title: 'THREE DOORS OR FIVE?',
          help: 'Three is the icon. Five makes the back seats an easy in-and-out.',
          insertAfter: 'bodyStyles',
          // Only meaningful once they're open to a Hatch — the only MINI sold in
          // both counts. Mirrored client-side by SHOW_IF.doors in quiz-meta.js.
          showIf: (a) => {
            const b = a.bodyStyles;
            const picks = Array.isArray(b) ? b : (b != null ? [b] : []);
            return picks.length === 0 || picks.some((v) => v === 'hatchback' || v === 'any');
          },
          options: [
            { value: '3', label: 'Three doors', sub: 'The classic silhouette' },
            { value: '5', label: 'Five doors', sub: 'Easier in the back' },
            { value: 'either', label: 'Either’s fine', sub: 'No strong feelings' },
          ],
        },
        {
          id: 'miniVibe',
          title: 'WHICH MINI ARE YOU?',
          help: 'Sets the trim character we lean towards. Pick the one that’s most you.',
          insertAfter: 'people',
          options: [
            {
              value: 'classic',
              label: 'Classic',
              sub: 'Timeless, pared-back, the icon',
              scoresAs: { styleLine: 'classic', style: '2', priorities: ['image'] },
            },
            {
              value: 'exclusive',
              label: 'Exclusive',
              sub: 'Plush, polished, a little fancy',
              scoresAs: { styleLine: 'exclusive', style: '3', priorities: ['comfort'] },
            },
            {
              value: 'sport',
              label: 'Sport',
              sub: 'Stripes, spoilers, go-kart energy (JCW when you mean it)',
              scoresAs: { styleLine: 'sport', style: '5', priorities: ['performance'] },
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
