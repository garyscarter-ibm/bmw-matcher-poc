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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { lookupDealer } from './dealers.js';
import { mapVehicle, mapMotorradRaw, mapHondaRaw } from './mapping.js';
import { brandConfig, normalizeBrand } from './brands.js';
import { parseListingHtml, listingUrl } from './honda-listing.js';

// Repo root, from this module's location (server/ → ..). Used to resolve the
// fixtures directory for fixtures-backed brands without depending on cwd.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

/** POST a JSON body over node:https. Resolves { status, headers, body }.
 *  Used by the Motorrad live adapter, whose feed is a POST endpoint (the BMW/
 *  MINI feed is GET-only and never touches this). */
function httpsPostJson(url, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': payload.length,
          ...headers,
        },
      },
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
    req.write(payload);
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

/* ---------------------------- fixtures source ------------------------- *
 * Some brands' live feeds aren't reachable yet (a bot-walled edge, or an SPA
 * whose API we can't replay), so their stock is seeded into a committed
 * snapshot at fixtures/<brand>-cars.json — the SAME already-mapped car shape
 * mapVehicle produces, so the engine, modes and every downstream fetcher treat
 * it identically to live stock. A brand opts into this with `source: 'fixtures'`
 * on its registry entry; BMW and MINI stay `source: 'feed'` and never touch
 * this code. The real fetch adapter can be wired later and the brand flipped
 * back to 'feed' with no other change.
 * --------------------------------------------------------------------- */

// brand -> parsed fixtures array. Read once per process (the file is static for
// a run); cars are already mapped so there's no per-request work to cache.
const fixturesByBrand = new Map();

/** Load and cache a brand's fixtures snapshot. The file is `<brand>-cars.json`
 *  by default; a brand whose stock isn't cars (Motorrad's bikes) overrides it
 *  with `fixturesFile` on its registry entry. Throws StockUnavailableError with
 *  a clear message if the file is missing or unusable, so a mis-seeded brand
 *  fails loudly rather than serving an empty pool. */
function loadFixtures(brand) {
  if (fixturesByBrand.has(brand)) return fixturesByBrand.get(brand);
  const { fixturesFile } = brandConfig(brand);
  const path = join(REPO_ROOT, 'fixtures', fixturesFile || `${brand}-cars.json`);
  let cars;
  try {
    cars = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    throw new StockUnavailableError(
      `Fixtures source for "${brand}" could not be read at ${path}`,
      { cause },
    );
  }
  if (!Array.isArray(cars) || cars.length === 0) {
    throw new StockUnavailableError(`Fixtures for "${brand}" are empty or malformed`);
  }
  fixturesByBrand.set(brand, cars);
  return cars;
}

/** All of a fixtures-backed brand's stock for a retailer. The snapshot is a
 *  single retailer's inventory (or a curated set), so we return the whole pool;
 *  if the caller named a specific retailerSite, narrow to it when the cars carry
 *  one, else serve everything (a curated showcase set may not tag a retailer). */
function fixturesRetailerStock(brand, retailerSite) {
  const cars = loadFixtures(brand);
  if (retailerSite == null) return cars;
  const site = String(retailerSite);
  const narrowed = cars.filter((c) => c?.retailerId != null && String(c.retailerId) === site);
  return narrowed.length ? narrowed : cars;
}

/* ---------------------------- live Honda feed ------------------------- *
 * Honda's approved-used stock (usedcars.honda.co.uk) has no JSON API, but its
 * listing pages are fully server-rendered — so "live" here means fetch the real
 * listing HTML and parse it, the same parse that built the snapshot (see
 * honda-listing.js). Unlike BMW/MINI (Auto Trader JSON at /vehicle/api/list/),
 * this is HTML, so it gets its own adapter rather than the feed path.
 *
 * Honda's listing has NO dealer-id filter; it filters by LOCATION (a postcode +
 * a radius in miles — the site's "search near me"). That maps cleanly onto the
 * matcher's existing "near you" concept: fetchRetailerStock pulls the national
 * pool, and a caller can narrow by passing a postcode/radius (see hondaLiveStock
 * opts). Cards carry no stable per-dealer identity in the markup, so every car
 * keeps the single "Honda Approved Used" retailer tag the snapshot uses.
 *
 * Dormant while the registry says `source: 'fixtures'`; flip Honda to
 * `source: 'live-honda'` and it fetches live, degrading to the snapshot on any
 * failure so the deck is never blank. The parse and the mapper are shared with
 * the snapshot path, so a live car is indistinguishable from a fixture car.
 * --------------------------------------------------------------------- */

// How many listing pages to pull. The live inventory is small (a dozen or so
// under the approved-used programme at any time) and pages repeat once exhausted,
// so we stop as soon as a page yields no NEW cars. This is the safety cap.
const HONDA_PAGE_LIMIT = Number(process.env.HONDA_PAGE_LIMIT) || 8;

/**
 * Fetch and map the live Honda pool. Walks listing pages until one adds no new
 * cars (the inventory is small and pages repeat past the end), dedupes by the
 * real PDP link, and maps each raw record through the shared mapHondaRaw — the
 * identical projection the snapshot uses.
 *
 * @param {{zip?: string, radius?: number}} [opts] optional location filter:
 *   a postcode + radius (miles) narrows to stock near that location, which is
 *   how Honda expresses "a dealer near you" (it has no dealer-id filter).
 * @returns {Promise<Array>} mapped Honda cars
 */
async function hondaLiveStock(opts = {}) {
  const seen = new Set();
  const cars = [];
  for (let page = 1; page <= HONDA_PAGE_LIMIT; page += 1) {
    const url = listingUrl(page, opts);
    // eslint-disable-next-line no-await-in-loop
    const res = await httpsGet(url, { Accept: 'text/html' });
    if (res.status !== 200) {
      // A first-page failure is fatal (nothing to serve); a later-page failure
      // just ends pagination with what we have.
      if (page === 1) throw new StockUnavailableError(`Honda listing returned HTTP ${res.status}`);
      break;
    }
    const raw = parseListingHtml(res.body);
    let added = 0;
    for (const rec of raw) {
      if (seen.has(rec.link)) continue;
      seen.add(rec.link);
      const car = mapHondaRaw(rec);
      if (car) { cars.push(car); added += 1; }
    }
    // No new cars on this page → we've walked the whole (small) inventory.
    if (added === 0) break;
  }
  if (cars.length === 0) {
    throw new StockUnavailableError('Honda listing returned no usable cars');
  }
  return cars;
}

/* --------------------------- live Motorrad feed ----------------------- *
 * Motorrad's approved-used stock is served by a session-gated ASP.NET app
 * behind ResultOverview/ShowResultsFilterChanged: a POST endpoint that takes a
 * filter body and returns the result set inside a SearchFilter envelope. It is
 * cross-origin and iframe-embedded, and returns a NULL envelope to any request
 * without a live GMB session (see the Motorrad section of DECISIONS.md), so it
 * cannot be reached from this environment — which is why Motorrad ships on
 * curated fixtures today.
 *
 * This is the real adapter, wired against that discovered contract. It stays
 * dormant while the registry says `source: 'fixtures'`; flip Motorrad to
 * `source: 'live-motorrad'` (and run from an origin that carries a session, or
 * pass MOTORRAD_SESSION) and it lights up with NO other change. It reuses the
 * same map-then-filter path and the same StockUnavailableError contract as the
 * BMW/MINI feed, so a caller can't tell a live brand from a fixtures one.
 * --------------------------------------------------------------------- */

// The result-overview endpoint, relative to the brand origin. Confirmed live
// this session: the app's own bundle builds it as `<ApplPath>api/` + route (see
// ServiceCallResOV.showResOverviewFilterChanged), and ApplPath on the UK site is
// "/", so the JSON route is /api/ResultOverview/ShowResultsFilterChanged. The
// older /UK/... path returns the HTML shell, not JSON. Kept here (not in the
// registry) because it's an implementation detail of this adapter.
const MOTORRAD_FEED_PATH = '/api/ResultOverview/ShowResultsFilterChanged';

// The GMB session id. The endpoint authenticates with a `GMB-SID` REQUEST HEADER
// (the bundle reads it from the page's hidden #hfSID field: a base64 of
// "<caller-ip>;<guid>" the server issues per session and binds to that browser).
// With the correct route + header the endpoint returns real JSON; without the
// SID it returns a null envelope. The SID is issued to a live browser session,
// so it's supplied out-of-band by the host (never invented here).
const MOTORRAD_SESSION = process.env.MOTORRAD_SESSION || '';

// The filter body the endpoint expects. Confirmed this session: MarktId (2 for
// the UK market, from the page's #hfMarktID) is required, and InitFilter:true
// asks for the unfiltered result set (all approved-used bikes); the matcher does
// its own scoring downstream, so we pull the whole pool once rather than
// round-tripping the site's own facets. The market/culture fields mirror the
// page's hidden inputs. Extra facets can be merged in later without touching the
// plumbing.
const MOTORRAD_FILTER_BODY = {
  InitFilter: true, MarktId: 2, MarktISO2: 'UK', RC: 'en-gb',
};

/**
 * Dig the vehicle rows out of the SearchFilter envelope. The contract nests the
 * rows under SearchFilter.ResOverviewData.ResTable (with a totalItemCount
 * alongside); older captures put them directly under ResTable. We accept either
 * and normalise to a flat array, so a shape drift on their side degrades to
 * "empty" (a clean StockUnavailableError) rather than a crash.
 */
export function motorradRowsFromEnvelope(env) {
  const sf = env?.SearchFilter ?? env;
  const table = sf?.ResOverviewData?.ResTable ?? sf?.ResTable ?? env?.ResTable;
  const rows = table?.Items ?? table?.items ?? (Array.isArray(table) ? table : []);
  return Array.isArray(rows) ? rows : [];
}

/**
 * Project one live result row into the flat shape mapMotorradRaw consumes. The
 * live field names aren't confirmable from here (the endpoint won't answer
 * without a session), so this reads a spread of plausible keys and leaves the
 * canonical projection (category, cc, licence band, blurb) to mapMotorradRaw —
 * the same mapper the fixtures go through. When the real field names land, only
 * this adapter changes; mapMotorradRaw and everything downstream stay put.
 */
export function motorradRowToRaw(row = {}) {
  // sliderImageLinks/ImageLinks are arrays of photo URLs (the app binds the first
  // to the overview thumbnail via item.ImageSrc); take the first as the card photo.
  const firstImage = (v) => (Array.isArray(v) ? v.find(Boolean) : v) || undefined;
  return {
    id: row.Id ?? row.id ?? row.AngebotsNo ?? row.StockNumber ?? row.VehicleId,
    title: row.Title ?? row.Name ?? row.ModelName ?? row.Bezeichnung ?? row.Description,
    price: row.Price ?? row.Preis ?? row.CashPrice ?? row.PriceValue,
    mileage: row.Mileage ?? row.KM ?? row.Odometer ?? row.Miles,
    reg: row.Registration ?? row.Reg ?? row.NumberPlate,
    fuel: row.Fuel ?? row.FuelType ?? row.Antrieb,
    // Overview rows carry ImageSrc; detail/slider rows carry sliderImageLinks /
    // ImageLinks arrays. Accept all, first URL wins. (Field names confirmed from
    // the site's own Angular bundle this session.)
    image: firstImage(row.ImageSrc ?? row.sliderImageLinks ?? row.ImageLinks
      ?? row.ThumbnailLinks ?? row.ImageUrl ?? row.Image ?? row.MainImage),
    link: row.DetailUrl ?? row.Url ?? row.Link,
  };
}

/** Fetch and map the whole live Motorrad pool. Throws StockUnavailableError on
 *  any failure (no session, non-200, null envelope, non-JSON, empty result), so
 *  it drops into the same degrade-to-fixtures/error path as the BMW/MINI feed. */
async function motorradLiveStock(origin) {
  const url = `${origin}${MOTORRAD_FEED_PATH}`;
  const headers = {
    Referer: `${origin}/UK/Home.cshtml?id=UK&RC=en-gb`,
    Accept: 'application/json, text/plain, */*',
  };
  // The endpoint authenticates with a GMB-SID request header (the value the site
  // embeds in #hfSID). Forward one if the host supplied it. Without it the
  // endpoint answers 200 but with a null envelope (no live session).
  if (MOTORRAD_SESSION) headers['GMB-SID'] = MOTORRAD_SESSION;

  let res;
  try {
    res = await httpsPostJson(url, MOTORRAD_FILTER_BODY, headers);
  } catch (cause) {
    throw new StockUnavailableError('Motorrad live feed request failed', { cause });
  }
  if (res.status !== 200) {
    throw new StockUnavailableError(`Motorrad feed returned HTTP ${res.status}`);
  }
  let env;
  try {
    env = JSON.parse(res.body);
  } catch (cause) {
    throw new StockUnavailableError('Motorrad feed returned non-JSON', { cause });
  }
  // A null SearchFilter is the signature of a request with no live session.
  if (env?.SearchFilter === null && env?.ResTable == null) {
    throw new StockUnavailableError(
      'Motorrad feed returned a null envelope (no live session)',
    );
  }
  const bikes = motorradRowsFromEnvelope(env)
    .map(motorradRowToRaw)
    .map(mapMotorradRaw)
    .filter(Boolean);
  if (bikes.length === 0) {
    throw new StockUnavailableError('Motorrad feed returned no usable bikes');
  }
  return bikes;
}

/* ------------------------------ public API ---------------------------- */

/**
 * Fetch a retailer's full stock for a brand, mapped to the engine's car schema.
 * For `source: 'feed'` brands (BMW, MINI) this is the live Auto Trader platform,
 * cached per brand+retailer for STOCK_TTL_MS. For `source: 'fixtures'` brands it
 * reads the committed snapshot (no network). Throws StockUnavailableError if the
 * chosen source can't be reached.
 *
 * @param {string} [brand] brand key (defaults to bmw)
 * @param {string} [retailerSite] retailer_site ID; defaults to the brand's default
 * @returns {Promise<Array>} mapped car objects (mapping.js shape)
 */
export async function fetchRetailerStock(brand = 'bmw', retailerSite) {
  const b = normalizeBrand(brand);
  const { origin, defaultRetailer, source } = brandConfig(b);
  const site = retailerSite || defaultRetailer;

  // Fixtures-backed brands never touch the network or the TTL cache — the
  // snapshot is static for the run and the cars are already mapped.
  if (source === 'fixtures') return fixturesRetailerStock(b, site);

  // Honda's live feed, when the registry opts into it. The listing is
  // server-rendered HTML (not JSON), so it has its own adapter; it's cached like
  // the BMW/MINI feed and degrades to the snapshot on any failure so the deck is
  // never blank. Honda filters by location (postcode + radius), not dealer id —
  // fetchNearbyStock handles the "near you" narrowing; here we pull the pool.
  if (source === 'live-honda') {
    const key = keyFor(b, site);
    seenRetailers.set(key, { brand: b, retailerSite: site });
    return cachedFetch(cacheByRetailer, key, () =>
      hondaLiveStock().catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[honda] live feed unavailable, serving fixtures: ${err?.message}`);
        return fixturesRetailerStock(b, site);
      }));
  }

  // Motorrad's live feed, when the registry opts into it. It's cached per
  // brand+retailer exactly like the BMW/MINI feed; on any failure (typically no
  // live session in this environment) it degrades to the curated snapshot
  // rather than blanking the deck — the "decide and keep moving" rule. Flip the
  // registry back to 'fixtures' to disable it entirely.
  if (source === 'live-motorrad') {
    const key = keyFor(b, site);
    seenRetailers.set(key, { brand: b, retailerSite: site });
    return cachedFetch(cacheByRetailer, key, () =>
      motorradLiveStock(origin).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn(`[motorrad] live feed unavailable, serving fixtures: ${err?.message}`);
        return fixturesRetailerStock(b, site);
      }));
  }

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
  const { origin, defaultRetailer, source } = brandConfig(b);
  const site = retailerSite || defaultRetailer;

  // Fixtures-backed brands have no distance API and no per-car geo, so there is
  // no honest "near you" pool to build. Return empty: callers treat a throw or
  // empty as "no carousel", and the hero matches never depend on it. (When a
  // real feed is wired and the brand flips to 'feed', this lights up for free.)
  // Motorrad's live feed is a single national pool with no distance facet, so it
  // has no honest "near you" either — same empty result.
  // Honda's live feed CAN filter by location (postcode + radius), but its cards
  // carry no per-car distance and no distinct dealer identity, so it can't build
  // the distance-ranked, other-dealers carousel this returns. The location filter
  // belongs on the main pool fetch instead (hondaLiveStock opts), not here.
  if (source === 'fixtures' || source === 'live-motorrad' || source === 'live-honda') return [];

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

/* --------------------------- vehicle colour --------------------------- *
 * Paint colour is the one thing buyers reach for first ("I want the blue
 * one") and the ONLY place the platform serves it is the vehicle detail
 * page — the list endpoint every other field comes from doesn't carry it
 * (verified against a live list response and the national dumps). There is
 * no detail JSON endpoint either; the PDP server-renders the whole vehicle
 * into an inline `UVL.AD = {…}` variable, which is why the network tab shows
 * no request to blame.
 *
 * So colour costs one page fetch per car, which rules it out for a whole
 * retailer's stock and rules it IN for the handful we actually show. Two
 * things make that cheap: it's only ever asked for the cars on screen, and a
 * given advert's paint never changes — so the cache has no TTL. A car fetched
 * once is coloured for the life of the process.
 *
 * Every failure here is silent by design. Colour is a bonus fact like
 * distance or a photo: a card without it is fine, a results page that 502s
 * because a PDP hiccuped is not.
 * ---------------------------------------------------------------------- */

// advert_id -> { colour, finish, manufacturerColour } | null (null = asked and
// couldn't tell, so we don't ask again). No TTL: paint is immutable per advert.
const colourByAdvert = new Map();
const colourInflight = new Map(); // advert_id -> Promise, single-flight

// How many PDPs to fetch at once. Deliberately small — this runs while a user
// waits, against a site we're a guest on.
const COLOUR_CONCURRENCY = 4;

// Total wall-clock a single request will spend colouring before giving up on
// the stragglers. Raised from 2.5s once grouped cards started naming their
// listings by colour: running out mid-queue left a picker offering "Colour
// n/a". The cache is permanent, so this cost is paid once per car, ever. Generous enough for a cold cluster on a warm connection,
// short enough that the hero never feels stalled behind it.
const COLOUR_BUDGET_MS = Number(process.env.COLOUR_BUDGET_MS) || 4500;

/**
 * Pull the vehicle object out of a PDP's inline `UVL.AD = {…}` and return its
 * colour. Brace-balanced rather than regex-matched: the blob is a full vehicle
 * with nested objects and escaped quotes, and a lazy regex would truncate it.
 */
function colourFromPdp(html) {
  const marker = html.indexOf('UVL.AD = {');
  if (marker < 0) return null;
  const start = html.indexOf('{', marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const c = html[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth !== 0) continue;
      try {
        const { colour } = JSON.parse(html.slice(start, i + 1));
        if (!colour?.colour) return null;
        return {
          // Normalised basic colour ("Grey") — what a preference matches on.
          colour: colour.colour,
          // "Metallic" / "Non-Metallic".
          finish: colour.finish || undefined,
          // The marketing name ("Brooklyn Grey") — what a card should say.
          manufacturerColour: colour.manufacturer_colour || undefined,
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** One advert's colour, cached forever, single-flighted, never throwing. */
function fetchColour(origin, advertId) {
  const id = String(advertId);
  if (colourByAdvert.has(id)) return Promise.resolve(colourByAdvert.get(id));
  if (colourInflight.has(id)) return colourInflight.get(id);

  const p = httpsGet(`${origin}/vehicle/${encodeURIComponent(id)}`, { Accept: 'text/html' })
    .then((res) => (res.status === 200 ? colourFromPdp(res.body) : null))
    .catch(() => null)
    .then((colour) => {
      colourByAdvert.set(id, colour);
      colourInflight.delete(id);
      return colour;
    });
  colourInflight.set(id, p);
  return p;
}

/**
 * Add `colour` to each car that has one, in place of nothing.
 *
 * Call this with the cars about to be SHOWN (the match cluster), never with a
 * whole pool — it's one page fetch per uncached car. Returns the same array
 * either way; a car whose colour couldn't be read simply doesn't gain the
 * field, exactly like a car with no photo.
 *
 * @param {string} brand 'bmw' | 'mini'
 * @param {Array} cars mapped car objects to enrich in place
 */
export async function enrichColours(brand, cars, budgetMs = COLOUR_BUDGET_MS) {
  const { origin, source } = brandConfig(normalizeBrand(brand));
  // Colour comes from the live platform's PDPs. A fixtures-backed brand has no
  // such PDPs to scrape (its links point at the real brand site, not this
  // origin), so any paint it shows must already be baked into the snapshot.
  // Skip the network entirely rather than fetching against the wrong origin.
  // Motorrad's live feed uses the UVL PDP shape too, so its rows carry any paint
  // inline already; there's no separate colour PDP to fetch on this origin.
  // Honda's live listing already carries an "Exterior colour" spec per card, so
  // its cars gain colour at map time — there's no colour PDP to fetch here either.
  if (source === 'fixtures' || source === 'live-motorrad' || source === 'live-honda') return cars;
  const queue = cars.filter((c) => c?.id);
  const deadline = Date.now() + budgetMs;
  for (let i = 0; i < queue.length; i += COLOUR_CONCURRENCY) {
    // A results page must not wait on a slow PDP. Once the budget is spent we
    // stop starting batches: the cars already coloured keep theirs, the rest
    // render without — and because the cache is permanent, the next request
    // for the same cars is instant and complete.
    if (Date.now() > deadline) break;
    const slice = queue.slice(i, i + COLOUR_CONCURRENCY);
    // eslint-disable-next-line no-await-in-loop
    const colours = await Promise.all(slice.map((c) => fetchColour(origin, c.id)));
    slice.forEach((car, n) => {
      if (colours[n]) car.colour = colours[n];
    });
  }
  return cars;
}
