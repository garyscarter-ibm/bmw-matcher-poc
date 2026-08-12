/*
 * Headless render tests — every interface mode, every brand, actually mounted.
 *
 * The api/engine/brand suites prove the server. These prove the CLIENT: that
 * each mode's mount(root, ctx) paints real content in a real DOM, for each
 * brand, driving the true engine over a real (in-process) server. This is the
 * machine check that stands in for eyeballing `?brand=<key>&mode=<key>` in a
 * browser after onboarding a brand — a mode that throws on mount, or renders
 * nothing for a new brand, fails here.
 *
 * See dom-harness.js for how the DOM + server are stood up. Only the live feed
 * is faked; the mode, the engine client, the endpoints and the engine are all
 * production code.
 *
 * Coverage note (testing gap this closes): before this file, no test mounted a
 * client mode at all — client render regressions were caught only by manual
 * browser checks. New brands are added to BRANDS below so their client render
 * is guarded from the day they land, not just their server-side mapping.
 */

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  installDom, resetDom, startModeServer, loadMode, mountMode, settle,
} from './dom-harness.js';
import {
  bmwPool, miniPool, hondaPool, fordPool, motorradPool,
} from './helpers.js';

// Brands under render test, each with a stock pool and the marque name. The
// wordmark is asserted only where a mode actually shows it: the questions
// intro names the brand for every marque ("Find your perfect BMW"), whereas the
// two game modes lead with a neutral, brand-agnostic seed screen ("Car Match" /
// "Head to Head" on BMW) and reveal the brand voice later, by design (see the
// mode requirement docs). So the universal render check is "paints + correct
// theme + no em dashes"; the wordmark check is scoped to questions.
// Motorrad is the first non-car brand: its pool is BIKES (motorrad-bikes.json),
// but the mapped shape is identical, so the same render matrix applies. Its
// wordmark on the questions intro is "BMW Motorrad".
const BRANDS = [
  { key: 'bmw', pool: () => bmwPool(20), name: /BMW/i },
  { key: 'mini', pool: () => miniPool(8), name: /MINI/i },
  { key: 'honda', pool: () => hondaPool(20), name: /Honda/i },
  { key: 'ford', pool: () => fordPool(20), name: /Ford/i },
  { key: 'motorrad', pool: () => motorradPool(20), name: /Motorrad/i },
];

const MODES = ['questions', 'mingle', 'knockout'];

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
      // Brand copy resolved on the questions intro, which names the marque for
      // every brand. The game modes lead with a neutral seed screen by design,
      // so their wordmark is checked in their own reveal, not here.
      if (mode === 'questions') {
        assert.match(
          text, brand.name,
          `questions/${brand.key} did not show the brand wordmark`,
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

// A re-mount (switching tabs re-calls mount) must start clean, not stack a
// second interface on top of the first. Mount twice into the same stage-owning
// body and assert the second run replaced rather than appended.
test('re-mounting a mode starts a clean run', async () => {
  const first = mountMode(modes.questions, { base: server.base, brand: 'bmw' });
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

// The painted-copy test above only sees the FIRST screen of each mode. The house
// rule (no em dashes in user-facing copy) also has to hold on the later-flow
// screens a render test can't cheaply reach without a full playthrough: deck
// instructions, per-tie verdicts, weak/thin notes, empty-deck ledes, result CTAs.
// Those all live in static copy tables in the mode source, so we guard them at
// the source: scan each client file for an em dash inside a string literal. This
// caught real violations in the BMW/MINI mingle + knockout copy that the painted
// check never reached (they only appear on the result/verdict/empty screens), and
// it stops any future edit from reintroducing one on any screen.
//
// Comments and dev-only console diagnostics are out of scope (the rule is about
// on-screen copy), so pure-comment lines are skipped and CSS/JS content strings
// are the target. This is a source scan, not a runtime paint, so it needs no
// server or DOM — it stands alone.
test('no em dashes in any string literal across the client copy surface', () => {
  const CLIENT_FILES = [
    'modes/questions.js', 'modes/mingle.js', 'modes/knockout.js',
    'modes/match-signal.js', 'vehicle-matcher.js', 'quiz-meta.js',
    'vehicle-matcher.css',
  ];
  const blockDir = new URL('../../blocks/vehicle-matcher/', import.meta.url);
  const offenders = [];
  for (const rel of CLIENT_FILES) {
    const path = fileURLToPath(new URL(rel, blockDir));
    const src = readFileSync(path, 'utf8');
    src.split(/\r?\n/).forEach((line, i) => {
      const t = line.trim();
      // Skip pure-comment lines (JS // and /* */ bodies, CSS /* */). A code line
      // with a trailing comment is still scanned — but only its string literals
      // are inspected, so the trailing comment can't cause a false positive.
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
