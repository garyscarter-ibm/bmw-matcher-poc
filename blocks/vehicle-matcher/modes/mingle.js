/*
 * MINI Mingle — the matcher, played as a Valentine's swipe game.
 *
 * One of several interchangeable interface "modes" over the shared engine (see
 * ../modes/index.js and the shell in ../vehicle-matcher.js). Its premise, in one
 * line: swipes silently answer the same questionnaire the `questions` mode asks,
 * and the REAL engine does the matching. See docs/mini-mingle-requirements.md.
 *
 * The flow:
 *   1. A tiny "set your type" SEED step (budget + what's it for) — the two
 *      answers a swipe can't reliably read, and budget is the engine's one hard
 *      filter (so the deck is affordable from card one).
 *   2. A DECK of the retailer's real stock (POST /api/preview, scoped by the
 *      seed), shuffled, swiped one card at a time. Keeping/passing cards fills in
 *      the *taste* answer keys (body, fuel, style, priorities) — see
 *      swipesToAnswers().
 *   3. A RESULT: the assembled brief goes to the real /api/match (the identical
 *      call the questions mode makes). The ENGINE'S pick wins; the swipe taste
 *      only re-ranks within the feasible set it returned. So the match is always
 *      a car the person could actually buy, with the engine's real reasons.
 *
 * This mode owns its own copy, cards and state — it deliberately does NOT reuse
 * the questions mode's BRAND_COPY/matchCard (different voice, different card
 * shape). Only el/cardinal/gbp (ui.js) and the engine client are shared.
 *
 * The scoring engine and car dataset live behind an API (see server/ and
 * ../engine.js); this mode never sees the dataset — only the public display
 * fields the API returns.
 */

import { apiGetQuestions, apiPreview, apiMatch } from '../engine.js';
import { el, gbp } from '../ui.js';

/*
 * Below this the engine stops calling its leader a match at all — the client's
 * "we don't really have this" threshold. Mirror of WEAK_SCORE in
 * ../vehicle-matcher.js and scripts/persona-check.mjs; kept local because it's a
 * client-side presentation decision, not a server value. When it crosses this
 * at the result, the celebration still fires but adds one honest note (§6.2).
 */
const WEAK_SCORE = 68;

/* How many cards make a good swipe session — enough to read a taste, few enough
 * not to become a chore (§4.2). We sample the preview pool down to this. */
const DECK_TARGET = 10;

/* A player can bail to the result once they've swiped at least this many —
 * enough signal to match honestly, so the "Reveal my match" affordance appears
 * (§6.1). Below it, finish the deck. */
const REVEAL_AFTER = 3;

/* ------------------------------ copy ------------------------------ */

/*
 * Valentine-flirty display copy, keyed by brand with a `bmw` fallback (every
 * read is `MINGLE_COPY[brand] || MINGLE_COPY.bmw`). MINI is the primary, fully
 * written voice — this is a MINI campaign (§9); the BMW register is a lighter
 * fallback so a future skin isn't blank. Functions take a single args object,
 * matching the questions-mode copy convention.
 */
const MINGLE_COPY = {
  mini: {
    wordmark: 'MINI Mingle',
    // Seed step
    seedKicker: 'First, your type',
    seedTitle: 'What are you into?',
    seedLede: 'Two quick things and we’ll deal you a deck. Then just follow your heart.',
    budgetLabel: 'How much are you looking to spend?',
    useLabel: 'And what’s it for?',
    seedCta: 'Start swiping ♥',
    // NB: the budget bands and the "what's it for" options are NOT copy — they
    // come from the engine per brand (apiGetQuestions → the `budget` and
    // `primaryUse` questions), so MINI's own labels and MINI-scale budget show
    // without duplicating the source of truth. Only the seed's framing lives here.
    // Deck
    deckInstruction: 'Pass on the ones that leave you cold. Keep the ones that catch your eye.',
    passLabel: 'Pass',
    keepLabel: 'Keep',
    undoLabel: '↩ Bring that one back',
    revealLabel: 'Reveal my match ♥',
    progress: ({ done, total }) => `${done} of ${total}`,
    // Flirty card badges — flavour, never a scored verdict (§4.4). Warmer ones
    // are nudged toward higher-scoring cards, but nothing here is negative.
    badgesWarm: ['🔥 Hot right now', '♥ Strong chemistry', 'Head-turner'],
    badgesCool: ['Your type?', 'Plays hard to get', 'Bit of a charmer'],
    // Taste profile
    tasteHeading: 'Your type, so far',
    tasteEmpty: 'Nothing yet — start swiping.',
    keptHeading: 'Caught your eye',
    barLabels: {
      fuel: 'Fuel', colour: 'Colour', budget: 'Budget', body: 'Body',
    },
    // Result
    matchKicker: 'It’s a match! ♥',
    matchTitle: ({ model }) => `You and the ${model}.`,
    matchLede: 'Your heart’s made up its mind.',
    // The "why" — engine reasons wear a flirty coat; a swipe callback makes it
    // feel earned. reasons is the engine's real reasons[] (may be short).
    whyIntro: 'Why you two work:',
    swipeCallback: ({ trait }) => `And it’s the ${trait} one you kept leaning toward ♥`,
    // Thin signal (≤1 keep): matched on the seed alone, said playfully (§5.3).
    thinTitle: 'Playing it cool, then.',
    thinLede: 'You kept your cards close — so here’s the best fit for what you told us.',
    // Honest "not quite" note — the engine's own weak/unmet signal, in character
    // (§6.2). Reuses the concept behind the questions mode's weak/rescue copy.
    weakNote: 'Full disclosure, though — none of these *quite* nailed your taste. '
      + 'Stock changes every week, so it’s worth another swipe soon. ♥',
    // CTAs + share
    testDriveCta: '♥ Book a Valentine’s test drive',
    detailsCta: 'See full details',
    shareCta: 'Share your match',
    shareCopied: 'Link copied ♥',
    againCta: 'Swipe again',
    shareText: ({ model, retailer }) => `I matched with a ${model} at ${retailer}. `
      + 'What’s your type? 💘',
    // Empty pool at the seed (§4.2)
    emptyPoolTitle: 'Nothing in that range just now.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got anything under that at the `
      + 'moment — nudge your budget up and we’ll deal a fresh deck.',
    emptyPoolCta: 'Adjust budget',
    // Errors
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  bmw: {
    wordmark: 'Car Match',
    seedKicker: 'First, the essentials',
    seedTitle: 'What are you after?',
    seedLede: 'Two quick things and we’ll build you a deck to swipe through.',
    budgetLabel: 'Budget',
    useLabel: 'What’s it for?',
    seedCta: 'Start swiping',
    // Budget bands + "what's it for" options come from the engine per brand
    // (see the MINI note above), not from copy.
    deckInstruction: 'Pass the ones that don’t appeal. Keep the ones that do.',
    passLabel: 'Pass',
    keepLabel: 'Keep',
    undoLabel: '↩ Bring that one back',
    revealLabel: 'Reveal my match',
    progress: ({ done, total }) => `${done} of ${total}`,
    badgesWarm: ['Strong match', 'Well suited', 'Worth a look'],
    badgesCool: ['Your type?', 'One to consider', 'In the running'],
    tasteHeading: 'Your taste, so far',
    tasteEmpty: 'Nothing yet — start swiping.',
    keptHeading: 'Kept',
    barLabels: {
      fuel: 'Fuel', colour: 'Colour', budget: 'Budget', body: 'Body',
    },
    matchKicker: 'Your match',
    matchTitle: ({ model }) => `The ${model}.`,
    matchLede: 'Based on what you kept.',
    whyIntro: 'Why it suits you:',
    swipeCallback: ({ trait }) => `It’s the ${trait} one you kept coming back to.`,
    thinTitle: 'Not much to go on.',
    thinLede: 'You kept your options open — so here’s the best fit for what you told us.',
    weakNote: 'That said — none of these quite matched your taste. Stock changes '
      + 'weekly, so it’s worth another look soon.',
    testDriveCta: 'Book a test drive',
    detailsCta: 'See full details',
    shareCta: 'Share this match',
    shareCopied: 'Link copied',
    againCta: 'Swipe again',
    shareText: ({ model, retailer }) => `I matched with a ${model} at ${retailer}.`,
    emptyPoolTitle: 'Nothing in that range just now.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got anything under that at the `
      + 'moment — raise your budget and we’ll build a fresh deck.',
    emptyPoolCta: 'Adjust budget',
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
};

/*
 * Colour shade → swatch hex, for the card colour bar/tint and the "Colour" taste
 * bar (§11.4). Brand-neutral and keyed by the NORMALISED shade the feed returns
 * (car.colour.colour), not marketing names — so it survives "Chili Red" vs
 * "Rooftop Grey" naming. Unknown shades fall back to a neutral swatch. This is a
 * small display table, deliberately not the prototype's five hard-coded hexes.
 */
const SHADE_HEX = {
  red: '#c0392b', orange: '#d35400', yellow: '#e2b100', green: '#1e8449',
  blue: '#2563a8', purple: '#6c3483', pink: '#c0536a', brown: '#7b5033',
  beige: '#c9b79c', white: '#f4f4f4', silver: '#c8ccce', grey: '#8a8f93',
  gray: '#8a8f93', black: '#2a2a2a',
};
const NEUTRAL_SWATCH = '#c8ccce';

/* ------------------------------ helpers ------------------------------ */

/** Copy for the active brand, BMW as the fallback (matches ctx.brand shape). */
const copyFor = (brand) => MINGLE_COPY[brand] || MINGLE_COPY.bmw;

/**
 * Budget tiles for the seed step, derived from the engine's `budget` question
 * so the range is per-brand (MINI caps ~£50k where BMW reaches £150k+). The
 * quiz uses a dual-thumb slider; the swipe game wants a few tap targets, so we
 * quantise the engine's `max` into round "up to £Xk" bands plus an open-top
 * "£Xk plus". Each band is the [min, max] pair the engine expects (see
 * budgetRange in server/engine.js), so no answer shape changes — only the
 * control does. Falls back to a sane MINI-ish ladder if the question is missing.
 *
 * Returns [{ label, range: [min, max] }]. The last band is open-topped at the
 * slider max, so a MINI player never sees a £70k tile and a BMW player does.
 */
function budgetBandsFromQuestion(budgetQ) {
  const max = Number(budgetQ?.max) || 50000;
  // Round ceilings up to `max`. Steps scale with the range so BMW doesn't get
  // eight tiles and MINI two: ~£10k steps under £50k, ~£25k above.
  const step = max <= 50000 ? 10000 : 25000;
  const tops = [];
  for (let top = step; top < max; top += step) tops.push(top);
  const bands = tops.map((top, i) => ({
    label: i === 0 ? `Under ${gbpShort(top)}` : `Up to ${gbpShort(top)}`,
    range: [0, top],
  }));
  // Open-topped final band, from the last ceiling to the engine's max.
  const floor = tops.length ? tops[tops.length - 1] : 0;
  bands.push({ label: `${gbpShort(floor)} plus`, range: [floor, max] });
  return bands;
}

/** "£20k", "£150k" — compact money for the budget tiles. */
const gbpShort = (n) => (n % 1000 === 0 ? `£${n / 1000}k` : gbp(n));

/**
 * The `primaryUse` options as the seed's "what's it for" tiles, taken straight
 * from the engine so the labels/subs are the brand's own (MINI's "Nipping round
 * town", BMW's "City driving") and any brand-excluded option is already gone.
 * Returns [{ value, label, sub }]. Falls back to an empty list if the question
 * is missing — the caller guards on that.
 */
function useTilesFromQuestion(useQ) {
  return (useQ?.options || []).map((o) => ({ value: o.value, label: o.label, sub: o.sub }));
}

/** In-place Fisher–Yates. Math.random is fine — this is the game surface, not
 * the reproducible engine (§4.2 build note). */
function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The normalised shade for a car, or null. Prefers the structured shade the
 * enrichment set; falls back to lower-casing a marketing name's last word. */
function shadeOf(car) {
  const shade = car.colour?.colour;
  if (shade && SHADE_HEX[shade.toLowerCase()]) return shade.toLowerCase();
  const name = car.colour?.manufacturerColour || (car.colours && car.colours[0]);
  if (!name) return null;
  // Marketing names end in the shade more often than not ("Chili Red").
  const last = String(name).trim().split(/\s+/).pop().toLowerCase();
  return SHADE_HEX[last] ? last : null;
}

/** Swatch hex for a card (neutral when the shade is unknown/unenriched). */
const swatchFor = (car) => SHADE_HEX[shadeOf(car)] || NEUTRAL_SWATCH;

/** Price line for a card: single used price, or a grouped range. */
function priceLabel(car) {
  if (car.listingCount > 1 && car.priceFrom !== car.priceTo) return `from ${gbp(car.priceFrom)}`;
  if (car.priceMin === car.priceMax) return gbp(car.priceMin);
  return `${gbp(car.priceMin)}–${gbp(car.priceMax)}`;
}

/** Cap-first a value for display ("electric" → "Electric"). */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/*
 * The modal value in a list, with its share of the total. Used for the taste
 * bars: {value, count, share} where share is 0–1. Ties break to first seen.
 */
function modal(values) {
  const counts = new Map();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return best == null ? null : { value: best, count: bestCount, share: bestCount / values.length };
}

/*
 * Turn the KEPT cars (plus the seed answers) into the engine's answer object —
 * the whole point of the mode (§5.3). The result is the SAME shape the questions
 * mode builds; it goes straight to /api/match.
 *
 * Principle: infer only the *taste* keys, and err toward OMITTING a key over
 * guessing it — an omitted key lets the engine use its own default, which is
 * safer than a wrong inference. budget + primaryUse come from the seed and are
 * never touched here.
 *
 * Brand safety: MINI has no saloon/coupe/mpv body or diesel fuel (those options
 * are brands:['bmw'] in server/questions.js). We only ever emit values we
 * actually observed on real cards in this brand's deck, so we can't emit a value
 * the brand's engine would reject.
 */
function swipesToAnswers(kept, seed) {
  const answers = { ...seed };
  if (kept.length === 0) return answers;

  // Body / fuel: the distinct values seen among kept cars, most-kept first. Only
  // keep a preference once at least two cards agree, so a single stray keep
  // isn't read as a want (thin data → omit).
  const bodyByFreq = rankByFrequency(kept.map((c) => c.body));
  const fuelByFreq = rankByFrequency(kept.map((c) => c.fuel));
  if (kept.length >= 2) {
    const bodies = bodyByFreq.filter((b) => b.count >= 2).map((b) => b.value);
    const fuels = fuelByFreq.filter((f) => f.count >= 2).map((f) => f.value);
    if (bodies.length) answers.bodyStyles = bodies;
    if (fuels.length) answers.fuel = fuels;
  }

  // Style (1–5, sent as a STRING per server/questions.js). Sporty skew → 4/5 if
  // kept cars lean to sporty bodies or hot trims; else leave the engine's
  // default rather than asserting "balanced".
  const sportyBodies = kept.filter((c) => /coupe|convertible|roadster/i.test(c.body || '')).length;
  const sportyTrims = kept.filter((c) => /\b(jcw|cooper s|m\d|competition|gts?)\b/i.test(
    `${c.name || ''} ${c.line || ''}`,
  )).length;
  const sportyShare = (sportyBodies + sportyTrims) / kept.length;
  if (sportyShare >= 0.5) answers.style = '5';
  else if (sportyShare >= 0.25) answers.style = '4';

  // Priorities (max 2). Derive from the pattern, not from a form:
  //  - consistent colour/body → they're buying with their eyes → image
  //  - economical fuel kept → economy
  //  - sporty skew → performance
  const priorities = [];
  const colourModal = modal(kept.map((c) => shadeOf(c)).filter(Boolean));
  const bodyModal = bodyByFreq[0];
  const looksLed = (colourModal && colourModal.share >= 0.5)
    || (bodyModal && bodyModal.count / kept.length >= 0.6);
  if (looksLed) priorities.push('image');
  const economical = kept.filter((c) => c.fuel === 'ev' || c.fuel === 'phev').length;
  if (economical / kept.length >= 0.5) priorities.push('economy');
  if (sportyShare >= 0.5 && !priorities.includes('performance')) priorities.push('performance');
  if (priorities.length) answers.priorities = priorities.slice(0, 2);

  // Charging is only a real question if the inferred fuel leans electric — and
  // then we say "open to it" rather than guessing where they'd charge.
  const fuels = answers.fuel || [];
  if (fuels.includes('ev') || fuels.includes('phev')) answers.charging = 'either';

  // people: derived from the seed use case, not from swipes (a swiper can fancy a
  // two-seater and still need to seat a family — §4.1).
  if (seed.primaryUse === 'family') answers.people = 'family';

  // mileage is deliberately omitted — swiping can't read annual miles; the
  // engine's own default stands.
  return answers;
}

/** Distinct values ranked by frequency: [{value, count}], most-kept first. */
function rankByFrequency(values) {
  const counts = new Map();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

/* ------------------------------ mount ------------------------------ */

function mount(root, ctx) {
  const copy = copyFor(ctx.brand);

  // Per-run state — a fresh local object, NOT hung on the shared ctx, so a mode
  // swap and re-mount (the switcher re-calls mount with the same ctx) starts
  // clean. The mode owns its own state and its own hash key (it never touches
  // ctx.answers or the questions mode's #m= link).
  const state = {
    questions: [], // the engine's per-brand questions (seeds the budget/use tiles)
    seed: null, // { budget, primaryUse }
    deck: [], // shuffled, sampled preview matches
    index: 0, // next card to show
    kept: [], // cars the player kept (the taste signal)
    history: [], // { keep: bool } per swipe, for undo + progress dots
    busy: false, // fly-out lock (§11.2)
  };

  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- error screen (local reimplementation of the renderStatus pattern) ---- */
  const showError = (onRetry) => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-status');
    screen.append(
      el('p', 'vm-kicker', copy.errKicker),
      el('h2', 'vm-title', copy.errTitle),
      el('p', 'vm-lede', copy.errLede),
    );
    const retry = el('button', 'vm-btn vm-btn-primary', copy.retryLabel);
    retry.type = 'button';
    retry.addEventListener('click', onRetry);
    screen.append(retry);
    root.append(screen);
  };

  /* --------------------------- seed skeleton --------------------------- */
  // Painted synchronously by mount() while apiGetQuestions is in flight, so the
  // stage is never blank and the shell never waits. Swapped for the real seed
  // once the (per-brand) questions land.
  const renderSeedSkeleton = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-mingle-seed');
    screen.setAttribute('aria-busy', 'true');
    screen.setAttribute('aria-label', 'Loading');
    screen.append(
      el('div', 'vm-skel vm-skel-kicker'),
      el('div', 'vm-skel vm-skel-title'),
      el('div', 'vm-skel vm-skel-lede'),
      el('div', 'vm-skel vm-mingle-skel-tiles'),
      el('div', 'vm-skel vm-mingle-skel-tiles'),
    );
    root.append(screen);
  };

  /* ---------------------------- seed step ----------------------------
   * The two answers a swipe can't read: budget (the engine's hard filter) and
   * what the car's for. Both the budget bands and the "what's it for" tiles are
   * built from the engine's own per-brand questions (state.questions) — NOT from
   * local copy — so MINI shows MINI's labels and MINI-scale money, exactly like
   * the questions mode. Only the seed's framing (kicker/title/lede) is copy. */
  const renderSeed = (preset) => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-mingle-seed');
    screen.append(el('p', 'vm-kicker vm-mingle-wordmark', copy.wordmark));
    screen.append(el('h2', 'vm-title', copy.seedTitle));
    screen.append(el('p', 'vm-lede', copy.seedLede));

    const budgetQ = state.questions.find((q) => q.id === 'budget');
    const useQ = state.questions.find((q) => q.id === 'primaryUse');
    const budgetBands = budgetBandsFromQuestion(budgetQ);
    const useTiles = useTilesFromQuestion(useQ);

    const chosen = { budget: preset?.budget || null, primaryUse: preset?.primaryUse || null };
    const cta = el('button', 'vm-btn vm-btn-primary vm-mingle-seed-cta', copy.seedCta);
    cta.type = 'button';
    const refreshCta = () => { cta.disabled = !(chosen.budget && chosen.primaryUse); };

    // Budget bands — ceilings and open-top scale to the brand's slider max.
    screen.append(el('p', 'vm-mingle-seed-label', budgetQ?.title || copy.budgetLabel));
    const budgetRow = el('div', 'vm-mingle-tiles vm-mingle-tiles-budget');
    budgetBands.forEach(({ label, range }) => {
      const tile = el('button', 'vm-mingle-tile', label);
      tile.type = 'button';
      const isSel = chosen.budget && chosen.budget[0] === range[0] && chosen.budget[1] === range[1];
      if (isSel) tile.classList.add('is-selected');
      tile.addEventListener('click', () => {
        chosen.budget = range;
        budgetRow.querySelectorAll('.vm-mingle-tile').forEach((t) => t.classList.remove('is-selected'));
        tile.classList.add('is-selected');
        refreshCta();
      });
      budgetRow.append(tile);
    });
    screen.append(budgetRow);

    // What's it for — the engine's primaryUse options, brand labels + subs.
    screen.append(el('p', 'vm-mingle-seed-label', useQ?.title || copy.useLabel));
    const useRow = el('div', 'vm-mingle-tiles vm-mingle-tiles-use');
    useTiles.forEach(({ value, label, sub }) => {
      const tile = el('button', 'vm-mingle-tile vm-mingle-tile-use');
      tile.type = 'button';
      tile.append(el('span', 'vm-mingle-tile-label', label));
      if (sub) tile.append(el('span', 'vm-mingle-tile-hint', sub));
      if (chosen.primaryUse === value) tile.classList.add('is-selected');
      tile.addEventListener('click', () => {
        chosen.primaryUse = value;
        useRow.querySelectorAll('.vm-mingle-tile').forEach((t) => t.classList.remove('is-selected'));
        tile.classList.add('is-selected');
        refreshCta();
      });
      useRow.append(tile);
    });
    screen.append(useRow);

    refreshCta();
    cta.addEventListener('click', () => {
      state.seed = { budget: chosen.budget, primaryUse: chosen.primaryUse };
      loadDeck();
    });
    screen.append(cta);
    root.append(screen);
  };

  /* --------------------------- deck loading --------------------------- */
  const loadDeck = async () => {
    // Skeleton the deck panel while /api/preview is in flight. Not the seed —
    // this is the swipe stage arriving.
    renderDeckSkeleton();
    // apiPreview resolves-empty (never throws), so no try/catch needed here.
    const matches = await apiPreview(ctx.api, state.seed, ctx.retailer, ctx.brand);
    if (!matches.length) {
      renderEmptyPool();
      return;
    }
    state.deck = shuffle(matches).slice(0, DECK_TARGET);
    state.index = 0;
    state.kept = [];
    state.history = [];
    renderDeck();
  };

  const renderDeckSkeleton = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-mingle-stage');
    screen.setAttribute('aria-busy', 'true');
    screen.setAttribute('aria-label', 'Dealing your deck');
    const deckCol = el('div', 'vm-mingle-deck');
    deckCol.append(el('div', 'vm-skel vm-mingle-skel-card'));
    screen.append(el('div', 'vm-mingle-taste'), deckCol);
    root.append(screen);
  };

  const renderEmptyPool = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-status');
    screen.append(
      el('h2', 'vm-title', copy.emptyPoolTitle),
      el('p', 'vm-lede', copy.emptyPoolLede({ retailer: ctx.retailerLabel || 'this retailer' })),
    );
    const back = el('button', 'vm-btn vm-btn-primary', copy.emptyPoolCta);
    back.type = 'button';
    back.addEventListener('click', () => renderSeed(state.seed));
    screen.append(back);
    root.append(screen);
  };

  /* ------------------------------ deck ------------------------------ */
  const renderDeck = () => {
    root.replaceChildren();
    const stage = el('div', 'vm-mingle-stage');
    stage.append(renderTaste(), renderDeckColumn());
    root.append(stage);
  };

  // Live taste profile from the KEPT set only (a Pass is weak signal; §5.2).
  const renderTaste = () => {
    const panel = el('aside', 'vm-mingle-taste');
    panel.append(el('h3', 'vm-mingle-taste-heading', copy.tasteHeading));

    const kept = state.kept;
    const bars = el('div', 'vm-mingle-bars');
    const bar = (key, m, valueLabel) => {
      const row = el('div', 'vm-mingle-bar');
      row.append(el('span', 'vm-mingle-bar-key', copy.barLabels[key]));
      const track = el('div', 'vm-mingle-bar-track');
      const fill = el('div', 'vm-mingle-bar-fill');
      fill.style.width = `${m ? Math.round(m.share * 100) : 0}%`;
      if (key === 'colour' && m) fill.style.background = SHADE_HEX[m.value] || NEUTRAL_SWATCH;
      track.append(fill);
      row.append(track);
      row.append(el('span', 'vm-mingle-bar-val', m ? valueLabel(m.value) : '—'));
      return row;
    };
    bars.append(
      bar('fuel', modal(kept.map((c) => c.fuel)), cap),
      bar('colour', modal(kept.map((c) => shadeOf(c)).filter(Boolean)), cap),
      bar('body', modal(kept.map((c) => c.body)), cap),
      bar('budget', kept.length ? { value: budgetBandLabel(kept), share: 1 } : null, (v) => v),
    );
    panel.append(bars);

    // Kept-so-far list
    panel.append(el('h4', 'vm-mingle-kept-heading', copy.keptHeading));
    if (kept.length === 0) {
      panel.append(el('p', 'vm-mingle-taste-empty', copy.tasteEmpty));
    } else {
      const list = el('ul', 'vm-mingle-kept');
      kept.forEach((c) => list.append(el('li', 'vm-mingle-kept-item', c.name)));
      panel.append(list);
    }
    return panel;
  };

  // The budget bar shows a preference band, not a raw average (§11.6).
  const budgetBandLabel = (kept) => {
    const avg = kept.reduce((s, c) => s + (c.priceMin || c.priceFrom || 0), 0) / kept.length;
    if (avg < 20000) return 'Under £20k';
    if (avg < 25000) return 'Around £22k';
    if (avg < 30000) return 'Around £27k';
    if (avg < 35000) return 'Around £32k';
    return '£35k plus';
  };

  const renderDeckColumn = () => {
    const col = el('div', 'vm-mingle-deck');
    const total = state.deck.length;
    const done = state.index;

    // Progress: counter + three-state dot row (current / done-keep / done-pass).
    const head = el('div', 'vm-mingle-progress');
    head.append(el('span', 'vm-mingle-count', copy.progress({ done: Math.min(done + 1, total), total })));
    const dots = el('div', 'vm-mingle-dots');
    state.deck.forEach((_, i) => {
      const dot = el('span', 'vm-mingle-dot');
      if (i < done) dot.classList.add(state.history[i]?.keep ? 'is-keep' : 'is-pass');
      else if (i === done) dot.classList.add('is-current');
      dots.append(dot);
    });
    head.append(dots);
    col.append(head);

    col.append(el('p', 'vm-mingle-instruction', copy.deckInstruction));

    // The card stack — at most three deep (§11.1). Front card is live.
    const stack = el('div', 'vm-mingle-stack');
    const upcoming = state.deck.slice(done, done + 3);
    upcoming.forEach((match, depth) => {
      stack.append(buildCard(match, depth));
    });
    col.append(stack);

    // Controls — the source of truth (buttons; gesture/keys mirror them).
    const controls = el('div', 'vm-mingle-controls');
    const passBtn = el('button', 'vm-mingle-swipe vm-mingle-pass');
    passBtn.type = 'button';
    passBtn.setAttribute('aria-label', copy.passLabel);
    passBtn.append(el('span', 'vm-mingle-swipe-glyph', '✕'), el('span', 'vm-mingle-swipe-text', copy.passLabel));
    const keepBtn = el('button', 'vm-mingle-swipe vm-mingle-keep');
    keepBtn.type = 'button';
    keepBtn.setAttribute('aria-label', copy.keepLabel);
    keepBtn.append(el('span', 'vm-mingle-swipe-glyph', '♥'), el('span', 'vm-mingle-swipe-text', copy.keepLabel));
    passBtn.addEventListener('click', () => doSwipe(false));
    keepBtn.addEventListener('click', () => doSwipe(true));
    controls.append(passBtn, keepBtn);
    col.append(controls);

    // Undo + reveal-early
    const extras = el('div', 'vm-mingle-extras');
    if (done > 0) {
      const undo = el('button', 'vm-mingle-link', copy.undoLabel);
      undo.type = 'button';
      undo.addEventListener('click', undoSwipe);
      extras.append(undo);
    }
    if (done >= REVEAL_AFTER) {
      const reveal = el('button', 'vm-mingle-link vm-mingle-reveal', copy.revealLabel);
      reveal.type = 'button';
      reveal.addEventListener('click', showResult);
      extras.append(reveal);
    }
    col.append(extras);

    // Keyboard: ← Pass, → Keep (accessibility; not in the prototype).
    col.tabIndex = 0;
    col.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); doSwipe(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); doSwipe(true); }
    });
    return col;
  };

  // One card. depth 0 = front (live); 1,2 = peek behind (§11.1). Badge is
  // flavour, never a scored verdict (§4.4).
  const buildCard = (match, depth) => {
    const { car, score } = match;
    const card = el('article', `vm-mingle-card vm-mingle-card-${depth}`);
    card.style.setProperty('--vm-mingle-swatch', swatchFor(car));

    // Colour bar across the top + tinted media (§11.4).
    card.append(el('div', 'vm-mingle-card-colour'));

    const media = el('div', 'vm-mingle-card-media');
    if (car.photo) {
      const img = el('img', 'vm-mingle-card-photo');
      img.src = car.photo;
      img.alt = car.name;
      img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); media.classList.add('no-photo'); });
      media.append(img);
    } else {
      media.classList.add('no-photo');
      media.append(el('span', 'vm-mingle-card-initial', (car.name || '?').charAt(0)));
    }
    // Flirty badge — warmer pool nudged toward higher scores, but only as a
    // nudge; nothing negative, no printed number.
    const pool = (score >= 80 ? copy.badgesWarm : copy.badgesCool);
    const badge = el('span', 'vm-mingle-badge', pool[car.id ? hashPick(car.id, pool.length) : 0]);
    media.append(badge);
    card.append(media);

    const body = el('div', 'vm-mingle-card-body');
    body.append(el('h3', 'vm-mingle-card-name', car.name));
    const spec = [car.plate, car.mileage ? `${car.mileage.toLocaleString('en-GB')} mi` : null]
      .filter(Boolean).join(' · ');
    if (spec) body.append(el('p', 'vm-mingle-card-spec', spec));
    body.append(el('p', 'vm-mingle-card-price', priceLabel(car)));
    const pills = el('div', 'vm-mingle-pills');
    if (car.fuel) pills.append(el('span', 'vm-mingle-pill', cap(car.fuel)));
    if (car.body) pills.append(el('span', 'vm-mingle-pill', cap(car.body)));
    body.append(pills);
    card.append(body);
    return card;
  };

  // Deterministic "random" pick per car so the badge is stable across re-renders
  // (a card mustn't change badge when the one in front of it is swiped).
  const hashPick = (id, n) => {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h) % n;
  };

  /* --------------------------- swiping --------------------------- */
  const doSwipe = (keep) => {
    if (state.busy || state.index >= state.deck.length) return;
    const match = state.deck[state.index];
    const front = root.querySelector('.vm-mingle-card-0');

    const commit = () => {
      if (keep) state.kept.push(match.car);
      state.history[state.index] = { keep };
      state.index += 1;
      state.busy = false;
      if (state.index >= state.deck.length) showResult();
      else renderDeck();
    };

    if (reducedMotion || !front) { commit(); return; }
    state.busy = true;
    front.classList.add(keep ? 'is-flying-right' : 'is-flying-left');
    // Advance after the fly-out (prototype uses ~280ms; match the CSS 0.3s).
    window.setTimeout(commit, 280);
  };

  const undoSwipe = () => {
    if (state.busy || state.index === 0) return;
    state.index -= 1;
    const undone = state.history[state.index];
    if (undone?.keep) state.kept.pop();
    state.history[state.index] = undefined;
    renderDeck();
  };

  /* --------------------------- result --------------------------- */
  const showResult = async () => {
    renderResultSkeleton();
    const answers = swipesToAnswers(state.kept, state.seed);
    let result;
    try {
      // The identical call the questions mode makes. THROWS on failure — guard.
      result = await apiMatch(ctx.api, answers, ctx.retailer, ctx.brand);
    } catch {
      showError(showResult);
      return;
    }
    renderResult(result);
  };

  const renderResultSkeleton = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-mingle-result');
    screen.setAttribute('aria-busy', 'true');
    screen.setAttribute('aria-label', 'Finding your match');
    screen.append(
      el('div', 'vm-skel vm-skel-title'),
      el('div', 'vm-skel vm-mingle-skel-hero'),
    );
    root.append(screen);
  };

  const renderResult = (result) => {
    root.replaceChildren();
    const matches = result.matches || [];
    if (!matches.length) {
      // Engine found nothing feasible for the brief — honest empty, not a fake.
      renderEmptyPool();
      return;
    }
    // Engine wins; taste only re-ranks WITHIN the returned feasible set (§5.3).
    const hero = pickHero(matches);
    const thin = state.kept.length <= 1;
    const weak = hero.score < WEAK_SCORE || hasUnmet(result.unmet);

    const screen = el('div', 'vm-screen vm-mingle-result');
    if (!reducedMotion) confetti(screen);

    screen.append(el('p', 'vm-kicker vm-mingle-match-kicker', copy.matchKicker));
    screen.append(el('h2', 'vm-title', thin ? copy.thinTitle : copy.matchTitle({ model: hero.car.name })));
    screen.append(el('p', 'vm-lede', thin ? copy.thinLede : copy.matchLede));

    // Hero card
    screen.append(buildHero(hero));

    // Why — the engine's real reasons, flirtily introduced, with a swipe callback.
    if (hero.reasons?.length) {
      const why = el('div', 'vm-mingle-why');
      why.append(el('p', 'vm-mingle-why-intro', copy.whyIntro));
      const list = el('ul', 'vm-mingle-why-list');
      hero.reasons.forEach((r) => list.append(el('li', 'vm-mingle-why-item', r)));
      why.append(list);
      const trait = swipeTrait();
      if (trait && !thin) why.append(el('p', 'vm-mingle-callback', copy.swipeCallback({ trait })));
      screen.append(why);
    }

    // The one honest beat, when the engine's own signal is weak (§6.2).
    if (weak) screen.append(el('p', 'vm-mingle-weak-note', copy.weakNote.replace(/\*(.+?)\*/g, '$1')));

    screen.append(buildResultCtas(hero));
    root.append(screen);
  };

  // Re-rank the engine's feasible matches by swipe taste, then take the top.
  // NEVER promotes a car the engine didn't return — it only reorders within
  // `matches` (§5.3 step 3). With no kept signal, the engine's own order stands.
  const pickHero = (matches) => {
    if (state.kept.length === 0) return matches[0];
    const wantBody = modal(state.kept.map((c) => c.body))?.value;
    const wantFuel = modal(state.kept.map((c) => c.fuel))?.value;
    const wantShade = modal(state.kept.map((c) => shadeOf(c)).filter(Boolean))?.value;
    const affinity = (m) => (m.car.body === wantBody ? 2 : 0)
      + (m.car.fuel === wantFuel ? 2 : 0)
      + (shadeOf(m.car) === wantShade ? 1 : 0);
    // Stable: only reorder on a real taste tie-break, engine score leads.
    return matches
      .map((m, i) => ({ m, i, aff: affinity(m) }))
      .sort((a, b) => (b.m.score - a.m.score) || (b.aff - a.aff) || (a.i - b.i))[0].m;
  };

  // The single trait to name in the swipe callback — the strongest kept signal.
  const swipeTrait = () => {
    const fuel = modal(state.kept.map((c) => c.fuel));
    if (fuel && fuel.share >= 0.5) return fuel.value;
    const shade = modal(state.kept.map((c) => shadeOf(c)).filter(Boolean));
    if (shade && shade.share >= 0.5) return shade.value;
    const body = modal(state.kept.map((c) => c.body));
    if (body && body.share >= 0.5) return body.value;
    return null;
  };

  const hasUnmet = (unmet) => unmet && Object.values(unmet).some((v) => Array.isArray(v) && v.length);

  const buildHero = (match) => {
    const { car } = match;
    const card = el('article', 'vm-mingle-hero');
    card.style.setProperty('--vm-mingle-swatch', swatchFor(car));
    card.append(el('div', 'vm-mingle-card-colour'));
    const media = el('div', 'vm-mingle-card-media');
    if (car.photo) {
      const img = el('img', 'vm-mingle-card-photo');
      img.src = car.photo; img.alt = car.name; img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); media.classList.add('no-photo'); });
      media.append(img);
    } else {
      media.classList.add('no-photo');
      media.append(el('span', 'vm-mingle-card-initial', (car.name || '?').charAt(0)));
    }
    card.append(media);
    const body = el('div', 'vm-mingle-card-body');
    body.append(el('h3', 'vm-mingle-card-name', car.name));
    if (car.line) body.append(el('p', 'vm-mingle-card-spec', car.line));
    body.append(el('p', 'vm-mingle-card-price', priceLabel(car)));
    const pills = el('div', 'vm-mingle-pills');
    if (car.fuel) pills.append(el('span', 'vm-mingle-pill', cap(car.fuel)));
    if (car.body) pills.append(el('span', 'vm-mingle-pill', cap(car.body)));
    const shade = car.colour?.manufacturerColour;
    if (shade) pills.append(el('span', 'vm-mingle-pill', shade));
    body.append(pills);
    card.append(body);
    return card;
  };

  const buildResultCtas = (hero) => {
    const wrap = el('div', 'vm-mingle-ctas');
    // Test drive — the campaign hook. Routes to the car's real PDP/enquiry.
    const drive = el('a', 'vm-btn vm-btn-primary vm-mingle-drive', copy.testDriveCta);
    if (hero.car.link) { drive.href = hero.car.link; drive.target = '_blank'; drive.rel = 'noopener'; }
    wrap.append(drive);

    const details = el('a', 'vm-btn vm-btn-ghost', copy.detailsCta);
    if (hero.car.link) { details.href = hero.car.link; details.target = '_blank'; details.rel = 'noopener'; }
    wrap.append(details);

    // Share — Web Share where available, copy-link fallback.
    const share = el('button', 'vm-btn vm-btn-ghost vm-mingle-share', copy.shareCta);
    share.type = 'button';
    share.addEventListener('click', () => doShare(hero, share));
    wrap.append(share);

    const again = el('button', 'vm-mingle-link vm-mingle-again', copy.againCta);
    again.type = 'button';
    again.addEventListener('click', () => loadDeck()); // fresh reshuffled deck, same seed
    wrap.append(again);
    return wrap;
  };

  const doShare = async (hero, btn) => {
    const text = copy.shareText({ model: hero.car.name, retailer: ctx.retailerLabel || 'MINI' });
    // Own hash key — never the questions mode's #m=. v1 links back to the mode;
    // the richer "landing shows their match" is a fast-follow (spec §6.3/§10).
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#mingle=1`;
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch { /* user dismissed — no-op */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      btn.textContent = copy.shareCopied;
    } catch { /* clipboard blocked — leave the label */ }
  };

  /* A small, self-contained confetti burst on the match reveal (§8). Particle
   * colour from --vm-accent-spot so a brand skin re-tints it. Gated on
   * reduced-motion by the caller. */
  const confetti = (host) => {
    const layer = el('div', 'vm-mingle-confetti');
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i += 1) {
      const bit = el('span', 'vm-mingle-confetti-bit');
      bit.style.left = `${(i / 24) * 100}%`;
      bit.style.animationDelay = `${(i % 6) * 0.06}s`;
      layer.append(bit);
    }
    host.append(layer);
  };

  /* ------------------------------ boot ------------------------------
   * The seed's budget bands and "what's it for" tiles are per-brand, and the
   * brand's authored labels + budget ceiling live behind apiGetQuestions — so,
   * like the questions mode, we fetch that first. mount stays synchronous: it
   * paints the seed skeleton now and does the fetch in this detached boot(), so
   * the shell never awaits a cold backend. apiGetQuestions THROWS on failure
   * (it's load-bearing here — no questions, no seed), so guard it and offer a
   * retry that re-boots. */
  const boot = async () => {
    try {
      const { questions } = await apiGetQuestions(ctx.api, ctx.retailer, ctx.brand);
      state.questions = Array.isArray(questions) ? questions : [];
    } catch {
      showError(boot);
      return;
    }
    renderSeed(state.seed);
  };

  renderSeedSkeleton();
  boot();
}

// The switcher tab is brand-agnostic shell UI, so its label is neutral —
// "Swipe", not "MINI Mingle". The campaign name lives as the wordmark INSIDE
// the stage (MINGLE_COPY[brand].wordmark), where it can vary by brand; the
// mode's static `label` can't (spec §9). key stays 'mingle' — the ?mode= and
// authored "Mode" value are unchanged.
export default { key: 'mingle', label: 'Swipe', mount };
