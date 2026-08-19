/*
 * Shared UI primitives for the vehicle-matcher block: the lowest-level, brand-/mode-agnostic
 * helpers every mode needs, with no dependency on the quiz, the engine client, or brand copy.
 */

/** Create an element with an optional class and text — the workhorse the whole
 * block builds its DOM with. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Small cardinals as words, for prose where a numeral reads oddly ("the three cars"
 * beats "the 3 cars"). Anything larger falls back to the numeral, which reads fine. */
export const CARDINALS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const cardinal = (n) => CARDINALS[n] ?? String(n);

/** Money, GBP, no pence. */
export const gbp = (n) => `£${n.toLocaleString('en-GB')}`;
