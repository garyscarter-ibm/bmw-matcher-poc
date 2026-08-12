/*
 * BMW Motorrad approved-used listing parser — the real feed shape, at last.
 *
 * The feed (POST /api/ResultOverview/ShowResultsFilterChanged) does NOT return a
 * JSON array of vehicles, as an earlier reverse-engineering pass assumed. It
 * returns a SearchFilter envelope whose `ResTable` field is a server-rendered
 * HTML <table> string — one <tr> per bike, each carrying a real per-vehicle
 * photo (https://approvedused.bmw-motorrad.co.uk/api/Image/GetImg?imgId=…), the
 * cash price, mileage, first-registration date, power, capacity, colour and the
 * dealer. That HTML is exactly as scrapeable as Honda's server-rendered listing,
 * so this parser mirrors honda-listing.js: pure (no network), one <tr> in, one
 * flat raw record out — the shape mapMotorradRaw consumes.
 *
 * Confirmed against a real captured feed response (see
 * server/test/fixtures/motorrad-restable.html, captured from a live browser
 * session on 2026-08-12). The regexes are anchored on the markup's stable class
 * names (ChildImg, TextXLbig, the labelled spec spans), so a cosmetic style
 * change on their side degrades a field to null rather than crashing the parse.
 */

/** Decode the handful of HTML entities the listing uses, and collapse space. */
export function decode(s) {
  return String(s)
    .replace(/&pound;/g, '£')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&deg;/g, '°')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First capture-group match, decoded, or null. */
function pick(re, html) {
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
}

const num = (s) => (s == null ? null : Number(String(s).replace(/[^\d.]/g, '')) || null);

/**
 * A labelled spec value. Each row states a field as a visually-hidden label
 * span ("Mileage ") immediately followed by an icon <img> then the value text:
 *   <span …>Mileage </span><img …></img>6,158 miles
 * so we anchor on the label, skip the icon tag, and take the trailing text up to
 * the next tag. Returns the raw value string (decoded) or null.
 */
function spec(label, block) {
  const re = new RegExp(`>${label}\\s*</span>\\s*<img[^>]*>(?:</img>)?\\s*([^<]+)`, 'i');
  const m = re.exec(block);
  return m ? decode(m[1]) : null;
}

/**
 * Split the ResTable HTML into per-bike <tr> blocks. Each result row carries the
 * `ergebnissColor` class (the header <tr> in <thead> does not), so we slice on
 * that and drop the pre-first-row chrome.
 */
export function splitRows(html) {
  const parts = String(html).split(/<tr\b[^>]*\bergebnissColor\b/);
  return parts.slice(1);
}

/**
 * Parse one result <tr> block into a flat raw Motorrad record — the shape
 * mapMotorradRaw consumes ({ id, title, price, mileage, reg?, fuel?, image,
 * link, … }). Returns null if the block isn't a real vehicle row (no title or
 * no price). The mapper authors the scored specs (cc band, category, 0-62) from
 * the model line; the real per-listing facts this parser reads (price, mileage,
 * photo, power, capacity, colour, first-reg, dealer) are carried through as-is.
 */
export function parseRow(block) {
  // The offer number keys both the id and the detail link: ShowResOvDetail('577260',1).
  const on = (block.match(/ShowResOvDetail\('(\d+)'/) || [])[1] || null;

  // Title lives on the image anchor's title="…" and again as the <p> heading.
  const title = pick(/class="ChildImg"[^>]*\btitle="([^"]+)"/, block)
    || pick(/\btitle="(BMW[^"]+)"/, block)
    || pick(/ErgebnissListKopf[^>]*>\s*<p[^>]*>([^<]+)</, block);
  if (!title) return null;

  // The one real per-vehicle photo — the GetImg CDN URL on the ChildImg anchor.
  const image = pick(/class="ChildImg"[^>]*>\s*<img[^>]+src="([^"]+)"/, block)
    || pick(/<img[^>]+src="(https:\/\/[^"]*GetImg[^"]+)"/, block);

  // Cash price: the bold headline £ value. Take the largest £ on the row to be
  // safe (a row states one price today, but this survives a monthly-payment
  // addition the way the Honda parser guards against it).
  const prices = [...block.matchAll(/£\s?([\d,]+)/g)].map((m) => num(m[1])).filter(Boolean);
  const price = prices.length ? Math.max(...prices) : null;
  if (!price) return null;

  const firstReg = spec('First registration', block); // dd/mm/yyyy
  const year = firstReg && firstReg.includes('/') ? num(firstReg.split('/').pop()) : null;

  const detailPath = pick(/href="(\/uk\/detail\.cshtml\?on=\d+[^"]*)"/i, block);
  const link = detailPath
    ? `https://approvedused.bmw-motorrad.co.uk${decode(detailPath).replace(/&amp;/g, '&')}`
    : null;

  return {
    id: on,
    title: decode(title),
    price,
    mileage: num(spec('Mileage', block)),
    // The listing shows Power as "81 kW (109 HP)" and Capacity as "1170 ccm".
    // These are display extras; the mapper derives the scored cc from the model
    // line. Carry the real figures through so a card can show them. Take only the
    // LEADING kW figure — num() would otherwise fuse "81 kW (109 HP)" into 81109.
    powerKw: num((spec('Power', block) || '').split(/kw/i)[0]),
    cc: num(spec('Capacity', block)),
    // Bikes here are petrol unless the model is electric — the listing has no
    // per-row fuel field, so leave it unset and let mapMotorradRaw decide by
    // model line (the CE 04 is its only electric).
    firstReg,
    year,
    image: image || null,
    link,
  };
}

/** Parse a whole ResTable HTML string into an array of raw Motorrad records
 *  (unmapped). Rows that aren't real vehicles are dropped. */
export function parseResTable(html) {
  if (!html || typeof html !== 'string') return [];
  return splitRows(html).map(parseRow).filter(Boolean);
}
