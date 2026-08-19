/*
 * Brand registry: the per-brand facts (origin, defaultRetailer, label) for brands
 * sharing one Auto Trader/Django platform. The vehicle→spec mapping lives in mapping.js.
 */

/*
 * Per-brand calibration constants read by the scorers (server/engine.js). BMW_TUNING is
 * the engine's original hardcoded values (BMW unchanged); other brands override the rest.
 * Field → scorer:
 *   weights/priorityBoosts/stretchFactor → orchestration (effectiveWeights, passesHardFilters)
 *   performance.{zeroBase,span} → scorePerformance's (zeroBase - 0-62s)/span curve
 *   practicality.{bootNeed,seatsFloor,crewSeats,crewBonusSeats} → scorePracticality
 *   size.{roadtripMinClass,cityDivisor} → scoreSize
 *   hardFilter.{crewBoot,crewSeats,familySeats} → passesHardFilters (HARD exclusion)
 *   mileage.{lowMiles,highMiles} → annual-mileage ramp (scoreEconomy/effectiveWeights)
 */
const BMW_TUNING = {
  weights: {
    // Body at 4.5 (was 2.5) — see the body block below for why.
    budget: 3.0, body: 4.5, fuel: 2.5, practicality: 2.0,
    performance: 1.5, economy: 1.5, size: 1.0, character: 2.0,
  },
  /*
   * Body-match scores (neutral = no preference, miss = wrong shape). Weight 4.5 / miss 0
   * chosen by a sweep: a wrong shape scores nothing yet still surfaces when no right one fits.
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
  // Added to the fuel weight when the user names specific fuel(s), so fuel binds hard:
  // at base 2.5 fuel is only ~14% of the blend and a wrong-fuel car can top a match.
  fuelStrictBoost: 4.0,
  // 0-62 curve: (zeroBase - t) / span, clamped 0..1. BMW: 10.5s→0, 4.5s→1.
  performance: { zeroBase: 10.5, span: 6 },
  practicality: {
    bootNeed: { small: 0, medium: 400, big: 500 },
    seatsFloor: 5, // below this (unless solo) → *0.3
    crewBonusSeats: 7, // 7+ seats for a crew → perfect
  },
  // A "crew" buyer really wants a 7-seater: a car below crewBonusSeats has its final
  // blended score multiplied by this (in rankCars). Stock-safe, not a hard filter.
  crewSeatShortfall: 0.7,
  size: { roadtripMinClass: 3, cityDivisor: 5 },
  hardFilter: { crewBoot: 430, crewSeats: 5, familySeats: 4 },
  // Annual-mileage ramp: miles at/under lowMiles → 0, at/over highMiles → 1.
  mileage: { lowMiles: 4000, highMiles: 20000 },
  /*
   * Reason strings whose REGISTER differs between brands (BMW is the base, others
   * override keys). `tags` merges key-by-key in engine.js, not via mergeTuning's shallow merge.
   */
  reasons: {
    boot: (car) => `${car.boot} litres of boot with all ${car.seats} seats up`,
    // Fires between 90% and 100% of the space the answers imply, and says so: a reason
    // that admits it's only just enough is the opposite of brochure copy.
    bootTight: (car) => `${car.boot} litres of boot with the seats up, which is `
      + 'enough for what you described rather than generous',
    crew: (car) => `${car.seats} seats, and ${car.boot} litres behind them`,
    roadtrip: () => 'Big enough to be comfortable on a long motorway run',
    city: () => 'Compact enough for city streets and tight parking',
    /*
     * Character (taste) tags. Rewritten from unfalsifiable adjectives to state a basis;
     * the practicality ones point at printed figures. Only hits[0] ever reaches a card.
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

// MINI overrides: recalibrated so a well-matched MINI reaches the same 85–95% a BMW
// does, scored against MINI's own class. A listed weight replaces only that dimension.
const MINI_TUNING = {
  weights: {
    // MINI's heaviest soft dimension. Weight 6.0 + body.miss 0 stops a wrong-shape car
    // (thin, EV-heavy stock) topping a search; it still surfaces when no right shape fits.
    body: 6.0,
    // MINI-only dimensions BMW leaves unweighted, so they no-op for BMW. styleLine is
    // trim-character (near-character weight); doors a lighter, Hatch-only use-case lean.
    styleLine: 2.5,
    doors: 1.5,
  },
  // Trim-character scores (scoreStyleLine), same shape as body but miss stays off the
  // floor: trim is a lean, not a hard requirement like shape.
  styleLine: { match: 1, neutral: 0.7, miss: 0.25 },
  // Door-count scores (scoreDoors). Gentler miss than styleLine: a 5-door when you
  // wanted 3 is a mild mismatch, not a character clash.
  doors: { match: 1, neutral: 0.7, miss: 0.4 },
  // Matches the BMW base's miss 0 (currently redundant), but kept stated so MINI's
  // deliberate body calibration can't silently follow a softened base.
  body: { match: 1, neutral: 0.7, miss: 0 },
  // 0-62: MINI range ~6.0s (JCW) to ~8.5s. (11 - t)/5.5 → JCW ~0.9, brisk 7.7s
  // Cooper ~0.6 (BMW's curve gives that car only 0.47).
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
   * Only the lines whose TEMPERATURE differs: MINI smiles, "go-kart" its sanctioned
   * emotion. Numbers/honesty identical; `tags` merges key-by-key, so unlisted keep BMW's.
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

/*
 * Honda overrides: mainstream, value-led range with no performance halo, so it leans
 * OPPOSITE BMW — economy/practicality up, performance/character down, softer 0-62 curve.
 */
const HONDA_TUNING = {
  weights: {
    // Economy + practicality up, performance + character down vs BMW: a Honda buyer
    // chooses on running cost and usable space, not kerb appeal.
    budget: 3.0, body: 4.5, fuel: 2.5, practicality: 2.5,
    performance: 1.0, economy: 2.5, size: 1.0, character: 1.5,
  },
  // Priorities skew to why a Honda gets bought: running cost and space. Performance/
  // image still resolve (a Civic can be the "sportier" pick) but lean lighter than BMW's.
  priorityBoosts: {
    economy: { economy: 2.0, budget: 0.5 },
    performance: { performance: 1.2, character: 0.3 },
    comfort: { character: 0.8, size: 0.5 },
    tech: { character: 0.8 },
    image: { character: 0.8 },
  },
  // 0-62 recentred for a slow-by-BMW range (else all read sluggish): 12.5s→0, 6.5s→1
  // → 7.8s Civic ~0.78 (brisk for a Honda), 10.6s HR-V ~0.32, the honest spread.
  performance: { zeroBase: 12.5, span: 6 },
  practicality: {
    // Honda boots run small-to-mid (Jazz 304L, CR-V 587L). "big" scaled below BMW's
    // 500 so a CR-V clears it and a Jazz isn't crushed; still above MINI's floors.
    bootNeed: { small: 0, medium: 300, big: 450 },
    seatsFloor: 5, // all Hondas here are 5-seat bar the 4-seat e
    crewBonusSeats: 5, // no 7-seaters in this pool; 5 is a full house
  },
  // No 7-seat Honda in the pool, so don't shrink a car's score for lacking the
  // 7th seat a "crew" buyer ideally wants — 5 seats is the most Honda offers.
  crewSeatShortfall: 1,
  // A CR-V/ZR-V (class 3) is the big end for road trips; the range has nothing
  // larger, so don't demand a class the stock can't supply.
  size: { roadtripMinClass: 3, cityDivisor: 5 },
  // Don't hard-exclude small-booted Hondas from family/crew: a 319L HR-V should
  // survive "family", the 4-seat e shouldn't be filtered out. Floors below real figures.
  hardFilter: { crewBoot: 300, crewSeats: 5, familySeats: 4 },
  /*
   * Only reason strings whose REGISTER is Honda's: plain, practical, unshowy (cost,
   * space, reliability). Numbers/honesty identical; `tags` merges key-by-key in engine.js.
   */
  reasons: {
    roadtrip: () => 'Roomy and settled enough for a long motorway run',
    city: () => 'Easy to place and park on a tight street',
    tags: {
      'drivers-car': 'The sharper-driving end of the Honda range',
      family: 'A family shape, and the seats and boot above are the size of it',
      urban: 'Small and light for town, easy to park and cheap to run',
      efficient: 'The self-charging hybrid does the work; low running cost',
      tech: 'The current cabin and driver aids, not the outgoing ones',
      practical: 'Built around usable space first, as the boot figure shows',
    },
  },
};

/*
 * Ford overrides. Broadest range of the four, with a real performance halo (ST, Mustang),
 * so it sits BETWEEN BMW and Honda: value-leaning but halo cars still read as exciting.
 */
const FORD_TUNING = {
  weights: {
    // Between BMW (image-first) and Honda (economy-first): economy/practicality lifted
    // over BMW, but performance/character stay meaningful so ST/Mustang aren't flattened.
    budget: 3.0, body: 4.5, fuel: 2.5, practicality: 2.2,
    performance: 1.3, economy: 2.0, size: 1.0, character: 1.8,
  },
  // An economy buyer is well served, but a performance buyer must still find the
  // ST/Mustang, so the performance boost stays closer to BMW's than Honda's.
  priorityBoosts: {
    economy: { economy: 1.8, budget: 0.5 },
    performance: { performance: 1.6, character: 0.4 },
    comfort: { character: 0.9, size: 0.5 },
    tech: { character: 0.9 },
    image: { character: 0.9 },
  },
  // 0-62 wide enough for the real spread (~12s EcoSport to ~4.5s Mustang), close to
  // BMW's curve; zeroBase nudged up so a mainstream 9-10s Ford isn't read as sluggish.
  performance: { zeroBase: 11.5, span: 7 },
  practicality: {
    // Ford boots run small (Fiesta 292L) to large (Kuga 475L, Galaxy/S-Max
    // huge). Mid-scale the "big" need between BMW's 500 and Honda's 450.
    bootNeed: { small: 0, medium: 300, big: 470 },
    seatsFloor: 5, // most Fords are 5-seat; MPVs add two, the Mustang has 4
    crewBonusSeats: 7, // Ford DOES sell 7-seat MPVs (Galaxy, S-Max, Grand Tourneo)
  },
  // Ford has genuine 7-seaters, so keep BMW's crew behaviour (reward the 7th seat,
  // gently mark down without it). crewSeatShortfall inherits BMW's base.

  // Road trips want a mid-size+ car; the range has large SUVs and MPVs, so keep
  // BMW's class-4 floor rather than lowering it as Honda did.
  size: { roadtripMinClass: 4, cityDivisor: 5 },
  // Don't hard-exclude Ford's smaller cars from family (a Focus is a family hatch),
  // but keep crew floors near BMW's — Ford has proper 7-seaters and big boots.
  hardFilter: { crewBoot: 400, crewSeats: 5, familySeats: 4 },
  /*
   * Only reason strings whose REGISTER is Ford's: friendly, confident, plainly practical
   * with a little spirit. Numbers/honesty identical; `tags` merges key-by-key.
   */
  reasons: {
    roadtrip: () => 'Roomy and settled enough for a proper long-distance run',
    city: () => 'Compact and easy to park on a tight street',
    tags: {
      'drivers-car': 'The genuinely fun end of the range, an ST or a Mustang',
      family: 'A real family shape, with the seats and boot to back it up',
      urban: 'Small and light for town, easy to park and cheap to run',
      efficient: 'Low running costs, whether that is the mild hybrid or the EV',
      tech: 'The current cabin and driver aids, not the outgoing ones',
      practical: 'Built around usable space first, as the boot figure shows',
      cruiser: 'The comfortable, settled end of the range for covering miles',
    },
  },
};

/*
 * Motorrad overrides — the recalibration that makes a CAR engine rank BIKES sensibly.
 * Bikes live on different scales, so the axes must be re-pointed (see the DECISIONS.md map).
 */
const MOTORRAD_TUNING = {
  weights: {
    // Category (body) is how a rider shops first, so it stays dominant. Performance/
    // character up (BMW's sporting arm), economy/fuel down (bikes are all frugal, near-all petrol).
    budget: 3.0, body: 4.5, fuel: 1.0, practicality: 1.8,
    performance: 2.2, economy: 1.0, size: 1.4, character: 2.4,
  },
  priorityBoosts: {
    economy: { economy: 1.4, budget: 0.5 },
    performance: { performance: 1.8, character: 0.6 },
    comfort: { character: 1.0, size: 0.6 }, // a tourer's comfort reads through category + size
    tech: { character: 0.9 },
    image: { character: 1.0 },
  },
  // THE critical recalibration: on BMW's car curve every bike pegs at 1.0 (no signal).
  // Re-pointed to the bike range (~2.8-7.7s): G 310 near the bottom, M 1000 RR at the top.
  performance: { zeroBase: 8.0, span: 5.2 },
  practicality: {
    // "boot" is luggage litres here: 0 (sportbike) to ~110 (K 1600 tourer). Need scale
    // matched to that: medium=30 (a top box), big=80 (full touring luggage).
    bootNeed: { small: 0, medium: 30, big: 80 },
    // A bike carries at most a pillion: floor at 1 so no bike is marked down for
    // seats, and the crew bonus is unreachable.
    seatsFloor: 1,
    crewBonusSeats: 99,
  },
  // Road trips want a big-capacity tourer/adventure (size band 4+); town riding
  // wants a low band. cityDivisor 5 keeps the small-bike bonus gentle.
  size: { roadtripMinClass: 4, cityDivisor: 5 },
  // Never hard-exclude a bike for "seats"/"boot": drop the crew/family gates to zero
  // so the car-oriented hard filters can't wipe the deck (a bike has 1-2 seats).
  hardFilter: { crewBoot: 0, crewSeats: 1, familySeats: 1 },
  /*
   * Reasons in a rider's register: "ride" not "drive", capability not doors/boots.
   * Numbers/honesty match the base; only the voice changes.
   */
  reasons: {
    roadtrip: () => 'Built to cover big miles two-up, with the luggage to match',
    city: () => 'Light and low enough to be easy through town and traffic',
    tags: {
      adventure: 'A go-anywhere GS, as happy on a green lane as a motorway',
      touring: 'Set up for distance, with wind protection and luggage',
      sporty: 'The sharp end of the range, track-bred and seriously quick',
      commuter: 'An easy, upright everyday ride for the daily run',
      heritage: 'Classic BMW boxer character with modern underpinnings',
      electric: 'Silent, twist-and-go electric power for the city',
      'a2-friendly': 'A2-licence friendly, an ideal step up for newer riders',
    },
  },
};

/*
 * Ferrari overrides — mirror of the mainstream brands: economy/practicality fall back,
 * drive/character/shape lead. Load-bearing recalibrations: 0-62 curve and seat/boot floors.
 */
const FERRARI_TUNING = {
  weights: {
    // Character/performance lead (what a buyer chooses between); body stays high.
    // Economy near-dead and fuel light; budget stays meaningful (pool runs £90k-£3.3m).
    budget: 3.0, body: 4.5, fuel: 1.0, practicality: 1.2,
    performance: 2.6, economy: 0.6, size: 1.0, character: 2.6,
  },
  priorityBoosts: {
    // Performance-first buyer is the default, so the boost is the strongest of any
    // brand. Economy barely matters; comfort/image lean on character.
    economy: { economy: 1.0, budget: 0.5 },
    performance: { performance: 2.0, character: 0.7 },
    comfort: { character: 1.1, size: 0.5 },
    tech: { character: 1.0 },
    image: { character: 1.2 },
  },
  // THE critical recalibration: on BMW's curve every modern Ferrari pegs at 1.0.
  // Re-pointed to the pool's range (6.0s->0, 2.5s->1): a 275 GTB low, an SF90 at the top.
  performance: { zeroBase: 6.0, span: 3.5 },
  practicality: {
    // "boot" here is usable luggage: 74L (SF90) to 473L (Purosangue). Need scale matched
    // so a Purosangue/GT satisfies "big" and a mid-engined two-seater isn't crushed.
    bootNeed: { small: 0, medium: 200, big: 400 },
    // Most Ferraris are two-seaters: floor at 2 so a two-seater is a "full house",
    // and the 2+2s/Purosangue read as the roomy end (crew bonus unreachable).
    seatsFloor: 2,
    crewBonusSeats: 99,
  },
  // A "road trip" Ferrari is a front-engined GT or Purosangue (band 3+); mid-engined
  // cars are class 2. cityDivisor stays gentle (a compact 458/488 is the closest).
  size: { roadtripMinClass: 3, cityDivisor: 5 },
  // Never hard-exclude a Ferrari for "seats"/"boot": drop the crew/family gates so
  // the car hard filters can't wipe the deck (a two-seat mid-engined car is the norm).
  hardFilter: { crewBoot: 0, crewSeats: 2, familySeats: 2 },
  /*
   * Reasons in Ferrari's register: spare, exact, emotional only where earned.
   * Numbers/honesty match the base; `tags` merges key-by-key, unlisted keep BMW's.
   */
  reasons: {
    roadtrip: () => 'A front-engined grand tourer, built to devour a continent',
    city: () => 'Compact for what it is, and usable enough for real roads',
    tags: {
      'drivers-car': 'Bred for the drive above all else, the way a Ferrari should be',
      image: 'A car that stops the street, which is rather the point of it',
      practical: 'The usable end of the range, with the seats and boot to prove it',
      family: 'Four real seats, the rarest thing a Ferrari can offer',
      lifestyle: 'Roof down, the engine behind you, the best seat in the house',
      efficient: 'The plug-in hybrid drivetrain, silent to the end of the drive',
      tech: 'The current hybrid-era car, not the outgoing one',
      collectable: 'A modern classic, the kind values tend to follow',
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
    // Where stock comes from. 'feed' = live Auto Trader/Django platform (stock.js CSRF
    // fetch); 'fixtures' = read fixtures/<brand>-cars.json, no network.
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
    // MINI used stock runs ~£10k–£40k (median ~£24.5k), so a £150k slider bunches both
    // thumbs left. Cap at £50k with a default bracket around the median.
    budget: { max: 50000, default: [15000, 30000] },
    tuning: mergeTuning(MINI_TUNING),
    // Per-brand question surgery: lets MINI's set diverge from the shared pool without
    // engine changes (docs/mini-first-questions.md). drop = near-dead; add = MINI-native.
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
  honda: {
    label: 'Honda',
    // Public used-car site (PDP links + origin fallback). Honda's approved-used stock
    // is one national programme, so there's no per-retailer origin to switch between.
    origin: 'https://usedcars.honda.co.uk',
    // Synthetic single-retailer id (matches HONDA_RETAILER_ID in mapping.js) so a
    // retailer-scoped request still resolves to the full pool. The pool is one programme.
    defaultRetailer: 'honda-approved',
    // No clean feed API, but server-rendered pages are fetchable, so Honda runs live
    // (stock.js → honda-listing.js/mapHondaRaw); a fetch failure is a 502, no fallback.
    source: 'live-honda',
    // Honda used stock runs ~£8.5k–£22.5k (median ~£19k), so a £150k slider bunches both
    // thumbs left. Cap at £30k with a default bracket around the median.
    budget: { max: 30000, default: [12000, 20000] },
    tuning: mergeTuning(HONDA_TUNING),
    // Single-trim-tier, fixed 5-door range, so the shared question pool fits as-is (no
    // MINI-style surgery). Add `questions: { drop, add }` here if a gap appears.
  },
  ford: {
    label: 'Ford',
    // Public used-car site (PDP links + origin fallback). Ford's approved-used is
    // national; dealers exist but the showcase treats it as one pool, like Honda.
    origin: 'https://www.ford.co.uk',
    // Synthetic single-retailer id (matches FORD_RETAILER_ID in mapping.js) so a
    // retailer-scoped request resolves to the full pool.
    defaultRetailer: 'ford-approved',
    // Ford's live feed sits behind an Akamai edge that drops the connection here
    // (HTTP 000), so it serves curated fixtures/ford-cars.json; adapter wired for later.
    source: 'fixtures',
    // Ford stock is the widest (~£5k Ka to ~£45k Explorer/Mach-E). Cap at £60k
    // (headroom for a Mustang V8), default around the volume models (~£15k–£25k).
    budget: { max: 60000, default: [12000, 25000] },
    tuning: mergeTuning(FORD_TUNING),
    // Shared question set fits as-is (Ford sells the full spread of bodies/fuels).
    // Add `questions: { drop, add }` here if a future gap appears.
  },
  motorrad: {
    label: 'BMW Motorrad',
    // The public approved-used site (PDP links + origin fallback). Motorrad
    // approved-used is a national programme, treated as one pool like Honda/Ford.
    origin: 'https://approvedused.bmw-motorrad.co.uk',
    defaultRetailer: 'motorrad-approved', // matches MOTORRAD_RETAILER_ID in mapping.js
    // Runs live: the feed is session-gated but the landing page embeds a fresh GMB-SID
    // (#hfSID), so stock.js self-issues a session and walks the ~963-bike pool via mapMotorradRaw.
    source: 'live-motorrad',
    // Bikes, not cars, so the snapshot is <brand>-bikes.json not the default -cars.json.
    // No longer a runtime fallback: it's the offline test pool, and this field locates it.
    fixturesFile: 'motorrad-bikes.json',
    // Used bikes run ~£4k (G 310) to ~£25k (K 1600 GT / M 1000 RR). Cap at £30k,
    // default around the volume midweights (F-series, R 1250 GS ~£10k-£16k).
    budget: { max: 30000, default: [7000, 16000] },
    tuning: mergeTuning(MOTORRAD_TUNING),
    /*
     * Bikes need a different question set (each added one folds to engine answers via
     * `scoresAs`, like MINI's trim): drop charging/people/style; add ridingStyle + licence.
     */
    questions: {
      drop: ['charging', 'people', 'style'],
      add: [
        {
          id: 'ridingStyle',
          title: 'What kind of riding is this for?',
          help: 'Sets the character we lean towards. Pick the one that fits best.',
          insertAfter: 'bodyStyles',
          options: [
            {
              value: 'commute',
              label: 'Commuting and everyday',
              sub: 'Town, traffic, the daily run',
              scoresAs: { primaryUse: 'city', style: '3', priorities: ['economy'] },
            },
            {
              value: 'adventure',
              label: 'Adventure and green lanes',
              sub: 'On and off the beaten track',
              // primaryUse:roadtrips (not fun): only roadtrips fires the roadtripMinClass
              // bonus + non-zero boot need that surface the GS range; fun would bury it.
              scoresAs: { primaryUse: 'roadtrips', style: '3', priorities: ['comfort'] },
            },
            {
              value: 'touring',
              label: 'Touring and big miles',
              sub: 'Distance, two-up, with luggage',
              scoresAs: { primaryUse: 'roadtrips', style: '2', priorities: ['comfort'] },
            },
            {
              value: 'sport',
              label: 'Sport and track',
              sub: 'Sharp, fast, focused',
              scoresAs: { primaryUse: 'fun', style: '5', priorities: ['performance'] },
            },
            {
              value: 'heritage',
              label: 'Classic and heritage',
              sub: 'Timeless boxer character',
              scoresAs: { primaryUse: 'fun', style: '3', priorities: ['image'] },
            },
          ],
        },
        {
          id: 'licence',
          title: 'Which licence do you ride on?',
          help: 'We only show bikes you can ride. A2 has a power limit; full A is unrestricted.',
          insertAfter: 'ridingStyle',
          options: [
            {
              value: 'a1',
              label: 'A1',
              sub: 'Up to 125cc, learner-friendly',
              scoresAs: { priorities: ['economy'] },
            },
            {
              value: 'a2',
              label: 'A2',
              sub: 'Restricted power, stepping up',
              scoresAs: { priorities: ['economy'] },
            },
            {
              value: 'a',
              label: 'Full A',
              sub: 'No restrictions',
              scoresAs: {},
            },
          ],
        },
      ],
    },
  },
  ferrari: {
    label: 'Ferrari',
    // Public approved-used site (PDP links + origin fallback). Factory programme; the
    // feed names the real dealer per listing, but the showcase treats it as one pool.
    origin: 'https://preowned.ferrari.com',
    // Synthetic single-retailer id (matches FERRARI_RETAILER_ID in mapping.js) so a
    // retailer-scoped request resolves to the full pool.
    defaultRetailer: 'ferrari-approved',
    // Server-rendered Next.js: the result set is public JSON in __NEXT_DATA__ and the cover
    // photo a token-free Thron asset, so Ferrari runs live via mapFerrariRaw (502 on failure).
    source: 'live-ferrari',
    // Runs ~£90k (California T) to a £3.3m classic. Cap at £750k (headroom for a Pista
    // without a classic distorting the slider), default around Roma/296 (~£150k-£300k).
    budget: { max: 750000, default: [150000, 300000] },
    tuning: mergeTuning(FERRARI_TUNING),
    // Standard questions fit as-is bar ONE removal: `charging` (a running-cost lever)
    // doesn't apply to how anyone buys a plug-in-hybrid supercar. Fuel still asks for hybrids.
    questions: {
      drop: ['charging'],
    },
  },
};

/** The default brand when a request/config doesn't specify one. */
export const DEFAULT_BRAND = 'bmw';

/**
 * Normalise an arbitrary brand input to a known key, defaulting to BMW.
 * Case-insensitive so DA config and query strings are forgiving.
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
