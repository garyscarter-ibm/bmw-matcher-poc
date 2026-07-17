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
import { brandConfig, normalizeBrand } from './brands.js';

// The stock platform is shared by BMW and MINI; only the origin and the
// default retailer differ per brand (see brands.js). Everything below is
// brand-parameterised: origin comes from brandConfig(brand), and caches/CSRF
// are keyed by brand so the two feeds never collide.
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

// The csrftoken is scoped to the origin (not the retailer), so cache one per
// brand origin. BMW and MINI are different origins → different tokens.
const csrfByOrigin = new Map(); // origin -> token

/** Fetch a brand's site root and capture its csrftoken cookie. */
async function bootstrap(origin) {
  const res = await httpsGet(`${origin}/`, { Accept: 'text/html' });
  const token = csrfFromSetCookie(res.headers['set-cookie']);
  if (!token) {
    throw new StockUnavailableError('CSRF bootstrap failed: no csrftoken cookie');
  }
  csrfByOrigin.set(origin, token);
  return token;
}

/** One page of the list endpoint for a brand's origin, CSRF handshake applied.
 *  `query` is everything but `page` — see byRetailerQuery / byDistanceQuery. */
async function fetchPage(origin, query, page) {
  const token = csrfByOrigin.get(origin);
  const url = `${origin}/vehicle/api/list/?${query}&page=${page}`;
  return httpsGet(url, {
    Accept: 'application/json',
    Cookie: `csrftoken=${token}`,
    'X-CSRFToken': token,
    Referer: `${origin}/`,
  });
}

/**
 * Fetch a page, transparently re-bootstrapping once if the token was rejected.
 * Any 403 (even mid-pagination) rotates the token and retries that page. The
 * CSRF token is scoped to the origin, so it's shared across every retailer of
 * the same brand this server proxies.
 */
async function fetchPageWithRetry(origin, query, page) {
  if (!csrfByOrigin.has(origin)) await bootstrap(origin);
  let res = await fetchPage(origin, query, page);
  if (res.status === 403) {
    await bootstrap(origin); // token likely rotated/expired
    res = await fetchPage(origin, query, page);
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

// Keyed by "brand:retailerSite" — each brand+retailer this server proxies gets
// its own cache entry so BMW and MINI (and different retailers) never clobber
// each other's stock. `inflight` holds the in-progress fetch promise so
// concurrent callers (and the background warmer) share one request instead of
// each triggering their own cold fetch.
const cacheByRetailer = new Map(); // "brand:retailerSite" -> { at, cars, inflight }
const cacheNearby = new Map(); // "brand:retailerSite" -> { at, cars, inflight }

// Every brand+retailer we've been asked about, so the warmer knows what to keep
// hot. Stored as { brand, retailerSite } objects keyed by "brand:retailer".
const seenRetailers = new Map(); // "brand:retailer" -> { brand, retailerSite }

/** Cache/seen key for a brand+retailer pair. */
const keyFor = (brand, retailerSite) => `${brand}:${retailerSite}`;

/** node:https has no argless Date.now ban — this is server runtime, fine to use. */
function fresh(entry) {
  return entry && entry.cars && Date.now() - entry.at < STOCK_TTL_MS;
}

/**
 * Read-through cache with single-flight: returns fresh cached cars, joins an
 * in-flight fetch if one is running, else starts one. `load()` does the actual
 * network work and returns the mapped cars. On success the entry is refreshed;
 * on failure a stale-but-usable entry is kept (the warmer will retry) and the
 * error propagates to any caller that was waiting on this fetch.
 *
 * @param {Map} cache the per-retailer cache map
 * @param {string} key retailer site ID
 * @param {() => Promise<Array>} load the network fetch
 */
function cachedFetch(cache, key, load) {
  const entry = cache.get(key);
  if (fresh(entry)) return Promise.resolve(entry.cars);
  if (entry?.inflight) return entry.inflight;

  const inflight = load().then(
    (cars) => {
      cache.set(key, { at: Date.now(), cars });
      return cars;
    },
    (err) => {
      // Drop only the in-flight marker; keep any stale cars so a transient
      // failure degrades to serving slightly old stock rather than nothing.
      const prev = cache.get(key);
      if (prev) delete prev.inflight;
      throw err;
    },
  );
  // Preserve stale cars (if any) alongside the in-flight promise.
  cache.set(key, { ...(entry || {}), inflight });
  return inflight;
}

/* ------------------------------ public API ---------------------------- */

/**
 * Fetch a retailer's full live stock for a brand, mapped to the engine's car
 * schema. Cached per brand+retailer for STOCK_TTL_MS. Throws
 * StockUnavailableError if the live feed can't be reached (no static fallback —
 * this tool is honestly live-only).
 *
 * @param {string} [brand] 'bmw' | 'mini' (defaults to bmw)
 * @param {string} [retailerSite] retailer_site ID; defaults to the brand's default
 * @returns {Promise<Array>} mapped car objects (mapping.js shape)
 */
export async function fetchRetailerStock(brand = 'bmw', retailerSite) {
  const b = normalizeBrand(brand);
  const { origin, defaultRetailer } = brandConfig(b);
  const site = retailerSite || defaultRetailer;
  const key = keyFor(b, site);
  seenRetailers.set(key, { brand: b, retailerSite: site });
  return cachedFetch(cacheByRetailer, key, async () => {
    const query = byRetailerQuery(site);
    let vehicles;
    try {
      const first = await fetchPageWithRetry(origin, query, 1);
      vehicles = [...(first.results || [])];
      const totalPages = Math.min(first.pagination?.total || 1, PAGE_LIMIT);
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await fetchPageWithRetry(origin, query, page);
        vehicles.push(...(next.results || []));
      }
    } catch (err) {
      if (err instanceof StockUnavailableError) throw err;
      throw new StockUnavailableError('Live stock fetch failed', { cause: err });
    }

    const cars = vehicles.map((v) => mapVehicle(v, b)).filter(Boolean);
    if (cars.length === 0) {
      throw new StockUnavailableError('Live feed returned no usable vehicles');
    }
    return cars;
  });
}

/* ------------------------- nearby-retailer stock ---------------------- */

// "brand:retailerSite" -> postcode. No TTL: a retailer's address doesn't move.
// The dealer directory is a combined BMW+MINI feed, so the dealer_number join
// works identically for both brands.
const postcodeByRetailer = new Map();

/**
 * The configured retailer's own postcode — the anchor every distance is
 * measured from.
 *
 * The used-car feed never states a retailer's location, but it does give us
 * `retailer_site.dealer_number`, and the (combined BMW+MINI) dealer directory
 * is keyed on exactly that (see dealers.js). One hop bridges the two:
 *
 *   retailer_site=96 → dealer_number 11107 → directory → "PH1 3GA"  (BMW)
 *   retailer_site=92 → dealer_number 15127 → directory → "LU4 8QN"  (MINI)
 *
 * @returns {Promise<string>} e.g. "PH1 3GA"
 */
async function resolveRetailerPostcode(origin, brand, retailerSite) {
  const key = keyFor(brand, retailerSite);
  const cached = postcodeByRetailer.get(key);
  if (cached) return cached;

  const first = await fetchPageWithRetry(origin, byRetailerQuery(retailerSite), 1);
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

  postcodeByRetailer.set(key, dealer.postcode);
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
 * @param {string} [brand] 'bmw' | 'mini' (defaults to bmw)
 * @param {string} [retailerSite] retailer_site ID; defaults to the brand's default
 * @returns {Promise<Array>} mapped car objects, nearest first
 */
export async function fetchNearbyStock(brand = 'bmw', retailerSite) {
  const b = normalizeBrand(brand);
  const { origin, defaultRetailer } = brandConfig(b);
  const site = retailerSite || defaultRetailer;
  const key = keyFor(b, site);
  seenRetailers.set(key, { brand: b, retailerSite: site });
  return cachedFetch(cacheNearby, key, async () => {
    let vehicles;
    try {
      const postcode = await resolveRetailerPostcode(origin, b, site);
      const query = byDistanceQuery(postcode);
      const first = await fetchPageWithRetry(origin, query, 1);
      vehicles = [...(first.results || [])];
      const totalPages = Math.min(first.pagination?.total || 1, NEARBY_PAGES);
      for (let page = 2; page <= totalPages; page += 1) {
        const next = await fetchPageWithRetry(origin, query, page);
        vehicles.push(...(next.results || []));
      }
    } catch (err) {
      if (err instanceof StockUnavailableError) throw err;
      throw new StockUnavailableError('Nearby stock fetch failed', { cause: err });
    }

    // String vs number: the feed's retailer_site.id is a number, the authored
    // config row is a string. Compare as strings so the anchor is really dropped.
    const anchor = String(site);
    const cars = vehicles
      .map((v) => mapVehicle(v, b))
      .filter(Boolean)
      .filter((car) => String(car.retailerId) !== anchor);

    // An empty pool means the search came back with nothing but the anchor's
    // own cars — implausible for 400 nearest vehicles, so treat it as a broken
    // feed rather than caching "no neighbours" for the whole TTL.
    if (cars.length === 0) {
      throw new StockUnavailableError('Nearby search returned no cars from other retailers');
    }

    return cars;
  });
}

/* --------------------------- background warmer ------------------------ */

// How often the warmer wakes. Default is 80% of the TTL, so an entry is
// refreshed before it expires and a user request never lands on a cold cache.
// (A ~15s cold nearby fetch inside a 5-min TTL leaves ample headroom.)
const WARM_INTERVAL_MS = Number(process.env.STOCK_WARM_INTERVAL_MS)
  || Math.round(STOCK_TTL_MS * 0.8);

/**
 * Refresh one pool for one retailer if its cached entry is missing or within a
 * warm-interval of expiring — proactively, off the request path. Reuses the
 * public fetchers, so single-flight de-dup means a warm that overlaps a user
 * request shares the same fetch. Errors are swallowed: the existing (stale)
 * entry keeps serving and the next tick retries.
 */
function warmOne(cache, key, brand, retailerSite, fetcher) {
  const entry = cache.get(key);
  // Skip if a fetch is already running, or the entry is comfortably fresh
  // (more than one warm-interval of life left) — nothing to do yet.
  if (entry?.inflight) return Promise.resolve();
  const ageOk = entry?.cars
    && Date.now() - entry.at < STOCK_TTL_MS - WARM_INTERVAL_MS;
  if (ageOk) return Promise.resolve();
  // Expire the entry so the fetcher's freshness check falls through and
  // actually re-fetches (rather than returning the about-to-expire cars).
  if (entry) entry.at = 0;
  return fetcher(brand, retailerSite).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(`[warmer] ${key} refresh failed:`, err?.message);
  });
}

let warmTimer = null;

/**
 * Start the background cache warmer. For every retailer we've served, it keeps
 * both stock pools hot so the slow cold fetch (chiefly the nearby distance
 * search) is paid off the request path instead of by a user. Idempotent; the
 * timer is unref'd so it never keeps the process alive on its own. Call once
 * from server boot — NOT on import, so tests and tooling don't fire network.
 *
 * @returns {() => void} a stop function (clears the interval)
 */
export function startStockWarmer() {
  if (warmTimer) return () => stopStockWarmer();

  const tick = () => {
    for (const [key, { brand, retailerSite }] of seenRetailers) {
      warmOne(cacheByRetailer, key, brand, retailerSite, fetchRetailerStock);
      warmOne(cacheNearby, key, brand, retailerSite, fetchNearbyStock);
    }
  };

  warmTimer = setInterval(tick, WARM_INTERVAL_MS);
  warmTimer.unref?.();
  return () => stopStockWarmer();
}

/** Stop the warmer (used by the stop function; handy for tests). */
export function stopStockWarmer() {
  if (warmTimer) {
    clearInterval(warmTimer);
    warmTimer = null;
  }
}
