/*
 * Interface "mode" registry. Each mode is one front-end approach over the shared engine:
 * a plain object { key, label, mount(root, ctx) }. Adding one = a new modes/<key>.js + an entry.
 */

import questionnaire from './questionnaire.js';
import mingle from './mingle.js';
import knockout from './knockout.js';
import podium from './podium.js';

export const MODES = [questionnaire, mingle, knockout, podium];

export const DEFAULT_MODE = MODES[0];

export const modeByKey = (key) => MODES.find((m) => m.key === key);
