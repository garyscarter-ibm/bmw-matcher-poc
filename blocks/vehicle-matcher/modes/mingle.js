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

import { apiGetQuestions, apiField, apiMatch } from '../engine.js';
import { el } from '../ui.js';
import {
  WEAK_SCORE, SHADE_HEX, NEUTRAL_SWATCH,
  budgetBandsFromQuestion, useTilesFromQuestion,
  shuffle, photosFirst, shadeOf, swatchFor, priceLabel, cap, gbpShort,
  modal, rankByFrequency, swipesToAnswers, celebrate,
} from './match-signal.js';

/* How many cards make a good swipe session — enough to read a taste, few enough
 * not to become a chore (§4.2). We sample the pool down to this. */
const DECK_TARGET = 10;

/* …but ask the field for a wider pool than we deal, so photosFirst has spares to
 * drop: a photo-less car (or a shared-placeholder one) only reaches the deck when
 * there aren't DECK_TARGET real-photo cars to fill it. Matches the knockout's
 * MAX_FIELD, and stays small enough to pay the per-card colour paint on. */
const DECK_POOL = 16;

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
    seedCta: 'Start swiping',
    // NB: the budget bands and the "what's it for" options are NOT copy — they
    // come from the engine per brand (apiGetQuestions → the `budget` and
    // `primaryUse` questions), so MINI's own labels and MINI-scale budget show
    // without duplicating the source of truth. Only the seed's framing lives here.
    // Deck
    deckInstruction: 'Drag right for yes, left for no — or tap. Keep the ones that catch your eye.',
    passLabel: 'Pass',
    keepLabel: 'Keep',
    // Drag stamps — the big word that lands on the card as you pull it.
    stampKeep: 'KEEP',
    stampPass: 'NOPE',
    undoLabel: '↩ Bring that one back',
    revealLabel: 'Reveal my match',
    progress: ({ done, total }) => `${done} of ${total}`,
    // Flirty card badges — flavour, never a scored verdict (§4.4). Warmer ones
    // are nudged toward higher-scoring cards, but nothing here is negative.
    badgesWarm: ['Hot right now', 'Strong chemistry', 'Head-turner'],
    badgesCool: ['Your type?', 'Plays hard to get', 'Bit of a charmer'],
    // Taste profile
    tasteHeading: 'Your type, so far',
    tasteEmpty: 'Nothing yet — start swiping.',
    keptHeading: 'Caught your eye',
    barLabels: {
      fuel: 'Fuel', colour: 'Colour', budget: 'Budget', body: 'Body',
    },
    // Result
    matchKicker: 'It’s a match!',
    matchTitle: ({ model }) => `You and the ${model}.`,
    matchLede: 'Your heart’s made up its mind.',
    // The "why" — engine reasons wear a flirty coat; a swipe callback makes it
    // feel earned. reasons is the engine's real reasons[] (may be short).
    whyIntro: 'Why you two work:',
    swipeCallback: ({ trait }) => `And it’s the ${trait} one you kept leaning toward.`,
    // Thin signal (≤1 keep): matched on the seed alone, said playfully (§5.3).
    thinTitle: 'Playing it cool, then.',
    thinLede: 'You kept your cards close — so here’s the best fit for what you told us.',
    // Honest "not quite" note — the engine's own weak/unmet signal, in character
    // (§6.2). Reuses the concept behind the questions mode's weak/rescue copy.
    weakNote: 'Full disclosure, though — none of these *quite* nailed your taste. '
      + 'Stock changes every week, so it’s worth another swipe soon.',
    // CTAs + share
    testDriveCta: 'Book a Valentine’s test drive',
    detailsCta: 'See full details',
    shareCta: 'Share your match',
    shareCopied: 'Link copied',
    againCta: 'Swipe again',
    shareText: ({ model, retailer }) => `I matched with a ${model} at ${retailer}. `
      + 'What’s your type?',
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
    deckInstruction: 'Drag right to keep, left to pass — or use the buttons.',
    passLabel: 'Pass',
    keepLabel: 'Keep',
    stampKeep: 'KEEP',
    stampPass: 'PASS',
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
 * The colour table (SHADE_HEX/NEUTRAL_SWATCH), the seed helpers, the deck/shade/
 * price/format helpers and the swipe→answers inference all live in
 * ./match-signal.js now — shared with the knockout mode so the two games read
 * taste and build the engine brief the same way. This file keeps only the
 * swipe-specific copy, state and rendering.
 */

/* ------------------------------ helpers ------------------------------ */

/** Copy for the active brand, BMW as the fallback (matches ctx.brand shape). */
const copyFor = (brand) => MINGLE_COPY[brand] || MINGLE_COPY.bmw;

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
    // Skeleton the deck panel while /api/field is in flight. Not the seed —
    // this is the swipe stage arriving.
    renderDeckSkeleton();
    // apiField resolves-empty (never throws), so no try/catch needed here. The
    // swipe deck asks for a DECK_POOL of cars WITH colour paint (enrich: true) —
    // card paint and the "Colour" bar read car.colour as a taste signal, and the
    // pool is small enough to pay the per-card PDP fetch. (The knockout omits
    // enrich; see knockout.js.)
    const matches = await apiField(ctx.api, state.seed, ctx.retailer, ctx.brand, DECK_POOL, true);
    if (!matches.length) {
      renderEmptyPool();
      return;
    }
    // Shuffle for variety, then float the real-photo cars to the front (a
    // photo-less or placeholder-photo card is a weak swipe — §5.1) before dealing
    // the top DECK_TARGET. With a full pool the no-photo cars simply don't make
    // the deck; on a thin feed they fill the tail rather than starving it.
    state.deck = photosFirst(shuffle(matches), (m) => m.car?.photo).slice(0, DECK_TARGET);
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

    // Make the front card draggable (pointer). The buttons/keys below stay the
    // source of truth; drag is an enhancement that reuses the same doSwipe
    // commit. No-op under reduced motion (drag would fight the instant commit).
    if (!reducedMotion) {
      const front = stack.querySelector('.vm-mingle-card-0');
      if (front) dragToSwipe(front);
    }

    // Controls — the source of truth (buttons; gesture/keys mirror them).
    const controls = el('div', 'vm-mingle-controls');
    const passBtn = el('button', 'vm-mingle-swipe vm-mingle-pass');
    passBtn.type = 'button';
    passBtn.setAttribute('aria-label', copy.passLabel);
    passBtn.append(el('span', 'vm-mingle-swipe-text', copy.passLabel));
    const keepBtn = el('button', 'vm-mingle-swipe vm-mingle-keep');
    keepBtn.type = 'button';
    keepBtn.setAttribute('aria-label', copy.keepLabel);
    keepBtn.append(el('span', 'vm-mingle-swipe-text', copy.keepLabel));
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

    // Drag stamps — only the front card is live, so only it carries them. They
    // sit hidden (opacity 0) until dragToSwipe raises the one matching the
    // direction of pull. Purely decorative; the buttons remain the a11y truth.
    if (depth === 0) {
      const keepStamp = el('span', 'vm-mingle-stamp vm-mingle-stamp-keep', copy.stampKeep);
      const passStamp = el('span', 'vm-mingle-stamp vm-mingle-stamp-pass', copy.stampPass);
      keepStamp.setAttribute('aria-hidden', 'true');
      passStamp.setAttribute('aria-hidden', 'true');
      card.append(keepStamp, passStamp);
    }

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
  // Commit a swipe. `viaDrag` means the card is ALREADY displaced by a finger
  // drag past the threshold, so we let it finish flying under its own transform
  // rather than re-triggering the class-based fly-out from centre.
  const doSwipe = (keep, viaDrag = false) => {
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
    if (viaDrag) {
      // The drag handler removed its inline transform and stamped the direction
      // class; the card is on its way out. Just advance when the CSS finishes.
      window.setTimeout(commit, 280);
      return;
    }
    front.classList.add(keep ? 'is-flying-right' : 'is-flying-left');
    // Advance after the fly-out (prototype uses ~280ms; match the CSS 0.3s).
    window.setTimeout(commit, 280);
  };

  /*
   * Pointer-drag on the front card: it follows the finger with a slight tilt, a
   * KEEP/PASS stamp fades in with the pull, and releasing past a threshold (or a
   * quick flick) commits that swipe via doSwipe; releasing short springs it back.
   * This is the "feels like a swipe" layer over the button-driven model — the
   * buttons and arrow keys still do exactly what they did, and this is skipped
   * entirely under reduced motion (see the caller). Listeners live on THIS card;
   * a re-render (renderDeck) throws the card away, so nothing leaks — and the
   * document-level move/up listeners are removed the moment the gesture ends.
   */
  const dragToSwipe = (card) => {
    let startX = 0;
    let startT = 0;
    let dx = 0;
    let dragging = false;
    // Commit past ~32% of the card width, or a fast flick in either direction.
    const threshold = () => Math.max(64, card.offsetWidth * 0.32);

    const onMove = (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const tilt = dx / 18; // deg — gentle
      card.style.transform = `translateX(${dx}px) rotate(${tilt}deg)`;
      // Stamp opacity ramps to 1 by the threshold; only the matching one shows.
      const ratio = Math.min(1, Math.abs(dx) / threshold());
      card.classList.toggle('is-dragging-keep', dx > 8);
      card.classList.toggle('is-dragging-pass', dx < -8);
      card.style.setProperty('--vm-drag-stamp', String(ratio));
    };

    const cleanup = () => {
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    const onUp = (e) => {
      if (!dragging) return;
      cleanup();
      const elapsed = (e.timeStamp || 0) - startT;
      const flick = Math.abs(dx) > 48 && elapsed < 250;
      const past = Math.abs(dx) >= threshold() || flick;
      card.classList.remove('is-dragging-keep', 'is-dragging-pass');
      if (past && !state.busy && state.index < state.deck.length) {
        // Hand off to the fly-out: clear the inline transform so the direction
        // class drives it, then commit on the shared path.
        const keep = dx > 0;
        card.style.transform = '';
        card.style.removeProperty('--vm-drag-stamp');
        card.classList.add(keep ? 'is-flying-right' : 'is-flying-left');
        doSwipe(keep, true);
      } else {
        // Short pull — spring back to centre.
        card.classList.add('is-returning');
        card.style.transform = '';
        card.style.removeProperty('--vm-drag-stamp');
        card.addEventListener('transitionend', () => card.classList.remove('is-returning'), { once: true });
      }
    };

    card.addEventListener('pointerdown', (e) => {
      // Ignore secondary buttons and any pull once a swipe is mid-flight.
      if (state.busy || (e.button && e.button !== 0)) return;
      dragging = true;
      startX = e.clientX;
      startT = e.timeStamp || 0;
      dx = 0;
      card.classList.remove('is-returning');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
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
    if (!reducedMotion) celebrate(screen, { brand: ctx.brand });

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
    // Entrance: a spring/precise settle as the match lands (CSS + --vm-ease).
    if (!reducedMotion) card.classList.add('is-revealing');
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

  /* The confetti burst on the match reveal is the shared celebrate() helper
   * (match-signal.js), so the swipe and knockout crescendos can't drift. */

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
