/*
 * Quiz definition. Each question: id, title, help?, multi?, type ('slider' → a number,
 * else an option list), showIf?, options. Adding a question here means teaching engine.js about its id.
 */

import { brandConfig } from './brands.js';

export const QUESTIONS = [
  {
    id: 'budget',
    title: 'What’s your budget?',
    help: 'Rough on the road price. We’ll flag anything that’s a slight stretch.',
    // A dual-thumb range: the answer is a [min, max] pair. The engine still understands a bare
    // number (→ [0, n]) and legacy b1–b5 band keys (budgetRange in engine.js), so old links keep working.
    type: 'slider',
    range: true,
    min: 0,
    max: 150000,
    step: 1000,
    format: 'gbp',
    plusAtMax: true,
    default: [40000, 75000],
  },
  {
    id: 'bodyStyles',
    title: 'Any body styles you’re drawn to?',
    help: 'Pick as many as you like or keep an open mind.',
    multi: true,
    // `brands` limits an option to specific brands; absent means all CAR brands (MINI sells no
    // saloons/coupés/MPVs). Motorrad supplies its own category options below; `any` shows for all.
    options: [
      { value: 'hatchback', label: 'Hatchback', brands: ['bmw', 'mini', 'honda', 'ford'] },
      { value: 'saloon', label: 'Saloon', brands: ['bmw'] },
      { value: 'estate', label: 'Estate or Touring', brands: ['bmw', 'mini', 'honda', 'ford'] },
      // Ferrari's stock is coupé / convertible / one SUV (Purosangue), so it takes
      // those three car bodies and none of the mainstream ones.
      { value: 'suv', label: 'SUV', brands: ['bmw', 'mini', 'honda', 'ford', 'ferrari'] },
      { value: 'coupe', label: 'Coupé', brands: ['bmw', 'ferrari'] },
      { value: 'convertible', label: 'Convertible', brands: ['bmw', 'mini', 'ford', 'ferrari'] },
      { value: 'mpv', label: 'Family carrier', brands: ['bmw'] },
      // Bike categories — Motorrad only. Each value matches a `body` the Motorrad
      // mapper emits (mapMotorradRaw), so the engine's body scorer works unchanged.
      { value: 'adventure', label: 'Adventure / GS', sub: 'Go-anywhere, upright', brands: ['motorrad'] },
      { value: 'tourer', label: 'Tourer', sub: 'Distance and comfort', brands: ['motorrad'] },
      { value: 'sport', label: 'Sport', sub: 'Fast and focused', brands: ['motorrad'] },
      { value: 'roadster', label: 'Roadster', sub: 'Naked, everyday', brands: ['motorrad'] },
      { value: 'naked', label: 'Naked', sub: 'Stripped-back street bike', brands: ['motorrad'] },
      { value: 'heritage', label: 'Heritage', sub: 'Classic boxer character', brands: ['motorrad'] },
      { value: 'scooter', label: 'Scooter / maxi-scooter', sub: 'Twist-and-go, petrol or electric', brands: ['motorrad'] },
      { value: 'any', label: 'No preference', sub: 'Open to any style' },
    ],
  },
  {
    id: 'fuel',
    title: 'What fuel types suit you?',
    help: 'Pick as many as you like, or let us help you decide.',
    multi: true,
    // `phev` is gated to the car brands: Motorrad sells petrol bikes plus electric scooters,
    // no plug-in hybrid. `petrol`, `ev` and `open` carry no `brands` marker, so they show for all.
    options: [
      { value: 'petrol', label: 'Petrol' },
      { value: 'diesel', label: 'Diesel', sub: 'Higher miles, more torque', brands: ['bmw'] },
      { value: 'phev', label: 'Plug-in hybrid', sub: 'Electric and petrol combined', brands: ['bmw', 'mini', 'honda', 'ford', 'ferrari'] },
      { value: 'ev', label: 'Fully electric' },
      { value: 'open', label: 'Help me decide', sub: 'Open to any fuel type' },
    ],
  },
  {
    id: 'charging',
    title: 'Could you charge a car at home or work?',
    help: 'A driveway socket or workplace charger changes the electric maths.',
    // fuel is multi-select (array), so test membership: show charging if the picks include
    // ev/phev/open, or if fuel is unanswered. Mirror of SHOW_IF.charging in quiz-meta.js.
    showIf: (a) => {
      const f = a.fuel;
      const picks = Array.isArray(f) ? f : (f != null ? [f] : []);
      return picks.length === 0 || picks.some((v) => v === 'ev' || v === 'phev' || v === 'open');
    },
    options: [
      { value: 'either', label: 'Yes, at home or at work' },
      { value: 'home', label: 'Yes, at home' },
      { value: 'work', label: 'Yes, at work' },
      { value: 'none', label: 'No, I’d rely on public chargers' },
    ],
  },
  {
    id: 'primaryUse',
    title: 'What will this car mostly do?',
    options: [
      { value: 'city', label: 'City driving', sub: 'Short trips, tight parking' },
      { value: 'commute', label: 'The daily commute' },
      { value: 'family', label: 'Family duties', sub: 'School runs and clubs' },
      { value: 'roadtrips', label: 'Long motorway trips' },
      { value: 'fun', label: 'Weekend driving', sub: 'For the enjoyment of it' },
    ],
  },
  {
    id: 'people',
    title: 'Who’s usually on board?',
    options: [
      { value: 'solo', label: 'Just me (plus the odd passenger)' },
      { value: 'family', label: 'A small family', sub: 'Child seats included' },
      { value: 'crew', label: 'A full crew', sub: 'Five or more seats, regularly' },
    ],
  },
  /*
   * There is no boot-space question — cut after the stock audit found it rarely changed the top 3.
   * The engine still derives small/medium/big need from `people`+`primaryUse` (bootNeedKey in engine.js).
   */
  {
    id: 'mileage',
    title: 'How many miles a year?',
    help: 'Roughly, it helps us weigh fuel type and running costs.',
    // Annual mileage as a number. Feeds the economy dimension + its weight via a 0..1 ramp
    // (mileageFraction in engine.js): the more you drive, the more running costs matter.
    type: 'slider',
    min: 1000,
    max: 25000,
    step: 1000,
    format: 'int',
    unit: ' miles',
    plusAtMax: true,
    default: 10000,
  },
  {
    id: 'style',
    title: 'Comfort or sportiness?',
    help: 'Where do you sit between the two?',
    options: [
      { value: '1', label: 'All about comfort' },
      { value: '2', label: 'Mostly comfort' },
      { value: '3', label: 'A bit of both' },
      { value: '4', label: 'Mostly sporty' },
      { value: '5', label: 'Maximum sportiness' },
    ],
  },
  {
    id: 'priorities',
    title: 'Finally, pick your top two priorities.',
    multi: true,
    max: 2,
    options: [
      { value: 'economy', label: 'Running costs' },
      { value: 'performance', label: 'Performance' },
      { value: 'comfort', label: 'Comfort & refinement' },
      { value: 'tech', label: 'Tech & gadgets' },
      { value: 'image', label: 'Style & image' },
    ],
  },
];

/** Budget bands → [min, max] GBP. */
export const BUDGET_BANDS = {
  b1: [0, 35000],
  b2: [35000, 50000],
  b3: [50000, 70000],
  b4: [70000, 100000],
  b5: [100000, 250000],
};

/*
 * Per-brand copy overrides. Only the *words* change — question ids and option `value`s are
 * untouched, so the scoring engine is unaffected. Keyed by brand → id → { title?, help?, options? }.
 */
const BRAND_COPY = {
  motorrad: {
    // Bike-native voice. Motorrad drops charging/people/style and adds ridingStyle + licence
    // (copy in brands.js). Re-voices the kept questions so a rider never reads a car word; ids/values untouched.
    budget: {
      title: 'What’s your budget?',
      help: 'Rough ride-away price. We’ll flag anything that’s a slight stretch.',
    },
    bodyStyles: {
      title: 'What kind of riding calls to you?',
      help: 'Pick as many as you like, or keep an open mind.',
    },
    fuel: {
      title: 'Petrol or electric?',
      help: 'Most of the range is petrol; the CE electric scooters are fully electric.',
      options: {
        petrol: { label: 'Petrol' },
        ev: { label: 'Fully electric', sub: 'Silent, instant torque' },
        open: { label: 'Help me decide', sub: 'Open to either' },
      },
    },
    primaryUse: {
      title: 'What will this bike mostly do?',
      options: {
        city: { label: 'City riding', sub: 'Short hops, filtering, easy parking' },
        commute: { label: 'The daily commute' },
        family: { label: 'Two-up touring', sub: 'You and a pillion, regularly' },
        roadtrips: { label: 'Long-distance touring' },
        fun: { label: 'Weekend blasts', sub: 'For the joy of the road' },
      },
    },
    mileage: {
      title: 'How many miles a year?',
      help: 'Roughly. It helps us weigh fuel type and running costs.',
    },
    priorities: {
      title: 'Finally, pick your top two priorities.',
      options: {
        economy: { label: 'Running costs' },
        performance: { label: 'Performance' },
        comfort: { label: 'Comfort over distance' },
        tech: { label: 'Tech & electronics' },
        image: { label: 'Style & character' },
      },
    },
  },
  ferrari: {
    // Ferrari voice: Italian, romantic, heritage-proud, addressed to a Ferrarista. Leads on
    // emotion and driving joy, not value or spec. Charging is dropped; ids and option values are untouched.
    budget: {
      title: 'Where shall we set the budget?',
      help: 'A rough figure to aim at. We’ll gently flag anything that’s a reach.',
    },
    bodyStyles: {
      title: 'Which shape stirs you?',
      help: 'Choose as many as you like, or leave it to us.',
      options: {
        coupe: { label: 'Coupé', sub: 'The classic berlinetta silhouette' },
        convertible: { label: 'Spider', sub: 'Roof down, the road open' },
        suv: { label: 'Purosangue', sub: 'Four seats, four doors, thoroughbred' },
        any: { label: 'Surprise me', sub: 'Open to any shape' },
      },
    },
    fuel: {
      title: 'How would you like it powered?',
      help: 'The range runs on petrol, with plug-in hybrids joining the bloodline.',
      options: {
        petrol: { label: 'Petrol', sub: 'The full-blooded V8, V12 and V6' },
        phev: { label: 'Plug-in hybrid', sub: 'Electrified power, as on the 296 and SF90' },
        open: { label: 'Help me decide', sub: 'Open to either' },
      },
    },
    primaryUse: {
      title: 'How will you use it?',
      options: {
        city: { label: 'Around the city', sub: 'Seen and savoured' },
        commute: { label: 'The everyday drive' },
        family: { label: 'The family thoroughbred', sub: 'Days out, in style' },
        roadtrips: { label: 'Grand tours', sub: 'Long roads, open country' },
        fun: { label: 'For the pure joy of it', sub: 'Weekends and favourite roads' },
      },
    },
    people: {
      title: 'Who rides with you?',
      options: {
        solo: { label: 'Just me (and the odd passenger)' },
        family: { label: 'Two of us, and then some', sub: 'A 2+ or four-seat cabin' },
        crew: { label: 'The whole family', sub: 'Four seats, regularly' },
      },
    },
    mileage: {
      title: 'How far will you drive it a year?',
      help: 'Roughly. It helps us weigh how the car will be lived with.',
    },
    style: {
      title: 'How do you like to drive?',
      help: 'From a composed grand tourer to the sharpest thoroughbred.',
      options: {
        1: { label: 'Composed and refined' },
        2: { label: 'Leaning refined' },
        3: { label: 'A bit of both' },
        4: { label: 'Leaning sporting' },
        5: { label: 'The sharpest edge' },
      },
    },
    priorities: {
      title: 'Finally, choose your top two.',
      options: {
        economy: { label: 'Running costs' },
        performance: { label: 'Performance' },
        comfort: { label: 'Comfort on the road' },
        tech: { label: 'Technology' },
        image: { label: 'Presence and style' },
      },
    },
  },
  mini: {
    budget: {
      title: 'WHAT’S THE BUDGET?',
      help: 'A rough on-the-road figure. We’ll flag anything that’s a slight stretch.',
    },
    bodyStyles: {
      title: 'WHICH SHAPE SPEAKS TO YOU?',
      help: 'Pick as many as you fancy, or keep an open mind.',
      options: {
        hatchback: { label: 'The classic hatch' },
        estate: { label: 'Clubman estate' },
        suv: { label: 'Countryman crossover' },
        convertible: { label: 'Roof-down convertible' },
        any: { label: 'Surprise me', sub: 'Open to any shape' },
      },
    },
    fuel: {
      title: 'HOW DO YOU WANT TO BE POWERED?',
      help: 'Pick as many as you like, or let us point you the right way.',
      options: {
        petrol: { label: 'Classic petrol' },
        phev: { label: 'Plug-in hybrid', sub: 'Electric zip plus petrol range' },
        ev: { label: 'Fully electric', sub: 'Silent, instant go-kart torque' },
        open: { label: 'Help me decide', sub: 'Open to anything' },
      },
    },
    charging: {
      title: 'COULD YOU PLUG IN AT HOME OR WORK?',
      help: 'A driveway socket or a charger at work changes the electric maths.',
      options: {
        either: { label: 'Yep, home or work' },
        home: { label: 'Yep, at home' },
        work: { label: 'Yep, at work' },
        none: { label: 'Nope, public chargers only' },
      },
    },
    primaryUse: {
      title: 'WHERE WILL IT LIVE?',
      options: {
        city: { label: 'Nipping round town', sub: 'Short hops, tight parking' },
        commute: { label: 'The daily dash' },
        family: { label: 'Family runs', sub: 'School runs and clubs' },
        roadtrips: { label: 'Longer adventures', sub: 'Motorways and mountain peaks' },
        fun: { label: 'Weekend fun', sub: 'Go-kart grins on your favourite B-road' },
      },
    },
    people: {
      title: 'WHO’S ALONG FOR THE RIDE?',
      options: {
        solo: { label: 'Just me (and the odd passenger)' },
        family: { label: 'A small crew', sub: 'Child seats included' },
        crew: { label: 'A full house', sub: 'Five seats, regularly' },
      },
    },
    mileage: {
      title: 'HOW FAR DO YOU ROAM?',
      help: 'Roughly, per year. It helps us weigh up fuel and running costs.',
    },
    style: {
      title: 'HOW DO YOU LIKE TO DRIVE?',
      help: 'Somewhere between comfy cruiser and full go-kart?',
      options: {
        1: { label: 'Comfy and calm' },
        2: { label: 'Leaning comfy' },
        3: { label: 'A bit of both' },
        4: { label: 'Leaning sporty' },
        5: { label: 'Full go-kart' },
      },
    },
    priorities: {
      title: 'LAST ONE. PICK YOUR TOP TWO.',
      options: {
        economy: { label: 'Cheap to run' },
        performance: { label: 'Go-kart thrills' },
        comfort: { label: 'Comfort & calm' },
        tech: { label: 'Tech & toys' },
        image: { label: 'Looks & character' },
      },
    },
  },
};

/**
 * The quiz for a given brand: the shared set with per-brand tweaks — option `brands`
 * restrictions (marker stripped), budget bounds from the registry, and BRAND_COPY text. The engine is unaffected.
 */
export function questionsForBrand(brand = 'bmw') {
  const { budget, questions: brandQuestions } = brandConfig(brand);
  const copy = BRAND_COPY[brand] || {};
  const drop = new Set(brandQuestions?.drop || []);

  const base = QUESTIONS
    .filter((q) => !drop.has(q.id))
    .map((q) => {
      const c = copy[q.id] || {};
      // Base fields, then brand copy for title/help.
      const out = { ...q };
      if (c.title) out.title = c.title;
      if (c.help) out.help = c.help;
      // Budget slider bounds from the registry (only the fields it specifies).
      if (q.id === 'budget' && budget) Object.assign(out, budget);
      // Options: drop brand-excluded ones, strip the `brands` marker, and apply
      // any per-option label/sub overrides.
      if (q.options) {
        out.options = q.options
          .filter((o) => !o.brands || o.brands.includes(brand))
          .map(({ brands, ...rest }) => {
            const oc = c.options?.[rest.value];
            return oc ? { ...rest, ...oc } : rest;
          });
      }
      return out;
    });

  // Splice in any bespoke per-brand questions at their requested position. `scoresAs` is
  // engine-internal (see applyBespokeAnswers) and is stripped so it never crosses to the client.
  for (const add of brandQuestions?.add || []) {
    const clean = {
      ...add,
      options: (add.options || []).map(({ scoresAs, ...rest }) => rest),
    };
    delete clean.insertAfter;
    const at = add.insertAfter
      ? base.findIndex((q) => q.id === add.insertAfter)
      : -1;
    if (at >= 0) base.splice(at + 1, 0, clean);
    else base.push(clean);
  }
  return base;
}

/**
 * Fold a brand's bespoke-question answers into the standard answer fields the engine scores, via
 * each option's `scoresAs`. Arrays are unioned; scalars only fill a gap the user left blank (explicit wins).
 */
export function applyBespokeAnswers(brand, answers) {
  const adds = brandConfig(brand).questions?.add || [];
  if (!adds.length) return answers;
  const merged = { ...answers };
  for (const q of adds) {
    const picked = merged[q.id];
    if (picked == null) continue;
    const values = Array.isArray(picked) ? picked : [picked];
    for (const v of values) {
      const opt = (q.options || []).find((o) => o.value === v);
      const contrib = opt?.scoresAs;
      if (!contrib) continue;
      for (const [field, val] of Object.entries(contrib)) {
        if (Array.isArray(val)) {
          const existing = Array.isArray(merged[field]) ? merged[field] : [];
          merged[field] = [...new Set([...existing, ...val])];
        } else if (merged[field] == null) {
          merged[field] = val; // scalar: only fill a blank, never override
        }
      }
    }
  }
  return merged;
}
