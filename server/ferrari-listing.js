/*
 * Ferrari approved-used listing parser — shared by the live adapter (stock.js)
 * and the offline capture builder (scripts/build-ferrari-fixtures.mjs).
 *
 * preowned.ferrari.com is a server-rendered Next.js app: every listing page
 * ships the full result set as JSON in a <script id="__NEXT_DATA__">. The ads
 * live at props.pageProps.initialState.search.searchResults.ads, each a rich
 * record carrying price (GBP), year, odometer (mi), power, engine, colour,
 * gearbox, a per-listing total displacement (cc) and body style, plus a real
 * dealer with a name, address and geo. Parsing that JSON yields the exact flat
 * raw shape mapFerrariRaw consumes, so the same records feed the engine whether
 * they came from a live fetch or a committed snapshot.
 *
 * This file is pure (no network): callers fetch the HTML and hand it in. It is
 * proven against real listing HTML captured across the whole 15-page inventory.
 *
 * Two feed quirks the projection smooths over, both real and both load-bearing:
 *   - `bodyStyle` lies. GTS and Spider cars routinely report "coupè"; the model
 *     NAME is the truer body signal, so we surface the raw bodyStyle but let the
 *     mapper key body off the name (see ferrariBody in mapping.js).
 *   - `fuelType` is often empty (12Cilindri, 296, Purosangue), and `power` comes
 *     in four shapes ("492 (670) at 8000 rpm", "830", "570 ** at 9000 rpm",
 *     "588 (800) at 8500 rpm"). We parse HP defensively here and never let the
 *     card's fuelType decide the drivetrain — that keys on the spec table so the
 *     296/SF90 plug-in hybrids can't be mis-read as pure petrol.
 */

/** The results-feed base. Pagination is a `?pl=N` query param (NOT `?page=N`,
 *  which the app silently ignores and re-serves page 1). */
export const FERRARI_LISTING_BASE =
  'https://preowned.ferrari.com/en-GB/r/europe/used-ferrari/great-britain/rfc';

/** Absolute origin, for building per-listing detail links. */
export const FERRARI_ORIGIN = 'https://preowned.ferrari.com';

/*
 * Thron DAM public delivery. The site's own JS hardcodes these two as plain
 * public constants (clientId "ferrari", sessId "3zayf6") — they are NOT
 * per-session values, and the card image is served from the token-free
 * /delivery/public/ path. So a cover photo is cold-resolvable from the
 * cardImages.thronGalleryId alone, no SDK session and no token (that concern
 * applies only to the detail-page full gallery/video, which we don't touch).
 * The delivery verb for a GALLERY id is `thumbnail` — it returns the gallery's
 * cover frame as a real JPEG; a single-image id would use `image` instead.
 */
const THRON_CLIENT = 'ferrari';
const THRON_SESS = '3zayf6';

/** Build the public card-cover URL for a Thron gallery id, or null if none.
 *  `size` is a WxH box the CDN scales into (the returned JPEG's long edge is
 *  ~that many px). `slug` is cosmetic (the file-name tail) and safe to omit. */
export function thronCardImage(galleryId, size = '600x400', slug = 'car') {
  if (!galleryId) return null;
  const tail = slugify(slug) || 'car';
  return `https://${THRON_CLIENT}-cdn.thron.com/delivery/public/thumbnail/`
    + `${THRON_CLIENT}/${galleryId}/${THRON_SESS}/std/${size}/${tail}`;
}

/** Extract and parse the __NEXT_DATA__ JSON blob from a listing page. Returns
 *  the parsed object, or null if the page carries no payload. */
export function extractNextData(html) {
  const m = String(html).match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** The ads array for a page, or []. */
function adsOf(nextData) {
  return nextData?.props?.pageProps?.initialState?.search?.searchResults?.ads || [];
}

/** Pagination facts ({ total, pages, limit }), or null. */
export function paginationOf(nextData) {
  return (
    nextData?.props?.pageProps?.initialState?.search?.searchResults?.pagination ||
    null
  );
}

/** Slugify a string the way the detail-link path segments are built:
 *  lower-case, accents stripped, non-alphanumerics collapsed to single dashes. */
function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** overviewData is an array of {slug,value}; fold it to a lookup. */
function overviewMap(ad) {
  const out = {};
  for (const row of ad?.overviewData || []) {
    if (row && row.slug != null) out[row.slug] = row.value;
  }
  return out;
}

const numOr = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Power comes in four shapes across the feed. Prefer the parenthesised HP
 *  ("492 (670) …" -> 670); else the leading integer ("830", "570 ** …" -> the
 *  first, larger number, which is HP when there's no kW prefix). Returns HP or
 *  null. The mapper still backfills from the spec table when this is null. */
export function parsePowerHp(power) {
  const s = String(power || '');
  const paren = s.match(/\(([\d.]+)\)/);
  if (paren) return numOr(paren[1]);
  const lead = s.match(/([\d.]+)/);
  return lead ? numOr(lead[1]) : null;
}

/** Build the per-listing detail URL from the ad's own fields. The path uses the
 *  dealer NAME slug (meridien-modena), the car-name slug, then the raw (already
 *  URL-encoded) id. */
function detailLink(ad) {
  const dealerSlug = slugify(ad?.dealer?.name);
  const carSlug = slugify(ad?.carName || ad?.model?.name);
  const id = ad?.id;
  if (!dealerSlug || !carSlug || !id) return null;
  return `${FERRARI_ORIGIN}/en-GB/a/europe/used-ferrari/great-britain/${dealerSlug}/${carSlug}/${id}`;
}

/** Project one raw ad into the flat record mapFerrariRaw consumes. Returns null
 *  for placeholder/teaser cards (no name or no price). */
export function projectAd(ad) {
  if (!ad) return null;
  const name = ad.carName || ad.model?.name;
  const price = numOr(ad.price);
  if (!name || !price) return null;

  const ov = overviewMap(ad);
  const d = ad.dealer || {};

  return {
    // Identity: the raw id is a long URL-encoded blob, unique per listing.
    id: ad.id,
    vin: ad.vin || null,
    name,
    modelName: ad.model?.name || name,
    modelSlug: ad.model?.slug || null,
    price,
    priceUnit: ad.priceUnit || 'GBP',
    year: ad.year || numOr(ov.registered) || null,
    mileage: numOr(ad.odometer),
    odometerUnit: ad.odometerUnit || 'mi',
    // Real per-listing values (present on most ads; null-safe for the rest).
    powerHp: parsePowerHp(ad.power),
    powerRaw: ad.power || null,
    cc: numOr(ov.totalDisplacement),
    engine: ad.engine || ov.engine || null,
    gearBox: ad.gearBox || null,
    topSpeed: numOr(ad.topSpeed),
    topSpeedUnit: ad.topSpeedUnit || null,
    fuelType: ad.fuelType || null, // often empty; NOT used to decide drivetrain
    bodyStyle: ov.bodyStyle || null, // unreliable; mapper keys body off name
    exteriorColor: ad.exteriorColor || ov.exteriorColor || null,
    trimColor: ad.trimColor || ov.trimColor || null,
    ferrariApproved: ad.ferrariApproved === true,
    specialOrLimitedSerie: ad.specialOrLimitedSerie === true,
    // The Thron gallery id, and the public cover photo we build from it. The
    // card image lives on Thron's token-free /delivery/public/ path (see
    // thronCardImage), so this is a real cover frame, no SDK session needed.
    // It's a single cover shot, not the swipeable multi-image gallery (that
    // still needs the runtime session and we don't fetch it).
    thronGalleryId: ad.cardImages?.thronGalleryId || null,
    photo: thronCardImage(ad.cardImages?.thronGalleryId, '600x400', name) || undefined,
    // Real dealer: name, address, city and geo. The geo powers a genuine
    // "nearby" distance (unlike Honda/Ford, which have no per-listing geo).
    dealerName: d.name || null,
    dealerCity: d.city || null,
    dealerAddress: d.address || null,
    dealerLat: d.location?.lat ?? null,
    dealerLon: d.location?.lon ?? null,
    link: detailLink(ad),
  };
}

/** Parse a whole listing page's HTML into an array of raw Ferrari records
 *  (unmapped). Placeholder cards are dropped. */
export function parseListingHtml(html) {
  const data = extractNextData(html);
  if (!data) return [];
  return adsOf(data).map(projectAd).filter(Boolean);
}

/** The listing URL for a page. Page 1 is the base; later pages add `?pl=N`. */
export function listingUrl(page = 1) {
  return page > 1 ? `${FERRARI_LISTING_BASE}?pl=${page}` : FERRARI_LISTING_BASE;
}
