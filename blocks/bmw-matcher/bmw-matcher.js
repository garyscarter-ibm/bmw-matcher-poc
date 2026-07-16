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

/**
 * Cars at other nearby retailers — a separate, slower request than /api/match
 * (a national distance-sorted search) so the hero matches can render first.
 * The section is a bonus, so any failure resolves to an empty list rather than
 * throwing: the caller just omits the "Worth the drive" section.
 */
async function apiNearby(base, answers, retailer) {
  try {
    const res = await fetch(`${base}/api/nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, retailer }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.nearby) ? data.nearby : [];
  } catch {
    return [];
  }
}

/**
 * The configured retailer's current top matches for the quiz's live "best
 * guess" drawer — a wider slice than /api/match, refetched as answers change.
 * Like apiNearby it NEVER throws: a failed preview must never break the quiz,
 * so any error/non-ok resolves to an empty list and the drawer just keeps its
 * last state.
 */
async function apiPreview(base, answers, retailer) {
  try {
    const res = await fetch(`${base}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, retailer }),
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
      `Answer ${count} quick questions about your life, your miles and your budget, and we’ll match you with your top three approved-used cars at ${ctx.retailerLabel}, with the reasons why. We hope it helps.`),
  );
  const start = el('button', 'bmwm-btn bmwm-btn-primary', 'Start the quiz');
  start.addEventListener('click', () => ctx.showQuestion(0));
  intro.append(start);
  root.append(intro);
}

/* --------------------------- live preview drawer --------------------------- */

// How long after an answer changes before the preview refetches. Multi-select
// rapid taps collapse into one call; a fresh answer resets the timer.
const PREVIEW_DEBOUNCE_MS = 250;
// Placeholder tiles shown while the first preview for a given answer set loads
// and we have nothing cached to show yet.
const PREVIEW_SKELETON_TILES = 3;

/** Can the engine score these answers yet? It hard-requires a valid budget. */
function canPreview(ctx) {
  return !!BUDGET_BANDS[ctx.answers.budget];
}

/**
 * (Re)fill the drawer's bar label + panel from ctx.preview, in place. One path
 * shared by the debounced refresh and a freshly-built drawer (on question
 * advance), so both render identically.
 */
function paintPreview(section, ctx) {
  const { matches, open, loading } = ctx.preview;
  const bar = section.querySelector('.bmwm-preview-bar');
  const label = section.querySelector('.bmwm-preview-label');
  const panel = section.querySelector('.bmwm-preview-panel');

  // Bar label reflects state: pre-budget (nothing to score) vs a live count.
  const scored = canPreview(ctx);
  label.textContent = scored && matches.length
    ? `Best guess so far (${matches.length})`
    : 'Best guess so far';
  // Nothing to open before a budget is picked — keep the bar inert then.
  bar.disabled = !scored;

  bar.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;

  const track = panel.querySelector('.bmwm-preview-track');
  track.replaceChildren();
  if (!scored) {
    panel.querySelector('.bmwm-preview-note').textContent = 'Pick a budget to see your matches.';
    return;
  }
  if (loading && matches.length === 0) {
    panel.querySelector('.bmwm-preview-note').textContent = '';
    for (let i = 0; i < PREVIEW_SKELETON_TILES; i += 1) {
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
    return;
  }
  if (matches.length === 0) {
    panel.querySelector('.bmwm-preview-note').textContent = 'Nothing fits those answers yet — try loosening them.';
    return;
  }
  panel.querySelector('.bmwm-preview-note').textContent = '';
  matches.forEach((m) => track.append(matchCard(m, { compact: true })));
}

/**
 * Build the collapsible "best guess" drawer for the quiz screen: a bar that
 * toggles a horizontal track of compact result tiles (the same card the results
 * carousel uses). State (open/closed, last matches) lives on ctx.preview so it
 * survives the per-question re-render. Returns the <section>.
 */
function renderPreviewDrawer(ctx) {
  const section = el('section', 'bmwm-preview');

  const bar = el('button', 'bmwm-preview-bar');
  bar.type = 'button';
  bar.setAttribute('aria-controls', 'bmwm-preview-panel');
  bar.append(
    el('span', 'bmwm-preview-label', 'Best guess so far'),
    el('span', 'bmwm-preview-caret', ''),
  );

  const panel = el('div', 'bmwm-preview-panel');
  panel.id = 'bmwm-preview-panel';
  panel.append(el('p', 'bmwm-preview-note', ''), el('div', 'bmwm-nearby bmwm-preview-track'));

  bar.addEventListener('click', () => {
    if (!canPreview(ctx)) return;
    ctx.preview.open = !ctx.preview.open;
    paintPreview(section, ctx);
  });

  section.append(bar, panel);
  paintPreview(section, ctx);
  return section;
}

/**
 * Debounced, latest-wins preview refresh. Schedules a refetch of the retailer's
 * top matches for the current answers and repaints the on-screen drawer when it
 * lands — unless a newer schedule has superseded it (seq guard) or the drawer
 * has been torn down (navigated away). A no-op until a budget is chosen.
 */
function schedulePreviewRefresh(ctx) {
  if (!canPreview(ctx)) return;
  clearTimeout(ctx.previewTimer);
  ctx.previewTimer = setTimeout(() => {
    const seq = (ctx.preview.seq += 1);
    ctx.preview.loading = true;
    // Repaint so the drawer shows its skeleton while this first load is in
    // flight (no-op visually if we already have matches to keep showing).
    const live = document.querySelector('.bmwm-preview');
    if (live) paintPreview(live, ctx);

    const answers = { ...ctx.answers };
    apiPreview(ctx.api, answers, ctx.retailer).then((matches) => {
      // A newer answer already superseded this request — drop the stale result.
      if (seq !== ctx.preview.seq) return;
      ctx.preview.matches = matches;
      ctx.preview.loading = false;
      const section = document.querySelector('.bmwm-preview');
      if (section && section.isConnected) paintPreview(section, ctx);
    });
  }, PREVIEW_DEBOUNCE_MS);
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

  // Live "best guess" drawer, pinned below the nav. Built from ctx.preview so
  // it paints the last known guess instantly on advance, then refreshes.
  screen.append(renderPreviewDrawer(ctx));

  root.append(screen);
  screen.querySelector('.bmwm-question').setAttribute('tabindex', '-1');
  screen.querySelector('.bmwm-question').focus({ preventScroll: true });

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
function matchCard(match, { big = false, compact = false } = {}) {
  const { car, score, reasons } = match;
  const card = el('article', `bmwm-card${big ? ' bmwm-card-big' : ''}${compact ? ' bmwm-card-compact' : ''}`);

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
  // Compact tiles are narrow — the headline specs only, no 0–62/economy.
  const specBits = compact ? [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
    price,
  ] : [
    SPEC_LABELS[car.body],
    FUEL_SPEC[car.fuel],
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
  try {
    ({ matches } = await apiMatch(ctx.api, answers, ctx.retailer));
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
      el('p', 'bmwm-lede', `Nothing in ${ctx.retailerLabel}'s current stock fits those answers. Try loosening the budget or seating needs.`),
    );
  } else {
    // #1 is the recommendation — a single full-width hero, matching the
    // "Your perfect BMW is the …" headline (three co-equal heroes contradicted
    // that claim). #2/#3 drop to a quieter "More at <retailer>" tier below.
    screen.append(el('h2', 'bmwm-title', `Your perfect BMW is the ${matches[0].car.name.replace(/^BMW /, '')}`));
    const grid = el('div', 'bmwm-grid');
    grid.append(matchCard(matches[0], { big: true }));
    screen.append(grid);

    // Runners-up: the other local matches, as smaller compact tiles in a
    // static 2-up row (distinct from the horizontal "Worth the drive" carousel
    // of OTHER retailers below). Same retailer as the hero, so "More at".
    const runnersUp = matches.slice(1);
    if (runnersUp.length) {
      const more = el('section', 'bmwm-more-band');
      more.append(
        el('h3', 'bmwm-subhead bmwm-nearby-heading', `MORE AT ${ctx.retailerLabel.toUpperCase()}`),
        el('p', 'bmwm-lede bmwm-nearby-lede',
          `Other cars in ${ctx.retailerLabel}'s stock that also fit your answers.`),
      );
      const moreGrid = el('div', 'bmwm-more');
      runnersUp.forEach((m) => moreGrid.append(matchCard(m, { compact: true })));
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
    // Clear the drawer's carried-over guess so a fresh run starts empty, and
    // drop any in-flight/debounced refresh from the finished run.
    clearTimeout(ctx.previewTimer);
    ctx.preview = { matches: [], open: false, loading: false, seq: ctx.preview.seq + 1 };
    window.history.replaceState(null, '', window.location.pathname);
    ctx.showIntro();
  });
  actions.append(share, tweak, retake);
  screen.append(actions);

  screen.append(el('p', 'bmwm-disclaimer',
    'An unofficial tool, not affiliated with or endorsed by BMW. Prices and specs are indicative, always check with a retailer.'));

  root.append(screen);

  // Phase two: now the page is painted, load the nearby carousel in the
  // background and swap it into the placeholder band (or drop the band).
  if (nearbyBand) {
    apiNearby(ctx.api, answers, ctx.retailer).then((nearby) => {
      // The user may have navigated away (retake/tweak) before this resolves;
      // only touch the band if it's still in the document.
      if (!nearbyBand.isConnected) return;
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

  block.replaceChildren();
  block.classList.add('bmwm');

  const ctx = {
    answers: {},
    api,
    retailer,
    retailerLabel,
    questions: [],
    // Live "best guess" drawer state, kept on ctx so it survives the
    // per-question re-render (see renderPreviewDrawer / schedulePreviewRefresh).
    preview: { matches: [], open: false, loading: false, seq: 0 },
    previewTimer: null,
  };
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
