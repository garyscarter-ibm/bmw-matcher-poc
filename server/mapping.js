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

import { brandConfig } from './brands.js';

/* --------------------------- model spec table -------------------------- *
 * Keyed by the normalized `line` (see lineFromTitle). Values are the specs
 * the live feed can't provide. `zeroTo62` here is the BASE (slowest common)
 * trim for the line; trimZeroTo62() speeds it up for M / performance trims.
 * boot = litres (seats up); sizeClass = 1 (smallest) .. 5 (largest).
 * ---------------------------------------------------------------------- */
const MODEL_SPECS_BMW = {
  '1 Series': { boot: 380, seats: 5, zeroTo62: 8.4, sizeClass: 1 },
  '2 Series': { boot: 390, seats: 4, zeroTo62: 6.5, sizeClass: 1 }, // Coupé
  '2 Series Active Tourer': { boot: 470, seats: 5, zeroTo62: 8.9, sizeClass: 2 },
  '2 Series Gran Coupe': { boot: 430, seats: 5, zeroTo62: 8.6, sizeClass: 1 },
  '3 Series': { boot: 480, seats: 5, zeroTo62: 7.4, sizeClass: 2 },
  '4 Series': { boot: 440, seats: 4, zeroTo62: 7.5, sizeClass: 2 },
  '4 Series Gran Coupe': { boot: 470, seats: 5, zeroTo62: 7.5, sizeClass: 2 },
  '5 Series': { boot: 520, seats: 5, zeroTo62: 7.5, sizeClass: 3 },
  '6 Series': { boot: 610, seats: 5, zeroTo62: 6.3, sizeClass: 3 }, // GT/Gran Coupé; older convertibles seat 4
  '7 Series': { boot: 540, seats: 5, zeroTo62: 6.0, sizeClass: 5 },
  '8 Series': { boot: 440, seats: 4, zeroTo62: 5.0, sizeClass: 4 },
  X1: { boot: 540, seats: 5, zeroTo62: 8.3, sizeClass: 2 },
  X2: { boot: 470, seats: 5, zeroTo62: 8.3, sizeClass: 2 },
  X3: { boot: 570, seats: 5, zeroTo62: 7.8, sizeClass: 3 },
  X4: { boot: 525, seats: 5, zeroTo62: 7.5, sizeClass: 3 },
  X5: { boot: 500, seats: 5, zeroTo62: 6.5, sizeClass: 4 },
  X6: { boot: 580, seats: 5, zeroTo62: 6.5, sizeClass: 4 },
  X7: { boot: 750, seats: 7, zeroTo62: 5.9, sizeClass: 5 },
  // Pure-M SUVs. The feed titles them one-off ("X4M", "X5 M") so they don't
  // fold into the base X-line key; give each the base line's boot/seats/size
  // but the M car's (already-fast) 0-62. trimZeroTo62 leaves these untouched
  // (their derivatives carry no m<digits> trim token to speed up further).
  X3M: { boot: 570, seats: 5, zeroTo62: 4.0, sizeClass: 3 },
  X4M: { boot: 525, seats: 5, zeroTo62: 4.0, sizeClass: 3 },
  'X5 M': { boot: 500, seats: 5, zeroTo62: 3.9, sizeClass: 4 },
  'X6 M': { boot: 580, seats: 5, zeroTo62: 3.9, sizeClass: 4 },
  XM: { boot: 527, seats: 5, zeroTo62: 4.6, sizeClass: 4 }, // M PHEV SUV; 50e ~5.1, V8 ~4.1
  Z4: { boot: 281, seats: 2, zeroTo62: 6.6, sizeClass: 1 },
  i3: { boot: 260, seats: 4, zeroTo62: 7.3, sizeClass: 1 }, // electric city car; i3s 7.3s
  i4: { boot: 470, seats: 5, zeroTo62: 5.7, sizeClass: 2 },
  i5: { boot: 490, seats: 5, zeroTo62: 6.1, sizeClass: 3 },
  i7: { boot: 500, seats: 5, zeroTo62: 4.7, sizeClass: 5 },
  iX: { boot: 500, seats: 5, zeroTo62: 6.1, sizeClass: 4 }, // base xDrive40; 45/50/M speed up
  iX1: { boot: 490, seats: 5, zeroTo62: 8.6, sizeClass: 2 },
  iX2: { boot: 525, seats: 5, zeroTo62: 8.6, sizeClass: 2 }, // base eDrive20; xDrive30 speeds up
  iX3: { boot: 510, seats: 5, zeroTo62: 6.8, sizeClass: 3 },
  M: { boot: 440, seats: 4, zeroTo62: 4.1, sizeClass: 2 }, // pure-M line (M2/M3/M4…)

  // Filled from the used-stock dump (fixtures/bmw-cars.json) — lines that were
  // falling back to DEFAULT_SPEC. Figures sourced from carwow / Auto Express /
  // Parkers (Parkers 0-60 used as a close proxy for 0-62); see docs/bmw-spec-gaps.md.
  i8: { boot: 154, seats: 4, zeroTo62: 4.4, sizeClass: 2 }, // I12 plug-in hybrid sports coupe
  '2 Series Gran Tourer': { boot: 560, seats: 7, zeroTo62: 9.5, sizeClass: 2 }, // F46 7-seat MPV
  '6 Series Gran Coupe': { boot: 460, seats: 5, zeroTo62: 5.4, sizeClass: 3 }, // F06 4-door coupe
  '3 Series Gran Turismo': { boot: 520, seats: 5, zeroTo62: 7.7, sizeClass: 2 }, // F34 fastback
  '5 Series Gran Turismo': { boot: 590, seats: 5, zeroTo62: 6.7, sizeClass: 3 }, // F07 fastback
  Z8: { boot: 200, seats: 2, zeroTo62: 4.5, sizeClass: 1 }, // E52 V8 roadster (boot est.)
  Z3: { boot: 165, seats: 2, zeroTo62: 6.7, sizeClass: 1 }, // roadster, 2.8i (boot est.)
  // Alpina performance variants (own figures where found).
  'Alpina B3': { boot: 500, seats: 5, zeroTo62: 3.8, sizeClass: 2 }, // G21 Touring, Bi-Turbo AWD
  'Alpina D3': { boot: 500, seats: 5, zeroTo62: 4.6, sizeClass: 2 }, // diesel Touring (D3 S)
  'Alpina D5': { boot: 530, seats: 5, zeroTo62: 4.7, sizeClass: 3 }, // 5-Series diesel saloon
  'Alpina XB7': { boot: 326, seats: 7, zeroTo62: 4.1, sizeClass: 5 }, // X7-based luxury SUV
};

/* MINI range. Keyed by the `line` MINI's feed titles use ("MINI Hatch",
 * "MINI Countryman", …) normalised to the model word (see miniLine). boot =
 * litres (seats up), sizeClass 1..5 on the same scale as BMW so the engine's
 * size scoring is comparable. zeroTo62 is the base trim; miniTrimZeroTo62
 * speeds up JCW / S / SE trims. Every current MINI is a 4/5-seat small car. */
const MODEL_SPECS_MINI = {
  // zeroTo62 = the BASE (slowest common) trim for the line, i.e. the Cooper C;
  // miniTrimZeroTo62 speeds up S / SE / JCW trims to their real figures.
  // Figures are official MINI 0-62 mph, sourced from carwow / Auto Express /
  // ev-database / BMW Group Press (see docs/mini-0-62.md).
  Hatch: { boot: 210, seats: 4, zeroTo62: 7.7, sizeClass: 1 }, // Cooper C 3/5-door
  Convertible: { boot: 160, seats: 4, zeroTo62: 8.2, sizeClass: 1 }, // Cooper C cabrio
  Clubman: { boot: 360, seats: 5, zeroTo62: 9.0, sizeClass: 2 }, // Cooper (F54); S 7.3, JCW 306HP 4.9
  Countryman: { boot: 460, seats: 5, zeroTo62: 8.3, sizeClass: 2 }, // Countryman C crossover
  Aceman: { boot: 300, seats: 5, zeroTo62: 7.9, sizeClass: 1 }, // Aceman E; SE 7.1, JCW 6.4
  Electric: { boot: 210, seats: 4, zeroTo62: 7.3, sizeClass: 1 }, // electric Hatch (Cooper E)
  Coupe: { boot: 280, seats: 2, zeroTo62: 6.9, sizeClass: 1 }, // discontinued R58 JCW two-seater
};

/** Fallback when the feed carries a line we have no specs for. */
const DEFAULT_SPEC = { boot: 460, seats: 5, zeroTo62: 8.0, sizeClass: 2 };
const DEFAULT_SPEC_MINI = { boot: 210, seats: 4, zeroTo62: 7.7, sizeClass: 1 };
const warnedLines = new Set(); // log each unknown line once, not per-car

/* ------------------------------ derivations ---------------------------- */

/**
 * Normalize `title` ("BMW X3", "BMW 3 Series", "BMW M3 Competition") to a
 * MODEL_SPECS key. Pure-M cars (M2/M3/M4/M5/M8) collapse to the "M" line;
 * "M135i" / "M340d" / "M40d" are trims of a normal line, NOT the M line.
 */
function lineFromTitle(title = '', derivative = '') {
  const t = title.replace(/^BMW\s+/i, '').trim();
  // Generic feed catch-all: the title is just "I Series" and the real model
  // lives in the derivative ("iX xDrive50 M Sport…"). Derive the i-line from the
  // derivative's leading token (iX, i4, i5, i7, iX1-3) so it isn't left on the
  // default spec.
  if (/^i series$/i.test(t)) {
    const m = /^(iX[123]?|i[3457])\b/i.exec(derivative.trim());
    if (m) {
      const tok = m[1];
      // Normalise case to the spec keys: iX, iX1, iX2, iX3, i4, i5, i7, i3.
      return /^ix/i.test(tok) ? `iX${tok.slice(2)}` : tok.toLowerCase();
    }
  }
  // Alpina: the feed titles these inconsistently ("Alpina B3", "Alpina XB7",
  // or the catch-all "Alpina Unspecified Models" with the real model in the
  // derivative, e.g. "ALPINA D3 2.0D TOURING"). Normalise to an "Alpina <model>"
  // spec key from whichever field carries the model code.
  if (/alpina/i.test(t)) {
    const src = /unspecified/i.test(t) ? derivative : t;
    const m = /\b(XB7|B\d|D\d)\b/i.exec(src);
    if (m) return `Alpina ${m[1].toUpperCase()}`;
    return 'Alpina B3'; // sensible fallback: a fast 3-Series-based Alpina
  }
  // Pure M models: "M2", "M3 Competition", "M4", "M5", "M8" (standalone M<digit>).
  if (/^M[2-8]\b/.test(t)) return 'M';
  // The feed titles the electric i3 city car "i3 Series"; fold it to the "i3"
  // spec key (the "i3s"/"i3" derivatives are trims of the same line).
  if (/^i3\b/.test(t)) return 'i3';
  // The feed titles the Z3/Z8 roadsters "Z3 Series" / "Z8 Series"; fold to the
  // bare "Z3"/"Z8" spec keys (Z4 is already titled "Z4", so it's unaffected).
  if (/^Z[38]\b/.test(t)) return t.slice(0, 2);
  return t;
}

/**
 * Body style from title + derivative. SUVs are the X/iX families; the rest
 * key off derivative keywords, falling back to saloon.
 */
function bodyFor(line, derivative = '') {
  const d = derivative.toLowerCase();
  // X1-X7, the M-SUVs (X3M/X4M/X5 M/X6 M), the XM, iX1-iX3, the bare iX
  // flagship and the Alpina XB7 are all SUVs.
  if (/^X[1-7]$/i.test(line) || /^X\d ?M$/i.test(line) || line === 'XM'
    || /^iX[1-3]?$/i.test(line) || line === 'Alpina XB7') return 'suv';
  if (line === 'i3') return 'hatchback';
  // Gran Tourer (F45/F46) is a compact MPV; catch it before "coupe" keyword
  // matching (its derivative says "Gran Tourer", not "coupe").
  if (line === '2 Series Gran Tourer' || d.includes('gran tourer')) return 'mpv';
  // The Gran Turismo fastbacks (3/5 Series GT) are large 5-door hatchbacks.
  if (/gran turismo/i.test(line) || d.includes('gran turismo')) return 'hatchback';
  if (line === 'i8' || line === 'Z8') return line === 'Z8' ? 'convertible' : 'coupe';
  if (line === 'Z3') return 'convertible'; // roadster
  // Alpina B3/D3 are Tourings (estates); D5 is a saloon — fall through to the
  // "touring" keyword check below, which their derivatives carry.
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
  // Pure-M lines already carry the fast figure. XM and the M-SUVs (X3M/X4M/
  // X5 M/X6 M) do too, and their derivatives ("XM 50e", "X5 M") would
  // otherwise trip the 50e / trim rules below and mis-speed them.
  if (line === 'M' || line === 'XM' || /^X\d ?M$/.test(line)) return base;
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
  // Pure-M line, the M-SUVs (X3M/X4M/X5 M/X6 M) and the XM are all M cars;
  // the rest key off M-trim tokens in the derivative.
  const mLine = line === 'M' || line === 'XM' || /^X\d ?M$/.test(line);
  const perf = mLine || /\bm1|m2|m3|m4|m34|m44|m40|m50|m60|ti\b/.test(d);

  if (perf) tags.add('drivers-car');
  if (mLine) tags.add('image');
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

/* ------------------------- MINI derivations ---------------------------- *
 * MINI's range is small and its feed is tidy — the model word sits in the
 * title ("MINI Hatch", "MINI Countryman") and the derivative carries the
 * door count / trim ("Cooper S 3 Door", "Countryman SE ALL4"). No M-line
 * collapse, no i-prefix — so these are much simpler than the BMW versions.
 * ---------------------------------------------------------------------- */

/** Normalise a MINI title to a MODEL_SPECS_MINI key ("MINI Hatch" → "Hatch"). */
function miniLine(title = '') {
  const t = title.replace(/^MINI\s+/i, '').trim();
  if (/hatch/i.test(t)) return 'Hatch';
  if (/countryman/i.test(t)) return 'Countryman';
  if (/clubman/i.test(t)) return 'Clubman';
  if (/aceman/i.test(t)) return 'Aceman';
  if (/convertible|cabrio/i.test(t)) return 'Convertible';
  if (/coupe|coupé/i.test(t)) return 'Coupe'; // discontinued R58 two-seater
  if (/electric/i.test(t)) return 'Electric';
  return t.split(' ')[0] || 'Hatch';
}

/** Body style for a MINI. Countryman/Aceman are crossovers (suv), the rest
 *  hatchbacks except the obvious convertible/clubman. */
function miniBody(line, derivative = '') {
  const d = derivative.toLowerCase();
  if (line === 'Countryman' || line === 'Aceman') return 'suv';
  if (line === 'Clubman' || d.includes('clubman')) return 'estate';
  if (line === 'Convertible' || d.includes('convertible') || d.includes('cabrio')) return 'convertible';
  if (line === 'Coupe' || d.includes('coupe') || d.includes('coupé')) return 'coupe';
  return 'hatchback';
}

/** 0-62 for a MINI trim: JCW is quick, S/SE quicker than the Cooper base.
 *  All figures are official MINI 0-62 mph (see docs/mini-0-62.md for sources). */
function miniTrimZeroTo62(base, line = '', derivative = '') {
  // MINI's 0-62 is set mostly by the trim badge, not the line, so map to the
  // real absolute figure per trim.
  const d = derivative.toLowerCase();
  const jcw = /john cooper works|\bjcw\b/.test(d);
  if (jcw) {
    if (line === 'Clubman') return 4.9; // Clubman JCW 306HP (Auto Express / BMW Press)
    if (line === 'Countryman') return 5.4; // Countryman JCW ALL4 (carwow)
    if (line === 'Aceman') return 6.4; // JCW Aceman electric (carwow / ev-database)
    if (line === 'Convertible') return 6.4; // JCW Convertible (BMW Group Press)
    return 6.1; // Hatch JCW (petrol 6.1; electric JCW 5.9 — feed can't split, use 6.1)
  }
  // "Cooper S E" / "SE" = the quick electric S; "Cooper S" = petrol S.
  const electricS = /\bs\s?e\b|\bse\b/.test(d);
  const cooperS = /\bcooper s\b|\bs all4\b|\bs sport\b|\bs exclusive\b|\bs classic\b|\bconvertible s\b/.test(d);
  if (line === 'Aceman') {
    if (electricS) return 7.1; // Aceman SE (carwow / ev-database)
    return base; // Aceman E — 7.9
  }
  if (line === 'Countryman') {
    if (electricS) return 5.6; // Countryman SE ALL4 (ev-database / carwow)
    if (cooperS) return 7.1; // Countryman S ALL4 (carwow)
    return base; // Countryman C — 8.3
  }
  if (line === 'Convertible') {
    if (cooperS) return 6.9; // Cooper Convertible S (Auto Express official 0-62)
    return base; // Cooper Convertible C — 8.2
  }
  if (line === 'Clubman') {
    if (cooperS) return 7.3; // Clubman Cooper S (Auto Express 0-62)
    return base; // Clubman Cooper — 9.0
  }
  // Hatch (petrol or electric). "Cooper E" (plain electric, no S) is 7.3s — the
  // Hatch base is the petrol Cooper C (7.7), so give the plain electric its own.
  if (electricS) return 6.7; // Cooper SE electric hot hatch (ev-database / carwow)
  if (/\bcooper e\b|\belectric\b|\blevel \d\b/.test(d)) return 7.3; // Cooper E electric hatch
  if (cooperS) return 6.6; // Cooper S petrol hatch (carwow / parkers)
  return base; // Cooper C / Classic / Exclusive base petrol (7.7)
}

/**
 * MINI style line (trim character) from the derivative: Classic / Exclusive /
 * Sport, plus JCW as the sporting extreme. This is the axis the range actually
 * splits on and the engine can't otherwise see — Classic and Exclusive share a
 * ~7.7s 0-62 and overlapping prices, so nothing else distinguishes them (see
 * docs/mini-first-questions.md). JCW is checked first (a JCW is always the sport
 * end); one-off edition names (Resolute/Untamed/Favoured) name no style line and
 * return null → scored neutral, never penalised. BMW has no equivalent (M Sport
 * is 73% of stock), so only the MINI mapper sets this.
 */
function miniStyleLine(derivative = '') {
  const d = derivative.toLowerCase();
  if (/john cooper works|\bjcw\b/.test(d)) return 'jcw';
  if (/\bsport\b/.test(d)) return 'sport';
  if (/\bexclusive\b/.test(d)) return 'exclusive';
  if (/\bclassic\b/.test(d)) return 'classic';
  return null;
}

/**
 * Door count for a MINI, but only where it's a real choice: the Hatch sells as
 * 3- or 5-door and the derivative states which ("Cooper S 3 Door"). Every other
 * body has a fixed door count implied by its shape, so we return null there and
 * the scorer treats it as "no door question applies". ~17% of hatch derivatives
 * don't state a count either → null → neutral, not a miss (unknown ≠ wrong).
 */
function miniDoors(body, derivative = '') {
  if (body !== 'hatchback') return null;
  const d = derivative.toLowerCase();
  if (/\b3[\s-]?door\b/.test(d)) return 3;
  if (/\b5[\s-]?door\b/.test(d)) return 5;
  return null;
}

/** Tags for a MINI — the MINI range skews playful/urban/tech. */
function miniTags(line, body, fuel, derivative = '') {
  const tags = new Set();
  const d = derivative.toLowerCase();
  const jcw = /john cooper works|\bjcw\b/.test(d);
  const sporty = jcw || /\bcooper s\b|\bcooper se\b|all4/.test(d);
  tags.add('urban'); // every MINI is a city-friendly small car
  if (jcw) tags.add('image');
  if (sporty) tags.add('drivers-car');
  if (fuel === 'ev') { tags.add('tech'); tags.add('efficient'); }
  if (line === 'Countryman' || line === 'Aceman' || line === 'Clubman') {
    tags.add('family');
    tags.add('practical');
  }
  if (body === 'convertible') tags.add('image');
  if (tags.size === 0) tags.add('urban');
  return [...tags];
}

/** MINI display name: the derivative already leads with the model word for
 *  most trims ("Countryman S ALL4"), and "Cooper …" trims want the title. */
function miniDisplayName(title, derivative) {
  const t = title.replace(/^MINI\s+/i, '').trim();
  const d = (derivative || '').trim();
  if (!d) return title;
  const firstToken = t.split(' ')[0].toLowerCase();
  if (d.toLowerCase().startsWith(firstToken)) {
    return `MINI ${d}`.replace(/\s+/g, ' ').trim();
  }
  return `${title} ${d}`.replace(/\s+/g, ' ').trim();
}

/** A short derived blurb for a MINI (the feed has no marketing copy). */
function miniBlurb(line, body, fuel, retailerName) {
  const bodyWord = {
    hatchback: 'hatch', estate: 'Clubman estate', suv: 'crossover',
    convertible: 'convertible',
  }[body] || 'car';
  const fuelWord = { petrol: 'petrol', ev: 'electric', phev: 'plug-in hybrid', diesel: 'diesel' }[fuel];
  const from = retailerName ? ` from ${retailerName}` : '';
  return `Approved-used MINI ${line} ${bodyWord}, ${fuelWord}, ready to drive away${from}.`;
}

/* -------------------------- Honda derivations -------------------------- *
 * Honda's approved-used stock has no clean feed API, so its cars come from a
 * scrape of the server-rendered listing pages (scripts/scrape-honda.mjs) into
 * a FLAT raw record — { title, price, mileage, fuel, transmission, doors, bhp,
 * cc, mpg, co2, colour, year, reg, image, link } — NOT the Auto Trader feed
 * shape mapVehicle() consumes. So Honda is mapped by its own projection,
 * mapHondaRaw() below, run once by scripts/build-honda-fixtures.mjs to produce
 * the already-mapped fixtures/honda-cars.json the fixtures loader serves.
 *
 * The scrape carries mileage / fuel / transmission / doors / power / mpg /
 * colour / year directly (near 100% complete), richer than the BMW feed. What
 * it lacks — 0-62, boot litres, seat count, size class — comes from the
 * per-line spec table below, exactly as BMW/MINI fill those from MODEL_SPECS.
 * ---------------------------------------------------------------------- */

/* Honda UK range. Keyed by the normalized model line (see hondaLine). boot =
 * litres (rear seats up), sizeClass 1..5 on the shared BMW/MINI scale so the
 * engine's size scoring is comparable across brands. zeroTo62 is the model's
 * mainstream figure (Honda has no fast performance trims in this used pool, so
 * unlike BMW/MINI there's no trim speed-up). Figures are official Honda UK /
 * carwow / Auto Express (see the Honda section of DECISIONS.md). */
// `mpg` is the official Honda UK WLTP combined figure, used as a fallback for
// the handful of listings the scrape leaves without one — a combustion car with
// no mpg can't be scored on the engine's economy axis, so the model figure fills
// it the same way boot/seats/zeroTo62 do. (The e:HEV hybrids' real-world figures
// are high, which is the point — a mileage-conscious buyer should be steered to
// them.) EV lines carry no mpg; they're scored on evRange instead.
const MODEL_SPECS_HONDA = {
  Jazz: { boot: 304, seats: 5, zeroTo62: 9.4, sizeClass: 1, mpg: 62 }, // supermini; e:HEV hybrid
  Civic: { boot: 410, seats: 5, zeroTo62: 7.8, sizeClass: 2, mpg: 56 }, // 11th-gen e:HEV hatch
  'HR-V': { boot: 319, seats: 5, zeroTo62: 10.6, sizeClass: 2, mpg: 52 }, // small SUV; e:HEV
  'ZR-V': { boot: 380, seats: 5, zeroTo62: 8.0, sizeClass: 3, mpg: 48 }, // mid SUV; e:HEV
  'CR-V': { boot: 587, seats: 5, zeroTo62: 9.5, sizeClass: 3, mpg: 44 }, // large SUV; e:HEV (587L 5-seat)
  // The two electric lines carry a WLTP range so the engine's economy axis has
  // the figure it needs for an EV (evRange, not mpg). Honda e = 35.5kWh ~137mi;
  // e:Ny1 = 68.8kWh ~256mi (official Honda UK WLTP).
  e: { boot: 171, seats: 4, zeroTo62: 8.3, sizeClass: 1, evRange: 137 }, // electric city car (Honda e)
  'e:Ny1': { boot: 361, seats: 5, zeroTo62: 7.7, sizeClass: 2, evRange: 256 }, // electric small SUV
};
const DEFAULT_SPEC_HONDA = {
  boot: 330, seats: 5, zeroTo62: 9.5, sizeClass: 2, mpg: 50, evRange: 150,
};

/** Normalise a scraped Honda title to a MODEL_SPECS_HONDA key. The scrape's
 *  casing is inconsistent ("HR-V"/"Hr-v", "CR-V"/"Cr-v", "ZR-V"/"Zr-v") and the
 *  Honda e is titled "Honda Honda E …", so fold all of that here. */
function hondaLine(title = '') {
  // Strip a leading "Honda" (and the doubled "Honda Honda" the e carries).
  const t = title.replace(/^Honda\s+/i, '').replace(/^Honda\s+/i, '').trim();
  const w = (t.split(/\s+/)[0] || '').toLowerCase();
  if (w === 'civic') return 'Civic';
  if (w === 'jazz') return 'Jazz';
  if (w === 'hr-v' || w === 'hrv') return 'HR-V';
  if (w === 'cr-v' || w === 'crv') return 'CR-V';
  if (w === 'zr-v' || w === 'zrv') return 'ZR-V';
  if (w.startsWith('e:ny')) return 'e:Ny1';
  if (w === 'e') return 'e';
  return t.split(/\s+/)[0] || 'Jazz';
}

/** Body style for a Honda. The e is a hatchback; HR-V / ZR-V / CR-V are SUVs;
 *  Jazz and Civic are hatchbacks. e:Ny1 is a small electric SUV. */
function hondaBody(line) {
  if (line === 'HR-V' || line === 'CR-V' || line === 'ZR-V' || line === 'e:Ny1') return 'suv';
  return 'hatchback';
}

/**
 * Fuel for a Honda, from the scrape's fuel string. Honda's big hybrid slice is
 * "Petrol Hybrid" — these are FULL (self-charging i-MMD / e:HEV) hybrids, not
 * plug-ins, so like the BMW mapper's mild hybrids they collapse to petrol on
 * the engine's fuel axis (petrol|diesel|phev|ev). The hybrid identity, which is
 * a real Honda selling point, is carried as a tag and in the blurb instead of a
 * fuel category the engine doesn't model. Honda sells no diesel or plug-in
 * hybrid in this pool bar a handful of older diesel HR-Vs.
 */
function hondaFuel(raw = '') {
  const f = String(raw).toLowerCase();
  if (f.includes('electric')) return 'ev';
  if (f.includes('diesel')) return 'diesel';
  return 'petrol'; // "Petrol", "Petrol Hybrid"
}

/** True when the scrape's fuel string marks a self-charging hybrid. */
function hondaIsHybrid(raw = '') {
  return /hybrid/i.test(String(raw));
}

/** Tags for a Honda — the range skews practical, efficient and family. */
function hondaTags(line, body, rawFuel) {
  const tags = new Set();
  const fuel = hondaFuel(rawFuel);
  if (body === 'suv') { tags.add('family'); tags.add('practical'); }
  if (line === 'Jazz') { tags.add('urban'); tags.add('practical'); }
  if (line === 'Civic') tags.add('family');
  if (line === 'e') { tags.add('urban'); tags.add('tech'); }
  if (fuel === 'ev') { tags.add('tech'); tags.add('efficient'); }
  if (hondaIsHybrid(rawFuel)) tags.add('efficient');
  if (tags.size === 0) tags.add('practical'); // never leave a Honda untagged
  return [...tags];
}

/** Honda display name: keep the full scraped title (it carries the trim), but
 *  fix the doubled marque the e ships with ("Honda Honda E …" → "Honda e …"),
 *  normalise a stray ALL-CAPS model echo ("Jazz JAZZ 1.3 …" → "Jazz 1.3"), and
 *  restore the canonical model casing the scrape mangles ("Cr-v" → "CR-V"). */
function hondaDisplayName(title = '') {
  let name = String(title).replace(/^Honda\s+Honda\s+/i, 'Honda ').trim();
  // "Honda E" reads better lowercased as the model is styled "Honda e".
  name = name.replace(/^Honda E\b/, 'Honda e');
  // Drop an all-caps echo of the model word right after the model word.
  name = name.replace(/\b(Jazz|Civic)\s+\1\b/i, '$1');
  // The listing scrape lower-cases the hyphenated SUV names inconsistently
  // ("Cr-v", "Hr-v", "Zr-v"); restore Honda's canonical CR-V / HR-V / ZR-V.
  name = name.replace(/\b([CHZ])r-v\b/gi, (_, c) => `${c.toUpperCase()}R-V`);
  return name.replace(/\s+/g, ' ').trim();
}

/** A short derived blurb for a Honda (the scrape has no marketing copy). */
function hondaBlurb(line, body, rawFuel, retailerName) {
  const bodyWord = { hatchback: 'hatchback', suv: 'SUV' }[body] || 'car';
  let fuelWord;
  if (hondaFuel(rawFuel) === 'ev') fuelWord = 'fully electric';
  else if (hondaIsHybrid(rawFuel)) fuelWord = 'self-charging hybrid';
  else fuelWord = hondaFuel(rawFuel) === 'diesel' ? 'diesel' : 'petrol';
  const from = retailerName ? ` from ${retailerName}` : '';
  return `Approved-used Honda ${line} ${bodyWord}, ${fuelWord}, ready to drive away${from}.`;
}

/* Honda's approved-used stock is a single national programme, not a network of
 * distinct dealer sites like BMW/MINI, so every scraped car gets one stable
 * synthetic retailer identity. The fixtures loader then serves the whole pool
 * for any retailer request (it narrows by retailerId only when a match exists,
 * else serves everything). */
const HONDA_RETAILER_ID = 'honda-approved';
const HONDA_RETAILER_NAME = 'Honda Approved Used';

/**
 * Project one FLAT scraped Honda record (scripts/scrape-honda.mjs output) to the
 * engine's mapped-car schema — the SAME shape mapVehicle() produces for BMW/MINI
 * and the fixtures loader serves. Returns null (caller filters) if there's no
 * price, since a car with no price can't be scored on budget.
 */
export function mapHondaRaw(raw) {
  const price = num(raw?.price);
  if (!price) return null;

  const { origin, defaultRetailer } = brandConfig('honda');
  const line = hondaLine(raw.title);
  const spec = MODEL_SPECS_HONDA[line] || DEFAULT_SPEC_HONDA;
  if (!MODEL_SPECS_HONDA[line]) {
    const warnKey = `honda:${line}`;
    if (!warnedLines.has(warnKey)) {
      warnedLines.add(warnKey);
      // eslint-disable-next-line no-console
      console.warn(`[mapping] no honda MODEL_SPECS for line "${line}" — using defaults`);
    }
  }
  const body = hondaBody(line);
  const fuel = hondaFuel(raw.fuel);
  // An EV is scored on range, not mpg. Prefer the scrape's own figure if it
  // carried one, else the model spec's WLTP range. Non-EVs leave this undefined.
  const evRange = fuel === 'ev' ? (num(raw.range) || spec.evRange) : undefined;

  return {
    // ---- engine-scored fields (same shape as data.js / mapVehicle) ----
    id: String(raw.id ?? raw.reg ?? `${raw.title}-${price}`),
    name: hondaDisplayName(raw.title),
    line,
    body,
    fuel,
    priceMin: price,
    priceMax: price,
    sizeClass: spec.sizeClass,
    seats: spec.seats,
    boot: spec.boot,
    zeroTo62: spec.zeroTo62,
    // Honda asks neither trim-line nor door question (its used range is single
    // trim-tier per car with a fixed 5-door body), so these stay null like BMW.
    styleLine: null,
    doors: num(raw.doors) === 3 ? 3 : null,
    // The scrape carries no factory-options list, so there are no equipment
    // concepts to surface. Empty is honest — the refinement step reads variance
    // and simply finds none, exactly as it would for a feed that omitted them.
    features: [],
    transmission: transmissionFor(raw.transmission),
    // A combustion car needs a positive mpg for the economy axis; if the scrape
    // omitted it, fall back to the model's official WLTP combined figure. EVs
    // leave mpg 0 (they're scored on evRange).
    mpg: fuel === 'ev' ? num(raw.mpg) : (num(raw.mpg) || spec.mpg),
    ...(evRange ? { evRange } : {}),
    tags: hondaTags(line, body, raw.fuel),
    blurb: hondaBlurb(line, body, raw.fuel, HONDA_RETAILER_NAME),

    // ---- display-only (surfaced by index.js publicCar) ----
    mileage: num(raw.mileage),
    plate: raw.reg || undefined,
    // Registration year/date power the swipe card's "N years old" frame; where
    // present they're more accurate than decoding the age code off the plate,
    // so ageInYears prefers them (see match-signal.js).
    year: raw.year || undefined,
    firstReg: raw.firstReg || undefined,
    photo: raw.image || undefined,
    retailerName: HONDA_RETAILER_NAME,
    retailerId: HONDA_RETAILER_ID,
    // The scrape captured each car's real PDP link; fall back to the brand
    // origin if a record ever lacks one.
    link: raw.link || `${origin}/?retailer_site=${encodeURIComponent(defaultRetailer)}`,
  };
}

/* ======================================================================= *
 * FORD — the second fixtures-source brand (curated, not scraped).
 *
 * Ford's live approved-used feed (servicescache.ford.com) is behind an Akamai
 * edge that drops the connection from this environment, so fixtures/ford-cars.json
 * is curated from public Ford UK spec data. It uses the SAME flat-raw → mapped-car
 * projection as Honda (mapFordRaw), so when the real feed becomes reachable its
 * adapter can hand the same flat records straight in. See DECISIONS.md.
 *
 * Ford's range is the broadest we carry: a Ka city car through a Mustang and a
 * Mach-E, every body from supermini to pickup, every fuel from petrol-mHEV to EV.
 * Two things make its mapper richer than Honda's: a real performance halo (ST /
 * Mustang / Mach-E GT get a proper 0-62 speed-up, like BMW's M trims), and a
 * genuine EV + PHEV split (Kuga PHEV, and the Mach-E / Explorer / Capri / Puma
 * Gen-E EVs), so fuel is read from the derivative as well as the fuel field.
 * ======================================================================= */

/* Per-line spec fill (boot litres, seats, base 0-62s, sizeClass 1..5, combined
 * mpg for combustion, evRange miles for EV/PHEV). Figures are official Ford UK /
 * WLTP; the base 0-62 is a mainstream trim, sped up for ST/GT in trimZeroTo62Ford.
 * See the Ford section of DECISIONS.md for sourcing. */
const MODEL_SPECS_FORD = {
  // Figures reconciled against carwow / Auto Express / Parkers (Aug 2026 research
  // pass); the base 0-62 is a mainstream trim, sped up for ST/GT below.
  Ka: { boot: 270, seats: 5, zeroTo62: 13.3, sizeClass: 1, mpg: 56 }, // Ka+ city car
  Fiesta: { boot: 292, seats: 5, zeroTo62: 9.9, sizeClass: 2, mpg: 53 }, // supermini (292L, 53.3mpg WLTP)
  Focus: { boot: 375, seats: 5, zeroTo62: 9.7, sizeClass: 3, mpg: 55 }, // family hatch (375L; estate 575L below)
  Puma: { boot: 456, seats: 5, zeroTo62: 9.8, sizeClass: 3, mpg: 52 }, // small SUV, mHEV (456L, 52mpg)
  'Puma Gen-E': { boot: 523, seats: 5, zeroTo62: 8.0, sizeClass: 3, evRange: 233 }, // electric Puma (WLTP 233mi)
  Kuga: { boot: 412, seats: 5, zeroTo62: 9.5, sizeClass: 4, mpg: 45 }, // mid SUV 1.5 EcoBoost (412L; PHEV below)
  EcoSport: { boot: 355, seats: 5, zeroTo62: 12.7, sizeClass: 3, mpg: 48 }, // small SUV (older)
  Mondeo: { boot: 541, seats: 5, zeroTo62: 9.4, sizeClass: 4, mpg: 56 }, // large hatch 2.0 EcoBlue (541L, 56.5mpg)
  Mustang: { boot: 408, seats: 4, zeroTo62: 5.3, sizeClass: 5, mpg: 28 }, // 5.0 V8 GT coupe (408L, 5.3s, 28mpg)
  'Mustang Mach-E': { boot: 402, seats: 5, zeroTo62: 6.3, sizeClass: 4, evRange: 273 }, // electric SUV (Ext Range RWD)
  Explorer: { boot: 470, seats: 5, zeroTo62: 6.4, sizeClass: 5, evRange: 374 }, // electric SUV (Ext Range RWD)
  Capri: { boot: 572, seats: 5, zeroTo62: 6.4, sizeClass: 4, evRange: 390 }, // electric coupe-SUV (Ext Range RWD)
  Galaxy: { boot: 300, seats: 7, zeroTo62: 10.9, sizeClass: 5, mpg: 52 }, // 7-seat MPV (300L all-up, 52.3mpg)
  'S-Max': { boot: 285, seats: 7, zeroTo62: 10.8, sizeClass: 5, mpg: 53 }, // 7-seat MPV (285L all-up, 53.3mpg)
  Tourneo: { boot: 1213, seats: 5, zeroTo62: 11.4, sizeClass: 4, mpg: 50 }, // Tourneo Connect (1,213L behind row 2)
  Ranger: { boot: 1200, seats: 5, zeroTo62: 9.0, sizeClass: 5, mpg: 33 }, // pickup, open load bed scored as boot
};
const DEFAULT_SPEC_FORD = {
  boot: 400, seats: 5, zeroTo62: 10.0, sizeClass: 3, mpg: 48, evRange: 250,
};

/* A used-price fallback per line, so a curated record without a price can still
 * be scored (the fixtures builder always sets one, but this keeps the projection
 * total). Representative 2-4-year-old GBP values. */
// The Kuga PHEV's official electric-only WLTP range (miles). The petrol Kuga
// scores on mpg; the PHEV scores on evRange, so it needs its own figure — the
// spec table's Kuga entry is the petrol one.
const KUGA_PHEV_RANGE = 42;

/** Normalise a Ford title/derivative to a MODEL_SPECS_FORD key. Order matters:
 *  the multi-word lines (Mustang Mach-E, Puma Gen-E, S-Max) are tested before the
 *  bare ones so "Mustang Mach-E" doesn't fold to "Mustang". */
function fordLine(title = '', derivative = '') {
  const s = `${title} ${derivative}`.toLowerCase();
  if (/mach-?e/.test(s)) return 'Mustang Mach-E';
  if (/mustang/.test(s)) return 'Mustang';
  if (/puma\s*gen-?e|gen-?e/.test(s)) return 'Puma Gen-E';
  if (/\bpuma\b/.test(s)) return 'Puma';
  if (/\bkuga\b/.test(s)) return 'Kuga';
  if (/\bfocus\b/.test(s)) return 'Focus';
  if (/\bfiesta\b/.test(s)) return 'Fiesta';
  if (/ecosport/.test(s)) return 'EcoSport';
  if (/\bmondeo\b/.test(s)) return 'Mondeo';
  if (/\bexplorer\b/.test(s)) return 'Explorer';
  if (/\bcapri\b/.test(s)) return 'Capri';
  if (/\bgalaxy\b/.test(s)) return 'Galaxy';
  if (/s-?max/.test(s)) return 'S-Max';
  if (/tourneo/.test(s)) return 'Tourneo';
  if (/\branger\b/.test(s)) return 'Ranger';
  if (/\bka\b/.test(s)) return 'Ka';
  return 'Focus'; // sensible mainstream default
}

/** Body style for a Ford. EV/large SUVs and crossovers → suv; MPVs → mpv;
 *  Mustang V8 → coupe (or convertible if the derivative says so); Ranger →
 *  pickup; Focus/Mondeo estate variants → estate; else hatchback. */
function fordBody(line, derivative = '') {
  const d = derivative.toLowerCase();
  if (line === 'Mustang') return /convertible|cabrio|drop/.test(d) ? 'convertible' : 'coupe';
  if (line === 'Ranger') return 'pickup';
  if (line === 'Galaxy' || line === 'S-Max' || line === 'Tourneo') return 'mpv';
  if (['Puma', 'Puma Gen-E', 'Kuga', 'EcoSport', 'Mustang Mach-E', 'Explorer', 'Capri'].includes(line)) return 'suv';
  if ((line === 'Focus' || line === 'Mondeo') && /estate|wagon|turnier|sportbrake/.test(d)) return 'estate';
  return 'hatchback';
}

/** Fuel for a Ford, from the fuel string first, then the derivative (which is
 *  often where the electrification is named). phev is a real category for Ford
 *  (Kuga PHEV), so unlike Honda it is not folded into petrol. Mild-hybrid
 *  EcoBoost mHEV is petrol. */
function fordFuel(rawFuel = '', line = '', derivative = '') {
  const f = String(rawFuel).toLowerCase();
  const d = derivative.toLowerCase();
  // Electric-only lines are always EV regardless of a sparse fuel field.
  if (['Puma Gen-E', 'Mustang Mach-E', 'Explorer', 'Capri'].includes(line)) return 'ev';
  if (f.includes('electric') || /\bev\b|gen-?e|mach-?e/.test(d)) return 'ev';
  if (f.includes('plug') || /phev|plug-?in/.test(f) || /phev|plug-?in/.test(d)) return 'phev';
  if (f.includes('diesel') || /tdci|ecoblue/.test(d)) return 'diesel';
  return 'petrol'; // petrol, EcoBoost, mHEV
}

/** True when the derivative marks a Ford performance trim (ST / ST-Line is a
 *  look, not the hot car, so only ST / ST-X / GT / Mach-E GT count). */
function fordIsPerformance(derivative = '') {
  return /\bst\b|\bst-x\b|\bgt\b/i.test(derivative) && !/st-line/i.test(derivative);
}

/** 0-62 for a Ford: the line base, sped up for the real hot trims. Fiesta ST
 *  ~6.5s, Focus ST ~5.7s, Puma ST ~6.7s, Mach-E GT ~3.7s, Mustang GT already
 *  fast. Only applied when fordIsPerformance detects a genuine ST/GT. */
function trimZeroTo62Ford(base, line, derivative = '') {
  if (!fordIsPerformance(derivative)) return base;
  const hot = {
    Fiesta: 6.5, Focus: 5.7, Puma: 6.7, 'Mustang Mach-E': 3.7, Mustang: 4.5,
  }[line];
  return hot || Math.max(base - 2.0, 4.5); // generic hot-trim shave, floored
}

/** Tags for a Ford — practical mainstream, with a performance flag for the hot
 *  cars and efficient for EV/PHEV/mHEV. */
function fordTags(line, body, fuel, derivative = '') {
  const tags = new Set();
  if (body === 'suv' || body === 'mpv' || body === 'estate') { tags.add('family'); tags.add('practical'); }
  if (body === 'mpv') tags.add('cruiser');
  if (line === 'Ka' || line === 'Fiesta') tags.add('urban');
  if (fuel === 'ev' || fuel === 'phev') { tags.add('efficient'); tags.add('tech'); }
  if (line === 'Mustang' || line === 'Mustang Mach-E') tags.add('image');
  if (fordIsPerformance(derivative)) { tags.add('drivers-car'); tags.add('image'); }
  if (['Explorer', 'Capri', 'Mustang Mach-E', 'Puma Gen-E'].includes(line)) tags.add('tech');
  if (tags.size === 0) tags.add('practical'); // never leave a Ford untagged
  return [...tags];
}

/** Ford display name: "Ford <line> <derivative>", the way an Auto Trader / Honda
 *  listing reads — so a Focus ST and a Focus Titanium are distinguishable in the
 *  deck and in head-to-head, not two rows both saying "Ford Focus". Folds a
 *  doubled marque, avoids repeating the line if the derivative already names it,
 *  and tidies whitespace. */
function fordDisplayName(title = '', derivative = '') {
  let name = String(title).trim();
  if (!/^ford\b/i.test(name)) name = `Ford ${name}`;
  name = name.replace(/^Ford\s+Ford\s+/i, 'Ford ');
  const deriv = String(derivative).trim();
  // Only append the derivative when it adds information (the title is just the
  // marque + line; the derivative carries engine/trim/body).
  if (deriv && !new RegExp(`\\b${deriv.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(name)) {
    name = `${name} ${deriv}`;
  }
  return name.replace(/\s+/g, ' ').trim();
}

/** A short derived blurb for a Ford (curated records carry no marketing copy). */
function fordBlurb(line, body, fuel, retailerName, derivative = '') {
  const bodyWord = {
    hatchback: 'hatchback', estate: 'estate', suv: 'SUV', coupe: 'coupé',
    convertible: 'convertible', mpv: 'people carrier', pickup: 'pickup',
  }[body] || 'car';
  let fuelWord;
  if (fuel === 'ev') fuelWord = 'fully electric';
  else if (fuel === 'phev') fuelWord = 'plug-in hybrid';
  else if (fuel === 'diesel') fuelWord = 'diesel';
  else if (/mhev|ecoboost hybrid|mild hybrid/i.test(derivative)) fuelWord = 'mild-hybrid petrol';
  else fuelWord = 'petrol';
  const sporty = fordIsPerformance(derivative) ? 'performance ' : '';
  const from = retailerName ? ` from ${retailerName}` : '';
  return `Approved-used ${sporty}Ford ${line} ${bodyWord}, ${fuelWord}, ready to drive away${from}.`;
}

const FORD_RETAILER_ID = 'ford-approved';
const FORD_RETAILER_NAME = 'Ford Approved Used';

/**
 * Project one FLAT Ford record (curated fixtures, or the live adapter when it's
 * reachable) to the engine's mapped-car schema — the SAME shape mapVehicle() and
 * mapHondaRaw() produce. Returns null (caller filters) if there's no price.
 */
export function mapFordRaw(raw) {
  const line = fordLine(raw?.title, raw?.derivative);
  const spec = MODEL_SPECS_FORD[line] || DEFAULT_SPEC_FORD;
  // Price is the single most decision-driving field in used-car shopping, so we
  // never invent one: a record with no price is dropped rather than shown with a
  // fabricated figure a buyer might act on. (The curated fixtures carry real
  // prices; FORD_PRICE_HINT is the fixture builder's per-line seed, not a
  // live-feed backfill — see build-ford-fixtures.mjs.)
  const price = num(raw?.price);
  if (!price) return null;

  const { origin } = brandConfig('ford');
  const derivative = String(raw?.derivative || '');
  const body = fordBody(line, derivative);
  const fuel = fordFuel(raw?.fuel, line, derivative);
  const zeroTo62 = trimZeroTo62Ford(spec.zeroTo62, line, derivative);
  // EVs and PHEVs are scored on range; take the record's figure, else the spec's.
  // The Kuga PHEV has no spec.evRange (that entry is the petrol Kuga), so it
  // falls back to the model's official plug-in range rather than the EV default.
  const phevFallback = line === 'Kuga' ? KUGA_PHEV_RANGE : DEFAULT_SPEC_FORD.evRange;
  const evRange = (fuel === 'ev' || fuel === 'phev')
    ? (num(raw?.range) || spec.evRange || phevFallback)
    : undefined;
  // A Focus/Mondeo estate carries more boot than the hatch base.
  const boot = (body === 'estate') ? Math.max(spec.boot, 550) : spec.boot;

  return {
    id: String(raw?.id ?? raw?.reg ?? `${line}-${price}`),
    name: fordDisplayName(raw?.title || line, derivative),
    line,
    body,
    fuel,
    priceMin: price,
    priceMax: price,
    sizeClass: spec.sizeClass,
    seats: spec.seats,
    boot,
    zeroTo62,
    styleLine: null,
    doors: num(raw?.doors) === 3 ? 3 : null,
    features: [],
    transmission: transmissionFor(raw?.transmission),
    // A combustion car needs a positive mpg for the economy axis; fall back to
    // the model's WLTP combined figure when the record omits it. EVs leave mpg 0.
    mpg: fuel === 'ev' ? num(raw?.mpg) : (num(raw?.mpg) || spec.mpg),
    ...(evRange ? { evRange } : {}),
    tags: fordTags(line, body, fuel, derivative),
    blurb: fordBlurb(line, body, fuel, FORD_RETAILER_NAME, derivative),

    // ---- display-only (surfaced by index.js publicCar) ----
    mileage: num(raw?.mileage),
    plate: raw?.reg || undefined,
    photo: raw?.image || undefined,
    retailerName: FORD_RETAILER_NAME,
    retailerId: FORD_RETAILER_ID,
    link: raw?.link || `${origin}/`,
  };
}

/* ====================================================================== *
 * Motorrad — motorcycles on the car engine (branch bike-brand-motorrad).
 *
 * The matcher scores cars; Motorrad sells bikes. Rather than fork the engine,
 * a bike is projected onto the SAME mapped-vehicle schema, with several axes
 * repurposed. Every repurposing is documented in the Motorrad section of
 * DECISIONS.md; the short version, per field:
 *   body      -> bike category (naked/adventure/tourer/sport/roadster/heritage/scooter)
 *   seats     -> pillion capability (2 dual-seat, 1 solo/track)
 *   boot      -> luggage/touring litres (panniers + top box; ~0 for sport/naked)
 *   sizeClass -> engine/size band 1-5 (A2-friendly small .. big tourer), a
 *                licence-and-manageability proxy the size scorer reads as city..roadtrip
 *   zeroTo62  -> bike 0-62s (honest field; the SCALE is recalibrated in tuning)
 *   mpg       -> bike mpg (honest); fuel petrol, or ev for the electric scooters
 *                (CE 04 / CE 02, any zero-cc model), keyed off the spec cc
 * Like Honda/Ford this is a FLAT-record projection (mapMotorradRaw), not a
 * BRAND_MAPPERS entry, emitting the identical schema the engine scores.
 * ====================================================================== */

/* Per-model bike figures the listing lacks: category, cc, pillion seats,
 * luggage litres, 0-62s, size band 1-5, mpg (or evRange for electric). Grounded
 * in the public BMW Motorrad UK range. Keyed by normalised model line. */
const MODEL_SPECS_MOTORRAD = {
  // Roadster / naked
  'R 1300 R': { category: 'roadster', cc: 1300, seats: 2, boot: 0, zeroTo62: 3.0, sizeClass: 4, mpg: 55 },
  'R 1250 R': { category: 'roadster', cc: 1254, seats: 2, boot: 0, zeroTo62: 3.2, sizeClass: 4, mpg: 55 },
  'R 1200 R': { category: 'roadster', cc: 1170, seats: 2, boot: 0, zeroTo62: 3.4, sizeClass: 4, mpg: 55 },
  'M 1000 R': { category: 'naked', cc: 999, seats: 2, boot: 0, zeroTo62: 3.0, sizeClass: 5, mpg: 44 },
  'S 1000 R': { category: 'naked', cc: 999, seats: 2, boot: 0, zeroTo62: 3.1, sizeClass: 4, mpg: 45 },
  'F 900 R': { category: 'roadster', cc: 895, seats: 2, boot: 0, zeroTo62: 3.7, sizeClass: 3, mpg: 62 },
  'F 800 R': { category: 'roadster', cc: 798, seats: 2, boot: 0, zeroTo62: 4.0, sizeClass: 3, mpg: 60 },
  'G 310 R': { category: 'naked', cc: 313, seats: 2, boot: 0, zeroTo62: 7.5, sizeClass: 1, mpg: 85 },
  // Adventure / GS. The Adventure (GSA) variants carry a bigger tank and more
  // luggage than the base GS, so they get their own keys and figures.
  'R 1300 GS Adventure': { category: 'adventure', cc: 1300, seats: 2, boot: 75, zeroTo62: 3.1, sizeClass: 5, mpg: 56 },
  'R 1300 GS': { category: 'adventure', cc: 1300, seats: 2, boot: 68, zeroTo62: 3.0, sizeClass: 5, mpg: 57 },
  'R 1250 GS Adventure': { category: 'adventure', cc: 1254, seats: 2, boot: 75, zeroTo62: 3.5, sizeClass: 5, mpg: 55 },
  'R 1250 GS': { category: 'adventure', cc: 1254, seats: 2, boot: 68, zeroTo62: 3.4, sizeClass: 5, mpg: 56 },
  'R 1200 GS': { category: 'adventure', cc: 1170, seats: 2, boot: 68, zeroTo62: 3.6, sizeClass: 5, mpg: 56 },
  'F 900 GS': { category: 'adventure', cc: 895, seats: 2, boot: 45, zeroTo62: 4.0, sizeClass: 3, mpg: 60 },
  'F 850 GS': { category: 'adventure', cc: 853, seats: 2, boot: 45, zeroTo62: 4.4, sizeClass: 3, mpg: 61 },
  // The F 750 GS shares the 853cc parallel-twin with the F 850 GS, detuned to
  // 77hp with 19"/17" road-biased wheels — a lighter, road-first middleweight
  // adventure bike (present in the live pool; without its own key it fell to the
  // R 1250 GS loose fallback and read as a 1254cc big GS).
  'F 750 GS': { category: 'adventure', cc: 853, seats: 2, boot: 45, zeroTo62: 4.6, sizeClass: 3, mpg: 62 },
  'F 800 GS': { category: 'adventure', cc: 798, seats: 2, boot: 45, zeroTo62: 4.5, sizeClass: 3, mpg: 60 },
  'G 310 GS': { category: 'adventure', cc: 313, seats: 2, boot: 20, zeroTo62: 7.7, sizeClass: 1, mpg: 83 },
  // Sport
  'M 1000 RR': { category: 'sport', cc: 999, seats: 1, boot: 0, zeroTo62: 2.8, sizeClass: 5, mpg: 40 },
  'S 1000 RR': { category: 'sport', cc: 999, seats: 1, boot: 0, zeroTo62: 2.9, sizeClass: 4, mpg: 42 },
  'M 1000 XR': { category: 'sport', cc: 999, seats: 2, boot: 32, zeroTo62: 3.1, sizeClass: 5, mpg: 46 },
  'S 1000 XR': { category: 'sport', cc: 999, seats: 2, boot: 32, zeroTo62: 3.2, sizeClass: 4, mpg: 48 },
  // Tourer
  'K 1600 GTL': { category: 'tourer', cc: 1649, seats: 2, boot: 130, zeroTo62: 3.5, sizeClass: 5, mpg: 44 },
  'K 1600 GT': { category: 'tourer', cc: 1649, seats: 2, boot: 110, zeroTo62: 3.4, sizeClass: 5, mpg: 44 },
  // The K 1600 Grand America is the bagger-styled full-dress K 1600 tourer
  // (1649cc six, hard panniers + top box); present in the live pool and its own
  // model, so it doesn't read as a plain roadster via the R 1250 R fallback.
  'K 1600 Grand America': { category: 'tourer', cc: 1649, seats: 2, boot: 130, zeroTo62: 3.5, sizeClass: 5, mpg: 44 },
  'K 1600 B': { category: 'tourer', cc: 1649, seats: 2, boot: 60, zeroTo62: 3.4, sizeClass: 5, mpg: 44 },
  // The K 1300 S is the discontinued (2009-2016) 1293cc inline-four sport-tourer
  // — a genuinely fast sports-touring bike, not a naked roadster. Rare in the
  // pool but real, so it keeps its own spec rather than the R 1250 R fallback.
  'K 1300 S': { category: 'sport', cc: 1293, seats: 2, boot: 0, zeroTo62: 3.0, sizeClass: 5, mpg: 42 },
  'R 1300 RT': { category: 'tourer', cc: 1300, seats: 2, boot: 94, zeroTo62: 3.5, sizeClass: 5, mpg: 55 },
  'R 1250 RT': { category: 'tourer', cc: 1254, seats: 2, boot: 94, zeroTo62: 3.6, sizeClass: 5, mpg: 54 },
  // Heritage. The air-cooled R nineT family (1170cc, Option 719) is distinct
  // from the new-gen liquid-... no: air/oil-cooled R 12 nineT (1170cc, 2024+).
  // Both are 1170cc heritage roadsters; keep them as separate keys so a listing
  // titled "R nineT" doesn't display as the newer "R 12 nineT".
  'R 12 nineT': { category: 'heritage', cc: 1170, seats: 2, boot: 0, zeroTo62: 3.5, sizeClass: 4, mpg: 52 },
  'R 12': { category: 'heritage', cc: 1170, seats: 2, boot: 0, zeroTo62: 3.8, sizeClass: 4, mpg: 52 },
  'R nineT': { category: 'heritage', cc: 1170, seats: 2, boot: 0, zeroTo62: 3.5, sizeClass: 4, mpg: 52 },
  'R 18 Transcontinental': { category: 'tourer', cc: 1802, seats: 2, boot: 90, zeroTo62: 4.8, sizeClass: 5, mpg: 42 },
  'R 18': { category: 'heritage', cc: 1802, seats: 2, boot: 0, zeroTo62: 4.8, sizeClass: 5, mpg: 42 },
  // Roadster / sport midweight
  'F 900 XR': { category: 'sport', cc: 895, seats: 2, boot: 32, zeroTo62: 3.9, sizeClass: 3, mpg: 60 },
  // Electric
  'CE 04': { category: 'scooter', cc: 0, seats: 2, boot: 30, zeroTo62: 3.5, sizeClass: 2, evRange: 80 },
  'CE 02': { category: 'scooter', cc: 0, seats: 2, boot: 15, zeroTo62: 8.0, sizeClass: 1, evRange: 55 },
  // Mid scooters (petrol) — the C 400 GT/X are the touring/urban maxi-scooters.
  'C 400 GT': { category: 'scooter', cc: 350, seats: 2, boot: 30, zeroTo62: 9.5, sizeClass: 2, mpg: 80 },
  'C 400 X': { category: 'scooter', cc: 350, seats: 2, boot: 30, zeroTo62: 9.5, sizeClass: 2, mpg: 80 },
};
const DEFAULT_SPEC_MOTORRAD = { category: 'naked', cc: 850, seats: 2, boot: 20, zeroTo62: 4.5, sizeClass: 3, mpg: 55 };

const MOTORRAD_RETAILER_ID = 'motorrad-approved';
const MOTORRAD_RETAILER_NAME = 'BMW Motorrad Approved Used';

/** Normalise a bike title to a MODEL_SPECS_MOTORRAD key. Longer/more-specific
 *  model codes are tested before shorter ones (M 1000 RR before S 1000 RR;
 *  R 1300 GS before R 1250 GS) so a title folds to the right entry. */
function motorradLine(title = '') {
  const s = String(title).toUpperCase().replace(/\s+/g, ' ').trim();
  // The heritage twins are both 1170cc "nineT" roadsters but different models:
  // the new-gen "R 12 nineT" (2024+) and the older air/oil-cooled "R nineT"
  // (Pure/Urban G/S/Racer, Option 719). Disambiguate BEFORE the contains-scan,
  // since "R 12 NINET" and "R NINET" would otherwise race. "R 12 nineT" wins
  // only when the title actually says "R 12"; a plain "R nineT …" is the older
  // bike. "R 12 G/S" and bare "R 12" are the new roadster/scrambler siblings.
  if (/\bR 12 NINET|R12 NINET/.test(s)) return 'R 12 nineT';
  if (/\bR NINET|RNINET|R NINE T\b/.test(s)) return 'R nineT';
  if (/\bR 12 G\/?S\b|\bR12 G\/?S\b/.test(s)) return 'R 12'; // R 12 G/S scrambler → R 12 family
  // Exact-ish contains, ordered specific -> general so a longer code (R 1300 GS
  // Adventure, M 1000 XR) is tested before the shorter one it contains.
  // [uppercase probe tested against the title, canonical MODEL_SPECS key], most
  // specific first so a longer code is tested before the shorter one it contains.
  const KEYS = [
    ['M 1000 RR', 'M 1000 RR'], ['S 1000 RR', 'S 1000 RR'],
    ['M 1000 XR', 'M 1000 XR'], ['S 1000 XR', 'S 1000 XR'],
    ['M 1000 R', 'M 1000 R'], ['S 1000 R', 'S 1000 R'],
    ['R 1300 GS ADVENTURE', 'R 1300 GS Adventure'], ['R 1300 GSA', 'R 1300 GS Adventure'],
    ['R 1250 GS ADVENTURE', 'R 1250 GS Adventure'], ['R 1250 GSA', 'R 1250 GS Adventure'],
    ['R 1300 GS', 'R 1300 GS'], ['R 1250 GS', 'R 1250 GS'], ['R 1200 GS', 'R 1200 GS'],
    ['F 900 GSA', 'F 900 GS'], ['F 900 GS', 'F 900 GS'], ['F 850 GS', 'F 850 GS'],
    ['F 800 GS', 'F 800 GS'], ['F 750 GS', 'F 750 GS'], ['G 310 GS', 'G 310 GS'],
    ['K 1600 GRAND AMERICA', 'K 1600 Grand America'],
    ['K 1600 GTL', 'K 1600 GTL'], ['K 1600 GT', 'K 1600 GT'], ['K 1600 B', 'K 1600 B'],
    ['K 1300 S', 'K 1300 S'],
    ['R 1300 RT', 'R 1300 RT'], ['R 1250 RT', 'R 1250 RT'],
    ['R 1300 R', 'R 1300 R'], ['R 1250 R', 'R 1250 R'], ['R 1200 R', 'R 1200 R'],
    ['F 900 XR', 'F 900 XR'], ['F 900 R', 'F 900 R'], ['F 800 R', 'F 800 R'],
    ['G 310 R', 'G 310 R'],
    ['R 18 TRANSCONTINENTAL', 'R 18 Transcontinental'], ['R 18', 'R 18'], ['R 12', 'R 12'],
    ['C 400 GT', 'C 400 GT'], ['C 400 X', 'C 400 X'], ['CE 04', 'CE 04'], ['CE 02', 'CE 02'],
  ];
  for (const [probe, key] of KEYS) {
    if (s.includes(probe)) return key;
  }
  // Loose fallbacks by family so an unlisted variant still lands sensibly.
  if (/\bGS\b/.test(s)) return 'R 1250 GS';
  if (/\bRT\b/.test(s)) return 'R 1250 RT';
  if (/\bRR\b/.test(s)) return 'S 1000 RR';
  if (/NINET|NINE T/.test(s)) return 'R nineT';
  return 'R 1250 R';
}

/** Bike fuel: electric for any zero-cc (battery) model in the spec table or a
 *  title the feed marks electric, else petrol. Gated on the spec's `cc === 0`
 *  rather than a model name, so every electric bike (CE 04, CE 02, and any the
 *  range adds later) is caught, not just one named model. */
function motorradFuel(line, rawFuel) {
  const spec = MODEL_SPECS_MOTORRAD[line];
  if ((spec && spec.cc === 0) || /electric/i.test(String(rawFuel || ''))) return 'ev';
  return 'petrol';
}

/** Riding-character tags from category + size, read by scoreCharacter. */
function motorradTags(category, sizeClass, fuel) {
  const tags = [category];
  if (category === 'tourer' || category === 'adventure') tags.push('touring');
  if (category === 'adventure') tags.push('adventure');
  if (category === 'sport') tags.push('sporty');
  if (category === 'roadster' || category === 'naked') tags.push('commuter');
  if (category === 'heritage') tags.push('heritage');
  if (fuel === 'ev') tags.push('electric', 'commuter');
  if (sizeClass <= 2) tags.push('a2-friendly');
  return Array.from(new Set(tags));
}

// Full noun phrases so the blurb reads naturally ("an adventure bike", not
// "a adventure"). The category word never asserts a fuel: the scooter range is
// mostly petrol (C 400 GT/X) plus the electric CE models, so "scooter" stays
// power-neutral and motorradBlurb prefixes "electric" only for an actual EV.
const CATEGORY_WORD = {
  naked: 'naked roadster',
  roadster: 'roadster',
  adventure: 'adventure bike',
  tourer: 'tourer',
  sport: 'sports bike',
  heritage: 'heritage roadster',
  scooter: 'scooter',
};

/** "a" or "an" for the word that follows, by its leading sound. */
function article(word = '') {
  return /^[aeiou]/i.test(String(word).trim()) ? 'an' : 'a';
}

/** A rider-facing blurb. Bikes "ride away", they don't "drive away". */
function motorradBlurb(line, category, fuel, retailerName) {
  const cat = CATEGORY_WORD[category] || 'motorcycle';
  // "electric" is driven by the actual fuel, so a petrol scooter reads "scooter"
  // and an electric one (CE 04/CE 02) reads "electric scooter".
  const power = fuel === 'ev' ? 'electric ' : '';
  const from = retailerName ? ` from ${retailerName}` : '';
  const kind = `${power}${cat}`;
  return `Approved-used BMW ${line}, ${article(kind)} ${kind}, ready to ride away${from}.`;
}

/**
 * Motorrad display name: the real listing titles append dealer marketing to the
 * model ("BMW R 1300 GS Ex Demo, Top Spec, Low Miles!", "… TE 2 YEAR BMW
 * WARRANTY"). Keep the model and its genuine trim/spec pack, drop the sales tail
 * so the card reads as a bike, not an advert. We cut at the first comma (every
 * marketing clause here begins one) and strip trailing warranty/condition
 * phrases. Falls back to "BMW <line>" when there's no usable title.
 */
function motorradDisplayName(title, line) {
  const raw = String(title || '').trim();
  if (!raw) return `BMW ${line}`;
  let name = /^bmw/i.test(raw) ? raw : `BMW ${raw}`;
  // Everything from the first comma on is marketing ("…, Top Spec, Low Miles!").
  name = name.split(',')[0];
  // Strip trailing sales phrases even when not comma-separated ("… TE 2 YEAR
  // BMW WARRANTY", "… GS Ex Demo"). Anchored at the tail, applied repeatedly.
  const TAIL = /\s+(?:\d+\s*YEARS?\s*(?:BMW\s*)?WARRANTY|BMW\s*WARRANTY|WARRANTY|EX[-\s]?DEMO|DEMO|TOP\s*SPEC|LOW\s*MILES?|LOW\s*MILEAGE|FULL\s*S(?:ERVICE\s*)?HISTORY|FSH|ONE\s*OWNER|1\s*OWNER|IMMACULATE|STUNNING|FINANCE\s*AVAILABLE|SOLD|RESERVED)\s*!*$/i;
  let prev;
  do { prev = name; name = name.replace(TAIL, ''); } while (name !== prev);
  name = name.replace(/[\s!]+$/, '').trim();
  return name || `BMW ${line}`;
}

/**
 * Project one FLAT bike record (curated fixtures, or the live adapter once the
 * session-gated Motorrad feed is reachable) to the engine's mapped-vehicle
 * schema. See the Motorrad axis map in DECISIONS.md for what each field means
 * for a bike. Returns null (caller filters) if there's no price.
 */
export function mapMotorradRaw(raw) {
  const line = motorradLine(raw?.title);
  const spec = MODEL_SPECS_MOTORRAD[line] || DEFAULT_SPEC_MOTORRAD;
  // Never invent a price (same honesty rule as Ford/Honda).
  const price = num(raw?.price);
  if (!price) return null;

  const { origin } = brandConfig('motorrad');
  const fuel = motorradFuel(line, raw?.fuel);
  const evRange = fuel === 'ev' ? (num(raw?.range) || spec.evRange || 80) : undefined;

  return {
    id: String(raw?.id ?? raw?.reg ?? `${line}-${price}`),
    // Keep the model + genuine trim, minus the dealer sales tail (see helper).
    name: motorradDisplayName(raw?.title, line),
    line,
    body: spec.category, // bike category stands in for car body style
    fuel,
    priceMin: price,
    priceMax: price,
    sizeClass: spec.sizeClass, // engine/size band (licence-and-manageability proxy)
    seats: spec.seats, // pillion capability (2 dual-seat, 1 solo/track)
    boot: spec.boot, // luggage/touring litres
    zeroTo62: spec.zeroTo62, // honest field; scale recalibrated in tuning
    styleLine: null,
    doors: null,
    features: [],
    transmission: transmissionFor(raw?.transmission),
    // Combustion bikes score on mpg; the electric CE 04 leaves mpg unset and
    // scores on evRange instead.
    mpg: fuel === 'ev' ? undefined : (num(raw?.mpg) || spec.mpg),
    ...(evRange ? { evRange } : {}),
    // Bike-specific display extras (harmless to the engine, surfaced on cards).
    cc: spec.cc,
    tags: motorradTags(spec.category, spec.sizeClass, fuel),
    blurb: motorradBlurb(line, spec.category, fuel, MOTORRAD_RETAILER_NAME),

    // ---- display-only ----
    mileage: num(raw?.mileage),
    plate: raw?.reg || undefined,
    // Bikes carry no plate in the feed, so the swipe card's "N years old" frame
    // has to read the registration year/date instead (ageInYears prefers these).
    year: raw?.year || undefined,
    firstReg: raw?.firstReg || undefined,
    photo: raw?.image || undefined,
    retailerName: MOTORRAD_RETAILER_NAME,
    retailerId: MOTORRAD_RETAILER_ID,
    link: raw?.link || `${origin}/`,
  };
}

/* ---------------------- per-brand derivation config -------------------- *
 * mapVehicle dispatches on brand through this table. BMW keeps its existing
 * model-aware derivations; MINI uses the simpler ones above. The engine
 * consumes the identical output shape either way.
 * ---------------------------------------------------------------------- */
const BRAND_MAPPERS = {
  bmw: {
    defaultTitle: 'BMW',
    specs: MODEL_SPECS_BMW,
    fallbackSpec: DEFAULT_SPEC,
    line: lineFromTitle,
    body: bodyFor,
    zeroTo62: trimZeroTo62,
    tags: tagsFor,
    displayName,
    blurb: blurbFor,
    // BMW asks neither question (M Sport dominates trim; body implies doors),
    // so these stay null and their scorers no-op — see docs/mini-first-questions.md.
    styleLine: () => null,
    doors: () => null,
  },
  mini: {
    defaultTitle: 'MINI',
    specs: MODEL_SPECS_MINI,
    fallbackSpec: DEFAULT_SPEC_MINI,
    line: miniLine,
    body: miniBody,
    zeroTo62: miniTrimZeroTo62,
    tags: miniTags,
    displayName: miniDisplayName,
    blurb: miniBlurb,
    styleLine: miniStyleLine,
    doors: miniDoors,
  },
};

/* ------------------------- equipment concepts -------------------------- *
 * The feed carries a full factory options list per car (100% of stock, both
 * brands) as manufacturer option names — a controlled vocabulary, not free
 * text: ~260 distinct strings above 1% frequency for BMW, ~230 for MINI. That
 * makes the granular "must have a panoramic roof" kind of want parseable,
 * which the life-fit question set never asks about.
 *
 * Concepts are deliberately brand-NEUTRAL: a car either has a heated steering
 * wheel or it doesn't, and that fact doesn't change between marques. Only the
 * vocabulary differs, so a concept's pattern covers both brands' wording
 * (BMW's "comfort access" and MINI's "keyless" are one concept; CarPlay is
 * "smartphone integration" on MINI and unnamed on BMW).
 *
 * What varies per brand is which concepts are worth ASKING about, and that is
 * measured live rather than authored: a concept every car at a retailer has
 * (heated seats on 96% of BMW stock) can't refine anything, and one no car has
 * is dead. See docs/refinement-plan.md — the refinement step reads stock
 * variance, so this table stays a generous parse and the selection happens
 * downstream. Parsing a rarely-split concept costs nothing; missing one that
 * turns out to matter costs a question we can never ask.
 *
 * Coverage and split rates per concept: docs/refinement-audit.md
 * (`npm run audit:refine features` re-measures them).
 * ---------------------------------------------------------------------- */
/*
 * [key, match, exclude?] — a car has the concept when SOME option string
 * matches `match` and that same string doesn't match `exclude`.
 *
 * Matching per string rather than against the joined blob is what makes
 * `exclude` meaningful, and it isn't fussiness: matching the blob had
 * "sport leather steering wheel" reading as leather SEATS on half of MINI
 * stock. Where the two must name different cars (a panoramic roof is not
 * what someone picturing a small sunroof means), the narrower concept
 * excludes the wider one.
 */
export const FEATURE_CONCEPTS = [
  // The strongest discriminator found — 17% (BMW) / 36% (MINI) of stock, and
  // it splits the pool at ~every retailer.
  ['panoRoof', /panoram/],
  ['sunroof', /sunroof|electric glass roof/, /panoram/],
  // MINI's contrast roof — the one *aesthetic* choice this feed states, and
  // a signature MINI one. Stated either way (contrast colour or "in body
  // colour") for 88% of MINI stock, and it splits the pool at every single
  // retailer measured. Absent from BMW stock, which doesn't offer it — so
  // like every concept here it earns its question from variance, not from
  // being authored per brand. The nearest thing available to the "I want the
  // blue one" want that the feed otherwise can't answer; see the colour blind
  // spot in docs/refinement-audit.md.
  ['contrastRoof',
    /(roof|mirror caps?).*\b(black|white|silver|chili red|red|yellow|blue|grey)\b|^(black|white|red|silver|yellow) roof/,
    /body colour|rail|lining|aerial|antenna|spoiler|panoram|sunroof|skyroof/],
  ['heatedSeats', /heated.*seat|seat heating/],
  ['heatedWheel', /heated steering/],
  /*
   * Child-seat mounting. Priya walks away from "ISOFIX she cannot confirm",
   * and until now the feed's answer to that question was parsed by nothing.
   *
   * The two brands state it as two different options and they are not the same
   * fitment: BMW writes "ISOFIX Child Seat System" (2,736 cars) and both brands
   * write "Child seat i-Size attachment for front p[assenger]" (5,908 BMW,
   * 3,460 MINI), which is the front seat rather than the rear. They are folded
   * into one concept because the honest claim is the one they share — the feed
   * states child-seat mounting on this car — and because MINI's feed never
   * states the rear system separately, so splitting them would leave MINI with
   * no answer at all. The label says "points", not "rear ISOFIX", for the same
   * reason. Measured at 33% of BMW stock and 40% of MINI's, and it splits the
   * pool at every retailer holding 10+ cars (131/131 and 119/119), which makes
   * it one of the strongest axes in the table.
   */
  ['isofix', /isofix|child seat/],
  // Named for what the feed actually states. Seat upholstery grade (Vernasca,
  // Dakota, MINI Yours Lounge) appears on <1% of either brand's stock, so
  // "leather seats" is NOT answerable from this data — see the known blind
  // spots in docs/refinement-audit.md. A leather WHEEL is stated, and often.
  ['leatherWheel', /leather steering/],
  ['sportsSeats', /sports? seats/],
  ['electricSeats', /electric(al)?.*seat.*adjust|seat adjustment.*electric/],
  ['parkingCamera', /camera/],
  // "park assist" alone missed BMW's own name for the pack, "Parking
  // Assistant" (59% of its stock), understating the concept ~4x — which is
  // exactly what the audit's `vocab` pass exists to catch.
  ['parkingSensors', /park distance|parking sensor|\bpdc\b|park(ing)? assist/],
  ['navigation', /navigation|sat ?nav/],
  ['smartphoneIntegration', /carplay|android auto|smartphone integration/],
  ['premiumAudio', /harman|kardon|\bhi-?fi\b|sound system|bang & olufsen|bowers/],
  ['headUpDisplay', /head-?up/],
  ['cruiseControl', /cruise/],
  ['adaptiveLights', /adaptive led|laser ?light|matrix/],
  ['keylessEntry', /comfort access|keyless/],
  ['climateControl', /automatic air conditioning|climate control|zone air/],
  ['ambientLighting', /ambient light|additional interior lighting/],
  // Rare (~5% BMW, ~1% MINI) so it seldom clears the variance bar — but it's
  // an absolute dealbreaker for the buyer who tows, and parsing it is free.
  ['towbar', /tow ?bar|towing/],
  ['tintedGlass', /sun protection|privacy glass|tinted/],
];

/*
 * Every option string on one feed vehicle, lowercased.
 *
 * The feed nests them three ways at once — per-category standard/additional
 * arrays (`features.interior.standard`), a flat `additional` list of
 * `{ category, description }` objects, and occasional bare string arrays — so
 * this walks all three shapes rather than trusting one. Unknown shapes are
 * skipped, not thrown on: a feed that grows a fourth nesting should cost us
 * concepts, never a whole car.
 */
export function featureStrings(features) {
  if (!features || typeof features !== 'object') return [];
  const out = [];
  for (const val of Object.values(features)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') out.push(item);
        else if (typeof item?.description === 'string') out.push(item.description);
      }
    } else if (val && typeof val === 'object') {
      for (const arr of Object.values(val)) {
        if (Array.isArray(arr)) {
          for (const s of arr) if (typeof s === 'string') out.push(s);
        }
      }
    }
  }
  return out.map((s) => s.toLowerCase().trim());
}

/** The equipment concepts this car carries, as sorted concept keys. */
function featuresFor(features) {
  const strings = featureStrings(features);
  if (!strings.length) return [];
  return FEATURE_CONCEPTS
    .filter(([, match, exclude]) => strings.some((s) => match.test(s) && !exclude?.test(s)))
    .map(([key]) => key)
    .sort();
}

/*
 * Gearbox, normalised to 'auto' | 'manual' (undefined if the feed omits it).
 *
 * A clean top-level feed field, unlike the concepts above — and one of the
 * most common genuine used-car dealbreakers, which the quiz never asks about.
 * Nearly dead for BMW (automatic on ~97% of stock) but a live split for MINI
 * (~12% manual), so like the concepts it earns its question from variance
 * rather than from being authored into a brand's set.
 */
function transmissionFor(raw = '') {
  const t = String(raw).toLowerCase();
  if (t.includes('manual')) return 'manual';
  if (t.includes('auto') || t.includes('dct') || t.includes('steptronic')) return 'auto';
  return undefined;
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
export function mapVehicle(v, brand = 'bmw') {
  const price = num(v?.cash_price?.value);
  if (!price) return null;

  const m = BRAND_MAPPERS[brand] || BRAND_MAPPERS.bmw;
  const { origin, defaultRetailer } = brandConfig(brand);

  const title = v.title || m.defaultTitle;
  const derivative = v.derivative || '';
  const line = m.line(title, derivative);

  const spec = m.specs[line] || m.fallbackSpec;
  if (!m.specs[line]) {
    const warnKey = `${brand}:${line}`;
    if (!warnedLines.has(warnKey)) {
      warnedLines.add(warnKey);
      // eslint-disable-next-line no-console
      console.warn(`[mapping] no ${brand} MODEL_SPECS for line "${line}" — using defaults`);
    }
  }

  const body = m.body(line, derivative);
  const fuel = fuelFor(v.fuel);
  const zeroTo62 = m.zeroTo62(spec.zeroTo62, line, derivative);

  const media = Array.isArray(v.media?.items) ? v.media.items : [];
  const photo = firstPhoto(media);
  const retailerName = v?.retailer_site?.name || undefined;

  return {
    // ---- engine-scored fields (same shape as data.js) ----
    id: String(v.advert_id ?? v.vin ?? `${title}-${price}`),
    name: m.displayName(title, derivative),
    line,
    body,
    fuel,
    priceMin: price,
    priceMax: price, // single used-car price; scoreBudget handles min===max
    sizeClass: spec.sizeClass,
    seats: spec.seats,
    boot: spec.boot,
    zeroTo62,
    // MINI-only trim/door axes (null for BMW). Internal scoring fields — like
    // seats/boot, they're withheld by index.js publicCar; the reason strings
    // they produce are what reaches the card.
    styleLine: m.styleLine(derivative),
    doors: m.doors(body, derivative),
    // Granular equipment facts for the results-side refinement step (see
    // FEATURE_CONCEPTS and docs/refinement-plan.md). Internal for now, like
    // styleLine/doors — nothing scores or renders them yet, so publicCar
    // withholds them until phase 2 has a consumer.
    features: featuresFor(v.features),
    transmission: transmissionFor(v.transmission),
    mpg: num(v?.consumption?.fuel?.values?.combined),
    evRange: num(v?.consumption?.range?.values?.total),
    tags: m.tags(line, body, fuel, derivative),
    blurb: m.blurb(line, body, fuel, retailerName),

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
      ? `${origin}/vehicle/${encodeURIComponent(v.advert_id)}`
      : `${origin}/?retailer_site=${encodeURIComponent(v?.retailer_site?.id ?? defaultRetailer)}`,
  };
}
