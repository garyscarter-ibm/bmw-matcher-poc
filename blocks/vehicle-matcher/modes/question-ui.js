/*
 * Shared question widgets. Coupling is inverted so a widget writes into a given
 * answers object and fires a callback, knowing nothing about the screen it's in.
 */

import { SHOW_IF } from '../quiz-meta.js';
import { el, gbp } from '../ui.js';

/** Is question `q` shown given the current answers? Uses SHOW_IF by id. */
export function isVisible(q, answers) {
  if (!q.conditional) return true;
  const predicate = SHOW_IF[q.id];
  return predicate ? predicate(answers) : true;
}

export function visibleQuestions(questions, answers) {
  return questions.filter((q) => isVisible(q, answers));
}

/**
 * Format a slider value for its readout per the question's `format` hint (gbp/int
 * with optional unit). At a `plusAtMax` slider's ceiling, append "+".
 */
export function formatSliderValue(value, q) {
  const base = q.format === 'gbp' ? gbp(value) : `${value.toLocaleString('en-GB')}${q.unit || ''}`;
  return q.plusAtMax && value >= q.max ? `${base}+` : base;
}

/** Readout for a dual-thumb range slider, e.g. "£40,000 – £75,000". */
export function formatRange([lo, hi], q) {
  return `${formatSliderValue(lo, q)} – ${formatSliderValue(hi, q)}`;
}

/**
 * A dual-thumb range slider (budget) writing [min, max] to answers[q.id]. onChange
 * fires on every commit, including the immediate initial persist so Next enables without a drag.
 */
export function renderRangeSlider(list, q, answers, { onChange } = {}) {
  const stored = answers[q.id];
  const start = Array.isArray(stored) && stored.length === 2
    ? [Number(stored[0]), Number(stored[1])]
    : (Array.isArray(q.default) ? [...q.default] : [q.min, q.max]);
  let [lo, hi] = [Math.min(...start), Math.max(...start)];
  // Persist immediately so Next is enabled even without a drag.
  answers[q.id] = [lo, hi];

  const readout = el('output', 'vm-slider-value', formatRange([lo, hi], q));

  const track = el('div', 'vm-range');
  const fill = el('div', 'vm-range-fill');
  const mkInput = (cls, label, value) => {
    const input = el('input', `vm-slider-input ${cls}`);
    input.type = 'range';
    input.min = String(q.min);
    input.max = String(q.max);
    input.step = String(q.step);
    input.value = String(value);
    input.setAttribute('aria-label', label);
    input.setAttribute('aria-valuetext', formatSliderValue(value, q));
    return input;
  };
  const minInput = mkInput('vm-range-min', 'Minimum budget', lo);
  const maxInput = mkInput('vm-range-max', 'Maximum budget', hi);

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
    answers[q.id] = [lo, hi];
    const text = formatRange([lo, hi], q);
    readout.textContent = text;
    minInput.setAttribute('aria-valuetext', formatSliderValue(lo, q));
    maxInput.setAttribute('aria-valuetext', formatSliderValue(hi, q));
    paintFill();
    onChange?.();
  };
  minInput.addEventListener('input', sync);
  maxInput.addEventListener('input', sync);

  paintFill();
  track.append(fill, minInput, maxInput);

  const bounds = el('div', 'vm-slider-bounds');
  bounds.append(
    el('span', 'vm-slider-min', formatSliderValue(q.min, q)),
    el('span', 'vm-slider-max', formatSliderValue(q.max, q)),
  );

  list.append(readout, track, bounds);
}

/**
 * Option buttons for a multi/single-select question as a role-carrying `.vm-options`
 * list. Returns the live `selected` Set so the caller owns commit; onChange fires on any mutation, onPick after a single-select tap.
 * @returns {{ list: HTMLElement, selected: Set }}
 */
export function renderOptionList(q, answers, { onChange, onPick } = {}) {
  const selected = new Set(
    q.multi ? (answers[q.id] || []) : (answers[q.id] != null ? [answers[q.id]] : []),
  );
  const list = el('div', 'vm-options');
  // A slider is a single labelled input (its own role), not a radio/checkbox
  // group — only an option list is a group.
  list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
  const optionButtons = [];

  q.options.forEach((opt) => {
    const btn = el('button', 'vm-option');
    btn.type = 'button';
    btn.setAttribute('role', q.multi ? 'checkbox' : 'radio');
    btn.setAttribute('aria-checked', String(selected.has(opt.value)));
    if (selected.has(opt.value)) btn.classList.add('is-selected');
    btn.append(el('span', 'vm-option-label', opt.label));
    if (opt.sub) btn.append(el('span', 'vm-option-sub', opt.sub));
    btn.addEventListener('click', () => {
      if (q.multi) {
        if (selected.has(opt.value)) selected.delete(opt.value);
        else {
          if (opt.value === 'any') selected.clear();
          else selected.delete('any');
          if (q.max && selected.size >= q.max) return;
          selected.add(opt.value);
        }
        answers[q.id] = [...selected];
        optionButtons.forEach(({ button, value }) => {
          button.classList.toggle('is-selected', selected.has(value));
          button.setAttribute('aria-checked', String(selected.has(value)));
        });
        onChange?.();
      } else {
        answers[q.id] = opt.value;
        // Paint the selected state here for modes that keep questions on screen
        // (podium); the questionnaire auto-advances so it never sees it. One button on.
        selected.clear();
        selected.add(opt.value);
        optionButtons.forEach(({ button, value }) => {
          button.classList.toggle('is-selected', value === opt.value);
          button.setAttribute('aria-checked', String(value === opt.value));
        });
        onChange?.();
        onPick?.();
      }
    });
    optionButtons.push({ button: btn, value: opt.value });
    list.append(btn);
  });

  return { list, selected };
}
