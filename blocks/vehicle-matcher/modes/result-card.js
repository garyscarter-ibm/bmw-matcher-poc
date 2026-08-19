/*
 * The car card, shared by every mode that shows a result. One builder, three densities
 * (big/compact/previewTile); it decides all a card may claim. Brand voice from ./brand-copy.js.
 */

import { el, gbp } from '../ui.js';
import { BRAND_COPY, TRADE_COPY, tradeLines, orList } from './brand-copy.js';

export const SPEC_LABELS = {
  hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
  coupe: 'Coupé', convertible: 'Convertible', mpv: 'Family carrier',
};
export const FUEL_SPEC = { petrol: 'Petrol', diesel: 'Diesel', phev: 'Plug-in hybrid', ev: 'Electric' };
/*
 * Gearbox, stated rather than implied. It was on the wire and a reject reason/refine chip
 * but never printed. Same closed set as transmissionFor; a car with no gearbox says nothing.
 */
export const GEARBOX_SPEC = { auto: 'Automatic', manual: 'Manual' };

/*
 * Representative hex per basic colour, for the swatch beside the paint name. Keyed by
 * the feed's normalised `colour.colour`; not the actual paint. Unknown name → no swatch.
 */
export const SWATCH_HEX = {
  black: '#1d1d1f',
  grey: '#8e9094',
  silver: '#c8cacc',
  white: '#f4f4f2',
  blue: '#33567d',
  red: '#a03236',
  green: '#4a6b58',
  orange: '#c47a3a',
  yellow: '#d9b13b',
  brown: '#6b543f',
  beige: '#cfc3a8',
  bronze: '#9c7a5b',
  gold: '#b3945c',
  purple: '#5d4a72',
};

/*
 * Human names for the equipment concepts the server parses from the feed's options list
 * (mapping.js FEATURE_CONCEPTS). Display-only; an unlabelled key is silently skipped.
 */
export const CONCEPT_LABELS = {
  panoRoof: 'Panoramic roof',
  contrastRoof: 'Contrast roof',
  sunroof: 'Sunroof',
  heatedSeats: 'Heated seats',
  heatedWheel: 'Heated steering wheel',
  // "Points", not "rear ISOFIX": the concept folds BMW's rear ISOFIX and both
  // brands' front i-Size (see FEATURE_CONCEPTS); claiming the rear one overclaims.
  isofix: 'ISOFIX child seat points',
  sportsSeats: 'Sports seats',
  electricSeats: 'Electric seats',
  leatherWheel: 'Leather steering wheel',
  parkingCamera: 'Parking camera',
  parkingSensors: 'Parking sensors',
  navigation: 'Navigation',
  smartphoneIntegration: 'Apple CarPlay',
  premiumAudio: 'Premium audio',
  headUpDisplay: 'Head-up display',
  cruiseControl: 'Cruise control',
  adaptiveLights: 'Adaptive LED lights',
  keylessEntry: 'Keyless entry',
  climateControl: 'Climate control',
  ambientLighting: 'Ambient lighting',
  tintedGlass: 'Privacy glass',
  towbar: 'Tow bar',
};

/*
 * How many of those a card names before it counts the rest. Print order puts distinctive
 * kit first; the remainder is counted, not dropped, since silent truncation implies absence.
 */
export const KIT_SHOWN = 6;

/**
 * The individual cars behind a card: one entry for an ungrouped car, N for a grouped
 * one, so nothing downstream cares which it holds.
 */
export const listingsOf = (m) => m.listings || [];


/** Miles from the configured retailer, e.g. "18.1 miles away". */
export function distanceLabel(distance) {
  const miles = Math.round(distance * 10) / 10;
  return `${miles} ${miles === 1 ? 'mile' : 'miles'} away`;
}

/**
 * The photo band every card surface shares: retailer picture or the "Images coming soon"
 * placeholder, plus the corner line label. Returns `showPhoto` so the listing picker can swap it.
 */
export function mediaWell(car, extraClass = '') {
  const media = el('div', `vm-card-media${extraClass ? ` ${extraClass}` : ''}`);
  media.append(
    el('span', 'vm-card-soon', 'Images coming soon'),
    el('span', 'vm-card-line', car.line),
  );

  function showPhoto(src) {
    media.querySelector('.vm-card-photo')?.remove();
    media.classList.toggle('has-photo', Boolean(src));
    if (!src) return;
    const img = el('img', 'vm-card-photo');
    img.src = src;
    img.alt = car.name;
    img.loading = 'lazy';
    // A broken image URL shouldn't leave a half-rendered card — drop back to
    // the placeholder, exactly as a photo-less car shows.
    img.addEventListener('error', () => {
      media.classList.remove('has-photo');
      img.remove();
    });
    // Ahead of the caption and the line label, both of which sit over it.
    media.prepend(img);
  }
  showPhoto(car.photo);

  return { media, showPhoto };
}

/**
 * One result card. `big` adds the "why it suits you" reasons; `compact` is the carousel
 * tile — same anatomy, but trades the blurb and reasons for a distance line.
 */
export function matchCard(match, {
  big = false, compact = false, brand: brandKey = 'bmw',
  rejectOptions, rejectLabel, rejectPrompt,
} = {}) {
  const { car, score, reasons } = match;
  const copy = BRAND_COPY[brandKey] || BRAND_COPY.bmw;
  const card = el('article', `vm-card${big ? ' vm-card-big' : ''}${compact ? ' vm-card-compact' : ''}`);

  const { media, showPhoto } = mediaWell(car);
  card.append(media);

  const body = el('div', 'vm-card-body');
  const head = el('div', 'vm-card-head');
  head.append(el('h3', 'vm-card-name', car.name));
  const badge = el('span', 'vm-score', `${score}%`);
  // The number has been unexplained since fit and taste were split, and two cards
  // sharing one reads as a bug. Said properly in the working note; this is the badge affordance.
  badge.title = 'Match score: how well this car fits the answers you gave. Cars that '
    + 'suit you equally get the same score.';
  head.append(badge);
  body.append(head);

  // Single used price when min === max (live stock), else the range.
  // A grouped card prices the whole group; a single listing prices itself.
  const price = car.listingCount > 1 && car.priceFrom !== car.priceTo
    ? `from ${gbp(car.priceFrom)}`
    : (car.priceMin === car.priceMax
      ? gbp(car.priceMin)
      : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`);
  const specs = el('p', 'vm-specs');
  // Paint, by its marketing name ("Legend Grey"), when the detail lookup got one. In a
  // tie colour is often the actual difference, so it belongs on the card, not the PDP.
  const lead = [SPEC_LABELS[car.body], FUEL_SPEC[car.fuel]].filter(Boolean);
  /*
   * The spec line, rebuilt rather than written once, because the listing picker below can
   * change what this card describes — else paint and mileage drift to different cars.
   */
  /*
   * `gearbox` is passed in, not read off `car`, because it's a per-listing property that
   * must follow the picker. Boot is qualified "seats up" so the litre figure isn't distrusted.
   */
  function renderSpecs(paint, shade, priceText, gearbox) {
    specs.replaceChildren();
    const head = [...lead, GEARBOX_SPEC[gearbox]].filter(Boolean);
    // Compact tiles are narrow — the headline specs only, no practicality,
    // 0–62 or economy.
    const tail = (compact ? [priceText] : [
      priceText,
      car.seats ? `${car.seats} seats` : null,
      car.boot ? `${car.boot}-litre boot, seats up` : null,
      `0–62 ${car.zeroTo62}s`,
      car.fuel === 'ev' ? `${car.evRange} mi range` : `${car.mpg} mpg`,
    ]).filter(Boolean);
    if (!paint || compact) {
      specs.textContent = [...head, ...tail].join('  ·  ');
      return;
    }
    // Paint gets a swatch as well as its name: in a tie the colour is often the
    // actual difference, and a dot you can see beats a name you read. No hex → name alone.
    specs.append(`${head.join('  ·  ')}  ·  `);
    const hex = SWATCH_HEX[(shade || '').toLowerCase()];
    if (hex) {
      const dot = el('span', 'vm-swatch');
      dot.style.background = hex;
      specs.append(dot);
    }
    specs.append(`${paint}  ·  ${tail.join('  ·  ')}`);
  }
  renderSpecs(
    car.colour?.manufacturerColour || car.colour?.colour,
    car.colour?.colour,
    price,
    car.transmission,
  );
  body.append(specs);

  // The whole point of the carousel: how far away is it, and whose is it? Distance
  // comes from the live feed, so omit the line rather than invent one if it's missing.
  /*
   * Where this car is, on every card not only the compact ones. This lets the page be
   * one ranked list instead of three sections whose captions could contradict each other.
   */
  const where = el('p', 'vm-distance');
  if (car.distance != null) {
    where.append(el('span', 'vm-distance-miles', distanceLabel(car.distance)));
    if (car.retailerName) where.append(el('span', null, ` · ${car.retailerName}`));
    body.append(where);
  } else if (car.retailerName) {
    where.append(el('span', 'vm-distance-here', `At ${car.retailerName}`));
    body.append(where);
  }

  // When repeat listings of the same car were grouped into this card, say so: how
  // many, the price spread, the colours. Without it the page looked like it was stuttering.
  if (car.listingCount > 1) {
    const avail = el('p', 'vm-avail');
    const span = car.priceFrom === car.priceTo
      ? gbp(car.priceFrom)
      : `${gbp(car.priceFrom)}–${gbp(car.priceTo)}`;
    avail.append(el('span', 'vm-avail-count', `${car.listingCount} available`));
    avail.append(el('span', null, ` · ${span}`));
    if (car.colours?.length) avail.append(el('span', null, ` · ${orList(car.colours)}`));
    body.append(avail);
  }

  // Real used-car detail from the live feed, when present.
  const detailBits = [];
  if (car.plate) detailBits.push(`’${car.plate} reg`);
  if (car.mileage != null) detailBits.push(`${car.mileage.toLocaleString('en-GB')} miles`);
  const usedMeta = detailBits.length ? el('p', 'vm-usedmeta', detailBits.join('  ·  ')) : null;
  if (usedMeta) body.append(usedMeta);

  if (!compact) body.append(el('p', 'vm-blurb', car.blurb));

  /*
   * What is actually on this car, from the feed's factory options list. It claims PRESENCE,
   * never absence (the feed lists only factory options), so the label is "what's fitted".
   */
  const kit = el('p', 'vm-kit');
  const kitLabel = el('p', 'vm-why-label vm-kit-label', copy.kitLabel);
  function renderKit(chosen) {
    const have = new Set(chosen?.features || car.features || []);
    const named = Object.entries(CONCEPT_LABELS)
      .filter(([key]) => have.has(key))
      .map(([, label]) => label);
    kit.hidden = !named.length;
    kitLabel.hidden = !named.length;
    if (!named.length) return;
    const shown = named.slice(0, KIT_SHOWN);
    const rest = named.length - shown.length;
    kit.textContent = shown.join(', ')
      + (rest > 0 ? copy.kitMore({ count: rest }) : '');
  }
  if (!compact) {
    renderKit(listingsOf(match)[0]);
    body.append(kitLabel, kit);
  }

  /*
   * The reasons, on every card that leads the page, not only a hero — a tie renders several
   * lead cards. Trimmed to two on a multi-card page; reasons are sorted by contribution.
   */
  if (!compact && reasons.length) {
    const why = el('ul', 'vm-reasons');
    reasons.slice(0, big ? reasons.length : 2).forEach((r) => why.append(el('li', null, r)));
    body.append(el('p', 'vm-why-label', 'Why it suits you'), why);
  }

  // Owning the trade-off: when a recommendation misses a stated want, the card says so
  // itself, under the case for it. Every leading card, not just the hero; compact tiles skip it.
  if (!compact && match.tradeOffs?.length) {
    const { label } = TRADE_COPY[brandKey] || TRADE_COPY.bmw;
    body.append(
      el('p', 'vm-why-label vm-trade-label', label),
      el('p', 'vm-trade-text', tradeLines(brandKey, match.tradeOffs).join(' ')),
    );
  }

  // Set by the reject block below, called by the listing picker: the two are built in DOM
  // order but must stay in step, since a reject reason is only usable if it's about the car shown.
  let onPick = null;

  // "Not this one" — the other half of choosing. Rejecting is the highest-signal act, and
  // the menu turns it into something actionable. Only offered where a caller supplies options.
  if (rejectOptions) {
    const rejectWrap = el('div', 'vm-reject');
    const open = el('button', 'vm-reject-open', rejectLabel || 'Not this one');
    open.type = 'button';
    open.setAttribute('aria-expanded', 'false');
    // Says what the control DOES. It read as a small disclaimer-like link, and nothing
    // suggested that turning a car down brings another in — the most useful act looked least.
    if (copy.rejectHint) open.append(el('span', 'vm-reject-hint', copy.rejectHint));
    const menu = el('div', 'vm-reject-menu');
    menu.hidden = true;
    open.addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      open.setAttribute('aria-expanded', String(!menu.hidden));
    });

    /*
     * Rebuilt whenever the card changes which car it describes. Built once, the picker would
     * leave "Not the red" on offer after switching to green — a reason worse than none at all.
     */
    function renderRejectMenu(chosen) {
      const options = rejectOptions(match, chosen);
      rejectWrap.hidden = !options.length;
      menu.replaceChildren(el('p', 'vm-reject-prompt', rejectPrompt || 'What put you off?'));
      options.forEach((o) => {
        const b = el('button', 'vm-reject-option', o.label);
        b.type = 'button';
        b.addEventListener('click', o.apply);
        menu.append(b);
      });
    }
    renderRejectMenu(listingsOf(match)[0]);
    onPick = renderRejectMenu;

    rejectWrap.append(open, menu);
    body.append(rejectWrap);
  }

  /*
   * Which one, though? Grouping repeat listings fixed the stutter but ended the journey a
   * step early. So a card speaking for several cars lets the buyer pick the actual one; hero only.
   */
  // Every card that speaks for several cars, not just the hero. The picker was `big`-only,
  // so a tie showed "4 available … Blue, Grey or White" with no way to choose. Compact stays out.
  if (!compact && match.listings?.length > 1) {
    body.append(el('p', 'vm-why-label', copy.pickLabel));
    const picker = el('div', 'vm-pick');
    match.listings.forEach((listing, i) => {
      const opt = el('button', `vm-pick-opt${i === 0 ? ' is-on' : ''}`);
      opt.type = 'button';
      opt.setAttribute('aria-pressed', String(i === 0));
      // Marketing names bury the basic colour anywhere in the string, and not
      // always last ("Midnight Black II", "Chili Red"), so try every word.
      const hex = (listing.colour || '')
        .toLowerCase().split(/[^a-z]+/)
        .map((word) => SWATCH_HEX[word])
        .find(Boolean);
      if (hex) {
        const dot = el('span', 'vm-swatch');
        dot.style.background = hex;
        opt.append(dot);
      }
      // Paint is fetched per car and can be missing. Naming the row "Colour n/a" told the
      // buyer nothing; mileage is the next thing that separates two otherwise identical cars.
      const label = listing.colour
        || (listing.mileage != null ? `${listing.mileage.toLocaleString('en-GB')} miles` : `Option ${i + 1}`);
      opt.append(el('span', 'vm-pick-colour', label));
      const bits = [gbp(listing.priceMin)];
      if (listing.colour && listing.mileage != null) {
        bits.push(`${listing.mileage.toLocaleString('en-GB')} mi`);
      }
      opt.append(el('span', 'vm-pick-meta', bits.join(' · ')));
      opt.addEventListener('click', () => {
        picker.querySelectorAll('.vm-pick-opt').forEach((b) => {
          b.classList.remove('is-on');
          b.setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('is-on');
        opt.setAttribute('aria-pressed', 'true');
        // Re-describe the card as the chosen car: paint, swatch, price, gearbox, mileage,
        // link. Anything left showing the previous listing is a card describing two cars at once.
        showPhoto(listing.photo);
        renderSpecs(
          listing.colour, listing.shade, gbp(listing.priceMin),
          listing.transmission ?? car.transmission,
        );
        renderKit(listing);
        if (usedMeta) {
          const bits = [];
          if (car.plate) bits.push(`’${car.plate} reg`);
          if (listing.mileage != null) {
            bits.push(`${listing.mileage.toLocaleString('en-GB')} miles`);
          }
          usedMeta.textContent = bits.join('  ·  ');
        }
        const cta = card.querySelector('.vm-card-link');
        if (cta && listing.link) cta.href = listing.link;
        // Re-offer reasons about the car now being shown.
        onPick?.(listing);
      });
      picker.append(opt);
    });
    body.append(picker);
  }

  // Link out to the retailer's live stock, when the feed gave us one.
  if (car.link) {
    const cta = el('a', 'vm-card-link', `View at ${car.retailerName || 'the retailer'} ›`);
    cta.href = car.link;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    body.append(cta);
  }

  card.append(body);
  return card;
}

/**
 * A small "mini" tile for the live preview strip — lighter than the compact card: a small
 * photo (or placeholder), name + score, one spec line. The whole tile links to the listing.
 */
export function previewTile(match) {
  const { car, score } = match;
  // A grouped card prices the whole group; a single listing prices itself.
  const price = car.listingCount > 1 && car.priceFrom !== car.priceTo
    ? `from ${gbp(car.priceFrom)}`
    : (car.priceMin === car.priceMax
      ? gbp(car.priceMin)
      : `${gbp(car.priceMin)}–${gbp(car.priceMax)}`);

  // Whole tile is the tap target — an <a> when we have a link, else a plain
  // article (still a valid tile, just not clickable).
  const tag = car.link ? 'a' : 'article';
  const tile = el(tag, 'vm-ptile vm-ptile-mini');
  if (car.link) {
    tile.href = car.link;
    tile.target = '_blank';
    tile.rel = 'noopener noreferrer';
    tile.setAttribute('aria-label', `${car.name}, ${price}, ${score}% match. View at ${car.retailerName || 'the retailer'}`);
  }

  const { media } = mediaWell(car, 'vm-ptile-media');

  const body = el('div', 'vm-ptile-body');
  const head = el('div', 'vm-ptile-head');
  const badge = el('span', 'vm-score vm-ptile-score', `${score}%`);
  badge.title = 'Match score';
  head.append(el('span', 'vm-ptile-name', car.name.replace(/^BMW /, '')), badge);
  const specs = el('span', 'vm-ptile-specs',
    [SPEC_LABELS[car.body], FUEL_SPEC[car.fuel], price].filter(Boolean).join(' · '));
  body.append(head, specs);
  tile.append(media, body);
  return tile;
}
