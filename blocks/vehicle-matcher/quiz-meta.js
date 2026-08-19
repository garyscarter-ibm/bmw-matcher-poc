/*
 * Client-only quiz metadata that can't cross JSON: SHOW_IF predicates and BUDGET_BANDS
 * (needed synchronously to validate a shared #m=… link). Keep in sync with server/questions.js.
 */

/**
 * Conditional-visibility predicates by question id; mirror of server/questions.js
 * `showIf`. Show charging when an electric-adjacent fuel is picked or fuel is unset.
 */
export const SHOW_IF = {
  charging: (a) => {
    const f = a.fuel;
    const picks = Array.isArray(f) ? f : (f != null ? [f] : []);
    return picks.length === 0 || picks.some((v) => v === 'ev' || v === 'phev' || v === 'open');
  },
  // MINI-only: door count only matters for the Hatch, so ask it once a hatchback
  // (or "any") is in play. Mirror of the doors `showIf` in server/brands.js.
  doors: (a) => {
    const b = a.bodyStyles;
    const picks = Array.isArray(b) ? b : (b != null ? [b] : []);
    return picks.length === 0 || picks.some((v) => v === 'hatchback' || v === 'any');
  },
};

/** Budget bands → [min, max] GBP. Mirror of server/questions.js BUDGET_BANDS. */
export const BUDGET_BANDS = {
  b1: [0, 35000],
  b2: [35000, 50000],
  b3: [50000, 70000],
  b4: [70000, 100000],
  b5: [100000, 250000],
};

/*
 * Terse pill summaries of a chosen answer, keyed by question id then value (a
 * record of the choice, not the prompt). Single-select only; keep values in sync with server/questions.js.
 */
export const PILL_LABEL = {
  fuel: {
    petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric', open: 'Any fuel',
  },
  charging: {
    either: 'Home or work charging', home: 'Home charging', work: 'Work charging', none: 'Public charging',
  },
  primaryUse: {
    city: 'City driving', commute: 'Commuting', family: 'Family duties',
    roadtrips: 'Road trips', fun: 'Weekend fun',
  },
  people: { solo: 'Just me', family: 'Small family', crew: '5+ seats' },
  // Bespoke MINI-only questions (see brands.js questions.add); harmless on BMW.
  miniVibe: { classic: 'Classic', exclusive: 'Exclusive', sport: 'Sport' },
  doors: { 3: '3-door', 5: '5-door', either: 'Any doors' },
  // BMW keeps mileage/style; MINI no longer asks them (dropped in brands.js), so
  // these entries are only ever reached for BMW now.
  mileage: {
    low: 'Under 6k mi/yr', mid: '6–12k mi/yr', high: '12–20k mi/yr', vhigh: '20k+ mi/yr',
  },
  style: {
    1: 'Comfort', 2: 'Comfort-leaning', 3: 'Balanced', 4: 'Sporty-leaning', 5: 'Sporty',
  },
  // Per-value labels for the multi-select body styles; priorities reuse the
  // option label as-is (they're already short), so it has no entry here.
  bodyStyles: {
    hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
    coupe: 'Coupé', convertible: 'Convertible', mpv: 'Family carrier', any: 'Any body',
  },
};

/** Short priorities labels (multi-select) — terser than the option prompts. */
const PRIORITY_LABEL = {
  economy: 'Running costs', performance: 'Performance', comfort: 'Comfort',
  tech: 'Tech', image: 'Style',
};

/** Money as a compact "£50–70k" band label (min 0 renders as "Under £Xk"). */
function bandLabel([min, max]) {
  const k = (n) => `£${Math.round(n / 1000)}k`;
  if (!min) return `Under ${k(max)}`;
  if (max >= 250000) return `${k(min)}+`;
  return `${k(min)}–${Math.round(max / 1000)}k`;
}

/** A single slider budget as "£62k" (or "£150k+" at the slider ceiling). */
function budgetValueLabel(value, question) {
  const k = `£${Math.round(value / 1000)}k`;
  return question?.plusAtMax && value >= question.max ? `${k}+` : k;
}

/** A dual-thumb budget range as "£40–75k" ("£40k+" when max hits the ceiling). */
function budgetRangeLabel([lo, hi], question) {
  const k = (n) => `£${Math.round(n / 1000)}k`;
  if (question?.plusAtMax && hi >= question.max) return `${k(lo)}+`;
  return `${k(lo)}–${Math.round(hi / 1000)}k`;
}

/** Annual mileage number as "12,000 mi/yr" (or "25,000+ mi/yr" at the ceiling). */
function mileageValueLabel(value, question) {
  const n = value.toLocaleString('en-GB');
  return question?.plusAtMax && value >= question.max ? `${n}+ mi/yr` : `${n} mi/yr`;
}

/**
 * A short pill summary of the current answer to `question`, or null if unanswered.
 * Dispatches by id/type: budget → band, multi-select → "First +N", else PILL_LABEL.
 */
export function pillFor(question, answers) {
  const { id, multi } = question;
  const value = answers[id];
  if (value == null || (multi && value.length === 0)) return null;

  if (id === 'budget') {
    // Dual-thumb range → "£40–75k"; a bare number (earlier shape) → "£62k";
    // legacy shared links may still carry a b1–b5 band key.
    if (Array.isArray(value)) return budgetRangeLabel(value, question);
    if (typeof value === 'number') return budgetValueLabel(value, question);
    const band = BUDGET_BANDS[value];
    return band ? bandLabel(band) : null;
  }

  if (id === 'mileage' && typeof value === 'number') {
    return mileageValueLabel(value, question);
  }

  if (multi) {
    const values = Array.isArray(value) ? value : [value];
    const label = (v) => (id === 'priorities'
      ? (PRIORITY_LABEL[v] || v)
      : (PILL_LABEL[id]?.[v] || v));
    if (values.includes('any')) return PILL_LABEL[id]?.any || 'Any';
    const [first, ...rest] = values;
    return rest.length ? `${label(first)} +${rest.length}` : label(first);
  }

  return PILL_LABEL[id]?.[value] || String(value);
}
