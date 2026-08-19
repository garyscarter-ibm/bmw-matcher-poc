/*
 * Shared brand-safe helpers for the game modes (Swipe and Knockout): display, deck, seed,
 * taste→answers inference, and reveal. Inference only emits observed values, never a rejected one.
 */

import { el, gbp } from '../ui.js';

/*
 * The client's "we don't really have this" threshold — below it a leader gets an
 * honest note. Mirror of WEAK_SCORE in ../vehicle-matcher.js and persona-check.mjs.
 */
export const WEAK_SCORE = 68;

/*
 * Colour shade → swatch hex for the card colour bar/tint and "Colour" taste bar (§11.4).
 * Keyed by the NORMALISED shade (not marketing names); unknown shades → neutral swatch.
 */
export const SHADE_HEX = {
  red: '#c0392b', orange: '#d35400', yellow: '#e2b100', green: '#1e8449',
  blue: '#2563a8', purple: '#6c3483', pink: '#c0536a', brown: '#7b5033',
  beige: '#c9b79c', white: '#f4f4f4', silver: '#c8ccce', grey: '#8a8f93',
  gray: '#8a8f93', black: '#2a2a2a',
};
export const NEUTRAL_SWATCH = '#c8ccce';

/**
 * Budget tiles for the seed step, quantising the engine's per-brand `budget` max into
 * round bands plus an open top. Each band is the [min, max] pair the engine expects.
 */
export function budgetBandsFromQuestion(budgetQ) {
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
export const gbpShort = (n) => (n % 1000 === 0 ? `£${n / 1000}k` : gbp(n));

/**
 * The engine's `primaryUse` options as the seed's "what's it for" tiles, so labels/subs
 * are the brand's own. Returns [{ value, label, sub }], empty if the question is missing.
 */
export function useTilesFromQuestion(useQ) {
  return (useQ?.options || []).map((o) => ({ value: o.value, label: o.label, sub: o.sub }));
}

/** In-place Fisher–Yates. Math.random is fine — this is the game surface, not
 * the reproducible engine (§4.2 build note). */
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/*
 * Stable re-order (not a filter) into three tiers, best first: unique photo (2),
 * shared-URL placeholder (1), no photo (0). `photoOf` is the caller's URL accessor.
 */
export function photosFirst(list, photoOf) {
  // Count each non-empty photo URL across the whole field, so a URL used by more
  // than one car can be recognised as a shared placeholder rather than a photo.
  const urlCounts = new Map();
  for (const item of list) {
    const url = photoOf(item);
    if (url) urlCounts.set(url, (urlCounts.get(url) || 0) + 1);
  }
  const rank = (item) => {
    const url = photoOf(item);
    if (!url) return 0;
    return urlCounts.get(url) > 1 ? 1 : 2;
  };
  // Stable partition into the three tiers, best (real photo) first. A plain
  // filter into three arrays preserves each tier's incoming order.
  const tiers = [[], [], []];
  for (const item of list) tiers[rank(item)].push(item);
  return [...tiers[2], ...tiers[1], ...tiers[0]];
}

/** The normalised shade for a car, or null. Prefers the structured shade the
 * enrichment set; falls back to lower-casing a marketing name's last word. */
export function shadeOf(car) {
  const shade = car.colour?.colour;
  if (shade && SHADE_HEX[shade.toLowerCase()]) return shade.toLowerCase();
  const name = car.colour?.manufacturerColour || (car.colours && car.colours[0]);
  if (!name) return null;
  // Marketing names end in the shade more often than not ("Chili Red").
  const last = String(name).trim().split(/\s+/).pop().toLowerCase();
  return SHADE_HEX[last] ? last : null;
}

/** Swatch hex for a card (neutral when the shade is unknown/unenriched). */
export const swatchFor = (car) => SHADE_HEX[shadeOf(car)] || NEUTRAL_SWATCH;

/** Price line for a card: single used price, or a grouped range. */
export function priceLabel(car) {
  if (car.listingCount > 1 && car.priceFrom !== car.priceTo) return `from ${gbp(car.priceFrom)}`;
  if (car.priceMin === car.priceMax) return gbp(car.priceMin);
  return `${gbp(car.priceMin)}–${gbp(car.priceMax)}`;
}

/** Cap-first a value for display ("electric" → "Electric"). */
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/*
 * Approximate registration Date from whatever the feed gives: exact `firstReg`, then
 * `year` (1 March midpoint), then the DVLA age code from `plate`. Null if none (no guess).
 */
export function registrationDate(car) {
  if (!car) return null;
  // 1. Exact first-registration date, if the feed parsed one.
  if (typeof car.firstReg === 'string' && car.firstReg.includes('/')) {
    const [d, m, y] = car.firstReg.split('/').map((n) => parseInt(n, 10));
    if (y > 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return new Date(y, m - 1, d);
  }
  // 2. A plain registration year.
  if (Number.isFinite(car.year) && car.year > 1990) return new Date(car.year, 2, 1);
  // 3. Decode the DVLA age identifier out of the plate.
  const code = plateAgeCode(car.plate);
  if (code != null) {
    if (code >= 1 && code <= 50) return new Date(2000 + code, 2, 1); // March
    if (code >= 51 && code <= 99) return new Date(2000 + code - 50, 8, 1); // September
  }
  return null;
}

/*
 * Age in whole (floored) years from registration date to `now`, like a person states
 * their age. Null when the date is unknown. `now` is injectable so the function is testable.
 */
export function ageInYears(car, now = new Date()) {
  const reg = registrationDate(car);
  if (!reg) return null;
  let years = now.getFullYear() - reg.getFullYear();
  // Not yet reached this year's registration anniversary → one fewer.
  const beforeAnniversary = now.getMonth() < reg.getMonth()
    || (now.getMonth() === reg.getMonth() && now.getDate() < reg.getDate());
  if (beforeAnniversary) years -= 1;
  return years < 0 ? 0 : years;
}

/*
 * Pull the two-digit DVLA age code from a plate of any brand shape (bare "23",
 * "23 FRD", or full VRM "AB12 CDE"): first run of letters, then two digits. 1-99 or null.
 */
function plateAgeCode(plate) {
  if (typeof plate !== 'string') return null;
  const s = plate.trim().toUpperCase();
  // Leading letters (0-2 for a modern VRM, 0 for a bare code), then two digits.
  const m = s.match(/^[A-Z]*?(\d{2})/);
  if (!m) return null;
  const code = parseInt(m[1], 10);
  return code >= 1 && code <= 99 ? code : null;
}

/*
 * The modal value in a list with its share of the total: {value, count, share}, share
 * 0–1. Ties break to first seen. Used for the taste bars.
 */
export function modal(values) {
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

/** Distinct values ranked by frequency: [{value, count}], most-kept first. */
export function rankByFrequency(values) {
  const counts = new Map();
  for (const v of values) {
    if (v == null) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
}

/*
 * Turn a WEIGHTED bag of liked cars (once per unit of preference) plus the seed into the
 * engine's answer object. Infer only taste keys, err toward OMITTING, emit only observed values.
 */
export function likesToAnswers(liked, seed) {
  const answers = { ...seed };
  if (liked.length === 0) return answers;

  // Body / fuel: distinct values among liked cars, kept only once at least two "votes"
  // agree, so a single stray like isn't read as a want (thin data → omit).
  const bodyByFreq = rankByFrequency(liked.map((c) => c.body));
  const fuelByFreq = rankByFrequency(liked.map((c) => c.fuel));
  if (liked.length >= 2) {
    const bodies = bodyByFreq.filter((b) => b.count >= 2).map((b) => b.value);
    const fuels = fuelByFreq.filter((f) => f.count >= 2).map((f) => f.value);
    if (bodies.length) answers.bodyStyles = bodies;
    if (fuels.length) answers.fuel = fuels;
  }

  // Style (1–5, sent as a STRING per server/questions.js): sporty skew → 4/5 on sporty
  // bodies or hot trims; else leave the engine's default rather than assert "balanced".
  const sportyBodies = liked.filter((c) => /coupe|convertible|roadster/i.test(c.body || '')).length;
  const sportyTrims = liked.filter((c) => /\b(jcw|cooper s|m\d|competition|gts?)\b/i.test(
    `${c.name || ''} ${c.line || ''}`,
  )).length;
  const sportyShare = (sportyBodies + sportyTrims) / liked.length;
  if (sportyShare >= 0.5) answers.style = '5';
  else if (sportyShare >= 0.25) answers.style = '4';

  // Priorities (max 2), derived from the pattern: consistent colour/body → image,
  // economical fuel → economy, sporty skew → performance.
  const priorities = [];
  const colourModal = modal(liked.map((c) => shadeOf(c)).filter(Boolean));
  const bodyModal = bodyByFreq[0];
  const looksLed = (colourModal && colourModal.share >= 0.5)
    || (bodyModal && bodyModal.count / liked.length >= 0.6);
  if (looksLed) priorities.push('image');
  const economical = liked.filter((c) => c.fuel === 'ev' || c.fuel === 'phev').length;
  if (economical / liked.length >= 0.5) priorities.push('economy');
  if (sportyShare >= 0.5 && !priorities.includes('performance')) priorities.push('performance');
  if (priorities.length) answers.priorities = priorities.slice(0, 2);

  // Charging is only a real question if the inferred fuel leans electric — and
  // then we say "open to it" rather than guessing where they'd charge.
  const fuels = answers.fuel || [];
  if (fuels.includes('ev') || fuels.includes('phev')) answers.charging = 'either';

  // people: derived from the seed use case, not from taste (a player can fancy a
  // two-seater and still need to seat a family — §4.1).
  if (seed.primaryUse === 'family') answers.people = 'family';

  // mileage is deliberately omitted — the game can't read annual miles; the
  // engine's own default stands.
  return answers;
}

/*
 * Swipe game's inference (§5.3): each KEPT car is one unit of preference. A thin
 * wrapper over likesToAnswers so the swipe mode keeps its familiar name.
 */
export function swipesToAnswers(kept, seed) {
  return likesToAnswers(kept, seed);
}

/*
 * Knockout inference: a car's voice scales with how far it advanced — repeat it `weight`
 * times (rounds survived) into the bag, then feed the SAME likesToAnswers machinery.
 */
export function bracketToAnswers(rounds, seed) {
  const totalRounds = rounds.length ? Math.max(...rounds.map((r) => r.roundIndex)) + 1 : 0;
  // survived[carId] = how many rounds this car won (0 if it lost its first).
  const survived = new Map();
  const carById = new Map();
  for (const m of rounds) {
    carById.set(idOf(m.winner), m.winner);
    carById.set(idOf(m.loser), m.loser);
    survived.set(idOf(m.winner), (survived.get(idOf(m.winner)) || 0) + 1);
    // A loser that never appears as a winner keeps weight 1 (see below).
    if (!survived.has(idOf(m.loser))) survived.set(idOf(m.loser), 0);
  }
  // Weight = wins + 1, so every car that played gets at least one ballot and the
  // champion (won `totalRounds` matchups) gets the heaviest. Clamp defensively.
  const liked = [];
  for (const [id, wins] of survived) {
    const car = carById.get(id);
    const weight = Math.max(1, Math.min(wins + 1, totalRounds + 1));
    for (let i = 0; i < weight; i += 1) liked.push(car);
  }
  return likesToAnswers(liked, seed);
}

/** Stable-ish identity for a preview car: the PDP link is unique per listing;
 * fall back to name+price so a feed without links still de-dupes sanely. */
export function idOf(car) {
  return car?.link || `${car?.name || ''}|${car?.priceMin ?? ''}`;
}

/* ------------------------------ reveal ------------------------------ */

/*
 * Per-brand celebration character. The JS owns one dial only — particle COUNT; colour
 * and easing are the stylesheet's job. Unlisted brands fall back to the restrained default.
 */
const BRAND_CELEBRATION = {
  bmw: { count: 26 },
  ford: { count: 26 },
  mini: { count: 40 },
  honda: { count: 36 },
  motorrad: { count: 36 },
  // Ferrari: a measured, slightly-raised burst — a touch above BMW's restraint, but
  // dignified; the sparkle comes from the red spot and composed --vm-ease, not the count.
  ferrari: { count: 30 },
};
const DEFAULT_CELEBRATION = { count: 26 };

/*
 * The shared celebration burst on a result reveal, one implementation for both games. JS
 * varies only particle COUNT; the caller gates on prefers-reduced-motion. `host` position:relative.
 */
export function celebrate(host, { brand } = {}) {
  const { count } = BRAND_CELEBRATION[brand] || DEFAULT_CELEBRATION;
  const layer = el('div', 'vm-mingle-confetti');
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) {
    // Plain confetti bits, no glyphs — character is the count + the stylesheet's colour.
    const bit = el('span', 'vm-mingle-confetti-bit');
    bit.style.left = `${(i / count) * 100}%`;
    // Stagger across a wider window than the old 6-step cycle, so the burst
    // rains rather than dropping in one sheet.
    bit.style.animationDelay = `${(i % 10) * 0.05}s`;
    layer.append(bit);
  }
  host.append(layer);
}
