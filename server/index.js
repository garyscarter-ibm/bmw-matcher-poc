/*
 * BMW Matcher API — zero-dependency Node HTTP server.
 *
 * Runs the matching engine server-side so the curated dataset (data.js) and
 * scoring weights (engine.js) never reach the browser. The EDS block calls:
 *
 *   GET  /api/questions  → quiz definition (showIf functions stripped)
 *   POST /api/match      → { answers } → { matches, contenders } with
 *                          display-only car fields (no tags/specs the engine
 *                          uses internally, so the dataset can't be rebuilt)
 *   GET  /health         → { ok: true }
 *
 * Portable: no framework, no build step. Deploy behind any host; set PORT.
 */

import { createServer } from 'node:http';

import { matchCars } from './engine.js';
import { CARS } from './data.js';
import { QUESTIONS, BUDGET_BANDS } from './questions.js';

const PORT = Number(process.env.PORT) || 8787;
const MAX_BODY_BYTES = 16 * 1024; // quiz answers are tiny; reject anything bigger

const CORS_HEADERS = {
  // Public, read-only tool — responses carry no secrets. Tighten to the EDS
  // origin here if you want to lock it down later.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Quiz definition for the client. `showIf` predicates can't cross JSON, so we
 * drop them and mark conditional questions — the block applies the matching
 * predicate from quiz-meta.js by question id.
 */
function publicQuestions() {
  return QUESTIONS.map(({ showIf, ...q }) => (showIf ? { ...q, conditional: true } : q));
}

/**
 * Project a car down to only the fields the result cards render (see
 * matchCard() in bmw-matcher.js). Internal scoring fields — tags, sizeClass,
 * seats, boot, monthlyFrom, id — are omitted so responses can't be used to
 * reconstruct the dataset.
 */
function publicCar(car) {
  return {
    name: car.name,
    line: car.line,
    body: car.body,
    fuel: car.fuel,
    priceMin: car.priceMin,
    priceMax: car.priceMax,
    zeroTo62: car.zeroTo62,
    mpg: car.mpg,
    evRange: car.evRange,
    blurb: car.blurb,
  };
}

function publicMatch({ car, score, stretch, reasons }) {
  return { car: publicCar(car), score, stretch, reasons };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleMatch(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    return sendJson(res, err.statusCode || 400, { error: err.message });
  }

  const answers = body && body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return sendJson(res, 400, { error: 'Missing "answers" object' });
  }
  if (!BUDGET_BANDS[answers.budget]) {
    return sendJson(res, 400, { error: 'Invalid or missing budget' });
  }

  const { matches, contenders } = matchCars(answers, CARS);
  return sendJson(res, 200, {
    matches: matches.map(publicMatch),
    contenders: contenders.map(publicMatch),
  });
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/questions') {
    return sendJson(res, 200, { questions: publicQuestions(), budgetBands: BUDGET_BANDS });
  }

  if (req.method === 'POST' && pathname === '/api/match') {
    return handleMatch(req, res);
  }

  return sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`BMW Matcher API listening on http://localhost:${PORT}`);
});
