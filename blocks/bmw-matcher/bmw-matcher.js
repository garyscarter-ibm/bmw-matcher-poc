/*
 * BMW Matcher — Adobe Edge Delivery Services (EDS) block.
 *
 * EDS calls `decorate(block)` with the block's DOM element; the quiz UI,
 * results rendering and share links are handled here. The scoring engine and
 * car dataset live behind an API (see server/) so they never reach the
 * browser — the block fetches the quiz definition and match results over HTTP.
 *
 * The API base is read from the block's `data-api` attribute (set per-site in
 * EDS) and falls back to http://localhost:8787 for local preview.
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

/** API base for this block: `data-api` attribute, else the localhost default. */
function apiBase(block) {
  return (block.dataset.api || DEFAULT_API).replace(/\/+$/, '');
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
 * the intro headline, `cta` the intro button. `lede({ questions, matches,
 * retailer })` builds the intro paragraph — a function because the two brands
 * phrase it differently, not just swap nouns.
 *
 * Both counts are passed in rather than written into the copy: `questions`
 * comes from the fetched question set (brands have different totals) and
 * `matches` from the API's topMatches. Either can change server-side without
 * the copy going stale.
 *
 * Voices follow docs/tone-style-guide.md: BMW is assured and understated (the
 * flat, unapologetic close borrowed from bmw.co.uk's register), MINI keeps the
 * warmth but smiles. Deliberately no "quiz" anywhere — this is a matcher, and
 * the word undersold it. */
const BRAND_COPY = {
  bmw: {
    name: 'BMW',
    title: 'Find your perfect BMW',
    cta: 'Find my BMW',
    lede: ({ questions, matches, retailer }) => `${questions} quick questions about your life, `
      + `your miles and your budget. We’ll match you with the ${cardinal(matches)} approved-used `
      + `cars at ${retailer} that suit you best, and tell you why.`,
    // Approved Used's no-surprises register: state the fact, name the
    // retailer, don't dress it up (docs/tone-style-guide.md). No label —
    // BMW's copy states things rather than announcing them.
    unmet: ({ list, retailer }) => `No ${list} at ${retailer} or nearby right now. `
      + 'These are the closest matches to everything else you asked for.',
    // Shown instead of the "your perfect BMW is…" headline when the engine
    // can't separate the top cars (see matchCars: decisive/clusterSize).
    // Stated plainly, as a fact about the stock rather than an apology.
    tiedTitle: ({ count }) => `${cardinal(count)} of these fit you equally well`,
    // The retailer is named on every card, so the lede doesn't repeat it —
    // and a brand plural appended to a retailer label reads "Sytner Luton
    // MINI MINIs", which is why neither brand's copy builds one.
    tiedLede: () => 'On your answers we can’t split them: each suits you as well as the next. '
      + 'The difference now is which you prefer the look of.',
    // The refine panel: BMW states the instruction, no exclamation, no
    // cheerleading (docs/tone-style-guide.md).
    refineLabel: 'Narrow it down',
    refineStatus: ({ shown, total, wants }) => `${shown} of ${total}, with ${wants}.`,
    refineStatusPlain: ({ shown, total }) => `${shown} of ${total}.`,
    refineEmpty: ({ wants }) => `Nothing here has ${wants} together. `
      + 'Drop one of those and we’ll show you what does.',
    refineEmptyHidden: 'That’s all of them ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'Nothing left to show',
    // Rejection, in the retailer's plain register — a question, not a plea.
    rejectOpen: 'Not this one',
    rejectPrompt: 'What put you off?',
    rejectJust: 'Just not this one',
    hiddenChip: ({ count }) => `${count} ruled out`,
  },
  mini: {
    name: 'MINI',
    title: 'Find your perfect MINI',
    cta: 'Let’s find your MINI',
    lede: ({ questions, matches, retailer }) => `${questions} quick questions about your life, `
      + `your miles and your money. We’ll find the ${cardinal(matches)} MINIs at ${retailer} `
      + 'with your name on them — and tell you exactly why.',
    // Same fact, MINI's register: the UPPERCASE-with-a-full-stop beat as the
    // lead-in, then warm and plain. A shortage is a shrug, never a shrug-off.
    unmetLabel: 'SMALL SNAG.',
    unmet: ({ list, retailer }) => `No ${list} at ${retailer} or anywhere nearby right now. `
      + 'Here’s the closest we’ve got to the rest of your brief.',
    // Same fact in MINI's register: a tie is a nice problem, not a shortfall.
    tiedTitle: ({ count }) => `It’s a ${cardinal(count)}-way tie`,
    tiedLede: () => 'They all fit what you told us, just as well as each other. '
      + 'So it comes down to taste now — which is the fun bit.',
    // MINI asks rather than instructs, and treats a dead end as a shrug.
    refineLabel: 'So, what do you fancy?',
    refineStatus: ({ shown, total, wants }) => `${shown} of ${total} left, with ${wants}.`,
    refineStatusPlain: ({ shown, total }) => `${shown} of ${total} left.`,
    refineEmpty: ({ wants }) => `Ah — nothing here has ${wants} all at once. `
      + 'Let one of them go and we’ll show you what’s left.',
    refineEmptyHidden: 'Well, that’s the lot ruled out. Bring one back, or start over.',
    tiedEmptyTitle: 'That’s the lot, then',
    rejectOpen: 'Not this one',
    rejectPrompt: 'Go on then — what’s wrong with it?',
    rejectJust: 'Just not feeling it',
    hiddenChip: ({ count }) => `${count} ruled out`,
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
 * The tie, plus the means to break it.
 *
 * Renders the tied cars at equal weight and, above them, one tappable chip per
 * axis that actually separates them (see refinementAxes). Tapping requires
 * that thing; tapping again drops it. Everything happens here in the page —
 * the cars, their equipment, gearbox and paint all arrived with the match, so
 * narrowing six cars to one costs no round trip and no waiting.
 *
 * Two rules the plan insists on, both visible in the code below: an applied
 * refinement is always shown and always revocable (a chip you can't see is a
 * filter you can't argue with), and narrowing to nothing is a legitimate
 * outcome that must be explained rather than rendered as an empty grid.
 *
 * @param {HTMLElement} title the results headline, re-worded as the set narrows
 * @param {HTMLElement} lede the "we can't split them" line, dropped once we can
 */
function renderRefine(ctx, lead, title, lede) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const cars = lead.map((m) => m.car);
  const axes = refinementAxes(cars);
  const active = new Map(); // axis id -> axis

  // Everything narrowing the set, positive or negative, in one place: a
  // required feature and a rejected colour differ only in what they keep. Both
  // render as removable chips, because a filter the user can't see is one they
  // can't argue with — and at this stock depth two constraints can empty a
  // tie, which must be explainable rather than mysterious.
  const constraints = new Map(); // id -> { label, keep(car) }
  const hidden = new Set(); // cars waved away with no reason given

  const host = el('div', 'bmwm-refine');
  const chipRow = el('div', 'bmwm-chips');
  const status = el('p', 'bmwm-refine-status');
  const grid = el('div', 'bmwm-grid bmwm-grid-tied');

  // Only worth offering when there's something to offer. A cluster of
  // identical-spec cars in identical paint has no axes, and the page simply
  // stays as it was.
  if (axes.length) {
    host.append(el('p', 'bmwm-refine-label', copy.refineLabel), chipRow, status);
  }
  host.append(grid);

  const matching = () => lead.filter((m) => !hidden.has(m.car.id)
    && [...active.values()].every((a) => a.test(m.car))
    && [...constraints.values()].every((c) => c.keep(m.car)));

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
  function rejectOptions(car) {
    const shown = matching().map((m) => m.car);
    const others = shown.filter((c) => c.id !== car.id);
    const opts = [];
    const add = (id, label, keep) => opts.push({
      label,
      apply: () => { constraints.set(id, { label, keep }); redraw(); },
    });

    const shade = car.colour?.colour;
    if (shade && others.some((c) => c.colour?.colour && c.colour.colour !== shade)) {
      add(`!c:${shade}`, `Not the ${shade.toLowerCase()}`, (c) => c.colour?.colour !== shade);
    }
    if (others.some((c) => c.priceMin < car.priceMin)) {
      add(`!p:${car.priceMin}`, `Under ${gbp(car.priceMin)}`, (c) => c.priceMin < car.priceMin);
    }
    if (car.mileage != null && others.some((c) => c.mileage != null && c.mileage < car.mileage)) {
      add(`!m:${car.mileage}`, `Fewer than ${car.mileage.toLocaleString('en-GB')} miles`,
        (c) => c.mileage != null && c.mileage < car.mileage);
    }
    const gear = car.transmission;
    if (gear && others.some((c) => c.transmission && c.transmission !== gear)) {
      const want = gear === 'auto' ? 'manual' : 'automatic';
      add(`!g:${gear}`, `Only ${want}`, (c) => c.transmission !== gear);
    }
    opts.push({
      label: copy.rejectJust,
      apply: () => { hidden.add(car.id); redraw(); },
    });
    return opts;
  }

  function redraw() {
    const shown = matching();

    // Chips: every axis that still splits what's on screen, plus the ones
    // already applied (which by definition no longer split anything). Offering
    // an axis that can't change the result is noise, so they're recomputed
    // against the current set rather than the original one.
    chipRow.replaceChildren();
    const applied = (label, undo) => {
      const chip = el('button', 'bmwm-chip is-on', label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'true');
      chip.append(el('span', 'bmwm-chip-x', '✕'));
      chip.addEventListener('click', () => { undo(); redraw(); });
      chipRow.append(chip);
    };
    // Applied first — what's been decided leads what's still on offer.
    for (const [id, axis] of active) applied(axis.label, () => active.delete(id));
    for (const [id, c] of constraints) applied(c.label, () => constraints.delete(id));
    if (hidden.size) applied(copy.hiddenChip({ count: hidden.size }), () => hidden.clear());

    const live = refinementAxes(shown.map((m) => m.car)).map((a) => a.id);
    for (const axis of axes) {
      if (active.has(axis.id) || !live.includes(axis.id)) continue;
      const chip = el('button', 'bmwm-chip', axis.label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', 'false');
      chip.addEventListener('click', () => { active.set(axis.id, axis); redraw(); });
      chipRow.append(chip);
    }

    // The headline follows the set: a narrowing tie is still a tie until it
    // isn't, and the moment it lands on one car is the answer the whole tool
    // exists to give. The tie lede goes with it — "we can't split them" is
    // false once the user has split them.
    const wants = [...active.values(), ...constraints.values()].map((a) => a.label.toLowerCase());
    const settled = shown.length === 1;
    if (!shown.length) {
      // Nothing left to be a tie between — "a one-way tie" is the nonsense a
      // count-driven headline produces if it isn't stopped here.
      title.textContent = copy.tiedEmptyTitle;
    } else if (settled) {
      const model = shown[0].car.name.replace(new RegExp(`^${copy.name} `), '');
      title.textContent = `Your perfect ${copy.name} is the ${model}`;
    } else {
      title.textContent = copy.tiedTitle({ count: shown.length });
    }
    // "We can't split them" only holds while there are several to split.
    lede.hidden = shown.length <= 1;
    // A car waved away with no reason narrows the count but adds no words —
    // there's nothing to report about "just not that one".
    if (wants.length) {
      status.textContent = copy.refineStatus({
        shown: shown.length, total: lead.length, wants: andList(wants),
      });
    } else if (hidden.size) {
      status.textContent = copy.refineStatusPlain({ shown: shown.length, total: lead.length });
    } else {
      status.textContent = '';
    }

    grid.replaceChildren();
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
      return;
    }
    // One car left is a recommendation again, so it gets the hero treatment
    // (photo, reasons, its trade-off) rather than staying a tile in a grid.
    // It keeps its reject menu: the answer still has to survive being looked
    // at, and "actually, not that one either" is a real thing to want to say.
    const single = shown.length === 1;
    grid.classList.toggle('bmwm-grid-tied', !single);
    shown.forEach((m) => grid.append(matchCard(m, {
      big: single,
      brand: ctx.brand,
      rejectOptions,
      rejectLabel: copy.rejectOpen,
      rejectPrompt: copy.rejectPrompt,
    })));
  }

  redraw();
  return host;
}

/**
 * A brand-voiced note admitting that something the user asked for isn't in
 * the stock we searched, and framing what's shown as the closest fit. Returns
 * null when there's nothing to admit to — which is the common case.
 */
function unmetNote(ctx, unmet) {
  const copy = BRAND_COPY[ctx.brand] || BRAND_COPY.bmw;
  const phrases = UNMET_PHRASES[ctx.brand] || UNMET_PHRASES.bmw;
  // Fuel first, then shape: "No fully electric cars or estates at …".
  const items = ['fuel', 'bodyStyles'].flatMap(
    (id) => (unmet[id] || []).map((v) => phrases[id]?.[v] || v),
  );
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
 * The question set for a brand, plus `topMatches` — how many results the API
 * will return. Both are server-owned so the intro copy can state real numbers
 * without the block hardcoding either; a brand gaining a question, or
 * TOP_MATCHES changing, needs no block rebuild. Falls back to 3 for an older
 * API that doesn't send it.
 */
async function apiGetQuestions(base, retailer, brandKey) {
  const url = new URL(`${base}/api/questions`);
  if (retailer) url.searchParams.set('retailer', retailer);
  if (brandKey) url.searchParams.set('brand', brandKey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Questions request failed (${res.status})`);
  const data = await res.json();
  return { questions: data.questions, topMatches: data.topMatches || 3 };
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
function refinementAxes(cars) {
  const axes = [];

  for (const [key, label] of Object.entries(CONCEPT_LABELS)) {
    const have = cars.filter((c) => (c.features || []).includes(key)).length;
    if (have > 0 && have < cars.length) {
      axes.push({ id: `f:${key}`, label, have, test: (c) => (c.features || []).includes(key) });
    }
  }

  // Gearbox: a genuine dealbreaker, and a live split for MINI (~12% manual).
  for (const [value, label] of [['auto', 'Automatic'], ['manual', 'Manual']]) {
    const have = cars.filter((c) => c.transmission === value).length;
    if (have > 0 && have < cars.length) {
      axes.push({ id: `g:${value}`, label, have, test: (c) => c.transmission === value });
    }
  }

  // Colour, by its normalised name ("Grey"), each shade its own axis. Only
  // present on cars the detail lookup reached — a car with no colour simply
  // never matches a colour axis, which is the honest behaviour: we can't
  // claim it's the blue one.
  const shades = new Set(cars.map((c) => c.colour?.colour).filter(Boolean));
  for (const shade of shades) {
    const have = cars.filter((c) => c.colour?.colour === shade).length;
    if (have > 0 && have < cars.length) {
      axes.push({ id: `c:${shade}`, label: shade, have, test: (c) => c.colour?.colour === shade });
    }
  }

  const balance = (a) => Math.abs(a.have / cars.length - 0.5);
  return axes.sort((a, b) => balance(a) - balance(b) || a.label.localeCompare(b.label));
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
  intro.append(
    el('p', 'bmwm-kicker', 'The unofficial UK matchmaker'),
    el('h1', 'bmwm-title', copy.title),
    el('p', 'bmwm-lede', copy.lede({
      questions: count, matches: ctx.topMatches, retailer: ctx.retailerLabel,
    })),
  );
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
 * One result card.
 * `big` adds the "why it suits you" reasons; `compact` is the carousel tile —
 * same anatomy, but trades the blurb and reasons for a distance line.
 */
function matchCard(match, {
  big = false, compact = false, brand: brandKey = 'bmw',
  rejectOptions, rejectLabel, rejectPrompt,
} = {}) {
  const { car, score, reasons } = match;
  const card = el('article', `bmwm-card${big ? ' bmwm-card-big' : ''}${compact ? ' bmwm-card-compact' : ''}`);

  const media = el('div', 'bmwm-card-media');
  // "Images coming soon" placeholder, mirroring usedcars.bmw.co.uk's own PDP
  // for a photo-less listing: a white bold caption centred on the dark media
  // field. Every card surface (hero, "More at" tiles, "Worth the drive"
  // carousel) goes through matchCard, so this covers all image viewers. The
  // placeholder is hidden (CSS) once a real photo loads, and re-shown if one
  // fails to.
  const soon = el('span', 'bmwm-card-soon', 'Images coming soon');
  // Real retailer photo when the live feed supplied one; the line label sits
  // over it. Falls back to the "Images coming soon" placeholder above when
  // absent — same as the live site.
  if (car.photo) {
    media.classList.add('has-photo');
    const img = el('img', 'bmwm-card-photo');
    img.src = car.photo;
    img.alt = car.name;
    img.loading = 'lazy';
    // A broken image URL shouldn't leave a half-rendered card — drop back to
    // the "Images coming soon" placeholder, exactly as a photo-less car shows.
    img.addEventListener('error', () => {
      media.classList.remove('has-photo');
      img.remove();
    });
    media.append(img);
  }
  media.append(soon, el('span', 'bmwm-card-line', car.line));
  card.append(media);

  const body = el('div', 'bmwm-card-body');
  const head = el('div', 'bmwm-card-head');
  head.append(el('h3', 'bmwm-card-name', car.name));
  const badge = el('span', 'bmwm-score', `${score}%`);
  badge.title = 'Match score';
  head.append(badge);
  body.append(head);

  // Single used price when min === max (live stock), else the range.
  const price = car.priceMin === car.priceMax
    ? gbp(car.priceMin)
    : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`;
  const specs = el('p', 'bmwm-specs');
  // Paint, by its marketing name ("Legend Grey"), when the detail lookup got
  // one. It reads as a spec, but it's carrying more weight than that: when the
  // engine can't separate the cars, colour is very often the actual difference
  // between them — so it belongs on the card, not buried on the retailer's PDP.
  const paint = car.colour?.manufacturerColour || car.colour?.colour;
  // Compact tiles are narrow — the headline specs only, no 0–62/economy.
  const specBits = compact ? [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
    price,
  ] : [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
    paint,
    price,
    `0–62 ${car.zeroTo62}s`,
    car.fuel === 'ev' ? `${car.evRange} mi range` : `${car.mpg} mpg`,
  ];
  specs.textContent = specBits.filter(Boolean).join('  ·  ');
  body.append(specs);

  // The whole point of the carousel: how far away is it, and whose is it?
  // Distance comes from the live feed, so omit the line rather than invent
  // one if the feed didn't supply it.
  if (compact && car.distance != null) {
    const where = el('p', 'bmwm-distance');
    where.append(el('span', 'bmwm-distance-miles', distanceLabel(car.distance)));
    if (car.retailerName) where.append(el('span', null, ` · ${car.retailerName}`));
    body.append(where);
  }

  // Real used-car detail from the live feed, when present.
  const detailBits = [];
  if (car.plate) detailBits.push(`’${car.plate} reg`);
  if (car.mileage != null) detailBits.push(`${car.mileage.toLocaleString('en-GB')} miles`);
  if (detailBits.length) {
    body.append(el('p', 'bmwm-usedmeta', detailBits.join('  ·  ')));
  }

  if (!compact) body.append(el('p', 'bmwm-blurb', car.blurb));

  if (big && reasons.length) {
    const why = el('ul', 'bmwm-reasons');
    reasons.forEach((r) => why.append(el('li', null, r)));
    body.append(el('p', 'bmwm-why-label', 'Why it suits you'), why);
  }

  // Owning the trade-off: when the recommendation misses a stated want (it's
  // petrol and they asked for electric), the card says so itself, right under
  // the case for it — not only the page-level unmet note, which fires solely
  // when the whole pool is short. Hero card only: it's the one making the
  // "your perfect car" claim, and the compact tiles already state fuel and
  // shape in their spec line.
  if (big && match.tradeOffs?.length) {
    const { label } = TRADE_COPY[brandKey] || TRADE_COPY.bmw;
    body.append(
      el('p', 'bmwm-why-label bmwm-trade-label', label),
      el('p', 'bmwm-trade-text', tradeLines(brandKey, match.tradeOffs).join(' ')),
    );
  }

  // "Not this one" — the other half of choosing. Rejecting a car is the
  // highest-signal thing a buyer does, because it's a reaction to a real car
  // rather than an answer about a hypothetical one; the menu is what turns it
  // into something actionable (see rejectOptions). Only offered where a
  // caller supplies the options, so it appears in a tie and nowhere else.
  if (rejectOptions) {
    const options = rejectOptions(car);
    if (options.length) {
      const rejectWrap = el('div', 'bmwm-reject');
      const open = el('button', 'bmwm-reject-open', rejectLabel || 'Not this one');
      open.type = 'button';
      open.setAttribute('aria-expanded', 'false');
      const menu = el('div', 'bmwm-reject-menu');
      menu.hidden = true;
      menu.append(el('p', 'bmwm-reject-prompt', rejectPrompt || 'What put you off?'));
      options.forEach((o) => {
        const b = el('button', 'bmwm-reject-option', o.label);
        b.type = 'button';
        b.addEventListener('click', o.apply);
        menu.append(b);
      });
      open.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        open.setAttribute('aria-expanded', String(!menu.hidden));
      });
      rejectWrap.append(open, menu);
      body.append(rejectWrap);
    }
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
  const price = car.priceMin === car.priceMax
    ? gbp(car.priceMin)
    : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`;

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

  // Photo band (or the shared "Images coming soon" placeholder), with the line
  // label pinned in its corner — same treatment as matchCard's media.
  const media = el('div', 'bmwm-card-media bmwm-ptile-media');
  const soon = el('span', 'bmwm-card-soon', 'Images coming soon');
  if (car.photo) {
    media.classList.add('has-photo');
    const img = el('img', 'bmwm-card-photo');
    img.src = car.photo;
    img.alt = car.name;
    img.loading = 'lazy';
    img.addEventListener('error', () => { media.classList.remove('has-photo'); img.remove(); });
    media.append(img);
  }
  media.append(soon, el('span', 'bmwm-card-line', car.line));

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

  // Two compact-tile skeletons, matching the "More at <retailer>" 2-up row.
  const more = el('div', 'bmwm-more');
  for (let i = 0; i < 2; i += 1) {
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
function renderNearbySkeleton(ctx) {
  const band = el('section', 'bmwm-nearby-band');
  band.setAttribute('aria-busy', 'true');
  band.append(
    el('h3', 'bmwm-subhead bmwm-nearby-heading', 'WORTH THE DRIVE'),
    el('p', 'bmwm-lede bmwm-nearby-lede',
      `Not quite it? These are the closest matches at other retailers near ${ctx.retailerLabel}.`),
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
  // What the retailer's own stock couldn't offer. Half the picture: nothing is
  // said to the user until /api/nearby agrees (see agreedUnmet). An older API
  // that doesn't send the field leaves this empty, so it simply never fires.
  let retailerUnmet = {};
  try {
    ({
      matches, decisive = true, clusterSize = 1, unmet: retailerUnmet = {},
    } = await apiMatch(ctx.api, answers, ctx.retailer, ctx.brand));
  } catch {
    renderStatus(root, {
      kicker: 'Sorry',
      title: 'We couldn’t reach the matcher',
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
      el('h2', 'bmwm-title', 'No matches found'),
      el('p', 'bmwm-lede', `Nothing in ${ctx.retailerLabel}'s current stock fits those answers. Try loosening the budget or seating needs.`),
    );
  } else {
    // How many cars lead the page as EQUALS. One when the engine genuinely
    // picked a winner; otherwise the tie itself — never more, because the
    // headline counts these and "three fit you equally well" must not be said
    // over a third car that's four points back. Anything beyond this leads a
    // quieter "More at <retailer>" tier, so a near-miss is demoted rather than
    // dropped.
    const leadCount = decisive ? 1 : Math.min(clusterSize, matches.length);
    const lead = matches.slice(0, leadCount);
    const rest = matches.slice(leadCount);

    if (decisive) {
      // A single full-width hero, matching the "Your perfect <brand> is the …"
      // headline (co-equal heroes contradicted that claim). The car's name
      // already leads with the brand, so strip it.
      const model = lead[0].car.name.replace(new RegExp(`^${brandName} `), '');
      screen.append(el('h2', 'bmwm-title', `Your perfect ${brandName} is the ${model}`));
      const grid = el('div', 'bmwm-grid');
      grid.append(matchCard(lead[0], { big: true, brand: ctx.brand }));
      screen.append(grid);
    } else {
      // The engine couldn't separate these (see matchCars). Naming one "your
      // perfect BMW" would state a preference the model doesn't hold and bury
      // the rest of the tie, so the page says so and shows them at one weight —
      // then hands over: the refine panel lets the user separate them on the
      // things the questions never asked about.
      const title = el('h2', 'bmwm-title', copy.tiedTitle({ count: leadCount }));
      const lede = el('p', 'bmwm-lede', copy.tiedLede());
      screen.append(title, lede);
      screen.append(renderRefine(ctx, lead, title, lede));
    }

    // Whatever the lead didn't claim: smaller compact tiles in a static 2-up
    // row (distinct from the horizontal "Worth the drive" carousel of OTHER
    // retailers below). Same retailer as the lead, so "More at".
    if (rest.length) {
      const more = el('section', 'bmwm-more-band');
      more.append(
        el('h3', 'bmwm-subhead bmwm-nearby-heading', `MORE AT ${ctx.retailerLabel.toUpperCase()}`),
        el('p', 'bmwm-lede bmwm-nearby-lede',
          `Other cars in ${ctx.retailerLabel}'s stock that also fit your answers.`),
      );
      const moreGrid = el('div', 'bmwm-more');
      rest.forEach((m) => moreGrid.append(matchCard(m, { compact: true })));
      more.append(moreGrid);
      screen.append(more);
    }
  }

  // Cars at other nearby retailers — worth a drive if the local matches didn't
  // land. Fetched separately (the slow national search) so the hero above is
  // already on screen; a slim skeleton band holds the space until it resolves.
  // When it does: fill the carousel, or drop the band entirely if nothing came
  // back (empty result or a failed lookup — the section is a bonus, never an
  // error). Only shown when there are matches to be "not quite" about.
  let nearbyBand = null;
  if (matches.length) {
    nearbyBand = renderNearbySkeleton(ctx);
    screen.append(nearbyBand);
  }

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

  screen.append(el('p', 'bmwm-disclaimer',
    `An unofficial tool, not affiliated with or endorsed by ${(BRAND_COPY[ctx.brand] || BRAND_COPY.bmw).name}. Prices and specs are indicative, always check with a retailer.`));

  root.append(screen);

  // Phase two: now the page is painted, load the nearby carousel in the
  // background and swap it into the placeholder band (or drop the band).
  //
  // This is also the moment we learn whether a want the retailer couldn't meet
  // is genuinely unavailable, so the unmet note goes in here rather than with
  // the hero — we'd otherwise be claiming "no electric cars near you" while
  // still waiting to hear from the retailers that might have one.
  if (nearbyBand) {
    apiNearby(ctx.api, answers, ctx.retailer, ctx.brand).then(({ nearby, unmet }) => {
      // The user may have navigated away (retake/tweak) before this resolves;
      // only touch the page if it's still in the document.
      if (!nearbyBand.isConnected) return;
      const note = unmetNote(ctx, agreedUnmet(retailerUnmet, unmet));
      if (note) screen.insertBefore(note, screen.querySelector('.bmwm-grid'));
      if (nearby.length) fillNearbyBand(nearbyBand, ctx, nearby);
      else nearbyBand.remove();
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
    questions: [],
    // How many matches the results page will show, per the API (see
    // apiGetQuestions). Only the intro copy reads it.
    topMatches: 3,
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
      ctx.topMatches = meta.topMatches;
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

  await boot();
}
