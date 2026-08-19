/*
 * HTTP tests for /api/preview's opt-in `group` flag. The bug that matters is
 * ordering: rank must group before slice, so the pool is deep enough to expose it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PREVIEW_COUNT } from '../index.js';
import {
  startTestServer, post, fakeStock, fakeEnrich, bmwFeedVehicle,
} from './helpers.js';
import { mapVehicle } from '../mapping.js';

/* A budget wide enough that nothing is filtered out — every car in the pool
 * reaches the ranking, so the counts below are about grouping alone. */
const OPEN_BRIEF = { budget: [10000, 60000] };

/* Ten models with distinct grouping identities (line + body + fuel + 0-62 + trim).
 * More than PREVIEW_COUNT on purpose: grouping the full ranking must fill nine slots. */
const MODELS = [
  ['BMW X1', 'X1 sDrive18i M Sport'],
  ['BMW X2', 'X2 sDrive20i M Sport'],
  ['BMW X3', 'X3 xDrive20d M Sport'],
  ['BMW X5', 'X5 xDrive30d M Sport'],
  ['BMW 1 Series', '118i M Sport'],
  ['BMW 2 Series', '220i M Sport'],
  ['BMW 3 Series', '320i M Sport'],
  ['BMW 4 Series', '420i M Sport'],
  ['BMW 5 Series', '520i M Sport'],
  ['BMW i4', 'i4 eDrive40 M Sport'],
];

/**
 * A pool where every model appears `copies` times at different prices — the shape
 * of a real retailer feed, so grouping a nine-slot response can be observed filling.
 */
function repeatedListingsPool(copies = 3) {
  return MODELS.flatMap(([title, derivative], m) => Array.from(
    { length: copies },
    (_, i) => mapVehicle(
      bmwFeedVehicle({ title, derivative, cash_price: { value: 30000 + m * 400 + i * 150 } }),
      'bmw',
    ),
  ));
}

/* Built once and shared: bmwFeedVehicle mints a fresh advert id per call, so
 * rebuilding per request would break the byte-identical comparison below. */
const POOL = repeatedListingsPool();

/** The identity groupListings folds on, as far as a public card exposes it. */
const identity = (car) => [car.line, car.body, car.fuel, car.zeroTo62].join('|');

async function preview(body) {
  const srv = await startTestServer({
    fetchRetailerStock: fakeStock({ bmw: POOL }),
    enrichColours: fakeEnrich(),
  });
  try {
    return await post(srv.base, '/api/preview', body);
  } finally {
    await srv.close();
  }
}

test('POST /api/preview with group: true returns one card per model', async () => {
  const { status, json } = await preview({ answers: OPEN_BRIEF, group: true });
  assert.equal(status, 200);

  const ids = json.matches.map((m) => identity(m.car));
  assert.equal(new Set(ids).size, ids.length, 'no two grouped matches are the same model');

  // Grouping the full ranking then slicing: ten models fill all nine slots.
  // Slicing first would group nine listings to a few cards and return short.
  assert.equal(json.matches.length, PREVIEW_COUNT, 'grouping the whole ranking still fills the slice');

  // Proof the fold actually happened rather than the pool happening to be
  // unique: each card speaks for its three listings and carries their spread.
  assert.ok(
    json.matches.every((m) => m.car.listingCount === 3),
    'every card reports the listings behind it',
  );
  assert.ok(
    json.matches.every((m) => m.car.priceTo > m.car.priceFrom),
    'a grouped card carries the price range of its listings',
  );
});

test('POST /api/preview without the flag is unchanged: raw listings, repeats and all', async () => {
  const { status, json } = await preview({ answers: OPEN_BRIEF });
  assert.equal(status, 200);
  assert.equal(json.matches.length, PREVIEW_COUNT);

  // The drawer's contract: individual listings, so a model may appear more than
  // once. A duplicate-free response would mean grouping leaked into the default.
  const ids = json.matches.map((m) => identity(m.car));
  assert.ok(new Set(ids).size < ids.length, 'repeat listings still come through as separate cards');
  assert.ok(
    json.matches.every((m) => m.car.listingCount === undefined),
    'ungrouped cards carry no grouping metadata',
  );
});

test('POST /api/preview with group: false is byte-identical to omitting it', async () => {
  // Anything other than a literal `true` must leave the drawer's response
  // exactly as it is today, so an old client sending a stray field is safe.
  const [omitted, explicit, garbage] = await Promise.all([
    preview({ answers: OPEN_BRIEF }),
    preview({ answers: OPEN_BRIEF, group: false }),
    preview({ answers: OPEN_BRIEF, group: 'yes' }),
  ]);
  assert.equal(explicit.text, omitted.text);
  assert.equal(garbage.text, omitted.text);
});
