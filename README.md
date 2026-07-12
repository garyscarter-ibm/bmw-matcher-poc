# Find My Perfect BMW

A consumer-facing quiz for the UK market: answer ~10 quick questions about your
budget, lifestyle and driving, and get matched with your top 3 BMWs from the
current UK range — with a plain-English explanation of *why* each one suits you.

Built as a **portable Adobe Edge Delivery Services (EDS) block** with zero
dependencies: vanilla JS + CSS, no framework, no build step, no backend.

> Unofficial tool. Not affiliated with or endorsed by BMW. Prices and specs are
> indicative — always check with a retailer.

## Run it locally

```sh
npm run preview        # serves the folder on http://localhost:3000
npm test               # runs the scoring-engine tests (Node 18+, zero deps)
```

`index.html` is a standalone harness that mounts the block exactly the way EDS
would — open it via the local server (ES modules don't load from `file://`).

## Project layout

```
blocks/bmw-matcher/
  bmw-matcher.js    # EDS block: decorate(block) — quiz UI, results, share links
  bmw-matcher.css   # scoped styles (.bmwm), mobile-first, auto-loaded by EDS
  engine.js         # pure scoring engine + WEIGHTS config
  questions.js      # quiz definition + budget bands
  data.js           # curated UK BMW dataset (~35 cars)
index.html          # standalone preview harness
test/engine.test.js # engine tests (node --test)
```

Everything the tool needs lives inside `blocks/bmw-matcher/` — that folder *is*
the deliverable; the rest is harness and tests.

## Porting to Adobe EDS

The block follows EDS conventions (`decorate(block)` default export, CSS named
after the block, self-contained folder), so porting is a copy-paste:

1. Copy `blocks/bmw-matcher/` into your EDS project's `blocks/` directory.
2. In the document that drives the page, add a block table named
   **BMW Matcher** (a one-cell table containing `bmw-matcher` works too).
3. Publish. EDS auto-loads `bmw-matcher.css` and calls the block's
   `decorate()` — no other wiring needed.

Notes:
- The block is fully client-side, so it works within EDS's no-server model.
- Styles are scoped under `.bmwm` and won't fight your site's global CSS.
- Share links use the URL hash (`#m=…`), which EDS passes through untouched.
- If your site enforces CSP, no external requests are made — nothing to allow.

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
| How much each dimension matters | `WEIGHTS` in `engine.js` |
| How priorities reweight scoring | `PRIORITY_BOOSTS` in `engine.js` |
| Budget stretch tolerance | `STRETCH_FACTOR` in `engine.js` |
| Cars, prices, specs, character tags | `data.js` (see field docs at top) |
| Questions, options, budget bands | `questions.js` |

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
  matches + answers to an LLM for prose. (Requires a backend/edge function —
  outside EDS's static model, so keep it optional.)
- **Real images:** each card has a media slot (`.bmwm-card-media`) ready for
  licensed imagery.
