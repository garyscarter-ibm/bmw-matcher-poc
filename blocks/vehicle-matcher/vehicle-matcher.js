/*
 * Vehicle Matcher — Adobe Edge Delivery Services (EDS) block. The shell.
 *
 * A brand-agnostic matcher: the brand (BMW, MINI, …) is authored config, not
 * baked in. This file is the SHELL around one or more interchangeable interface
 * "modes" (see modes/) that all drive the same engine (server/, via engine.js):
 *
 *   - It reads authored block config (brand, retailer, copy overrides, API base).
 *   - It applies the brand theme and builds the mode switcher + a stage element.
 *   - It picks which mode to mount:
 *       • a "Mode" config row (or ?mode=) locks the block to one interface and
 *         hides the switcher — the production case, one interface per page;
 *       • with no lock, every registered mode gets a switcher tab and the
 *         visitor can flip between them — the showcase case.
 *
 * The shell knows nothing about any mode's internals: a mode is just
 * { key, label, mount(root, ctx) }. Adding an interface touches modes/, not here.
 *
 * The API base comes from an authored "API" config row when running on EDS
 * (authored content can set config rows but not HTML attributes), or from a
 * `data-api` attribute for the local harness and the GitHub Pages build,
 * falling back to http://localhost:8787 for local preview. See apiBase.
 */

import { MODES, DEFAULT_MODE, modeByKey } from './modes/index.js';

const DEFAULT_API = 'http://localhost:8787';

/**
 * API base for this block, in precedence order:
 *   1. the `data-api` attribute — the local harness and the Pages build set
 *      it (the harness's ?api= override writes here too), so a query override
 *      always wins;
 *   2. an authored "API" config row — the EDS path, because authored content
 *      can produce config rows but not HTML attributes;
 *   3. the localhost default, for `npm run serve`.
 * Trailing slashes are trimmed so `${base}/api/...` never doubles up. An empty
 * or absent row is falsy and simply falls through.
 */
function apiBase(block) {
  const authored = readBlockConfig(block).api;
  return (block.dataset.api || authored || DEFAULT_API).replace(/\/+$/, '');
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

/**
 * An authored copy override, with three distinct states:
 *   undefined — no row authored, so the block's own default is used;
 *   null      — row authored but blank (or "none"), so the line is SUPPRESSED;
 *   string    — the authored replacement.
 *
 * Suppression is the point: on a real retailer's page the block is usually
 * placed under the site's own section heading, and repeating a title inside
 * the block reads as a stutter. The same mechanism lets a dealer drop the
 * "unofficial" framing, which is right for a public demo and wrong on their
 * own site.
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

/** Retailer display name for this block instance: authored "Retailer Name"
 * config row. Required alongside Retailer ID so the copy can name the
 * retailer the stock is actually sourced from; falls back to a generic
 * phrase (and warns) if the page author forgot to set it. */
function retailerName(block) {
  const config = readBlockConfig(block);
  const name = config['retailer-name'];
  if (!name) {
    console.warn('[vehicle-matcher] No "Retailer Name" config row set — add one alongside "Retailer ID". Falling back to generic copy.');
    return DEFAULT_RETAILER_NAME;
  }
  return name;
}

/** Brand for this block instance: authored "Brand" config row ("BMW" | "MINI"),
 * lower-cased. Defaults to 'bmw'. Drives both the visual theme (a body class)
 * and which live feed the server queries. Brand is authored data, not baked in —
 * the app is brand-agnostic; BMW is just the default when no row is set. */
function brand(block) {
  const config = readBlockConfig(block);
  const b = (config.brand || '').toLowerCase();
  return b === 'mini' ? 'mini' : 'bmw';
}

/**
 * Which interface mode to run, and whether the switcher is shown:
 *   - an authored "Mode" config row, or a ?mode= query override, LOCKS the
 *     block to that mode (switcher hidden) — the production case;
 *   - anything absent/blank/unrecognised leaves it unlocked (switcher shown,
 *     defaulting to DEFAULT_MODE) — the showcase case.
 * ?mode= wins over the authored row so a single deployed page can demo any mode
 * by URL. Returns { mode, locked }.
 */
function resolveMode(block) {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('mode') || readBlockConfig(block).mode || '').toLowerCase();
  const locked = modeByKey(requested);
  return locked ? { mode: locked, locked: true } : { mode: DEFAULT_MODE, locked: false };
}

/**
 * The mode switcher: one tab per registered mode. Clicking a tab re-mounts the
 * selected mode into the stage. Only rendered when the block is unlocked and
 * there's more than one mode to choose between — a single mode needs no switch.
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
  // Base class + brand theme class ('vm-bmw' | 'vm-mini'). The MINI theme
  // (vehicle-matcher.css) overrides the design tokens under .vm-mini.
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

  // The stage the active mode renders into — its own element so a switcher can
  // sit above it and survive a mode swap (a mode may replaceChildren() the
  // stage, but never the block).
  const stage = document.createElement('div');
  stage.className = 'vm-stage';

  // Unlocked: offer the switcher above the stage. Locked (authored Mode row or
  // ?mode=): mount that one mode with no switcher, so a production page looks
  // exactly as it did before modes existed.
  if (!locked) {
    const switcher = renderSwitcher(block, stage, ctx, mode);
    if (switcher) block.append(switcher);
  }
  block.append(stage);

  // Deliberately NOT awaited. EDS awaits every block's decorate() before it
  // reveals the page (body gains `appear`), so awaiting a network round-trip
  // here holds the WHOLE document hostage — including scrolling. Against a cold
  // backend that's 30–50s of a page that looks broken: content visible, scroll
  // dead. A mode paints its own skeleton immediately and swaps in the real
  // thing when its data lands, so decorate() returns now and lets the page
  // finish loading.
  mode.mount(stage, ctx);
}
