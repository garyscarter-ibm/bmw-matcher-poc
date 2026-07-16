/*
 * Live vehicle → engine-schema projection.
 *
 * The live feed (usedcars.bmw.co.uk) gives us real price, mileage, fuel, mpg,
 * EV range and photos — but NOT the three specs the engine still needs:
 * 0-62 time, boot litres and seat count. Those come from MODEL_SPECS below,
 * a per-model-line lookup table (keyed by line, e.g. "X3", "3 Series") with
 * trim-based overrides for 0-62 (an M-badge or xDrive50e is much quicker than
 * the base trim of the same line).
 *
 * mapVehicle(rawVehicle) returns the same object shape data.js entries have
 * (so engine.js consumes it unchanged), plus display-only fields (mileage,
 * plate, photo, retailerName, link) that index.js surfaces to the card.
 *
 * The feed's derivative strings are inconsistent: some are clean
 * ("X3 M40d", "M2 Coupe"), others are raw Auto Trader dumps
 * ("2.0 20d MHT M Sport SUV 5dr Diesel Hybrid Auto xDrive"). Every derived
 * field is computed defensively against both forms.
 */

const ORIGIN = 'https://usedcars.bmw.co.uk';

/* --------------------------- model spec table -------------------------- *
 * Keyed by the normalized `line` (see lineFromTitle). Values are the specs
 * the live feed can't provide. `zeroTo62` here is the BASE (slowest common)
 * trim for the line; trimZeroTo62() speeds it up for M / performance trims.
 * boot = litres (seats up); sizeClass = 1 (smallest) .. 5 (largest).
 * ---------------------------------------------------------------------- */
const MODEL_SPECS = {
  '1 Series': { boot: 380, seats: 5, zeroTo62: 8.4, sizeClass: 1 },
  '2 Series': { boot: 390, seats: 4, zeroTo62: 6.5, sizeClass: 1 }, // Coupé
  '2 Series Active Tourer': { boot: 470, seats: 5, zeroTo62: 8.9, sizeClass: 2 },
  '2 Series Gran Coupe': { boot: 430, seats: 5, zeroTo62: 8.6, sizeClass: 1 },
  '3 Series': { boot: 480, seats: 5, zeroTo62: 7.4, sizeClass: 2 },
  '4 Series': { boot: 440, seats: 4, zeroTo62: 7.5, sizeClass: 2 },
  '4 Series Gran Coupe': { boot: 470, seats: 5, zeroTo62: 7.5, sizeClass: 2 },
  '5 Series': { boot: 520, seats: 5, zeroTo62: 7.5, sizeClass: 3 },
  '7 Series': { boot: 540, seats: 5, zeroTo62: 6.0, sizeClass: 5 },
  '8 Series': { boot: 440, seats: 4, zeroTo62: 5.0, sizeClass: 4 },
  X1: { boot: 540, seats: 5, zeroTo62: 8.3, sizeClass: 2 },
  X2: { boot: 470, seats: 5, zeroTo62: 8.3, sizeClass: 2 },
  X3: { boot: 570, seats: 5, zeroTo62: 7.8, sizeClass: 3 },
  X4: { boot: 525, seats: 5, zeroTo62: 7.5, sizeClass: 3 },
  X5: { boot: 500, seats: 5, zeroTo62: 6.5, sizeClass: 4 },
  X6: { boot: 580, seats: 5, zeroTo62: 6.5, sizeClass: 4 },
  X7: { boot: 750, seats: 7, zeroTo62: 5.9, sizeClass: 5 },
  Z4: { boot: 281, seats: 2, zeroTo62: 6.6, sizeClass: 1 },
  i4: { boot: 470, seats: 5, zeroTo62: 5.7, sizeClass: 2 },
  i5: { boot: 490, seats: 5, zeroTo62: 6.1, sizeClass: 3 },
  i7: { boot: 500, seats: 5, zeroTo62: 4.7, sizeClass: 5 },
  iX: { boot: 500, seats: 5, zeroTo62: 6.1, sizeClass: 4 }, // base xDrive40; 45/50/M speed up
  iX1: { boot: 490, seats: 5, zeroTo62: 8.6, sizeClass: 2 },
  iX2: { boot: 525, seats: 5, zeroTo62: 8.6, sizeClass: 2 }, // base eDrive20; xDrive30 speeds up
  iX3: { boot: 510, seats: 5, zeroTo62: 6.8, sizeClass: 3 },
  M: { boot: 440, seats: 4, zeroTo62: 4.1, sizeClass: 2 }, // pure-M line (M2/M3/M4…)
};

/** Fallback when the feed carries a line we have no specs for. */
const DEFAULT_SPEC = { boot: 460, seats: 5, zeroTo62: 8.0, sizeClass: 2 };
const warnedLines = new Set(); // log each unknown line once, not per-car

/* ------------------------------ derivations ---------------------------- */

/**
 * Normalize `title` ("BMW X3", "BMW 3 Series", "BMW M3 Competition") to a
 * MODEL_SPECS key. Pure-M cars (M2/M3/M4/M5/M8) collapse to the "M" line;
 * "M135i" / "M340d" / "M40d" are trims of a normal line, NOT the M line.
 */
function lineFromTitle(title = '') {
  const t = title.replace(/^BMW\s+/i, '').trim();
  // Pure M models: "M2", "M3 Competition", "M4", "M5", "M8" (standalone M<digit>).
  if (/^M[2-8]\b/.test(t)) return 'M';
  return t;
}

/**
 * Body style from title + derivative. SUVs are the X/iX families; the rest
 * key off derivative keywords, falling back to saloon.
 */
function bodyFor(line, derivative = '') {
  const d = derivative.toLowerCase();
  // X1-X7, iX1-iX3 and the bare iX flagship are all SUVs.
  if (/^X[1-7]$/i.test(line) || /^iX[1-3]?$/i.test(line)) return 'suv';
  if (d.includes('active tourer')) return 'mpv';
  if (d.includes('gran coupe') || d.includes('gran coupé')) return 'saloon';
  if (d.includes('touring')) return 'estate';
  if (d.includes('convertible') || d.includes('cabrio')) return 'convertible';
  if (d.includes('coupe') || d.includes('coupé')) return 'coupe';
  if (line === 'Z4') return 'convertible';
  if (line === 'M') return derivative.toLowerCase().includes('touring') ? 'estate' : 'coupe';
  if (line === '1 Series') return 'hatchback';
  return 'saloon';
}

/**
 * Normalize the feed's messy fuel strings to the engine's four values.
 * Mild hybrids ("Petrol Hybrid" / "Diesel Hybrid") are NOT plug-ins — they
 * collapse to their base fuel. Only "Plug-in Hybrid" is a phev.
 */
function fuelFor(raw = '') {
  const f = raw.toLowerCase();
  if (f.includes('electric')) return 'ev';
  if (f.includes('plug-in')) return 'phev';
  if (f.includes('diesel')) return 'diesel';
  return 'petrol'; // "Petrol", "Petrol Hybrid", anything else
}

/** Number-or-undefined guard for the feed's occasionally-null numeric fields. */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * 0-62: start from the line's base spec, then speed up for performance trims
 * detected in the derivative (M badges, xDrive50e PHEV, ti hot-hatch, etc.).
 */
function trimZeroTo62(base, line, derivative = '') {
  if (line === 'M') return base; // already the fast M figure
  const d = derivative.toLowerCase();
  // Top performance trims of a normal line.
  if (/\bm\d{2,3}[di]?\b/.test(d) || /\bm135|m235|m240|m340|m440|m40|m50|m60\b/.test(d)) {
    return Math.max(3.9, base - 3.0);
  }
  if (/xdrive50e|\b50e\b/.test(d)) return Math.max(4.6, base - 1.7); // hot PHEV
  if (/xdrive4[05]|xdrive50|\bm60\b/.test(d)) return Math.max(4.6, base - 1.5); // high-output EV/AWD
  if (/\bti\b/.test(d)) return Math.max(6.0, base - 2.0); // 128ti etc.
  return base;
}

/** Tags from line/body/trim — same vocabulary as data.js, derived. */
function tagsFor(line, body, fuel, derivative = '') {
  const tags = new Set();
  const d = derivative.toLowerCase();
  const perf = line === 'M' || /\bm1|m2|m3|m4|m34|m44|m40|m50|m60|ti\b/.test(d);

  if (perf) tags.add('drivers-car');
  if (line === 'M') tags.add('image');
  if (/^i/i.test(line) || fuel === 'ev') tags.add('tech'); // i5, iX, iX2…
  if (body === 'suv' || body === 'mpv' || body === 'estate') {
    tags.add('family');
    tags.add('practical');
  }
  if (['5 Series', '7 Series', '8 Series', 'i5', 'i7', 'iX', 'X5', 'X6', 'X7'].includes(line)) {
    tags.add('cruiser');
  }
  if (['1 Series', 'X1', 'iX1', 'iX2', '2 Series Active Tourer'].includes(line)) {
    tags.add('urban');
  }
  if (fuel === 'ev' || fuel === 'phev') tags.add('efficient');
  if (['coupe', 'convertible'].includes(body)) tags.add('image');
  if (tags.size === 0) tags.add('cruiser'); // never leave a car untagged
  return [...tags];
}

/**
 * Build the display name from title + derivative without doubling the model.
 * For X/iX/M cars the derivative already leads with the model ("X5 xDrive30d
 * M Sport"), so title would repeat it — use "BMW " + derivative. For Series
 * cars the derivative is just the trim ("320i M Sport Saloon"), so keep the
 * title. Some feed derivatives are raw Auto Trader dumps ("2.0 20d MHT M Sport
 * SUV 5dr …") with no clean model token — fall back to title + derivative.
 */
function displayName(title, derivative) {
  const t = title.replace(/^BMW\s+/i, '').trim();
  const d = derivative.trim();
  if (!d) return title;
  // Derivative already opens with the title's model word(s)?
  const firstModelToken = t.split(' ')[0]; // "X5", "3", "M3", "iX2"
  if (d.toLowerCase().startsWith(firstModelToken.toLowerCase())) {
    return `BMW ${d}`.replace(/\s+/g, ' ').trim();
  }
  return `${title} ${d}`.replace(/\s+/g, ' ').trim();
}

/** A short derived blurb — the feed has no marketing copy. */
function blurbFor(line, body, fuel, retailerName) {
  const bodyWord = {
    hatchback: 'hatchback', saloon: 'saloon', estate: 'Touring estate', suv: 'SUV',
    coupe: 'coupé', convertible: 'convertible', mpv: 'family carrier',
  }[body] || 'car';
  const fuelWord = {
    petrol: 'petrol', diesel: 'diesel', phev: 'plug-in hybrid', ev: 'electric',
  }[fuel];
  const from = retailerName ? ` from ${retailerName}` : '';
  return `Approved-used ${line} ${bodyWord}, ${fuelWord}, ready to drive away${from}.`;
}

/* ------------------------------ projection ----------------------------- */

/**
 * First usable image URL from a feed vehicle's media items, or undefined.
 * Items look like { type: 'image', url: 'https://…', … }; non-image entries
 * (e.g. video) and any without a url are skipped.
 */
function firstPhoto(media) {
  const img = media.find((m) => m?.type === 'image' && typeof m.url === 'string' && m.url);
  return img ? img.url : undefined;
}

/**
 * Project one raw feed vehicle to the engine's car schema + display fields.
 * Returns null (and the caller filters it out) if the price is missing —
 * a car with no price can't be scored on budget.
 */
export function mapVehicle(v) {
  const price = num(v?.cash_price?.value);
  if (!price) return null;

  const title = v.title || 'BMW';
  const derivative = v.derivative || '';
  const line = lineFromTitle(title);

  const spec = MODEL_SPECS[line] || DEFAULT_SPEC;
  if (!MODEL_SPECS[line] && !warnedLines.has(line)) {
    warnedLines.add(line);
    // eslint-disable-next-line no-console
    console.warn(`[mapping] no MODEL_SPECS for line "${line}" — using defaults`);
  }

  const body = bodyFor(line, derivative);
  const fuel = fuelFor(v.fuel);
  const zeroTo62 = trimZeroTo62(spec.zeroTo62, line, derivative);

  const media = Array.isArray(v.media?.items) ? v.media.items : [];
  const photo = firstPhoto(media);
  const retailerName = v?.retailer_site?.name || undefined;

  return {
    // ---- engine-scored fields (same shape as data.js) ----
    id: String(v.advert_id ?? v.vin ?? `${title}-${price}`),
    name: displayName(title, derivative),
    line,
    body,
    fuel,
    priceMin: price,
    priceMax: price, // single used-car price; scoreBudget handles min===max
    sizeClass: spec.sizeClass,
    seats: spec.seats,
    boot: spec.boot,
    zeroTo62,
    mpg: num(v?.consumption?.fuel?.values?.combined),
    evRange: num(v?.consumption?.range?.values?.total),
    tags: tagsFor(line, body, fuel, derivative),
    blurb: blurbFor(line, body, fuel, retailerName),

    // ---- display-only (surfaced by index.js publicCar) ----
    mileage: num(v.mileage),
    plate: v?.identification?.plate || undefined,
    photo,
    retailerName,
    // Miles from the searched location. Only present on `sort=distance`
    // queries (see fetchNearbyStock) — undefined on plain retailer_site
    // fetches, which is why the hero cards show no distance.
    distance: num(v?.retailer_site?.distance),
    // Internal: lets the nearby fetch drop the anchor retailer's own cars.
    // Deliberately NOT exposed by index.js publicCar().
    retailerId: v?.retailer_site?.id,
    // Public PDP is /vehicle/{advert_id} (confirmed against the live site);
    // fall back to the retailer's stock page if the feed ever omits it.
    link: v?.advert_id
      ? `${ORIGIN}/vehicle/${encodeURIComponent(v.advert_id)}`
      : `${ORIGIN}/?retailer_site=${encodeURIComponent(v?.retailer_site?.id ?? '96')}`,
  };
}
