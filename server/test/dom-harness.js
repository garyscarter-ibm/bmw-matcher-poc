/*
 * Headless DOM harness for the client modes (render.test.js): mounts each mode in
 * jsdom against a real buildServer(), shimming the browser globals modes touch.
 */

import { once } from 'node:events';
import { JSDOM } from 'jsdom';

import { buildServer } from '../index.js';

const BLOCK_DIR = new URL('../../blocks/vehicle-matcher/', import.meta.url);

/**
 * Stand up jsdom and install the browser globals the modes reach for, so
 * module-level `document` captures in the modes resolve. Returns the JSDOM instance.
 */
export function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  const { window } = dom;

  // The modes gate motion on prefers-reduced-motion via matchMedia; jsdom has no
  // media engine, so shim a matcher reporting "no match" with add/removeEventListener.
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() { return false; },
    });
  }

  // Web Share + clipboard are used by the result CTAs. They must not throw when a
  // mode feature-detects them, so provide inert stubs.
  if (!window.navigator.share) {
    window.navigator.share = async () => {};
  }
  if (!window.navigator.clipboard) {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: async () => {} },
      configurable: true,
    });
  }

  // Expose the DOM globals the modes read as bare identifiers. Some (navigator) are
  // read-only getters in newer runtimes, so define rather than assign (assign throws).
  const define = (name, value) => {
    try {
      Object.defineProperty(global, name, { value, configurable: true, writable: true });
    } catch {
      /* getter-only and non-configurable: the module uses window.<name> instead */
    }
  };
  define('window', window);
  define('document', window.document);
  define('navigator', window.navigator);
  define('HTMLElement', window.HTMLElement);
  define('Node', window.Node);
  // requestAnimationFrame is used by some entrance animations; map to a timer.
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  return dom;
}

/** Fresh, empty <body> for the next mount so tests don't bleed into each other. */
export function resetDom() {
  document.body.replaceChildren();
}

/**
 * Spin up a server whose stock is a caller-supplied per-brand pool. Returns
 * { base, close }. Nearby + colour are inert so optional sections simply don't appear.
 */
export async function startModeServer(poolsByBrand) {
  const fetchRetailerStock = async (brand) => poolsByBrand[brand] || poolsByBrand.bmw || [];
  const fetchNearbyStock = async () => [];
  const enrichColours = async (_brand, cars = []) => cars;
  const server = buildServer({ fetchRetailerStock, fetchNearbyStock, enrichColours });
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

/** Dynamically import a mode module by key (questionnaire | mingle | knockout). */
export async function loadMode(key) {
  const mod = await import(new URL(`modes/${key}.js`, BLOCK_DIR));
  return mod.default;
}

/**
 * Mount a mode into a fresh stage against `base`, for `brand`. Returns the stage
 * element (already appended to the body) so the caller can assert after settle().
 */
export function mountMode(mode, { base, brand, retailer } = {}) {
  const stage = document.createElement('div');
  stage.className = `vm vm-${brand}`;
  document.body.append(stage);
  const ctx = {
    api: base,
    retailer: retailer || null,
    retailerLabel: 'Test Retailer',
    brand,
    overrides: {},
  };
  mode.mount(stage, ctx);
  return stage;
}

/**
 * Wait for a mode's async boot to paint real content. Polls `predicate(stage)`
 * every 15ms up to `timeout`; rejects on timeout with the stage text for diagnosis.
 */
export async function settle(stage, predicate, { timeout = 4000 } = {}) {
  const deadline = Date.now() + timeout;
  // eslint-disable-next-line no-await-in-loop
  while (Date.now() < deadline) {
    if (predicate(stage)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(
    `settle() timed out after ${timeout}ms. Stage text was:\n${stage.textContent?.slice(0, 400)}`,
  );
}
