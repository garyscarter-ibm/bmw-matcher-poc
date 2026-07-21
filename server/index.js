/*
 * BMW Matcher API — zero-dependency Node HTTP server.
 *
 * Runs the matching engine server-side so the scoring weights (engine.js)
 * never reach the browser, and fetches live used-car stock from a real BMW
 * retailer (stock.js) so matches are cars you can actually buy today. The
 * EDS block calls:
 *
 *   GET  /api/questions  → quiz definition (showIf functions stripped)
 *   POST /api/match      → { answers } → { matches } from the configured
 *                          retailer's own stock (fast path). Display-only car
 *                          fields (no tags/specs the engine uses internally,
 *                          so the dataset can't be rebuilt).
 *   POST /api/preview    → { answers } → { matches }: the top few from the
 *                          configured retailer's stock for the quiz's live
 *                          "best guess" drawer. Same scoring + cache as
 *                          /api/match, just a wider slice — served hot from the
 *                          warmed cache so mid-quiz refreshes are cheap.
 *   POST /api/nearby     → { answers } → { nearby }: the best matches at
 *                          *other* retailers close by, each carrying a real
 *                          distance in miles. Split from /api/match so its
 *                          slow national search never blocks the hero matches;
 *                          degrades to [] on any failure (HTTP 200).
 *   GET  /health         → { ok: true }
 *
 * Portable: no framework, no build step. Deploy behind any host; set PORT.
 */

import { createServer } from 'node:http';

import {
  matchCars, rankCars, budgetRange, unmetWants, TOP_MATCHES,
} from './engine.js';
import {
  fetchRetailerStock, fetchNearbyStock, startStockWarmer, StockUnavailableError,
} from './stock.js';
import {
  QUESTIONS, BUDGET_BANDS, questionsForBrand, applyBespokeAnswers,
} from './questions.js';
import { normalizeBrand, brandTuning } from './brands.js';

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 16 * 1024; // quiz answers are tiny; reject anything bigger

// How many matches the quiz's live "best guess" drawer shows. Wider than the
// results page's TOP_MATCHES (3) — it's a browse-the-shortlist glance, not the
// final recommendation. The retailer may hold fewer that survive the filters;
// the block renders however many come back.
const PREVIEW_COUNT = 9;

const CORS_HEADERS = {
  // Public, read-only tool — responses carry no secrets. Tighten to the EDS
  // origin here if you want to lock it down later.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
 * Quiz definition for the client, for a given brand. Options the brand doesn't
 * sell are filtered out (questionsForBrand); `showIf` predicates can't cross
 * JSON, so we drop them and mark conditional questions — the block applies the
 * matching predicate from quiz-meta.js by question id.
 */
function publicQuestions(brand) {
  return questionsForBrand(brand)
    .map(({ showIf, ...q }) => (showIf ? { ...q, conditional: true } : q));
}

/**
 * Project a car down to only the fields the result cards render (see
 * matchCard() in bmw-matcher.js). Internal scoring fields — tags, sizeClass,
 * seats, boot, id — are omitted so responses can't be used to reconstruct the
 * dataset. The real display fields (mileage, plate, photo, retailerName, link)
 * come from the live feed and are passed through where present.
 *
 * `retailerId` is deliberately absent: it exists only so fetchNearbyStock can
 * drop the anchor retailer's own cars, and the block has no use for it.
 */
function publicCar(car) {
  return {
    name: car.name,
    line: car.line,
    body: car.body,
    fuel: car.fuel,
    priceMin: car.priceMin,
    priceMax: car.priceMax,
    zeroTo62: car.zeroTo62,
    mpg: car.mpg,
    evRange: car.evRange,
    blurb: car.blurb,
    // Live retailer detail (present when sourced from the live feed).
    mileage: car.mileage,
    plate: car.plate,
    photo: car.photo,
    retailerName: car.retailerName,
    link: car.link,
    // Miles from the configured retailer. Only set on `nearby` cars — the
    // hero matches are the configured retailer's own stock.
    distance: car.distance,
  };
}

function publicMatch({ car, score, stretch, reasons }) {
  return { car: publicCar(car), score, stretch, reasons };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
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
 * Parse + validate the { answers, retailer } POST body shared by /api/match
 * and /api/nearby. Returns { answers, retailer } on success, or { error,
 * status } for the caller to send. Kept in one place so both endpoints
 * validate identically.
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
  // Budget is now a continuous number from the slider, but legacy b1–b5 band
  // keys are still honoured (old shared links). budgetRange resolves both to a
  // [min, max]; a null means neither a valid number nor a known band.
  if (!budgetRange(answers)) {
    return { error: 'Invalid or missing budget', status: 400 };
  }
  const retailer = typeof body.retailer === 'string' && body.retailer ? body.retailer : undefined;
  // Brand selects the feed (BMW vs MINI). normalizeBrand defaults unknown/absent
  // to BMW, so old clients that don't send a brand keep working.
  const brand = normalizeBrand(body.brand);
  return { answers, retailer, brand };
}

/**
 * The retailer's own matches — the fast path. Scores against just the
 * retailer's live stock (one feed, ~3 pages), so the results page can render
 * the hero + "More at" tier without waiting on the slower national nearby
 * search, which the block now fetches separately via /api/nearby.
 */
async function handleMatch(req, res) {
  const {
    answers, retailer, brand, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  // Live proxy: score against the retailer's real stock, not a static file.
  // If the live feed can't be reached, return a friendly 5xx — the block's
  // retry UI handles it. No static fallback (this tool is honestly live-only).
  let cars;
  try {
    cars = await fetchRetailerStock(brand, retailer);
  } catch (err) {
    if (err instanceof StockUnavailableError) {
      return sendJson(res, 502, { error: 'Live stock is temporarily unavailable' });
    }
    return sendJson(res, 500, { error: 'Something went wrong finding matches' });
  }

  // Fold any bespoke per-brand question answers into the standard fields the
  // engine scores (see applyBespokeAnswers) before ranking.
  const scored = applyBespokeAnswers(brand, answers);
  const { matches } = matchCars(scored, cars, brandTuning(brand));
  // What this retailer couldn't offer, so the page can say so instead of
  // quietly serving the closest thing (see unmetWants). Reported against the
  // folded answers — those are the wants actually searched for. Half the
  // picture: the block waits for /api/nearby to agree before telling the user
  // a want is genuinely unavailable.
  return sendJson(res, 200, {
    matches: matches.map(publicMatch),
    unmet: unmetWants(scored, cars),
  });
}

/**
 * The quiz's live "best guess" — the same scoring as /api/match against the
 * same (cached) retailer stock, just a wider PREVIEW_COUNT slice for the
 * drawer that re-ranks as each question is answered. Shares fetchRetailerStock's
 * cache key with /api/match, so a quiz's stream of refreshes hits the warmed
 * cache and adds no upstream traffic. Requires a budget (readMatchRequest
 * enforces it) — the block only calls this once budget is set.
 */
async function handlePreview(req, res) {
  const {
    answers, retailer, brand, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  let cars;
  try {
    cars = await fetchRetailerStock(brand, retailer);
  } catch (err) {
    if (err instanceof StockUnavailableError) {
      return sendJson(res, 502, { error: 'Live stock is temporarily unavailable' });
    }
    return sendJson(res, 500, { error: 'Something went wrong finding matches' });
  }

  // The preview scores partial answer sets (only budget is guaranteed), so
  // guard the ranking too: a scorer that trips on an unanswered question must
  // degrade to "no guess yet" (empty list, HTTP 200 — the drawer is a bonus),
  // never take the process down with an uncaught throw.
  let matches = [];
  try {
    matches = rankCars(applyBespokeAnswers(brand, answers), cars, brandTuning(brand)).slice(0, PREVIEW_COUNT);
  } catch (err) {
    console.warn('[preview] ranking failed:', err?.message);
  }
  return sendJson(res, 200, { matches: matches.map(publicMatch) });
}

/**
 * Cars at OTHER nearby retailers — the slow path (a national, distance-sorted
 * search over several extra pages). Split out from /api/match so its latency
 * never blocks the hero matches. This section is a bonus, so any failure
 * degrades to an empty list (HTTP 200) rather than an error the block must
 * surface — the block simply omits the "Worth the drive" section.
 *
 * `unmet` reports the wants this pool couldn't offer (see unmetWants), and is
 * deliberately `null` — not `{}` — when the lookup failed. The block only
 * tells a user a want is unavailable once both halves agree it is, so it has
 * to tell "nearby found nothing that fits" (a fact) apart from "we never
 * heard back from nearby" (an absence of facts, which claims nothing).
 */
async function handleNearby(req, res) {
  const {
    answers, retailer, brand, error, status,
  } = await readMatchRequest(req);
  if (error) return sendJson(res, status, { error });

  let nearby = [];
  let unmet = null;
  try {
    const cars = await fetchNearbyStock(brand, retailer);
    const scored = applyBespokeAnswers(brand, answers);
    nearby = rankCars(scored, cars, brandTuning(brand)).slice(0, TOP_MATCHES);
    unmet = unmetWants(scored, cars);
  } catch (err) {
    console.warn('[nearby] stock unavailable:', err?.message);
  }

  return sendJson(res, 200, { nearby: nearby.map(publicMatch), unmet });
}

const server = createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/questions') {
    // Brand comes on the query string (?brand=mini) for this GET; the question
    // set's option list is filtered to what that brand sells. Defaults to BMW.
    // topMatches ships too so the intro can say how many results it'll return
    // without hardcoding it — see TOP_MATCHES, the value /api/match slices to.
    const brand = normalizeBrand(searchParams.get('brand'));
    return sendJson(res, 200, {
      questions: publicQuestions(brand),
      budgetBands: BUDGET_BANDS,
      topMatches: TOP_MATCHES,
    });
  }

  if (req.method === 'POST' && pathname === '/api/match') {
    return handleMatch(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/preview') {
    return handlePreview(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/nearby') {
    return handleNearby(req, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Matcher API listening on http://localhost:${PORT}`);

  // Keep live stock hot off the request path so the slow cold fetch (chiefly
  // the nearby distance search) isn't paid by a user. Prime each brand's
  // default retailer now so even the first visitor hits a warm cache; the
  // warmer then keeps every served brand+retailer fresh. Failures are
  // non-fatal — the request path still fetches on demand.
  startStockWarmer();
  Promise.allSettled([
    fetchRetailerStock('bmw'), fetchNearbyStock('bmw'),
    fetchRetailerStock('mini'), fetchNearbyStock('mini'),
  ]).then((r) => {
    const failed = r.filter((x) => x.status === 'rejected');
    if (failed.length) {
      console.warn(`[warmer] initial prime: ${failed.length}/${r.length} pools cold (will retry on demand)`);
    } else {
      console.log('[warmer] initial stock primed (BMW + MINI)');
    }
  });
});
