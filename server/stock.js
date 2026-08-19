/*
 * Live retailer-stock client (BMW/MINI Auto Trader feed + Honda/Ferrari/Motorrad
 * adapters), mapped to the engine's car schema. Uses node:https (Node 16, no fetch).
 */

import { request } from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { lookupDealer } from './dealers.js';
import { mapVehicle, mapMotorradRaw, mapHondaRaw, mapFerrariRaw } from './mapping.js';
import { brandConfig, normalizeBrand } from './brands.js';
import { parseListingHtml, listingUrl } from './honda-listing.js';
import { parseResTable } from './motorrad-listing.js';
import {
  parseListingHtml as parseFerrariHtml,
  listingUrl as ferrariListingUrl,
  paginationOf as ferrariPaginationOf,
  extractNextData as extractFerrariNextData,
} from './ferrari-listing.js';

// Repo root, from this module's location (server/ → ..). Used to resolve the
// fixtures directory for fixtures-backed brands without depending on cwd.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The stock platform is shared by BMW and MINI; only origin and default retailer
// differ. Caches/CSRF are keyed by brand so the two feeds never collide.
const STOCK_TTL_MS = Number(process.env.STOCK_TTL_MS) || 5 * 60 * 1000; // 5 min
const PAGE_LIMIT = 10; // safety cap on pagination (stock is ~3 pages)

// Nearby search depth. 4 pages × 100 reaches the 5 nearest retailers from Perth
// (~31 miles) — ample for a top-3 carousel. Lower first if cold-cache latency bites.
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
 *  Used by the Motorrad live adapter (a POST feed); BMW/MINI never touch this. */
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
 * Fetch a page, re-bootstrapping once if the token was rejected. Any 403 (even
 * mid-pagination) rotates the origin-scoped token — shared across the brand's retailers.
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
 * Stock nationwide, nearest-first, with a `distance` per vehicle. GOTCHA: the param
 * is `location`, NOT `postcode` — `postcode` is silently ignored (same list for any input).
 */
const byDistanceQuery = (postcode) => `location=${encodeURIComponent(postcode)}`
  + `&payment_type=cash&size=${NEARBY_PAGE_SIZE}&sort=distance&source=home`;

/* ------------------------------ TTL cache ----------------------------- */

// Keyed by "brand:retailerSite" so brands/retailers never clobber each other.
// `inflight` holds the in-progress fetch so concurrent callers share one request.
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
 * Read-through cache with single-flight: fresh cached cars, or join/start one fetch.
 * On failure a stale-but-usable entry is kept (the warmer retries) and the error propagates.
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
 * Brands whose live feed isn't reachable seed stock into fixtures/<brand>-cars.json
 * in the same mapped shape, opted into via `source: 'fixtures'`; BMW/MINI stay 'feed'.
 * --------------------------------------------------------------------- */

// brand -> parsed fixtures array. Read once per process (the file is static for
// a run); cars are already mapped so there's no per-request work to cache.
const fixturesByBrand = new Map();

/** Load and cache a brand's fixtures snapshot (`<brand>-cars.json`, or `fixturesFile`).
 *  Throws StockUnavailableError if missing/unusable so a mis-seeded brand fails loudly. */
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

/** All of a fixtures-backed brand's stock for a retailer. Narrows to retailerSite when
 *  the cars carry one, else serves the whole pool (a curated set may not tag a retailer). */
function fixturesRetailerStock(brand, retailerSite) {
  const cars = loadFixtures(brand);
  if (retailerSite == null) return cars;
  const site = String(retailerSite);
  const narrowed = cars.filter((c) => c?.retailerId != null && String(c.retailerId) === site);
  return narrowed.length ? narrowed : cars;
}

/* ---------------------------- live Honda feed ------------------------- *
 * Honda's approved-used stock has no JSON API but server-renders listings, so "live"
 * means fetch + parse the listing HTML (honda-listing.js) through the shared mapper.
 * --------------------------------------------------------------------- */

// How many listing pages to pull. Inventory is small and pages repeat once
// exhausted (we stop when a page adds no NEW cars); this is the safety cap.
const HONDA_PAGE_LIMIT = Number(process.env.HONDA_PAGE_LIMIT) || 8;

/**
 * Fetch and map the live Honda pool. Walks pages until one adds no new cars, dedupes
 * by PDP link, maps via shared mapHondaRaw. `opts` {zip,radius} narrows to a location.
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

/* --------------------------- live Ferrari feed ------------------------ *
 * preowned.ferrari.com is server-rendered Next.js: each page ships its result set as public
 * __NEXT_DATA__ JSON (no token), cold-walkable via `?pl=N`. Detail-page galleries are session-gated — do not forge.
 * --------------------------------------------------------------------- */

// Safety cap on pagination. Real pool is ~159 cars at ~11/page (~15 pages); the
// adapter also stops early once it has walked every page the feed reports.
const FERRARI_PAGE_LIMIT = Number(process.env.FERRARI_PAGE_LIMIT) || 20;

/**
 * Fetch and map the live Ferrari pool. Reads page 1, learns the real page count from
 * its pagination, walks the rest, dedupes by ad id, maps via shared mapFerrariRaw.
 */
async function ferrariLiveStock() {
  const first = await httpsGet(ferrariListingUrl(1), { Accept: 'text/html' });
  if (first.status !== 200) {
    throw new StockUnavailableError(`Ferrari listing returned HTTP ${first.status}`);
  }
  const seen = new Set();
  const cars = [];
  const addFrom = (html) => {
    for (const rec of parseFerrariHtml(html)) {
      if (seen.has(rec.id)) continue;
      seen.add(rec.id);
      const car = mapFerrariRaw(rec);
      if (car) cars.push(car);
    }
  };
  addFrom(first.body);

  // Learn the true page count from the payload; fall back to the safety cap.
  const pag = ferrariPaginationOf(extractFerrariNextData(first.body));
  const pages = Math.min(pag?.pages || FERRARI_PAGE_LIMIT, FERRARI_PAGE_LIMIT);
  for (let page = 2; page <= pages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const res = await httpsGet(ferrariListingUrl(page), { Accept: 'text/html' });
    if (res.status !== 200) break; // a later-page failure just ends pagination
    addFrom(res.body);
  }
  if (cars.length === 0) {
    throw new StockUnavailableError('Ferrari listing returned no usable cars');
  }
  return cars;
}

/* --------------------------- live Motorrad feed ----------------------- *
 * Session-gated feed (POST .../ShowResults, needs a GMB-SID header) whose SID is self-issued
 * by scraping <input id="hfSID"> off the landing page. Walk-every-page, no fallback (fail = 502).
 * --------------------------------------------------------------------- */

// Feed and session-issuing landing page, relative to the brand origin. ShowResults is
// the working JSON route; ergebnisse.cshtml embeds #hfSID. Adapter details, not registry.
const MOTORRAD_FEED_PATH = '/api/ResultOverview/ShowResults';
const MOTORRAD_LANDING_PATH = '/UK/ergebnisse.cshtml';

// Explicit session override. Normally the adapter self-issues via #hfSID
// (mintMotorradSid); set this only to force a captured session (skips the mint).
const MOTORRAD_SESSION = process.env.MOTORRAD_SESSION || '';

// Safety cap on pagination. Real deck is ~963 bikes at 20/page (~49 pages); bounds a
// runaway loop. Lower to shrink the live deck (and cold-fetch latency).
const MOTORRAD_PAGE_LIMIT = Number(process.env.MOTORRAD_PAGE_LIMIT) || 60;
const MOTORRAD_PAGE_SIZE = 20; // the feed's fixed pagingSize

// Pages fetched at once. Sequential paging over ~49 pages took ~90s cold; pages are
// independent once we hold a session, so batch them — 8 stays polite, cuts latency ~8x.
const MOTORRAD_PAGE_BATCH = Number(process.env.MOTORRAD_PAGE_BATCH) || 8;

// The compact filter body ShowResults expects (captured from a live session). Marke:10
// is BMW Motorrad, empty facets mean "no filter"; only `selectedPage` is rewritten per request.
const MOTORRAD_FILTER_BODY = {
  InitFilter: false, IsFirstCall: false, MarktId: '2', BuNo: '', Culture: 'en-gb',
  Segment: [], FuelType: [], Marke: 10, Modell: [], Fahrzeugart: 0, Antrieb: 0,
  EZV: 0, EZB: 0, PreisVon: '', PreisBis: '', KMVon: '', KMBis: '', KWVon: '', KWBis: '',
  PowerUnit: 'HP', Farbe1Auswahl: [], Merkmale: '', Umkreis: 1, UmkreisPLZ: '',
  AngebotsNo: '', DetailAngebotsNo: '', Sonderausstattung: '', isSondermodell: false,
  Pakete: '', FilterHMFAChanged: false, FilterEZChanged: 0, FilterColorChanged: false,
  ResOverviewData: {
    pagingSize: MOTORRAD_PAGE_SIZE, currResultCountToShow: MOTORRAD_PAGE_SIZE,
    selectedPage: 1, totalItemCount: 0, tableSortColumn: 16, tableSortDirection: 0,
    pageItemsToShow: 9,
  },
  DetailData: { RowNumber: 0 }, currRequest: 1,
};

/**
 * Dig vehicle rows out of the SearchFilter envelope as flat raw records. The real feed
 * returns `ResTable` as HTML (parse it); also accepts a pre-parsed array, else empty.
 */
export function motorradRowsFromEnvelope(env) {
  const sf = env?.SearchFilter ?? env;
  const table = env?.ResTable ?? sf?.ResTable ?? sf?.ResOverviewData?.ResTable;
  if (typeof table === 'string') return parseResTable(table); // the real shape
  const rows = table?.Items ?? table?.items ?? (Array.isArray(table) ? table : []);
  return Array.isArray(rows) ? rows.map(motorradRowToRaw) : [];
}

/**
 * Project one JSON result row into the flat shape mapMotorradRaw consumes. Only reached
 * if the feed ever grows a JSON variant (live is HTML); reads a spread of plausible keys.
 */
export function motorradRowToRaw(row = {}) {
  // Already a flat parsed record? Pass it through untouched.
  if (row.title !== undefined && row.price !== undefined) return row;
  const firstImage = (v) => (Array.isArray(v) ? v.find(Boolean) : v) || undefined;
  return {
    id: row.Id ?? row.id ?? row.AngebotsNo ?? row.StockNumber ?? row.VehicleId,
    title: row.Title ?? row.Name ?? row.ModelName ?? row.Bezeichnung ?? row.Description,
    price: row.Price ?? row.Preis ?? row.CashPrice ?? row.PriceValue,
    mileage: row.Mileage ?? row.KM ?? row.Odometer ?? row.Miles,
    reg: row.Registration ?? row.Reg ?? row.NumberPlate,
    fuel: row.Fuel ?? row.FuelType ?? row.Antrieb,
    image: firstImage(row.ImageSrc ?? row.sliderImageLinks ?? row.ImageLinks
      ?? row.ThumbnailLinks ?? row.ImageUrl ?? row.Image ?? row.MainImage),
    link: row.DetailUrl ?? row.Url ?? row.Link,
  };
}

/**
 * Read the GMB-SID the server embeds as `<input id="hfSID" value="<base64>">`. A cold GET
 * of the landing page mints a fresh one bound to this caller; throws if the field is absent.
 */
export function parseMotorradSid(html) {
  return (String(html).match(/id="hfSID"[^>]*value="([^"]*)"/) || [])[1] || null;
}

async function mintMotorradSid(origin) {
  let res;
  try {
    res = await httpsGet(`${origin}${MOTORRAD_LANDING_PATH}`, { Accept: 'text/html' });
  } catch (cause) {
    throw new StockUnavailableError('Motorrad landing page fetch failed', { cause });
  }
  if (res.status !== 200) {
    throw new StockUnavailableError(`Motorrad landing page returned HTTP ${res.status}`);
  }
  const sid = parseMotorradSid(res.body);
  if (!sid) {
    throw new StockUnavailableError('Motorrad landing page had no #hfSID session field');
  }
  return sid;
}

/** The filter body with `selectedPage` set to n (deep-copied so the constant
 *  template is never mutated). */
function motorradBodyForPage(n) {
  return {
    ...MOTORRAD_FILTER_BODY,
    ResOverviewData: { ...MOTORRAD_FILTER_BODY.ResOverviewData, selectedPage: n },
  };
}

/** POST one page of the feed with the session header. Returns the parsed
 *  envelope, or throws StockUnavailableError (non-200, non-JSON, null envelope). */
async function motorradFetchPage(origin, sid, page) {
  const headers = {
    'GMB-SID': sid,
    Origin: origin,
    Referer: `${origin}${MOTORRAD_LANDING_PATH}`,
    Accept: 'application/json, text/plain, */*',
  };
  let res;
  try {
    res = await httpsPostJson(`${origin}${MOTORRAD_FEED_PATH}`, motorradBodyForPage(page), headers);
  } catch (cause) {
    throw new StockUnavailableError(`Motorrad feed request failed on page ${page}`, { cause });
  }
  if (res.status !== 200) {
    throw new StockUnavailableError(`Motorrad feed returned HTTP ${res.status} on page ${page}`);
  }
  let env;
  try {
    env = JSON.parse(res.body);
  } catch (cause) {
    throw new StockUnavailableError('Motorrad feed returned non-JSON', { cause });
  }
  // A null ResTable is the signature of a request with no live session.
  if (env?.ResTable == null) {
    throw new StockUnavailableError(
      `Motorrad feed returned a null envelope on page ${page} (session not accepted)`,
    );
  }
  return env;
}

/**
 * Fetch and map the WHOLE live Motorrad pool. Self-issues a session, walks the feed in
 * concurrent batches until dry (it can't report a real total, so we can't trust a count).
 */
async function motorradLiveStock(origin) {
  const sid = MOTORRAD_SESSION || (await mintMotorradSid(origin));

  const byId = new Map();
  let done = false;
  let firstError = null;

  // Fetch pages in concurrent batches; fold results in page order so the "short/dry
  // page" stop is deterministic regardless of which request settled first.
  for (let start = 1; start <= MOTORRAD_PAGE_LIMIT && !done; start += MOTORRAD_PAGE_BATCH) {
    const pageNums = [];
    for (let p = start; p < start + MOTORRAD_PAGE_BATCH && p <= MOTORRAD_PAGE_LIMIT; p += 1) {
      pageNums.push(p);
    }
    // eslint-disable-next-line no-await-in-loop
    const settled = await Promise.all(
      pageNums.map((p) =>
        motorradFetchPage(origin, sid, p).then(
          (env) => ({ p, rows: parseResTable(env.ResTable) }),
          (err) => ({ p, err }),
        )),
    );
    for (const { p, rows, err } of settled) {
      if (err) {
        // A first-page failure is fatal; a later-page failure ends the walk with
        // what we have. Record it and stop folding further pages.
        if (p === 1) firstError = err;
        // eslint-disable-next-line no-console
        else console.warn(`[motorrad] page ${p} failed, stopping with ${byId.size} rows: ${err?.message}`);
        done = true;
        break;
      }
      let added = 0;
      for (const row of rows) {
        if (row?.id && !byId.has(row.id)) { byId.set(row.id, row); added += 1; }
      }
      if (rows.length < MOTORRAD_PAGE_SIZE || added === 0) { done = true; break; }
    }
  }

  if (firstError) throw firstError;

  const bikes = [...byId.values()].map(mapMotorradRaw).filter(Boolean);
  if (bikes.length === 0) {
    throw new StockUnavailableError('Motorrad feed returned no usable bikes');
  }
  return bikes;
}

/* ------------------------------ public API ---------------------------- */

/**
 * Fetch a retailer's full stock for a brand, mapped to the car schema. 'feed' brands hit
 * the live Auto Trader platform (cached per brand+retailer); 'fixtures' read the snapshot.
 */
export async function fetchRetailerStock(brand = 'bmw', retailerSite) {
  const b = normalizeBrand(brand);
  const { origin, defaultRetailer, source } = brandConfig(b);
  const site = retailerSite || defaultRetailer;

  // Fixtures-backed brands never touch the network or the TTL cache — the
  // snapshot is static for the run and the cars are already mapped.
  if (source === 'fixtures') return fixturesRetailerStock(b, site);

  // Honda's live feed (server-rendered HTML, own adapter), cached like BMW/MINI. A
  // failure throws → clean 502; Honda filters by location, so nearby handles "near you".
  if (source === 'live-honda') {
    const key = keyFor(b, site);
    seenRetailers.set(key, { brand: b, retailerSite: site });
    return cachedFetch(cacheByRetailer, key, () => hondaLiveStock());
  }

  // Motorrad's live feed, cached like BMW/MINI; any failure throws
  // StockUnavailableError (→ 502) rather than serving a stale snapshot.
  if (source === 'live-motorrad') {
    const key = keyFor(b, site);
    seenRetailers.set(key, { brand: b, retailerSite: site });
    return cachedFetch(cacheByRetailer, key, () => motorradLiveStock(origin));
  }

  // Ferrari's live feed (server-rendered public __NEXT_DATA__, own cold-walk adapter),
  // cached like the others. Ships 'fixtures' today (gallery-gated photos); live when flipped.
  if (source === 'live-ferrari') {
    const key = keyFor(b, site);
    seenRetailers.set(key, { brand: b, retailerSite: site });
    return cachedFetch(cacheByRetailer, key, () => ferrariLiveStock());
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

// "brand:retailerSite" -> postcode. No TTL: a retailer's address doesn't move. The
// combined BMW+MINI dealer directory means the dealer_number join works for both.
const postcodeByRetailer = new Map();

/**
 * The configured retailer's own postcode — the anchor every distance is measured from.
 * The feed gives `retailer_site.dealer_number`; one hop through dealers.js maps it to a postcode.
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
 * Stock at *other* retailers near the configured one, nearest first, each with a real
 * `distance`. The anchor's own cars are dropped; a throw means "no carousel", not "no results".
 */
export async function fetchNearbyStock(brand = 'bmw', retailerSite) {
  const b = normalizeBrand(brand);
  const { origin, defaultRetailer, source } = brandConfig(b);
  const site = retailerSite || defaultRetailer;

  // Fixtures/Motorrad/Honda have no honest distance-ranked "near you" pool (no per-car
  // geo or distinct dealer identity), so return empty — callers treat it as "no carousel".
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

    // An empty pool means only the anchor's own cars came back — implausible for 400
    // nearest vehicles, so treat it as a broken feed rather than caching "no neighbours".
    if (cars.length === 0) {
      throw new StockUnavailableError('Nearby search returned no cars from other retailers');
    }

    return cars;
  });
}

/* --------------------------- background warmer ------------------------ */

// How often the warmer wakes. Default 80% of the TTL, so an entry is refreshed before
// it expires and a user request never lands on a cold cache.
const WARM_INTERVAL_MS = Number(process.env.STOCK_WARM_INTERVAL_MS)
  || Math.round(STOCK_TTL_MS * 0.8);

/**
 * Refresh one pool for one retailer if its entry is missing or near expiry — off the
 * request path. Reuses the public fetchers (single-flight de-dups); errors are swallowed.
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
 * Start the background cache warmer, keeping served retailers' pools hot off the request
 * path. Idempotent, timer unref'd; call once from boot (NOT on import, so tests fire no network).
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
 * Paint is served ONLY on the PDP (inlined as `UVL.AD = {…}`, no detail JSON), so it costs
 * one fetch/car — only for cars on screen, cached with no TTL. Failures are silent (a bonus fact).
 * ---------------------------------------------------------------------- */

// advert_id -> { colour, finish, manufacturerColour } | null (null = asked and
// couldn't tell, so we don't ask again). No TTL: paint is immutable per advert.
const colourByAdvert = new Map();
const colourInflight = new Map(); // advert_id -> Promise, single-flight

// How many PDPs to fetch at once. Deliberately small — this runs while a user
// waits, against a site we're a guest on.
const COLOUR_CONCURRENCY = 4;

// Total wall-clock a request spends colouring before giving up on stragglers. Raised
// from 2.5s once grouped cards named listings by colour; cache is permanent, paid once/car.
const COLOUR_BUDGET_MS = Number(process.env.COLOUR_BUDGET_MS) || 4500;

/**
 * Pull the vehicle object out of a PDP's inline `UVL.AD = {…}` and return its colour.
 * Brace-balanced not regex-matched: the blob nests objects/escaped quotes a lazy regex would truncate.
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
 * Add `colour` to each car that has one, in place. Call with the cars about to be SHOWN
 * (one page fetch per uncached car), never a whole pool; unreadable colour just isn't added.
 */
export async function enrichColours(brand, cars, budgetMs = COLOUR_BUDGET_MS) {
  const { origin, source } = brandConfig(normalizeBrand(brand));
  // Colour comes from the live platform's PDPs. Fixtures/Motorrad/Honda have none to
  // scrape here (fixtures link off-origin; Motorrad/Honda carry paint inline already), so skip.
  if (source === 'fixtures' || source === 'live-motorrad' || source === 'live-honda') return cars;
  const queue = cars.filter((c) => c?.id);
  const deadline = Date.now() + budgetMs;
  for (let i = 0; i < queue.length; i += COLOUR_CONCURRENCY) {
    // A results page must not wait on a slow PDP: once the budget is spent we stop
    // starting batches. Cache is permanent, so the next request for these cars is instant.
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
