/*
 * HTTP API-layer tests for the matcher engine.
 *
 * The engine's scoring is covered by engine.test.js / brand.test.js (pure
 * functions against fixtures). This suite covers the *server contract* every
 * interface mode depends on: route dispatch, request validation, response
 * shape and status codes, brand/retailer plumbing, and the size/enrich field
 * controls the game modes (swipe deck, knockout bracket) rely on.
 *
 * All of it runs against a real buildServer() instance on an ephemeral port
 * with an injected in-memory stock source (see helpers.js) — the true handler
 * code path, no live feed, no network. This is the layer whose absence let the
 * /api/field incident ship (a mode calling an endpoint the deployed backend
 * didn't serve); the contract-guard test below is the direct regression for it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildServer, FIELD_MAX, PREVIEW_COUNT, clampFieldSize,
} from '../index.js';
import { TOP_MATCHES, MAX_SHOWN } from '../engine.js';
import { StockUnavailableError } from '../stock.js';
import {
  startTestServer, post, get, request,
  fakeStock, fakeEnrich, throwingStock, bmwPool, miniPool,
} from './helpers.js';

/* A budget that keeps every fixture car eligible (fixtures sit 24k–40k). */
const OPEN_BRIEF = { budget: [10000, 60000] };

/* A fuller brief for /api/match — enough to produce reasons/trade-offs. */
const FULL_BRIEF = {
  budget: [10000, 60000],
  bodyStyles: ['suv'],
  fuel: ['open'],
  charging: 'none',
  primaryUse: 'family',
  people: 'family',
  priorities: ['comfort'],
};

/** Spin a server up with the standard fakes, run `fn`, always tear it down.
 * Returns whatever `fn` returns. Each test gets a fresh server + fresh fakes. */
async function withServer(deps, fn) {
  const srv = await startTestServer(deps);
  try {
    return await fn(srv.base, deps);
  } finally {
    await srv.close();
  }
}

/* ------------------------------------------------------------------ *
 * Route dispatch & methods
 * ------------------------------------------------------------------ */

test('GET /health → 200 { ok: true }', async () => {
  await withServer({}, async (base) => {
    const { status, json } = await get(base, '/health');
    assert.equal(status, 200);
    assert.deepEqual(json, { ok: true });
  });
});

test('unknown path → 404 { error }', async () => {
  await withServer({}, async (base) => {
    const { status, json } = await get(base, '/api/nope');
    assert.equal(status, 404);
    assert.equal(typeof json.error, 'string');
  });
});

test('right path but wrong method → 404 (POST-only route via GET)', async () => {
  await withServer({}, async (base) => {
    // /api/match is POST-only; a GET must not fall through to it.
    const { status } = await request(base, '/api/match', { method: 'GET' });
    assert.equal(status, 404);
  });
});

test('OPTIONS preflight → 204 with CORS headers', async () => {
  await withServer({}, async (base) => {
    const { status, headers } = await request(base, '/api/match', { method: 'OPTIONS' });
    assert.equal(status, 204);
    assert.equal(headers.get('access-control-allow-origin'), '*');
    assert.match(headers.get('access-control-allow-methods'), /POST/);
    assert.match(headers.get('access-control-allow-headers'), /Content-Type/i);
    // The shared-password header must be advertised or the browser preflight
    // blocks it before the request reaches the handler.
    assert.match(headers.get('access-control-allow-headers'), /X-Access-Key/i);
  });
});

/* ------------------------------------------------------------------ *
 * Shared-password gate (DEMO_ACCESS_KEY)
 *
 * When the env var is unset, auth is off and the whole suite above runs open.
 * These tests set it around a single server instance (isAuthorized reads it
 * per-request) and restore it in a finally so it never leaks to sibling tests
 * — node --test runs them all in one process.
 * ------------------------------------------------------------------ */

/** Run `fn` with DEMO_ACCESS_KEY set to `key`, restoring the prior value after. */
async function withAccessKey(key, fn) {
  const prev = process.env.DEMO_ACCESS_KEY;
  process.env.DEMO_ACCESS_KEY = key;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.DEMO_ACCESS_KEY;
    else process.env.DEMO_ACCESS_KEY = prev;
  }
}

test('auth off (no key set) → /api/questions open with no header', async () => {
  // Explicit guard that the unset-key path stays open (the suite above relies
  // on it implicitly). Belt-and-braces: force it unset for this test.
  const prev = process.env.DEMO_ACCESS_KEY;
  delete process.env.DEMO_ACCESS_KEY;
  try {
    await withServer({}, async (base) => {
      const { status } = await get(base, '/api/questions?brand=bmw');
      assert.equal(status, 200);
    });
  } finally {
    if (prev !== undefined) process.env.DEMO_ACCESS_KEY = prev;
  }
});

test('gated: /api/questions with no key → 401', async () => {
  await withAccessKey('s3cret', async () => {
    await withServer({}, async (base) => {
      const { status, json } = await get(base, '/api/questions?brand=bmw');
      assert.equal(status, 401);
      assert.equal(typeof json.error, 'string');
    });
  });
});

test('gated: wrong key → 401', async () => {
  await withAccessKey('s3cret', async () => {
    await withServer({}, async (base) => {
      const { status } = await request(base, '/api/questions?brand=bmw', {
        headers: { 'X-Access-Key': 'nope' },
      });
      assert.equal(status, 401);
    });
  });
});

test('gated: correct key → 200 with the normal questions shape', async () => {
  await withAccessKey('s3cret', async () => {
    await withServer({}, async (base) => {
      const { status, json } = await request(base, '/api/questions?brand=bmw', {
        headers: { 'X-Access-Key': 's3cret' },
      });
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.questions));
    });
  });
});

test('gated: POST /api/match without the key → 401 (POST routes are gated too)', async () => {
  await withAccessKey('s3cret', async () => {
    await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
      const { status } = await post(base, '/api/match', { answers: FULL_BRIEF });
      assert.equal(status, 401);
    });
  });
});

test('gated: /health stays open with no key (platform health check must not break)', async () => {
  await withAccessKey('s3cret', async () => {
    await withServer({}, async (base) => {
      const { status, json } = await get(base, '/health');
      assert.equal(status, 200);
      assert.deepEqual(json, { ok: true });
    });
  });
});

test('every endpoint the client calls exists (contract guard for the /api/field-class bug)', async () => {
  // Enumerate exactly what blocks/vehicle-matcher/engine.js talks to. If a mode
  // depends on an endpoint the server doesn't serve, one of these 404s — which
  // is precisely the failure that shipped when /api/field went live before the
  // backend served it. A valid request to each must NOT come back 404.
  const enrich = fakeEnrich();
  await withServer(
    {
      fetchRetailerStock: fakeStock(),
      fetchNearbyStock: fakeStock(),
      enrichColours: enrich,
      // The harness's default geocoder answers "no such postcode", which is a
      // 404 from the HANDLER — indistinguishable from the 404 this test is
      // looking for, so the route would look missing when it isn't. One that
      // resolves keeps the guard about routing.
      geocodePostcode: async () => ({ postcode: 'NG1', latitude: 52.95, longitude: -1.15 }),
    },
    async (base) => {
      const calls = [
        () => get(base, '/api/questions'),
        () => post(base, '/api/match', { answers: FULL_BRIEF }),
        () => post(base, '/api/preview', { answers: OPEN_BRIEF }),
        () => post(base, '/api/field', { answers: OPEN_BRIEF, size: 8 }),
        () => post(base, '/api/nearby', { answers: FULL_BRIEF }),
        // Guess Who's two. The pool is its only data call; the geocode is the
        // distance filter's, and 'NG1' is a real outward code so a valid request
        // here means a 200 rather than the 404 an unknown postcode earns.
        () => get(base, '/api/pool'),
        () => get(base, '/api/geocode?postcode=NG1'),
      ];
      for (const call of calls) {
        const { status } = await call();
        assert.notEqual(status, 404, 'a client endpoint returned 404 — the server does not serve it');
        assert.ok(status < 500, `a client endpoint 5xx'd on a valid request (got ${status})`);
      }
    },
  );
});

/* ------------------------------------------------------------------ *
 * /api/questions — brand filtering
 * ------------------------------------------------------------------ */

test('GET /api/questions ships questions + budgetBands + topMatches', async () => {
  await withServer({}, async (base) => {
    const { status, json } = await get(base, '/api/questions');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.questions) && json.questions.length > 0);
    assert.ok(json.budgetBands && typeof json.budgetBands === 'object');
    assert.equal(json.topMatches, TOP_MATCHES);
    // showIf predicates can't cross JSON — they must be stripped, not serialised.
    for (const q of json.questions) assert.equal(typeof q.showIf, 'undefined');
  });
});

test('GET /api/questions?brand=mini filters options MINI does not sell', async () => {
  await withServer({}, async (base) => {
    const bmw = (await get(base, '/api/questions')).json;
    const mini = (await get(base, '/api/questions?brand=mini')).json;
    const fuelOf = (set) => set.questions.find((q) => q.id === 'fuel').options.map((o) => o.value);
    assert.ok(fuelOf(bmw).includes('diesel'), 'BMW offers diesel');
    assert.ok(!fuelOf(mini).includes('diesel'), 'MINI drops diesel');
  });
});

test('GET /api/questions with a garbage brand defaults to BMW', async () => {
  await withServer({}, async (base) => {
    const bmw = (await get(base, '/api/questions')).json;
    const junk = (await get(base, '/api/questions?brand=zzz')).json;
    assert.deepEqual(
      junk.questions.map((q) => q.id),
      bmw.questions.map((q) => q.id),
      'unknown brand yields the BMW question set',
    );
  });
});

/* ------------------------------------------------------------------ *
 * Validation (readMatchRequest, exercised over /api/match)
 * ------------------------------------------------------------------ */

test('missing answers → 400', async () => {
  await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
    const { status, json } = await post(base, '/api/match', {});
    assert.equal(status, 400);
    assert.match(json.error, /answers/i);
  });
});

test('non-object answers (array / string) → 400', async () => {
  await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
    assert.equal((await post(base, '/api/match', { answers: [1, 2] })).status, 400);
    assert.equal((await post(base, '/api/match', { answers: 'nope' })).status, 400);
  });
});

test('missing / invalid budget → 400', async () => {
  await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
    assert.equal((await post(base, '/api/match', { answers: { bodyStyles: ['suv'] } })).status, 400);
    assert.equal((await post(base, '/api/match', { answers: { budget: 'lots' } })).status, 400);
    assert.equal((await post(base, '/api/match', { answers: { budget: [0, 0] } })).status, 400);
  });
});

test('legacy b1–b5 band budget is accepted → not a 400', async () => {
  await withServer({ fetchRetailerStock: fakeStock(), enrichColours: fakeEnrich() }, async (base) => {
    const { status } = await post(base, '/api/match', { answers: { budget: 'b2' } });
    assert.equal(status, 200, 'an old shared link with a band key still resolves');
  });
});

test('malformed JSON body → 400', async () => {
  await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
    const { status } = await post(base, '/api/match', '{ not json');
    assert.equal(status, 400);
  });
});

test('oversized body → 413', async () => {
  await withServer({ fetchRetailerStock: fakeStock() }, async (base) => {
    // MAX_BODY_BYTES is 16 KiB; a padded answers object blows past it.
    const huge = { answers: { budget: [10000, 60000], pad: 'x'.repeat(20 * 1024) } };
    const { status } = await post(base, '/api/match', huge);
    assert.equal(status, 413);
  });
});

/* ------------------------------------------------------------------ *
 * /api/match — response shape + failure mapping
 * ------------------------------------------------------------------ */

test('POST /api/match returns the full match envelope + publicMatch shape', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock(), enrichColours: fakeEnrich() },
    async (base) => {
      const { status, json } = await post(base, '/api/match', { answers: FULL_BRIEF });
      assert.equal(status, 200);
      for (const key of ['matches', 'alternatives', 'decisive', 'clusterSize', 'tasteLead', 'searched', 'unmet']) {
        assert.ok(key in json, `response is missing ${key}`);
      }
      assert.ok(Array.isArray(json.matches) && json.matches.length > 0);
      // matchCars caps the shown set at MAX_SHOWN (a cluster can exceed TOP_MATCHES).
      assert.ok(json.matches.length <= MAX_SHOWN);
      const m = json.matches[0];
      assert.equal(typeof m.score, 'number');
      assert.ok(Array.isArray(m.reasons));
      assert.ok(Array.isArray(m.tradeOffs));
      assert.ok(Array.isArray(m.listings) && m.listings.length >= 1);
      // publicCar shape: display fields present, internal scoring fields absent.
      assert.equal(typeof m.car.name, 'string');
      assert.equal(typeof m.car.priceMin, 'number');
      assert.match(m.car.link, /^https?:\/\//);
      assert.equal(m.car.tags, undefined, 'internal scoring tags must not leak');
      assert.equal(m.car.sizeClass, undefined, 'internal sizeClass must not leak');
    },
  );
});

test('POST /api/match maps StockUnavailableError → 502', async () => {
  await withServer(
    { fetchRetailerStock: throwingStock(new StockUnavailableError('feed down')) },
    async (base) => {
      const { status, json } = await post(base, '/api/match', { answers: FULL_BRIEF });
      assert.equal(status, 502);
      assert.match(json.error, /unavailable/i);
    },
  );
});

test('POST /api/match maps a generic stock error → 500', async () => {
  await withServer(
    { fetchRetailerStock: throwingStock(new Error('boom')) },
    async (base) => {
      const { status } = await post(base, '/api/match', { answers: FULL_BRIEF });
      assert.equal(status, 500);
    },
  );
});

/* ------------------------------------------------------------------ *
 * /api/preview — the questions drawer
 * ------------------------------------------------------------------ */

test('POST /api/preview returns ≤ PREVIEW_COUNT matches, each painted', async () => {
  const enrich = fakeEnrich();
  await withServer(
    { fetchRetailerStock: fakeStock({ bmw: bmwPool(20) }), enrichColours: enrich },
    async (base) => {
      const { status, json } = await post(base, '/api/preview', { answers: OPEN_BRIEF });
      assert.equal(status, 200);
      assert.ok(json.matches.length <= PREVIEW_COUNT);
      assert.ok(json.matches.length > 0, 'the 20-car pool fills the drawer');
      // Preview always enriches — every card carries the colour the fake tags on.
      assert.ok(enrich.calls > 0, 'preview must enrich');
      assert.ok(json.matches.every((m) => m.car.colour), 'every preview card is painted');
    },
  );
});

test('POST /api/preview accepts a partial brief (budget only) → 200', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock(), enrichColours: fakeEnrich() },
    async (base) => {
      // The drawer re-ranks mid-quiz on incomplete answers; budget is the one
      // guaranteed field. This must be a normal 200, not a validation error.
      const { status, json } = await post(base, '/api/preview', { answers: { budget: [10000, 60000] } });
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.matches));
    },
  );
});

test('POST /api/preview degrades a ranking failure to { matches: [] } 200, never 5xx', async () => {
  // A scorer that trips on a partial answer set must not take the drawer down.
  // Inject a pool whose ranking throws by handing rankCars a car it chokes on:
  // simplest reliable trigger is a stock fn returning a non-array, which makes
  // rankCars throw inside the guarded try. The handler must swallow it.
  await withServer(
    { fetchRetailerStock: async () => ({ not: 'an array' }), enrichColours: fakeEnrich() },
    async (base) => {
      const { status, json } = await post(base, '/api/preview', { answers: OPEN_BRIEF });
      assert.equal(status, 200, 'a ranking throw degrades to 200, not 500');
      assert.deepEqual(json.matches, []);
    },
  );
});

/* ------------------------------------------------------------------ *
 * /api/field — the game-mode roster (the reason this suite is timely)
 * ------------------------------------------------------------------ */

test('POST /api/field returns ≤ FIELD_MAX and respects a size under the cap', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock({ bmw: bmwPool(20) }) },
    async (base) => {
      const { status, json } = await post(base, '/api/field', { answers: OPEN_BRIEF, size: 8 });
      assert.equal(status, 200);
      assert.equal(json.matches.length, 8, 'a size of 8 against a 20-car pool yields exactly 8');
      assert.ok(json.matches.length <= FIELD_MAX);
    },
  );
});

test('POST /api/field clamps an oversized size down to FIELD_MAX', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock({ bmw: bmwPool(20) }) },
    async (base) => {
      const { json } = await post(base, '/api/field', { answers: OPEN_BRIEF, size: 999 });
      assert.equal(json.matches.length, FIELD_MAX, '999 → FIELD_MAX against a big pool');
    },
  );
});

test('POST /api/field treats an under-minimum size as the cap (clampFieldSize)', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock({ bmw: bmwPool(20) }) },
    async (base) => {
      // size 1 is below the 2-car minimum → clampFieldSize returns FIELD_MAX,
      // so the roster fills rather than collapsing to a single car.
      const { json } = await post(base, '/api/field', { answers: OPEN_BRIEF, size: 1 });
      assert.equal(json.matches.length, FIELD_MAX);
    },
  );
});

test('POST /api/field with a thin feed returns fewer than asked (drives the adaptive snap)', async () => {
  await withServer(
    { fetchRetailerStock: fakeStock({ mini: miniPool(6) }) },
    async (base) => {
      const { json } = await post(base, '/api/field', { answers: OPEN_BRIEF, brand: 'mini', size: 16 });
      assert.equal(json.matches.length, 6, 'a 6-car feed yields 6, not padded to 16');
    },
  );
});

test('POST /api/field enrich:true paints the cards', async () => {
  const enrich = fakeEnrich();
  await withServer(
    { fetchRetailerStock: fakeStock({ mini: miniPool(6) }), enrichColours: enrich },
    async (base) => {
      const { json } = await post(base, '/api/field', {
        answers: OPEN_BRIEF, brand: 'mini', size: 6, enrich: true,
      });
      assert.ok(enrich.calls > 0, 'enrich:true must call enrichColours');
      assert.ok(json.matches.every((m) => m.car.colour), 'every card is painted when enrich:true');
    },
  );
});

test('POST /api/field with enrich omitted does NOT enrich (the knockout cost-saving contract)', async () => {
  const enrich = fakeEnrich();
  await withServer(
    { fetchRetailerStock: fakeStock({ bmw: bmwPool(20) }), enrichColours: enrich },
    async (base) => {
      const { json } = await post(base, '/api/field', { answers: OPEN_BRIEF, size: 16 });
      assert.equal(enrich.calls, 0, 'a field without enrich must not fetch a PDP for every entrant');
      assert.ok(json.matches.every((m) => !m.car.colour), 'no card is painted when enrich is omitted');
    },
  );
});

test('POST /api/field degrades a ranking failure to { matches: [] } 200', async () => {
  await withServer(
    { fetchRetailerStock: async () => ({ not: 'an array' }) },
    async (base) => {
      const { status, json } = await post(base, '/api/field', { answers: OPEN_BRIEF, size: 8 });
      assert.equal(status, 200);
      assert.deepEqual(json.matches, []);
    },
  );
});

/* ------------------------------------------------------------------ *
 * Brand / retailer plumbing
 * ------------------------------------------------------------------ */

test('brand routes to the right feed; retailer is threaded to the stock fetch', async () => {
  const stock = fakeStock({ bmw: bmwPool(20), mini: miniPool(6) });
  await withServer({ fetchRetailerStock: stock }, async (base) => {
    await post(base, '/api/field', { answers: OPEN_BRIEF, brand: 'mini', retailer: '92', size: 16 });
    await post(base, '/api/field', { answers: OPEN_BRIEF, brand: 'bmw', retailer: '96', size: 16 });
    const mini = stock.calls.find((c) => c.brand === 'mini');
    const bmw = stock.calls.find((c) => c.brand === 'bmw');
    assert.ok(mini && mini.retailer === '92', 'MINI request threaded retailer 92');
    assert.ok(bmw && bmw.retailer === '96', 'BMW request threaded retailer 96');
  });
});

test('an absent/garbage brand defaults to bmw at the stock layer', async () => {
  const stock = fakeStock();
  await withServer({ fetchRetailerStock: stock }, async (base) => {
    await post(base, '/api/field', { answers: OPEN_BRIEF, brand: 'zzz', size: 8 });
    assert.equal(stock.calls[0].brand, 'bmw', 'unknown brand normalises to bmw');
  });
});

/* ------------------------------------------------------------------ *
 * /api/nearby — the honesty distinction
 * ------------------------------------------------------------------ */

test('POST /api/nearby returns { nearby, unmet } on success', async () => {
  await withServer(
    { fetchNearbyStock: fakeStock({ bmw: bmwPool(20) }) },
    async (base) => {
      const { status, json } = await post(base, '/api/nearby', { answers: FULL_BRIEF });
      assert.equal(status, 200);
      assert.ok(Array.isArray(json.nearby));
      // A successful lookup reports unmet as an object (a finding), never null.
      assert.ok(json.unmet && typeof json.unmet === 'object');
    },
  );
});

test('POST /api/nearby degrades a failure to { nearby: [], unmet: null } 200', async () => {
  await withServer(
    { fetchNearbyStock: throwingStock(new StockUnavailableError('down')) },
    async (base) => {
      const { status, json } = await post(base, '/api/nearby', { answers: FULL_BRIEF });
      assert.equal(status, 200, 'nearby is a bonus tier — a failure is never a 5xx');
      assert.deepEqual(json.nearby, []);
      // unmet is null, NOT {}: "we never heard back" must be distinguishable
      // from "nearby found nothing that fits" before telling a user it doesn't exist.
      assert.equal(json.unmet, null);
    },
  );
});

/* ------------------------------------------------------------------ *
 * clampFieldSize — direct unit tests (it's exported; boundaries are cheap)
 * ------------------------------------------------------------------ */

test('clampFieldSize: boundaries and junk resolve as documented', () => {
  assert.equal(clampFieldSize(8), 8, 'a value in range passes through');
  assert.equal(clampFieldSize(2), 2, 'the minimum playable field');
  assert.equal(clampFieldSize(FIELD_MAX), FIELD_MAX, 'the cap passes through');
  assert.equal(clampFieldSize(FIELD_MAX + 1), FIELD_MAX, 'above the cap clamps to the cap');
  assert.equal(clampFieldSize(1), FIELD_MAX, 'below the minimum falls back to the cap');
  assert.equal(clampFieldSize(0), FIELD_MAX);
  assert.equal(clampFieldSize(-5), FIELD_MAX);
  assert.equal(clampFieldSize(NaN), FIELD_MAX);
  assert.equal(clampFieldSize(undefined), FIELD_MAX, 'absent size falls back to the cap');
  assert.equal(clampFieldSize('12'), 12, 'a numeric string is coerced');
  assert.equal(clampFieldSize(8.9), 8, 'a fraction floors');
});

/* ------------------------------------------------------------------ *
 * The seam itself: importing the module is hermetic
 * ------------------------------------------------------------------ */

test('buildServer defaults its deps and is not listening until asked', () => {
  // Importing index.js must not bind a port or hit the feed (the main-module
  // guard). buildServer with no deps returns a server that hasn't listened yet.
  const server = buildServer();
  assert.equal(typeof server.listen, 'function');
  assert.equal(server.listening, false, 'buildServer must not auto-listen');
  server.close();
});
