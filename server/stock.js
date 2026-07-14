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

import { mapVehicle } from './mapping.js';

const ORIGIN = 'https://usedcars.bmw.co.uk';
const RETAILER_SITE = process.env.RETAILER_SITE || '96'; // 96 = Grassicks Garage
const STOCK_TTL_MS = Number(process.env.STOCK_TTL_MS) || 5 * 60 * 1000; // 5 min
const PAGE_LIMIT = 10; // safety cap on pagination (stock is ~3 pages)

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

/** One page of the retailer's list endpoint, with the CSRF handshake applied. */
async function fetchPage(page) {
  const url = `${ORIGIN}/vehicle/api/list/?retailer_site=${encodeURIComponent(RETAILER_SITE)}&page=${page}`;
  return httpsGet(url, {
    Accept: 'application/json',
    Cookie: `csrftoken=${csrf.token}`,
    'X-CSRFToken': csrf.token,
    Referer: `${ORIGIN}/`,
  });
}

/**
 * Fetch a page, transparently re-bootstrapping once if the token was rejected.
 * Any 403 (even mid-pagination) rotates the token and retries that page.
 */
async function fetchPageWithRetry(page) {
  if (!csrf) await bootstrap();
  let res = await fetchPage(page);
  if (res.status === 403) {
    await bootstrap(); // token likely rotated/expired
    res = await fetchPage(page);
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

/* ------------------------------ TTL cache ----------------------------- */

let cache = null; // { at: epochMs, cars: Car[] }

/** node:https has no argless Date.now ban — this is server runtime, fine to use. */
function fresh(entry) {
  return entry && Date.now() - entry.at < STOCK_TTL_MS;
}

/* ------------------------------ public API ---------------------------- */

/**
 * Fetch the retailer's full live stock, mapped to the engine's car schema.
 * Cached for STOCK_TTL_MS. Throws StockUnavailableError if the live feed
 * can't be reached (no static fallback — this tool is honestly live-only).
 *
 * @returns {Promise<Array>} mapped car objects (mapping.js shape)
 */
export async function fetchGrassickStock() {
  if (fresh(cache)) return cache.cars;

  let vehicles;
  try {
    const first = await fetchPageWithRetry(1);
    vehicles = [...(first.results || [])];
    const totalPages = Math.min(first.pagination?.total || 1, PAGE_LIMIT);
    for (let page = 2; page <= totalPages; page += 1) {
      const next = await fetchPageWithRetry(page);
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
  cache = { at: Date.now(), cars };
  return cars;
}
