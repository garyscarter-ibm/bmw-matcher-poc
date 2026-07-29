/*
 * BMW Matcher — Adobe Edge Delivery Services (EDS) block.
 *
 * EDS calls `decorate(block)` with the block's DOM element; the quiz UI,
 * results rendering and share links are handled here. The scoring engine and
 * car dataset live behind an API (see server/) so they never reach the
 * browser — the block fetches the quiz definition and match results over HTTP.
 *
 * The API base comes from an authored "API" config row when running on EDS
 * (authored content can set config rows but not HTML attributes), or from a
 * `data-api` attribute for the local harness and the GitHub Pages build,
 * falling back to http://localhost:8787 for local preview. See apiBase.
 *
 * Share links encode the quiz answers in the URL hash (#m=<base64url>); the
 * link is decoded/validated client-side (quiz-meta.js), then the results are
 * re-fetched from the API.
 */

import { SHOW_IF, BUDGET_BANDS, pillFor } from './quiz-meta.js';

const HASH_KEY = 'm';
const DEFAULT_API = 'http://localhost:8787';

/* ------------------------------ helpers ------------------------------ */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Is the budget answer usable? Budget drives the engine's one hard requirement.
 * It's a dual-thumb range ([min, max]) from the slider, but we also accept a bare
 * number (the earlier single-slider shape) and a legacy b1–b5 band key from an
 * old shared link. Mirror of budgetRange's guard in server/engine.js.
 */
function validBudget(value) {
  if (Array.isArray(value)) {
    return value.length === 2 && value.every(Number.isFinite) && Math.max(...value) > 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return !!BUDGET_BANDS[value];
}

/**
 * API base for this block, in precedence order:
 *   1. the `data-api` attribute — the local harness and the Pages build set
 *      it (the harness's ?api= override writes here too), so a query override
 *      always wins;
 *   2. an authored "API" config row — the EDS path, because authored content
 *      can produce config rows but not HTML attributes;
 *   3. the localhost default, for `npm run serve`.
 * Trailing slashes are trimmed so `${base}/api/...` never doubles up. An empty
 * or absent row is falsy and simply falls through.
 */
function apiBase(block) {
  const authored = readBlockConfig(block).api;
  return (block.dataset.api || authored || DEFAULT_API).replace(/\/+$/, '');
}

/**
 * Read authored block config the standard EDS way: each row below the block
 * name becomes a child `<div>` with two nested `<div>` cells (key, value).
 * See aem-boilerplate's `readBlockConfig()` — same shape, same convention,
 * so a page author sets config in their DA table, not in code.
 */
function readBlockConfig(block) {
  const config = {};
  [...block.children].forEach((row) => {
    const cols = [...row.children];
    if (cols.length < 2) return;
    const key = cols[0].textContent.trim().toLowerCase().replace(/\s+/g, '-');
    if (!key) return;
    config[key] = cols[1].textContent.trim();
  });
  return config;
}

/** Retailer site ID for this block instance: authored "Retailer ID" config
 * row, else undefined (the server falls back to its own default). */
function retailerSite(block) {
  const config = readBlockConfig(block);
  return config['retailer-id'] || config['retailer-site'] || undefined;
}

/**
 * An authored copy override, with three distinct states:
 *   undefined — no row authored, so the block's own default is used;
 *   null      — row authored but blank (or "none"), so the line is SUPPRESSED;
 *   string    — the authored replacement.
 *
 * Suppression is the point: on a real retailer's page the block is usually
 * placed under the site's own section heading, and repeating a title inside
 * the block reads as a stutter. The same mechanism lets a dealer drop the
 * "unofficial" framing, which is right for a public demo and wrong on their
 * own site.
 */
function copyRow(config, key) {
  if (!(key in config)) return undefined;
  const value = config[key].trim();
  return (!value || value.toLowerCase() === 'none') ? null : value;
}

/** The authored copy overrides: `title`, `kicker`, `disclaimer`. */
function copyOverrides(block) {
  const config = readBlockConfig(block);
  return {
    title: copyRow(config, 'title'),
    kicker: copyRow(config, 'kicker'),
    disclaimer: copyRow(config, 'disclaimer'),
  };
}

const DEFAULT_RETAILER_NAME = 'our retailer network';

/** Retailer display name for this block instance: authored "Retailer Name"
 * config row. Required alongside Retailer ID so the copy can name the
 * retailer the stock is actually sourced from; falls back to a generic
 * phrase (and warns) if the page author forgot to set it. */
function retailerName(block) {
  const config = readBlockConfig(block);
  const name = config['retailer-name'];
  if (!name) {
    console.warn('[bmw-matcher] No "Retailer Name" config row set — add one alongside "Retailer ID". Falling back to generic copy.');
    return DEFAULT_RETAILER_NAME;
  }
  return name;
}

/** Brand for this block instance: authored "Brand" config row ("BMW" | "MINI"),
 * lower-cased. Defaults to 'bmw'. Drives both the visual theme (a body class)
 * and which live feed the server queries. */
function brand(block) {
  const config = readBlockConfig(block);
  const b = (config.brand || '').toLowerCase();
  return b === 'mini' ? 'mini' : 'bmw';
}

/** Small cardinals as words, for prose where a numeral would read oddly ("the
 * three cars" beats "the 3 cars"). Anything larger falls back to the numeral,
 * which is fine — it only reads awkwardly at small counts. */
const CARDINALS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cardinal = (n) => CARDINALS[n] ?? String(n);

/** Brand-specific display copy, keyed by brand. `name` is the marque, `title`
 * the intro headline, `cta` the intro button. `lede({ questions, retailer })`
 * builds the intro paragraph — a function because the two brands phrase it
 * differently, not just swap nouns.
 *
 * The question count is passed in rather than written into the copy (brands
 * have different totals, and a brand gaining a question needs no copy edit).
 * Deliberately no match count anywhere: results show one clear winner or the
 * whole tie, so any promised number would be wrong half the time.
 *
 * Voices follow docs/tone-style-guide.md: BMW is assured and understated (the
 * flat, unapologetic close borrowed from bmw.co.uk's register), MINI keeps the
 * warmth but smiles. Deliberately no "quiz" anywhere — this is a matcher, and
 * the word undersold it. */
const BRAND_COPY = {
  bmw: {
    name: 'BMW',
    title: 'Find your perfect BMW.',
    cta: 'Find my BMW',
    // No promised count: results now show one clear winner or the whole tie
    // (up to MAX_SHOWN), so naming a number here would be wrong half the time.
    lede: ({ questions, retailer }) => `${questions} quick questions about your life, `
      + `your miles and your budget. We’ll match you with the approved-used `
      + `cars at ${retailer} that suit you best, and tell you why.`,
    // Approved Used's no-surprises register: state the fact, name the
    // retailer, don't dress it up (docs/tone-style-guide.md). No label —
    // BMW's copy states things rather than announcing them.
    unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
      + 'These are the closest matches to everything else you asked for.',
    // Shown instead of the "your perfect BMW is…" headline when the engine
    // can't separate the top cars (see matchCars: decisive/clusterSize).
    // Stated plainly, as a fact about the stock rather than an apology.
    tiedTitle: ({ count }) => `${cardinal(count)} of these fit you equally well.`,
    /*
     * The scoped headlines, used ONLY when the scope is load-bearing: a car at
     * another retailer genuinely outranks the best one here. Everywhere else
     * the unqualified line stands, because a qualification that isn't doing
     * work is just a smaller claim (docs/results-page-review.md).
     *
     * The block is authored onto ONE retailer's page, so "at Grassicks Garage"
     * is not a hedge — it's a more accurate statement of what was searched. A
     * higher score in the group below then contradicts nothing, because the
     * headline never claimed to be about that group.
     */
    tiedTitleHere: ({ count, retailer }) => `At ${retailer}, ${cardinal(count)} of these `
      + 'fit you equally well.',
    // Fit couldn't separate them, but what they told us matters could. Naming
    // the pick is honest here, and it's what finally makes the preference
    // questions capable of changing the recommendation.
    tasteTitle: ({ model }) => `Your best match is the ${model}.`,
    tasteTitleHere: ({ model, retailer }) => `Your best match at ${retailer} is the ${model}.`,
    tasteLede: () => 'Several of these suit you equally well on paper. This one lines up '
      + 'best with what you said matters.',
    // The retailer is named on every card, so the lede doesn't repeat it —
    // and a brand plural appended to a retailer label reads "Sytner Luton
    // MINI MINIs", which is why neither brand's copy builds one.
    tiedLede: () => 'On your answers we can’t split them: each suits you as well as the next. '
      + 'The difference now is which you prefer the look of.',
    /*
     * The refine panel: BMW states the instruction, no exclamation, no
     * cheerleading (docs/tone-style-guide.md).
     *
     * The label names the effect AND the set it acts on. "So, what do you
     * fancy?" / "Narrow it down" were invitations that never said what a tap
     * would change, and the owner's report of the chips was exactly that: it's
     * "unclear what clicking them affects". That is a labelling problem as much
     * as a positioning one, so both were fixed.
     */
    refineLabel: ({ count }) => (count > 1 ? `Narrow these ${count} down` : 'Narrow this one down'),
    // Feedback at the control itself, the moment a chip goes on. The running
    // brief below the cars says the same thing at more length, but it is below
    // the cars — by the time you reach it you have already stopped wondering
    // whether the tap did anything.
    refineStatus: ({ shown, total, wants }) => `${shown} of ${total}, with ${wants}.`,
    refineStatusPlain: ({ shown, total }) => `${shown} of ${total}.`,
    refineEmpty: ({ wants }) => `Nothing here has ${wants} together. `
      + 'Drop one of those and we’ll show you what does.',
    refineEmptyHidden: 'That’s all of them ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'Nothing left to show.',
    // Rejection, in the retailer's plain register — a question, not a plea.
    rejectOpen: 'Not this one',
    rejectPrompt: 'What put you off?',
    rejectJust: 'Just not this one',
    pickLabel: 'Choose yours',
    briefLabel: 'What I’ve picked up',
    hiddenChip: ({ count }) => `${count} ruled out`,
    // The "closest here" frame (docs/results-page-states.md): the local cars
    // miss something the buyer asked for, so no headline may crown one. First
    // paint must be true whether or not the nearby tier later finds the real
    // thing — this claims nothing beyond this retailer's stock.
    closestTitle: ({ retailer }) => `The closest matches at ${retailer}.`,
    closestLede: () => 'Nothing here ticks every box you gave us. Each card says what it '
      + 'gets right, and what it doesn’t.',
    closestSettled: ({ model }) => `Your closest match here is the ${model}.`,
    closestSettledHere: ({ model, retailer }) => `Your closest match at ${retailer} is the ${model}.`,
    // The rescue note: the want is missing HERE but met nearby — by owner
    // decision (2026-07-22) the local cards keep the lead and this note
    // carries the fact, so the buyer weighs proximity against fit themselves.
    // The rescue note points at the list, not at a section: nearby cars are
    // IN the list now, wherever their score puts them.
    rescueNote: ({ list, retailer, miles, where }) => `No ${list} at ${retailer} right now. `
      + `The nearest is ${miles} away at ${where}, and it’s in the list below.`,
    // Only `empty` survives: state 5, where the retailer had nothing and the
    // nearby cars are the results rather than a band beneath them.
    driveLede: {
      empty: ({ retailer }) => `Nothing at ${retailer} fits those answers, so these are the `
        + 'closest matches at other retailers instead.',
    },
    /*
     * The two group labels. They describe PLACE and nothing else.
     *
     * That is the whole rule the old banded page broke: "Close, but not level
     * with the cars above" and "two of these fit you equally well" were both
     * quality claims on the same scale, made by different sections, so one
     * could contradict the other. "At Grassicks Garage" asserts nothing about
     * fit, so it cannot contradict a higher score in the group below it. Same
     * reason the old "NEXT BEST" heading had to go: it ranked.
     */
    hereHeading: ({ retailer }) => `AT ${retailer.toUpperCase()}`,
    awayHeading: 'AT OTHER RETAILERS',
    rejectHint: 'Turned down? We’ll bring the next one up.',
    // The other half of a scoped headline: which car beat the one here, and
    // where it is. Shown exactly when the headline scopes, so the two read as
    // one statement rather than repeating each other.
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
    refineStatus: ({ shown, total, wants }) => `${shown} of ${total} left, with ${wants}.`,
    refineStatusPlain: ({ shown, total }) => `${shown} of ${total} left.`,
    refineEmpty: ({ wants }) => `Ah. Nothing here has ${wants} all at once. `
      + 'Let one of them go and we’ll show you what’s left.',
    refineEmptyHidden: 'Well, that’s the lot ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'That’s the lot, then.',
    rejectOpen: 'Not this one',
    rejectPrompt: 'Go on then, what’s wrong with it?',
    rejectJust: 'Just not feeling it',
    pickLabel: 'Which one, then?',
    briefLabel: 'So, what I know so far',
    hiddenChip: ({ count }) => `${count} ruled out`,
    // The "closest here" frame, MINI register: honest shrug, no apology.
    closestTitle: ({ retailer }) => `The closest we’ve got at ${retailer}.`,
    closestLede: () => 'None of these is the whole wish list, but they’re close. '
      + 'And each one owns up to what’s missing.',
    closestSettled: ({ model }) => `Closest to your brief: the ${model}.`,
    closestSettledHere: ({ model, retailer }) => `Closest to your brief at ${retailer}: `
      + `the ${model}.`,
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
    searchedWider: ({ model, miles, where }) => 'We had a look further afield, too. '
      + `The ${model} at ${where} comes out ahead, and it’s ${miles}.`,
  },
};

/*
 * How an unmet want is named in the results note, per brand — plural noun
 * phrases that drop into "No ___ at <retailer>…". Per-brand because MINI
 * names its own shapes (a Countryman, not an SUV) and calls its EVs
 * all-electric, exactly as the quiz options do. Keyed by question id then
 * answer value; an unrecognised value (an old shared link) falls back to the
 * raw value rather than dropping the warning.
 */
const UNMET_PHRASES = {
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
};

/*
 * How the hero card owns a want it doesn't meet — "Petrol, where you asked
 * for all-electric." Singular phrases (UNMET_PHRASES above are plurals for
 * the pool-level note), same per-brand vocabulary rules: MINI names its own
 * shapes and calls its EVs all-electric. `label` is the section eyebrow that
 * mirrors "Why it suits you"; the CSS uppercases it, so it's authored plain.
 */
const TRADE_COPY = {
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
    // The `got` side describes the car itself, not a quiz option — and MINI's
    // suv bucket holds the Aceman as well as the Countryman, so naming the
    // Countryman there would mislabel an Aceman on its own card. The want
    // side stays "a Countryman": that's the word the quiz option used.
    got: { bodyStyles: { suv: 'a crossover' } },
  },
};

/** "a", "a or b", "a, b or c" — the natural spoken list. */
function orList(items) {
  if (items.length < 2) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** The same, for things that hold at once: "a and b", "a, b and c". Applied
 * refinements are ANDed, and "with a pano roof or grey" would describe a
 * different, looser search than the one actually run. */
function andList(items) {
  if (items.length < 2) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/*
 * The hero card's trade-off line(s): one short declarative per missed want,
 * in the engine's fuel-then-shape order — "Petrol, where you asked for fully
 * electric. A saloon, where you asked for an estate." Both brands share the
 * sentence shape (short, factual, full stop — the shared signature); the
 * vocabulary and the eyebrow above carry the brand difference. An
 * unrecognised value (an old shared link) falls back to the raw value rather
 * than dropping the admission.
 */
function tradeLines(brandKey, trades) {
  const vocab = TRADE_COPY[brandKey] || TRADE_COPY.bmw;
  return trades.map(({ dim, wants, got }) => {
    const gotPhrase = vocab.got?.[dim]?.[got] || vocab[dim]?.[got] || got;
    const wantList = orList(wants.map((w) => vocab[dim]?.[w] || w));
    const line = `${gotPhrase}, where you asked for ${wantList}.`;
    return line.charAt(0).toUpperCase() + line.slice(1);
  });
}

/**
 * The wants BOTH halves of the reachable pool agree they can't meet.
 *
 * The retailer's stock and the nearby tier are fetched independently, and a
 * car one street over still counts as reachable — so a want is only truly
 * unavailable when the retailer AND nearby both came back without it. A
 * `nearbyUnmet` of null means nearby never answered (failed or still cold):
 * that's an absence of facts, so we claim nothing at all.
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
 * The buyer's original brief, in short phrases, taken from the questions they
 * actually answered. Only the defining three — fuel, shape, budget — because
 * this is a reminder of what they said, not a transcript of it.
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
 * How far apart two scores may be and still count as a tie. Mirrors the
 * engine's CLUSTER_PTS: the page re-derives which result state it is in after
 * every narrowing, so it needs the same threshold the server used.
 */
const CLUSTER_PTS = 3;

/** Cars beyond a group's lead, shown as compact tiles under the same heading. */
const TAIL_SHOWN = 6;

/** Cap on cards given the full lead treatment. Mirrors the engine's own. */
const MAX_SHOWN = 6;

/**
 * A car with no `distance` came from the configured retailer's own feed; the
 * national search sets one on everything it returns. That single fact is what
 * splits the list into its two groups.
 */
const isHere = (m) => m.car.distance == null;

/**
 * The results list, plus every means of arguing with it.
 *
 * ONE ranked list, GROUPED BY PLACE. Both halves of that matter.
 *
 * One list, because the page used to be three — the retailer's matches, a
 * quieter "More at <retailer>" band, and a "Worth the drive" carousel — each
 * ranked internally and captioned honestly on its own terms. Stacked
 * vertically they read as one list that isn't sorted: Priya's page ran 96, 95
 * → 78 → 99, 97, so it claimed two cars fit best and then showed a 99% one
 * scroll down. Nobody reads three lists. See docs/results-page-review.md.
 *
 * Grouped by place, because this block is authored onto ONE retailer's site. A
 * tool on Sytner's page whose answer is "go to Group 1 Bedford" is answering a
 * different question than the page implies. So the groups are the retailer's
 * cars and then everyone else's, sorted by score inside each, and the headline
 * is derived from the retailer's cars because that is what it is scoped to.
 *
 * The governing rule, and the reason this isn't a rebuild of the bands it
 * replaced: GROUPS MAY DESCRIBE PLACE. THEY MAY NEVER CLAIM QUALITY. The old
 * page broke because "Close, but not level with the cars above" and "two of
 * these fit you equally well" were both quality claims on the same scale made
 * by different sections, so one could contradict the other. "At Grassicks
 * Garage" and "At other retailers" assert nothing about fit, so a 99% in the
 * second group contradicts nothing in the first.
 *
 * Every card still says where it is (see matchCard's provenance line). The
 * group heading is a signpost, not the only place that fact lives.
 *
 * Nearby stock arrives late (a slow national search) and joins the same pool
 * through `addToPool`, which is why the pool is mutable and the headline is
 * derived rather than fixed.
 *
 * The headline is re-derived on every redraw from the scores actually on
 * screen, never from the card count. That fixes a class of lie rather than one
 * instance: "TWO OF THESE FIT YOU EQUALLY WELL" was rendered over a 96% and a
 * 73% because narrowing back-filled the set to keep its size and nothing
 * re-tested the claim. Back-filling is right; not re-checking was not.
 *
 * Two rules the plan insists on, both still here: an applied refinement is
 * always shown and always revocable (a chip you can't see is a filter you
 * can't argue with), and narrowing to nothing is a legitimate outcome that
 * must be explained rather than rendered as an empty grid.
 *
 * @param {HTMLElement} title the results headline, rewritten on every redraw
 * @param {HTMLElement} lede the framing line, dropped once one car remains
 * @param {Object} frames how each situation may be described (docs/
 *   results-page-states.md), keyed by state. Chosen per redraw, because
 *   narrowing can move the page from one state to another.
 * @returns {{ host: HTMLElement, addToPool: (matches) => void }}
 */
function renderRefine(ctx, initialPool, title, lede, frames, tasteLead = false) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  // Mutable: nearby stock joins after first paint. Always kept in score order
  // so "the list" and "ranked by fit" mean the same thing.
  /*
   * Score first, then the configured retailer ahead of a distant one.
   *
   * The tie-break matters more than it looks. Merging nearby stock into the
   * list means local and distant cars can land on identical scores, and
   * without a rule the order is whatever the arrays happened to be in. Owner
   * decision (2026-07-22) stands: proximity is the buyer's trade to make, so
   * when two cars fit equally well the one they can walk to leads. A nearby
   * car that genuinely scores HIGHER still leads — that is the whole point of
   * merging the list — it just has to earn it rather than win a coin toss.
   */
  const rank = (a, b) => b.score - a.score
    || (a.car.distance == null ? 0 : 1) - (b.car.distance == null ? 0 : 1)
    || (a.car.distance ?? 0) - (b.car.distance ?? 0);
  let pool = [...initialPool].sort(rank);
  /*
   * The taste lead is a server judgement about one specific car: "of the cars
   * that fit you equally well, this is the one your priorities point at". It
   * therefore only stands while that car is still the one leading. Narrow it
   * away, reject it, or let a nearby car outrank it, and the claim is about a
   * car that is no longer being recommended.
   */
  const tasteLeader = tasteLead ? pool[0]?.car.id : null;
  const tasteLed = (alive) => Boolean(tasteLeader) && alive[0]?.car.id === tasteLeader;
  const axes = refinementAxes(pool.slice(0, MAX_SHOWN).map(listingsOf));
  const active = new Map(); // axis id -> axis

  // Everything narrowing the set, positive or negative, in one place: a
  // required feature and a rejected colour differ only in what they keep. Both
  // render as removable chips, because a filter the user can't see is one they
  // can't argue with — and at this stock depth two constraints can empty a
  // tie, which must be explainable rather than mysterious.
  const constraints = new Map(); // id -> { label, test(listing) }
  const hidden = new Set(); // cars waved away with no reason given

  const host = el('div', 'bmwm-refine');
  const chipRow = el('div', 'bmwm-chips');
  /*
   * The running brief: what the buyer said at the start, plus everything
   * they've told us since by tapping a chip or turning a car down. It grows as
   * they go, so the tool visibly holds a model of them rather than silently
   * re-filtering. This replaced a flat "2 of 6 left, with X and Y" line —
   * accurate, but it read as a filter count rather than as listening.
   */
  const status = el('div', 'bmwm-brief');

  /*
   * The two groups: the retailer's own cars, then everyone else's. Each is one
   * section with one PLACE heading, its lead cars at full size and the rest as
   * tiles, in score order throughout. A group that ends up with no cars is
   * never mounted, so an empty heading can't appear.
   */
  const grid = el('div', 'bmwm-grid bmwm-grid-tied');
  const hereGroup = el('section', 'bmwm-group');
  const hereLabel = el('h3', 'bmwm-subhead bmwm-group-label', '');
  const hereRestGrid = el('div', 'bmwm-tail-grid');
  const awayGroup = el('section', 'bmwm-group');
  const awayLabel = el('h3', 'bmwm-subhead bmwm-group-label', copy.awayHeading);
  const awayGrid = el('div', 'bmwm-grid bmwm-grid-tied');
  const awayRestGrid = el('div', 'bmwm-tail-grid');

  /*
   * Two things were moved below the cards together in the rebuild, and only
   * one of them belonged there.
   *
   * The chips are a CONTROL, so they sit directly above what they control. Put
   * below the fold they became, in the owner's words, "a bit confusing to use
   * and it's unclear what clicking them affects" — you cannot see the thing
   * being narrowed while you narrow it. The brief is a SUMMARY, and summaries
   * belong after. So the chips came back up and the brief stayed down.
   *
   * Deliberately NOT sticky: that was considered and rejected, because it
   * fights the EDS host page's own header.
   */
  const refineBlock = el('div', 'bmwm-refine-tools');
  const briefBlock = el('div', 'bmwm-brief-block');
  /*
   * The other half of a scoped headline: the car elsewhere that beat the best
   * one here, named, with where it is.
   *
   * It used to fire once, only if late-arriving nearby stock changed the
   * leader. Now it is derived on every redraw from the same comparison that
   * decides whether the headline scopes, so the two always agree: scope the
   * headline and this says what forced it; leave the headline unqualified and
   * this is silent. Anything else would leave "at Grassicks Garage" hanging
   * with no explanation of what it was protecting the page from.
   */
  const notice = el('p', 'bmwm-notice');
  notice.hidden = true;
  // The car a rescue note above the cards already points at, when there is one.
  // Set by renderResults; see `noteShown` below for why it matters.
  let notedCarId = null;
  hereGroup.append(hereLabel, grid, hereRestGrid);
  awayGroup.append(awayLabel, awayGrid, awayRestGrid);
  host.append(notice, briefBlock, refineBlock, hereGroup, awayGroup);

  /*
   * Survivors of everything the buyer has said, drawn from the WHOLE pool so a
   * rejection promotes the next-best car instead of leaving a hole.
   *
   * Every filter is applied to LISTINGS, not to cards. That distinction is the
   * whole of this function and it matters: grouping made a card "a model the
   * retailer has four of", so judging it by whichever listing happened to rank
   * first is judging three cars by a fourth. "Not the Chili Red" on a card
   * that's also available in Midnight Black used to delete both — the colour
   * she'd have taken went with the one she turned down.
   *
   * So: narrow each card's listings, drop the card only when nothing is left,
   * and rebuild what the card claims (count, price range, colours) from what
   * actually survived.
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
   * outside this may ever be described as fitting equally well, whatever the
   * card count happens to be.
   */
  const leadOf = (list) => {
    const top = list[0].score;
    return list.filter((m) => top - m.score <= CLUSTER_PTS).slice(0, MAX_SHOWN);
  };

  /**
   * The lead the page would show for a list, i.e. leadOf applied to the
   * retailer's own cars within it. Shared by `situation` and by the refine
   * status line, which measures the same thing with nothing narrowed so its
   * "1 of 2" is a real before-and-after rather than two different counts.
   */
  const leadHere = (list) => {
    const local = list.filter(isHere);
    return leadOf(local.length ? local : list);
  };

  /*
   * Which result state the page is in, RIGHT NOW, from the scores on screen.
   *
   * Previously this was decided once by the server and then never revisited,
   * while the card count was allowed to drift under narrowing. That is how a
   * 96% and a 73% ended up under "two of these fit you equally well", and how
   * a diesel carrying "Diesel, where you asked for fully electric" got
   * promoted into a set defined as fitting equally well.
   *
   * Deriving it each time means every state transition the buyer can cause is
   * handled by construction: narrow a tie to one car and it becomes a decree;
   * reject the leader and whatever it promotes is re-judged on its own merits;
   * a nearby car joining the pool can win outright and the page says so.
   *
   * It is derived from the RETAILER'S cars, because the headline is scoped to
   * the retailer. That is also what brought the decree back: merging nearby
   * stock into one cluster meant an equally-good car 17 miles away joined every
   * lead, and every persona landed on a tie (docs/results-page-review.md, "the
   * cost"). Cars elsewhere no longer dilute a verdict about here.
   *
   * `scoped` is the one thing a car elsewhere still decides: when one genuinely
   * outranks the best here, the headline says "at <retailer>" and the notice
   * names what beat it. Strictly outranks, not ties — ties already break
   * local-first, so an equal car has not earned the qualification.
   */
  function situation() {
    const alive = surviving();
    if (!alive.length) {
      return { alive, here: [], away: [], lead: [], state: 'empty', scoped: false };
    }
    const here = alive.filter(isHere);
    const away = alive.filter((m) => !isHere(m));
    // Ruling out every one of the retailer's cars leaves nothing to be scoped
    // to, so the cars within reach become the answer and the page says so
    // without a qualification it can no longer support.
    const from = here.length ? here : away;
    const cluster = leadOf(from);
    const scoped = here.length > 0 && away.length > 0 && away[0].score > here[0].score;
    const common = { alive, here, away, scoped };
    // The leader misses something asked for: the page must not say "perfect"
    // in any state, so this outranks the rest.
    if ((from[0].tradeOffs || []).length) return { ...common, lead: cluster, state: 'closest' };
    if (cluster.length === 1) return { ...common, lead: cluster, state: 'decree' };
    // Fit-tied. Their priorities may still pick one (the taste lead is a
    // server judgement about the original cluster, so it only stands while
    // that cluster's leader is still the leader).
    return { ...common, lead: cluster, state: tasteLed(from) ? 'taste' : 'tie' };
  }

  /*
   * What this car could be rejected FOR, given what's still on screen.
   *
   * Attribution is the whole point of asking. A rejection on its own says
   * nothing usable — reject a white 3-door with 40k miles and we don't know
   * which of those three things you objected to, and guessing is how you learn
   * a dealbreaker that isn't real and empty someone's shortlist. So each
   * reason names one property and rules out exactly that.
   *
   * A reason is only offered when it would change something: "too expensive"
   * needs a cheaper car to fall back to, "not the colour" needs another colour
   * in the set. Anything else is a dead end dressed as a choice. "Just not
   * this one" is always last and always available — a shrug is a legitimate
   * answer, and forcing a reason produces invented ones, which are worse than
   * no signal at all.
   */
  function rejectOptions(match, chosen) {
    const { car } = match;
    // What the card is showing right now. Colour and gearbox are properties of
    // ONE car, so a reason about them has to come from the listing on screen,
    // not from whichever one happened to represent the group. Price and
    // mileage stay group-based below, deliberately.
    const shown = chosen || listingsOf(match)[0] || {};
    // Judge "would this reason change anything?" against every listing still
    // reachable — not just the cards on screen, and not just other cards.
    // Siblings count: on a two-colour card, turning down the red is answered
    // by the black one standing behind it, and the card stays.
    const alive = surviving().flatMap(listingsOf);
    const survives = (test) => alive.some(test);
    const opts = [];
    const add = (id, label, test) => opts.push({
      label,
      apply: () => { constraints.set(id, { label, test }); redraw(); },
    });

    /*
     * EVERY reason is about the listing on screen, price and mileage included.
     *
     * They used to be judged against the group's cheapest and lowest-mileage
     * copy, on the theory that a reason should make the whole card disappear
     * rather than let it survive on a copy the buyer had just ruled out. That
     * was wrong twice over. A card surviving with a CHEAPER listing is exactly
     * what was asked for, which is what the colour reason already does. And
     * the arithmetic was worse than the theory: on a card holding 1,000,
     * 2,000 and 3,000-mile copies the only option ever offered was "Fewer than
     * 1,000 miles", which excluded all three including the one being looked
     * at. So a card could offer "Not the green", correctly leaving the blue,
     * beside a mileage reason that could only ever leave nothing.
     *
     * Direction needs no thought here: nobody turns a car down for being too
     * cheap or having too few miles, so "than the one I'm looking at" is the
     * only sensible reading of both.
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

    // Chips: every axis that still splits what's on screen, plus the ones
    // already applied (which by definition no longer split anything). Offering
    // an axis that can't change the result is noise, so they're recomputed
    // against the current set rather than the original one.
    refineBlock.replaceChildren();
    chipRow.replaceChildren();

    /*
     * Everything the buyer has told us since the quiz, as statements rather
     * than as controls. It renders in the brief below; the chip row carries
     * only what they could ADD next.
     *
     * The two were briefly both: applied filters showed as "+ Blue" here and
     * as a removable [Blue ✕] chip an inch away, which is one constraint in
     * two places with only one of them undoable. Collapsing them into the
     * chip row was the obvious fix and the wrong one, because a chip and a
     * sentence are not the same register. "+ Blue, − Not the red" reads as a
     * model of a person; a row of pills reads as a filter bar, and the model
     * is the thing this tool has that a stock search does not. The +/- mark
     * carries meaning the pills flatten, too: a want and a rule are different
     * kinds of statement.
     *
     * So the statements keep the state, and they keep the undo with it.
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

    const live = refinementAxes(shown.map(listingsOf)).map((a) => a.id);
    for (const axis of axes) {
      if (active.has(axis.id) || !live.includes(axis.id)) continue;
      const chip = el('button', 'bmwm-chip', axis.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => { active.set(axis.id, axis); redraw(); });
      chipRow.append(chip);
    }

    // Mounted only when there is something to offer. A cluster of
    // identical-spec cars in identical paint has no axes, and the page simply
    // shows the cars and stops.
    if (chipRow.children.length) {
      refineBlock.append(
        el('p', 'bmwm-refine-label', copy.refineLabel({ count: shown.length })),
        chipRow,
      );
    }

    // The headline says whatever is true of the cars now on screen. `state`
    // already accounts for narrowing, rejection and late-arriving nearby
    // stock, so there is nothing to special-case here beyond the empty set.
    //
    // `scoped` picks the "at <retailer>" wording where a frame has one. A frame
    // without one is already scoped in its own copy (the closest frame names
    // the retailer outright), so it needs no variant.
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

    // Names what forced the scope. Suppressed only when a rescue note above the
    // cards is already pointing at THAT car: Martin's page would otherwise say
    // "no convertibles here, the nearest is 18.1 miles away at John Clark
    // Tayside" and then, two lines down, "the 420i Convertible at John Clark
    // Tayside scores higher". Two notes about different cars are two facts, and
    // both keep their line.
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
     * The running brief, ABOVE the cars.
     *
     * It was moved below on the argument that a summary belongs after the
     * thing it summarises. True of a summary; false of this. Nobody scrolls
     * past fourteen cards to read what they themselves typed, so the one
     * signal that says the tool holds a model of you was the one thing
     * guaranteed not to be seen.
     *
     * What it does NOT carry any more is the list of applied filters. Those
     * were being said twice: once here as "+ Blue", and once as a removable
     * [Blue ✕] chip a couple of inches above. The chip is the better of the
     * two because you can undo it, so the duplicate is gone and the brief is
     * back to the thing only it says, which is what the buyer originally
     * asked for.
     */
    briefBlock.replaceChildren();
    status.replaceChildren();
    const said = briefFromAnswers(ctx);
    if (said.length || learned.length) {
      briefBlock.append(status);
      status.append(el('p', 'bmwm-brief-label', copy.briefLabel));
      if (said.length) status.append(el('p', 'bmwm-brief-said', said.join('  ·  ')));

      // Then everything since, each with the means to take it back. The undo
      // lives here because this is now the only place the constraint is
      // stated, and a filter you can see but not clear is worse than one you
      // cannot see at all.
      learned.forEach((item) => {
        const row = el('p', `bmwm-brief-item is-${item.kind}`);
        row.append(el('span', 'bmwm-brief-mark', item.kind === 'want' ? '+' : '−'));
        row.append(el('span', 'bmwm-brief-text', item.text));
        const undo = el('button', 'bmwm-brief-undo', '✕');
        undo.type = 'button';
        undo.setAttribute('aria-label', `Remove ${item.text}`);
        undo.addEventListener('click', () => { item.undo(); redraw(); });
        row.append(undo);
        status.append(row);
      });

      /*
       * One count, and it lives here rather than under the chips.
       *
       * There were briefly two, two lines apart: "3 of 13 still match" (the
       * whole pool) over "1 of 2, with blue." (the lead). Both accurate,
       * measuring different things, leaving the reader to work that out. This
       * one wins because it belongs to the same panel as the statements that
       * caused it: `total` is the lead measured with nothing applied, so
       * "1 of 2" is a real before-and-after rather than a number floating free
       * of a baseline. Only the positive wants are named, because "with not
       * the red" is not a sentence and a rejection has already shown its work
       * by removing a card.
       */
      if (learned.length) {
        const picked = [...active.values()].map((a) => a.label.toLowerCase());
        const args = { shown: shown.length, total: leadHere(pool).length };
        const line = el('p', 'bmwm-brief-count', picked.length
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
      // A guard, not a path the chips can currently reach: an axis is only
      // offered while it still splits what's on screen, so applying one always
      // leaves at least one car, and a combination that would empty the set is
      // never presented. That's deliberate — the axes describe THIS cluster,
      // so "nothing has both" would read as a claim about the retailer's whole
      // stock, which we haven't checked. Rejection (the next step) can empty a
      // set for real, and this is what it will land on.
      const dead = el('div', 'bmwm-refine-empty');
      dead.append(el('p', 'bmwm-refine-empty-text', wants.length
        ? copy.refineEmpty({ wants: andList(wants) })
        : copy.refineEmptyHidden));
      const clear = el('button', 'bmwm-btn bmwm-btn-ghost', 'Start again');
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
     * Who leads the page. Normally the retailer, which is the whole point of
     * scoping the headline to it; only when every one of its cars has been
     * ruled out does the answer come from the group beyond.
     */
    const leadIsHere = here.length > 0;
    /*
     * Full cards in the second group are reserved for cars that OUTRANK the
     * best one here, i.e. exactly the set that makes the headline scope. That
     * keeps the promise the merge was built on: a car that genuinely suits the
     * buyer better is a real card they can reject, refine and read the
     * trade-off line on, not a tile they have to notice. Everything else in
     * that group is a tile, because it is context rather than the answer.
     *
     * `leadOf` again, rather than a flat cap, so the cut lands on a real score
     * gap. A flat three left Priya's group as 99, 97, 97 in cards and a fourth
     * 97 as a tile below them, which is a difference in treatment where there
     * is no difference in score.
     *
     * It is a treatment, not a caption. No heading anywhere says one group
     * beats the other.
     */
    const beats = leadIsHere ? away.filter((m) => m.score > here[0].score) : away;
    const awayLead = beats.length ? leadOf(beats) : [];
    const hereLead = leadIsHere ? shown : [];
    const drop = (list, taken) => list.slice(taken.length, taken.length + TAIL_SHOWN);

    // One car left is a recommendation again, so it gets the hero treatment
    // (photo, reasons, its trade-off) rather than staying a tile in a grid.
    // It keeps its reject menu: the answer still has to survive being looked
    // at, and "actually, not that one either" is a real thing to want to say.
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
    grid.classList.toggle('bmwm-grid-tied', !(leadIsHere && single));
    awayGrid.classList.toggle('bmwm-grid-tied', !(!leadIsHere && single));

    hereLead.forEach((m) => grid.append(full(m, single)));
    drop(here, hereLead).forEach((m) => hereRestGrid.append(tile(m)));
    hereLabel.textContent = copy.hereHeading({ retailer: ctx.retailerLabel });
    hereLabel.hidden = !here.length;
    hereGroup.hidden = !here.length;

    awayLead.forEach((m) => awayGrid.append(full(m, leadIsHere ? false : single)));
    drop(away, awayLead).forEach((m) => awayRestGrid.append(tile(m)));
    awayGroup.hidden = !away.length;
  }

  redraw();

  return {
    host,
    /*
     * Nearby stock, arriving after first paint from the slow national search.
     * It joins the SAME pool and is re-sorted with everything else, so a car
     * 23 miles away that genuinely suits the buyer better than anything local
     * is presented as the better answer rather than as a footnote below a
     * headline claiming otherwise. Each card carries where it is (see
     * matchCard's provenance line), which is what makes that honest rather
     * than merely tidy.
     */
    addToPool(extra) {
      if (!extra?.length) return;
      const known = new Set(pool.map((m) => m.car.id));
      const fresh = extra.filter((m) => !known.has(m.car.id));
      if (!fresh.length) return;
      pool = [...pool, ...fresh].sort(rank);
      // The notice and the headline's scope are both derived inside redraw
      // from the same comparison, so there is nothing to announce here.
      redraw();
    },
    /*
     * Told by renderResults which car the rescue note it just inserted points
     * at (null for the unmet note, which names no car). The notice stands down
     * for that car only: the note is the more specific version of the same
     * fact, and saying it twice in different words reads as a bug.
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
 * A brand-voiced note admitting that something the user asked for isn't in
 * the stock we searched, and framing what's shown as the closest fit. Returns
 * null when there's nothing to admit to — which is the common case.
 */
function unmetNote(ctx, unmet) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const items = unmetPhrases(ctx.brand, unmet);
  if (!items.length) return null;

  const note = el('aside', 'bmwm-unmet');
  note.setAttribute('role', 'note');
  if (copy.unmetLabel) note.append(el('p', 'bmwm-unmet-label', copy.unmetLabel));
  note.append(el('p', 'bmwm-unmet-text', copy.unmet({
    list: orList(items), retailer: ctx.retailerLabel,
  })));
  return note;
}

/**
 * The state-3 note (docs/results-page-states.md): the want is missing at THIS
 * retailer but met nearby. The sibling of unmetNote with the opposite message
 * — that one says "nobody reachable has it" (and almost never fires), this
 * one says "not here, but N miles away" (and fires constantly). Same visual
 * treatment: they are two polarities of one fact and can never both show.
 *
 * By owner decision the local cards keep the lead — someone may value
 * proximity over the full brief, and that trade is theirs to make. This note
 * is what puts the choice in front of them.
 *
 * @param {Object} rescued unmet-shaped: the wants missing here but met nearby
 * @param {Object} nearest the closest nearby match that meets the whole brief
 */
function rescueNote(ctx, rescued, nearest) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const items = unmetPhrases(ctx.brand, rescued);
  if (!items.length) return null;

  const note = el('aside', 'bmwm-unmet');
  note.setAttribute('role', 'note');
  if (copy.rescueLabel) note.append(el('p', 'bmwm-unmet-label', copy.rescueLabel));
  note.append(el('p', 'bmwm-unmet-text', copy.rescueNote({
    list: orList(items),
    retailer: ctx.retailerLabel,
    miles: `${Math.round(nearest.car.distance * 10) / 10} miles`,
    where: nearest.car.retailerName || 'a nearby retailer',
  })));
  return note;
}

/**
 * The question set for a brand. Server-owned, so the intro copy can state the
 * real question count without the block hardcoding it. (The API also sends
 * `topMatches`; the block stopped reading it when results went cluster-aware —
 * how many cars appear now depends on whether the engine could pick a winner,
 * so the intro no longer promises a number.)
 */
async function apiGetQuestions(base, retailer, brandKey) {
  const url = new URL(`${base}/api/questions`);
  if (retailer) url.searchParams.set('retailer', retailer);
  if (brandKey) url.searchParams.set('brand', brandKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Questions request failed (${res.status})`);
  const data = await res.json();
  return { questions: data.questions };
}

async function apiMatch(base, answers, retailer, brandKey) {
  const res = await fetch(`${base}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, retailer, brand: brandKey }),
  });
  if (!res.ok) throw new Error(`Match request failed (${res.status})`);
  return res.json();
}

/**
 * Cars at other nearby retailers — a separate, slower request than /api/match
 * (a national distance-sorted search) so the hero matches can render first.
 * The section is a bonus, so any failure resolves to an empty list rather than
 * throwing: the caller just omits the "Worth the drive" section.
 *
 * Returns `{ nearby, unmet }`. `unmet` is the wants this pool had nothing
 * behind (see the unmet note below) and is `null` whenever we didn't get a
 * usable answer — a failed lookup, or an older API that doesn't send the
 * field. An empty list of cars is a finding; a failed lookup is not, and the
 * two must not be confused before telling a user something doesn't exist.
 */
async function apiNearby(base, answers, retailer, brandKey) {
  const noAnswer = { nearby: [], unmet: null };
  try {
    const res = await fetch(`${base}/api/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, retailer, brand: brandKey }),
    });
    if (!res.ok) return noAnswer;
    const data = await res.json();
    return {
      nearby: Array.isArray(data.nearby) ? data.nearby : [],
      unmet: (data.unmet && typeof data.unmet === 'object') ? data.unmet : null,
    };
  } catch {
    return noAnswer;
  }
}

/**
 * The configured retailer's current top matches for the quiz's live "best
 * guess" drawer — a wider slice than /api/match, refetched as answers change.
 * Like apiNearby it NEVER throws: a failed preview must never break the quiz,
 * so any error/non-ok resolves to an empty list and the drawer just keeps its
 * last state.
 */
async function apiPreview(base, answers, retailer, brandKey) {
  try {
    const res = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, retailer, brand: brandKey }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.matches) ? data.matches : [];
  } catch {
    return [];
  }
}

/** Is question `q` shown given the current answers? Uses SHOW_IF by id. */
function isVisible(q, answers) {
  if (!q.conditional) return true;
  const predicate = SHOW_IF[q.id];
  return predicate ? predicate(answers) : true;
}

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

function visibleQuestions(questions, answers) {
  return questions.filter((q) => isVisible(q, answers));
}

const gbp = (n) => `£${n.toLocaleString('en-GB')}`;

/**
 * Format a slider value for its readout, per the question's `format` hint:
 *   'gbp' → "£62,000", 'int' → "12,000" (with an optional `unit` suffix).
 * At the ceiling of a `plusAtMax` slider, append "+" ("£150,000+", "25,000+").
 */
function formatSliderValue(value, q) {
  const base = q.format === 'gbp' ? gbp(value) : `${value.toLocaleString('en-GB')}${q.unit || ''}`;
  return q.plusAtMax && value >= q.max ? `${base}+` : base;
}

/** Readout for a dual-thumb range slider, e.g. "£40,000 – £75,000". */
function formatRange([lo, hi], q) {
  return `${formatSliderValue(lo, q)} – ${formatSliderValue(hi, q)}`;
}

const SPEC_LABELS = {
  hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
  coupe: 'Coupé', convertible: 'Convertible', mpv: 'Family carrier',
};
const FUEL_SPEC = { petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric' };

/*
 * Representative hex per basic colour, for the little swatch beside the paint
 * name. Keyed by the feed's normalised `colour.colour` — a closed set of basic
 * names, which is what makes a hand-authored table viable. Deliberately NOT
 * the actual paint (the feed gives "Ocean Wave Green", not a hex): the swatch
 * says "this one's the green one" at a glance, the name and photo carry the
 * truth. An unknown name renders no swatch rather than a wrong one.
 */
const SWATCH_HEX = {
  black: '#1d1d1f',
  grey: '#8e9094',
  silver: '#c8cacc',
  white: '#f4f4f2',
  blue: '#33567d',
  red: '#a03236',
  green: '#4a6b58',
  orange: '#c47a3a',
  yellow: '#d9b13b',
  brown: '#6b543f',
  beige: '#cfc3a8',
  bronze: '#9c7a5b',
  gold: '#b3945c',
  purple: '#5d4a72',
};

/*
 * Human names for the equipment concepts the server parses out of the feed's
 * factory options list (mapping.js FEATURE_CONCEPTS). Display-only, so they
 * live here rather than on the wire — and only concepts a buyer would
 * recognise by name are listed: an unlabelled key is silently skipped, which
 * is how a concept can be parsed and measured long before it's offered as a
 * refinement.
 */
const CONCEPT_LABELS = {
  panoRoof: 'Panoramic roof',
  contrastRoof: 'Contrast roof',
  sunroof: 'Sunroof',
  heatedSeats: 'Heated seats',
  heatedWheel: 'Heated steering wheel',
  sportsSeats: 'Sports seats',
  electricSeats: 'Electric seats',
  leatherWheel: 'Leather steering wheel',
  parkingCamera: 'Parking camera',
  parkingSensors: 'Parking sensors',
  navigation: 'Navigation',
  smartphoneIntegration: 'Apple CarPlay',
  premiumAudio: 'Premium audio',
  headUpDisplay: 'Head-up display',
  cruiseControl: 'Cruise control',
  adaptiveLights: 'Adaptive LED lights',
  keylessEntry: 'Keyless entry',
  climateControl: 'Climate control',
  ambientLighting: 'Ambient lighting',
  tintedGlass: 'Privacy glass',
  towbar: 'Tow bar',
};

/*
 * What actually separates a set of cars the engine scored the same.
 *
 * This is the digital version of the bit of a dealership visit the tool has
 * been missing: once the brief is satisfied several times over, a good
 * salesperson stops asking about your life and starts asking about the cars in
 * front of you — and only about the ways they differ. Nobody is asked "do you
 * want a sunroof?" when all six have one.
 *
 * So the axes are computed from the cluster itself, never authored. An axis
 * exists only where it splits the set (at least one car has it, at least one
 * doesn't), which means a refinement can never be dead and can never empty the
 * list on its own — the two failure modes that killed asking this sort of
 * thing upfront (docs/question-stock-audit.md, and the plan's rejected
 * approaches). It also needs no per-brand configuration: gearbox surfaces for
 * a MINI cluster because MINI stock is mixed, and stays quiet for BMW because
 * it isn't.
 *
 * Ranked by how evenly each axis splits the set, because a 3/3 split is worth
 * more than a 5/1 — it's the question that tells us most about you per tap.
 *
 * @returns {Array<{ id, label, test(car), have }>}
 */
/**
 * The individual cars behind a card. The API sends this for every match, one
 * entry for an ungrouped car and N for a grouped one, so nothing downstream
 * has to care which it is holding.
 */
const listingsOf = (m) => m.listings || [];

/** A listing's normalised shade ("Blue"), falling back to its marketing name. */
const shadeOf = (l) => l.shade || l.colour;

/**
 * Rebuild a grouped card from the listings that survived filtering.
 *
 * Everything the card claims about stock depth — "4 available, £31,498 to
 * £36,890, in Portimao Blue, Brooklyn Grey or Alpine White" — is derived, so
 * once a filter removes two of those four the card must stop saying it has
 * them. The representative fields (paint, price, mileage, link) follow the
 * best-ranked survivor; `id` deliberately does not move, because it is what
 * "just not this one" remembers the card by.
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
 * The ways this set of cards can still be split, as chips.
 *
 * Takes one listing array per card, and tests LISTINGS rather than cards, for
 * the same reason the reject menu does: a card is a model the retailer has
 * several of, and "Blue" should leave the blue ones rather than keep or kill
 * all four on the strength of whichever ranked first.
 *
 * An axis earns its place when applying it would change something — some
 * listing has the thing and some listing doesn't. That's a weaker bar than
 * "it splits the cards", deliberately: on a single four-colour card, "Blue"
 * changes nothing about which cards show but everything about what the buyer
 * is being offered.
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

  // Colour, by its normalised name ("Grey"), each shade its own axis. Only
  // present on listings the detail lookup reached — one with no colour simply
  // never matches a colour axis, which is the honest behaviour: we can't
  // claim it's the blue one.
  for (const shade of new Set(all.map(shadeOf).filter(Boolean))) {
    offer(`c:${shade}`, shade, (l) => shadeOf(l) === shade);
  }

  // Best-balanced first: an axis that halves the set is worth more than one
  // that shaves a single car off it.
  const balance = (a) => Math.abs(a.have / groups.length - 0.5);
  axes.sort((a, b) => balance(a) - balance(b) || a.label.localeCompare(b.label));
  // Capped, because testing listings rather than cards removed the bound that
  // used to be implicit. An axis only qualified while it split the CARDS, so a
  // single card could never offer one; now that one card is several listings,
  // an equipment-rich cluster will happily produce eleven chips, and a wall of
  // chips is a filter panel, which is the thing this was built not to be.
  return axes.slice(0, MAX_AXES);
}

/* ------------------------------ screens ------------------------------ */

function renderIntro(root, ctx) {
  root.replaceChildren();
  const intro = el('div', 'bmwm-intro');
  // Count the questions a typical run sees ("Help me decide" shows the
  // conditional charging question, matching the longest common path). fuel is
  // multi-select now, so pass it as an array.
  const count = visibleQuestions(ctx.questions, { fuel: ['open'] }).length;
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  // Authored overrides win; a blank row suppresses the line entirely, which is
  // how the block sits under a host page's own "FIND YOUR MINI." heading
  // without repeating it (see copyRow).
  const { title: titleOverride, kicker: kickerOverride } = ctx.overrides;
  const kicker = kickerOverride === undefined ? 'The unofficial UK matchmaker' : kickerOverride;
  const title = titleOverride === undefined ? copy.title : titleOverride;
  if (kicker) intro.append(el('p', 'bmwm-kicker', kicker));
  if (title) intro.append(el('h1', 'bmwm-title', title));
  intro.append(el('p', 'bmwm-lede', copy.lede({
    questions: count, retailer: ctx.retailerLabel,
  })));
  const start = el('button', 'bmwm-btn bmwm-btn-primary', copy.cta);
  start.addEventListener('click', () => ctx.showQuestion(0));
  intro.append(start);
  root.append(intro);
}

/* -------------------------- live "best guess" preview ---------------------- */

// How long after an answer changes before the preview refetches. Multi-select
// rapid taps collapse into one call; a fresh answer resets the timer.
const PREVIEW_DEBOUNCE_MS = 250;
// Cross-fade duration when the tile row re-ranks (kept in sync with the CSS
// transition on .bmwm-preview-track). Disabled under prefers-reduced-motion.
const PREVIEW_FADE_MS = 150;

/** Can the engine score these answers yet? It hard-requires a valid budget. */
function canPreview(ctx) {
  return validBudget(ctx.answers.budget);
}

// How many skeleton tiles to show while the first guess loads. A handful is
// enough to fill the strip's width so it reads as "results loading here".
const PREVIEW_SKELETON_COUNT = 5;

/**
 * Build the live preview section: a heading + a horizontal strip of small
 * "mini" result tiles (see previewTile). Since budget is set from the first
 * render, the section mounts straight away — showing skeleton tiles until the
 * first guess lands (see paintPreview), so it never snaps open.
 */
function renderPreviewSection(ctx) {
  const section = el('section', 'bmwm-preview');
  section.append(el('h3', 'bmwm-subhead bmwm-nearby-heading bmwm-preview-heading', 'SHORTLISTING FOR YOU'));
  const track = el('div', 'bmwm-nearby bmwm-preview-track');
  track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', `Your closest matches so far at ${ctx.retailerLabel}`);
  section.append(track);
  paintPreview(section, ctx);
  return section;
}

/** A shimmer placeholder shaped like a mini preview tile (media + two lines). */
function previewSkeletonTile() {
  const tile = el('div', 'bmwm-ptile bmwm-ptile-mini bmwm-skel-ptile');
  tile.append(el('div', 'bmwm-skel bmwm-ptile-media'));
  const body = el('div', 'bmwm-ptile-body');
  body.append(
    el('div', 'bmwm-skel bmwm-skel-line bmwm-skel-name'),
    el('div', 'bmwm-skel bmwm-skel-line bmwm-skel-specs'),
  );
  tile.append(body);
  return tile;
}

/**
 * Refill the strip from ctx.preview.matches, with a soft cross-fade so a re-rank
 * reads as "this just updated" rather than a hard jump. Reduced-motion users get
 * an instant swap (the CSS transition is disabled). With no matches yet (budget
 * is set from the off, so this is the initial load), paint skeleton tiles so the
 * bar holds its footprint instead of popping in when the first guess arrives.
 */
function paintPreview(section, ctx) {
  const track = section.querySelector('.bmwm-preview-track');
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
  const showingReal = track.querySelector('.bmwm-ptile:not(.bmwm-skel-ptile)');
  if (showingReal && hasMatches) {
    track.classList.add('is-fading');
    setTimeout(swap, PREVIEW_FADE_MS);
  } else {
    swap();
  }
}

/**
 * Mount or update the preview for the current answers. The section lives at the
 * end of ctx.preview's host (`.bmwm-screen`): it mounts as soon as a budget is
 * set (skeleton tiles until the first guess lands), repaints on later updates,
 * and is only removed if we genuinely can't preview yet (no valid budget).
 */
function showPreview(ctx) {
  const screen = document.querySelector('.bmwm-screen');
  if (!screen) return;
  let section = screen.querySelector('.bmwm-preview');
  const { matches, loaded } = ctx.preview;
  // Hide the strip only when there's genuinely nothing to show: no budget to
  // score yet, or a guess has landed and returned zero matches. While a budget
  // is set but the first guess hasn't arrived (!loaded), we keep the strip up
  // with skeleton tiles (paintPreview) rather than removing it.
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
 * Debounced, latest-wins preview refresh. Refetches the retailer's top matches
 * for the current answers and mounts/updates the on-screen strip when it lands —
 * unless a newer schedule has superseded it (seq guard). A no-op until a budget
 * is chosen. Never surfaces an empty/loading state: the strip only appears once
 * there are real matches.
 */
function schedulePreviewRefresh(ctx) {
  if (!canPreview(ctx)) return;
  clearTimeout(ctx.previewTimer);
  ctx.previewTimer = setTimeout(() => {
    const seq = (ctx.preview.seq += 1);
    const answers = { ...ctx.answers };
    apiPreview(ctx.api, answers, ctx.retailer, ctx.brand).then((matches) => {
      // A newer answer already superseded this request — drop the stale result.
      if (seq !== ctx.preview.seq) return;
      ctx.preview.matches = matches;
      ctx.preview.loaded = true; // first (and every) response has now landed
      showPreview(ctx);
    });
  }, PREVIEW_DEBOUNCE_MS);
}

/**
 * A wrapping row of tap-to-edit summary pills — one per question answered
 * *before* the current one (the current question is what you're answering now,
 * so it's excluded). Tapping a pill jumps back to edit that answer and sets a
 * return point so advancing lands back on the question you left. Returns the
 * row element, or null when nothing's been answered yet.
 *
 * @param {number} index current question's position in the visible list
 */
function renderAnswerPills(ctx, questions, index) {
  const row = el('div', 'bmwm-pills');
  for (let i = 0; i < index; i += 1) {
    const question = questions[i];
    const label = pillFor(question, ctx.answers);
    if (!label) continue; // unanswered (shouldn't happen before `index`, but safe)
    const pill = el('button', 'bmwm-pill');
    pill.type = 'button';
    pill.append(el('span', 'bmwm-pill-text', label));
    pill.append(el('span', 'bmwm-pill-edit', '✎'));
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

/**
 * A dual-thumb range slider (budget): two native range inputs overlaid on one
 * track, writing a [min, max] pair to ctx.answers[q.id]. The thumbs can't cross
 * (kept at least one step apart). Appends readout + track + bounds to `list`.
 */
function renderRangeSlider(list, q, ctx) {
  const stored = ctx.answers[q.id];
  const start = Array.isArray(stored) && stored.length === 2
    ? [Number(stored[0]), Number(stored[1])]
    : (Array.isArray(q.default) ? [...q.default] : [q.min, q.max]);
  let [lo, hi] = [Math.min(...start), Math.max(...start)];
  // Persist immediately so Next is enabled even without a drag.
  ctx.answers[q.id] = [lo, hi];

  const readout = el('output', 'bmwm-slider-value', formatRange([lo, hi], q));

  const track = el('div', 'bmwm-range');
  const fill = el('div', 'bmwm-range-fill');
  const mkInput = (cls, label, value) => {
    const input = el('input', `bmwm-slider-input ${cls}`);
    input.type = 'range';
    input.min = String(q.min);
    input.max = String(q.max);
    input.step = String(q.step);
    input.value = String(value);
    input.setAttribute('aria-label', label);
    input.setAttribute('aria-valuetext', formatSliderValue(value, q));
    return input;
  };
  const minInput = mkInput('bmwm-range-min', 'Minimum budget', lo);
  const maxInput = mkInput('bmwm-range-max', 'Maximum budget', hi);

  const span = q.max - q.min || 1;
  const paintFill = () => {
    const a = ((lo - q.min) / span) * 100;
    const b = ((hi - q.min) / span) * 100;
    fill.style.left = `${a}%`;
    fill.style.right = `${100 - b}%`;
  };
  const sync = () => {
    // Clamp so the thumbs never cross (keep a one-step gap).
    lo = Math.min(Number(minInput.value), hi - q.step);
    hi = Math.max(Number(maxInput.value), lo + q.step);
    lo = Math.max(q.min, lo);
    hi = Math.min(q.max, hi);
    minInput.value = String(lo);
    maxInput.value = String(hi);
    ctx.answers[q.id] = [lo, hi];
    const text = formatRange([lo, hi], q);
    readout.textContent = text;
    minInput.setAttribute('aria-valuetext', formatSliderValue(lo, q));
    maxInput.setAttribute('aria-valuetext', formatSliderValue(hi, q));
    paintFill();
    schedulePreviewRefresh(ctx);
  };
  minInput.addEventListener('input', sync);
  maxInput.addEventListener('input', sync);

  paintFill();
  track.append(fill, minInput, maxInput);

  const bounds = el('div', 'bmwm-slider-bounds');
  bounds.append(
    el('span', 'bmwm-slider-min', formatSliderValue(q.min, q)),
    el('span', 'bmwm-slider-max', formatSliderValue(q.max, q)),
  );

  list.append(readout, track, bounds);
}

function renderQuestion(root, ctx, index) {
  const questions = visibleQuestions(ctx.questions, ctx.answers);
  const q = questions[index];
  const selected = new Set(
    q.multi ? (ctx.answers[q.id] || []) : (ctx.answers[q.id] != null ? [ctx.answers[q.id]] : []),
  );

  root.replaceChildren();
  const screen = el('div', 'bmwm-screen');

  const progress = el('div', 'bmwm-progress');
  const bar = el('div', 'bmwm-progress-bar');
  bar.style.width = `${((index + 1) / questions.length) * 100}%`;
  progress.append(bar);
  screen.append(progress, el('p', 'bmwm-step', `Question ${index + 1} of ${questions.length}`));

  // Summary pills for every question already answered before this one. Each is
  // a tap-to-edit button: it jumps back to that question, remembering the
  // current index so advancing returns straight here (see advance / jumpToEdit).
  const answeredPills = renderAnswerPills(ctx, questions, index);
  if (answeredPills) screen.append(answeredPills);

  screen.append(el('h2', 'bmwm-question', q.title));
  if (q.help) screen.append(el('p', 'bmwm-help', q.help));

  const list = el('div', 'bmwm-options');
  // A slider is a single labelled input (its own role), not a radio/checkbox
  // group — only set the group role for option lists.
  if (q.type !== 'slider') list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
  const optionButtons = [];

  const advance = () => {
    const total = visibleQuestions(ctx.questions, ctx.answers).length;
    // Editing a pill sets a return point: once this (earlier) question is
    // re-answered, jump straight back rather than walking forward again. Only
    // honour it when returning would actually move forward, and clamp to the
    // live visible range (editing fuel can add/remove the charging question).
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
  if (isSlider && q.range) {
    // Dual-thumb range (budget): two overlaid inputs writing a [min, max] pair.
    list.classList.add('bmwm-slider');
    renderRangeSlider(list, q, ctx);
  } else if (isSlider) {
    // A range input plus a live value readout. The whole thing writes a number
    // to ctx.answers[q.id] and, unlike a single-select, never auto-advances —
    // the Next button (below) is the commit point, since any drag would fire.
    list.classList.add('bmwm-slider');
    const stored = ctx.answers[q.id];
    const startValue = typeof stored === 'number'
      ? stored
      : (typeof q.default === 'number' ? q.default : q.min);

    const readout = el('output', 'bmwm-slider-value', formatSliderValue(startValue, q));
    const input = el('input', 'bmwm-slider-input');
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

    const bounds = el('div', 'bmwm-slider-bounds');
    bounds.append(
      el('span', 'bmwm-slider-min', formatSliderValue(q.min, q)),
      el('span', 'bmwm-slider-max', formatSliderValue(q.max, q)),
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
    q.options.forEach((opt) => {
      const btn = el('button', 'bmwm-option');
      btn.type = 'button';
      btn.setAttribute('role', q.multi ? 'checkbox' : 'radio');
      btn.setAttribute('aria-checked', String(selected.has(opt.value)));
      if (selected.has(opt.value)) btn.classList.add('is-selected');
      btn.append(el('span', 'bmwm-option-label', opt.label));
      if (opt.sub) btn.append(el('span', 'bmwm-option-sub', opt.sub));
      btn.addEventListener('click', () => {
        if (q.multi) {
          if (selected.has(opt.value)) selected.delete(opt.value);
          else {
            if (opt.value === 'any') selected.clear();
            else selected.delete('any');
            if (q.max && selected.size >= q.max) return;
            selected.add(opt.value);
          }
          ctx.answers[q.id] = [...selected];
          optionButtons.forEach(({ button, value }) => {
            button.classList.toggle('is-selected', selected.has(value));
            button.setAttribute('aria-checked', String(selected.has(value)));
          });
          next.disabled = selected.size === 0;
          schedulePreviewRefresh(ctx);
        } else {
          ctx.answers[q.id] = opt.value;
          // Refresh before advancing: the debounced fetch is scheduled on ctx, so
          // the next question's freshly-built drawer picks up the result (via the
          // seq guard) even though this screen is about to be replaced.
          schedulePreviewRefresh(ctx);
          advance();
        }
      });
      optionButtons.push({ button: btn, value: opt.value });
      list.append(btn);
    });
  }
  screen.append(list);

  const nav = el('div', 'bmwm-nav');
  const back = el('button', 'bmwm-btn bmwm-btn-ghost', 'Back');
  back.type = 'button';
  back.disabled = index === 0;
  back.addEventListener('click', () => ctx.showQuestion(index - 1));
  nav.append(back);

  const next = el('button', 'bmwm-btn bmwm-btn-primary', index + 1 === questions.length ? 'Explore my matches' : 'Next');
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
  screen.querySelector('.bmwm-question').setAttribute('tabindex', '-1');
  screen.querySelector('.bmwm-question').focus({ preventScroll: true });

  // Live "best guess" strip. If we already have matches cached (navigating
  // Back/Next), mount it straight away so it doesn't flash out and back in;
  // otherwise it appears once the refresh below lands. showPreview no-ops
  // (and removes the strip) when there are no matches, so it's only ever on
  // screen with content.
  showPreview(ctx);

  // Refresh on entering the question too, so navigating Back/Next (budget
  // already set) updates the guess even without changing an answer. Cheap: the
  // stock is served from the warmed cache and the call is debounced.
  schedulePreviewRefresh(ctx);
}

/** Miles from the configured retailer, e.g. "18.1 miles away". */
function distanceLabel(distance) {
  const miles = Math.round(distance * 10) / 10;
  return `${miles} ${miles === 1 ? 'mile' : 'miles'} away`;
}

/**
 * The photo band every card surface shares: the retailer's picture when the
 * feed supplied one, the "Images coming soon" placeholder when it didn't, and
 * the line label pinned in the corner. Mirrors usedcars.bmw.co.uk's own PDP
 * for a photo-less listing — a white bold caption centred on the dark field.
 *
 * Returns the element and a `showPhoto` to change it later. The swap exists
 * because a hero card's listing picker can change which car the card is
 * describing, and colour is usually the entire reason that choice exists: a
 * card that renames the paint over a picture of the old one has argued against
 * itself. Tiles never call it a second time, but they get it from here anyway
 * — this was two near-identical copies, and the copy the picker didn't use was
 * the copy that quietly stopped matching.
 */
function mediaWell(car, extraClass = '') {
  const media = el('div', `bmwm-card-media${extraClass ? ` ${extraClass}` : ''}`);
  media.append(
    el('span', 'bmwm-card-soon', 'Images coming soon'),
    el('span', 'bmwm-card-line', car.line),
  );

  function showPhoto(src) {
    media.querySelector('.bmwm-card-photo')?.remove();
    media.classList.toggle('has-photo', Boolean(src));
    if (!src) return;
    const img = el('img', 'bmwm-card-photo');
    img.src = src;
    img.alt = car.name;
    img.loading = 'lazy';
    // A broken image URL shouldn't leave a half-rendered card — drop back to
    // the placeholder, exactly as a photo-less car shows.
    img.addEventListener('error', () => {
      media.classList.remove('has-photo');
      img.remove();
    });
    // Ahead of the caption and the line label, both of which sit over it.
    media.prepend(img);
  }
  showPhoto(car.photo);

  return { media, showPhoto };
}

/**
 * One result card.
 * `big` adds the "why it suits you" reasons; `compact` is the carousel tile —
 * same anatomy, but trades the blurb and reasons for a distance line.
 */
function matchCard(match, {
  big = false, compact = false, brand: brandKey = 'bmw',
  rejectOptions, rejectLabel, rejectPrompt,
} = {}) {
  const { car, score, reasons } = match;
  const copy = BRAND_COPY[brandKey] || BRAND_COPY.bmw;
  const card = el('article', `bmwm-card${big ? ' bmwm-card-big' : ''}${compact ? ' bmwm-card-compact' : ''}`);

  const { media, showPhoto } = mediaWell(car);
  card.append(media);

  const body = el('div', 'bmwm-card-body');
  const head = el('div', 'bmwm-card-head');
  head.append(el('h3', 'bmwm-card-name', car.name));
  const badge = el('span', 'bmwm-score', `${score}%`);
  badge.title = 'Match score';
  head.append(badge);
  body.append(head);

  // Single used price when min === max (live stock), else the range.
  // A grouped card prices the whole group; a single listing prices itself.
  const price = car.listingCount > 1 && car.priceFrom !== car.priceTo
    ? `from ${gbp(car.priceFrom)}`
    : (car.priceMin === car.priceMax
      ? gbp(car.priceMin)
      : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`);
  const specs = el('p', 'bmwm-specs');
  // Paint, by its marketing name ("Legend Grey"), when the detail lookup got
  // one. It reads as a spec, but it's carrying more weight than that: when the
  // engine can't separate the cars, colour is very often the actual difference
  // between them — so it belongs on the card, not buried on the retailer's PDP.
  const lead = [SPEC_LABELS[car.body], FUEL_SPEC[car.fuel]].filter(Boolean);
  /*
   * The spec line, rebuilt rather than written once, because the listing
   * picker below can change what this card is describing. It used to be built
   * inline, so choosing a listing updated the mileage and the link but left
   * the paint saying "Chili Red" next to the black car's mileage — a card
   * describing two different cars at once, which is worse than not offering
   * the choice at all.
   */
  function renderSpecs(paint, shade, priceText) {
    specs.replaceChildren();
    // Compact tiles are narrow — the headline specs only, no 0–62/economy.
    const tail = (compact ? [priceText] : [
      priceText,
      `0–62 ${car.zeroTo62}s`,
      car.fuel === 'ev' ? `${car.evRange} mi range` : `${car.mpg} mpg`,
    ]).filter(Boolean);
    if (!paint || compact) {
      specs.textContent = [...lead, ...tail].join('  ·  ');
      return;
    }
    // Paint gets a swatch as well as its name: in a tie the colour is very
    // often the actual difference between the cars, and a dot you can see
    // beats a name you have to read. No hex for the name → name alone.
    specs.append(`${lead.join('  ·  ')}  ·  `);
    const hex = SWATCH_HEX[(shade || '').toLowerCase()];
    if (hex) {
      const dot = el('span', 'bmwm-swatch');
      dot.style.background = hex;
      specs.append(dot);
    }
    specs.append(`${paint}  ·  ${tail.join('  ·  ')}`);
  }
  renderSpecs(
    car.colour?.manufacturerColour || car.colour?.colour,
    car.colour?.colour,
    price,
  );
  body.append(specs);

  // The whole point of the carousel: how far away is it, and whose is it?
  // Distance comes from the live feed, so omit the line rather than invent
  // one if the feed didn't supply it.
  /*
   * Where this car is, on every card rather than only the compact ones.
   *
   * This is what lets the page be one ranked list instead of three. When
   * "at the retailer" and "23 miles away" were separate SECTIONS, each needed
   * its own caption, and those captions contradicted each other as soon as a
   * distant car outscored a local one. Make it a property of the card and the
   * sections stop being necessary: the list is just sorted, and each row says
   * where you'd go.
   */
  const where = el('p', 'bmwm-distance');
  if (car.distance != null) {
    where.append(el('span', 'bmwm-distance-miles', distanceLabel(car.distance)));
    if (car.retailerName) where.append(el('span', null, ` · ${car.retailerName}`));
    body.append(where);
  } else if (car.retailerName) {
    where.append(el('span', 'bmwm-distance-here', `At ${car.retailerName}`));
    body.append(where);
  }

  // When repeat listings of the same car were grouped into this card, say so:
  // how many, the price spread, and the colours they come in. Without this the
  // page showed four identical iX2 cards and looked like it was stuttering.
  if (car.listingCount > 1) {
    const avail = el('p', 'bmwm-avail');
    const span = car.priceFrom === car.priceTo
      ? gbp(car.priceFrom)
      : `${gbp(car.priceFrom)}–${gbp(car.priceTo)}`;
    avail.append(el('span', 'bmwm-avail-count', `${car.listingCount} available`));
    avail.append(el('span', null, ` · ${span}`));
    if (car.colours?.length) avail.append(el('span', null, ` · ${orList(car.colours)}`));
    body.append(avail);
  }

  // Real used-car detail from the live feed, when present.
  const detailBits = [];
  if (car.plate) detailBits.push(`’${car.plate} reg`);
  if (car.mileage != null) detailBits.push(`${car.mileage.toLocaleString('en-GB')} miles`);
  const usedMeta = detailBits.length ? el('p', 'bmwm-usedmeta', detailBits.join('  ·  ')) : null;
  if (usedMeta) body.append(usedMeta);

  if (!compact) body.append(el('p', 'bmwm-blurb', car.blurb));

  if (big && reasons.length) {
    const why = el('ul', 'bmwm-reasons');
    reasons.forEach((r) => why.append(el('li', null, r)));
    body.append(el('p', 'bmwm-why-label', 'Why it suits you'), why);
  }

  // Owning the trade-off: when a recommendation misses a stated want (it's
  // petrol and they asked for electric), the card says so itself, right under
  // the case for it — not only the page-level unmet note, which fires solely
  // when the whole reachable pool is short, and in practice almost never does.
  //
  // Every card that leads the page, not just the hero: a tie renders medium
  // cards, and that's precisely where the admission matters most — six coupés
  // offered to someone who asked for a convertible should say so on each of
  // them, not go quiet because none of them is a "hero". Only the compact
  // carousel tiles skip it, and they already state the shape in their specs.
  if (!compact && match.tradeOffs?.length) {
    const { label } = TRADE_COPY[brandKey] || TRADE_COPY.bmw;
    body.append(
      el('p', 'bmwm-why-label bmwm-trade-label', label),
      el('p', 'bmwm-trade-text', tradeLines(brandKey, match.tradeOffs).join(' ')),
    );
  }

  // Set by the reject block below, called by the listing picker further down:
  // the two are built in DOM order but have to stay in step, because a reason
  // for turning a car down is only usable if it is about the car on screen.
  let onPick = null;

  // "Not this one" — the other half of choosing. Rejecting a car is the
  // highest-signal thing a buyer does, because it's a reaction to a real car
  // rather than an answer about a hypothetical one; the menu is what turns it
  // into something actionable (see rejectOptions). Only offered where a
  // caller supplies the options, so it appears in a tie and nowhere else.
  if (rejectOptions) {
    const rejectWrap = el('div', 'bmwm-reject');
    const open = el('button', 'bmwm-reject-open', rejectLabel || 'Not this one');
    open.type = 'button';
    open.setAttribute('aria-expanded', 'false');
    // Says what the control DOES. It was a small underlined link that looked
    // like a disclaimer, and nothing on the page suggested that turning a
    // car down would bring another one in — so the most conversational thing
    // the tool can do read as the least important.
    if (copy.rejectHint) open.append(el('span', 'bmwm-reject-hint', copy.rejectHint));
    const menu = el('div', 'bmwm-reject-menu');
    menu.hidden = true;
    open.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      open.setAttribute('aria-expanded', String(!menu.hidden));
    });

    /*
     * Rebuilt whenever the card changes which car it is describing.
     *
     * The menu used to be built once, from the group's representative, and the
     * listing picker only repainted the DOM — so switching a four-colour card
     * from red to green left "Not the red" on offer, and taking it removed the
     * green car the buyer was actually looking at. The reason has to be about
     * the car in front of them, or it is worse than no reason at all.
     */
    function renderRejectMenu(chosen) {
      const options = rejectOptions(match, chosen);
      rejectWrap.hidden = !options.length;
      menu.replaceChildren(el('p', 'bmwm-reject-prompt', rejectPrompt || 'What put you off?'));
      options.forEach((o) => {
        const b = el('button', 'bmwm-reject-option', o.label);
        b.type = 'button';
        b.addEventListener('click', o.apply);
        menu.append(b);
      });
    }
    renderRejectMenu(listingsOf(match)[0]);
    onPick = renderRejectMenu;

    rejectWrap.append(open, menu);
    body.append(rejectWrap);
  }

  /*
   * Which one, though?
   *
   * Grouping repeat listings fixed the page reading as a stutter, but it also
   * ended the journey a step early: it narrowed to a model and trim, then
   * quietly handed over whichever listing happened to rank first. That's the
   * step Chloe and Meg actually care about — the same Cooper C in Ocean Wave
   * Green or Melting Silver is the whole decision for them.
   *
   * So a card that speaks for several cars lets the buyer pick the actual one.
   * Choosing swaps the photo, price, mileage and the link out, so the card
   * always describes the car they'd be going to see. Hero cards only: the
   * compact tiles are a glance, not a decision.
   */
  // Every card that speaks for several cars, not just the hero. The picker
  // was `big`-only, so a tie — where grouped cards are commonest — showed
  // "4 available … Portimao Blue, Brooklyn Grey or Alpine White" with no way
  // to choose between them. Compact tiles stay out: they're a glance.
  if (!compact && match.listings?.length > 1) {
    body.append(el('p', 'bmwm-why-label', copy.pickLabel));
    const picker = el('div', 'bmwm-pick');
    match.listings.forEach((listing, i) => {
      const opt = el('button', `bmwm-pick-opt${i === 0 ? ' is-on' : ''}`);
      opt.type = 'button';
      opt.setAttribute('aria-pressed', String(i === 0));
      // Marketing names bury the basic colour anywhere in the string, and not
      // always last ("Midnight Black II", "Chili Red"), so try every word.
      const hex = (listing.colour || '')
        .toLowerCase().split(/[^a-z]+/)
        .map((word) => SWATCH_HEX[word])
        .find(Boolean);
      if (hex) {
        const dot = el('span', 'bmwm-swatch');
        dot.style.background = hex;
        opt.append(dot);
      }
      // Paint is fetched per car and can be missing (an unreachable page, or
      // the request's colour budget running out). Naming the row "Colour n/a"
      // told the buyer nothing; mileage is the next thing that actually
      // separates two otherwise identical cars.
      const label = listing.colour
        || (listing.mileage != null ? `${listing.mileage.toLocaleString('en-GB')} miles` : `Option ${i + 1}`);
      opt.append(el('span', 'bmwm-pick-colour', label));
      const bits = [gbp(listing.priceMin)];
      if (listing.colour && listing.mileage != null) {
        bits.push(`${listing.mileage.toLocaleString('en-GB')} mi`);
      }
      opt.append(el('span', 'bmwm-pick-meta', bits.join(' · ')));
      opt.addEventListener('click', () => {
        picker.querySelectorAll('.bmwm-pick-opt').forEach((b) => {
          b.classList.remove('is-on');
          b.setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('is-on');
        opt.setAttribute('aria-pressed', 'true');
        // Re-describe the card as the chosen car: paint, swatch, price,
        // mileage and where the link goes. Anything left showing the previous
        // listing's values is a card describing two cars at once.
        showPhoto(listing.photo);
        renderSpecs(listing.colour, listing.shade, gbp(listing.priceMin));
        if (usedMeta) {
          const bits = [];
          if (car.plate) bits.push(`’${car.plate} reg`);
          if (listing.mileage != null) {
            bits.push(`${listing.mileage.toLocaleString('en-GB')} miles`);
          }
          usedMeta.textContent = bits.join('  ·  ');
        }
        const cta = card.querySelector('.bmwm-card-link');
        if (cta && listing.link) cta.href = listing.link;
        // Re-offer reasons about the car now being shown.
        onPick?.(listing);
      });
      picker.append(opt);
    });
    body.append(picker);
  }

  // Link out to the retailer's live stock, when the feed gave us one.
  if (car.link) {
    const cta = el('a', 'bmwm-card-link', `View at ${car.retailerName || 'the retailer'} ›`);
    cta.href = car.link;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    body.append(cta);
  }

  card.append(body);
  return card;
}

/**
 * A small "mini" tile for the live preview strip — deliberately lighter than the
 * results-page compact card (matchCard): a small photo (or the "Images coming
 * soon" placeholder), the model name + match score, and one spec line. The whole
 * tile is a link to the live listing when the feed gave us one.
 */
function previewTile(match) {
  const { car, score } = match;
  // A grouped card prices the whole group; a single listing prices itself.
  const price = car.listingCount > 1 && car.priceFrom !== car.priceTo
    ? `from ${gbp(car.priceFrom)}`
    : (car.priceMin === car.priceMax
      ? gbp(car.priceMin)
      : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`);

  // Whole tile is the tap target — an <a> when we have a link, else a plain
  // article (still a valid tile, just not clickable).
  const tag = car.link ? 'a' : 'article';
  const tile = el(tag, 'bmwm-ptile bmwm-ptile-mini');
  if (car.link) {
    tile.href = car.link;
    tile.target = '_blank';
    tile.rel = 'noopener noreferrer';
    tile.setAttribute('aria-label', `${car.name}, ${price}, ${score}% match. View at ${car.retailerName || 'the retailer'}`);
  }

  const { media } = mediaWell(car, 'bmwm-ptile-media');

  const body = el('div', 'bmwm-ptile-body');
  const head = el('div', 'bmwm-ptile-head');
  const badge = el('span', 'bmwm-score bmwm-ptile-score', `${score}%`);
  badge.title = 'Match score';
  head.append(el('span', 'bmwm-ptile-name', car.name.replace(/^BMW /, '')), badge);
  const specs = el('span', 'bmwm-ptile-specs',
    [SPEC_LABELS[car.body], FUEL_SPEC[car.fuel], price].filter(Boolean).join(' · '));
  body.append(head, specs);
  tile.append(media, body);
  return tile;
}

/** Full-screen status message (loading / error), optionally with a retry button. */
function renderStatus(root, { kicker, title, message, retryLabel, onRetry }) {
  root.replaceChildren();
  const screen = el('div', 'bmwm-screen bmwm-status');
  if (kicker) screen.append(el('p', 'bmwm-kicker', kicker));
  screen.append(el('h2', 'bmwm-title', title));
  if (message) screen.append(el('p', 'bmwm-lede', message));
  if (onRetry) {
    const retry = el('button', 'bmwm-btn bmwm-btn-primary', retryLabel || 'Try again');
    retry.type = 'button';
    retry.addEventListener('click', onRetry);
    screen.append(retry);
  }
  root.append(screen);
}

/**
 * Skeleton placeholder for the intro screen, shown while the question set
 * loads (GET /api/questions). Mirrors renderIntro — kicker, title, two lede
 * lines, a CTA button block — so the boot reads as "the intro, arriving"
 * rather than a "Loading" status message that then swaps out. Reuses
 * the .bmwm-skel shimmer; reduced-motion users get a static tint.
 */
function renderIntroSkeleton(root) {
  root.replaceChildren();
  const intro = el('div', 'bmwm-intro bmwm-intro-skeleton');
  intro.setAttribute('aria-busy', 'true');
  intro.setAttribute('aria-label', 'Loading the matcher');
  const skel = (mod) => el('div', `bmwm-skel ${mod}`);
  intro.append(
    skel('bmwm-skel-kicker'),
    skel('bmwm-skel-title'),
    skel('bmwm-skel-line bmwm-skel-lede'),
    skel('bmwm-skel-line bmwm-skel-lede'),
    skel('bmwm-skel-line bmwm-skel-lede bmwm-skel-lede-last'),
    skel('bmwm-skel-btn'),
  );
  root.append(intro);
}

/**
 * Skeleton placeholder for the results page, shown while /api/match is in
 * flight. Mirrors the real layout — kicker, title, one big hero card, a 2-up
 * row of compact tiles — so the load reads as "this page, arriving" rather
 * than a centred spinner that then jumps to a dense grid. The shimmer is CSS
 * (see .bmwm-skel); reduced-motion users get a static tint instead.
 */
function renderResultsSkeleton(root) {
  root.replaceChildren();
  const screen = el('div', 'bmwm-screen bmwm-results bmwm-results-skeleton');
  // Announce the wait for assistive tech, since there's no visible status text.
  screen.setAttribute('aria-busy', 'true');
  screen.setAttribute('aria-label', 'Finding your matches');

  // A skeleton block: className extends .bmwm-skel with a shape modifier.
  const skel = (mod) => el('div', `bmwm-skel ${mod}`);

  screen.append(skel('bmwm-skel-kicker'), skel('bmwm-skel-title'));

  // Hero card: media band + a few body lines, matching matchCard(big).
  const hero = el('div', 'bmwm-grid');
  const heroCard = el('article', 'bmwm-card bmwm-card-big bmwm-skel-card');
  heroCard.append(el('div', 'bmwm-skel bmwm-skel-media'));
  const heroBody = el('div', 'bmwm-card-body');
  heroBody.append(
    skel('bmwm-skel-line bmwm-skel-name'),
    skel('bmwm-skel-line bmwm-skel-specs'),
    skel('bmwm-skel-line bmwm-skel-blurb'),
    skel('bmwm-skel-line bmwm-skel-blurb'),
  );
  heroCard.append(heroBody);
  hero.append(heroCard);
  screen.append(hero);

  // Compact-tile skeletons, matching the tile row each group paints below its
  // lead cards.
  const more = el('div', 'bmwm-tail-grid');
  for (let i = 0; i < 3; i += 1) {
    const tile = el('article', 'bmwm-card bmwm-card-compact bmwm-skel-card');
    tile.append(el('div', 'bmwm-skel bmwm-skel-media'));
    const body = el('div', 'bmwm-card-body');
    body.append(
      skel('bmwm-skel-line bmwm-skel-name'),
      skel('bmwm-skel-line bmwm-skel-specs'),
    );
    tile.append(body);
    more.append(tile);
  }
  screen.append(more);

  root.append(screen);
}

/**
 * The "Worth the drive" band with its heading + lede but a skeleton carousel in
 * place of real tiles, shown while /api/nearby is in flight. Returns the
 * <section> so the caller can fill it (fillNearbyBand) or remove it. Built to
 * match the real band exactly so filling it in causes no layout shift.
 */
function renderNearbySkeleton(ctx, lede) {
  const band = el('section', 'bmwm-nearby-band');
  band.setAttribute('aria-busy', 'true');
  band.append(
    el('h3', 'bmwm-subhead bmwm-nearby-heading', 'WORTH THE DRIVE'),
    el('p', 'bmwm-lede bmwm-nearby-lede', lede),
  );
  const track = el('div', 'bmwm-nearby');
  // A few placeholder tiles mirroring the compact card (media band + 2 lines).
  for (let i = 0; i < 3; i += 1) {
    const tile = el('article', 'bmwm-card bmwm-card-compact bmwm-skel-card');
    tile.append(el('div', 'bmwm-skel bmwm-skel-media'));
    const body = el('div', 'bmwm-card-body');
    body.append(
      el('div', 'bmwm-skel bmwm-skel-line bmwm-skel-name'),
      el('div', 'bmwm-skel bmwm-skel-line bmwm-skel-specs'),
    );
    tile.append(body);
    track.append(tile);
  }
  band.append(track);
  return band;
}

/**
 * Swap a nearby skeleton band (from renderNearbySkeleton) for the real
 * carousel of nearby-retailer matches, in place. Replaces only the track so
 * the heading/lede stay put.
 */
function fillNearbyBand(band, ctx, nearby) {
  band.removeAttribute('aria-busy');
  band.querySelector('.bmwm-nearby')?.remove();
  const track = el('div', 'bmwm-nearby');
  // Focusable so the carousel is scrollable by keyboard, not just by swipe.
  track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-label', `Matches at other retailers near ${ctx.retailerLabel}`);
  nearby.forEach((m) => track.append(matchCard(m, { compact: true })));
  band.append(track);
}

async function renderResults(root, ctx, answers) {
  renderResultsSkeleton(root);

  // Two-phase load. The retailer's own matches (fast: one feed) render first;
  // the nearby-retailer carousel (slow: a national distance search) is fetched
  // separately below so it never holds up the hero. See apiNearby / the
  // .bmwm-nearby placeholder wired up further down.
  let matches;
  // Whether the engine could actually pick a winner, and how big the tie is if
  // not (see matchCars). Defaults to the old behaviour — an API that doesn't
  // send `decisive` keeps getting the single-hero page it always rendered.
  let decisive = true;
  let clusterSize = 1;
  // Fit tied, but their stated priorities picked a winner (see matchCars).
  let tasteLead = false;
  // Held back by the API so a rejection has a next-best car to promote.
  let alternatives = [];
  // The one ranked list, once it exists. Nearby stock is merged into it when
  // the national search resolves (see addToPool below).
  let refine = null;
  // What the retailer's own stock couldn't offer. Half the picture: nothing is
  // said to the user until /api/nearby agrees (see agreedUnmet). An older API
  // that doesn't send the field leaves this empty, so it simply never fires.
  let retailerUnmet = {};
  try {
    ({
      matches, decisive = true, clusterSize = 1, tasteLead = false,
      alternatives = [], unmet: retailerUnmet = {},
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

  root.replaceChildren();
  const screen = el('div', 'bmwm-screen bmwm-results');
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const { name: brandName } = copy;

  screen.append(el('p', 'bmwm-kicker', 'Your results'));

  if (matches.length === 0) {
    screen.append(
      el('h2', 'bmwm-title', 'No matches found.'),
      el('p', 'bmwm-lede', `Nothing in ${ctx.retailerLabel}'s current stock fits those answers. Try loosening the budget or seating needs.`),
    );
  } else {
    // How many cars lead the page as EQUALS. One when the engine genuinely
    // picked a winner; otherwise the tie itself — never more, because the
    // headline counts these and "three fit you equally well" must not be said
    // over a third car that's four points back. Anything beyond this leads a
    // quieter "More at <retailer>" tier, so a near-miss is demoted rather than
    // dropped.
    /*
     * The frames, one per situation (docs/results-page-states.md).
     *
     * These used to be chosen ONCE, from the server's verdict about the
     * original result set, and then reused however far the buyer narrowed.
     * That is how "TWO OF THESE FIT YOU EQUALLY WELL" survived being applied
     * to a 96% and a 73%. Now renderRefine picks between them on every
     * redraw, from the scores actually on screen, so all this has to supply
     * is the words for each case.
     */
    const perfect = ({ model }) => `Your perfect ${brandName} is the ${model}.`;
    /*
     * The same claim, scoped to the retailer whose page this is. Used only when
     * a car elsewhere genuinely outranks the best one here — renderRefine picks
     * the `…Here` variant per redraw off that one comparison, so the scope
     * appears exactly where it is load-bearing and nowhere else.
     *
     * "at Grassicks Garage" is deflating read alone, and it is the accurate
     * statement of what was searched: this block is authored onto ONE
     * retailer's site, and a tool on their page answering "go to Group 1
     * Bedford" is answering a different question than the page implies.
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

    const title = el('h2', 'bmwm-title', '');
    const lede = el('p', 'bmwm-lede', '');
    screen.append(title, lede);

    /*
     * One pool, one list. Everything the API returned goes in: the matches,
     * the held-back alternatives a rejection can promote, and — later, when
     * the national search resolves — the nearby retailers' stock too.
     *
     * The old page split these across three sections with three captions and
     * three internal rankings, which is what made it possible for it to claim
     * two cars fit best above a card scoring higher. See
     * docs/results-page-review.md.
     */
    refine = renderRefine(
      ctx, [...matches, ...alternatives], title, lede, frames, tasteLead,
    );
    screen.append(refine.host);
  }

  /*
   * Nearby stock used to get its own "Worth the drive" carousel below
   * everything else. It doesn't any more: it joins the one ranked list (see
   * addToPool). What remains here is the empty case — when the retailer had
   * nothing at all, there is no list to join, so the nearby cars ARE the
   * results and get rendered as such.
   */
  const emptyLocal = !matches.length;
  const nearbyBand = emptyLocal
    ? renderNearbySkeleton(ctx, copy.driveLede.empty({ retailer: ctx.retailerLabel }))
    : null;
  if (nearbyBand) screen.append(nearbyBand);

  const actions = el('div', 'bmwm-actions');
  const share = el('button', 'bmwm-btn bmwm-btn-primary', 'Copy share link');
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
  const tweak = el('button', 'bmwm-btn bmwm-btn-ghost', 'Tweak my answers');
  tweak.type = 'button';
  tweak.addEventListener('click', () => ctx.showQuestion(visibleQuestions(ctx.questions, ctx.answers).length - 1));
  const retake = el('button', 'bmwm-btn bmwm-btn-ghost', 'Start over');
  retake.type = 'button';
  retake.addEventListener('click', () => {
    ctx.answers = {};
    // Clear the strip's carried-over guess so a fresh run starts empty, and
    // drop any in-flight/debounced refresh from the finished run (bump seq so a
    // late-landing response from the old run is ignored).
    clearTimeout(ctx.previewTimer);
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
  if (disclaimer) screen.append(el('p', 'bmwm-disclaimer', disclaimer));

  root.append(screen);

  // Phase two: now the page is painted, load the nearby carousel in the
  // background and swap it into the placeholder band (or drop the band).
  //
  // This is also the moment we learn whether a want the retailer couldn't meet
  // is genuinely unavailable, so the unmet note goes in here rather than with
  // the hero — we'd otherwise be claiming "no electric cars near you" while
  // still waiting to hear from the retailers that might have one.
  {
    apiNearby(ctx.api, answers, ctx.retailer, ctx.brand).then(({ nearby, unmet }) => {
      // The user may have navigated away (retake/tweak) before this resolves;
      // only touch the page if it's still in the document.
      if (!screen.isConnected) return;

      // One insertion slot, two polarities (docs/results-page-states.md).
      // State 4: both halves lack the want → "not anywhere nearby" (rare).
      // State 3: missing here, met nearby → "not here, but N miles away" (the
      // common case). Either way this only ever ADDS to the page — first
      // paint's headline was written to stay true, so nothing is retracted.
      const agreed = agreedUnmet(retailerUnmet, unmet);
      let note = unmetNote(ctx, agreed);
      let ordered = nearby;
      // Which car the note ends up pointing at, so the "we looked further
      // afield" notice can stand down for that one car rather than for the
      // whole page (see renderRefine's noteShown).
      let notedCar = null;
      if (!note && unmet) {
        // Nearby answered and disagreed: whatever the retailer lacks that
        // didn't survive into `agreed` is met somewhere within reach.
        const rescued = {};
        for (const [id, values] of Object.entries(retailerUnmet || {})) {
          const left = values.filter((v) => !(agreed[id] || []).includes(v));
          if (left.length) rescued[id] = left;
        }
        // The cars the note is about: those that HAVE the rescued want itself
        // — not "zero trade-offs overall", which claims more than the note
        // says and can be empty when the note is still true. Nearly every
        // MINI plug-in hybrid is a Countryman: for a PHEV-hatchback ask no
        // nearby car meets the whole brief, but "the nearest plug-in hybrid
        // is 12 miles away" remains exactly what the buyer asked to know.
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
        // Above the cards, whatever frame they're in. The grid lives inside
        // the refine host — walk up to the screen-level ancestor, or
        // insertBefore throws on a non-child reference node.
        let anchor = screen.querySelector('.bmwm-refine, .bmwm-grid');
        while (anchor && anchor.parentElement !== screen) anchor = anchor.parentElement;
        // No cards at all (state 5): the note still belongs with the results,
        // directly above whatever IS there.
        screen.insertBefore(note, anchor || nearbyBand);
        // Tell the list which car the note claimed, so the notice doesn't say a
        // second, vaguer version of the same sentence about the same car.
        refine?.noteShown(notedCar);
      }
      /*
       * The merge. Nearby cars join the one ranked list rather than forming a
       * band beneath it, so the page never claims a local car fits best above
       * a more distant one that scores higher. Each card says where it is, so
       * "23 miles away · Arnold Clark Kirkcaldy" is the buyer's call to make
       * with the facts in front of them.
       *
       * When the retailer had nothing at all there is no list to join, and
       * the nearby cars are the results — they keep the standalone band.
       */
      if (refine) refine.addToPool(ordered);
      else if (nearbyBand && ordered.length) fillNearbyBand(nearbyBand, ctx, ordered);
      else nearbyBand?.remove();
    });
  }
}

/* ------------------------------ decorate ------------------------------ */

export default async function decorate(block) {
  // Read authored config (e.g. the "Retailer ID" row) before clearing the
  // block's children — the config rows live in the block's original markup.
  const retailer = retailerSite(block);
  const retailerLabel = retailerName(block);
  const api = apiBase(block);
  const brandKey = brand(block);
  const overrides = copyOverrides(block);

  block.replaceChildren();
  // Base class + brand theme class ('bmwm-bmw' | 'bmwm-mini'). The MINI theme
  // (bmw-matcher.css) overrides the design tokens under .bmwm-mini.
  block.classList.add('bmwm', `bmwm-${brandKey}`);

  const ctx = {
    answers: {},
    api,
    retailer,
    retailerLabel,
    brand: brandKey,
    // Authored copy overrides (title / kicker / disclaimer) — see copyRow.
    overrides,
    questions: [],
    // Live "best guess" strip state, kept on ctx so it survives the
    // per-question re-render (see renderPreviewSection / schedulePreviewRefresh).
    // `seq` is the latest-wins guard for the debounced refetch.
    // `loaded` flips true once the first /api/preview response lands, so the
    // strip can tell "still loading" (show skeleton) from "loaded, no matches"
    // (hide the strip). `seq` is the latest-wins guard for the debounced fetch.
    preview: { matches: [], seq: 0, loaded: false },
    previewTimer: null,
    // Set when a summary pill is tapped to edit an earlier answer: the index to
    // return to once that answer is re-submitted (see renderAnswerPills /
    // advance). Null the rest of the time.
    editReturnIndex: null,
    // Where the preview strip mounts within the quiz screen. This is the one
    // spot that differs by layout: here it sits at the END of the screen, i.e.
    // below the Back/Next nav.
    mountPreview: (screen, section) => screen.append(section),
  };
  ctx.showIntro = () => renderIntro(block, ctx);
  ctx.showQuestion = (i) => renderQuestion(block, ctx, i);
  ctx.showResults = (answers, { updateHash = false } = {}) => {
    if (updateHash) {
      window.history.replaceState(null, '', `#${HASH_KEY}=${encodeAnswers(answers)}`);
    }
    renderResults(block, ctx, answers);
  };

  // The question set lives behind the API, so load it before rendering.
  const boot = async () => {
    // Skeleton the intro while the question set loads — reads as the page
    // arriving rather than a "Loading…" status. (A deep-link run swaps to the
    // results skeleton a moment later inside renderResults.)
    renderIntroSkeleton(block);
    try {
      const meta = await apiGetQuestions(ctx.api, ctx.retailer, ctx.brand);
      ctx.questions = meta.questions;
    } catch {
      renderStatus(block, {
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

  // Deliberately NOT awaited. EDS awaits every block's decorate() before it
  // reveals the page (body gains `appear`), so awaiting a network round-trip
  // here holds the WHOLE document hostage — including scrolling. Against a
  // cold Render backend that's 30–50s of a page that looks broken: content
  // visible, scroll dead. boot() paints its own skeleton immediately and swaps
  // in the real thing whenever the questions land, so decorate() can return
  // now and let the page finish loading.
  boot();
}
