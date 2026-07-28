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

> **New here, or coming back to it?** Read
> **[docs/how-it-works.md](docs/how-it-works.md)** — the whole system on one
> page. The rest of `docs/` is the record of *why* each decision was made.

## Architecture: UI block + backend

Two deployables:

- **`blocks/bmw-matcher/`** — the EDS block (quiz UI, results, share links). It
  holds no dataset or weights; it calls the API for the quiz definition and for
  match results. Ports into a live EDS site by copy-paste; point it at your
  backend with a `data-api` attribute.
- **`server/`** — a zero-dependency Node HTTP API that runs the matching engine
  against the retailer's **live stock feed** (`stock.js` + `mapping.js`), scored
  with the weights in `engine.js`. All of it stays server-side. Deploy it to
  any Node host.

Why the split: the tuned weights (and the live-stock request flow) are the
interesting IP, and a purely client-side block would ship all of it in plain
sight. Moving the engine
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

## Deploy it free

The two pieces host free on separate services: the backend on **Render**, the
static block on **GitHub Pages**. The block learns the backend URL at runtime via
a `?api=` query param, so nothing is hardcoded or rebuilt.

**1. Backend → Render.** [`render.yaml`](render.yaml) is a Blueprint Render reads
automatically. In the Render dashboard: **New → Blueprint**, connect this repo,
**Apply**. It builds `server/` and starts `node index.js`; Render injects `PORT`
and the server binds to it. Copy the service URL (e.g.
`https://bmw-matcher-api.onrender.com`).

> Free-plan services spin down after ~15 min idle, so the first request after a
> lull cold-starts (~30–50s). And `POST /api/match` proxies the **live** retailer
> stock feed — matches depend on that upstream being reachable.

**2. Frontend → GitHub Pages.** The [Pages workflow](.github/workflows/pages.yml)
publishes the repo root on every push to `main`. One-time setup: repo
**Settings → Pages → Source: "GitHub Actions"**.

**3. Wire them together.** Open the Pages URL with the backend passed in `?api=`:

```
https://<user>.github.io/<repo>/?api=https://bmw-matcher-api.onrender.com
```

Without `?api=`, the page falls back to `http://localhost:8787` (local-dev
default), so bookmark/share the URL *with* the param.

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
  stock.js          # live retailer-stock client (usedcars.bmw.co.uk)
  mapping.js        # maps live vehicles -> engine schema; MODEL_SPECS lookup
  data.js           # test fixture cars (~35)                (server/test only)
  test/engine.test.js # engine tests (node --test)
  package.json      # server: start / test scripts
index.html          # standalone preview harness (sets data-api)
scripts/serve.js    # zero-dep static server for the block (npm run serve)
scripts/dump-stock.js         # national stock snapshot -> fixtures/ (--remap: no network)
scripts/audit-questions.mjs   # do the QUESTIONS earn their screen? (npm run audit)
scripts/audit-refinement.mjs  # do the RESULTS pick a real winner? (npm run audit:refine)
```

Both audits replay the real engine over the fixture dumps and are written up in
`docs/` — [question-stock-audit.md](docs/question-stock-audit.md) and
[refinement-audit.md](docs/refinement-audit.md), the latter feeding the phase-2
design in [refinement-plan.md](docs/refinement-plan.md) and the results-page
restructure proposed in [results-page-states.md](docs/results-page-states.md).

The block folder is the EDS deliverable; the `server/` folder is what you host.

## Porting to Adobe EDS

The block follows EDS conventions (`decorate(block)` default export, CSS named
after the block, self-contained folder), so porting is a copy-paste:

1. Copy `blocks/bmw-matcher/` into your EDS project's `blocks/` directory.
2. In the document that drives the page, add a block table named
   **BMW Matcher** (a one-cell table containing `bmw-matcher` works too).
3. Add config rows below the block name — first cell the key, second the value.
   All are read with a `readBlockConfig()` helper, the standard `aem-boilerplate`
   convention:
   - **Brand** — `BMW` or `MINI` (defaults to BMW).
   - **Retailer ID** — the retailer's `retailer_site` ID (e.g. `96`); omit to
     fall back to the backend's default retailer.
   - **Retailer Name** — the display name shown in copy.
   - **API** — your deployed backend's base URL. **This is how you point an
     EDS-authored block at its backend**: authored content can set config rows
     but not HTML attributes, so the block reads the API base from this row
     (falling back to a `data-api` attribute for the local harness, then
     `http://localhost:8787`). Without it, a published block would try to reach
     localhost.
   - **Title**, **Kicker**, **Disclaimer** — optional copy overrides. Author a
     value to replace the default; leave the value cell **blank** (or write
     `none`) to remove that line entirely. Blanking **Title** is how you place
     the block under the page's own section heading without repeating it;
     blanking **Kicker** and **Disclaimer** drops the "unofficial matchmaker"
     framing, which suits a demo but not a retailer's own site.
4. Publish. EDS auto-loads `bmw-matcher.css` and calls the block's
   `decorate()` — no other wiring needed.

Example authored table:

| bmw-matcher |  |
|---|---|
| Brand | MINI |
| Retailer ID | 92 |
| Retailer Name | Sytner Luton MINI |
| API | https://your-backend.onrender.com |
| Title |  |

(The blank **Title** row above suppresses the block's own headline, for when it
sits under the page's own "FIND YOUR MINI." section heading.)

The block ships **no font files**: it names the host site's licensed families
first (`--heading-font-family` / `--body-font-family` on BMW, MINI's own faces
on MINI), so it inherits the site's typeface and falls back to a neutral stack
when run standalone.

The standalone `index.html` harness uses a `data-api` attribute + `?api=`
override instead (no DA needed); `?retailer=<id>` tries a different retailer
without editing the file. Both paths resolve through the same `apiBase()`.

Notes:
- The block itself ships no dataset or weights — those stay behind the API.
- Styles are scoped under `.bmwm` and won't fight your site's global CSS.
- Share links use the URL hash (`#m=…`), which EDS passes through untouched.
- The block makes requests to your API's origin. If your site enforces CSP, allow
  that origin in `connect-src`; the API sends permissive CORS headers by default.

## API contract

The backend exposes two endpoints (plus `GET /health` → `{ ok: true }`):

- **`GET /api/questions`** → `{ questions, budgetBands, topMatches }`. The
  question set, with the conditional-visibility functions stripped (they can't
  cross JSON); conditional questions are marked `conditional: true` and the
  block applies the matching predicate from `quiz-meta.js`. `topMatches` is
  `TOP_MATCHES` — how many results `/api/match` returns — sent so the intro copy
  can state the number without hardcoding it. Both counts are server-owned: a
  brand gaining a question, or `TOP_MATCHES` changing, updates the intro copy on
  the next page load with no block rebuild.
- **`POST /api/match`** with body `{ answers, retailer? }` → `{ matches, unmet }`.
  `retailer` is the retailer_site ID to match against; omit it to use the
  backend's default (`RETAILER_SITE` env var, or `96` if unset).
  Each match is `{ car, score, stretch, reasons }`, where `car` carries **only
  display fields** (name, line, body, fuel, price range, 0–62, mpg/range, blurb).
  Internal scoring fields (tags, size class, seats, boot…) are omitted, so the
  dataset can't be reconstructed from responses.
  `unmet` is the stated wants — fuel and body style — with no car behind them
  in the stock searched (e.g. `{ fuel: ['ev'] }`), so the results page can say
  so plainly instead of quietly serving the closest thing. `/api/nearby`
  reports the same for its own pool, and sends `unmet: null` when the lookup
  failed: the block only tells the user something is unavailable once both
  halves agree, and "we didn't hear back" is not agreement.

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
| New/updated model specs (0–62, boot, seats) | `MODEL_SPECS` in `server/mapping.js` — see [Updating the dataset](#updating-the-dataset) |
| Test fixture cars | `server/data.js` (see field docs at top; used by `server/test/` only) |
| Questions, options, budget bands | `server/questions.js` (mirror any conditional-question predicate in `blocks/bmw-matcher/quiz-meta.js`) |

Tuning lives entirely server-side, so you can retune weights or add new model
specs and redeploy the backend **without touching the EDS block**.

Run `npm test` after tuning — the tests assert persona-level outcomes
(city driver gets something compact, enthusiast gets a drivers' car, family
crew never gets a two-seater…), so they catch weight changes that break the
product, not just the code.

### Updating the dataset

Since [e6c8635] the matcher no longer scores a curated, static list — every
`/api/match` call fetches the retailer's **live used-stock feed**
(`server/stock.js`) and maps each vehicle through `server/mapping.js` into the
engine's schema. New models, discontinued lines and day-to-day price changes
all show up automatically as stock turns over; there's no dataset file to
hand-edit or keep "current".

`server/data.js` still exists, but only as **fixture data for the test
suite** (`server/test/engine.test.js` imports `CARS` from it to test
`matchCars()` in isolation from the live feed). It is not read by `index.js`
or `stock.js` and does not need to be kept in sync with the real BMW range —
treat it as a small, stable set of test cases, not a product dataset.

What the live feed *can't* tell us is three specs it doesn't carry: 0–62 time,
boot litres and seat count. Those come from `MODEL_SPECS` in
`server/mapping.js`, a lookup table keyed by model line (e.g. `X3`, `3
Series`, `iX1`) with derivative-based overrides for quicker trims (M badges,
`xDrive50e`, etc.). **This table is what needs updating when BMW releases a
new model line**:

1. Add an entry to `MODEL_SPECS` keyed by the line name the feed will use in
   its `title` (see `lineFromTitle()` for how the title is normalized — pure-M
   models collapse to the `"M"` key; everything else is the title with the
   leading "BMW" stripped).
2. Fill in `boot`, `seats`, `zeroTo62` (base/slowest trim for the line) and
   `sizeClass` (1 smallest – 5 largest), following the pattern of neighbouring
   entries.
3. If the new line has a distinctly quicker performance trim, extend
   `trimZeroTo62()` so that trim gets a faster figure than the base line.
4. If you skip a line, `mapVehicle()` falls back to `DEFAULT_SPEC` and logs a
   one-time `[mapping] no MODEL_SPECS for line "…"` warning — watch the server
   logs after a new model launches to catch anything missing.

Retiring a model needs no action — once the retailer stops stocking it, it
simply stops appearing in the live feed.

[e6c8635]: https://github.com/garyscarter-ibm/bmw-matcher-poc/commit/e6c8635

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
