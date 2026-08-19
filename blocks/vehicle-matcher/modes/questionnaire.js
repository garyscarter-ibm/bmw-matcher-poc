/*
 * Questionnaire mode: the question-by-question matcher interface (intro, flow, live
 * preview, results, refinement). Fetches over HTTP; owns #m=<base64url> deep-linking.
 */

import { BUDGET_BANDS, pillFor } from '../quiz-meta.js';
import { apiGetQuestions, apiMatch, apiNearby } from '../engine.js';
import { el, cardinal, gbp } from '../ui.js';
import {
  BRAND_COPY, UNMET_PHRASES, TRADE_COPY, orList, andList, tradeLines,
} from './brand-copy.js';
import {
  CONCEPT_LABELS, listingsOf, distanceLabel, matchCard, previewTile,
} from './result-card.js';
import {
  isVisible, visibleQuestions, formatSliderValue, renderRangeSlider, renderOptionList,
} from './question-ui.js';
import { createPreviewFeed } from './preview-feed.js';

const HASH_KEY = 'm';

/* ------------------------------ helpers ------------------------------ */

/**
 * Is the budget answer usable? Budget is the engine's one hard requirement; accepts a
 * [min,max] range, bare number, or legacy b1–b5 band. Mirror of budgetRange guard in engine.js.
 */
function validBudget(value) {
  if (Array.isArray(value)) {
    return value.length === 2 && value.every(Number.isFinite) && Math.max(...value) > 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return !!BUDGET_BANDS[value];
}

/**
 * The wants BOTH halves of the reachable pool agree they can't meet (retailer AND nearby
 * both lack it). `nearbyUnmet` null means nearby never answered, so we claim nothing.
 */
function agreedUnmet(retailerUnmet, nearbyUnmet) {
  if (!nearbyUnmet) return {};
  const agreed = {};
  for (const [id, values] of Object.entries(retailerUnmet || {})) {
    const both = values.filter((v) => (nearbyUnmet[id] || []).includes(v));
    if (both.length) agreed[id] = both;
  }
  return agreed;
}

/**
 * The buyer's original brief, in short phrases. Only the defining three — fuel,
 * shape, budget — because this is a reminder of what they said, not a transcript.
 */
function briefFromAnswers(ctx) {
  const labelsFor = (id, values) => {
    const q = ctx.questions.find((x) => x.id === id);
    if (!q?.options) return [];
    return values
      .map((v) => q.options.find((o) => o.value === v)?.label)
      .filter(Boolean);
  };
  const bits = [];
  const fuels = (Array.isArray(ctx.answers.fuel) ? ctx.answers.fuel : [ctx.answers.fuel])
    .filter((v) => v && v !== 'open');
  bits.push(...labelsFor('fuel', fuels));
  bits.push(...labelsFor('bodyStyles', (ctx.answers.bodyStyles || []).filter((v) => v !== 'any')));
  const budgetQ = ctx.questions.find((x) => x.id === 'budget');
  if (budgetQ) {
    const b = pillFor(budgetQ, ctx.answers);
    if (b) bits.push(b);
  }
  return bits;
}

/*
 * How far apart two scores may be and still count as a tie. Mirrors the engine's
 * CLUSTER_PTS, since the page re-derives its result state after every narrowing.
 */
const CLUSTER_PTS = 3;

/** Cars beyond a group's lead, shown as compact tiles under the same heading.
 *  A backstop, not the main control: RELEVANT_PTS below usually cuts first. */
const TAIL_SHOWN = 6;

/*
 * How far behind the best car a car may be and still be worth showing. Relative not
 * absolute (a floor over-shows strong pages, empties weak); ten hits the natural score cliff.
 */
const RELEVANT_PTS = 10;

/*
 * How long the first paint waits for the national search before going without it. Only
 * covers the gap between the two parallel searches; shorter than the local call.
 */
const GRACE_MS = 1500;

/** Cap on cards given the full lead treatment. Mirrors the engine's own. */
const MAX_SHOWN = 6;

/*
 * Below this, over a leader already carrying a trade-off, the page says "nothing here is close".
 * 68 = median of the `closest` population it splits (policy); re-measure via `npm run audit confidence`.
 */
const WEAK_SCORE = 68;

/**
 * A car with no `distance` came from the retailer's own feed; the national search
 * sets one on everything it returns. That fact splits the list into its two groups.
 */
const isHere = (m) => m.car.distance == null;

/**
 * The results list plus every means of arguing with it: ONE ranked list GROUPED BY PLACE.
 * Headline re-derived each redraw from on-screen scores; nearby stock joins late via `addToPool`.
 * @param {HTMLElement} title the results headline, rewritten on every redraw
 * @param {HTMLElement} lede the framing line, dropped once one car remains
 * @param {Object} frames per-state copy (docs/results-page-states.md), chosen per redraw
 * @returns {{ host: HTMLElement, addToPool: (matches) => void }}
 */
function renderRefine(
  ctx, initialPool, title, lede, frames, tasteLead = false, searched = null,
  searching = false,
) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  // Mutable: nearby stock joins after first paint. Always kept in score order
  // so "the list" and "ranked by fit" mean the same thing.
  /*
   * Score first, then local ahead of distant on a tie (owner decision 2026-07-22:
   * proximity is the buyer's trade). A nearby car that scores HIGHER still leads.
   */
  const rank = (a, b) => b.score - a.score
    || (a.car.distance == null ? 0 : 1) - (b.car.distance == null ? 0 : 1)
    || (a.car.distance ?? 0) - (b.car.distance ?? 0);
  let pool = [...initialPool].sort(rank);
  /*
   * The taste lead is a server judgement about one specific car, so it only stands
   * while that car still leads — narrow, reject or outrank it and the claim is stale.
   */
  const tasteLeader = tasteLead ? pool[0]?.car.id : null;
  const tasteLed = (alive) => Boolean(tasteLeader) && alive[0]?.car.id === tasteLeader;
  const active = new Map(); // axis id -> axis

  // Everything narrowing the set, positive or negative, in one place, each a
  // removable chip: a filter the user can't see is one they can't argue with.
  const constraints = new Map(); // id -> { label, test(listing) }
  const hidden = new Set(); // cars waved away with no reason given

  const host = el('div', 'vm-refine');
  const chipRow = el('div', 'vm-chips');
  /*
   * The running brief: what the buyer said, plus everything since. It grows as they
   * go, so the tool visibly holds a model of them rather than silently re-filtering.
   */
  const status = el('div', 'vm-brief');

  /*
   * The two groups (retailer's cars, then everyone else's): one section each, PLACE
   * heading, lead cards full-size and the rest as tiles. An empty group is never mounted.
   */
  const grid = el('div', 'vm-grid vm-grid-tied');
  const hereGroup = el('section', 'vm-group');
  const hereLabel = el('h3', 'vm-subhead vm-group-label', '');
  const hereRestGrid = el('div', 'vm-tail-grid');
  const awayGroup = el('section', 'vm-group');
  /*
   * "Still looking" placeholder for the other-retailers group when the national search lost
   * the grace race. Reserving space beats cars ambushing and re-sorting the list mid-read.
   */
  // Flipped by searchDone() when the national search finally lands or fails.
  let stillSearching = searching;
  const awayPending = el('p', 'vm-pending');
  awayPending.hidden = true;
  awayPending.append(el('span', 'vm-pending-dot'), copy.searchingNearby);
  const awayLabel = el('h3', 'vm-subhead vm-group-label', copy.awayHeading);
  const awayGrid = el('div', 'vm-grid vm-grid-tied');
  const awayRestGrid = el('div', 'vm-tail-grid');

  /*
   * Chips are a CONTROL, so they sit above what they control; the brief is a SUMMARY,
   * so it stays below. NOT sticky: that fights the EDS host page's own header.
   */
  const refineBlock = el('div', 'vm-refine-tools');
  const briefBlock = el('div', 'vm-brief-block');
  /*
   * The other half of a scoped headline: the named car elsewhere that beat the best here.
   * Derived each redraw from the same comparison that scopes the headline, so they agree.
   */
  const notice = el('p', 'vm-notice');
  notice.hidden = true;
  // The car a rescue note above the cards already points at, when there is one.
  // Set by renderResults; see `noteShown` below for why it matters.
  let notedCarId = null;
  hereGroup.append(hereLabel, grid, hereRestGrid);
  awayGroup.append(awayLabel, awayPending, awayGrid, awayRestGrid);
  /*
   * The working, under the cars: evidence of the search. A one-card page reads as
   * thin stock unless we say how much was searched; padding with weak cars can't fix that.
   */
  const working = el('aside', 'vm-working');
  working.hidden = true;

  host.append(notice, briefBlock, refineBlock, hereGroup, awayGroup, working);

  /*
   * Survivors of everything the buyer has said, from the WHOLE pool so a rejection
   * promotes the next-best. Filters apply to LISTINGS not cards (so "Not the Chili Red" keeps the same model in another colour); the card is rebuilt from survivors.
   */
  function narrow(m) {
    if (hidden.has(m.car.id)) return null;
    const tests = [...active.values(), ...constraints.values()];
    const all = listingsOf(m);
    const kept = all.filter((l) => tests.every((t) => t.test(l)));
    if (!kept.length) return null;
    if (kept.length === all.length) return m;
    return { ...m, car: regroup(m.car, kept), listings: kept };
  }
  const surviving = () => pool.map(narrow).filter(Boolean);

  /**
   * The lead of a sorted list: its top car plus anything tied with it. Nothing
   * outside this may be described as fitting equally well, whatever the card count.
   */
  const leadOf = (list) => {
    const top = list[0].score;
    return list.filter((m) => top - m.score <= CLUSTER_PTS).slice(0, MAX_SHOWN);
  };

  /*
   * Which result state the page is in RIGHT NOW, derived each redraw from the RETAILER'S
   * on-screen scores. `scoped` is the one thing a car elsewhere decides: it must strictly outrank the best here, since ties already break local-first.
   */
  /** Score below which a car is a change of subject rather than an option. */
  function relevanceFloor() {
    const alive = surviving();
    return alive.length ? Math.max(...alive.map((m) => m.score)) - RELEVANT_PTS : 0;
  }

  function situation() {
    const alive = surviving();
    if (!alive.length) {
      return { alive, here: [], away: [], lead: [], state: 'empty', scoped: false };
    }
    const here = alive.filter(isHere);
    const away = alive.filter((m) => !isHere(m));
    // Ruling out every retailer car leaves nothing to scope to, so the cars within
    // reach become the answer and the page drops a qualification it can't support.
    const from = here.length ? here : away;
    const cluster = leadOf(from);
    const scoped = here.length > 0 && away.length > 0 && away[0].score > here[0].score;
    const common = { alive, here, away, scoped };
    // The leader misses something asked for, so never "perfect". Below WEAK_SCORE it
    // stops being "the closest here" and becomes "nothing here is close".
    if ((from[0].tradeOffs || []).length) {
      const state = cluster[0].score < WEAK_SCORE ? 'weak' : 'closest';
      return { ...common, lead: cluster, state };
    }
    if (cluster.length === 1) return { ...common, lead: cluster, state: 'decree' };
    // Fit-tied. Their priorities may still pick one (the taste lead is a server
    // judgement, so it only stands while that cluster's leader is still leading).
    return { ...common, lead: cluster, state: tasteLed(from) ? 'taste' : 'tie' };
  }

  /*
   * What this car could be rejected FOR, given what's on screen. Each reason names one
   * property and is offered only when it changes something; "just not this one" is always last.
   */
  function rejectOptions(match, chosen) {
    const { car } = match;
    // What the card is showing right now. Colour and gearbox are properties of ONE
    // car, so a reason about them must come from the listing on screen.
    const shown = chosen || listingsOf(match)[0] || {};
    // Judge "would this reason change anything?" against every reachable listing,
    // siblings included: turning down the red is answered by the black behind it.
    const alive = surviving().flatMap(listingsOf);
    const survives = (test) => alive.some(test);
    const opts = [];
    const add = (id, label, test) => opts.push({
      label,
      apply: () => { constraints.set(id, { label, test }); redraw(); },
    });

    /*
     * EVERY reason is about the listing on screen, price and mileage included (a cheaper
     * survivor is what was asked for). Direction is fixed: both mean "than this one".
     */

    // A listing with no known paint is never "the red one" — we can't claim it
    // is, so a colour rejection keeps it rather than guessing it away.
    const shadeOf = (l) => l.shade || l.colour;
    const shade = shadeOf(shown) || car.colour?.colour || car.colour?.manufacturerColour;
    if (shade && survives((l) => shadeOf(l) !== shade)) {
      add(`!c:${shade}`, `Not the ${shade.toLowerCase()}`, (l) => shadeOf(l) !== shade);
    }
    const dearer = Number.isFinite(shown.priceMin) ? shown.priceMin : car.priceMin;
    if (Number.isFinite(dearer) && survives((l) => l.priceMin < dearer)) {
      add(`!p:${dearer}`, `Under ${gbp(dearer)}`, (l) => l.priceMin < dearer);
    }
    const higher = Number.isFinite(shown.mileage) ? shown.mileage : car.mileage;
    if (Number.isFinite(higher) && survives((l) => l.mileage != null && l.mileage < higher)) {
      add(`!m:${higher}`, `Fewer than ${higher.toLocaleString('en-GB')} miles`,
        (l) => l.mileage != null && l.mileage < higher);
    }
    const gear = shown.transmission || car.transmission;
    if (gear && survives((l) => l.transmission && l.transmission !== gear)) {
      const want = gear === 'auto' ? 'manual' : 'automatic';
      add(`!g:${gear}`, `Only ${want}`, (l) => l.transmission !== gear);
    }
    // The shrug stays whole-card: "just not this one" is about the model in
    // front of them, not about one of its copies.
    opts.push({
      label: copy.rejectJust,
      apply: () => { hidden.add(car.id); redraw(); },
    });
    return opts;
  }

  function redraw() {
    const {
      alive, here, away, lead: shown, state, scoped,
    } = situation();
    const frame = frames[state] || frames.tie;
    const strip = (m) => m.car.name.replace(new RegExp(`^${copy.name} `), '');

    // Chips: every axis that still splits what's on screen, recomputed against the
    // current set — offering an axis that can't change the result is noise.
    refineBlock.replaceChildren();
    chipRow.replaceChildren();

    /*
     * Everything the buyer has told us since the quiz, as statements in the brief below
     * (not controls); the chip row carries only what they could ADD next. +/- reads as a model of a person, a flat filter bar of pills doesn't.
     */
    const learned = [
      ...[...active.entries()].map(([id, a]) => ({
        kind: 'want', text: a.label, undo: () => active.delete(id),
      })),
      ...[...constraints.entries()].map(([id, c]) => ({
        kind: 'rule', text: c.label, undo: () => constraints.delete(id),
      })),
    ];
    if (hidden.size) {
      learned.push({
        kind: 'rule', text: copy.hiddenChip({ count: hidden.size }), undo: () => hidden.clear(),
      });
    }

    /*
     * Computed against what is ON SCREEN every redraw: an axis exists only where it splits
     * the cars being shown, and that set changes with every tap. MAX_AXES applies in refinementAxes.
     */
    for (const axis of refinementAxes(shown.map(listingsOf))) {
      if (active.has(axis.id)) continue;
      const chip = el('button', 'vm-chip', axis.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => { active.set(axis.id, axis); redraw(); });
      chipRow.append(chip);
    }

    // Mounted only when there is something to offer: a cluster of identical-spec
    // cars in identical paint has no axes, so the page just shows the cars and stops.
    if (chipRow.children.length) {
      refineBlock.append(
        el('p', 'vm-refine-label', copy.refineLabel({ count: shown.length })),
        chipRow,
      );
    }

    // The headline says whatever is true of the cars now on screen; `state` already
    // covers narrowing/rejection/late stock. `scoped` picks the "at <retailer>" variant.
    const wants = [...active.values(), ...constraints.values()].map((a) => a.label.toLowerCase());
    const say = (kind) => (scoped && frame[`${kind}Here`]) || frame[kind];
    if (!shown.length) {
      // Nothing left to be a tie between — "a one-way tie" is the nonsense a
      // count-driven headline produces if it isn't stopped here.
      title.textContent = copy.tiedEmptyTitle;
    } else {
      const args = {
        count: shown.length, model: strip(shown[0]), retailer: ctx.retailerLabel,
      };
      title.textContent = say(shown.length === 1 ? 'settled' : 'tied')(args);
    }

    // Names what forced the scope. Suppressed only when a rescue note above the cards
    // already points at THAT car, to avoid saying the same fact twice about one car.
    notice.hidden = !scoped || away[0].car.id === notedCarId;
    if (!notice.hidden) {
      notice.textContent = copy.searchedWider({
        model: strip(away[0]),
        miles: distanceLabel(away[0].car.distance),
        where: away[0].car.retailerName || 'another retailer',
      });
    }
    // "We can't split them" only holds while there are several to split — but a
    // lede about the single named car (the taste pick) survives narrowing.
    lede.hidden = !frame.lede || (shown.length <= 1 && !frame.ledeSurvivesNarrowing);
    lede.textContent = frame.lede || '';
    // A car waved away with no reason narrows the count but adds no words —
    // there's nothing to report about "just not that one".
    /*
     * The running brief, ABOVE the cards: nobody scrolls past fourteen cards to read what
     * they typed. Applied filters live as undoable chips above; this carries only the brief.
     */
    briefBlock.replaceChildren();
    status.replaceChildren();
    const said = briefFromAnswers(ctx);
    if (said.length || learned.length) {
      briefBlock.append(status);
      status.append(el('p', 'vm-brief-label', copy.briefLabel));
      if (said.length) status.append(el('p', 'vm-brief-said', said.join('  ·  ')));

      // Then everything since, each with the means to take it back — this is now the
      // only place the constraint is stated, and a filter you can't clear is worse.
      learned.forEach((item) => {
        const row = el('p', `vm-brief-item is-${item.kind}`);
        row.append(el('span', 'vm-brief-mark', item.kind === 'want' ? '+' : '−'));
        row.append(el('span', 'vm-brief-text', item.text));
        const undo = el('button', 'vm-brief-undo', '✕');
        undo.type = 'button';
        undo.setAttribute('aria-label', `Remove ${item.text}`);
        undo.addEventListener('click', () => { item.undo(); redraw(); });
        row.append(undo);
        status.append(row);
      });

      /*
       * One count, in the same panel as the statements that caused it (two counts confused).
       * Only positive wants are named; a rejection has already shown its work by removing a card.
       */
      if (learned.length) {
        const picked = [...active.values()].map((a) => a.label.toLowerCase());
        /*
         * No denominator: every version was wrong (mis-scoped, invisible total, or counting
         * cars the relevance bar hides). A bare count is checkable against the cards and claims nothing about a total.
         */
        const args = { shown: alive.filter((m) => m.score >= relevanceFloor()).length };
        const line = el('p', 'vm-brief-count', picked.length
          ? copy.refineStatus({ ...args, wants: andList(picked) })
          : copy.refineStatusPlain(args));
        line.setAttribute('aria-live', 'polite');
        status.append(line);
      }
    }

    grid.replaceChildren();
    hereRestGrid.replaceChildren();
    awayGrid.replaceChildren();
    awayRestGrid.replaceChildren();
    hereGroup.hidden = false;
    awayGroup.hidden = true;
    if (!shown.length) {
      // A guard, not a path the chips can reach: an offered axis always leaves at
      // least one car. Rejection can empty a set for real, and this is what it lands on.
      const dead = el('div', 'vm-refine-empty');
      dead.append(el('p', 'vm-refine-empty-text', wants.length
        ? copy.refineEmpty({ wants: andList(wants) })
        : copy.refineEmptyHidden));
      const clear = el('button', 'vm-btn vm-btn-ghost', 'Start again');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        active.clear();
        constraints.clear();
        hidden.clear();
        redraw();
      });
      dead.append(clear);
      grid.append(dead);
      // No cars anywhere, so there is no place to label.
      hereLabel.hidden = true;
      return;
    }

    /*
     * Who leads the page: normally the retailer (the point of scoping to it); only
     * when every one of its cars is ruled out does the answer come from the group beyond.
     */
    const leadIsHere = here.length > 0;
    /*
     * Full cards in the second group are reserved for cars that OUTRANK the best here
     * (so a genuinely better car is a real card to reject/refine); `leadOf`, not a flat cap, lands the cut on a real score gap.
     */
    const hereLead = leadIsHere ? shown : [];
    const beats = leadIsHere ? away.filter((m) => m.score > here[0].score) : away;
    /*
     * Capped to the retailer's own lead so a competitors' section can't outweigh the host
     * (at least one full card survives). Skipped when every local car is ruled out, since then the group beyond IS the answer.
     */
    const awayLead = beats.length
      ? leadOf(beats).slice(0, leadIsHere ? Math.max(1, hereLead.length) : undefined)
      : [];
    /*
     * The tail: what else is worth a look, cut by relevance then length. The floor is
     * measured against the best car anywhere on the page, so both groups share one standard.
     */
    const drop = (list, taken) => list
      .slice(taken.length, taken.length + TAIL_SHOWN)
      .filter((m) => m.score >= relevanceFloor());

    // One car left is a recommendation again, so it gets the hero treatment (photo,
    // reasons, trade-off) and keeps its reject menu — the answer must survive scrutiny.
    const single = shown.length === 1;
    const full = (m, big = false) => matchCard(m, {
      big,
      brand: ctx.brand,
      rejectOptions,
      rejectLabel: copy.rejectOpen,
      rejectPrompt: copy.rejectPrompt,
    });
    const tile = (m) => matchCard(m, { compact: true, brand: ctx.brand });
    // The grid holding the LEAD goes full width for a single car; the other
    // group's stays two-up whatever it holds, so it never competes for hero.
    grid.classList.toggle('vm-grid-tied', !(leadIsHere && single));
    awayGrid.classList.toggle('vm-grid-tied', !(!leadIsHere && single));

    hereLead.forEach((m) => grid.append(full(m, single)));
    drop(here, hereLead).forEach((m) => hereRestGrid.append(tile(m)));
    hereLabel.textContent = copy.hereHeading({ retailer: ctx.retailerLabel });
    hereLabel.hidden = !here.length;
    hereGroup.hidden = !here.length;

    awayLead.forEach((m) => awayGrid.append(full(m, leadIsHere ? false : single)));
    drop(away, awayLead).forEach((m) => awayRestGrid.append(tile(m)));
    /*
     * While the national search is outstanding the group stays on screen with its
     * heading and pending line, holding the space; once it lands, shown only if non-empty.
     */
    awayPending.hidden = !stillSearching;
    awayLabel.hidden = !away.length && !stillSearching;
    awayGroup.hidden = !away.length && !stillSearching;

    /*
     * The working, last: evidence for the verdict above it. The margin is measured off
     * the cars on screen (so rejecting the leader re-states it), only when there's a gap.
     */
    working.replaceChildren();
    working.hidden = !searched || !alive.length;
    if (searched && alive.length) {
      working.append(el('p', 'vm-working-label', copy.workingLabel));
      /*
       * The margin is measured over the RETAILER's own cars, matching the headline's
       * scope. Over everything it never fired (nearby stock ties at the top on every persona).
       */
      const margin = here.length > 1 ? Math.round(here[0].score - here[1].score) : null;
      /*
       * In the weak state the margin says nothing: the useful number is the top score
       * that put the page here. Stated here not in the headline so the two don't repeat.
       */
      const closing = state === 'weak'
        ? copy.workingWeak({ top: shown[0].score })
        : (margin != null && margin >= CLUSTER_PTS ? copy.workingMargin({ margin }) : '');
      working.append(el('p', 'vm-working-text', copy.working(searched) + closing + copy.workingScore));
    }
  }

  redraw();

  return {
    host,
    /*
     * Nearby stock, arriving after first paint, joins the SAME pool and is re-sorted, so
     * a distant car that suits the buyer better leads rather than sitting as a footnote.
     */
    /*
     * The national search is done, whatever it found. Drops the pending line,
     * and lets an empty away group hide itself again.
     */
    searchDone() {
      if (!stillSearching) return;
      stillSearching = false;
      redraw();
    },
    addToPool(extra) {
      stillSearching = false;
      if (!extra?.length) { redraw(); return; }
      const known = new Set(pool.map((m) => m.car.id));
      const fresh = extra.filter((m) => !known.has(m.car.id));
      if (!fresh.length) return;
      pool = [...pool, ...fresh].sort(rank);
      // The notice and the headline's scope are both derived inside redraw
      // from the same comparison, so there is nothing to announce here.
      redraw();
    },
    /*
     * Told by renderResults which car the rescue note points at (null for the unmet
     * note). The notice stands down for that car only, so the same fact isn't said twice.
     */
    noteShown(carId = null) {
      notedCarId = carId;
      redraw();
    },
  };
}

/** The unmet wants as brand-voiced plural phrases — fuel first, then shape:
 * "fully electric cars", "estates". Shared by the two notes below. */
function unmetPhrases(brandKey, unmet) {
  const phrases = UNMET_PHRASES[brandKey] || UNMET_PHRASES.bmw;
  return ['fuel', 'bodyStyles'].flatMap(
    (id) => (unmet[id] || []).map((v) => phrases[id]?.[v] || v),
  );
}

/**
 * A brand-voiced note admitting something asked for isn't in the stock we searched,
 * framing what's shown as the closest fit. Null when there's nothing to admit to.
 */
function unmetNote(ctx, unmet) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const items = unmetPhrases(ctx.brand, unmet);
  if (!items.length) return null;

  const note = el('aside', 'vm-unmet');
  note.setAttribute('role', 'note');
  if (copy.unmetLabel) note.append(el('p', 'vm-unmet-label', copy.unmetLabel));
  note.append(el('p', 'vm-unmet-text', copy.unmet({
    list: orList(items), retailer: ctx.retailerLabel,
  })));
  return note;
}

/**
 * The state-3 note (docs/results-page-states.md): a want missing at THIS retailer but met
 * nearby. Sibling of unmetNote, opposite polarity; local cards keep the lead (owner decision).
 * @param {Object} rescued unmet-shaped: the wants missing here but met nearby
 * @param {Object} nearest the closest nearby match that meets the whole brief
 */
function rescueNote(ctx, rescued, nearest) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const items = unmetPhrases(ctx.brand, rescued);
  if (!items.length) return null;

  const note = el('aside', 'vm-unmet');
  note.setAttribute('role', 'note');
  if (copy.rescueLabel) note.append(el('p', 'vm-unmet-label', copy.rescueLabel));
  note.append(el('p', 'vm-unmet-text', copy.rescueNote({
    list: orList(items),
    retailer: ctx.retailerLabel,
    miles: `${Math.round(nearest.car.distance * 10) / 10} miles`,
    where: nearest.car.retailerName || 'a nearby retailer',
  })));
  return note;
}

/* The engine client lives in ../engine.js (or ./preview-feed.js for the debounced
 * preview); the shared question widgets live in ./question-ui.js. */

function encodeAnswers(answers) {
  const json = JSON.stringify(answers);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeAnswers(encoded, questions) {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const answers = JSON.parse(decodeURIComponent(escape(atob(b64))));
    // Minimal validation: every question that should be shown must be answered.
    const valid = questions.every((q) => !isVisible(q, answers) || answers[q.id] != null);
    return valid && validBudget(answers.budget) ? answers : null;
  } catch {
    return null;
  }
}

function answersFromHash(questions) {
  const match = window.location.hash.match(new RegExp(`${HASH_KEY}=([A-Za-z0-9_-]+)`));
  return match ? decodeAnswers(match[1], questions) : null;
}

/*
 * What actually separates cars the engine scored the same. Axes are computed from the
 * cluster (an axis exists only where it splits the set, so it can't be dead or empty the list); ranked by how evenly each splits, since a 3/3 tells us more per tap than a 5/1.
 * @returns {Array<{ id, label, test(car), have }>}
 */

/** A listing's normalised shade ("Blue"), falling back to its marketing name. */
const shadeOf = (l) => l.shade || l.colour;

/**
 * Rebuild a grouped card from surviving listings: stock-depth claims are derived, so a filter
 * must update them. Fields follow the best survivor; `id` stays put, since "just not this one" uses it.
 */
function regroup(car, kept) {
  const head = kept[0];
  const prices = kept.map((l) => l.priceMin).filter(Number.isFinite);
  return {
    ...car,
    photo: head.photo || car.photo,
    colour: head.colour ? { manufacturerColour: head.colour, colour: head.shade } : car.colour,
    priceMin: head.priceMin ?? car.priceMin,
    mileage: head.mileage ?? car.mileage,
    transmission: head.transmission ?? car.transmission,
    link: head.link || car.link,
    listingCount: kept.length,
    priceFrom: prices.length ? Math.min(...prices) : car.priceFrom,
    priceTo: prices.length ? Math.max(...prices) : car.priceTo,
    colours: [...new Set(kept.map((l) => l.colour).filter(Boolean))],
    features: [...new Set(kept.flatMap((l) => l.features || []))],
  };
}

/**
 * The ways this set of cards can still be split, as chips. Tests LISTINGS not cards (so
 * "Blue" leaves the blue ones); an axis earns its place when some listing has the thing and some doesn't, so even a single multi-colour card offers colour.
 */
// How many chips the page will offer at once. Six is about what reads as
// "here are some ways to split these" rather than as a search form.
const MAX_AXES = 6;

function refinementAxes(groups) {
  const all = groups.flat();
  const axes = [];
  const offer = (id, label, test) => {
    if (!all.some(test) || all.every(test)) return; // changes nothing
    axes.push({ id, label, have: groups.filter((ls) => ls.some(test)).length, test });
  };

  for (const [key, label] of Object.entries(CONCEPT_LABELS)) {
    offer(`f:${key}`, label, (l) => (l.features || []).includes(key));
  }

  // Gearbox: a genuine dealbreaker, and a live split for MINI (~12% manual).
  for (const [value, label] of [['auto', 'Automatic'], ['manual', 'Manual']]) {
    offer(`g:${value}`, label, (l) => l.transmission === value);
  }

  // Colour, by its normalised name ("Grey"), each shade its own axis. A listing with
  // no colour never matches a colour axis, which is honest: we can't claim it's the blue one.
  for (const shade of new Set(all.map(shadeOf).filter(Boolean))) {
    offer(`c:${shade}`, shade, (l) => shadeOf(l) === shade);
  }

  // Best-balanced first: an axis that halves the set is worth more than one
  // that shaves a single car off it.
  const balance = (a) => Math.abs(a.have / groups.length - 0.5);
  axes.sort((a, b) => balance(a) - balance(b) || a.label.localeCompare(b.label));
  // Capped, because testing listings rather than cards removed the implicit bound: an
  // equipment-rich cluster can produce eleven chips, and a wall of chips is a filter panel.
  return axes.slice(0, MAX_AXES);
}

/* ------------------------------ screens ------------------------------ */

function renderIntro(root, ctx) {
  root.replaceChildren();
  const intro = el('div', 'vm-intro');
  // Count the questions a typical run sees ("Help me decide" shows the conditional
  // charging question). fuel is multi-select now, so pass it as an array.
  const count = visibleQuestions(ctx.questions, { fuel: ['open'] }).length;
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  // Authored overrides win; a blank row suppresses the line entirely, so the block can
  // sit under a host page's own heading without repeating it (see copyRow).
  const { title: titleOverride, kicker: kickerOverride } = ctx.overrides;
  const kicker = kickerOverride === undefined ? 'The unofficial UK matchmaker' : kickerOverride;
  const title = titleOverride === undefined ? copy.title : titleOverride;
  if (kicker) intro.append(el('p', 'vm-kicker', kicker));
  if (title) intro.append(el('h1', 'vm-title', title));
  intro.append(el('p', 'vm-lede', copy.lede({
    questions: count, retailer: ctx.retailerLabel,
  })));
  const start = el('button', 'vm-btn vm-btn-primary', copy.cta);
  start.addEventListener('click', () => ctx.showQuestion(0));
  intro.append(start);
  root.append(intro);
}

/* -------------------------- live "best guess" preview ---------------------- */

// Debounce and latest-wins guard live in ./preview-feed.js; below is this mode's own
// strip. Cross-fade duration for a re-rank (in sync with the .vm-preview-track transition).
const PREVIEW_FADE_MS = 150;

/** Can the engine score these answers yet? It hard-requires a valid budget. */
function canPreview(ctx) {
  return validBudget(ctx.answers.budget);
}

// How many skeleton tiles to show while the first guess loads. A handful is
// enough to fill the strip's width so it reads as "results loading here".
const PREVIEW_SKELETON_COUNT = 5;

/**
 * Build the live preview section: a heading + a horizontal strip of mini result tiles.
 * Mounts straight away (budget is set from the first render), skeleton until the first guess lands.
 */
function renderPreviewSection(ctx) {
  const section = el('section', 'vm-preview');
  section.append(el('h3', 'vm-subhead vm-nearby-heading vm-preview-heading', 'SHORTLISTING FOR YOU'));
  const track = el('div', 'vm-nearby vm-preview-track');
  track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', `Your closest matches so far at ${ctx.retailerLabel}`);
  section.append(track);
  paintPreview(section, ctx);
  return section;
}

/** A shimmer placeholder shaped like a mini preview tile (media + two lines). */
function previewSkeletonTile() {
  const tile = el('div', 'vm-ptile vm-ptile-mini vm-skel-ptile');
  tile.append(el('div', 'vm-skel vm-ptile-media'));
  const body = el('div', 'vm-ptile-body');
  body.append(
    el('div', 'vm-skel vm-skel-line vm-skel-name'),
    el('div', 'vm-skel vm-skel-line vm-skel-specs'),
  );
  tile.append(body);
  return tile;
}

/**
 * Refill the strip from ctx.preview.matches, with a soft cross-fade so a re-rank reads
 * as "just updated". With no matches yet, paint skeleton tiles so the bar holds its footprint.
 */
function paintPreview(section, ctx) {
  const track = section.querySelector('.vm-preview-track');
  const hasMatches = ctx.preview.matches.length > 0;
  const swap = () => {
    track.replaceChildren();
    if (hasMatches) {
      ctx.preview.matches.forEach((m) => track.append(previewTile(m, 'mini')));
    } else {
      for (let i = 0; i < PREVIEW_SKELETON_COUNT; i += 1) track.append(previewSkeletonTile());
    }
    requestAnimationFrame(() => track.classList.remove('is-fading'));
  };
  // Cross-fade only when swapping real tiles for real tiles (a re-rank). The
  // first skeleton→results fill is a plain swap so results appear promptly.
  const showingReal = track.querySelector('.vm-ptile:not(.vm-skel-ptile)');
  if (showingReal && hasMatches) {
    track.classList.add('is-fading');
    setTimeout(swap, PREVIEW_FADE_MS);
  } else {
    swap();
  }
}

/**
 * Mount or update the preview for the current answers. Mounts as soon as a budget is
 * set (skeleton until the first guess), repaints on updates, removed only if we can't preview.
 */
function showPreview(ctx) {
  const screen = document.querySelector('.vm-screen');
  if (!screen) return;
  let section = screen.querySelector('.vm-preview');
  const { matches, loaded } = ctx.preview;
  // Hide the strip only when there's nothing to show: no budget yet, or a guess landed
  // with zero matches. While a budget is set but the first guess hasn't arrived, keep skeletons.
  if ((!canPreview(ctx) && !matches.length) || (loaded && !matches.length)) {
    section?.remove();
    return;
  }
  if (!section) {
    section = renderPreviewSection(ctx);
    ctx.mountPreview(screen, section);
  } else {
    paintPreview(section, ctx);
  }
}

/**
 * Ask the feed for a fresh guess and paint it when it lands (a no-op until a budget is set).
 * `ctx.preview.seq` is a per-run guard: starting over bumps it so a late response can't repopulate the new run.
 */
function schedulePreviewRefresh(ctx) {
  if (!canPreview(ctx)) return;
  const run = ctx.preview.seq;
  ctx.previewFeed.schedule(ctx.answers, (matches) => {
    if (run !== ctx.preview.seq) return;
    ctx.preview.matches = matches;
    ctx.preview.loaded = true; // first (and every) response has now landed
    showPreview(ctx);
  });
}

/**
 * A wrapping row of tap-to-edit summary pills, one per question answered before the
 * current one. Tapping a pill jumps back to edit and sets a return point; null if none yet.
 * @param {number} index current question's position in the visible list
 */
function renderAnswerPills(ctx, questions, index) {
  const row = el('div', 'vm-pills');
  for (let i = 0; i < index; i += 1) {
    const question = questions[i];
    const label = pillFor(question, ctx.answers);
    if (!label) continue; // unanswered (shouldn't happen before `index`, but safe)
    const pill = el('button', 'vm-pill');
    pill.type = 'button';
    pill.append(el('span', 'vm-pill-text', label));
    pill.append(el('span', 'vm-pill-edit', '✎'));
    pill.setAttribute('aria-label', `${question.title.replace(/[?？]$/, '')}: ${label}. Edit`);
    pill.addEventListener('click', () => {
      // Remember where we were so advance() returns here after the edit.
      ctx.editReturnIndex = index;
      ctx.showQuestion(i);
    });
    row.append(pill);
  }
  return row.children.length ? row : null;
}

function renderQuestion(root, ctx, index) {
  const questions = visibleQuestions(ctx.questions, ctx.answers);
  const q = questions[index];

  root.replaceChildren();
  const screen = el('div', 'vm-screen');

  const progress = el('div', 'vm-progress');
  const bar = el('div', 'vm-progress-bar');
  bar.style.width = `${((index + 1) / questions.length) * 100}%`;
  progress.append(bar);
  screen.append(progress, el('p', 'vm-step', `Question ${index + 1} of ${questions.length}`));

  // Summary pills for every question already answered before this one, each a
  // tap-to-edit button that remembers the current index so advancing returns here.
  const answeredPills = renderAnswerPills(ctx, questions, index);
  if (answeredPills) screen.append(answeredPills);

  screen.append(el('h2', 'vm-question', q.title));
  if (q.help) screen.append(el('p', 'vm-help', q.help));

  const advance = () => {
    const total = visibleQuestions(ctx.questions, ctx.answers).length;
    // Editing a pill sets a return point: once re-answered, jump back rather than walk
    // forward. Only honour it when it moves forward, and clamp to the live visible range.
    const returnTo = ctx.editReturnIndex;
    if (returnTo != null) {
      ctx.editReturnIndex = null;
      const target = Math.min(returnTo, total - 1);
      if (target > index) return ctx.showQuestion(target);
    }
    if (index + 1 < total) ctx.showQuestion(index + 1);
    else ctx.showResults(ctx.answers, { updateHash: true });
  };

  const isSlider = q.type === 'slider';
  // A slider is a single labelled input, so it gets a bare container; an option list
  // builds its own and arrives with the group role already on it (see question-ui.js).
  let list;
  // The option list's live selection, which is what the Next button below is
  // enabled by. A slider always has a value, so it has no such set.
  let selected = null;
  if (isSlider && q.range) {
    // Dual-thumb range (budget): two overlaid inputs writing a [min, max] pair.
    list = el('div', 'vm-options vm-slider');
    renderRangeSlider(list, q, ctx.answers, { onChange: () => schedulePreviewRefresh(ctx) });
  } else if (isSlider) {
    // A range input plus a live readout, writing a number to ctx.answers[q.id]. Unlike
    // a single-select it never auto-advances; the Next button is the commit point.
    list = el('div', 'vm-options vm-slider');
    const stored = ctx.answers[q.id];
    const startValue = typeof stored === 'number'
      ? stored
      : (typeof q.default === 'number' ? q.default : q.min);

    const readout = el('output', 'vm-slider-value', formatSliderValue(startValue, q));
    const input = el('input', 'vm-slider-input');
    input.type = 'range';
    input.min = String(q.min);
    input.max = String(q.max);
    input.step = String(q.step);
    input.value = String(startValue);
    input.setAttribute('aria-label', q.title);
    input.setAttribute('aria-valuetext', formatSliderValue(startValue, q));
    // Persist the starting value immediately so the answer exists even if the
    // user accepts the default without dragging (Next is enabled from the off).
    ctx.answers[q.id] = startValue;

    const bounds = el('div', 'vm-slider-bounds');
    bounds.append(
      el('span', 'vm-slider-min', formatSliderValue(q.min, q)),
      el('span', 'vm-slider-max', formatSliderValue(q.max, q)),
    );

    input.addEventListener('input', () => {
      const value = Number(input.value);
      ctx.answers[q.id] = value;
      const text = formatSliderValue(value, q);
      readout.textContent = text;
      input.setAttribute('aria-valuetext', text);
      schedulePreviewRefresh(ctx);
    });

    list.append(readout, input, bounds);
  } else {
    ({ list, selected } = renderOptionList(q, ctx.answers, {
      onChange: () => {
        // Multi-select commits via Next, so the button tracks the selection.
        if (q.multi) next.disabled = selected.size === 0;
        // Refresh before advancing: the debounced fetch belongs to the mode, so the next
        // question's drawer picks up the result even though this screen is about to be replaced.
        schedulePreviewRefresh(ctx);
      },
      onPick: advance,
    }));
  }
  screen.append(list);

  const nav = el('div', 'vm-nav');
  const back = el('button', 'vm-btn vm-btn-ghost', 'Back');
  back.type = 'button';
  back.disabled = index === 0;
  back.addEventListener('click', () => ctx.showQuestion(index - 1));
  nav.append(back);

  const next = el('button', 'vm-btn vm-btn-primary', index + 1 === questions.length ? 'Explore my matches' : 'Next');
  next.type = 'button';
  // Multi-select and sliders both commit via Next (a slider always has a value,
  // so it's enabled from the off); single-select auto-advances on tap.
  if (q.multi || isSlider) {
    next.disabled = q.multi ? selected.size === 0 : false;
    next.addEventListener('click', advance);
    nav.append(next);
  }
  screen.append(nav);

  root.append(screen);
  screen.querySelector('.vm-question').setAttribute('tabindex', '-1');
  screen.querySelector('.vm-question').focus({ preventScroll: true });

  // Live "best guess" strip. Mount immediately if matches are cached (Back/Next) so it
  // doesn't flash; showPreview removes it when there are no matches, so it's never empty.
  showPreview(ctx);

  // Refresh on entering the question too, so Back/Next updates the guess without an answer
  // change. Cheap: stock is served from the warmed cache and the call is debounced.
  schedulePreviewRefresh(ctx);
}

/** Full-screen status message (loading / error), optionally with a retry button. */
function renderStatus(root, { kicker, title, message, retryLabel, onRetry }) {
  root.replaceChildren();
  const screen = el('div', 'vm-screen vm-status');
  if (kicker) screen.append(el('p', 'vm-kicker', kicker));
  screen.append(el('h2', 'vm-title', title));
  if (message) screen.append(el('p', 'vm-lede', message));
  if (onRetry) {
    const retry = el('button', 'vm-btn vm-btn-primary', retryLabel || 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', onRetry);
    screen.append(retry);
  }
  root.append(screen);
}

/**
 * Skeleton placeholder for the intro screen, shown while the question set loads. Mirrors
 * renderIntro's layout so the boot reads as "the intro, arriving" not a "Loading" status.
 */
function renderIntroSkeleton(root) {
  root.replaceChildren();
  const intro = el('div', 'vm-intro vm-intro-skeleton');
  intro.setAttribute('aria-busy', 'true');
  intro.setAttribute('aria-label', 'Loading the matcher');
  const skel = (mod) => el('div', `vm-skel ${mod}`);
  intro.append(
    skel('vm-skel-kicker'),
    skel('vm-skel-title'),
    skel('vm-skel-line vm-skel-lede'),
    skel('vm-skel-line vm-skel-lede'),
    skel('vm-skel-line vm-skel-lede vm-skel-lede-last'),
    skel('vm-skel-btn'),
  );
  root.append(intro);
}

/**
 * Skeleton placeholder for the results page, shown while /api/match is in flight. Mirrors
 * the real layout (hero card + compact tiles) so the load reads as "this page, arriving".
 */
function renderResultsSkeleton(root) {
  root.replaceChildren();
  const screen = el('div', 'vm-screen vm-results vm-results-skeleton');
  // Announce the wait for assistive tech, since there's no visible status text.
  screen.setAttribute('aria-busy', 'true');
  screen.setAttribute('aria-label', 'Finding your matches');

  // A skeleton block: className extends .vm-skel with a shape modifier.
  const skel = (mod) => el('div', `vm-skel ${mod}`);

  screen.append(skel('vm-skel-kicker'), skel('vm-skel-title'));

  // Hero card: media band + a few body lines, matching matchCard(big).
  const hero = el('div', 'vm-grid');
  const heroCard = el('article', 'vm-card vm-card-big vm-skel-card');
  heroCard.append(el('div', 'vm-skel vm-skel-media'));
  const heroBody = el('div', 'vm-card-body');
  heroBody.append(
    skel('vm-skel-line vm-skel-name'),
    skel('vm-skel-line vm-skel-specs'),
    skel('vm-skel-line vm-skel-blurb'),
    skel('vm-skel-line vm-skel-blurb'),
  );
  heroCard.append(heroBody);
  hero.append(heroCard);
  screen.append(hero);

  // Compact-tile skeletons, matching the tile row each group paints below its
  // lead cards.
  const more = el('div', 'vm-tail-grid');
  for (let i = 0; i < 3; i += 1) {
    const tile = el('article', 'vm-card vm-card-compact vm-skel-card');
    tile.append(el('div', 'vm-skel vm-skel-media'));
    const body = el('div', 'vm-card-body');
    body.append(
      skel('vm-skel-line vm-skel-name'),
      skel('vm-skel-line vm-skel-specs'),
    );
    tile.append(body);
    more.append(tile);
  }
  screen.append(more);

  root.append(screen);
}

/**
 * The "Worth the drive" band with a skeleton carousel, shown while /api/nearby is in
 * flight. Returns the <section> to fill (fillNearbyBand) or remove; matches the real band exactly.
 */
function renderNearbySkeleton(ctx, lede) {
  const band = el('section', 'vm-nearby-band');
  band.setAttribute('aria-busy', 'true');
  band.append(
    el('h3', 'vm-subhead vm-nearby-heading', 'WORTH THE DRIVE'),
    el('p', 'vm-lede vm-nearby-lede', lede),
  );
  const track = el('div', 'vm-nearby');
  // A few placeholder tiles mirroring the compact card (media band + 2 lines).
  for (let i = 0; i < 3; i += 1) {
    const tile = el('article', 'vm-card vm-card-compact vm-skel-card');
    tile.append(el('div', 'vm-skel vm-skel-media'));
    const body = el('div', 'vm-card-body');
    body.append(
      el('div', 'vm-skel vm-skel-line vm-skel-name'),
      el('div', 'vm-skel vm-skel-line vm-skel-specs'),
    );
    tile.append(body);
    track.append(tile);
  }
  band.append(track);
  return band;
}

/**
 * Swap a nearby skeleton band for the real carousel of nearby-retailer matches, in
 * place. Replaces only the track so the heading/lede stay put.
 */
function fillNearbyBand(band, ctx, nearby) {
  band.removeAttribute('aria-busy');
  band.querySelector('.vm-nearby')?.remove();
  const track = el('div', 'vm-nearby');
  // Focusable so the carousel is scrollable by keyboard, not just by swipe.
  track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', `Matches at other retailers near ${ctx.retailerLabel}`);
  nearby.forEach((m) => track.append(matchCard(m, { compact: true })));
  band.append(track);
}

async function renderResults(root, ctx, answers) {
  renderResultsSkeleton(root);

  // Two-phase load: the retailer's own matches (fast) render first; the nearby carousel
  // (slow national search) is fetched separately below so it never holds up the hero.
  let matches;
  // Whether the engine could pick a winner, and how big the tie is if not. Defaults to
  // the old behaviour, so an API without `decisive` keeps its single-hero page.
  let decisive = true;
  let clusterSize = 1;
  // Fit tied, but their stated priorities picked a winner (see matchCars).
  let tasteLead = false;
  // Held back by the API so a rejection has a next-best car to promote.
  let alternatives = [];
  // How much stock was searched and how much survived the hard filters, so the page can
  // show its working. Absent from an older API, in which case the working note never renders.
  let searched = null;
  // The one ranked list, once it exists. Nearby stock is merged into it when
  // the national search resolves (see addToPool below).
  let refine = null;
  // What the retailer's own stock couldn't offer. Half the picture: nothing is said
  // until /api/nearby agrees (see agreedUnmet); an older API leaves this empty.
  let retailerUnmet = {};

  /*
   * Both searches leave together. Now that nearby stock joins the one ranked list, a
   * late arrival changes the ANSWER, so starting it second would land after reading began.
   */
  const nearbyPromise = apiNearby(ctx.api, answers, ctx.retailer, ctx.brand);
  // Swallow rejections at the source: created before anything awaits it, an unhandled
  // rejection would surface as a console error on a page that recovers fine without nearby.
  nearbyPromise.catch(() => {});

  try {
    ({
      matches, decisive = true, clusterSize = 1, tasteLead = false,
      alternatives = [], unmet: retailerUnmet = {}, searched = null,
    } = await apiMatch(ctx.api, answers, ctx.retailer, ctx.brand));
  } catch {
    renderStatus(root, {
      kicker: 'Sorry',
      title: 'We couldn’t reach the matcher.',
      message: 'The matching service didn’t respond. Check your connection and try again.',
      retryLabel: 'Try again',
      onRetry: () => renderResults(root, ctx, answers),
    });
    return;
  }

  /*
   * Give the national search a moment (GRACE_MS) to catch up: if it arrives in time its
   * cars go into the FIRST paint, else we paint without it and stream it in. Null = still searching.
   */
  const early = await Promise.race([
    nearbyPromise.catch(() => null),
    new Promise((resolve) => { setTimeout(() => resolve(null), GRACE_MS); }),
  ]);

  root.replaceChildren();
  const screen = el('div', 'vm-screen vm-results');
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const { name: brandName } = copy;

  screen.append(el('p', 'vm-kicker', 'Your results'));

  if (matches.length === 0) {
    screen.append(
      el('h2', 'vm-title', 'No matches found.'),
      el('p', 'vm-lede', `Nothing in ${ctx.retailerLabel}'s current stock fits those answers. Try loosening the budget or seating needs.`),
    );
  } else {
    // How many cars lead the page as EQUALS: one when the engine picked a winner, else
    // the tie itself, never more — the headline counts these and must not overclaim a near-miss.
    /*
     * The frames, one per situation (docs/results-page-states.md). renderRefine picks
     * between them each redraw from on-screen scores, so all this supplies is the words.
     */
    const perfect = ({ model }) => `Your perfect ${brandName} is the ${model}.`;
    /*
     * The same claim scoped to this retailer, used only when a car elsewhere outranks the
     * best here. Accurate about what was searched: the block is authored onto ONE site.
     */
    const perfectHere = ({ model, retailer }) => `Your perfect ${brandName} at ${retailer} `
      + `is the ${model}.`;
    const frames = {
      // The leader misses something asked for: never "perfect", always
      // "closest". Its own card carries the trade-off line saying what.
      closest: {
        // Already retailer-scoped in its own copy, so `tied` needs no variant.
        tied: () => copy.closestTitle({ retailer: ctx.retailerLabel }),
        settled: copy.closestSettled,
        settledHere: copy.closestSettledHere,
        lede: copy.closestLede(),
      },
      /*
       * The leader misses the brief AND is below WEAK_SCORE: the page stops offering an
       * answer but keeps the cards as evidence. Both keys are the same sentence, so narrowing to one card can't turn it into a settled verdict.
       */
      weak: {
        tied: () => copy.weakTitle({ retailer: ctx.retailerLabel }),
        settled: () => copy.weakTitle({ retailer: ctx.retailerLabel }),
        lede: copy.weakLede(),
        ledeSurvivesNarrowing: true,
      },
      // Nothing else came within CLUSTER_PTS: the decree is earned.
      decree: {
        tied: perfect, settled: perfect, tiedHere: perfectHere, settledHere: perfectHere, lede: null,
      },
      // Several suit them equally; their priorities picked this one. NOT
      // "your perfect X" — that would overclaim over cars that also fit.
      taste: {
        tied: copy.tasteTitle,
        settled: copy.tasteTitle,
        tiedHere: copy.tasteTitleHere,
        settledHere: copy.tasteTitleHere,
        lede: copy.tasteLede(),
        // This lede is about the named car, so it survives narrowing to one.
        ledeSurvivesNarrowing: true,
      },
      // A genuine tie: say so, and hand over the chips.
      tie: {
        tied: copy.tiedTitle,
        settled: perfect,
        tiedHere: copy.tiedTitleHere,
        settledHere: perfectHere,
        lede: copy.tiedLede(),
      },
    };

    const title = el('h2', 'vm-title', '');
    const lede = el('p', 'vm-lede', '');
    screen.append(title, lede);

    /*
     * One pool, one list: matches, held-back alternatives, and later the nearby stock. The
     * old page's three ranked sections could claim a local car fit best above a higher-scoring one.
     */
    /*
     * `early` is the national search when it beat the grace period, so its cars make the
     * FIRST paint; when it lost, this is empty and a placeholder is filled by applyNearby later.
     */
    refine = renderRefine(
      ctx,
      [...matches, ...alternatives, ...(early?.nearby || [])],
      title, lede, frames, tasteLead, searched,
      // Tell the list whether it is still waiting on anything.
      !early,
    );
    screen.append(refine.host);
  }

  /*
   * Nearby stock now joins the one ranked list (see addToPool), not its own carousel.
   * What remains here is the empty case: with no local list to join, the nearby cars ARE the results.
   */
  const emptyLocal = !matches.length;
  const nearbyBand = emptyLocal
    ? renderNearbySkeleton(ctx, copy.driveLede.empty({ retailer: ctx.retailerLabel }))
    : null;
  if (nearbyBand) screen.append(nearbyBand);

  const actions = el('div', 'vm-actions');
  const share = el('button', 'vm-btn vm-btn-primary', 'Copy share link');
  share.type = 'button';
  share.addEventListener('click', async () => {
    const url = `${window.location.origin}${window.location.pathname}#${HASH_KEY}=${encodeAnswers(answers)}`;
    try {
      await navigator.clipboard.writeText(url);
      share.textContent = 'Link copied';
    } catch {
      window.prompt('Copy your results link:', url);
    }
    setTimeout(() => { share.textContent = 'Copy share link'; }, 2000);
  });
  const tweak = el('button', 'vm-btn vm-btn-ghost', 'Tweak my answers');
  tweak.type = 'button';
  tweak.addEventListener('click', () => ctx.showQuestion(visibleQuestions(ctx.questions, ctx.answers).length - 1));
  const retake = el('button', 'vm-btn vm-btn-ghost', 'Start over');
  retake.type = 'button';
  retake.addEventListener('click', () => {
    ctx.answers = {};
    // Clear the strip's carried-over guess for a fresh run, and bump seq so any
    // in-flight/debounced refresh from the finished run is ignored when it lands.
    ctx.previewFeed.cancel();
    ctx.preview = { matches: [], seq: ctx.preview.seq + 1, loaded: false };
    ctx.editReturnIndex = null;
    window.history.replaceState(null, '', window.location.pathname);
    ctx.showIntro();
  });
  actions.append(share, tweak, retake);
  screen.append(actions);

  // Authorable: right for a public demo, wrong on a retailer's own site (see
  // copyRow). A blank "Disclaimer" row removes it; an authored one replaces it.
  const defaultDisclaimer = `An unofficial tool, not affiliated with or endorsed by ${(BRAND_COPY[ctx.brand] || BRAND_COPY.bmw).name}. Prices and specs are indicative, always check with a retailer.`;
  const disclaimer = ctx.overrides.disclaimer === undefined
    ? defaultDisclaimer
    : ctx.overrides.disclaimer;
  if (disclaimer) screen.append(el('p', 'vm-disclaimer', disclaimer));

  root.append(screen);

  /*
   * What to do with the national search whenever it lands; runs either way (grace-caught into
   * first paint, or later from the promise). Here we learn if a want is truly unavailable, so the unmet note lands here not the hero.
   */
  function applyNearby({ nearby, unmet }) {
    {
      // The user may have navigated away (retake/tweak) before this resolves;
      // only touch the page if it's still in the document.
      if (!screen.isConnected) return;

      // One insertion slot, two polarities (docs/results-page-states.md): state 4 "not anywhere
      // nearby", state 3 "not here, but N miles away". Only ever ADDS; first paint stays true.
      const agreed = agreedUnmet(retailerUnmet, unmet);
      let note = unmetNote(ctx, agreed);
      let ordered = nearby;
      // Which car the note points at, so the "we looked further afield" notice can stand
      // down for that one car rather than the whole page (see renderRefine's noteShown).
      let notedCar = null;
      if (!note && unmet) {
        // Nearby answered and disagreed: whatever the retailer lacks that
        // didn't survive into `agreed` is met somewhere within reach.
        const rescued = {};
        for (const [id, values] of Object.entries(retailerUnmet || {})) {
          const left = values.filter((v) => !(agreed[id] || []).includes(v));
          if (left.length) rescued[id] = left;
        }
        // The cars the note is about: those that HAVE the rescued want itself, not "zero
        // trade-offs overall" — that claims more than the note says and can be empty when it's true.
        const resolves = (car) => (rescued.fuel || []).includes(car.fuel)
          || (rescued.bodyStyles || []).includes(car.body);
        const fits = nearby.filter((m) => resolves(m.car));
        const nearest = fits.filter((m) => m.car.distance != null)
          .reduce((a, b) => (a && a.car.distance <= b.car.distance ? a : b), null);
        if (Object.keys(rescued).length && nearest) {
          note = rescueNote(ctx, rescued, nearest);
          notedCar = nearest.car.id;
          ordered = [...fits, ...nearby.filter((m) => !fits.includes(m))];
        }
      }
      if (note) {
        // Above the cards, whatever frame they're in. The grid lives inside the refine host,
        // so walk up to the screen-level ancestor or insertBefore throws on a non-child node.
        let anchor = screen.querySelector('.vm-refine, .vm-grid');
        while (anchor && anchor.parentElement !== screen) anchor = anchor.parentElement;
        // No cards at all (state 5): the note still belongs with the results,
        // directly above whatever IS there.
        screen.insertBefore(note, anchor || nearbyBand);
        // Tell the list which car the note claimed, so the notice doesn't say a
        // second, vaguer version of the same sentence about the same car.
        refine?.noteShown(notedCar);
      }
      /*
       * The merge. Nearby cars join the one ranked list, not a band beneath it, so the page
       * never claims a local car beats a higher-scoring distant one. With no retailer list, they keep the standalone band.
       */
      if (refine) refine.addToPool(ordered);
      else if (nearbyBand && ordered.length) fillNearbyBand(nearbyBand, ctx, ordered);
      else nearbyBand?.remove();
    }
  }

  /*
   * Grace-caught: cars are already in first paint and this only adds the note. Otherwise
   * the placeholder is on screen and this replaces it.
   */
  if (early) applyNearby(early);
  else {
    nearbyPromise.then(applyNearby).catch(() => { refine?.searchDone(); });
  }
}

/* ------------------------------ decorate ------------------------------ */

/*
 * The questionnaire interface as a mountable mode: the shell has prepared `ctx` and handed us
 * `root`, and `mount` augments ctx with per-run state and navigation, then boots.
 */
/*
 * `mount` returns synchronously on purpose: the shell doesn't await us, so a slow first request
 * never holds the document hostage. We paint a skeleton now and swap in the real thing later.
 */
function mount(root, ctx) {
  // Per-run UI state this mode owns, hung on the shared ctx.
  ctx.answers = {};
  ctx.questions = [];
  // Live "best guess" strip state on ctx so it survives per-question re-render. `seq` counts
  // the RUN so starting over disowns stale responses; `loaded` distinguishes loading from no-matches.
  ctx.preview = { matches: [], seq: 0, loaded: false };
  // No `group`: the questions drawer shows individual cars, so its requests are
  // exactly what they always were.
  ctx.previewFeed = createPreviewFeed({
    api: ctx.api, retailer: ctx.retailer, brand: ctx.brand,
  });
  // Set when a summary pill is tapped to edit an earlier answer: the index to return to once
  // that answer is re-submitted (see renderAnswerPills / advance). Null the rest of the time.
  ctx.editReturnIndex = null;
  // Where the preview strip mounts within the quiz screen; the one spot that differs by
  // layout. Here it sits at the END of the screen, below the Back/Next nav.
  ctx.mountPreview = (screen, section) => screen.append(section);

  ctx.showIntro = () => renderIntro(root, ctx);
  ctx.showQuestion = (i) => renderQuestion(root, ctx, i);
  ctx.showResults = (answers, { updateHash = false } = {}) => {
    if (updateHash) {
      window.history.replaceState(null, '', `#${HASH_KEY}=${encodeAnswers(answers)}`);
    }
    renderResults(root, ctx, answers);
  };

  // The question set lives behind the API, so load it before rendering.
  const boot = async () => {
    // Skeleton the intro while the question set loads, so it reads as the page arriving not a
    // "Loading…" status. (A deep-link run swaps to the results skeleton inside renderResults.)
    renderIntroSkeleton(root);
    try {
      const meta = await apiGetQuestions(ctx.api, ctx.retailer, ctx.brand);
      ctx.questions = meta.questions;
    } catch {
      renderStatus(root, {
        kicker: 'Sorry',
        title: 'We couldn’t load the matcher',
        message: 'The matching service didn’t respond. Check your connection and try again.',
        retryLabel: 'Try again',
        onRetry: boot,
      });
      return;
    }

    const shared = answersFromHash(ctx.questions);
    if (shared) {
      ctx.answers = shared;
      ctx.showResults(shared);
    } else {
      ctx.showIntro();
    }
  };

  boot();
}

export default { key: 'questionnaire', label: 'Questionnaire', mount };
