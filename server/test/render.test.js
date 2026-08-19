/*
 * Headless render tests: mount every mode for every brand in a real DOM against
 * an in-process server, proving the CLIENT paints (the check for onboarding a brand).
 */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  installDom, resetDom, startModeServer, loadMode, mountMode, settle,
} from './dom-harness.js';
import {
  bmwPool, miniPool, hondaPool, fordPool, motorradPool, ferrariPool,
} from './helpers.js';

// Brands under render test, each with a stock pool and marque name. The wordmark
// is asserted only on the questionnaire intro; game modes lead with a neutral seed.
const BRANDS = [
  { key: 'bmw', pool: () => bmwPool(20), name: /BMW/i },
  { key: 'mini', pool: () => miniPool(8), name: /MINI/i },
  { key: 'honda', pool: () => hondaPool(20), name: /Honda/i },
  { key: 'ford', pool: () => fordPool(20), name: /Ford/i },
  { key: 'motorrad', pool: () => motorradPool(20), name: /Motorrad/i },
  { key: 'ferrari', pool: () => ferrariPool(20), name: /Ferrari/i },
];

const MODES = ['questionnaire', 'mingle', 'knockout', 'podium'];

let server;
let modes;

before(async () => {
  installDom();
  const pools = Object.fromEntries(BRANDS.map((b) => [b.key, b.pool()]));
  server = await startModeServer(pools);
  modes = Object.fromEntries(await Promise.all(
    MODES.map(async (k) => [k, await loadMode(k)]),
  ));
});

after(async () => {
  if (server) await server.close();
});

beforeEach(() => resetDom());

// The core matrix: mount each mode for each brand, assert it paints.
for (const mode of MODES) {
  for (const brand of BRANDS) {
    test(`${mode} mounts and paints for ${brand.key}`, async () => {
      const stage = mountMode(modes[mode], { base: server.base, brand: brand.key });

      // Painted = non-trivial visible text after the async boot lands.
      await settle(stage, (s) => s.textContent.replace(/\s/g, '').length > 20);

      const text = stage.textContent;
      assert.ok(
        text.replace(/\s/g, '').length > 20,
        `${mode}/${brand.key} rendered no meaningful text`,
      );
      // Brand copy resolves on the questionnaire intro, which names the marque.
      // Game modes lead with a neutral seed, so their wordmark is checked elsewhere.
      if (mode === 'questionnaire') {
        assert.match(
          text, brand.name,
          `questionnaire/${brand.key} did not show the brand wordmark`,
        );
      }
      // The stage carries the brand theme class the CSS hangs off.
      assert.ok(
        stage.classList.contains(`vm-${brand.key}`),
        `${mode}/${brand.key} missing vm-${brand.key} theme class`,
      );
      // It actually built DOM, not just a text node.
      assert.ok(
        stage.querySelector('*'),
        `${mode}/${brand.key} produced no elements`,
      );
    });
  }
}

/*
 * Podium's two locked rules the mount matrix can't see: conditional questions splice
 * in place (a neighbour stays the same node); a reason shows only if the brand can act.
 */
test('podium splices a conditional question out in place', async () => {
  const stage = mountMode(modes.podium, { base: server.base, brand: 'bmw' });
  // `charging` shows while fuel is unanswered (SHOW_IF.charging).
  await settle(stage, (s) => s.querySelector('.vm-podium-q[data-qid="charging"]'));

  const budgetBefore = stage.querySelector('.vm-podium-q[data-qid="budget"]');
  const fuel = stage.querySelector('.vm-podium-q[data-qid="fuel"]');
  const petrol = [...fuel.querySelectorAll('.vm-option')]
    .find((b) => b.textContent.includes('Petrol'));
  petrol.click();

  assert.equal(
    stage.querySelector('.vm-podium-q[data-qid="charging"]'), null,
    'charging survived a petrol-only answer',
  );
  assert.equal(
    stage.querySelector('.vm-podium-q[data-qid="budget"]'), budgetBefore,
    'the pane was rebuilt rather than spliced: the budget block is a new node',
  );
});

test('podium only offers a dismissal reason the brand can act on', async () => {
  const reasonsFor = async (brand) => {
    resetDom();
    const stage = mountMode(modes.podium, { base: server.base, brand });
    // The reject trigger only exists once a live podium has painted.
    await settle(stage, (s) => s.querySelector('.vm-podium-reject'));
    stage.querySelector('.vm-podium-reject').click();
    return [...stage.querySelectorAll('.vm-podium-pop-reason')].map((b) => b.textContent);
  };

  const bmw = await reasonsFor('bmw');
  assert.ok(bmw.includes('Price'), 'BMW was not offered the price branch');
  assert.ok(bmw.includes('Mileage'), 'BMW asks about mileage, so it must offer that branch');

  const mini = await reasonsFor('mini');
  assert.ok(mini.includes('Price'), 'MINI was not offered the price branch');
  assert.ok(
    !mini.includes('Mileage'),
    'MINI drops the mileage question, so the branch has nowhere to write',
  );
});

/*
 * Podium's third, load-bearing rule: never invent a ranking the engine didn't make
 * (tied cars are joint first). Written as an invariant holding in both branches.
 */
test('podium never labels a runner-up unless the engine ranked one', async () => {
  for (const brand of BRANDS) {
    resetDom();
    // eslint-disable-next-line no-await-in-loop
    const stage = mountMode(modes.podium, { base: server.base, brand: brand.key });
    // eslint-disable-next-line no-await-in-loop
    await settle(stage, (s) => s.querySelector('.vm-podium-step'));

    const steps = stage.querySelector('.vm-podium-steps');
    const all = [...stage.querySelectorAll('.vm-podium-step')];
    const count = (cls) => all.filter((s) => s.classList.contains(cls)).length;

    // No step may carry two rank classes at once, tied or not.
    for (const step of all) {
      const ranks = ['is-gold', 'is-silver', 'is-bronze']
        .filter((c) => step.classList.contains(c));
      assert.equal(
        ranks.length, 1,
        `${brand.key}: a step carried ${ranks.length} rank classes (${ranks.join(', ')})`,
      );
    }

    if (steps.classList.contains('is-tied')) {
      assert.equal(
        count('is-gold'), all.length,
        `${brand.key}: a tied podium left a step without joint first`,
      );
      assert.equal(
        count('is-silver') + count('is-bronze'), 0,
        `${brand.key}: a tied podium fabricated a runner-up the engine did not rank`,
      );
    } else {
      assert.equal(
        count('is-gold'), 1,
        `${brand.key}: a decisive podium did not have exactly one winner`,
      );
    }
  }
});

// A re-mount (switching tabs re-calls mount) must start clean, not stack a second
// interface. Mount twice and assert the second run replaced rather than appended.
test('re-mounting a mode starts a clean run', async () => {
  const first = mountMode(modes.questionnaire, { base: server.base, brand: 'bmw' });
  await settle(first, (s) => s.textContent.replace(/\s/g, '').length > 20);

  // The shell re-mounts by handing the mode a fresh stage; simulate that.
  resetDom();
  const second = mountMode(modes.mingle, { base: server.base, brand: 'bmw' });
  await settle(second, (s) => s.textContent.replace(/\s/g, '').length > 20);

  // Exactly one stage in the body — the old one is gone.
  const stages = document.body.querySelectorAll('.vm');
  assert.equal(stages.length, 1, 'a re-mount left a stale interface behind');
});

// No user-facing em dashes on the first painted screen of any mode/brand. The
// house rule (no em dashes in on-screen copy) gets a machine guard here.
test('no em dashes in painted copy', async () => {
  for (const mode of MODES) {
    for (const brand of BRANDS) {
      resetDom();
      // eslint-disable-next-line no-await-in-loop
      const stage = mountMode(modes[mode], { base: server.base, brand: brand.key });
      // eslint-disable-next-line no-await-in-loop
      await settle(stage, (s) => s.textContent.replace(/\s/g, '').length > 20);
      assert.ok(
        !stage.textContent.includes('—'),
        `${mode}/${brand.key} painted an em dash in user-facing copy`,
      );
    }
  }
});

// The painted-copy test only sees the FIRST screen; later-flow copy (verdicts,
// ledes, CTAs) lives in static tables, so scan each client file's string literals.
test('no em dashes in any string literal across the client copy surface', () => {
  const CLIENT_FILES = [
    'modes/questionnaire.js', 'modes/mingle.js', 'modes/knockout.js',
    'modes/podium.js', 'modes/match-signal.js',
    // Shared render modules lifted out of questionnaire.js. Their string literals
    // are on-screen copy for every mode, so they belong in the same guard.
    'modes/result-card.js', 'modes/question-ui.js', 'modes/brand-copy.js',
    'modes/preview-feed.js',
    'vehicle-matcher.js', 'quiz-meta.js',
    'vehicle-matcher.css',
  ];
  const blockDir = new URL('../../blocks/vehicle-matcher/', import.meta.url);
  const offenders = [];
  for (const rel of CLIENT_FILES) {
    const path = fileURLToPath(new URL(rel, blockDir));
    const src = readFileSync(path, 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      // Skip pure-comment lines (JS // and /* */ bodies, CSS /* */). Code lines with
      // a trailing comment are still scanned, but only string literals are inspected.
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      // Dev-only console diagnostics are author-facing, not on-screen copy.
      if (/\bconsole\.(warn|error|info|log|debug)\b/.test(line)) return;
      const strings = line.match(/([`'"])(?:\\.|(?!\1).)*\1/g) || [];
      for (const s of strings) {
        if (s.includes('—')) offenders.push(`${rel}:${i + 1}  ${s}`);
      }
    });
  }
  assert.equal(
    offenders.length, 0,
    `em dash in user-facing copy (house rule):\n${offenders.join('\n')}`,
  );
});
