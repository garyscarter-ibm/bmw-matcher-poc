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
