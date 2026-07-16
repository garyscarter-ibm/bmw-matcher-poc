/*
 * Client-only quiz metadata.
 *
 * The quiz definition itself is fetched from the API (GET /api/questions), but
 * two things can't cross JSON and are needed on the client:
 *
 *  - SHOW_IF: the conditional-visibility predicates, keyed by question id.
 *    The API marks conditional questions with `conditional: true`; the block
 *    looks up the matching predicate here to decide whether to show them.
 *  - BUDGET_BANDS: needed synchronously to decode/validate a shared #m=… link
 *    before any network request completes.
 *
 * This is deliberately NOT the car dataset or the scoring weights — those stay
 * server-side. Keep SHOW_IF in sync with the `showIf` functions in
 * server/questions.js (there's only one conditional question today).
 */

/** Conditional-visibility predicates, keyed by question id. */
export const SHOW_IF = {
  charging: (a) => a.fuel === 'ev' || a.fuel === 'phev' || a.fuel === 'open',
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
 * Short pill summaries of a chosen answer, keyed by question id then value.
 * These are deliberately terse noun-phrases ("Home charging", "Balanced") — a
 * *record* of the choice, not the option's own prompt text ("Yes, at home",
 * "A bit of both"), which reads oddly as a summary. Kept client-side (like
 * SHOW_IF) since the option labels themselves live server-side in the fetched
 * quiz. Keep the values in sync with server/questions.js option values.
 *
 * `budget` is derived from BUDGET_BANDS below rather than listed here, and the
 * multi-select questions (bodyStyles, priorities) collapse to "First +N" in
 * pillFor — so this map only needs the single-select questions.
 */
export const PILL_LABEL = {
  fuel: {
    petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric', open: 'Any fuel',
  },
  charging: { home: 'Home charging', work: 'Work charging', none: 'Public charging' },
  primaryUse: {
    city: 'City driving', commute: 'Commuting', family: 'Family duties',
    roadtrips: 'Road trips', fun: 'Weekend fun',
  },
  people: { solo: 'Just me', family: 'Small family', crew: '5+ seats' },
  boot: { small: 'Small boot', medium: 'Medium boot', big: 'Big boot' },
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

/**
 * A short pill summary of the current answer to `question`, or null if it isn't
 * answered yet. `question` is the fetched quiz object (has id, multi, options);
 * `answers` is the running ctx.answers.
 *   single-select → PILL_LABEL[id][value] (or the raw value as a fallback)
 *   budget        → derived band, e.g. "£50–70k"
 *   multi-select  → "First +N" (e.g. "SUV +1"), or "Any body" when 'any' picked
 */
export function pillFor(question, answers) {
  const { id, multi } = question;
  const value = answers[id];
  if (value == null || (multi && value.length === 0)) return null;

  if (id === 'budget') {
    const band = BUDGET_BANDS[value];
    return band ? bandLabel(band) : null;
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
