/*
 * BMW Motorrad approved-used listing parser. The feed returns a server-rendered
 * HTML <table> (`ResTable`), not JSON, so this scrapes it like honda-listing.js.
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
 * A labelled spec value: a hidden label span ("Mileage ") then an icon <img>
 * then the value text. Anchors on the label, skips the icon, takes trailing text.
 */
function spec(label, block) {
  const re = new RegExp(`>${label}\\s*</span>\\s*<img[^>]*>(?:</img>)?\\s*([^<]+)`, 'i');
  const m = re.exec(block);
  return m ? decode(m[1]) : null;
}

/**
 * Split the ResTable HTML into per-bike <tr> blocks: result rows carry the
 * `ergebnissColor` class (the <thead> row doesn't), so we slice on that.
 */
export function splitRows(html) {
  const parts = String(html).split(/<tr\b[^>]*\bergebnissColor\b/);
  return parts.slice(1);
}

/**
 * Parse one result <tr> into a flat raw Motorrad record (the shape
 * mapMotorradRaw consumes). Returns null if the block isn't a real vehicle row.
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

  // Cash price: the bold headline £ value. Take the largest £ on the row so a
  // monthly-payment figure can't win (as the Honda parser also guards against).
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
    // Power shows as "81 kW (109 HP)", Capacity as "1170 ccm" — display extras;
    // take only the leading kW or num() fuses "81 kW (109 HP)" into 81109.
    powerKw: num((spec('Power', block) || '').split(/kw/i)[0]),
    cc: num(spec('Capacity', block)),
    // No per-row fuel field: leave unset and let mapMotorradRaw decide by model
    // line (the CE 04 is the only electric).
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
