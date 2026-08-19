/*
 * Podium — the matcher as a live readout: all questions on the left, a ranked podium re-ordering
 * per answer (grouped /api/preview), COMMIT to /api/match for real reasons. See docs/podium-requirements.md.
 */

import { apiGetQuestions, apiMatch } from '../engine.js';
import { el } from '../ui.js';
import { BRAND_COPY, UNMET_PHRASES, orList } from './brand-copy.js';
import {
  visibleQuestions, renderRangeSlider, renderOptionList, formatSliderValue,
} from './question-ui.js';
import { createPreviewFeed } from './preview-feed.js';
import { matchCard } from './result-card.js';
import {
  WEAK_SCORE, celebrate, shadeOf, cap, idOf,
} from './match-signal.js';

/*
 * How far apart two scores may be and still count as a tie. Mirrors the engine's own
 * CLUSTER_PTS, so the LIVE state (only `score`, no `decisive`) re-derives the tie the server would.
 */
const CLUSTER_PTS = 3;

/** Steps on the podium. Three medals, no more, whatever the pool holds. */
const STEP_MAX = 3;

/** Cars under "also worth a look". Four: a tail, not a second results page. */
const TAIL_MAX = 4;

/** Popover width (PRD) and the margin it keeps from the viewport edge. Only
 * used for the clamp; the real width is the stylesheet's. */
const POP_WIDTH = 272;
const POP_MARGIN = 8;

/** How long a dismissed card fades for before the podium re-ranks. Mirrors the
 * CSS transition; the re-rank is the point, the fade is just the handover. */
const DISMISS_MS = 350;

/** How long the steps carry .is-updating while a re-rank cross-fades in. */
const UPDATE_MS = 180;

/* ------------------------------ copy ------------------------------ */

/*
 * Display copy, keyed by brand with a `bmw` fallback, written out per brand (the mode's own
 * campaign voice). Card copy and tie copy live in brand-copy.js so both modes describe cars alike.
 */
const PODIUM_COPY = {
  // MINI: the primary written voice. Uppercase-with-a-full-stop title, warm and
  // spirited underneath, never slangy.
  mini: {
    wordmark: 'MINI Podium',
    title: 'YOUR TOP THREE, LIVE.',
    lede: 'Tell us what you’re after on the left. The podium on the right shuffles '
      + 'as you go. No waiting about.',
    bannerStart: 'Nothing decided yet. We’ve made a start from your budget anyway.',
    bannerProgress: ({ done, total }) => `${done} of ${total} down. The order moves with every answer.`,
    bannerComplete: 'That’s the lot answered. Go on then, make it official.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Having a proper look',
    commitDone: 'That’s your match',
    commitError: 'Couldn’t reach the matcher there. Give it another go.',
    ranks: ['1st', '2nd', '3rd'],
    jointRank: 'Joint 1st',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model}’s out in front so far.`,
    emptyNote: 'That’s the lot ruled out. Loosen the brief and we’ll find you some more.',
    // The honest note, committed only. Names what’s missing with the shared
    // UNMET_PHRASES vocabulary, then owns it. A shrug, never an apology.
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} just now. `
      + 'This lot is the closest we’ve got to the rest of your brief.',
    weakNote: ({ retailer }) => `We haven’t got your MINI at ${retailer} this week. `
      + 'Here’s the nearest we’ve got, but none of them is it.',
    rejectLabel: 'Not this one',
    popTitle: 'Go on then, what’s wrong with it?',
    popCancel: 'Keep it',
    popBack: 'Back',
    popDone: 'Off the list',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Size',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not feeling it',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuels are you after?',
      size: 'What shape were you after, then?',
      mileage: 'How far do you roam?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}, thanks`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // BMW: assured and understated, the approved-used register. States the fact,
  // names the retailer, doesn’t dress it up.
  bmw: {
    wordmark: 'Your Shortlist',
    title: 'Your top three, live.',
    lede: 'Answer what matters on the left. The three cars on the right re-order '
      + 'as you go, and the button confirms it.',
    bannerStart: 'Nothing committed yet. The podium is already working from your budget.',
    bannerProgress: ({ done, total }) => `${done} of ${total} answered. The order updates with each one.`,
    bannerComplete: 'That’s everything answered. Confirm when you’re ready.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Checking the stock',
    commitDone: 'Match confirmed',
    commitError: 'We couldn’t reach the matcher. Try that again.',
    ranks: ['1st', '2nd', '3rd'],
    jointRank: 'Joint 1st',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model} leads on your answers so far.`,
    emptyNote: 'Nothing left to show. Widen the brief and we’ll fill it back up.',
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} right now. `
      + 'This order is the closest to everything else you asked for.',
    weakNote: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for. `
      + 'These are the nearest we hold.',
    rejectLabel: 'Not this one',
    popTitle: 'Why not this one?',
    popCancel: 'Keep this one',
    popBack: 'Back',
    popDone: 'Remove this car',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Size',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not for me',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuel types suit you better?',
      size: 'What shape were you after?',
      mileage: 'How many miles a year, roughly?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Honda: plain, warm and practical. Talks about fit and sense rather than
  // driving pleasure, and never oversells.
  honda: {
    wordmark: 'Your Shortlist',
    title: 'Your top three, live.',
    lede: 'Answer what you can on the left. The three cars on the right re-order '
      + 'as you go, and the button confirms it.',
    bannerStart: 'Nothing committed yet. The shortlist is already working from your budget.',
    bannerProgress: ({ done, total }) => `${done} of ${total} answered. The order updates with each one.`,
    bannerComplete: 'That’s everything answered. Confirm when you’re ready.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Checking the stock',
    commitDone: 'Match confirmed',
    commitError: 'We couldn’t reach the matcher. Try that again.',
    ranks: ['1st', '2nd', '3rd'],
    jointRank: 'Joint 1st',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model} leads on your answers so far.`,
    emptyNote: 'Nothing left to show. Widen the brief and we’ll fill it back up.',
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} right now. `
      + 'This order is the closest to everything else you told us.',
    weakNote: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for. `
      + 'These are the nearest we hold.',
    rejectLabel: 'Not this one',
    popTitle: 'Why not this one?',
    popCancel: 'Keep this one',
    popBack: 'Back',
    popDone: 'Remove this car',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Size',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not for me',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuel types suit you better?',
      size: 'What shape were you after?',
      mileage: 'How many miles a year, roughly?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Ford: friendly, confident and plainly British, with a little more spirit
  // than Honda’s. Proud of being the sensible choice, happy to enjoy itself.
  ford: {
    wordmark: 'Your Shortlist',
    title: 'Your top three, live.',
    lede: 'Answer what matters on the left. The three cars on the right re-order '
      + 'as you go, and the button makes it official.',
    bannerStart: 'Nothing committed yet. We’ve made a start from your budget.',
    bannerProgress: ({ done, total }) => `${done} of ${total} answered. The order shifts with each one.`,
    bannerComplete: 'That’s everything answered. Confirm whenever you’re ready.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Checking the stock',
    commitDone: 'Match confirmed',
    commitError: 'We couldn’t reach the matcher. Give it another go.',
    ranks: ['1st', '2nd', '3rd'],
    jointRank: 'Joint 1st',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model} leads on your answers so far.`,
    emptyNote: 'Nothing left to show. Widen the brief and we’ll fill it back up.',
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} right now. `
      + 'This order is the closest to everything else you told us.',
    weakNote: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for. `
      + 'These are the nearest we hold.',
    rejectLabel: 'Not this one',
    popTitle: 'Why not this one?',
    popCancel: 'Keep this one',
    popBack: 'Back',
    popDone: 'Remove this car',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Size',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not for me',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuel types suit you better?',
      size: 'What shape were you after?',
      mileage: 'How many miles a year, roughly?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Motorrad: rider-first and technical. Every car word becomes a bike word,
  // and `size` is the wrong axis for a bike, so the reason is the riding style.
  motorrad: {
    wordmark: 'Your Shortlist',
    title: 'Your top three bikes, live.',
    lede: 'Answer what matters on the left. The three bikes on the right re-order '
      + 'as you go, and the button confirms it.',
    bannerStart: 'Nothing committed yet. The shortlist is already working from your budget.',
    bannerProgress: ({ done, total }) => `${done} of ${total} answered. The order updates with each one.`,
    bannerComplete: 'That’s everything answered. Confirm when you’re ready.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Checking the stock',
    commitDone: 'Match confirmed',
    commitError: 'We couldn’t reach the matcher. Try that again.',
    ranks: ['1st', '2nd', '3rd'],
    jointRank: 'Joint 1st',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model} leads on your answers so far.`,
    emptyNote: 'Nothing left to show. Widen the brief and we’ll fill it back up.',
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} right now. `
      + 'This order is the closest to everything else you asked for.',
    weakNote: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for. `
      + 'These are the nearest we hold.',
    rejectLabel: 'Not this one',
    popTitle: 'Why not this one?',
    popCancel: 'Keep this one',
    popBack: 'Back',
    popDone: 'Remove this bike',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Style of bike',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not for me',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuel types suit you better?',
      size: 'What kind of riding is it for?',
      mileage: 'How many miles a year, roughly?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Ferrari: warm, unhurried, heritage-proud, and the one brand for which "podium" is
  // native (hence P1/P2/P3); its shape reason is body style (coupé/Spider/Purosangue), not "size".
  ferrari: {
    wordmark: 'The Podium',
    title: 'Your top three, live.',
    lede: 'Tell us how you drive on the left. The order on the right forms as you '
      + 'go, and the button settles it.',
    bannerStart: 'Nothing settled yet. The order has started from your budget.',
    bannerProgress: ({ done, total }) => `${done} of ${total} answered. The order changes with each one.`,
    bannerComplete: 'That’s everything answered. Settle it when you’re ready.',
    commitCta: 'Find my perfect match',
    commitBusy: 'Looking through the stock',
    commitDone: 'Match confirmed',
    commitError: 'We couldn’t reach the matcher. Please try again.',
    ranks: ['P1', 'P2', 'P3'],
    jointRank: 'Joint P1',
    tailHeading: 'Also worth a look',
    liveUpdated: ({ model }) => `The ${model} heads the order so far.`,
    emptyNote: 'Nothing left to show. Open the brief up and we’ll fill it again.',
    unmetNote: ({ list, retailer }) => `No ${list} at ${retailer} just now. `
      + 'This order is the closest to everything else you told us.',
    weakNote: ({ retailer }) => `Nothing at ${retailer} is close to what you asked for. `
      + 'These are the nearest we hold, and none of them is quite it.',
    rejectLabel: 'Not this one',
    popTitle: 'Why not this one?',
    popCancel: 'Keep this one',
    popBack: 'Back',
    popDone: 'Take it off the list',
    reasons: {
      price: 'Price',
      fuel: 'Fuel type',
      size: 'Body style',
      mileage: 'Mileage',
      colour: 'Colour',
      just: 'Just not for me',
    },
    prompts: {
      price: 'What would you rather spend?',
      fuel: 'Which fuel types suit you better?',
      size: 'Which shape were you after?',
      mileage: 'How many miles a year, roughly?',
      colour: 'Rule that colour out?',
    },
    colourOption: ({ shade }) => `Nothing in ${shade}`,
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
};

/* ------------------------------ helpers ------------------------------ */

/** Copy for the active brand, BMW as the fallback (matches ctx.brand shape). */
const copyFor = (brand) => PODIUM_COPY[brand] || PODIUM_COPY.bmw;

/*
 * The scannable short NOUN eyebrow above each question block ("02 / Fuel type"), since the
 * `title` is the full question. Unknown ids fall back to their spaced, capitalised name.
 */
const Q_LABELS = {
  budget: 'Budget',
  bodyStyles: 'Body style',
  doors: 'Doors',
  fuel: 'Fuel type',
  charging: 'Charging',
  primaryUse: 'Main use',
  people: 'Who’s on board',
  miniVibe: 'Character',
  mileage: 'Yearly miles',
  style: 'Character',
  priorities: 'Priorities',
  ridingStyle: 'Riding style',
  licence: 'Licence',
};

/** Motorrad's bodyStyles options are bike categories, not car shapes, so the
 * generic eyebrow would mislabel them. Per-brand overrides only. */
const Q_LABELS_BY_BRAND = {
  motorrad: { bodyStyles: 'Bike style' },
};

function shortLabel(q, brand) {
  const override = Q_LABELS_BY_BRAND[brand]?.[q.id];
  if (override) return override;
  if (Q_LABELS[q.id]) return Q_LABELS[q.id];
  const spaced = String(q.id).replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/*
 * A single-thumb slider (mileage) writing a NUMBER to answers[q.id]. Reimplemented here to
 * questionnaire.js's contract (same markup, immediate persistence, onChange) since it's not shared.
 */
function renderValueSlider(list, q, answers, { onChange } = {}) {
  const stored = answers[q.id];
  const start = typeof stored === 'number'
    ? stored
    : (typeof q.default === 'number' ? q.default : q.min);
  // Persist immediately: the answer exists even if nobody drags it.
  answers[q.id] = start;

  const readout = el('output', 'vm-slider-value', formatSliderValue(start, q));
  const input = el('input', 'vm-slider-input');
  input.type = 'range';
  input.min = String(q.min);
  input.max = String(q.max);
  input.step = String(q.step);
  input.value = String(start);
  input.setAttribute('aria-label', q.title);
  input.setAttribute('aria-valuetext', formatSliderValue(start, q));

  input.addEventListener('input', () => {
    const value = Number(input.value);
    answers[q.id] = value;
    const text = formatSliderValue(value, q);
    readout.textContent = text;
    input.setAttribute('aria-valuetext', text);
    onChange?.();
  });

  const bounds = el('div', 'vm-slider-bounds');
  bounds.append(
    el('span', 'vm-slider-min', formatSliderValue(q.min, q)),
    el('span', 'vm-slider-max', formatSliderValue(q.max, q)),
  );

  list.append(readout, input, bounds);
}

/** The unmet wants as brand-voiced plural phrases, fuel first then shape.
 *  Same reading as the questionnaire's note, from the same shared table. */
function unmetPhrases(brandKey, unmet) {
  if (!unmet) return [];
  const phrases = UNMET_PHRASES[brandKey] || UNMET_PHRASES.bmw;
  return ['fuel', 'bodyStyles'].flatMap(
    (id) => (unmet[id] || []).map((v) => phrases[id]?.[v] || v),
  );
}

/** Focusable controls inside an open popover, for the Tab cycle. */
function focusablesIn(host) {
  return [...host.querySelectorAll('button, input, a[href], [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.disabled && !node.closest('[hidden]'));
}

/* ------------------------------ mount ------------------------------ */

function mount(root, ctx) {
  const copy = copyFor(ctx.brand);
  const brandCopy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;

  // Per-run state — a fresh local object, NOT hung on the shared ctx, so a mode swap and
  // re-mount starts clean. Nothing here is allowed to outlive this mount.
  const state = {
    questions: [], // the engine's per-brand question set
    answers: {}, // the brief, written by the widgets themselves
    live: [], // latest grouped /api/preview result
    committed: null, // latest /api/match result, or null while live
    // A dismissal made AFTER committing invalidates the engine's `decisive`/`clusterSize`
    // (their list's leader may be gone), so the tie check falls back to the inferred one.
    dismissedSinceCommit: false,
    dismissed: new Set(), // idOf(car) for cards turned down this run
    shadeBan: new Set(), // shades ruled out by the colour branch (client-side)
    holdPaint: false, // popover open: defer repaints so its anchor survives
    pendingPaint: false, // a repaint was held and is owed
    pop: null, // { trigger, match, target, shadePick, editedQid }
  };

  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Grouped: three medals read as three choices, so they mustn't be one model in three
  // colours (§3.4). One feed for the whole run owns its debounce and in-flight requests.
  const feed = createPreviewFeed({
    api: ctx.api, retailer: ctx.retailer, brand: ctx.brand, group: true,
  });

  // Live DOM the paint functions write into, assigned by buildStage().
  let stage = null;
  let questionsWrap = null;
  let progressBar = null;
  let bannerEl = null;
  let commitBtn = null;
  let liveEl = null;
  let stepsEl = null;
  let tailEl = null;
  let tailGrid = null;
  let noteEl = null;
  let pop = null;
  let popStep1 = null;
  let popStep2 = null;
  let popReasons = null;
  let popBody = null;
  let popDone = null;

  // Question blocks by id, so a conditional can be spliced in or out without
  // touching its neighbours (see syncQuestions).
  const blocks = new Map();

  /* ---- error screen (the shared renderStatus pattern, as in mingle.js) ---- */
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

  /* --------------------------- skeleton --------------------------- */
  // Painted synchronously by mount() while apiGetQuestions is in flight, so the
  // shell never awaits a cold backend and the stage is never blank.
  const renderSkeleton = () => {
    root.replaceChildren();
    const shell = el('div', 'vm-podium vm-podium-skeleton');
    shell.setAttribute('aria-busy', 'true');
    shell.setAttribute('aria-label', 'Loading');
    const ask = el('section', 'vm-podium-ask');
    for (let i = 0; i < 5; i += 1) ask.append(el('div', 'vm-skel vm-skel-line'));
    const results = el('section', 'vm-podium-results');
    for (let i = 0; i < 3; i += 1) results.append(el('div', 'vm-skel vm-skel-line'));
    shell.append(ask, results);
    root.append(shell);
  };

  /* ---------------------------- the stage ---------------------------- */
  const buildStage = () => {
    root.replaceChildren();
    stage = el('div', 'vm-podium');

    // Left: the brief.
    const ask = el('section', 'vm-podium-ask');
    ask.append(
      el('p', 'vm-podium-wordmark', copy.wordmark),
      el('h2', 'vm-podium-title', copy.title),
      el('p', 'vm-podium-lede', copy.lede),
    );

    const progress = el('div', 'vm-podium-progress');
    progressBar = el('div', 'vm-podium-progress-bar');
    progress.append(progressBar);
    bannerEl = el('p', 'vm-podium-banner', copy.bannerStart);
    bannerEl.setAttribute('role', 'status');
    ask.append(progress, bannerEl);

    questionsWrap = el('div', 'vm-podium-questions');
    ask.append(questionsWrap);

    commitBtn = el('button', 'vm-btn vm-btn-primary vm-podium-commit', copy.commitCta);
    commitBtn.type = 'button';
    commitBtn.addEventListener('click', commit);
    ask.append(commitBtn);

    // Right: the readout.
    const results = el('section', 'vm-podium-results');
    liveEl = el('p', 'vm-podium-live');
    liveEl.setAttribute('role', 'status');
    liveEl.setAttribute('aria-live', 'polite');
    stepsEl = el('div', 'vm-podium-steps');
    // Focus lands here after a dismissal removes the card the focus was on.
    stepsEl.tabIndex = -1;
    tailEl = el('div', 'vm-podium-tail');
    tailEl.hidden = true;
    tailGrid = el('div', 'vm-podium-tail-grid');
    tailEl.append(el('h3', 'vm-subhead vm-podium-tail-head', copy.tailHeading), tailGrid);
    noteEl = el('p', 'vm-podium-note');
    noteEl.hidden = true;
    results.append(liveEl, stepsEl, tailEl, noteEl);

    stage.append(ask, results);
    stage.append(buildPopover());
    root.append(stage);

    syncQuestions();
    scheduleRefresh();
  };

  /* --------------------------- the questions --------------------------- */

  /*
   * Recompute the visible set and splice the difference in IN PLACE (blocks keyed by data-qid)
   * — a full rebuild would throw away scroll/focus and re-fire every entrance animation on each tap.
   */
  const syncQuestions = () => {
    const visible = visibleQuestions(state.questions, state.answers);
    const wanted = new Set(visible.map((q) => q.id));

    [...questionsWrap.children].forEach((node) => {
      const qid = node.dataset.qid;
      if (!wanted.has(qid)) {
        node.remove();
        blocks.delete(qid);
      }
    });

    visible.forEach((q, i) => {
      let node = blocks.get(q.id);
      if (!node) {
        node = buildQuestion(q, i);
        blocks.set(q.id, node);
      }
      // Insert (or leave alone): children[i] is already the right node in the
      // common case, so nothing in the DOM is touched.
      const current = questionsWrap.children[i];
      if (current !== node) questionsWrap.insertBefore(node, current || null);
      const label = node.querySelector('.vm-podium-q-label');
      if (label) label.textContent = `${String(i + 1).padStart(2, '0')} / ${shortLabel(q, ctx.brand)}`;
    });

    updateProgress(visible);
  };

  const buildQuestion = (q, index) => {
    const block = el('div', 'vm-podium-q');
    block.dataset.qid = q.id;
    block.append(
      el('p', 'vm-podium-q-label', `${String(index + 1).padStart(2, '0')} / ${shortLabel(q, ctx.brand)}`),
      el('h3', 'vm-podium-q-title', q.title),
    );
    if (q.help) block.append(el('p', 'vm-podium-q-help', q.help));
    block.append(buildControl(q, state.answers, answerChanged));
    return block;
  };

  /*
   * The control for one question, in the questionnaire's same three shapes so a11y is
   * inherited. Shared by the left pane and the popover, so a follow-up matches its question.
   */
  const buildControl = (q, answers, onChange) => {
    if (q.type === 'slider') {
      const list = el('div', 'vm-options vm-slider');
      if (q.range) renderRangeSlider(list, q, answers, { onChange });
      else renderValueSlider(list, q, answers, { onChange });
      return list;
    }
    const { list } = renderOptionList(q, answers, { onChange });
    return list;
  };

  /** Answered = a value that would actually reach the engine. Both sliders persist on
   *  render, so the bar starts honestly above zero rather than pretending nothing is known. */
  const isAnswered = (q) => {
    const v = state.answers[q.id];
    if (Array.isArray(v)) return v.length > 0;
    return v != null && v !== '';
  };

  const updateProgress = (visible) => {
    const total = visible.length || 1;
    const done = visible.filter(isAnswered).length;
    progressBar.style.width = `${Math.round((done / total) * 100)}%`;
    if (done === 0) bannerEl.textContent = copy.bannerStart;
    else if (done >= visible.length) bannerEl.textContent = copy.bannerComplete;
    else bannerEl.textContent = copy.bannerProgress({ done, total: visible.length });
  };

  /*
   * Every answer change (left pane or popover): drop the committed state, re-diff the visible
   * set, schedule the preview — in that order, so a committed podium stops claiming stale results.
   */
  function answerChanged() {
    if (state.committed) dropToLive();
    syncQuestions();
    scheduleRefresh();
  }

  const scheduleRefresh = () => {
    feed.schedule(state.answers, (matches) => {
      state.live = Array.isArray(matches) ? matches : [];
      // A preview landing after a commit is kept but not painted: the committed state is
      // the more informed answer, and it stays until an answer actually changes.
      if (!state.committed) paintResults();
    });
  };

  /* --------------------------- the commit beat --------------------------- */

  async function commit() {
    commitBtn.disabled = true;
    commitBtn.textContent = copy.commitBusy;
    // Drop any pending preview: its answer set is the one we are about to ask
    // the full question about, and a late live paint would undo the commit.
    feed.cancel();
    let result;
    try {
      // The identical call the questionnaire mode makes. THROWS on failure.
      result = await apiMatch(ctx.api, state.answers, ctx.retailer, ctx.brand);
    } catch {
      // Not a dead end and not a whole error screen: the podium on screen is
      // still true, so say what happened and re-arm the button.
      commitBtn.disabled = false;
      commitBtn.textContent = copy.commitCta;
      noteEl.hidden = false;
      noteEl.textContent = copy.commitError;
      return;
    }
    state.committed = result;
    state.dismissedSinceCommit = false;
    stage.classList.add('is-committed');
    commitBtn.textContent = copy.commitDone;
    paintResults();
    // The payoff for pressing the button. Gated on reduced motion here as well
    // as in the CSS, so the JS never even builds the layer.
    if (!reducedMotion) celebrate(stage, { brand: ctx.brand });
  }

  /** Back to the live state, CTA re-armed. The PRD's dead-end button was a
   *  prototype artefact: a live panel whose controls stop working is a bug. */
  const dropToLive = () => {
    state.committed = null;
    state.dismissedSinceCommit = false;
    stage.classList.remove('is-committed');
    commitBtn.disabled = false;
    commitBtn.textContent = copy.commitCta;
    noteEl.hidden = true;
    noteEl.textContent = '';
    paintResults();
  };

  /* --------------------------- the podium --------------------------- */

  /** What the podium may show right now: the newest result, minus anything
   *  turned down this run. */
  const visibleMatches = () => {
    const source = state.committed ? (state.committed.matches || []) : state.live;
    return source.filter((m) => m && m.car
      && !state.dismissed.has(idOf(m.car))
      && !(state.shadeBan.size && state.shadeBan.has(shadeOf(m.car))));
  };

  /*
   * How many cars are JOINT FIRST (silver on a level car invents a distinction the buyer acts on).
   * Committed quotes /api/match's `decisive`/`clusterSize`; live infers from scores via CLUSTER_PTS.
   */
  const tiedLeaders = (list) => {
    if (list.length < 2) return 1;
    const exact = state.committed
      && !state.dismissedSinceCommit
      && list.length === (state.committed.matches || []).length;
    if (exact) {
      const { decisive, clusterSize } = state.committed;
      if (decisive) return 1;
      return Math.min(clusterSize || 1, list.length, STEP_MAX);
    }
    let n = 1;
    while (n < list.length && (list[0].score - list[n].score) <= CLUSTER_PTS) n += 1;
    return Math.min(n, STEP_MAX);
  };

  /** matchCard destructures `reasons`, and a preview match can arrive without
   *  one. Normalise rather than letting a thin payload throw. */
  const safeMatch = (m) => ({ ...m, reasons: m.reasons || [] });

  const paintResults = () => {
    // A popover is open and anchored to a card. Repainting now would delete the
    // element under it, so the repaint is owed and settled on close.
    if (state.holdPaint) {
      state.pendingPaint = true;
      return;
    }
    const list = visibleMatches();

    stepsEl.replaceChildren();
    tailGrid.replaceChildren();
    tailEl.hidden = true;
    noteEl.hidden = true;
    noteEl.textContent = '';

    if (!list.length) {
      stepsEl.classList.remove('is-tied');
      // Before the first preview lands there is nothing to say; once a result
      // has been through and everything in it has been ruled out, say so.
      const hadResult = state.live.length > 0 || Boolean(state.committed);
      liveEl.textContent = hadResult ? copy.emptyNote : '';
      return;
    }

    const tied = tiedLeaders(list);
    const joint = tied > 1;
    stepsEl.classList.toggle('is-tied', joint);

    // Joint first shows ONLY the tied cars as steps — a third medal would be a second/third
    // the engine never claimed. The rest of the field stays on screen in the (unranked) tail.
    const leaders = list.slice(0, joint ? tied : STEP_MAX);
    leaders.forEach((m, i) => stepsEl.append(buildStep(m, i, joint)));

    const tail = list.slice(leaders.length, leaders.length + TAIL_MAX);
    if (tail.length) {
      tailEl.hidden = false;
      tail.forEach((m) => tailGrid.append(buildTailTile(m)));
    }

    // The announcement — in a tie, the tie itself in the shared brand voice. Capitalised on
    // the way out, since a brand's tiedTitle may open on a spelled-out number as a sentence here.
    liveEl.textContent = joint
      ? cap(`${brandCopy.tiedTitle({ count: tied })} ${brandCopy.tiedLede()}`)
      : copy.liveUpdated({ model: list[0].car.name });

    if (state.committed) paintNote(list[0]);

    if (!reducedMotion) {
      stepsEl.classList.add('is-updating');
      window.setTimeout(() => stepsEl.classList.remove('is-updating'), UPDATE_MS);
    }
  };

  const buildStep = (m, i, joint) => {
    const step = el('div', 'vm-podium-step');
    // Rank treatment. Every joint-first step is gold and nothing else, so no
    // element on screen claims a silver the engine did not award.
    const gold = joint || i === 0;
    step.classList.add(gold ? 'is-gold' : (i === 1 ? 'is-silver' : 'is-bronze'));
    step.append(el('p', 'vm-podium-rank', joint ? copy.jointRank : copy.ranks[i]));
    // The committed hero upgrades to the big card, surfacing the engine's real reasons. Card +
    // reject chip share a positioned wrapper below the eyebrow so the chip anchors to the card corner.
    const cardWrap = el('div', 'vm-podium-card');
    cardWrap.append(
      matchCard(safeMatch(m), {
        big: Boolean(state.committed) && gold,
        compact: !gold,
        brand: ctx.brand,
      }),
      rejectTrigger(m, step),
    );
    step.append(cardWrap);
    return step;
  };

  const buildTailTile = (m) => {
    const tile = matchCard(safeMatch(m), { compact: true, brand: ctx.brand });
    tile.append(rejectTrigger(m, tile));
    return tile;
  };

  /** The honest note, committed only: what the pool couldn't offer, or a hero
   *  the engine itself doesn't rate. One soft line, never a per-card label. */
  const paintNote = (hero) => {
    const items = unmetPhrases(ctx.brand, state.committed.unmet);
    if (items.length) {
      noteEl.hidden = false;
      noteEl.textContent = copy.unmetNote({
        list: orList(items), retailer: ctx.retailerLabel || brandCopy.name,
      });
      return;
    }
    if (hero.score < WEAK_SCORE) {
      noteEl.hidden = false;
      noteEl.textContent = copy.weakNote({ retailer: ctx.retailerLabel || brandCopy.name });
    }
  };

  /* ------------------------- "Not this one" ------------------------- */

  const rejectTrigger = (match, target) => {
    const btn = el('button', 'vm-podium-reject');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    const icon = el('span', 'vm-podium-reject-icon', '✕');
    icon.setAttribute('aria-hidden', 'true');
    btn.append(icon, el('span', 'vm-podium-reject-label', copy.rejectLabel));
    btn.addEventListener('click', () => openPop(btn, match, target));
    return btn;
  };

  /*
   * One popover per mount, moved and positioned on open. Deliberately NOT matchCard's inline
   * `rejectOptions` hook — this is the PRD's floating two-step dialog, kept out of result-card.js.
   */
  const buildPopover = () => {
    pop = el('div', 'vm-podium-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.setAttribute('aria-label', copy.popTitle);
    pop.hidden = true;

    popStep1 = el('div', 'vm-podium-pop-step1');
    popStep1.append(el('p', 'vm-podium-pop-title', copy.popTitle));
    popReasons = el('div', 'vm-podium-pop-reasons');
    const cancel = el('button', 'vm-podium-pop-cancel', copy.popCancel);
    cancel.type = 'button';
    cancel.addEventListener('click', () => closePop({ restore: true }));
    popStep1.append(popReasons, cancel);

    popStep2 = el('div', 'vm-podium-pop-step2');
    popStep2.hidden = true;
    const back = el('button', 'vm-podium-pop-back', copy.popBack);
    back.type = 'button';
    back.addEventListener('click', backToReasons);
    popBody = el('div', 'vm-podium-pop-body');
    popDone = el('button', 'vm-btn vm-btn-primary vm-podium-pop-done', copy.popDone);
    popDone.type = 'button';
    popDone.addEventListener('click', applyDismissal);
    popStep2.append(back, popBody, popDone);

    pop.append(popStep1, popStep2);
    return pop;
  };

  const questionById = (id) => state.questions.find((q) => q.id === id);

  /*
   * Which reasons this brand may offer for THIS card — only branches that can change the result.
   * Each writes a real answer key (MINI drops `mileage`); colour has none, so needs a readable shade.
   */
  const reasonsFor = (match) => {
    const out = [];
    if (questionById('budget')) out.push('price');
    if (questionById('fuel')) out.push('fuel');
    if (questionById('bodyStyles')) out.push('size');
    if (questionById('mileage')) out.push('mileage');
    if (shadeOf(match.car)) out.push('colour');
    out.push('just');
    return out;
  };

  function openPop(trigger, match, target) {
    if (state.pop) closePop({ restore: true });
    state.pop = {
      trigger, match, target, shadePick: null, editedQid: null,
    };
    // Freeze repaints while the dialog is anchored to this card.
    state.holdPaint = true;

    popReasons.replaceChildren();
    reasonsFor(match).forEach((key) => {
      const btn = el('button', 'vm-podium-pop-reason', copy.reasons[key]);
      btn.type = 'button';
      btn.dataset.reason = key;
      btn.addEventListener('click', () => chooseReason(key));
      popReasons.append(btn);
    });

    popStep1.hidden = false;
    popStep2.hidden = true;
    popBody.replaceChildren();
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    placePop(trigger);

    document.addEventListener('keydown', onPopKey);
    document.addEventListener('pointerdown', onPopOutside, true);
    focusablesIn(pop)[0]?.focus();
  }

  /** Fixed to the viewport and clamped into it, so a card near the right edge
   *  or the fold cannot push the dialog off-screen. */
  const placePop = (trigger) => {
    const r = trigger.getBoundingClientRect?.();
    if (!r) return;
    const width = pop.offsetWidth || POP_WIDTH;
    const vw = window.innerWidth || width + POP_MARGIN * 2;
    const vh = window.innerHeight || 0;
    let left = r.left + (r.width / 2) - (width / 2);
    left = Math.max(POP_MARGIN, Math.min(left, vw - width - POP_MARGIN));
    let top = r.bottom + POP_MARGIN;
    const height = pop.offsetHeight || 0;
    if (height && vh && top + height > vh - POP_MARGIN) {
      top = Math.max(POP_MARGIN, r.top - height - POP_MARGIN);
    }
    pop.style.position = 'fixed';
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  };

  const onPopKey = (e) => {
    if (!state.pop) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePop({ restore: true });
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the dialog while it is open (PRD §7).
    const items = focusablesIn(pop);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onPopOutside = (e) => {
    if (!state.pop) return;
    if (pop.contains(e.target) || state.pop.trigger.contains(e.target)) return;
    closePop({ restore: true });
  };

  /*
   * Step two: the card fades toward dismissal and the popover shows the follow-up. Every branch
   * but "just not for me" reuses the SAME widget/question the left pane draws, so it reads as an edit.
   */
  function chooseReason(key) {
    const { target } = state.pop;
    target.classList.add('is-dismissing');
    popStep1.hidden = true;
    popStep2.hidden = false;
    popBody.replaceChildren();

    if (key !== 'just') popBody.append(el('p', 'vm-podium-pop-title', copy.prompts[key]));

    const editQuestion = (id) => {
      const q = questionById(id);
      if (!q) return;
      state.pop.editedQid = id;
      popBody.append(buildControl(q, state.answers, answerChanged));
    };

    if (key === 'price') editQuestion('budget');
    else if (key === 'fuel') editQuestion('fuel');
    else if (key === 'size') editQuestion('bodyStyles');
    else if (key === 'mileage') editQuestion('mileage');
    else if (key === 'colour') popBody.append(buildColourFilter());

    placePop(state.pop.trigger);
    focusablesIn(popStep2)[0]?.focus();
  }

  /*
   * The colour branch. With no colour answer key, it rules the shade out client-side over the
   * returned pool (reusing shadeOf). Staged not applied on tap, so a cancel/Back/Esc restores fully.
   */
  const buildColourFilter = () => {
    const shade = shadeOf(state.pop.match.car);
    const list = el('div', 'vm-options');
    list.setAttribute('role', 'group');
    const btn = el('button', 'vm-option');
    btn.type = 'button';
    btn.setAttribute('role', 'checkbox');
    btn.setAttribute('aria-checked', 'false');
    btn.append(el('span', 'vm-option-label', copy.colourOption({ shade: cap(shade) })));
    btn.addEventListener('click', () => {
      const on = state.pop.shadePick == null;
      state.pop.shadePick = on ? shade : null;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', String(on));
    });
    list.append(btn);
    return list;
  };

  function backToReasons() {
    state.pop.target.classList.remove('is-dismissing');
    state.pop.shadePick = null;
    popStep2.hidden = true;
    popStep1.hidden = false;
    popBody.replaceChildren();
    placePop(state.pop.trigger);
    focusablesIn(popStep1)[0]?.focus();
  }

  /*
   * Done. The card fades, the staged colour filter (if any) lands, the podium re-ranks a beat
   * later. Any changed answer was already written/scheduled, so the re-rank is the engine's.
   */
  function applyDismissal() {
    const { match, target } = state.pop;
    state.dismissed.add(idOf(match.car));
    if (state.pop.shadePick) state.shadeBan.add(state.pop.shadePick);
    if (state.committed) state.dismissedSinceCommit = true;
    closePop({ restore: false });
    if (reducedMotion) {
      paintResults();
      return;
    }
    target.classList.add('is-dismissed');
    window.setTimeout(paintResults, DISMISS_MS);
  }

  /*
   * Close. `restore` puts the card back (cancel/Back/Esc/outside click); the dismissal path passes
   * false. Either way the edited question is re-synced so the popover and pane can't disagree.
   */
  function closePop({ restore }) {
    if (!state.pop) return;
    const { trigger, target, editedQid } = state.pop;
    document.removeEventListener('keydown', onPopKey);
    document.removeEventListener('pointerdown', onPopOutside, true);
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) target.classList.remove('is-dismissing');
    state.pop = null;
    state.holdPaint = false;

    if (editedQid) rebuildQuestion(editedQid);

    if (restore) {
      trigger.focus?.();
    } else {
      // The trigger is inside the card being removed, so focus has to land
      // somewhere that will still exist after the repaint.
      stepsEl.focus?.();
    }

    if (state.pendingPaint) {
      state.pendingPaint = false;
      paintResults();
    }
  }

  /** Redraw one question block from the current answers, in place. Used after
   *  the popover edited that answer behind the pane's back. */
  const rebuildQuestion = (qid) => {
    const node = blocks.get(qid);
    if (!node) return;
    blocks.delete(qid);
    node.remove();
    syncQuestions();
  };

  /* ------------------------------ boot ------------------------------
   * Fetch the per-brand question set in this detached async boot() so mount stays synchronous
   * (skeleton now). apiGetQuestions THROWS — guard it and offer a re-boot retry. */
  const boot = async () => {
    try {
      const { questions } = await apiGetQuestions(ctx.api, ctx.retailer, ctx.brand);
      state.questions = Array.isArray(questions) ? questions : [];
    } catch {
      showError(boot);
      return;
    }
    buildStage();
  };

  renderSkeleton();
  boot();
}

// The switcher tab is brand-agnostic shell UI, so its label stays neutral; the campaign
// wordmark lives inside the stage (PODIUM_COPY[brand].wordmark), where it can vary by brand.
export default { key: 'podium', label: 'Podium', mount };
