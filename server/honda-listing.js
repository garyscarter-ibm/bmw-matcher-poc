/*
 * Honda used-car listing parser (live adapter + offline scraper). No stock API,
 * but listing pages are fully server-rendered, so this parses card HTML. Pure.
 */

/** The listing base + the approved-used programme the site filters on. Pages
 *  past 1 are a PATH segment (/page2/), not a query param. */
export const HONDA_LISTING_BASE =
  'https://usedcars.honda.co.uk/en/used-cars/approved-cars/all-brands/all-models';
export const HONDA_WARRANTY_QUERY = 'warrantyProgram=22';

/** Decode the handful of HTML entities the listing uses. */
export function decode(s) {
  return String(s)
    .replace(/&pound;/g, '£')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&deg;/g, '°')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&eacute;/g, 'é')
    .replace(/\s+/g, ' ')
    .trim();
}

const stripTags = (s) => decode(String(s).replace(/<[^>]+>/g, ' '));

/**
 * Split one listing page into per-vehicle HTML blocks, sliced on the
 * "vehicle-inner" wrapper each card has exactly once.
 */
export function splitCards(html) {
  const parts = String(html).split('class="vehicle-inner"');
  // parts[0] is the pre-first-card chrome; each subsequent chunk is one card
  // (plus trailing page chrome on the last, which the field extractors ignore).
  return parts.slice(1);
}

/** First capture-group match, decoded, or null. */
function pick(re, html) {
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
}

/** A labelled spec from the card's <li> list, e.g. "Mileage" -> "72,500 miles". */
function spec(label, html) {
  // <li ...>Mileage<...>72,500&nbsp;miles</...></li> — label then value, tags between.
  const re = new RegExp(`${label}\\s*</[^>]+>\\s*<[^>]*>([^<]+)<`, 'i');
  const m = re.exec(html);
  if (m) return decode(m[1]);
  // Fallback: label immediately followed by the value in the same text run.
  const re2 = new RegExp(`${label}[^A-Za-z0-9]{0,4}([\\d.,]+[^<]*)`, 'i');
  const m2 = re2.exec(stripTags(html));
  return m2 ? decode(m2[1]) : null;
}

const num = (s) => (s == null ? null : Number(String(s).replace(/[^\d.]/g, '')) || null);

/** Parse one card block into a raw Honda record. Returns null if it isn't a
 *  real vehicle card (missing the essentials). */
export function parseCard(block) {
  const link = pick(/href="(\/en\/used-cars\/approved-cars\/honda\/[^"#]+)"/, block);
  const title = pick(/title="(Honda[^"]+)"/, block);
  if (!link || !title) return null;

  // Cash price: the non-monthly £ (monthly sits under "Monthly Payment"). Take
  // the largest £ on the card, which is always the cash price here.
  const prices = [...block.matchAll(/&pound;([\d,]+)/g)].map((m) => num(m[1])).filter(Boolean);
  const price = prices.length ? Math.max(...prices) : null;

  const reg = pick(/data-modix-360-reg="([A-Z0-9]+)"/, block)
    || spec('Registration plate', block);
  const image = pick(/<img[^>]+src="(\/picserver[^"]+)"/, block)
    || pick(/<img[^>]+src="([^"]+\.jpg)"/, block);

  const firstReg = spec('First registration date', block); // dd/mm/yyyy
  const year = firstReg ? num(firstReg.split('/').pop()) : null;

  return {
    id: (link.match(/-([a-z0-9]+)$/i) || [])[1] || link,
    link: `https://usedcars.honda.co.uk${link}`,
    title: decode(title),
    price,
    mileage: num(spec('Mileage', block)),
    fuel: spec('Fuel Type', block) || spec('Fuel', block),
    transmission: spec('Transmission', block),
    doors: num(spec('Doors', block)),
    bhp: num(spec('Power', block)),
    cc: num(spec('Capacity', block)),
    mpg: num(spec('mpg combined', block) || spec('mpg', block)),
    co2: num(spec('CO2 Emission', block)),
    colour: spec('Exterior colour', block),
    firstReg,
    year,
    reg,
    image: image ? `https://usedcars.honda.co.uk${image}` : null,
  };
}

/** Parse a whole listing page's HTML into an array of raw Honda records
 *  (unmapped). Cards that aren't real vehicles are dropped. */
export function parseListingHtml(html) {
  return splitCards(html).map(parseCard).filter(Boolean);
}

/** The listing URL for a page, with an optional location filter. Page 1 is the
 *  base; later pages are a /pageN segment. A postcode + radius narrows to nearby stock. */
export function listingUrl(page = 1, { zip, radius } = {}) {
  const params = new URLSearchParams(HONDA_WARRANTY_QUERY);
  if (zip) params.set('zip', zip);
  if (radius) params.set('radius', String(radius));
  const qs = params.toString();
  return page > 1
    ? `${HONDA_LISTING_BASE}/page${page}?${qs}`
    : `${HONDA_LISTING_BASE}?${qs}`;
}
