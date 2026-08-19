/*
 * BMW Matcher API — zero-dependency Node HTTP server. Runs the matching engine
 * server-side (weights never reach the browser) over live used-car stock (stock.js).
 */

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';

import {
  matchCars, rankCars, groupListings, budgetRange, unmetWants, TOP_MATCHES,
} from './engine.js';
import {
  fetchRetailerStock, fetchNearbyStock, startStockWarmer, StockUnavailableError, enrichColours,
} from './stock.js';
import {
  QUESTIONS, BUDGET_BANDS, questionsForBrand, applyBespokeAnswers,
} from './questions.js';
import { normalizeBrand, brandTuning } from './brands.js';

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 16 * 1024; // quiz answers are tiny; reject anything bigger

// A shared secret gating /api/*, set only in the host env (never committed). Unset/empty
// = auth OFF (local dev + tests run open); set = X-Access-Key must match. Read per-request.
function accessKey() {
  return process.env.DEMO_ACCESS_KEY || '';
}

// How many matches the quiz's live "best guess" drawer shows. Wider than the results
// page's TOP_MATCHES (3) — a browse-the-shortlist glance, not the final recommendation.
const PREVIEW_COUNT = 9;

// Ceiling on the game modes' roster (swipe deck / knockout bracket) from /api/field — a
// bracket wants a full field, not a shortlist. Doesn't change what the engine scores.
const FIELD_MAX = 16;

/** Clamp a client roster size into [2, FIELD_MAX]; default to the cap when absent or not
 * a positive number. Two is the smallest playable field; above the cap returns the cap. */
function clampFieldSize(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 2) return FIELD_MAX;
  return Math.min(n, FIELD_MAX);
}

const CORS_HEADERS = {
  // Read-only tool. Origin stays '*' on purpose (the block runs from arbitrary origins);
  // the real gate is the X-Access-Key header, which must be advertised here for preflight.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Access-Key',
  'Access-Control-Max-Age': '86400',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Is this request allowed to reach /api/*? Unset ACCESS_KEY = auth OFF; set = X-Access-Key
 * must match. Constant-time compare needs equal-length buffers, so bail on missing/mismatched.
 */
function isAuthorized(req) {
  const expected = accessKey();
  if (!expected) return true;
  const provided = req.headers['x-access-key'];
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Quiz definition for the client, for a brand. Options the brand doesn't sell are filtered
 * out; `showIf` predicates can't cross JSON, so we drop them and mark conditional questions.
 */
function publicQuestions(brand) {
  return questionsForBrand(brand)
    .map(({ showIf, ...q }) => (showIf ? { ...q, conditional: true } : q));
}

/**
 * Project a car to only the fields result cards render (see matchCard). Internal scoring
 * fields are omitted so responses can't rebuild the dataset; a field the card prints is public.
 */
function publicCar(car) {
  return {
    // The advert id — already public in `link`, and the only stable identity the page has.
    // Refinement needs it: without it every card compares equal, so "not this one" rules out all.
    id: car.id,
    name: car.name,
    line: car.line,
    body: car.body,
    fuel: car.fuel,
    priceMin: car.priceMin,
    priceMax: car.priceMax,
    zeroTo62: car.zeroTo62,
    mpg: car.mpg,
    evRange: car.evRange,
    // The two practicality facts the engine hard-filters on. From MODEL_SPECS (mapping.js),
    // so they describe the model not the listing — the card says "seats up", not a measured figure.
    seats: car.seats,
    boot: car.boot,
    blurb: car.blurb,
    // Live retailer detail (present when sourced from the live feed).
    mileage: car.mileage,
    plate: car.plate,
    // Age source for the swipe card's dating frame ("3 years old"). The plate encodes age
    // for plated brands, but bikes carry none, so reg year/date are surfaced too (see ageInYears).
    year: car.year,
    firstReg: car.firstReg,
    photo: car.photo,
    // Granular facts the life-fit questions never ask, for the refinement step: equipment
    // concepts (FEATURE_CONCEPTS), gearbox, and paint (fetched per shown car from the PDP).
    features: car.features,
    transmission: car.transmission,
    colour: car.colour,
    // Per-listing detail from the raw feeds, for the card layer: cc/power (Honda bhp,
    // Motorrad kW, Ferrari/BMW), topSpeed (Ferrari mph), service history/owners (Ford).
    cc: car.cc,
    power: car.power,
    topSpeed: car.topSpeed,
    fullServiceHistory: car.fullServiceHistory,
    previousOwners: car.previousOwners,
    // Set when repeat listings of one car were grouped (see groupListings): count, price
    // spread and colours, so one card can speak for all of them.
    listingCount: car.listingCount,
    priceFrom: car.priceFrom,
    priceTo: car.priceTo,
    colours: car.colours,
    retailerName: car.retailerName,
    link: car.link,
    // Miles from the configured retailer. Only set on `nearby` cars — the hero matches
    // are the configured retailer's own stock.
    distance: car.distance,
  };
}

function publicMatch({
  car, score, stretch, reasons, tradeOffs, listings,
}) {
  return {
    car: publicCar(car),
    score,
    stretch,
    reasons,
    tradeOffs,
    // The cars behind a grouped card, sent for EVERY match (a one-listing group is the
    // degenerate case; special-casing it in the client is how the two paths drift apart).
    listings: (listings?.length ? listings : [car]).map((c) => ({
      id: c.id,
      // Each listing is a real car with its own photos, so the card shows the one the buyer
      // picked, not the one that ranked first — colour is the reason, a wrong photo undoes it.
      photo: c.photo,
      colour: c.colour?.manufacturerColour || c.colour?.colour,
      shade: c.colour?.colour,
      priceMin: c.priceMin,
      mileage: c.mileage,
      transmission: c.transmission,
      features: c.features,
      link: c.link,
    })),
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Stop reading, but DON'T destroy the socket: a reset reaches the client as a generic
        // "connection closed". Pausing lets the 413 flush first so the block sees the refusal.
        req.pause();
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Parse + validate the shared POST body. Returns {answers, retailer, brand, size, enrich,
 * group} or {error, status}. `size`/`enrich` are for /api/field, `group` for /api/preview.
 */
async function readMatchRequest(req) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return { error: err.message, status: err.statusCode || 400 };
  }
  const answers = body && body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { error: 'Missing "answers" object', status: 400 };
  }
  // Budget is a continuous number now, but legacy b1–b5 band keys are still honoured (old
  // links). budgetRange resolves both to [min, max]; null means neither a number nor a band.
  if (!budgetRange(answers)) {
    return { error: 'Invalid or missing budget', status: 400 };
  }
  const retailer = typeof body.retailer === 'string' && body.retailer ? body.retailer : undefined;
  // Brand selects the feed (BMW vs MINI). normalizeBrand defaults unknown/absent
  // to BMW, so old clients that don't send a brand keep working.
  const brand = normalizeBrand(body.brand);
  // Game-mode roster controls (see handleField). Oversized fields are clamped not rejected;
  // `enrich` opts into per-card paint (swipe wants it; knockout won't pay for 16 PDP fetches).
  const size = clampFieldSize(body.size);
  const enrich = body.enrich === true;
  // `group` opts into one-card-per-model results (see handlePreview). Strict `=== true`:
  // the drawer's top-9 is tuned around listings, so an absent/garbage flag must not shift it.
  const group = body.group === true;
  return {
    answers, retailer, brand, size, enrich, group,
  };
}

/**
 * The retailer's own matches — the fast path. Scores against just the retailer's live stock
 * so the hero renders without waiting on the slower nearby search (now separate, /api/nearby).
 */
async function handleMatch(req, res, deps) {
  const {
    answers, retailer, brand, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  // Live proxy: score against real stock, not a static file. If the feed is down, return a
  // friendly 5xx (the block's retry UI handles it) — no static fallback, this tool is live-only.
  let cars;
  try {
    cars = await deps.fetchRetailerStock(brand, retailer);
  } catch (err) {
    if (err instanceof StockUnavailableError) {
      return sendJson(res, 502, { error: 'Live stock is temporarily unavailable' });
    }
    return sendJson(res, 500, { error: 'Something went wrong finding matches' });
  }

  // Fold any bespoke per-brand question answers into the standard fields the
  // engine scores (see applyBespokeAnswers) before ranking.
  const scored = applyBespokeAnswers(brand, answers);
  const {
    matches, alternatives, decisive, clusterSize, tasteLead, searched,
  } = matchCars(scored, cars, brandTuning(brand));

  // Paint only exists on the PDP, so enrich just the cars about to show (see enrichColours),
  // on-screen first (budget cuts the tail); a grouped card's fresh `car` and `listings` differ — enrich both.
  await deps.enrichColours(brand, [
    ...matches.map((m) => m.car),
    ...matches.flatMap((m) => m.listings || []),
    ...alternatives.map((m) => m.car),
    ...alternatives.flatMap((m) => m.listings || []),
  ]);
  // Paint is only known after that call, so the group's colour list is filled here, not at
  // grouping time. Alternatives too: a rejection promotes one into view already knowing its colours.
  for (const m of [...matches, ...alternatives]) {
    if (m.listings?.length > 1) {
      m.car.colours = [...new Set(m.listings
        .map((c) => c.colour?.manufacturerColour || c.colour?.colour)
        .filter(Boolean))];
    }
  }
  // What this retailer couldn't offer (see unmetWants), against the folded answers. Half the
  // picture: the block waits for /api/nearby to agree before calling a want truly unavailable.
  return sendJson(res, 200, {
    matches: matches.map(publicMatch),
    // Held back for "not this one" to fall through to (see matchCars).
    alternatives: alternatives.map(publicMatch),
    // Whether naming a single winner is honest, and how big the tie is (can exceed
    // matches.length — see matchCars). Drives "your perfect BMW is…" vs "any of these".
    decisive,
    clusterSize,
    // Fit couldn't separate the leaders but the buyer's stated preferences
    // could, so the page may name one honestly (see matchCars).
    tasteLead,
    // How much stock was searched, how much survived the filters, and how far clear the
    // winner is — the page uses it to show its working rather than an evidence-free verdict.
    searched,
    unmet: unmetWants(scored, cars),
  });
}

/**
 * The quiz's live "best guess": same scoring/cache as /api/match, a wider PREVIEW_COUNT
 * slice. Grouping is opt-in (`group: true`) — the drawer keeps raw listings, a podium groups.
 */
async function handlePreview(req, res, deps) {
  const {
    answers, retailer, brand, group, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  let cars;
  try {
    cars = await deps.fetchRetailerStock(brand, retailer);
  } catch (err) {
    if (err instanceof StockUnavailableError) {
      return sendJson(res, 502, { error: 'Live stock is temporarily unavailable' });
    }
    return sendJson(res, 500, { error: 'Something went wrong finding matches' });
  }

  // Preview scores partial answer sets, so guard the ranking: a scorer tripping on an
  // unanswered question degrades to "no guess yet" (empty, 200), never an uncaught throw.
  let matches = [];
  try {
    const ranked = rankCars(applyBespokeAnswers(brand, answers), cars, brandTuning(brand));
    // Group the WHOLE ranking before slicing: slicing first could hand groupListings nine
    // listings that are three cars, returning three cards where nine were asked for.
    matches = (group ? groupListings(ranked) : ranked).slice(0, PREVIEW_COUNT);
  } catch (err) {
    console.warn('[preview] ranking failed:', err?.message);
  }

  // Paint the returned slice (swipe mode reads car.colour as a taste signal; see
  // enrichColours). Best-effort under a budget and never throws, so a slow PDP can't error the drawer.
  try {
    await deps.enrichColours(brand, [
      ...matches.map((m) => m.car),
      ...matches.flatMap((m) => m.listings || []),
    ]);
    // Fill each grouped card's colour list now its listings are painted (mirror handleMatch):
    // a card standing for several listings can name the colours they come in.
    for (const m of matches) {
      if (m.listings?.length > 1) {
        m.car.colours = [...new Set(m.listings
          .map((c) => c.colour?.manufacturerColour || c.colour?.colour)
          .filter(Boolean))];
      }
    }
  } catch (err) {
    console.warn('[preview] colour enrichment failed:', err?.message);
  }

  return sendJson(res, 200, { matches: matches.map(publicMatch) });
}

/**
 * The game modes' roster: same engine/stock as /api/match, a wider slice (up to `size`,
 * capped at FIELD_MAX). Paint is opt-in (`enrich`); best-effort, never throws.
 */
async function handleField(req, res, deps) {
  const {
    answers, retailer, brand, size, enrich, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  let cars;
  try {
    cars = await deps.fetchRetailerStock(brand, retailer);
  } catch (err) {
    if (err instanceof StockUnavailableError) {
      return sendJson(res, 502, { error: 'Live stock is temporarily unavailable' });
    }
    return sendJson(res, 500, { error: 'Something went wrong finding matches' });
  }

  // Score the whole feed, then take the roster off the top. Guarded like preview: a partial
  // answer set degrades to "no field yet" (empty, 200), never takes the process down.
  let matches = [];
  try {
    matches = rankCars(applyBespokeAnswers(brand, answers), cars, brandTuning(brand)).slice(0, size);
  } catch (err) {
    console.warn('[field] ranking failed:', err?.message);
  }

  if (enrich) {
    try {
      await deps.enrichColours(brand, [
        ...matches.map((m) => m.car),
        ...matches.flatMap((m) => m.listings || []),
      ]);
      for (const m of matches) {
        if (m.listings?.length > 1) {
          m.car.colours = [...new Set(m.listings
            .map((c) => c.colour?.manufacturerColour || c.colour?.colour)
            .filter(Boolean))];
        }
      }
    } catch (err) {
      console.warn('[field] colour enrichment failed:', err?.message);
    }
  }

  return sendJson(res, 200, { matches: matches.map(publicMatch) });
}

/**
 * Cars at OTHER nearby retailers — the slow path, split from /api/match so its latency never
 * blocks the hero. A bonus (failure → [], 200); `unmet` is `null` not `{}` when the lookup failed.
 */
async function handleNearby(req, res, deps) {
  const {
    answers, retailer, brand, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  let nearby = [];
  let unmet = null;
  try {
    const cars = await deps.fetchNearbyStock(brand, retailer);
    const scored = applyBespokeAnswers(brand, answers);
    const ranked = rankCars(scored, cars, brandTuning(brand));
    nearby = ranked.slice(0, TOP_MATCHES);
    unmet = unmetWants(scored, cars);

    // Rescue slots. The blended top slice can drop the very want this tier honours, so for each
    // stated fuel/body value missing from the slice, append the best-ranked car that has it.
    const stated = [
      ...(Array.isArray(scored.fuel) ? scored.fuel : [])
        .filter((v) => v !== 'open').map((v) => [(c) => c.fuel === v]),
      ...(scored.bodyStyles || [])
        .filter((v) => v !== 'any').map((v) => [(c) => c.body === v]),
    ];
    for (const [has] of stated) {
      if (!nearby.some((m) => has(m.car))) {
        const best = ranked.find((m) => has(m.car));
        if (best) nearby.push(best);
      }
    }
  } catch (err) {
    console.warn('[nearby] stock unavailable:', err?.message);
  }

  return sendJson(res, 200, { nearby: nearby.map(publicMatch), unmet });
}

/**
 * Build the HTTP server. The stock source is injected (defaults to the live stock.js fns)
 * so tests drive routing/validation/handlers against a fixture; handlers read deps, the seam.
 */
export function buildServer(deps = {}) {
  const resolved = {
    fetchRetailerStock,
    fetchNearbyStock,
    enrichColours,
    ...deps,
  };

  return createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      return res.end();
    }

    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    // Shared-password gate for everything below (/health and OPTIONS already handled above).
    // When DEMO_ACCESS_KEY is unset this is a no-op (see isAuthorized).
    if (!isAuthorized(req)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    if (req.method === 'GET' && pathname === '/api/questions') {
      // Brand comes on the query string (?brand=mini, defaults BMW); options are filtered to
      // what it sells. topMatches ships so the intro isn't hardcoded (see TOP_MATCHES).
      const brand = normalizeBrand(searchParams.get('brand'));
      return sendJson(res, 200, {
        questions: publicQuestions(brand),
        budgetBands: BUDGET_BANDS,
        topMatches: TOP_MATCHES,
      });
    }

    if (req.method === 'POST' && pathname === '/api/match') {
      return handleMatch(req, res, resolved);
    }

    if (req.method === 'POST' && pathname === '/api/preview') {
      return handlePreview(req, res, resolved);
    }

    if (req.method === 'POST' && pathname === '/api/field') {
      return handleField(req, res, resolved);
    }

    if (req.method === 'POST' && pathname === '/api/nearby') {
      return handleNearby(req, res, resolved);
    }

    return sendJson(res, 404, { error: 'Not found' });
  });
}

// Constants worth asserting against in tests without hardcoding the numbers.
export { PREVIEW_COUNT, FIELD_MAX, clampFieldSize };

// Only bind a port + warm the cache when run as the entry point; importing in a test gets
// buildServer with none of these side effects — no socket, no live feed.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = buildServer();
  server.listen(PORT, () => {
    console.log(`Matcher API listening on http://localhost:${PORT}`);

    // Keep live stock hot off the request path (the cold nearby search is slow). Prime each
    // brand now so the first visitor hits a warm cache; the warmer keeps it fresh. Failures non-fatal.
    startStockWarmer();
    // Prime every brand's main pool (and the nearby carousel for BMW/MINI), which also enrols
    // each in the warmer, so slow live walks (Motorrad, Ferrari, Honda) are paid at boot not on request.
    Promise.allSettled([
      fetchRetailerStock('bmw'), fetchNearbyStock('bmw'),
      fetchRetailerStock('mini'), fetchNearbyStock('mini'),
      fetchRetailerStock('honda'),
      fetchRetailerStock('ford'),
      fetchRetailerStock('motorrad'),
      fetchRetailerStock('ferrari'),
    ]).then((r) => {
      const failed = r.filter((x) => x.status === 'rejected');
      if (failed.length) {
        console.warn(`[warmer] initial prime: ${failed.length}/${r.length} pools cold (will retry on demand)`);
      } else {
        console.log('[warmer] initial stock primed (BMW + MINI + Honda + Ford + Motorrad + Ferrari)');
      }
    });
  });
}
