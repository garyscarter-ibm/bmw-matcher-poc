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
