/*
 * Brand registry — the one place that knows how BMW and MINI differ.
 *
 * Both brands' used stock is served by the *same* Auto Trader/Django platform
 * (same CSRF handshake, same /vehicle/api/list/ JSON, same dealer_number join),
 * so the only per-brand facts are:
 *   - origin:          which site to fetch from / link to
 *   - defaultRetailer: retailer_site ID used when a request omits one
 *   - label:           human name for logs/errors
 *
 * The per-brand vehicle→spec mapping (MODEL_SPECS + derivations) lives in
 * mapping.js, selected by brand there. Everything else — engine, cache, warmer,
 * dealer directory (which is a combined BMW+MINI feed) — is brand-agnostic.
 */

export const BRANDS = {
  bmw: {
    label: 'BMW',
    origin: 'https://usedcars.bmw.co.uk',
    defaultRetailer: '96', // Grassicks Garage, Perth
    // Budget slider bounds. BMW used stock genuinely reaches £100k+, so the
    // full £0–150k range is right. (This is the base defined in questions.js.)
    budget: { max: 150000, default: [40000, 75000] },
  },
  mini: {
    label: 'MINI',
    origin: 'https://approvedusedminis.co.uk',
    defaultRetailer: '92', // Sytner Luton MINI
    // MINI used stock runs ~£10k–£40k nationally (median ~£24.5k; nothing over
    // £40k in the feed), so a £150k slider leaves both thumbs bunched at the far
    // left. Cap at £50k with a default bracket around the median.
    budget: { max: 50000, default: [15000, 30000] },
  },
};

/** The default brand when a request/config doesn't specify one. */
export const DEFAULT_BRAND = 'bmw';

/**
 * Normalise an arbitrary brand input to a known key, defaulting to BMW.
 * Accepts case-insensitively ("MINI", "Mini", "mini") so DA config and query
 * strings are forgiving.
 */
export function normalizeBrand(brand) {
  const key = String(brand || '').toLowerCase();
  return BRANDS[key] ? key : DEFAULT_BRAND;
}

/** The config record for a brand (always resolves — falls back to the default). */
export function brandConfig(brand) {
  return BRANDS[normalizeBrand(brand)];
}
