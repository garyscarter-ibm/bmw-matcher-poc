/*
 * UK postcode → coordinates, via postcodes.io.
 *
 * The hard-filter mode lets a buyer say "within 30 miles of me", which needs two
 * halves: where every retailer is, and where the buyer is. The first half we
 * already have — the dealer directory carries lat/lon per site (see dealers.js).
 * This is the second half, and nothing we already talk to can provide it: the
 * used-car platform's own `postcode=` parameter is silently ignored (see
 * docs/nearby-matches-plan.md), and the dealer directory only knows about
 * dealers.
 *
 * postcodes.io is ONS Postcode Directory data behind a free public API — no key,
 * no registration, no quota published. That is why it is not in render.yaml:
 * there is nothing to configure, and the feature works on a fresh deploy with
 * zero env set.
 *
 * Two endpoints, both confirmed live against the real service:
 *
 *   /postcodes/PH1 3GA → { status: 200, result: { latitude, longitude, … } }
 *   /outcodes/NG1      → the outward code's centroid, same two fields
 *   unknown postcode   → HTTP 404, { status: 404, error: 'Postcode not found' }
 *
 * The outcode endpoint is why a buyer can type "NG1" and still get an answer.
 * People know their area before they know their postcode, and refusing a partial
 * would put a validation error between them and the only filter in the mode that
 * needs typing. A centroid is roughly a mile off the true position, which is
 * noise against a filter whose narrowest band is ten miles.
 *
 * Both the path and the query are case- and space-insensitive upstream
 * ("ph13ga" resolves), so normalising here is only for the cache key and for
 * telling a full postcode from an outward code.
 *
 * Caveats, as with dealers.js: it is someone else's server, so every caller must
 * degrade rather than fail, and Node 16 in local dev has no global fetch, hence
 * node:https.
 */

import { request } from 'node:https';

const API_URL = process.env.POSTCODES_API_URL || 'https://api.postcodes.io';

/** Error tag so callers can tell "geocoder is down" from "no such postcode". */
export class GeocodeUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'GeocodeUnavailableError';
    this.statusCode = 502;
    if (cause) this.cause = cause;
  }
}

/** GET a URL over node:https. Resolves { status, body }. */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers: { Accept: 'application/json' } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      },
    );
    req.on('error', reject);
    req.setTimeout(8_000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

/*
 * UK postcodes, loosely: one or two letters, a digit, an optional letter-or-
 * digit, then optionally the inward code (digit + two letters). Deliberately not
 * the full BS7666 pattern — this is a cheap gate so obvious junk ("hello", an
 * email address, a paste of the whole address) never leaves the building, not an
 * authority on what exists. The upstream 404 is the authority on that.
 */
const FULL = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

/** Upper-cased and unspaced, which is the form both regexes and the cache use. */
function normalise(input) {
  return String(input || '').toUpperCase().replace(/\s+/g, '');
}

/*
 * Cached for the lifetime of the process, and permanently: a postcode's
 * coordinates are a fact about the map, not a reading that goes stale. `null` is
 * a real cached answer — "we asked, and there is no such postcode" — so that a
 * typo retried in a loop costs one request rather than one per keystroke. A
 * FAILED ask is never cached (see the catch below), because "the geocoder timed
 * out" says nothing about the postcode. Same soft-miss distinction as the colour
 * lookup in stock.js.
 *
 * `inflight` is separate so concurrent callers asking for the same postcode
 * share one request without a pending promise being mistaken for an answer.
 */
const cache = new Map();
const inflight = new Map();

/**
 * Coordinates for a full UK postcode or an outward code.
 *
 * @param {string} input e.g. "NG1 2AB", "ng12ab", "NG1"
 * @returns {Promise<{postcode: string, latitude: number, longitude: number} | null>}
 *   null when the postcode is malformed or the service says it does not exist.
 * @throws {GeocodeUnavailableError} when the service could not be reached.
 */
export function geocodePostcode(input) {
  const key = normalise(input);
  const outcodeOnly = !FULL.test(key) && OUTCODE.test(key);
  if (!FULL.test(key) && !outcodeOnly) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (inflight.has(key)) return inflight.get(key);

  const path = outcodeOnly ? 'outcodes' : 'postcodes';
  const pending = (async () => {
    let res;
    try {
      res = await httpsGet(`${API_URL}/${path}/${encodeURIComponent(key)}`);
    } catch (cause) {
      throw new GeocodeUnavailableError('Postcode lookup failed', { cause });
    }

    // The service's own answer that this postcode does not exist. Cache it.
    if (res.status === 404) {
      cache.set(key, null);
      return null;
    }
    if (res.status !== 200) {
      throw new GeocodeUnavailableError(`Postcode lookup returned HTTP ${res.status}`);
    }

    let payload;
    try {
      payload = JSON.parse(res.body);
    } catch (cause) {
      throw new GeocodeUnavailableError('Postcode lookup returned non-JSON', { cause });
    }

    const lat = Number(payload?.result?.latitude);
    const lon = Number(payload?.result?.longitude);
    // A 200 with no usable coordinates is the service changing shape on us, not
    // a missing postcode — don't cache it as "no such place".
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new GeocodeUnavailableError('Postcode lookup returned no coordinates');
    }

    // The canonical spelling, so the UI can echo "NG1 2AB" for "ng12ab" and the
    // buyer can see we understood them.
    const answer = {
      postcode: payload.result.postcode || payload.result.outcode || key,
      latitude: lat,
      longitude: lon,
    };
    cache.set(key, answer);
    return answer;
  })();

  inflight.set(key, pending);
  // Whatever happened, this request is no longer in flight. A rejection leaves
  // nothing in `cache`, so the next caller retries.
  pending.catch(() => {}).then(() => inflight.delete(key));

  return pending;
}
