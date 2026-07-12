/*
 * BMW Matcher — Adobe Edge Delivery Services (EDS) block.
 *
 * EDS calls `decorate(block)` with the block's DOM element; everything
 * else (quiz state, scoring, results, share links) is handled here with
 * zero dependencies. The block also runs standalone — see index.html.
 *
 * Share links encode the quiz answers in the URL hash (#m=<base64url>),
 * so results re-render anywhere the block is mounted, no backend needed.
 */

import { QUESTIONS, BUDGET_BANDS } from './questions.js';
import { CARS } from './data.js';
import { matchCars } from './engine.js';

const HASH_KEY = 'm';

/* ------------------------------ helpers ------------------------------ */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function encodeAnswers(answers) {
  const json = JSON.stringify(answers);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeAnswers(encoded) {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const answers = JSON.parse(decodeURIComponent(escape(atob(b64))));
    // Minimal validation: every non-conditional question must be answered.
    const valid = QUESTIONS.every((q) => (q.showIf && !q.showIf(answers)) || answers[q.id] != null);
    return valid && BUDGET_BANDS[answers.budget] ? answers : null;
  } catch {
    return null;
  }
}

function answersFromHash() {
  const match = window.location.hash.match(new RegExp(`${HASH_KEY}=([A-Za-z0-9_-]+)`));
  return match ? decodeAnswers(match[1]) : null;
}

function visibleQuestions(answers) {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}

const gbp = (n) => `£${n.toLocaleString('en-GB')}`;

const SPEC_LABELS = {
  hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
  coupe: 'Coupé', convertible: 'Convertible', mpv: 'Family carrier',
};
const FUEL_SPEC = { petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric' };

/* ------------------------------ screens ------------------------------ */

function renderIntro(root, ctx) {
  root.replaceChildren();
  const intro = el('div', 'bmwm-intro');
  intro.append(
    el('p', 'bmwm-kicker', 'The unofficial UK matchmaker'),
    el('h1', 'bmwm-title', 'Find your perfect BMW'),
    el('p', 'bmwm-lede',
      `Answer ${visibleQuestions({ fuel: 'open' }).length} quick questions about your life, your miles and your budget — we’ll match you with your top three from the current UK range, and tell you exactly why.`),
  );
  const start = el('button', 'bmwm-btn bmwm-btn-primary', 'Start the quiz');
  start.addEventListener('click', () => ctx.showQuestion(0));
  intro.append(start);
  root.append(intro);
}

function renderQuestion(root, ctx, index) {
  const questions = visibleQuestions(ctx.answers);
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

  screen.append(el('h2', 'bmwm-question', q.title));
  if (q.help) screen.append(el('p', 'bmwm-help', q.help));

  const list = el('div', 'bmwm-options');
  list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
  const optionButtons = [];

  const advance = () => {
    if (index + 1 < visibleQuestions(ctx.answers).length) ctx.showQuestion(index + 1);
    else ctx.showResults(ctx.answers, { updateHash: true });
  };

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
      } else {
        ctx.answers[q.id] = opt.value;
        advance();
      }
    });
    optionButtons.push({ button: btn, value: opt.value });
    list.append(btn);
  });
  screen.append(list);

  const nav = el('div', 'bmwm-nav');
  const back = el('button', 'bmwm-btn bmwm-btn-ghost', 'Back');
  back.type = 'button';
  back.disabled = index === 0;
  back.addEventListener('click', () => ctx.showQuestion(index - 1));
  nav.append(back);

  const next = el('button', 'bmwm-btn bmwm-btn-primary', index + 1 === questions.length ? 'See my matches' : 'Next');
  next.type = 'button';
  if (q.multi) {
    next.disabled = selected.size === 0;
    next.addEventListener('click', advance);
    nav.append(next);
  }
  screen.append(nav);
  root.append(screen);
  screen.querySelector('.bmwm-question').setAttribute('tabindex', '-1');
  screen.querySelector('.bmwm-question').focus({ preventScroll: true });
}

function matchCard(match, big) {
  const { car, score, reasons } = match;
  const card = el('article', `bmwm-card${big ? ' bmwm-card-big' : ''}`);

  const media = el('div', 'bmwm-card-media');
  media.append(el('span', 'bmwm-card-line', car.line));
  card.append(media);

  const body = el('div', 'bmwm-card-body');
  const head = el('div', 'bmwm-card-head');
  head.append(el('h3', 'bmwm-card-name', car.name));
  const badge = el('span', 'bmwm-score', `${score}%`);
  badge.title = 'Match score';
  head.append(badge);
  body.append(head);

  const specs = el('p', 'bmwm-specs');
  const specBits = [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
    `${gbp(car.priceMin)}–${gbp(car.priceMax)}`,
    `0–62 ${car.zeroTo62}s`,
    car.fuel === 'ev' ? `${car.evRange} mi range` : `${car.mpg} mpg`,
  ];
  specs.textContent = specBits.join('  ·  ');
  body.append(specs);

  body.append(el('p', 'bmwm-blurb', car.blurb));

  if (big && reasons.length) {
    const why = el('ul', 'bmwm-reasons');
    reasons.forEach((r) => why.append(el('li', null, r)));
    body.append(el('p', 'bmwm-why-label', 'Why it suits you'), why);
  }

  card.append(body);
  return card;
}

function renderResults(root, ctx, answers) {
  const { matches, contenders } = matchCars(answers, CARS);
  root.replaceChildren();
  const screen = el('div', 'bmwm-screen bmwm-results');

  screen.append(el('p', 'bmwm-kicker', 'Your results'));

  if (matches.length === 0) {
    screen.append(
      el('h2', 'bmwm-title', 'That’s a tough brief…'),
      el('p', 'bmwm-lede', 'Nothing in the current range fits those answers — try loosening the budget or seating needs.'),
    );
  } else {
    screen.append(el('h2', 'bmwm-title', `Your perfect BMW is the ${matches[0].car.name.replace(/^BMW /, '')}`));
    const grid = el('div', 'bmwm-grid');
    matches.forEach((m, i) => grid.append(matchCard(m, i === 0 || true)));
    screen.append(grid);
  }

  if (contenders.length) {
    screen.append(el('h3', 'bmwm-subhead', 'Close contenders'));
    const strip = el('div', 'bmwm-contenders');
    contenders.forEach((m) => {
      const chip = el('div', 'bmwm-contender');
      chip.append(
        el('span', 'bmwm-contender-name', m.car.name),
        el('span', 'bmwm-contender-score', `${m.score}%`),
      );
      strip.append(chip);
    });
    screen.append(strip);
  }

  const actions = el('div', 'bmwm-actions');
  const share = el('button', 'bmwm-btn bmwm-btn-primary', 'Copy share link');
  share.type = 'button';
  share.addEventListener('click', async () => {
    const url = `${window.location.origin}${window.location.pathname}#${HASH_KEY}=${encodeAnswers(answers)}`;
    try {
      await navigator.clipboard.writeText(url);
      share.textContent = 'Link copied!';
    } catch {
      window.prompt('Copy your results link:', url);
    }
    setTimeout(() => { share.textContent = 'Copy share link'; }, 2000);
  });
  const tweak = el('button', 'bmwm-btn bmwm-btn-ghost', 'Tweak my answers');
  tweak.type = 'button';
  tweak.addEventListener('click', () => ctx.showQuestion(visibleQuestions(ctx.answers).length - 1));
  const retake = el('button', 'bmwm-btn bmwm-btn-ghost', 'Start over');
  retake.type = 'button';
  retake.addEventListener('click', () => {
    ctx.answers = {};
    window.history.replaceState(null, '', window.location.pathname);
    ctx.showIntro();
  });
  actions.append(share, tweak, retake);
  screen.append(actions);

  screen.append(el('p', 'bmwm-disclaimer',
    'An unofficial tool, not affiliated with or endorsed by BMW. Prices and specs are indicative — always check with a retailer.'));

  root.append(screen);
}

/* ------------------------------ decorate ------------------------------ */

export default function decorate(block) {
  block.replaceChildren();
  block.classList.add('bmwm');

  const ctx = { answers: {} };
  ctx.showIntro = () => renderIntro(block, ctx);
  ctx.showQuestion = (i) => renderQuestion(block, ctx, i);
  ctx.showResults = (answers, { updateHash = false } = {}) => {
    if (updateHash) {
      window.history.replaceState(null, '', `#${HASH_KEY}=${encodeAnswers(answers)}`);
    }
    renderResults(block, ctx, answers);
  };

  const shared = answersFromHash();
  if (shared) {
    ctx.answers = shared;
    ctx.showResults(shared);
  } else {
    ctx.showIntro();
  }
}
