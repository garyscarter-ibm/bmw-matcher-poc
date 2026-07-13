# Find My Perfect BMW

A consumer-facing quiz for the UK market: answer ~10 quick questions about your
budget, lifestyle and driving, and get matched with your top 3 BMWs from the
current UK range — with a plain-English explanation of *why* each one suits you.

The UI is a **portable Adobe Edge Delivery Services (EDS) block** — vanilla JS +
CSS, no framework, no build step. The scoring engine and car dataset run behind
a small **backend API** you host outside EDS, so the dataset and weights are
never shipped to the browser.

> Unofficial tool. Not affiliated with or endorsed by BMW. Prices and specs are
> indicative — always check with a retailer.

## Architecture: UI block + backend

Two deployables:

- **`blocks/bmw-matcher/`** — the EDS block (quiz UI, results, share links). It
  holds no dataset or weights; it calls the API for the quiz definition and for
  match results. Ports into a live EDS site by copy-paste; point it at your
  backend with a `data-api` attribute.
- **`server/`** — a zero-dependency Node HTTP API that runs the matching engine.
  The full dataset (`data.js`) and scoring weights (`engine.js`) live here and
  stay server-side. Deploy it to any Node host.

Why the split: the curated dataset and tuned weights are the interesting IP, and
a purely client-side block would ship all of it in plain sight. Moving the engine
behind an API keeps `matchCars()` (and everything it reads) off the client — the
browser only ever sees the display fields of your top matches.

Trade-off: the tool now needs the backend to be reachable. If the API is down,
the block shows a friendly error rather than falling back to a client-side engine
(which would defeat the point of hiding the dataset).

## Run it locally

Two processes — the API and a static server for the block:

```sh
# 1. Start the matching API (http://localhost:8787)
cd server && npm start

# 2. In another terminal, serve the block and open the printed URL
npm run serve          # http://localhost:3000  (zero-dep Node static server)

# Tests (Node 18+, zero deps) — run from the server folder:
cd server && npm test
```

`index.html` is a standalone harness that mounts the block exactly the way EDS
would; its `data-api` points at `http://localhost:8787`. Open it via the local
server — ES modules don't load from `file://`.

> `npm run preview` (Python `http.server`) is kept as an alternative static
> server, but `npm run serve` (Node) works in more environments.

## Project layout

```
blocks/bmw-matcher/
  bmw-matcher.js    # EDS block: decorate(block) — quiz UI, results, share links
  bmw-matcher.css   # scoped styles (.bmwm), mobile-first, auto-loaded by EDS
  quiz-meta.js      # client-only: conditional-question predicates + budget bands
server/
  index.js          # zero-dep Node API: /api/questions, /api/match, /health
  engine.js         # pure scoring engine + WEIGHTS config  (server-side only)
  questions.js      # quiz definition + budget bands        (source of truth)
  data.js           # curated UK BMW dataset (~35 cars)     (server-side only)
  test/engine.test.js # engine tests (node --test)
  package.json      # server: start / test scripts
index.html          # standalone preview harness (sets data-api)
scripts/serve.js    # zero-dep static server for the block (npm run serve)
```

The block folder is the EDS deliverable; the `server/` folder is what you host.

## Porting to Adobe EDS

The block follows EDS conventions (`decorate(block)` default export, CSS named
after the block, self-contained folder), so porting is a copy-paste:

1. Copy `blocks/bmw-matcher/` into your EDS project's `blocks/` directory.
2. In the document that drives the page, add a block table named
   **BMW Matcher** (a one-cell table containing `bmw-matcher` works too).
3. Point the block at your deployed backend by setting a `data-api` attribute on
   the block element to your API's base URL. It defaults to
   `http://localhost:8787` for local dev.
4. Publish. EDS auto-loads `bmw-matcher.css` and calls the block's
   `decorate()` — no other wiring needed.

Notes:
- The block itself ships no dataset or weights — those stay behind the API.
- Styles are scoped under `.bmwm` and won't fight your site's global CSS.
- Share links use the URL hash (`#m=…`), which EDS passes through untouched.
- The block makes requests to your API's origin. If your site enforces CSP, allow
  that origin in `connect-src`; the API sends permissive CORS headers by default.

## API contract

The backend exposes two endpoints (plus `GET /health` → `{ ok: true }`):

- **`GET /api/questions`** → `{ questions, budgetBands }`. The quiz definition,
  with the conditional-visibility functions stripped (they can't cross JSON);
  conditional questions are marked `conditional: true` and the block applies the
  matching predicate from `quiz-meta.js`.
- **`POST /api/match`** with body `{ answers }` → `{ matches, contenders }`.
  Each entry is `{ car, score, stretch, reasons }`, where `car` carries **only
  display fields** (name, line, body, fuel, price range, 0–62, mpg/range, blurb).
  Internal scoring fields (tags, size class, seats, boot…) are omitted, so the
  dataset can't be reconstructed from responses.

## Deploy the backend

`server/` is a plain Node HTTP server with **no dependencies** — nothing to
build, nothing to install.

```sh
cd server && PORT=8787 node index.js
```

Run it behind any Node host (Render, Railway, Fly, a VPS, a container). Set
`PORT` from the environment. Then set the block's `data-api` to the public URL.
CORS defaults to `*`; tighten `Access-Control-Allow-Origin` in `index.js` to your
EDS origin to lock it down.

## How the matching works

Deterministic weighted scoring — transparent and unit-tested, no black box.

1. **Hard filters** remove cars clearly outside the brief: more than 15% over
   budget (`STRETCH_FACTOR`), or too few seats/boot for a full crew. Cars
   *within* the 15% stretch survive but are flagged as "a stretch".
2. **Eight soft dimensions** are scored 0–1 per car: budget fit, body style,
   fuel type (EVs are heavily penalised without charging access), practicality,
   performance, running costs, size vs. usage, and character (tag matching).
3. **Weights** combine the dimensions into a 0–100 match score. Base weights
   live in `WEIGHTS`; the user's two stated priorities reweight the engine via
   `PRIORITY_BOOSTS`, and high mileage / sporty-style answers nudge economy and
   performance weights.
4. **Reasons** are generated from the actual score components: the top 3–4
   highest-contributing dimensions that scored ≥ 0.7 produce the "why this
   suits you" bullets — no canned per-car marketing text.
5. Ties break deterministically: score, then lower price, then name.

### Tuning

| What you want to change | Where |
|---|---|
| How much each dimension matters | `WEIGHTS` in `server/engine.js` |
| How priorities reweight scoring | `PRIORITY_BOOSTS` in `server/engine.js` |
| Budget stretch tolerance | `STRETCH_FACTOR` in `server/engine.js` |
| Cars, prices, specs, character tags | `server/data.js` (see field docs at top) |
| Questions, options, budget bands | `server/questions.js` (mirror any conditional-question predicate in `blocks/bmw-matcher/quiz-meta.js`) |

Tuning lives entirely server-side, so you can retune weights or refresh the
dataset and redeploy the backend **without touching the EDS block**.

Run `npm test` after tuning — the tests assert persona-level outcomes
(city driver gets something compact, enthusiast gets a drivers' car, family
crew never gets a two-seater…), so they catch weight changes that break the
product, not just the code.

### Updating the dataset

`data.js` is the single source of truth, marked with a "last reviewed" date.
Figures are indicative UK OTR prices and approximate WLTP-ish specs; the
*relative* positioning between cars matters more than exact numbers. Add or
retire cars by editing the array — the engine and tests pick them up
automatically (`npm test` validates every entry has the required fields).

## Extending

- **Swap in an ML ranker later:** `matchCars(answers, cars)` is the whole
  engine interface — anything that returns `{ matches, contenders }` with
  scores and reasons can replace it.
- **LLM-written explanations:** keep the deterministic scores, feed the top
  matches + answers to an LLM for prose. The backend already exists, so this is
  a natural next step — add it inside `/api/match` and return the prose alongside
  the scores.
- **Real images:** each card has a media slot (`.bmwm-card-media`) ready for
  licensed imagery.
