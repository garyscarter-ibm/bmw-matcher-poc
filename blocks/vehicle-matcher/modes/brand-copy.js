/*
 * Brand voice for the card/result surfaces, shared by every mode that shows a car
 * (marque, headlines, per-brand fuel/shape words). Voices: docs/tone-style-guide.md.
 */

import { cardinal } from '../ui.js';

/** Brand-specific display copy, keyed by brand. `lede({ questions, retailer })` is a
 * function because brands phrase it differently; no match count. Voices: docs/tone-style-guide.md. */
export const BRAND_COPY = {
  bmw: {
    name: 'BMW',
    title: 'Find your perfect BMW.',
    cta: 'Find my BMW',
    // No promised count: results now show one clear winner or the whole tie
    // (up to MAX_SHOWN), so naming a number here would be wrong half the time.
    lede: ({ questions, retailer }) => `${questions} quick questions about your life, `
      + `your miles and your budget. We’ll match you with the approved-used `
      + `cars at ${retailer} that suit you best, and tell you why.`,
    // Approved Used's no-surprises register: state the fact, name the retailer,
    // don't dress it up (docs/tone-style-guide.md). No label; BMW states, not announces.
    unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
      + 'These are the closest matches to everything else you asked for.',
    // Shown instead of the "your perfect BMW is…" headline when the engine can't
    // separate the top cars (see matchCars: decisive/clusterSize). Stated plainly.
    tiedTitle: ({ count }) => `${cardinal(count)} of these fit you equally well.`,
    /*
     * Scoped headlines, used ONLY when scope is load-bearing: a car at another
     * retailer genuinely outranks the best here (docs/results-page-review.md).
     */
    tiedTitleHere: ({ count, retailer }) => `At ${retailer}, ${cardinal(count)} of these `
      + 'fit you equally well.',
    // Fit couldn't separate them, but stated preference could. Naming the pick is
    // honest, and it's what makes the preference questions able to change the pick.
    tasteTitle: ({ model }) => `Your best match is the ${model}.`,
    tasteTitleHere: ({ model, retailer }) => `Your best match at ${retailer} is the ${model}.`,
    tasteLede: () => 'Several of these suit you equally well on paper. This one lines up '
      + 'best with what you said matters.',
    // Retailer is named on every card, so the lede doesn't repeat it — and a brand
    // plural after a retailer label reads "Sytner Luton MINI MINIs", so none builds one.
    tiedLede: () => 'On your answers we can’t split them: each suits you as well as the next. '
      + 'The difference now is which you prefer the look of.',
    /*
     * The refine panel: BMW states the instruction, no cheerleading. The label names
     * the effect AND the set it acts on, fixing the "unclear what clicking them affects" report.
     */
    refineLabel: ({ count }) => (count > 1 ? `Narrow these ${count} down` : 'Narrow this one down'),
    // Feedback at the control itself, the moment a chip goes on. The running brief
    // below the cars repeats it, but by then you've stopped wondering if the tap worked.
    refineStatus: ({ shown, wants }) => (shown === 1
      ? `One car still matches, with ${wants}.`
      : `${shown} cars still match, with ${wants}.`),
    refineStatusPlain: ({ shown }) => (shown === 1
      ? 'One car still matches.'
      : `${shown} cars still match.`),
    refineEmpty: ({ wants }) => `Nothing here has ${wants} together. `
      + 'Drop one of those and we’ll show you what does.',
    refineEmptyHidden: 'That’s all of them ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'Nothing left to show.',
    // Rejection, in the retailer's plain register — a question, not a plea.
    rejectOpen: 'Not this one',
    rejectPrompt: 'What put you off?',
    rejectJust: 'Just not this one',
    pickLabel: 'Choose yours',
    kitLabel: 'What’s fitted',
    kitMore: ({ count }) => `, and ${count} more`,
    briefLabel: 'What I’ve picked up',
    hiddenChip: ({ count }) => `${count} ruled out`,
    // The "closest here" frame (docs/results-page-states.md): local cars miss
    // something asked for, so no headline crowns one; claims nothing beyond this retailer.
    closestTitle: ({ retailer }) => `The closest matches at ${retailer}.`,
    closestLede: () => 'Nothing here ticks every box you gave us. Each card says what it '
      + 'gets right, and what it doesn’t.',
    closestSettled: ({ model }) => `Your closest match here is the ${model}.`,
    closestSettledHere: ({ model, retailer }) => `Your closest match at ${retailer} is the ${model}.`,
    /*
     * One step below `closest`: not "here is the nearest" but "we haven't got it"
     * (see WEAK_SCORE). No `Here` variant: the sentence already names the retailer.
     */
    weakTitle: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for.`,
    weakLede: () => 'These are the nearest we hold, and each one misses something you '
      + 'said mattered. If none of them works, nothing here does.',
    // The rescue note: the want is missing HERE but met nearby. By owner decision
    // (2026-07-22) local cards keep the lead; nearby cars are IN the list, not a section.
    rescueNote: ({ list, retailer, miles, where }) => `No ${list} at ${retailer} right now. `
      + `The nearest is ${miles} away at ${where}, and it’s in the list below.`,
    // Only `empty` survives: state 5, where the retailer had nothing and the
    // nearby cars are the results rather than a band beneath them.
    driveLede: {
      empty: ({ retailer }) => `Nothing at ${retailer} fits those answers, so these are the `
        + 'closest matches at other retailers instead.',
    },
    /*
     * The two group labels. They describe PLACE and nothing else — the rule the old
     * banded page broke, where two sections made quality claims that could contradict.
     */
    hereHeading: ({ retailer }) => `AT ${retailer.toUpperCase()}`,
    awayHeading: 'AT OTHER RETAILERS',
    rejectHint: 'Turned down? We’ll bring the next one up.',
    // The working. A verdict with no evidence behind it reads as thin stock
    // rather than as a clear winner, especially on a page holding one card.
    searchingNearby: 'Still checking other retailers within reach',
    workingLabel: 'HOW WE GOT HERE',
    working: ({ total, eligible }) => `We went through all ${total} BMWs in stock here. `
      + `${eligible} were in budget and big enough for you.`,
    workingMargin: ({ margin }) => ` Nothing else here came within ${margin} points.`,
    // The evidence for the weak headline, and the one number on the page a
    // reader can check against the badges on the cards.
    workingWeak: ({ top }) => ` The best of them reached ${top}%.`,
    // What the badge means, said once. Unexplained since fit and taste were split,
    // and several cards sharing a number reads as a bug rather than a claim of likeness.
    workingScore: ' A match score is how well a car fits your answers, nothing else, '
      + 'so cars that suit you equally share one.',
    // The other half of a scoped headline: which car beat the one here, and where.
    // Shown exactly when the headline scopes, so the two read as one statement.
    searchedWider: ({ model, miles, where }) => 'We looked further afield too. '
      + `The ${model} at ${where} scores higher, and it’s ${miles}.`,
  },
  mini: {
    name: 'MINI',
    title: 'Find your perfect MINI.',
    cta: 'Let’s find your MINI',
    lede: ({ questions, retailer }) => `${questions} quick questions about your life, `
      + `your miles and your money. We’ll find the MINIs at ${retailer} `
      + 'with your name on them, and tell you exactly why.',
    // Same fact, MINI's register: the UPPERCASE-with-a-full-stop beat as the
    // lead-in, then warm and plain. A shortage is a shrug, never a shrug-off.
    unmetLabel: 'SMALL SNAG.',
    unmet: ({ list, retailer }) => `No ${list} at ${retailer} or anywhere nearby right now. `
      + 'Here’s the closest we’ve got to the rest of your brief.',
    // Same fact in MINI's register: a tie is a nice problem, not a shortfall.
    tiedTitle: ({ count }) => `It’s a ${cardinal(count)}-way tie.`,
    // Scoped, same rule as BMW's: only when a car elsewhere actually outranks
    // the best one here.
    tiedTitleHere: ({ count, retailer }) => `At ${retailer}, it’s a ${cardinal(count)}-way tie.`,
    tasteTitle: ({ model }) => `We’d go for the ${model}.`,
    tasteTitleHere: ({ model, retailer }) => `At ${retailer}, we’d go for the ${model}.`,
    tasteLede: () => 'A few of these fit your brief just as well. This one’s the most you.',
    tiedLede: () => 'They all fit what you told us, just as well as each other. '
      + 'So it comes down to taste now. Which is the fun bit.',
    // MINI asks rather than instructs, and treats a dead end as a shrug. Same
    // change as BMW's: the label now names what a tap does and to how many.
    refineLabel: ({ count }) => (count > 1
      ? `Fancy narrowing these ${count} down?`
      : 'Fancy narrowing this one down?'),
    refineStatus: ({ shown, wants }) => (shown === 1
      ? `One left in the running, with ${wants}.`
      : `${shown} left in the running, with ${wants}.`),
    refineStatusPlain: ({ shown }) => (shown === 1
      ? 'One left in the running.'
      : `${shown} left in the running.`),
    refineEmpty: ({ wants }) => `Ah. Nothing here has ${wants} all at once. `
      + 'Let one of them go and we’ll show you what’s left.',
    refineEmptyHidden: 'Well, that’s the lot ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'That’s the lot, then.',
    rejectOpen: 'Not this one',
    rejectPrompt: 'Go on then, what’s wrong with it?',
    rejectJust: 'Just not feeling it',
    pickLabel: 'Which one, then?',
    kitLabel: 'What’s on it',
    kitMore: ({ count }) => `, and ${count} more`,
    briefLabel: 'So, what I know so far',
    hiddenChip: ({ count }) => `${count} ruled out`,
    // The "closest here" frame, MINI register: honest shrug, no apology.
    closestTitle: ({ retailer }) => `The closest we’ve got at ${retailer}.`,
    closestLede: () => 'None of these is the whole wish list, but they’re close. '
      + 'And each one owns up to what’s missing.',
    closestSettled: ({ model }) => `Closest to your brief: the ${model}.`,
    closestSettledHere: ({ model, retailer }) => `Closest to your brief at ${retailer}: `
      + `the ${model}.`,
    // The same "we haven't got it" as BMW's, in MINI's register: a shrug that still
    // gives a straight answer and a reason to come back. See WEAK_SCORE for when it fires.
    weakTitle: ({ retailer }) => `We haven’t got your MINI at ${retailer} right now.`,
    weakLede: () => 'Here’s the nearest we’ve got anyway, but none of them is it. '
      + 'Stock turns over quickly, so it’s worth another look soon.',
    rescueLabel: 'NOT HERE, BUT NOT FAR.',
    rescueNote: ({ list, miles, where }) => `No ${list} at ours right now. `
      + `The nearest is ${miles} away at ${where}, and it’s in the list below.`,
    driveLede: {
      empty: () => 'Nothing at ours fits that brief. These nearby MINIs get closest.',
    },
    // Place, never quality — see the BMW pair above for why that rule exists.
    // MINI's headings carry the full stop; BMW's don't.
    hereHeading: ({ retailer }) => `AT ${retailer.toUpperCase()}.`,
    awayHeading: 'ALSO WITHIN REACH.',
    rejectHint: 'Not feeling it? We’ll bring the next one up.',
    searchingNearby: 'Still having a look further afield',
    workingLabel: 'HOW WE GOT THERE',
    working: ({ total, eligible }) => `We looked at all ${total} MINIs in stock here. `
      + `${eligible} were in budget and roomy enough.`,
    workingMargin: ({ margin }) => ` Nothing else here got within ${margin} points.`,
    workingWeak: ({ top }) => ` The best of the lot got to ${top}%.`,
    workingScore: ' A match score is how well a MINI fits your answers, nothing else, '
      + 'so ones that suit you equally share a number.',
    searchedWider: ({ model, miles, where }) => 'We had a look further afield, too. '
      + `The ${model} at ${where} comes out ahead, and it’s ${miles}.`,
  },
};

/*
 * Honda's voice: plain, warm, practical, sentence-case (docs/tone-style-guide.md).
 * Built on the BMW base (all-or-nothing resolver), overriding only marque/register lines.
 */
BRAND_COPY.honda = {
  ...BRAND_COPY.bmw,
  name: 'Honda',
  title: 'Find the right Honda for you.',
  cta: 'Find my Honda',
  // Honda's plain, practical register: no superlative, lead on sensible fit
  // (life, running, budget) and approved-used reassurance. See docs/tone-style-guide.md.
  lede: ({ questions, retailer }) => `${questions} quick questions about your days, `
    + 'your mileage and what you want to spend. We’ll find the approved-used '
    + `Hondas at ${retailer} that genuinely suit how you live, and show our working.`,
  unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
    + 'These are the closest to everything else you told us.',
  tiedTitle: ({ count }) => `${cardinal(count)} of these fit you just as well.`,
  tiedTitleHere: ({ count, retailer }) => `At ${retailer}, ${cardinal(count)} of these `
    + 'fit you just as well.',
  tasteTitle: ({ model }) => `Your best match is the ${model}.`,
  tasteTitleHere: ({ model, retailer }) => `Your best match at ${retailer} is the ${model}.`,
  tasteLede: () => 'A few of these suit you equally well on paper. This one lines up '
    + 'best with what you said matters most.',
  tiedLede: () => 'On your answers we can’t separate them: each suits you as well as '
    + 'the next. It comes down to which you prefer the look of.',
  refineLabel: ({ count }) => (count > 1 ? `Narrow these ${count} down` : 'Narrow this one down'),
  refineStatus: ({ shown, wants }) => (shown === 1
    ? `One car still fits, with ${wants}.`
    : `${shown} cars still fit, with ${wants}.`),
  refineStatusPlain: ({ shown }) => (shown === 1 ? 'One car still fits.' : `${shown} cars still fit.`),
  refineEmpty: ({ wants }) => `Nothing here has ${wants} together. `
    + 'Drop one of those and we’ll show you what does.',
  refineEmptyHidden: 'That’s all of them ruled out. Bring one back, or start over.',
  tiedEmptyTitle: 'Nothing left to show.',
  rejectOpen: 'Not this one',
  rejectPrompt: 'What put you off?',
  rejectJust: 'Just not this one',
  pickLabel: 'Choose yours',
  kitLabel: 'What’s fitted',
  briefLabel: 'What I’ve picked up',
  closestTitle: ({ retailer }) => `The closest matches at ${retailer}.`,
  closestLede: () => 'Nothing here ticks every box you gave us. Each card says what it '
    + 'gets right, and what it doesn’t.',
  closestSettled: ({ model }) => `Your closest match here is the ${model}.`,
  closestSettledHere: ({ model, retailer }) => `Your closest match at ${retailer} is the ${model}.`,
  weakTitle: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for.`,
  weakLede: () => 'These are the nearest we hold, and each one misses something you '
    + 'said mattered. If none of them works, nothing here does.',
  rescueNote: ({ list, retailer, miles, where }) => `No ${list} at ${retailer} right now. `
    + `The nearest is ${miles} away at ${where}, and it’s in the list below.`,
  driveLede: {
    empty: ({ retailer }) => `Nothing at ${retailer} fits those answers, so these are the `
      + 'closest matches at other retailers instead.',
  },
  hereHeading: ({ retailer }) => `AT ${retailer.toUpperCase()}`,
  awayHeading: 'AT OTHER RETAILERS',
  rejectHint: 'Turned down? We’ll bring the next one up.',
  searchingNearby: 'Still checking other retailers within reach',
  workingLabel: 'HOW WE GOT HERE',
  working: ({ total, eligible }) => `We went through all ${total} Hondas in stock here. `
    + `${eligible} were in budget and big enough for you.`,
  workingMargin: ({ margin }) => ` Nothing else here came within ${margin} points.`,
  workingWeak: ({ top }) => ` The best of them reached ${top}%.`,
  workingScore: ' A match score is how well a car fits your answers, nothing else, '
    + 'so cars that suit you equally share one.',
  searchedWider: ({ model, miles, where }) => 'We looked further afield too. '
    + `The ${model} at ${where} scores higher, and it’s ${miles}.`,
};

/*
 * Ford copy. Same all-or-nothing build as Honda's: spread the BMW base, override
 * only Ford's marque/register lines. Voice: confident, friendly, plainly British.
 */
BRAND_COPY.ford = {
  ...BRAND_COPY.bmw,
  name: 'Ford',
  title: 'Find the right Ford for you.',
  cta: 'Find my Ford',
  // Ford's confident, friendly, plainly-British register: upbeat and direct, proud
  // of the sensible choice with room for the spirited side. See docs/tone-style-guide.md.
  lede: ({ questions, retailer }) => `${questions} quick questions about your life, `
    + 'your miles and your budget. We’ll pull together the approved-used '
    + `Fords at ${retailer} that make real sense for you, and back it up with the reasons.`,
  unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
    + 'These are the closest to everything else you told us.',
  tiedTitle: ({ count }) => `${cardinal(count)} of these fit you just as well.`,
  tiedTitleHere: ({ count, retailer }) => `At ${retailer}, ${cardinal(count)} of these `
    + 'fit you just as well.',
  tasteTitle: ({ model }) => `Your best match is the ${model}.`,
  tasteTitleHere: ({ model, retailer }) => `Your best match at ${retailer} is the ${model}.`,
  tasteLede: () => 'A few of these suit you equally well on paper. This one lines up '
    + 'best with what you said matters most.',
  tiedLede: () => 'On your answers we can’t separate them: each suits you as well as '
    + 'the next. It comes down to which you prefer the look of.',
  refineLabel: ({ count }) => (count > 1 ? `Narrow these ${count} down` : 'Narrow this one down'),
  refineStatus: ({ shown, wants }) => (shown === 1
    ? `One car still fits, with ${wants}.`
    : `${shown} cars still fit, with ${wants}.`),
  refineStatusPlain: ({ shown }) => (shown === 1 ? 'One car still fits.' : `${shown} cars still fit.`),
  refineEmpty: ({ wants }) => `Nothing here has ${wants} together. `
    + 'Drop one of those and we’ll show you what does.',
  refineEmptyHidden: 'That’s all of them ruled out. Bring one back, or start over.',
  tiedEmptyTitle: 'Nothing left to show.',
  rejectOpen: 'Not this one',
  rejectPrompt: 'What put you off?',
  rejectJust: 'Just not this one',
  pickLabel: 'Choose yours',
  kitLabel: 'What’s fitted',
  briefLabel: 'What I’ve picked up',
  closestTitle: ({ retailer }) => `The closest matches at ${retailer}.`,
  closestLede: () => 'Nothing here ticks every box you gave us. Each card says what it '
    + 'gets right, and what it doesn’t.',
  closestSettled: ({ model }) => `Your closest match here is the ${model}.`,
  closestSettledHere: ({ model, retailer }) => `Your closest match at ${retailer} is the ${model}.`,
  weakTitle: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for.`,
  weakLede: () => 'These are the nearest we hold, and each one misses something you '
    + 'said mattered. If none of them works, nothing here does.',
  rescueNote: ({ list, retailer, miles, where }) => `No ${list} at ${retailer} right now. `
    + `The nearest is ${miles} away at ${where}, and it’s in the list below.`,
  driveLede: {
    empty: ({ retailer }) => `Nothing at ${retailer} fits those answers, so these are the `
      + 'closest matches at other retailers instead.',
  },
  hereHeading: ({ retailer }) => `AT ${retailer.toUpperCase()}`,
  awayHeading: 'AT OTHER RETAILERS',
  rejectHint: 'Turned down? We’ll bring the next one up.',
  searchingNearby: 'Still checking other retailers within reach',
  workingLabel: 'HOW WE GOT HERE',
  working: ({ total, eligible }) => `We went through all ${total} Fords in stock here. `
    + `${eligible} were in budget and big enough for you.`,
  workingMargin: ({ margin }) => ` Nothing else here came within ${margin} points.`,
  workingWeak: ({ top }) => ` The best of them reached ${top}%.`,
  workingScore: ' A match score is how well a car fits your answers, nothing else, '
    + 'so cars that suit you equally share one.',
  searchedWider: ({ model, miles, where }) => 'We looked further afield too. '
    + `The ${model} at ${where} scores higher, and it’s ${miles}.`,
};

/*
 * Motorrad copy. Same all-or-nothing build; overrides marque lines AND "car"/"drive"
 * (a rider reads "bike"/"ride"), and re-voices `working`'s "big enough" to licence/riding.
 */
BRAND_COPY.motorrad = {
  ...BRAND_COPY.bmw,
  name: 'BMW Motorrad',
  title: 'Find your perfect BMW Motorrad.',
  cta: 'Find my bike',
  // Motorrad's rider-first, technical register ("Make Life a Ride"): lead on riding
  // and the machine, not "your life" or "suit you best". See docs/tone-style-guide.md.
  lede: ({ questions, retailer }) => `${questions} quick questions about your riding, `
    + 'your licence and your budget. We’ll match you to the approved-used '
    + `BMW Motorrad bikes at ${retailer} built for the road you ride, and tell you why.`,
  unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
    + 'These are the closest matches to everything else you asked for.',
  refineStatus: ({ shown, wants }) => (shown === 1
    ? `One bike still matches, with ${wants}.`
    : `${shown} bikes still match, with ${wants}.`),
  refineStatusPlain: ({ shown }) => (shown === 1
    ? 'One bike still matches.'
    : `${shown} bikes still match.`),
  working: ({ total, eligible }) => `We went through all ${total} BMW Motorrad bikes in stock here. `
    + `${eligible} were in budget and a match for your licence and riding.`,
  workingScore: ' A match score is how well a bike fits your answers, nothing else, '
    + 'so bikes that suit you equally share one.',
};

/*
 * Ferrari copy. Same all-or-nothing build; re-voices marque/register lines. Voice:
 * Italian, romantic, heritage-proud — a Ferrarista joining a family, never a shopper.
 */
BRAND_COPY.ferrari = {
  ...BRAND_COPY.bmw,
  name: 'Ferrari',
  title: 'Find the Ferrari that’s yours.',
  cta: 'Find my Ferrari',
  // Romantic, insider, heritage-led: the car is a thoroughbred, the buyer joining a
  // bloodline. Name the Ferrari Approved programme. See DECISIONS.md, docs/tone-style-guide.md.
  lede: ({ questions, retailer }) => `${questions} quick questions about how you drive, `
    + 'the roads you love and your budget. We’ll match you with the Ferrari Approved '
    + `cars at ${retailer} that were made for you, and tell you why.`,
  unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby just now. `
    + 'These are the closest to everything else you told us.',
  tasteTitle: ({ model }) => `The one for you is the ${model}.`,
  tasteTitleHere: ({ model, retailer }) => `The one for you at ${retailer} is the ${model}.`,
  tasteLede: () => 'A few of these suit you equally well on paper. This one speaks most '
    + 'to what you said matters.',
  tiedLede: () => 'On your answers we can’t choose between them: each suits you as well as '
    + 'the next. Now it comes down to the one that moves you.',
  closestLede: () => 'None of these is everything you asked for. Each card says what it '
    + 'gets right, and where it falls short.',
  weakLede: () => 'These are the nearest we hold, and each one misses something you '
    + 'said mattered. If none of them stirs you, nothing here will.',
  workingLabel: 'HOW WE GOT HERE',
  working: ({ total, eligible }) => `We went through every one of the ${total} Ferraris in stock here. `
    + `${eligible} were in budget and roomy enough for you.`,
  workingMargin: ({ margin }) => ` Nothing else here came within ${margin} points.`,
  workingWeak: ({ top }) => ` The best of them reached ${top}%.`,
  workingScore: ' A match score is how well a car fits your answers, nothing else, '
    + 'so cars that suit you equally share one.',
};

/*
 * How an unmet want is named in the results note, per brand — plurals dropped into
 * "No ___ at <retailer>…". Per-brand vocab; unknown value falls back to the raw value.
 */
export const UNMET_PHRASES = {
  bmw: {
    fuel: {
      petrol: 'petrol cars', diesel: 'diesels', phev: 'plug-in hybrids', ev: 'fully electric cars',
    },
    bodyStyles: {
      hatchback: 'hatchbacks', saloon: 'saloons', estate: 'estates', suv: 'SUVs',
      coupe: 'coupés', convertible: 'convertibles', mpv: 'family carriers',
    },
  },
  mini: {
    fuel: {
      petrol: 'petrol MINIs', phev: 'plug-in hybrid MINIs', ev: 'all-electric MINIs',
    },
    bodyStyles: {
      hatchback: 'hatchbacks', estate: 'Clubman estates', suv: 'Countryman crossovers',
      convertible: 'convertibles',
    },
  },
  honda: {
    // Honda's self-charging hybrids score as petrol (see hondaFuel in mapping.js), so
    // fuel warnings only name petrol, diesel or fully electric — the values the quiz collects.
    fuel: {
      petrol: 'petrol Hondas', diesel: 'diesel Hondas', ev: 'fully electric Hondas',
    },
    bodyStyles: {
      hatchback: 'hatchbacks', suv: 'SUVs',
    },
  },
  ford: {
    // Ford's used range spans the full fuel spread (petrol/mHEV, diesel, Kuga PHEV,
    // Mach-E/Explorer/Capri/Puma Gen-E EVs) and every body from supermini to pickup.
    fuel: {
      petrol: 'petrol Fords', diesel: 'diesel Fords', phev: 'plug-in hybrid Fords',
      ev: 'fully electric Fords',
    },
    bodyStyles: {
      hatchback: 'hatchbacks', estate: 'estates', suv: 'SUVs', coupe: 'coupés',
      convertible: 'convertibles', mpv: 'people carriers', pickup: 'pickups',
    },
  },
  motorrad: {
    // Motorrad is petrol plus one electric (the CE 04); no diesel/PHEV. The bodyStyles
    // keys are bike categories the mapper emits as `body` (see MODEL_SPECS_MOTORRAD).
    fuel: {
      petrol: 'petrol bikes', ev: 'electric bikes',
    },
    bodyStyles: {
      naked: 'naked bikes', roadster: 'roadsters', adventure: 'adventure bikes',
      tourer: 'tourers', sport: 'sports bikes', heritage: 'heritage bikes',
      scooter: 'electric scooters',
    },
  },
  ferrari: {
    // Ferrari's used range is petrol plus 296/SF90 PHEVs; no diesel or EV. Bodies are
    // named as the quiz names them: the Spider for a convertible, the Purosangue for SUV.
    fuel: {
      petrol: 'petrol Ferraris', phev: 'plug-in hybrid Ferraris',
    },
    bodyStyles: {
      coupe: 'coupés', convertible: 'Spiders', suv: 'the Purosangue',
    },
  },
};

/*
 * How the hero card owns a want it doesn't meet — "Petrol, where you asked for
 * all-electric." Singular phrases; same per-brand vocab. `label` is the CSS-uppercased eyebrow.
 */
export const TRADE_COPY = {
  bmw: {
    label: 'The trade-off',
    fuel: {
      petrol: 'petrol', diesel: 'diesel', phev: 'a plug-in hybrid', ev: 'fully electric',
    },
    bodyStyles: {
      hatchback: 'a hatchback', saloon: 'a saloon', estate: 'an estate', suv: 'an SUV',
      coupe: 'a coupé', convertible: 'a convertible', mpv: 'a family carrier',
    },
  },
  mini: {
    label: 'The trade',
    fuel: { petrol: 'petrol', phev: 'a plug-in hybrid', ev: 'all-electric' },
    bodyStyles: {
      hatchback: 'a hatchback', estate: 'a Clubman', suv: 'a Countryman',
      convertible: 'a convertible',
    },
    // The `got` side describes the car, not a quiz option — MINI's suv bucket holds
    // the Aceman too, so it says "a crossover"; the want side stays the quiz's "a Countryman".
    got: { bodyStyles: { suv: 'a crossover' } },
  },
  honda: {
    label: 'The trade-off',
    fuel: { petrol: 'petrol', diesel: 'diesel', ev: 'fully electric' },
    bodyStyles: { hatchback: 'a hatchback', suv: 'an SUV' },
  },
  ford: {
    label: 'The trade-off',
    fuel: {
      petrol: 'petrol', diesel: 'diesel', phev: 'a plug-in hybrid', ev: 'fully electric',
    },
    bodyStyles: {
      hatchback: 'a hatchback', estate: 'an estate', suv: 'an SUV', coupe: 'a coupé',
      convertible: 'a convertible', mpv: 'a people carrier', pickup: 'a pickup',
    },
  },
  motorrad: {
    label: 'The trade-off',
    fuel: { petrol: 'petrol', ev: 'electric' },
    bodyStyles: {
      naked: 'a naked bike', roadster: 'a roadster', adventure: 'an adventure bike',
      tourer: 'a tourer', sport: 'a sports bike', heritage: 'a heritage bike',
      scooter: 'an electric scooter',
    },
  },
  ferrari: {
    label: 'The trade-off',
    fuel: { petrol: 'petrol', phev: 'a plug-in hybrid' },
    bodyStyles: {
      coupe: 'a coupé', convertible: 'a Spider', suv: 'the Purosangue',
    },
  },
};

/** "a", "a or b", "a, b or c" — the natural spoken list. */
export function orList(items) {
  if (items.length < 2) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** The same, for things that hold at once: "a and b", "a, b and c". Applied
 * refinements are ANDed, so an "or" here would describe a looser search than was run. */
export function andList(items) {
  if (items.length < 2) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/*
 * The hero card's trade-off line(s): one short declarative per missed want, in the
 * engine's fuel-then-shape order. Unknown value falls back to the raw value.
 */
export function tradeLines(brandKey, trades) {
  const vocab = TRADE_COPY[brandKey] || TRADE_COPY.bmw;
  return trades.map(({ dim, wants, got }) => {
    const gotPhrase = vocab.got?.[dim]?.[got] || vocab[dim]?.[got] || got;
    const wantList = orList(wants.map((w) => vocab[dim]?.[w] || w));
    const line = `${gotPhrase}, where you asked for ${wantList}.`;
    return line.charAt(0).toUpperCase() + line.slice(1);
  });
}
