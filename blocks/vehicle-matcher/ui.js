/*
 * Shared UI primitives for the vehicle-matcher block.
 *
 * Deliberately tiny and brand-/mode-agnostic: the lowest-level helpers that
 * every interface "mode" (see modes/) needs, with no dependency on the quiz,
 * the engine client, or any brand copy. Anything a second mode would obviously
 * reuse lives here; anything still coupled to the questions flow stays in
 * modes/questionnaire.js until a second mode actually needs it.
 */

/** Create an element with an optional class and text — the workhorse the whole
 * block builds its DOM with. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Small cardinals as words, for prose where a numeral would read oddly ("the
 * three cars" beats "the 3 cars"). Anything larger falls back to the numeral,
 * which is fine — it only reads awkwardly at small counts. */
export const CARDINALS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const cardinal = (n) => CARDINALS[n] ?? String(n);

/** Money, GBP, no pence. */
export const gbp = (n) => `£${n.toLocaleString('en-GB')}`;
