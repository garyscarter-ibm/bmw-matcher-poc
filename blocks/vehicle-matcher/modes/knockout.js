/*
 * MINI Knockout — the matcher, played as a championship "This or That".
 *
 * One of several interchangeable interface "modes" over the shared engine (see
 * ../modes/index.js and the shell in ../vehicle-matcher.js). Its premise is the
 * same as the swipe game's, in one line: the head-to-head picks silently answer
 * the same questionnaire the `questions` mode asks, and the REAL engine does the
 * matching. See docs/mini-knockout-requirements.md.
 *
 * The flow:
 *   1. A tiny "set your bracket" SEED step (budget + what's it for) — identical to
 *      the swipe game's seed: the two answers a game can't read, and budget is the
 *      engine's one hard filter, so the field is affordable from the first round.
 *   2. A FIELD of the retailer's real stock (POST /api/preview, scoped by the
 *      seed), shuffled and snapped to the largest power of two it can fill (16 → 8
 *      → 4). The field plays a knockout bracket: lean two-card head-to-heads
 *      whittle it to a single champion. Each pick nudges the *taste* answer keys,
 *      weighted by how far a car advances (bracketToAnswers()).
 *   3. A RESULT: the assembled brief goes to the real /api/match (the identical
 *      call the questions mode makes). The player's CHAMPION is the hero of the
 *      reveal — always honoured — and the engine supplies its real "why" and the
 *      honest note when the numbers don't back the crown ("champion, engine
 *      validates"). So the celebration is the player's; the truth is the engine's.
 *
 * This mode owns its own copy, cards and state. It shares only the signal helpers
 * (./match-signal.js) with the swipe game and el/gbp (../ui.js) — the two games
 * read taste and build the engine brief the same way, but look and read
 * differently (a versus, not a swipe stack).
 *
 * The scoring engine and car dataset live behind an API (see server/ and
 * ../engine.js); this mode never sees the dataset — only the public display
 * fields the API returns.
 */

import { apiGetQuestions, apiField, apiMatch } from '../engine.js';
import { el } from '../ui.js';
import {
  WEAK_SCORE,
  budgetBandsFromQuestion, useTilesFromQuestion,
  shuffle, photosFirst, swatchFor, priceLabel, cap,
  bracketToAnswers, idOf, celebrate,
} from './match-signal.js';

/* The most cars we'll ever field, even when stock is deep — four rounds
 * (16 → 8 → 4 → 2 → 1) is already a long-ish sitting for a promo. The field is
 * snapped DOWN to the largest power of two ≤ min(pool, this). */
const MAX_FIELD = 16;

/* Below this many feasible cars there isn't a game — treat as an empty pool and
 * send the player back to the seed to widen the budget. Exactly two still makes a
 * one-match "final", which is a legitimate (if short) tournament. */
const MIN_FIELD = 2;

/* ------------------------------ copy ------------------------------ */

/*
 * Display copy, keyed by brand with a `bmw` fallback (every read is
 * KNOCKOUT_COPY[brand] || KNOCKOUT_COPY.bmw). MINI is the primary, fully written
 * voice — this is a MINI campaign; the BMW register is a lighter fallback so a
 * future skin isn't blank. Functions take a single args object, matching the
 * questions- and swipe-mode copy convention. Round names are computed from the
 * live field size (roundName), not written here, so an adaptive bracket labels
 * itself correctly whether it starts at 16, 8 or 4.
 */
const KNOCKOUT_COPY = {
  mini: {
    wordmark: 'MINI Knockout',
    // Seed step (mirrors the swipe seed; the tiles themselves come from the engine)
    seedTitle: 'Draw up your bracket.',
    seedLede: 'Two quick things and we’ll seed the field. Then it’s head-to-head, all the way to the final whistle.',
    budgetLabel: 'How much are you looking to spend?',
    useLabel: 'And what’s it for?',
    seedCta: 'Kick it off',
    // Rounds. "VS" (not "or") so the two cars read as a fight, not a menu.
    versus: 'VS',
    pickHint: 'Two cars, one goes through — tap the one you’re backing.',
    roundKicker: ({ round }) => round,
    matchupProgress: ({ done, total }) => `Tie ${done} of ${total}`,
    // Between-round ceremony: a banner naming the round you’re entering, and a
    // bigger interstitial when you reach the Final.
    roundAdvance: ({ round, survivors }) => `${round} · ${survivors} still in the running`,
    finalKicker: 'Down to the last two',
    finalTitle: 'The Final.',
    finalLede: 'Two left on the pitch. One trophy. Back your winner.',
    finalCta: 'Bring it on',
    // The per-tie verdict from the engine's own score of the two cars — did the
    // player back the form pick, or send an underdog through? One concrete beat
    // per tie (replaced the abstract "form" meter, which didn't move within a round).
    verdictForm: ({ model }) => `The ${model} was the form pick — good shout.`,
    verdictUpset: ({ model }) => `The ${model} goes through — the underdog’s upset the odds!`,
    // Result — the champion is always the hero (decision: champion, engine validates)
    matchKicker: 'Your champion',
    matchTitle: ({ model }) => `The ${model} lifts the trophy.`,
    matchLede: 'Saw off everything you put in its way.',
    whyIntro: 'Why it went all the way:',
    crownCallback: ({ beaten }) => `It knocked out ${beaten} on the run to the title.`,
    // When the engine can't fully back the crown (weak / not in the feasible set)
    weakNote: 'For the record, though — the numbers don’t *quite* make this the standout. '
      + 'Stock changes every week, so it’s worth another run soon.',
    alsoNote: ({ model }) => `If you fancy a replay, the numbers make the ${model} the one to beat.`,
    // CTAs + share
    testDriveCta: 'Book a test drive',
    detailsCta: 'See full details',
    shareCta: 'Share your champion',
    shareCopied: 'Link copied',
    againCta: 'New tournament',
    shareText: ({ model, retailer }) => `My champion is a ${model} at ${retailer}. `
      + 'Reckon you’d pick a different winner?',
    // Empty pool at the seed
    emptyPoolTitle: 'Not enough in that range for a bracket.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got enough under that to run a knockout — `
      + 'nudge your budget up and we’ll seed a fresh field.',
    emptyPoolCta: 'Adjust budget',
    // Errors
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  bmw: {
    wordmark: 'Head to Head',
    seedTitle: 'Set up your bracket.',
    seedLede: 'Two quick things and we’ll seed the field, then it’s head-to-head to a winner.',
    budgetLabel: 'Budget',
    useLabel: 'What’s it for?',
    seedCta: 'Seed the bracket',
    versus: 'VS',
    pickHint: 'Two cars go head to head — pick the one you’d rather have.',
    roundKicker: ({ round }) => round,
    matchupProgress: ({ done, total }) => `Match ${done} of ${total}`,
    roundAdvance: ({ round, survivors }) => `${round} · ${survivors} remaining`,
    finalKicker: 'Down to two',
    finalTitle: 'The Final.',
    finalLede: 'Two cars left. Pick the one you’d take.',
    finalCta: 'Continue',
    verdictForm: ({ model }) => `The ${model} was the higher-rated of the two.`,
    verdictUpset: ({ model }) => `The ${model} goes through — the lower-rated pick.`,
    matchKicker: 'Your winner',
    matchTitle: ({ model }) => `The ${model} takes it.`,
    matchLede: 'It beat every car you put against it.',
    whyIntro: 'Why it stands out:',
    crownCallback: ({ beaten }) => `It saw off ${beaten} to win the bracket.`,
    weakNote: 'For the record, the numbers don’t fully back this one — stock changes '
      + 'weekly, so it’s worth another run soon.',
    alsoNote: ({ model }) => `On the numbers, the ${model} is the closest fit if you’d reconsider.`,
    testDriveCta: 'Book a test drive',
    detailsCta: 'See full details',
    shareCta: 'Share this winner',
    shareCopied: 'Link copied',
    againCta: 'New tournament',
    shareText: ({ model, retailer }) => `My pick is a ${model} at ${retailer}.`,
    emptyPoolTitle: 'Not enough in that range for a bracket.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got enough under that to run a knockout — `
      + 'raise your budget and we’ll seed a fresh field.',
    emptyPoolCta: 'Adjust budget',
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Honda's register: plain and straightforward, no em dashes (house rule). The
  // bracket framing is kept, but the words stay unshowy. Its own wordmark so the
  // mode reads as Honda's rather than a BMW skin.
  honda: {
    wordmark: 'Head to Head',
    seedTitle: 'Set up your bracket.',
    seedLede: 'Two quick things and we’ll seed the field, then it’s head-to-head to a winner.',
    budgetLabel: 'Budget',
    useLabel: 'What’s it for?',
    seedCta: 'Seed the bracket',
    versus: 'VS',
    pickHint: 'Two cars go head to head. Pick the one you’d rather have.',
    roundKicker: ({ round }) => round,
    matchupProgress: ({ done, total }) => `Match ${done} of ${total}`,
    roundAdvance: ({ round, survivors }) => `${round} · ${survivors} remaining`,
    finalKicker: 'Down to two',
    finalTitle: 'The Final.',
    finalLede: 'Two cars left. Pick the one you’d take.',
    finalCta: 'Continue',
    verdictForm: ({ model }) => `The ${model} was the higher-rated of the two.`,
    verdictUpset: ({ model }) => `The ${model} goes through, the lower-rated pick.`,
    matchKicker: 'Your winner',
    matchTitle: ({ model }) => `The ${model} takes it.`,
    matchLede: 'It beat every car you put against it.',
    whyIntro: 'Why it stands out:',
    crownCallback: ({ beaten }) => `It saw off ${beaten} to win the bracket.`,
    weakNote: 'For the record, the numbers don’t fully back this one. Stock changes '
      + 'weekly, so it’s worth another run soon.',
    alsoNote: ({ model }) => `On the numbers, the ${model} is the closest fit if you’d reconsider.`,
    testDriveCta: 'Book a test drive',
    detailsCta: 'See full details',
    shareCta: 'Share this winner',
    shareCopied: 'Link copied',
    againCta: 'New tournament',
    shareText: ({ model, retailer }) => `My pick is a ${model} at ${retailer}.`,
    emptyPoolTitle: 'Not enough in that range for a bracket.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got enough under that to run a knockout. `
      + 'Raise your budget and we’ll seed a fresh field.',
    emptyPoolCta: 'Adjust budget',
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
  // Ford's register: friendly and confident, with a touch of competitive spirit
  // (Ford's ST/Mustang heritage earns the light bracket framing). No em dashes
  // (house rule). Its own wordmark so the mode reads as Ford's.
  ford: {
    wordmark: 'Head to Head',
    seedTitle: 'Set up your bracket.',
    seedLede: 'Two quick things and we’ll seed the field, then it’s head-to-head to a winner.',
    budgetLabel: 'Budget',
    useLabel: 'What’s it for?',
    seedCta: 'Seed the bracket',
    versus: 'VS',
    pickHint: 'Two cars go head to head. Pick the one you’d rather have.',
    roundKicker: ({ round }) => round,
    matchupProgress: ({ done, total }) => `Match ${done} of ${total}`,
    roundAdvance: ({ round, survivors }) => `${round} · ${survivors} remaining`,
    finalKicker: 'Down to two',
    finalTitle: 'The Final.',
    finalLede: 'Two cars left. Pick the one you’d take.',
    finalCta: 'Continue',
    verdictForm: ({ model }) => `The ${model} was the higher-rated of the two.`,
    verdictUpset: ({ model }) => `The ${model} goes through, the lower-rated pick.`,
    matchKicker: 'Your winner',
    matchTitle: ({ model }) => `The ${model} takes it.`,
    matchLede: 'It beat every car you put against it.',
    whyIntro: 'Why it stands out:',
    crownCallback: ({ beaten }) => `It saw off ${beaten} to win the bracket.`,
    weakNote: 'For the record, the numbers don’t fully back this one. Stock changes '
      + 'weekly, so it’s worth another run soon.',
    alsoNote: ({ model }) => `On the numbers, the ${model} is the closest fit if you’d reconsider.`,
    testDriveCta: 'Book a test drive',
    detailsCta: 'See full details',
    shareCta: 'Share this winner',
    shareCopied: 'Link copied',
    againCta: 'New tournament',
    shareText: ({ model, retailer }) => `My pick is a ${model} at ${retailer}.`,
    emptyPoolTitle: 'Not enough in that range for a bracket.',
    emptyPoolLede: ({ retailer }) => `${retailer} hasn’t got enough under that to run a knockout. `
      + 'Raise your budget and we’ll seed a fresh field.',
    emptyPoolCta: 'Adjust budget',
    errKicker: 'Sorry',
    errTitle: 'We couldn’t reach the matcher',
    errLede: 'The matching service didn’t respond. Check your connection and try again.',
    retryLabel: 'Try again',
  },
};

/* ------------------------------ helpers ------------------------------ */

/** Copy for the active brand, BMW as the fallback (matches ctx.brand shape). */
const copyFor = (brand) => KNOCKOUT_COPY[brand] || KNOCKOUT_COPY.bmw;

/** Largest power of two ≤ n (0 for n < 1). Used to snap the shuffled pool to a
 * clean bracket size so every round is a full set of pairings, no byes. */
function largestPowerOfTwo(n) {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return n >= 1 ? p : 0;
}

/** Human name for a round given how many cars ENTER it: 2 → Final, 4 → Semi-
 * final, 8 → Quarter-final, else "Round of N". Adaptive: a bracket that starts
 * at 4 opens on "Semi-final", one that starts at 16 opens on "Round of 16". */
function roundName(entrants) {
  if (entrants <= 2) return 'The Final';
  if (entrants <= 4) return 'Semi-final';
  if (entrants <= 8) return 'Quarter-final';
  return `Round of ${entrants}`;
}

/** Pair a flat list into [[a,b],[c,d],...]. Assumes an even length (the field is
 * snapped to a power of two before this); a stray odd tail car is dropped by the
 * caller, never faked into a bye. */
function pairUp(list) {
  const pairs = [];
  for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
  return pairs;
}

/* ------------------------------ mount ------------------------------ */

function mount(root, ctx) {
  const copy = copyFor(ctx.brand);

  // Per-run state — a fresh local object, NOT hung on the shared ctx, so a mode
  // swap and re-mount (the switcher re-calls mount with the same ctx) starts
  // clean. The mode owns its own state and its own hash key.
  const state = {
    questions: [], // the engine's per-brand questions (seeds the budget/use tiles)
    seed: null, // { budget, primaryUse }
    // Bracket:
    round: [], // cars entering the CURRENT round (a power of two, then halving)
    pairings: [], // pairUp(round) — the current round's matchups
    matchIndex: 0, // which matchup in `pairings` is on screen
    winners: [], // winners collected so far THIS round (seed the next round)
    rounds: [], // bracket log: { roundIndex, winner, loser } per head-to-head
    fieldSize: 0, // the starting field size (for round naming + weighting)
    roundIndex: 0, // 0 = first round
    // The engine's own per-card score (0–100) from /api/field, keyed by idOf.
    // The GAME plays with display cars (score is never a visible verdict), but
    // we use it for a per-tie beat: after each pick we compare the winner's score
    // to the loser's and tell the player whether they backed the engine's form
    // pick or sent an underdog through. This surfaces the engine signal the mode
    // used to discard — as a concrete moment, not an abstract meter.
    scoreById: new Map(),
    lastVerdict: null, // { kind: 'form'|'upset', winner } — shown on the next paint, once
    busy: false, // pick lock while a matchup transitions out
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
  // Painted synchronously by mount() while apiGetQuestions is in flight (reuses
  // the swipe seed's skeleton/tile classes — the seed step is deliberately
  // identical between the two games).
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
   * Identical in shape to the swipe game's seed: budget (the engine's hard
   * filter) + what the car's for, both built from the engine's own per-brand
   * questions (state.questions), never local copy. Reuses the .vm-mingle-seed /
   * .vm-mingle-tile classes so the two games' seed steps look the same. */
  const renderSeed = (preset) => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-mingle-seed vm-knockout-seed');
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
      loadField();
    });
    screen.append(cta);
    root.append(screen);
  };

  /* --------------------------- field loading --------------------------- */
  const loadField = async () => {
    renderFieldSkeleton();
    // apiField resolves-empty (never throws), so no try/catch needed here. We
    // ask for a full MAX_FIELD roster (up to 16) rather than the questions
    // drawer's top-9 shortlist — a big-range brand like BMW fills a Round of 16,
    // a thinner one like MINI returns fewer and largestPowerOfTwo snaps down. No
    // enrich: painting all 16 would fetch a PDP per round-one loser, so the
    // face-off card falls back to a neutral swatch (swatchFor handles absent colour).
    const matches = await apiField(ctx.api, state.seed, ctx.retailer, ctx.brand, MAX_FIELD);
    // Field returns match objects { car, score, ... }; the game plays with the
    // display cars, exactly as the swipe game does with match.car — but we no
    // longer THROW AWAY the engine's per-car score. Stash it (keyed by stable
    // identity) so each tie can say whether the winner was the engine's form pick
    // or an underdog. This is the engine signal the mode used to discard.
    state.scoreById = new Map();
    for (const m of matches) {
      if (m?.car && typeof m.score === 'number') {
        state.scoreById.set(idOf(m.car), m.score);
      }
    }
    // Shuffle for a fresh draw, then float the real-photo cars to the front (a
    // photo-less or shared-placeholder contender doesn't read as a head-to-head —
    // §3.5) before snapping to a power of two. We over-fetch MAX_FIELD and usually
    // play 8, so the weak-image cars fall into the discarded tail; only a thin or
    // photo-poor feed lets them onto the pitch as filler.
    const cars = photosFirst(shuffle(matches.map((m) => m.car).filter(Boolean)), (c) => c?.photo);
    const size = largestPowerOfTwo(Math.min(cars.length, MAX_FIELD));
    if (size < MIN_FIELD) {
      renderEmptyPool();
      return;
    }
    // Seed the field: take the snapped power-of-two off the top of the shuffle.
    state.fieldSize = size;
    state.round = cars.slice(0, size);
    state.roundIndex = 0;
    state.winners = [];
    state.rounds = [];
    startRound();
  };

  const renderFieldSkeleton = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-knockout-stage');
    screen.setAttribute('aria-busy', 'true');
    screen.setAttribute('aria-label', 'Seeding the bracket');
    const faceoff = el('div', 'vm-knockout-faceoff');
    faceoff.append(
      el('div', 'vm-skel vm-knockout-skel-card'),
      el('div', 'vm-skel vm-knockout-skel-card'),
    );
    screen.append(faceoff);
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

  /* ----------------------------- rounds ----------------------------- */
  // Begin a round from state.round (the entrants). One entrant → champion.
  const startRound = () => {
    if (state.round.length <= 1) {
      showResult(state.round[0]);
      return;
    }
    state.pairings = pairUp(state.round);
    state.matchIndex = 0;
    state.winners = [];
    renderMatchup();
  };

  /*
   * The per-tie verdict, from the engine's own scores: did the winner the player
   * just picked out-rate the loser ('form' pick), or did an underdog go through
   * ('upset')? Returns null when either car is unscored or they're level — no
   * scored comparison to make, so we stay quiet rather than invent a verdict.
   * This is the engine signal the mode used to discard, surfaced as one concrete
   * beat per pick instead of an abstract meter.
   */
  const verdictFor = (winner, loser) => {
    const w = state.scoreById.get(idOf(winner));
    const l = state.scoreById.get(idOf(loser));
    if (typeof w !== 'number' || typeof l !== 'number' || w === l) return null;
    return { kind: w > l ? 'form' : 'upset', winner };
  };

  // Render the verdict from the LAST pick as a small tag at the top of the next
  // matchup (state.lastVerdict is set in pick(), cleared once shown). Null → the
  // matchup just paints without one (first tie, or an unscored/level pair).
  const renderVerdict = () => {
    const v = state.lastVerdict;
    state.lastVerdict = null;
    if (!v) return null;
    const model = v.winner?.name || 'your pick';
    const tag = el('div', `vm-knockout-verdict vm-knockout-verdict-${v.kind}`);
    tag.setAttribute('role', 'status');
    tag.append(el('span', 'vm-knockout-verdict-text',
      v.kind === 'form' ? copy.verdictForm({ model }) : copy.verdictUpset({ model })));
    return tag;
  };

  const renderMatchup = () => {
    root.replaceChildren();
    const [a, b] = state.pairings[state.matchIndex];
    const entrants = state.round.length;

    const screen = el('div', 'vm-screen vm-knockout-stage');

    // Progress rail — where we are in the tournament (round name + match n of m).
    const rail = el('div', 'vm-knockout-rail');
    rail.append(el('span', 'vm-knockout-round', roundName(entrants)));
    rail.append(el('span', 'vm-knockout-count',
      copy.matchupProgress({ done: state.matchIndex + 1, total: state.pairings.length })));
    screen.append(rail);
    // The verdict from the tie the player just settled (engine's form pick, or an
    // upset) — a concrete per-pick beat where the abstract "form" meter used to be.
    const verdict = renderVerdict();
    if (verdict) screen.append(verdict);

    screen.append(el('p', 'vm-lede vm-knockout-hint', copy.pickHint));

    const faceoff = el('div', 'vm-knockout-faceoff');
    faceoff.append(buildContender(a, 'a'));
    faceoff.append(el('div', 'vm-knockout-vs', copy.versus));
    faceoff.append(buildContender(b, 'b'));
    screen.append(faceoff);

    root.append(screen);

    // Arrow-key a11y: ← picks the left contender, → the right.
    screen.tabIndex = -1;
    screen.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); pick(a, b, 'a'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); pick(b, a, 'b'); }
    });
  };

  // One contender card — a lean face-off card (not the swipe stack). `side` is
  // 'a'|'b' for the fly-out direction of the loser.
  const buildContender = (car, side) => {
    const card = el('button', `vm-knockout-card vm-knockout-card-${side}`);
    card.type = 'button';
    card.style.setProperty('--vm-mingle-swatch', swatchFor(car));
    card.append(el('div', 'vm-mingle-card-colour'));

    // Corner side badge (A / B) — the light-touch "opposing corners" framing that
    // helps the pair read as a versus, not a two-item list. Bold on MINI, quiet on
    // BMW (both via CSS); aria-hidden, the button label already carries the model.
    const badge = el('span', 'vm-knockout-corner', side === 'a' ? 'A' : 'B');
    badge.setAttribute('aria-hidden', 'true');
    card.append(badge);

    const media = el('div', 'vm-mingle-card-media');
    if (car.photo) {
      const img = el('img', 'vm-mingle-card-photo');
      img.src = car.photo; img.alt = car.name || ''; img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); media.classList.add('no-photo'); });
      media.append(img);
    } else {
      media.classList.add('no-photo');
      media.append(el('span', 'vm-mingle-card-initial', (car.name || '?').charAt(0)));
    }
    card.append(media);

    const body = el('div', 'vm-mingle-card-body');
    if (car.name) body.append(el('h3', 'vm-mingle-card-name', car.name));
    if (car.line) body.append(el('p', 'vm-mingle-card-spec', car.line));
    body.append(el('p', 'vm-mingle-card-price', priceLabel(car)));
    const pills = el('div', 'vm-mingle-pills');
    if (car.fuel) pills.append(el('span', 'vm-mingle-pill', cap(car.fuel)));
    if (car.body) pills.append(el('span', 'vm-mingle-pill', cap(car.body)));
    body.append(pills);
    card.append(body);

    // Clicking the card picks it; the OTHER card is the loser.
    const [pa, pb] = state.pairings[state.matchIndex];
    const other = car === pa ? pb : pa;
    card.addEventListener('click', () => pick(car, other, side));
    return card;
  };

  // Record a pick: winner advances, loser is logged (for the advancement-weighted
  // inference), the losing card flies out (gated on reduced-motion), and we move
  // to the next matchup or round. `busy` blocks a double-pick mid-transition.
  const pick = (winner, loser, side) => {
    if (state.busy) return;
    state.busy = true;

    state.rounds.push({ roundIndex: state.roundIndex, winner, loser });
    state.winners.push(winner);
    // Read the engine's take on the tie just settled, to show on the next paint.
    state.lastVerdict = verdictFor(winner, loser);

    const advance = () => {
      state.busy = false;
      if (state.matchIndex + 1 < state.pairings.length) {
        state.matchIndex += 1;
        renderMatchup();
      } else {
        // Round complete — the winners become the next round's entrants. Make a
        // ceremony of it: a sweep banner naming the round we're entering, or the
        // big Final interstitial when it's down to the last two.
        state.round = state.winners;
        state.roundIndex += 1;
        advanceRound();
      }
    };

    if (reducedMotion) { advance(); return; }
    // Fly the loser's card out; the winner's card lifts. Loser side is the
    // opposite of the winner's side (the winner is `side`).
    const cards = root.querySelectorAll('.vm-knockout-card');
    const loserSel = side === 'a' ? '.vm-knockout-card-b' : '.vm-knockout-card-a';
    const winnerSel = side === 'a' ? '.vm-knockout-card-a' : '.vm-knockout-card-b';
    root.querySelector(loserSel)?.classList.add(side === 'a' ? 'is-out-right' : 'is-out-left');
    root.querySelector(winnerSel)?.classList.add('is-crowned');
    cards.forEach((c) => { c.disabled = true; });
    setTimeout(advance, 300);
  };

  /* --------------------------- round ceremony --------------------------- */
  // Between rounds we make "moving on" a moment. One survivor → the champion
  // reveal. Two survivors → the Final gets a dedicated interstitial (one tap, the
  // climax earns it). Otherwise a quick banner sweep names the round you're
  // entering, then the next matchup paints. Under reduced motion the sweep is
  // skipped (it would just flash) and we go straight to the round.
  const advanceRound = () => {
    const survivors = state.round.length;
    if (survivors <= 1) { startRound(); return; }
    if (survivors === 2) { renderRoundInterstitial(); return; }
    if (reducedMotion) { startRound(); return; }
    renderRoundSweep(survivors);
  };

  // A full-width banner that sweeps across the stage naming the round the player
  // is entering, then hands off to the round. Self-timed (~800ms) so it's a beat,
  // not a wait.
  const renderRoundSweep = (survivors) => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-knockout-stage vm-knockout-sweep-stage');
    const banner = el('div', 'vm-knockout-sweep');
    banner.append(el('span', 'vm-knockout-sweep-round', roundName(survivors)));
    banner.append(el('span', 'vm-knockout-sweep-sub',
      copy.roundAdvance({ round: roundName(survivors), survivors })));
    screen.append(banner);
    root.append(screen);
    window.setTimeout(startRound, 800);
  };

  // The Final gets its own screen: the two finalists as crests, the "The Final"
  // headline, and a single tap to begin. This is the one deliberate extra tap in
  // the flow, and only ever once. Reduced motion keeps the screen (it's content,
  // not motion) — the JS just doesn't animate the crest entrance.
  const renderRoundInterstitial = () => {
    root.replaceChildren();
    const [a, b] = state.round;
    const screen = el('div', 'vm-screen vm-knockout-interstitial');
    if (!reducedMotion) screen.classList.add('is-revealing');
    if (!reducedMotion) celebrate(screen, { brand: ctx.brand });

    screen.append(el('p', 'vm-kicker vm-knockout-final-kicker', copy.finalKicker));
    screen.append(el('h2', 'vm-title', copy.finalTitle));

    const crests = el('div', 'vm-knockout-crests');
    crests.append(buildCrest(a), el('div', 'vm-knockout-vs', copy.versus), buildCrest(b));
    screen.append(crests);

    screen.append(el('p', 'vm-lede', copy.finalLede));

    const cta = el('button', 'vm-btn vm-btn-primary', copy.finalCta);
    cta.type = 'button';
    cta.addEventListener('click', startRound);
    screen.append(cta);
    root.append(screen);
    cta.focus();
  };

  // A small "crest" for a finalist on the interstitial — the paint colour, the
  // initial/photo, and the name. Lighter than a full contender card.
  const buildCrest = (car) => {
    const crest = el('div', 'vm-knockout-crest');
    crest.style.setProperty('--vm-mingle-swatch', swatchFor(car));
    const disc = el('div', 'vm-knockout-crest-disc');
    if (car.photo) {
      const img = el('img', 'vm-knockout-crest-photo');
      img.src = car.photo; img.alt = car.name || ''; img.loading = 'lazy';
      img.addEventListener('error', () => { img.remove(); disc.classList.add('no-photo'); });
      disc.append(img);
    } else {
      disc.classList.add('no-photo');
      disc.append(el('span', 'vm-mingle-card-initial', (car.name || '?').charAt(0)));
    }
    crest.append(disc);
    if (car.name) crest.append(el('span', 'vm-knockout-crest-name', car.name));
    return crest;
  };

  /* --------------------------- result --------------------------- */
  // The champion is the lone survivor of the bracket. We STILL call the real
  // engine (the same call the questions mode makes) — not to pick the hero (the
  // champion is always the hero, decision "champion, engine validates") but to
  // attach its real "why" reasons and to know when to add the honest note.
  const showResult = async (champion) => {
    renderResultSkeleton();
    const answers = bracketToAnswers(state.rounds, state.seed);
    let result;
    try {
      result = await apiMatch(ctx.api, answers, ctx.retailer, ctx.brand);
    } catch {
      showError(() => showResult(champion));
      return;
    }
    renderResult(champion, result);
  };

  const renderResultSkeleton = () => {
    root.replaceChildren();
    const screen = el('div', 'vm-screen vm-mingle-result');
    screen.setAttribute('aria-busy', 'true');
    screen.setAttribute('aria-label', 'Crowning your champion');
    screen.append(
      el('div', 'vm-skel vm-skel-title'),
      el('div', 'vm-skel vm-mingle-skel-hero'),
    );
    root.append(screen);
  };

  const renderResult = (champion, result) => {
    root.replaceChildren();
    const matches = result.matches || [];

    // Find the champion in the engine's feasible set (by stable identity) to
    // borrow its real reasons/score. If it isn't there, the engine didn't rank it
    // feasible for the assembled brief — that's precisely the honest-note case.
    const engineMatch = matches.find((m) => idOf(m.car) === idOf(champion));
    const reasons = engineMatch?.reasons || [];
    const weak = !engineMatch
      || (typeof engineMatch.score === 'number' && engineMatch.score < WEAK_SCORE)
      || hasUnmet(result.unmet);

    const screen = el('div', 'vm-screen vm-mingle-result vm-knockout-result');
    if (!reducedMotion) celebrate(screen, { brand: ctx.brand });

    screen.append(el('p', 'vm-kicker vm-mingle-match-kicker', copy.matchKicker));
    screen.append(el('h2', 'vm-title', copy.matchTitle({ model: champion.name })));
    screen.append(el('p', 'vm-lede', copy.matchLede));

    // Hero card — always the CHAMPION the player crowned (never swapped out).
    screen.append(buildHero(champion));

    // Why — the engine's real reasons for the champion, flirtily introduced, with
    // a crown callback. Only shown when the engine actually returned reasons.
    if (reasons.length) {
      const why = el('div', 'vm-mingle-why');
      why.append(el('p', 'vm-mingle-why-intro', copy.whyIntro));
      const list = el('ul', 'vm-mingle-why-list');
      reasons.forEach((r) => list.append(el('li', 'vm-mingle-why-item', r)));
      why.append(list);
      const beaten = beatenLabel();
      if (beaten) why.append(el('p', 'vm-mingle-callback', copy.crownCallback({ beaten })));
      screen.append(why);
    }

    // The one honest beat — when the engine can't fully back the crown (§6.2
    // pattern). Celebrate anyway; add a soft note, and (if there's a different
    // engine favourite) name it as a supportive aside, without swapping the hero.
    if (weak) {
      screen.append(el('p', 'vm-mingle-weak-note', copy.weakNote.replace(/\*(.+?)\*/g, '$1')));
      const top = matches[0];
      if (top && idOf(top.car) !== idOf(champion) && top.car?.name) {
        screen.append(el('p', 'vm-mingle-weak-note vm-knockout-also', copy.alsoNote({ model: top.car.name })));
      }
    }

    screen.append(buildResultCtas(champion));
    root.append(screen);
  };

  // A short human phrase for who the champion beat — "three rivals", or the name
  // of the finalist if we can read it. Powers the crown callback in the "why".
  const beatenLabel = () => {
    const wins = state.rounds.filter((r) => idOf(r.winner) === championId()).length;
    if (wins <= 0) return null;
    if (wins === 1) {
      const final = state.rounds[state.rounds.length - 1];
      const loserName = final?.loser?.name;
      return loserName ? `the ${loserName}` : 'its rival';
    }
    const words = ['', 'one rival', 'two rivals', 'three rivals', 'four rivals'];
    return words[wins] || `${wins} rivals`;
  };
  const championId = () => {
    const final = state.rounds[state.rounds.length - 1];
    return final ? idOf(final.winner) : null;
  };

  const hasUnmet = (unmet) => unmet && Object.values(unmet).some((v) => Array.isArray(v) && v.length);

  const buildHero = (car) => {
    const card = el('article', 'vm-mingle-hero');
    // Entrance: a spring/precise settle as the champion is crowned (CSS).
    if (!reducedMotion) card.classList.add('is-revealing');
    card.style.setProperty('--vm-mingle-swatch', swatchFor(car));
    card.append(el('div', 'vm-mingle-card-colour'));
    const media = el('div', 'vm-mingle-card-media');
    if (car.photo) {
      const img = el('img', 'vm-mingle-card-photo');
      img.src = car.photo; img.alt = car.name || ''; img.loading = 'lazy';
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

  const buildResultCtas = (champion) => {
    const wrap = el('div', 'vm-mingle-ctas');
    const drive = el('a', 'vm-btn vm-btn-primary vm-mingle-drive', copy.testDriveCta);
    if (champion.link) { drive.href = champion.link; drive.target = '_blank'; drive.rel = 'noopener'; }
    wrap.append(drive);

    const details = el('a', 'vm-btn vm-btn-ghost', copy.detailsCta);
    if (champion.link) { details.href = champion.link; details.target = '_blank'; details.rel = 'noopener'; }
    wrap.append(details);

    const share = el('button', 'vm-btn vm-btn-ghost vm-mingle-share', copy.shareCta);
    share.type = 'button';
    share.addEventListener('click', () => doShare(champion, share));
    wrap.append(share);

    const again = el('button', 'vm-mingle-link vm-mingle-again', copy.againCta);
    again.type = 'button';
    again.addEventListener('click', () => loadField()); // fresh reshuffled field, same seed
    wrap.append(again);
    return wrap;
  };

  const doShare = async (champion, btn) => {
    const text = copy.shareText({ model: champion.name, retailer: ctx.retailerLabel || 'MINI' });
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#knockout=1`;
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch { /* user dismissed — no-op */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      btn.textContent = copy.shareCopied;
    } catch { /* clipboard blocked — leave the label */ }
  };

  /* The champion-reveal confetti is the shared celebrate() helper
   * (match-signal.js) — the same crescendo the swipe game uses. */

  /* ------------------------------ boot ------------------------------
   * Same shape as the swipe game: the seed's tiles are per-brand and live behind
   * apiGetQuestions, so fetch that first. mount stays synchronous — it paints the
   * seed skeleton now and does the fetch in this detached boot(), so the shell
   * never awaits a cold backend. apiGetQuestions THROWS on failure, so guard it
   * and offer a retry that re-boots. */
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
// "Head to head", not "MINI Knockout". The campaign name lives as the wordmark
// INSIDE the stage (KNOCKOUT_COPY[brand].wordmark), where it can vary by brand;
// the mode's static `label` can't. key stays 'knockout' — the ?mode= and authored
// "Mode" value.
export default { key: 'knockout', label: 'Head to head', mount };
