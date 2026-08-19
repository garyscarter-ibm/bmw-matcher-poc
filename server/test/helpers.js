/*
 * Test harness for the HTTP API layer (api.test.js): drives real HTTP against a
 * buildServer() on port 0 with an injected in-memory stock source (real seam, hermetic).
 */

import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildServer } from '../index.js';
import { mapVehicle } from '../mapping.js';

/**
 * Spin up a server with injected stock on an ephemeral port; returns { base, close }.
 * Fakes mirror stock.js's real signatures so a passing test proves production calls.
 */
export async function startTestServer(deps = {}) {
  const server = buildServer(deps);
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  return {
    base,
    async close() {
      server.close();
      await once(server, 'close');
    },
  };
}

/** POST JSON and return { status, json, text } — json is null if the body
 * wasn't JSON, so a test can assert on either without a try/catch. */
export async function post(base, path, body) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Passing a pre-serialised string lets a test send deliberately malformed
    // JSON; anything else is stringified normally.
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return readResponse(res);
}

/** GET and return { status, json, text }. */
export async function get(base, path) {
  const res = await fetch(`${base}${path}`);
  return readResponse(res);
}

/** Raw request with a caller-chosen method — for exercising route dispatch
 * (wrong method, OPTIONS preflight). `headers` lets an auth test send X-Access-Key. */
export async function request(base, path, { method = 'GET', headers } = {}) {
  const res = await fetch(`${base}${path}`, { method, headers });
  const out = await readResponse(res);
  out.headers = res.headers;
  return out;
}

async function readResponse(res) {
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON body (shouldn't happen — the server always sends JSON — but a
    // test asserting that is legitimate).
  }
  return { status: res.status, json, text };
}

/* ------------------------------------------------------------------ *
 * Fixtures: feed-shaped vehicles → real mapVehicle → engine-ready cars
 * ------------------------------------------------------------------ */

let advertSeq = 202500100;

/**
 * Build one feed-shaped BMW vehicle. Each gets a unique advert_id so grouping
 * doesn't collapse distinct fixtures into one card and skew count-based assertions.
 */
export function bmwFeedVehicle(overrides = {}) {
  const id = overrides.advert_id ?? advertSeq++;
  return {
    advert_id: id,
    title: 'BMW X3',
    derivative: 'X3 xDrive20d M Sport',
    fuel: 'Diesel',
    cash_price: { value: 42000 },
    mileage: 15000,
    identification: { plate: '72' },
    // Real per-listing figures mapVehicle now surfaces (engine cc + reg year).
    engine: { cc: 1995, litres: 2 },
    registration: { date: '2022-09-30T00:00:00Z' },
    consumption: { fuel: { values: { combined: 48.0 } } },
    media: { items: [{ type: 'image', url: `https://img/bmw-${id}.jpg` }] },
    retailer_site: { id: 96, name: 'Grassicks BMW', dealer_number: '11107' },
    ...overrides,
  };
}

/** Build one feed-shaped MINI vehicle (petrol Countryman by default). */
export function miniFeedVehicle(overrides = {}) {
  const id = overrides.advert_id ?? advertSeq++;
  return {
    advert_id: id,
    title: 'MINI Countryman',
    derivative: 'Countryman C',
    fuel: 'Petrol',
    cash_price: { value: 27000 },
    mileage: 12000,
    identification: { plate: '73' },
    // Real per-listing figures mapVehicle now surfaces (engine cc + reg year).
    engine: { cc: 1499, litres: 1.5 },
    registration: { date: '2023-03-01T00:00:00Z' },
    consumption: { fuel: { values: { combined: 44.0 } } },
    media: { items: [{ type: 'image', url: `https://img/mini-${id}.jpg` }] },
    retailer_site: { id: 92, name: 'Sytner Luton MINI', dealer_number: '15127' },
    ...overrides,
  };
}

/** A pool of `n` distinct, engine-ready BMW cars across a price range so a budget
 * keeps them eligible. Default 20, big enough to prove FIELD_MAX (16) slicing. */
export function bmwPool(n = 20) {
  return Array.from({ length: n }, (_, i) => mapVehicle(
    bmwFeedVehicle({ cash_price: { value: 30000 + i * 500 } }),
    'bmw',
  ));
}

/** A smaller MINI pool (default 6) — a thin feed, to drive the field's
 * "returns fewer than asked, mode adapts down" path. */
export function miniPool(n = 6) {
  return Array.from({ length: n }, (_, i) => mapVehicle(
    miniFeedVehicle({ cash_price: { value: 24000 + i * 500 } }),
    'mini',
  ));
}

/**
 * A pool of `n` real Honda cars from `fixtures/honda-cars.json` (the mapped
 * mapHondaRaw output the render test serves). Sampled from the front for determinism.
 */
export function hondaPool(n = 20) {
  const path = fileURLToPath(new URL('../../fixtures/honda-cars.json', import.meta.url));
  const all = JSON.parse(readFileSync(path, 'utf8'));
  return all.slice(0, n);
}

/**
 * A pool of `n` real Ford cars from `fixtures/ford-cars.json` (mapFordRaw output).
 * Same rationale as hondaPool: no replayable live feed, so use the real fixtures.
 */
export function fordPool(n = 20) {
  const path = fileURLToPath(new URL('../../fixtures/ford-cars.json', import.meta.url));
  const all = JSON.parse(readFileSync(path, 'utf8'));
  return all.slice(0, n);
}

/**
 * A pool of `n` real Motorrad BIKES from `fixtures/motorrad-bikes.json` (mapMotorradRaw
 * output). Same engine schema as cars, so every downstream consumer treats them alike.
 */
export function motorradPool(n = 20) {
  const path = fileURLToPath(new URL('../../fixtures/motorrad-bikes.json', import.meta.url));
  const all = JSON.parse(readFileSync(path, 'utf8'));
  return all.slice(0, n);
}

/**
 * A pool of `n` real Ferrari cars from `fixtures/ferrari-cars.json` (mapFerrariRaw
 * snapshot; photos are Thron-gated). Identical engine schema to every car brand.
 */
export function ferrariPool(n = 20) {
  const path = fileURLToPath(new URL('../../fixtures/ferrari-cars.json', import.meta.url));
  const all = JSON.parse(readFileSync(path, 'utf8'));
  return all.slice(0, n);
}

/**
 * A fake fetchRetailerStock serving a per-brand pool, recording each call's
 * (brand, retailer) in `.calls`. Unknown brands fall back to the bmw pool.
 */
export function fakeStock({ bmw = bmwPool(), mini = miniPool() } = {}) {
  const fn = async (brand, retailer) => {
    fn.calls.push({ brand, retailer });
    return brand === 'mini' ? mini : bmw;
  };
  fn.calls = [];
  return fn;
}

/**
 * A fake enrichColours that tags each car with a colour and counts calls, so
 * enrich behaviour is assertable without a PDP fetch (call count guards the contract).
 */
export function fakeEnrich() {
  const fn = async (brand, cars = []) => {
    fn.calls += 1;
    for (const car of cars) {
      car.colour = { colour: 'Blue', manufacturerColour: 'Portimao Blue' };
    }
    return cars;
  };
  fn.calls = 0;
  return fn;
}

/** A fetchRetailerStock/fetchNearbyStock that always throws the given error —
 * for the 502 (StockUnavailableError), 500 (generic) and nearby-degrades paths. */
export function throwingStock(error) {
  return async () => { throw error; };
}
