# Live retailer stock — findings & implementation plan

Status: **planning complete, not yet implemented**. This document captures
verified research so the work can resume in a fresh session without
re-discovering the API.

## Why

Pivot from the static curated `server/data.js` dataset to **live used-car
stock from a real BMW retailer** (Grassick's BMW, Perth), so the matcher
recommends cars that are actually buyable today — real price, mileage,
photos — instead of an approximated range. Also use Grassick's site to
build a BMW-brand design-token layer so the tool can drop into a retailer
site seamlessly.

Decisions already made with the user:
1. **Live proxy**, not a one-time snapshot — the backend fetches Grassick's
   stock on demand (cached briefly), not baked into a file.
2. **Per-model lookup table** for specs missing from the live feed (0-62,
   boot, seats) — keeps all 8 engine scoring dimensions working.
3. **Design tokens first** — a documented CSS-variable layer for the BMW
   brand system, applied lightly now; full visual reskin is a later pass.

## Verified: the live stock API (reverse-engineered)

Grassick's stock is served by `usedcars.bmw.co.uk`, an Auto Trader-powered
platform used by all BMW UK retailers.

- **Listing endpoint:** `GET https://usedcars.bmw.co.uk/vehicle/api/list/?retailer_site=96`
  → Grassick's cars only. `id 96` = "Grassicks Garage", dealer number 11107,
  part of `retailer_group=10` ("Eastern": Grassicks + Eastern Motor Company).
  23 results/page; paginate with `&page=N`.
- **Confirmed stock right now:** 51 cars, £18,790–£60,890, spanning 17 model
  lines (X1, X3, X4, X5, X6, X7, iX, iX2, i5, 1/2/3/4/5 Series, 2 Series
  Active Tourer, M2, M3 Competition). Fuel mix: 18 diesel, 17 petrol, 6 PHEV
  ("Petrol Plug-in Hybrid"), 6 electric ("ELECTRIC"/"Electric"), a few mild
  hybrids ("Petrol Hybrid"/"Diesel Hybrid" — these are NOT PHEVs, treat as
  petrol/diesel).
- **CSRF-gated, even for GET.** A naked server-side request gets
  `403 {"message":"A valid CSRF token was not provided."}`. Verified working
  bootstrap flow (tested from plain curl, no browser):
  1. `GET https://usedcars.bmw.co.uk/` with a normal browser User-Agent →
     capture the `csrftoken` cookie from `Set-Cookie`.
  2. Call `list/` with that cookie + header `X-CSRFToken: <token>` + header
     `Referer: https://usedcars.bmw.co.uk/` → 200 JSON.
  3. Cache the cookie/token; re-bootstrap once if a call comes back 403
     (token may expire/rotate).
- **Response shape:** `{ pagination: { current, items (grand total), total
  (page count) }, results: [ vehicle, … ] }`.
- **Per-vehicle fields available:**
  `title` ("BMW X3"), `derivative` ("X3 xDrive20i M Sport"), `fuel` (see
  values above), `transmission`, `cash_price.value` (real £, single price —
  not a range), `mileage`, `identification.plate` ("23"), `registration.date`,
  `consumption.fuel.values.combined` (mpg), `consumption.co2.value` (g/km),
  `consumption.range.values.total` (EV/PHEV electric range miles, may be
  null), `engine.litres`, `media.items[].url` (real photo URLs, ~20+ per
  car), `retailer_site.{id,name}`, `advert_id`, `features.{standard,
  additional,…}`.
- **NOT in the feed:** 0-62 time, boot litres, seat count. These need the
  per-model lookup table (keyed by model line, ~17 entries).
- Full findings + raw samples also saved during research to the session
  scratchpad (not in this repo): `usedcars-api.md`, `grassicks-findings.md`,
  `shortlist.md` — those were throwaway working notes; this file supersedes
  them as the durable record.

## Engine compatibility check (verified, no code written yet)

- `scoreBudget` in `server/engine.js` already handles `priceMin === priceMax`
  cleanly (a single used-car price): within band → 1.0, under band → 0.7,
  over max → 0.35 + stretch flag. **No engine change needed** for this.
- Node 16 (the local dev runtime) has **no global `fetch`** — the stock
  client must use `node:https` directly (zero-dep, always available),
  not `fetch()`.

## Planned architecture

New/changed files under `server/`:

- **`server/stock.js`** — the live-fetch client. CSRF bootstrap +
  cookie/token cache, `fetchGrassickStock(retailerSite)` pages through
  `list/` and returns raw vehicles, short in-memory TTL cache (~5–10 min,
  keyed per retailer) so `/api/match` doesn't refetch on every request.
  **Done:** the retailer is now request-scoped, not just a server-wide env
  var — `/api/match` accepts an optional `retailer` field in its body
  (falling back to the `RETAILER_SITE` env var, default `96`, if omitted),
  so one deployed backend can serve multiple retailer sites. The EDS block
  reads its retailer from an authored "Retailer ID" config row (standard
  `readBlockConfig()` convention) and passes it through per request.
- **`server/mapping.js`** (new) — `vehicle → car` projection to the engine's
  existing schema, plus the per-model lookup table:
  - `name`/`line` ← derived from `title` + `derivative`
  - `body` ← derived: `X*`/`iX*` → suv, "Gran Coupe" → saloon, "Touring" →
    estate, "Coupe" → coupe, "Active Tourer" → mpv, plain Series saloon →
    saloon, "1 Series" → hatchback
  - `fuel` ← normalized from the messy feed values (see fuel mix above);
    mild hybrids collapse to their base fuel
  - `priceMin = priceMax = cash_price.value`
  - `mpg` ← `consumption.fuel.values.combined`; `evRange` ←
    `consumption.range.values.total`
  - `boot`/`seats`/`zeroTo62`/`sizeClass` ← per-line lookup table (with trim
    hints for 0-62, e.g. M-badge or `xDrive50e` → faster)
  - `tags` ← derived from line/body/trim (M* → drivers-car, X5/X7 →
    family+practical, i*/iX* → tech, etc.)
  - `id` ← `advert_id`
  - New **display-only** fields to carry through: `mileage`, `plate`/reg
    year, `photo` (first `media.items[].url`), `retailerName`, and ideally
    an advert/detail-page link if the platform exposes one per-vehicle.
- **`server/index.js`** — `handleMatch` swaps the static `CARS` import for
  `stock.js` + `mapping.js` output. `publicCar()` projection extends to
  include the new real display fields, while still stripping internal
  scoring fields (tags, sizeClass, raw features) — same "don't leak the
  dataset" principle as before, just applied to live data now.
- **`server/data.js` + `server/test/engine.test.js`** — **keep as-is**. The
  engine's unit tests should stay deterministic and offline; they exercise
  `matchCars()` against the static fixture, not the network. Live stock is
  a runtime concern of `index.js`, not the engine.
- **Failure handling:** per user's "live proxy" choice (not "live +
  snapshot fallback"), if the live fetch fails, `/api/match` returns a
  friendly 5xx and the block's existing error/retry UI handles it — no
  static fallback dataset.
- **`blocks/bmw-matcher/bmw-matcher.js`** — `matchCard()` extends to show
  the new real fields where present: mileage, photo (replacing the current
  placeholder `.bmwm-card-media` slot), retailer name, maybe age/plate.

## Design tokens (separate, lighter-weight follow-up)

Full spec now written up in [design-tokens.md](design-tokens.md) — complete
type scale, 4px-based spacing scale, button variants, colour tokens
(`--bmwm-accent: #1C69D4` etc.), and geometry (sharp, 0px radius), all
extracted directly from `grassicksbmw.co.uk`'s computed styles. That
document is a ready-to-implement CSS custom-property spec, not just notes.

Plan: land the live-data work first, then apply the token layer to
`bmw-matcher.css` (swap custom-property values, no JS changes needed) —
see the "Mapping onto the existing block" section of design-tokens.md for
the step order.

## Open risks / notes for whoever resumes this

- The `usedcars.bmw.co.uk` API is **undocumented and internal** — it could
  change shape or start blocking non-browser traffic. Fine for a POC/
  portfolio piece; note this plainly in the README once built.
- CSRF token lifetime is unknown — the bootstrap-and-cache approach should
  tolerate re-bootstrapping on any 403, not just at startup.
- Boot/seats accuracy depends entirely on the lookup table being right for
  ~17 model lines — worth a light spot-check against BMW's public spec
  pages when built, but does not need the exhaustive research-workflow
  treatment that hit session limits earlier.
- Two background research attempts (a spec-verification workflow, and a
  Plan sub-agent for this exact backend design) both failed on **account
  session limits**, not technical blockers. All findings above were
  obtained directly via curl/browser testing, so they're solid — just
  resume implementation directly from this document rather than
  re-launching those particular background jobs.
