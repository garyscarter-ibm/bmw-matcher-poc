/*
 * BMW UK dealer directory client.
 *
 * The used-car feed (stock.js) tells us which retailer sells a car, but not
 * where that retailer is: `retailer_site` carries only
 * { id, name, contact_number, dealer_number }. To ask the feed for stock
 * *near* a retailer we need that retailer's postcode, and the used-car
 * platform has no endpoint that gives one.
 *
 * BMW's own "Find a BMW Centre" page does. Two iframes deep, it calls the
 * endpoint below for the full UK dealer list — including postcode and
 * coordinates — keyed by `dealer_number`, which is exactly the field the
 * used-car feed already gives us. That shared key is what makes
 * "retailer 96" → "PH1 3GA" possible without a hand-maintained table:
 *
 *   retailer_site=96 → dealer_number 11107 → directory → PH1 3GA
 *
 * Caveats worth knowing before you touch this:
 *  1. Undocumented and not ours. The hostname says "develop" but it IS what
 *     bmw.co.uk's production locator calls (there is no -prod sibling). It
 *     could move without notice — every caller must degrade gracefully.
 *  2. It's ~2MB. Fetched at most once per process and reduced to the four
 *     fields we use; never put it in a request's hot path.
 *  3. Node 16 in local dev has no global fetch — node:https, like stock.js.
 */

import { request } from 'node:https';

const DIRECTORY_URL = process.env.DEALER_DIRECTORY_URL
  || 'https://bmw-mini-findacentre-develop-b45ry4vloa-nw.a.run.app/proxy/api/dealers';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** Error tag so callers can tell "no directory" from other faults. */
export class DirectoryUnavailableError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'DirectoryUnavailableError';
    if (cause) this.cause = cause;
  }
}

/** GET a URL over node:https. Resolves { status, body }. */
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
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
    req.setTimeout(15_000, () => req.destroy(new Error('Request timed out')));
    req.end();
  });
}

/**
 * The payload has been a bare array in every observed response, but it's a
 * third-party shape we don't control — accept the obvious envelopes too
 * rather than throwing on a wrapper appearing.
 */
function recordsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['dealers', 'results', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return null;
}

/** Keep the four fields we use; drop the other ~40 per record. */
function project(d) {
  return {
    name: d.dealer_name,
    postcode: d.postcode,
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
  };
}

// Memoised for the process lifetime: a dealer's address doesn't move, and
// this is a 2MB fetch against someone else's server. Holds the in-flight
// promise too, so concurrent first-callers share one request.
let directoryPromise = null;

/**
 * The dealer directory, indexed by `dealer_number`.
 * @returns {Promise<Map<string, {name, postcode, latitude, longitude}>>}
 */
export function fetchDealerDirectory() {
  if (directoryPromise) return directoryPromise;

  directoryPromise = (async () => {
    let res;
    try {
      res = await httpsGet(DIRECTORY_URL);
    } catch (cause) {
      throw new DirectoryUnavailableError('Dealer directory fetch failed', { cause });
    }
    if (res.status !== 200) {
      throw new DirectoryUnavailableError(`Dealer directory returned HTTP ${res.status}`);
    }

    let payload;
    try {
      payload = JSON.parse(res.body);
    } catch (cause) {
      throw new DirectoryUnavailableError('Dealer directory returned non-JSON', { cause });
    }

    const records = recordsFrom(payload);
    if (!records) {
      throw new DirectoryUnavailableError('Dealer directory payload was not a list');
    }

    // ~1,131 records collapse to ~144 unique dealer_numbers: the same dealer
    // appears once per address_type (CORPORATE, ONLINE, …). The duplicates
    // agree on postcode, so first-wins is fine.
    const byNumber = new Map();
    for (const d of records) {
      const key = d?.dealer_number != null ? String(d.dealer_number) : '';
      if (!key || !d.postcode || byNumber.has(key)) continue;
      byNumber.set(key, project(d));
    }
    if (byNumber.size === 0) {
      throw new DirectoryUnavailableError('Dealer directory had no usable records');
    }
    return byNumber;
  })();

  // A failed fetch shouldn't poison the memo — let the next caller retry.
  directoryPromise.catch(() => { directoryPromise = null; });

  return directoryPromise;
}

/**
 * Look up one dealer by the `dealer_number` the used-car feed reports.
 * @returns {Promise<{name, postcode, latitude, longitude} | undefined>}
 */
export async function lookupDealer(dealerNumber) {
  if (!dealerNumber) return undefined;
  const directory = await fetchDealerDirectory();
  return directory.get(String(dealerNumber));
}
