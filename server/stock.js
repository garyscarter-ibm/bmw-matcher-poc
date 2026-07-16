/*
 * Live retailer-stock client for usedcars.bmw.co.uk.
 *
 * Grassick's BMW (Perth) used stock is served by usedcars.bmw.co.uk — an
 * Auto Trader-powered platform shared by all BMW UK retailers. This module
 * fetches that stock on demand and returns it mapped to the engine's car
 * schema (see mapping.js). The matcher scores against real, buyable cars
 * instead of the static curated dataset.
 *
 * Two wrinkles the implementation has to handle:
 *  1. The list endpoint is CSRF-gated even for GET — a naked request gets
 *     403. We bootstrap a csrftoken cookie from the site root, then send it
 *     back as both a Cookie and an X-CSRFToken header (+ a Referer).
 *  2. Local dev runs on Node 16, which has no global fetch — so this uses
 *     node:https directly (zero-dep, works on every Node version).
 *
 * The token can rotate/expire, so any 403 triggers a single re-bootstrap.
 * Mapped results are cached in-memory for a short TTL so /api/match doesn't
 * refetch the whole retailer on every quiz submission.
 */

import { request } from 'node:https';

import { lookupDealer } from './dealers.js';
import { mapVehicle } from './mapping.js';

const ORIGIN = 'https://usedcars.bmw.co.uk';
// Server-wide fallback when a request doesn't specify a retailer (e.g. the
// block wasn't configured with a "Retailer ID" row). Per-request retailer
// selection is the normal path — see fetchGrassickStock().
const DEFAULT_RETAILER_SITE = process.env.RETAILER_SITE || '96'; // 96 = Grassicks Garage
const STOCK_TTL_MS = Number(process.env.STOCK_TTL_MS) || 5 * 60 * 1000; // 5 min
const PAGE_LIMIT = 10; // safety cap on pagination (stock is ~3 pages)

// Nearby search depth. 4 pages × 100 reaches the 5 nearest retailers from
// Perth (~31 miles out) — ample for a top-3 carousel, and nowhere near the
// ~132-page national list. Lower this first if cold-cache latency bites.
const NEARBY_PAGES = Number(process.env.NEARBY_PAGES) || 4;
const NEARBY_PAGE_SIZE = Number(process.env.NEARBY_PAGE_SIZE) || 100; // API caps at 100

// A real browser UA — the platform serves bot-y clients differently.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Error tag so index.js can distinguish "live stock down" from other faults. */
export class StockUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'StockUnavailableError';
    this.statusCode = 502;
    if (cause) this.cause = cause;
  }
}

/* --------------------------- low-level HTTPS --------------------------- */

/** GET a URL over node:https. Resolves { status, headers, body }. */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers: { 'User-Agent': USER_AGENT, ...headers } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

/** Pull the csrftoken value out of a set-cookie header array. */
function csrfFromSetCookie(setCookie) {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
  for (const c of cookies) {
    const m = /(?:^|;\s*)csrftoken=([^;]+)/.exec(c);
    if (m) return m[1];
  }
  return null;
}

/* ------------------------------ CSRF cache ---------------------------- */

let csrf = null; // { token } once bootstrapped

/** Fetch the site root and capture its csrftoken cookie. */
async function bootstrap() {
  const res = await httpsGet(`${ORIGIN}/`, { Accept: 'text/html' });
  const token = csrfFromSetCookie(res.headers['set-cookie']);
  if (!token) {
    throw new StockUnavailableError('CSRF bootstrap failed: no csrftoken cookie');
  }
  csrf = { token };
  return csrf;
}

/** One page of the list endpoint, with the CSRF handshake applied.
 *  `query` is everything but `page` — see byRetailerQuery / byDistanceQuery. */
async function fetchPage(query, page) {
  const url = `${ORIGIN}/vehicle/api/list/?${query}&page=${page}`;
  return httpsGet(url, {
    Accept: 'application/json',
    Cookie: `csrftoken=${csrf.token}`,
    'X-CSRFToken': csrf.token,
    Referer: `${ORIGIN}/`,
  });
}

/**
 * Fetch a page, transparently re-bootstrapping once if the token was rejected.
 * Any 403 (even mid-pagination) rotates the token and retries that page. The
 * CSRF token is scoped to the origin, not the retailer, so it's shared across
 * every retailer this server proxies.
 */
async function fetchPageWithRetry(query, page) {
  if (!csrf) await bootstrap();
  let res = await fetchPage(query, page);
  if (res.status === 403) {
    await bootstrap(); // token likely rotated/expired
    res = await fetchPage(query, page);
  }
  if (res.status !== 200) {
    throw new StockUnavailableError(`list/ returned HTTP ${res.status} on page ${page}`);
  }
  try {
    return JSON.parse(res.body);
  } catch (cause) {
    throw new StockUnavailableError('list/ returned non-JSON', { cause });
  }
}

/** All of one retailer's stock, unsorted, no distances. */
const byRetailerQuery = (retailerSite) => `retailer_site=${encodeURIComponent(retailerSite)}`;

/**
 * Stock nationwide, nearest-first from `postcode`, with a `distance` on every
 * vehicle's retailer_site.
 *
 * The parameter is `location` — NOT `postcode`. `?postcode=…&distance=…` is
 * accepted and then *silently ignored*: it returns the same unsorted national
 * list for any input, which looks like it works until you compare two towns.
 * `payment_type` and `source` mirror the site's own home-page search.
 */
const byDistanceQuery = (postcode) => `location=${encodeURIComponent(postcode)}`
  + `&payment_type=cash&size=${NEARBY_PAGE_SIZE}&sort=distance&source=home`;

/* ------------------------------ TTL cache ----------------------------- */

// Keyed by retailer site ID — each retailer this server proxies for gets its
// own cache entry so concurrent requests for different retailers don't
// clobber each other's stock.
const cacheByRetailer = new Map(); // retailerSite -> { at: epochMs, cars: Car[] }
const cacheNearby = new Map(); // retailerSite -> { at: epochMs, cars: Car[] }

/** node:https has no argless Date.now ban — this is server runtime, fine to use. */
function fresh(entry) {
  return entry && Date.now() - entry.at < STOCK_TTL_MS;
}

/* ------------------------------ public API ---------------------------- */

/**
 * Fetch a retailer's full live stock, mapped to the engine's car schema.
 * Cached per-retailer for STOCK_TTL_MS. Throws StockUnavailableError if the
 * live feed can't be reached (no static fallback — this tool is honestly
 * live-only).
 *
 * @param {string} [retailerSite] retailer_site ID; defaults to DEFAULT_RETAILER_SITE
 * @returns {Promise<Array>} mapped car objects (mapping.js shape)
 */
export async function fetchGrassickStock(retailerSite = DEFAULT_RETAILER_SITE) {
  const cached = cacheByRetailer.get(retailerSite);
  if (fresh(cached)) return cached.cars;

  const query = byRetailerQuery(retailerSite);
  let vehicles;
  try {
    const first = await fetchPageWithRetry(query, 1);
    vehicles = [...(first.results || [])];
    const totalPages = Math.min(first.pagination?.total || 1, PAGE_LIMIT);
    for (let page = 2; page <= totalPages; page += 1) {
      const next = await fetchPageWithRetry(query, page);
      vehicles.push(...(next.results || []));
    }
  } catch (err) {
    if (err instanceof StockUnavailableError) throw err;
    throw new StockUnavailableError('Live stock fetch failed', { cause: err });
  }

  const cars = vehicles.map(mapVehicle).filter(Boolean);
  if (cars.length === 0) {
    throw new StockUnavailableError('Live feed returned no usable vehicles');
  }
  cacheByRetailer.set(retailerSite, { at: Date.now(), cars });
  return cars;
}

/* ------------------------- nearby-retailer stock ---------------------- */

// retailerSite -> postcode. No TTL: a retailer's address doesn't move.
const postcodeByRetailer = new Map();

/**
 * The configured retailer's own postcode — the anchor every distance is
 * measured from.
 *
 * The used-car feed never states a retailer's location, but it does give us
 * `retailer_site.dealer_number`, and BMW's dealer directory is keyed on
 * exactly that (see dealers.js). One hop bridges the two:
 *
 *   retailer_site=96 → dealer_number 11107 → directory → "PH1 3GA"
 *
 * @returns {Promise<string>} e.g. "PH1 3GA"
 */
async function resolveRetailerPostcode(retailerSite) {
  const cached = postcodeByRetailer.get(retailerSite);
  if (cached) return cached;

  const first = await fetchPageWithRetry(byRetailerQuery(retailerSite), 1);
  const dealerNumber = (first.results || [])
    .map((v) => v?.retailer_site?.dealer_number)
    .find(Boolean);
  if (!dealerNumber) {
    throw new StockUnavailableError(`Retailer ${retailerSite} reports no dealer_number`);
  }

  const dealer = await lookupDealer(dealerNumber);
  if (!dealer?.postcode) {
    throw new StockUnavailableError(`Dealer ${dealerNumber} is not in the directory`);
  }

  postcodeByRetailer.set(retailerSite, dealer.postcode);
  return dealer.postcode;
}

/**
 * Stock at *other* retailers near the configured one, nearest first, each car
 * carrying a real `distance` in miles.
 *
 * The anchor retailer's own cars are dropped: the hero matches are already its
 * stock, so the carousel exists to answer a different question ("what's worth
 * a short drive?"). That also keeps every distance non-zero and honest.
 *
 * Callers should treat a throw as "no carousel", not "no results" — the hero
 * matches don't depend on this.
 *
 * @param {string} [retailerSite] retailer_site ID; defaults to DEFAULT_RETAILER_SITE
 * @returns {Promise<Array>} mapped car objects, nearest first
 */
export async function fetchNearbyStock(retailerSite = DEFAULT_RETAILER_SITE) {
  const cached = cacheNearby.get(retailerSite);
  if (fresh(cached)) return cached.cars;

  let vehicles;
  try {
    const postcode = await resolveRetailerPostcode(retailerSite);
    const query = byDistanceQuery(postcode);
    const first = await fetchPageWithRetry(query, 1);
    vehicles = [...(first.results || [])];
    const totalPages = Math.min(first.pagination?.total || 1, NEARBY_PAGES);
    for (let page = 2; page <= totalPages; page += 1) {
      const next = await fetchPageWithRetry(query, page);
      vehicles.push(...(next.results || []));
    }
  } catch (err) {
    if (err instanceof StockUnavailableError) throw err;
    throw new StockUnavailableError('Nearby stock fetch failed', { cause: err });
  }

  // String vs number: the feed's retailer_site.id is a number, the authored
  // config row is a string. Compare as strings so the anchor is really dropped.
  const anchor = String(retailerSite);
  const cars = vehicles
    .map(mapVehicle)
    .filter(Boolean)
    .filter((car) => String(car.retailerId) !== anchor);

  // An empty pool means the search came back with nothing but the anchor's own
  // cars — implausible for 400 nearest vehicles, so treat it as a broken feed
  // rather than caching "no neighbours" for the whole TTL.
  if (cars.length === 0) {
    throw new StockUnavailableError('Nearby search returned no cars from other retailers');
  }

  cacheNearby.set(retailerSite, { at: Date.now(), cars });
  return cars;
}
