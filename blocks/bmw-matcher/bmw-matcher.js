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

import { SHOW_IF, BUDGET_BANDS } from './quiz-meta.js';

const HASH_KEY = 'm';
const DEFAULT_API = 'http://localhost:8787';

/* ------------------------------ helpers ------------------------------ */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

async function apiGetQuestions(base, retailer) {
  const url = new URL(`${base}/api/questions`);
  if (retailer) url.searchParams.set('retailer', retailer);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Questions request failed (${res.status})`);
  const data = await res.json();
  return data.questions;
}

async function apiMatch(base, answers, retailer) {
  const res = await fetch(`${base}/api/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, retailer }),
  });
  if (!res.ok) throw new Error(`Match request failed (${res.status})`);
  return res.json();
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
    return valid && BUDGET_BANDS[answers.budget] ? answers : null;
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

const SPEC_LABELS = {
  hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
  coupe: 'Coupé', convertible: 'Convertible', mpv: 'Family carrier',
};
const FUEL_SPEC = { petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric' };

/* ------------------------------ screens ------------------------------ */

function renderIntro(root, ctx) {
  root.replaceChildren();
  const intro = el('div', 'bmwm-intro');
  // Count the questions a typical run sees ("Help me decide" shows the
  // conditional charging question, matching the longest common path).
  const count = visibleQuestions(ctx.questions, { fuel: 'open' }).length;
  intro.append(
    el('p', 'bmwm-kicker', 'The unofficial UK matchmaker'),
    el('h1', 'bmwm-title', 'Find your perfect BMW'),
    el('p', 'bmwm-lede',
      `Answer ${count} quick questions about your life, your miles and your budget, and we’ll match you with your top three from the current UK range with the reasons why. We hope it helps.`),
  );
  const start = el('button', 'bmwm-btn bmwm-btn-primary', 'Start the quiz');
  start.addEventListener('click', () => ctx.showQuestion(0));
  intro.append(start);
  root.append(intro);
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

  screen.append(el('h2', 'bmwm-question', q.title));
  if (q.help) screen.append(el('p', 'bmwm-help', q.help));

  const list = el('div', 'bmwm-options');
  list.setAttribute('role', q.multi ? 'group' : 'radiogroup');
  const optionButtons = [];

  const advance = () => {
    if (index + 1 < visibleQuestions(ctx.questions, ctx.answers).length) ctx.showQuestion(index + 1);
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
  // Real retailer photo when the live feed supplied one; the line label sits
  // over it. Falls back to the flat placeholder field (CSS) when absent.
  if (car.photo) {
    media.classList.add('has-photo');
    const img = el('img', 'bmwm-card-photo');
    img.src = car.photo;
    img.alt = car.name;
    img.loading = 'lazy';
    // A broken image URL shouldn't leave a half-rendered card.
    img.addEventListener('error', () => {
      media.classList.remove('has-photo');
      img.remove();
    });
    media.append(img);
  }
  media.append(el('span', 'bmwm-card-line', car.line));
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
  const specBits = [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
    price,
    `0–62 ${car.zeroTo62}s`,
    car.fuel === 'ev' ? `${car.evRange} mi range` : `${car.mpg} mpg`,
  ];
  specs.textContent = specBits.filter(Boolean).join('  ·  ');
  body.append(specs);

  // Real used-car detail from the live feed, when present.
  const detailBits = [];
  if (car.plate) detailBits.push(`’${car.plate} reg`);
  if (car.mileage != null) detailBits.push(`${car.mileage.toLocaleString('en-GB')} miles`);
  if (detailBits.length) {
    body.append(el('p', 'bmwm-usedmeta', detailBits.join('  ·  ')));
  }

  body.append(el('p', 'bmwm-blurb', car.blurb));

  if (big && reasons.length) {
    const why = el('ul', 'bmwm-reasons');
    reasons.forEach((r) => why.append(el('li', null, r)));
    body.append(el('p', 'bmwm-why-label', 'Why it suits you'), why);
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

async function renderResults(root, ctx, answers) {
  renderStatus(root, { kicker: 'Almost there', title: 'Finding your matches' });

  let matches;
  let contenders;
  try {
    ({ matches, contenders } = await apiMatch(ctx.api, answers, ctx.retailer));
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

  screen.append(el('p', 'bmwm-kicker', 'Your results'));

  if (matches.length === 0) {
    screen.append(
      el('h2', 'bmwm-title', 'No matches found'),
      el('p', 'bmwm-lede', 'Nothing in the current range fits those answers. Try loosening the budget or seating needs.'),
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

export default async function decorate(block) {
  // Read authored config (e.g. the "Retailer ID" row) before clearing the
  // block's children — the config rows live in the block's original markup.
  const retailer = retailerSite(block);
  const api = apiBase(block);

  block.replaceChildren();
  block.classList.add('bmwm');

  const ctx = { answers: {}, api, retailer, questions: [] };
  ctx.showIntro = () => renderIntro(block, ctx);
  ctx.showQuestion = (i) => renderQuestion(block, ctx, i);
  ctx.showResults = (answers, { updateHash = false } = {}) => {
    if (updateHash) {
      window.history.replaceState(null, '', `#${HASH_KEY}=${encodeAnswers(answers)}`);
    }
    renderResults(block, ctx, answers);
  };

  // The quiz definition lives behind the API, so load it before rendering.
  const boot = async () => {
    renderStatus(block, { kicker: 'The unofficial UK matchmaker', title: 'Loading the quiz' });
    try {
      ctx.questions = await apiGetQuestions(ctx.api, ctx.retailer);
    } catch {
      renderStatus(block, {
        kicker: 'Sorry',
        title: 'We couldn’t load the quiz',
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
