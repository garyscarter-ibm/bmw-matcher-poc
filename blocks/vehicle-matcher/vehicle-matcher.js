/*
 * Vehicle Matcher — an Adobe EDS block. The SHELL around interchangeable interface "modes"
 * (see modes/) driving one engine: it reads authored config, themes, and mounts a mode.
 */

import { MODES, DEFAULT_MODE, modeByKey } from './modes/index.js';

const DEFAULT_API = 'http://localhost:8787';

/**
 * API base for this block, in precedence order: the `data-api` attribute (harness/Pages, and
 * the ?api= override), then an authored "API" config row (EDS), then the localhost default.
 */
function apiBase(block) {
  const authored = readBlockConfig(block).api;
  return (block.dataset.api || authored || DEFAULT_API).replace(/\/+$/, '');
}

/**
 * Read authored block config the standard EDS way: each row is a `<div>` with two cells
 * (key, value). See aem-boilerplate's `readBlockConfig()` — same shape, same convention.
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

/**
 * An authored copy override with three states: undefined (no row → default), null (blank
 * or "none" → SUPPRESSED), or a string (the replacement). Suppression avoids a stutter.
 */
function copyRow(config, key) {
  if (!(key in config)) return undefined;
  const value = config[key].trim();
  return (!value || value.toLowerCase() === 'none') ? null : value;
}

/** The authored copy overrides: `title`, `kicker`, `disclaimer`. */
function copyOverrides(block) {
  const config = readBlockConfig(block);
  return {
    title: copyRow(config, 'title'),
    kicker: copyRow(config, 'kicker'),
    disclaimer: copyRow(config, 'disclaimer'),
  };
}

const DEFAULT_RETAILER_NAME = 'our retailer network';

/** Retailer display name for this block: authored "Retailer Name" config row. Required so
 * copy can name the source retailer; falls back to a generic phrase (and warns) if unset. */
function retailerName(block) {
  const config = readBlockConfig(block);
  const name = config['retailer-name'];
  if (!name) {
    console.warn('[vehicle-matcher] No "Retailer Name" config row set — add one alongside "Retailer ID". Falling back to generic copy.');
    return DEFAULT_RETAILER_NAME;
  }
  return name;
}

/** The brand keys this block knows how to theme — the client mirror of the server registry
 * (server/brands.js, the source of truth). DEFAULT_BRAND is the fallback for an unknown row. */
const KNOWN_BRANDS = ['bmw', 'mini', 'ford', 'honda', 'motorrad', 'ferrari'];
const DEFAULT_BRAND = 'bmw';

/** Brand for this block: authored "Brand" row, lower-cased, validated against KNOWN_BRANDS.
 * Drives the theme class and which live feed the server queries; defaults to bmw. */
function brand(block) {
  const config = readBlockConfig(block);
  const b = (config.brand || '').toLowerCase();
  return KNOWN_BRANDS.includes(b) ? b : DEFAULT_BRAND;
}

/**
 * Which interface mode to run, and whether the switcher shows: an authored "Mode" row or a
 * ?mode= override LOCKS to that mode (switcher hidden); absent/unknown leaves it unlocked.
 */
function resolveMode(block) {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('mode') || readBlockConfig(block).mode || '').toLowerCase();
  const locked = modeByKey(requested);
  return locked ? { mode: locked, locked: true } : { mode: DEFAULT_MODE, locked: false };
}

/**
 * The mode switcher: one tab per registered mode; clicking re-mounts it into the stage.
 * Only rendered when the block is unlocked and there's more than one mode to choose.
 */
function renderSwitcher(block, stage, ctx, current) {
  if (MODES.length < 2) return null;
  const bar = document.createElement('div');
  bar.className = 'vm-switcher';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Matching interface');

  let active = current;
  const tabs = MODES.map((mode) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'vm-switcher-tab';
    tab.textContent = mode.label;
    tab.setAttribute('role', 'tab');
    const select = () => {
      if (mode === active) return;
      active = mode;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
      });
      stage.replaceChildren();
      mode.mount(stage, ctx);
    };
    tab.addEventListener('click', select);
    const on = mode === active;
    tab.classList.toggle('is-active', on);
    tab.setAttribute('aria-selected', String(on));
    bar.append(tab);
    return tab;
  });
  return bar;
}

export default async function decorate(block) {
  // Read authored config before clearing the block's children — the config
  // rows live in the block's original markup.
  const retailer = retailerSite(block);
  const retailerLabel = retailerName(block);
  const api = apiBase(block);
  const brandKey = brand(block);
  const overrides = copyOverrides(block);
  const { mode, locked } = resolveMode(block);

  block.replaceChildren();
  // Base class + brand theme class ('vm-bmw' | 'vm-mini' | …). Each brand's theme overrides
  // the design tokens under its own .vm-<brand> scope; the base .vm block is the BMW look.
  block.classList.add('vm', `vm-${brandKey}`);

  // The context every mode receives. Config the shell resolved once; each mode
  // hangs its own per-run UI state (answers, questions, preview…) off this.
  const ctx = {
    api,
    retailer,
    retailerLabel,
    brand: brandKey,
    // Authored copy overrides (title / kicker / disclaimer) — see copyRow.
    overrides,
  };

  // The stage the active mode renders into — its own element so a switcher can sit above it
  // and survive a mode swap (a mode may replaceChildren() the stage, but never the block).
  const stage = document.createElement('div');
  stage.className = 'vm-stage';

  // Unlocked: switcher above the stage. Locked (authored Mode row or ?mode=):
  // mount that one mode with no switcher, as a production page looked pre-modes.
  if (!locked) {
    const switcher = renderSwitcher(block, stage, ctx, mode);
    if (switcher) block.append(switcher);
  }
  block.append(stage);

  // Deliberately NOT awaited: EDS awaits decorate() before revealing the page, so awaiting a
  // network round-trip here holds the whole document hostage. Modes paint a skeleton instead.
  mode.mount(stage, ctx);
}
