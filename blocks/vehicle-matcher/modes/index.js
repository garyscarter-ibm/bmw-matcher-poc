/*
 * Interface "mode" registry.
 *
 * Each mode is one front-end approach to matching over the shared engine. A
 * mode is a plain object:
 *
 *   { key: string, label: string, mount(root, ctx) }
 *
 *   key    — stable identifier; the value an author puts in the "Mode" config
 *            row to lock the block to this interface, and the ?mode= override.
 *   label  — human name shown on the in-UI switcher tab.
 *   mount  — renders the interface into `root` (a stage element it owns), using
 *            the shell-provided `ctx` (api, retailer, retailerLabel, brand,
 *            overrides). Should return promptly; do async work without blocking.
 *
 * Adding an interface = a new modes/<key>.js exporting this shape, plus one
 * import + one array entry here. The shell (../vehicle-matcher.js) needs no
 * change. The first entry is the default when nothing is authored/overridden.
 */

import questions from './questions.js';
import mingle from './mingle.js';
import knockout from './knockout.js';

export const MODES = [questions, mingle, knockout];

export const DEFAULT_MODE = MODES[0];

export const modeByKey = (key) => MODES.find((m) => m.key === key);
