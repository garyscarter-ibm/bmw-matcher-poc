/*
 * Scrape real Honda UK approved-used stock into fixtures/honda-raw.json (parsed-but-unmapped records; run build-honda-fixtures.mjs to map them). No clean API, but the listing pages are server-rendered with a rich per-card spec list. Pagination is a PATH segment (/page2/, not a query param); we sample pages politely for model variety.
 * Usage:  node scripts/scrape-honda.mjs [pages]   (default 15 pages ~ 360 cars)
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://usedcars.honda.co.uk/en/used-cars/approved-cars/all-brands/all-models';
const WARRANTY = 'warrantyProgram=22'; // the approved-used programme the user linked

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Decode the handful of HTML entities the listing uses. */
function decode(s) {
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
 * Split one listing page into per-vehicle HTML blocks by slicing on the
 * "vehicle-inner" wrapper, which each real card has exactly once.
 */
function splitCards(html) {
  const parts = html.split('class="vehicle-inner"');
  // parts[0] is the pre-first-card chrome; each subsequent chunk is one card
  // (plus trailing page chrome on the last, which the field extractors ignore).
  return parts.slice(1);
}

/** First capture-group match, decoded, or null. */
function pick(re, html) {
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
}

/** A labelled spec from the card's <li> list, e.g. "Mileage" → "72,500 miles". */
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
function parseCard(block) {
  const link = pick(/href="(\/en\/used-cars\/approved-cars\/honda\/[^"#]+)"/, block);
  const title = pick(/title="(Honda[^"]+)"/, block);
  if (!link || !title) return null;

  // Cash price: take the largest £ value on the card, which is always the cash
  // price (the smaller monthly figure sits under "Monthly Payment").
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

async function fetchPage(page) {
  const url = page === 1
    ? `${BASE}?${WARRANTY}`
    : `${BASE}/page${page}?${WARRANTY}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`page ${page} HTTP ${res.status}`);
  return res.text();
}

/** Which pages to pull. The inventory is sorted cheapest-first, so `stride` mode samples
 *  across it (1, 4, 7, … up to `last`) for a representative price spread; a plain count gives first-N. */
function pagePlan() {
  const arg = process.argv[2];
  if (arg && arg.startsWith('stride')) {
    const last = Number(process.argv[3]) || 58;
    const step = Number(process.argv[4]) || 3;
    const pages = [];
    for (let p = 1; p <= last; p += step) pages.push(p);
    return pages;
  }
  const n = Number(arg) || 15;
  return Array.from({ length: n }, (_, i) => i + 1);
}

async function main() {
  const plan = pagePlan();
  const seen = new Set();
  const records = [];
  for (const p of plan) {
    // eslint-disable-next-line no-await-in-loop
    const html = await fetchPage(p);
    const cards = splitCards(html).map(parseCard).filter(Boolean);
    let added = 0;
    for (const c of cards) {
      if (seen.has(c.link)) continue;
      seen.add(c.link);
      records.push(c);
      added += 1;
    }
    process.stdout.write(`page ${p}: ${cards.length} cards, +${added} new (total ${records.length})\n`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(700); // polite throttle — we are a guest on their site
  }
  const out = join(REPO_ROOT, 'fixtures', 'honda-raw.json');
  writeFileSync(out, JSON.stringify(records, null, 0));
  process.stdout.write(`\nWrote ${records.length} raw Honda records to ${out}\n`);
  // A quick spec-completeness readout so we can see how clean the scrape is.
  const have = (k) => records.filter((r) => r[k] != null).length;
  for (const k of ['price', 'mileage', 'fuel', 'transmission', 'doors', 'bhp', 'cc', 'mpg', 'year', 'colour', 'image']) {
    process.stdout.write(`  ${k}: ${have(k)}/${records.length}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`scrape-honda failed: ${err.stack || err}\n`);
  process.exit(1);
});
