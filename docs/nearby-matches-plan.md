# Nearby retailer matches — findings & implementation plan

Status: **implemented** on branch `feat/nearby-retailer-matches`. This
document captures API research verified against the live platform on
2026-07-16; it's kept as the reference for *why* the implementation looks the
way it does. See "Built" at the foot for what changed against this plan.

## Why

Replace the **"Close contenders"** strip — currently ranks 4–6 from the
configured retailer's own stock, rendered as flat name+score chips — with a
**"Worth the drive"** carousel: the top 3 matches from *other* BMW retailers
near the configured one, each tile showing a real distance from the
configured retailer.

The contenders strip answers a weak question ("what else did Grassicks
have?"). The new section answers a genuinely useful one: *"you've seen the
best three locally — here's what's worth a short drive."* Distance is the
whole point, so it must be real.

## Decisions made with the user

1. **Nearest retailers only**, not a nationwide crawl — resolve the
   retailers closest to the anchor, fetch those, ignore the long tail.
2. **Exclude the configured retailer** from the carousel. The hero grid is
   already its stock; nearby means *other* retailers, so distance is always
   non-zero and the section can't duplicate a hero card.
3. **Real distances only.** No invented/placeholder mileage — a tile that
   states a distance is making a factual claim to a car buyer.

## Verified: the distance API

The existing `stock.js` uses `?retailer_site=96`, which returns one
retailer's stock with no location data at all. The list endpoint has a
second, richer mode.

### The endpoint that works

```
GET /vehicle/api/list/?location=<postcode>&payment_type=cash&size=100&sort=distance&source=home&page=N
```

- **`location=` is the correct parameter — `postcode=` is silently ignored.**
  This cost a round of research: `?postcode=PH1 1RA&distance=25` returns
  byte-identical results for Perth and Truro (all 571 pages, unsorted). It
  looks like it filters. It does not. Do not use it.
- **`sort=distance` returns nearest-first**, and each vehicle's
  `retailer_site` gains a **`distance`** field in miles (float, e.g. `2.19`).
  This is the platform's own figure — no geocoding, no distance maths, no
  hand-maintained location table needed on our side.
- **`size=` caps at 100.** `size=200` still returns 100. Page with `&page=N`.
- `payment_type=cash` and `source=home` mirror the site's own home-page
  search; harmless, kept for fidelity with real traffic.

### Verified response, Perth (`PH1 1RA`), size=100, 4 pages

| Retailer | cars in 400 | distance (mi) |
|---|---|---|
| Grassicks Garage | 48 | 2.19 |
| John Clark Tayside | 96 | 19.51 |
| Arnold Clark Kirkcaldy | 52 | 21.76 |
| Douglas Park Stirling | 76 | 25.33 |
| Eastern Motor Company | 128 | 31.07 |

400 cars (4 pages) reaches the 5 nearest retailers — comfortably enough for
a top-3 carousel. Nationwide total is 13,128 cars / 132 pages at size=100;
we never crawl it.

### The anchor-postcode problem, and its solution

`location=` needs a **postcode**, but the block is configured with a
**retailer ID** (`96`). The used-cars feed's `retailer_site` object carries
only `{id, name, contact_number, dealer_number}` — no postcode, no
coordinates — and that platform has no retailer directory endpoint
(`/vehicle/api/retailers/`, `/api/retailers/`, `/vehicle/api/retailer_sites/`
all 404; `/vehicle/api/filters/` has no retailer facet).

**The dealer directory (preferred).** BMW's own "Find a BMW Centre" page
(`bmw.co.uk/en/footer/contact/find-a-bmw-centre.html`) nests two iframes
down to a Cloud Run app that calls:

```
GET https://bmw-mini-findacentre-develop-b45ry4vloa-nw.a.run.app/proxy/api/dealers
```

- **1,131 records, 144 unique `dealer_number`s**, ~2MB JSON. Open: no auth,
  no CSRF, no Referer needed. `Cache-Control: max-age=60, public`.
- Each record carries `dealer_number`, `dealer_name`, `postcode`,
  `latitude`, `longitude`, full address, phone, `active`, and channel flags
  (`auc` = approved-used, `new`, `service`, …).
- **`dealer_number` is the join key.** The used-cars feed already exposes
  `retailer_site.dealer_number`; the directory is keyed on the same value.
  Verified join, all 5 retailers near Perth:

  | used-cars site | name | dealer_number | directory postcode | lat,long |
  |---|---|---|---|---|
  | 96 | Grassicks Garage | 11107 | PH1 3GA | 56.417773, -3.462616 |
  | 82 | John Clark Tayside | 16308 | DD2 3PT | 56.478401, -3.00103 |
  | 86 | Arnold Clark Kirkcaldy | 16275 | KY1 3NQ | 56.135485, -3.148153 |
  | 69 | Douglas Park Stirling | 16230 | FK7 7RZ | 56.111048, -3.916055 |
  | 101 | Eastern Motor Company | 11102 | EH52 5AU | 55.937067, -3.447222 |

  **5/5 joined.** Grassicks' directory postcode `PH1 3GA` independently
  matches the postcode embedded in its PDP HTML (see fallback below) — two
  unrelated sources agreeing on the same address.

So the anchor postcode resolves cleanly from the configured retailer ID:

> `retailer_site=96` → page 1 of its stock → `retailer_site.dealer_number`
> (`11107`) → directory lookup → `PH1 3GA`.

**Fallback: PDP scraping.** Also verified, kept as a documented backup if
the Cloud Run host disappears. A vehicle PDP (`/vehicle/{advert_id}`, HTML,
~85KB) embeds `"postcode": "PH1 3GA", "latitude": 56.417773, "longitude":
-3.462616`. Same answer, but HTML-regex-brittle — prefer the directory.

Also confirmed: `?retailer_site=96&location=PH1 1RA&sort=distance` combines
cleanly, returning Grassicks stock with `distance: 2.19` attached — useful
if we ever want the hero cards to show distance too (not in this scope).

### Rejected: the EDQ address API

`api.edq.com/capture/address/v2/search?…&auth-token=7d7cd1d0-…` is
**Experian Data Quality address autocomplete** — a generic UK postal-address
typeahead that powers the locator's "enter your postcode" box. Searching
"luton" returns `Lutonia, 19 Dumpton Park Drive, Ramsgate` — it has no
knowledge of BMW dealers and cannot map a retailer ID to anything.

Two reasons not to use it, either way:
1. **The auth token is someone else's live credential**, scraped from a page
   — a paid, per-lookup, rate-limited Experian account belonging to BMW or
   its agency. Calling it from our backend is billing them for our traffic.
2. **We don't need address lookup at all.** The anchor postcode comes from
   the dealer directory; the distance maths is done by BMW's own
   `sort=distance`. Nothing in this feature converts free-text to an address.

Note we also never need the `latitude`/`longitude` for the carousel — the
distance is the platform's own figure. Coordinates are a bonus if we ever
want a map.

## Implementation plan

### 1. `server/dealers.js` — new: the dealer directory client

A small module of its own; it talks to a different host than `stock.js` and
has a different lifetime.

- `fetchDealerDirectory()` — GET the Cloud Run `/proxy/api/dealers`, parse,
  and index into a `Map` keyed by `String(dealer_number)`. Fetched once and
  memoised for the process lifetime (a dealer's address doesn't move; the
  upstream sets `max-age=60` but we don't need it that fresh).
- `lookupDealer(dealerNumber)` → `{ postcode, latitude, longitude, name }`
  or `undefined`.
- Uses `node:https` (Node 16 has no global `fetch` — see Verification).
- ~2MB response: parse once, keep only the fields we use, let the raw body
  go. Don't hold 1,131 full records in memory for four fields each.

### 2. `server/stock.js` — add nearby fetching

Additions only; the existing `fetchGrassickStock(retailerSite)` path,
CSRF handshake, retry and per-retailer TTL cache stay exactly as they are.

- `resolveRetailerPostcode(retailerSite)` — fetch page 1 of
  `?retailer_site=<id>`, read `retailer_site.dealer_number` off any vehicle,
  then `lookupDealer()` it against the directory. Cache in a `Map` keyed by
  retailer ID, no TTL. Throw `StockUnavailableError` if the retailer has no
  stock, carries no dealer_number, or isn't in the directory.
- `fetchNearbyStock(retailerSite)` — resolve the anchor postcode, then
  fetch `NEARBY_PAGES` (default 4) pages of
  `?location=<postcode>&sort=distance&size=100&…`, map each vehicle via
  `mapVehicle`, and **drop vehicles whose `retailer_site.id` equals the
  anchor** (decision 2). Cache per-retailer under the existing
  `STOCK_TTL_MS`, in a cache separate from the by-retailer one.
- Both new calls reuse `fetchPageWithRetry`'s 403-rebootstrap behaviour.

New env knobs, matching the existing style: `NEARBY_PAGES` (default 4),
`NEARBY_PAGE_SIZE` (default 100).

### 3. `server/mapping.js` — carry distance through

`mapVehicle` currently drops `retailer_site.distance`. Add to the returned
object, alongside the other display-only fields:

- `distance: num(v?.retailer_site?.distance)` — miles, `undefined` when the
  feed omits it (i.e. every non-`sort=distance` call, so the existing
  by-retailer path is unaffected).
- `retailerId: v?.retailer_site?.id` — needed to exclude the anchor.

### 4. `server/engine.js` — separate the two rankings

`matchCars(answers, cars)` currently returns
`{ matches: ranked.slice(0,3), contenders: ranked.slice(3,6) }`.

- Drop `contenders` from the return.
- Export the existing ranking internals so a second, independent ranking
  pass can run over the nearby pool: `rankCars(answers, cars)` returning the
  full sorted array, with `matchCars` becoming a thin
  `rankCars(...).slice(0,3)` wrapper. Pure refactor, no scoring change.
- `server/test/engine.test.js` asserts on `contenders`; update those cases
  to the new shape and add coverage for `rankCars` over a mixed-retailer
  pool.

### 5. `server/index.js` — `/api/match` returns `nearby`

- Fetch the anchor's stock and the nearby pool **concurrently**
  (`Promise.all`), so the extra 4 pages don't serialise behind the existing
  fetch on a cold cache.
- Rank each pool independently: hero = top 3 of the anchor's stock (as
  today), `nearby` = top 3 of the nearby pool.
- Response shape: `{ matches, nearby }` — `contenders` is **removed**, not
  deprecated in place (this is a POC; nothing external consumes it).
- `publicCar()` gains `distance` and `retailerName` passthrough
  (`retailerName` is already there). **`retailerId` is deliberately not
  exposed** — it's only used server-side for the exclusion filter, and the
  existing comment on `publicCar` is explicit that internal fields stay out
  of responses.
- **Nearby failure must not fail the request.** If the nearby fetch throws
  while the anchor fetch succeeded, return `matches` with `nearby: []` and
  let the block simply omit the section. A live-stock outage on the primary
  path still returns the existing friendly 502.

### 6. `blocks/bmw-matcher/bmw-matcher.js` — the carousel

- Delete the `contenders` block in `renderResults` (the `bmwm-subhead` +
  `bmwm-contenders` chip strip).
- Add `nearbyCard(match)` — a compact tile reusing the existing card
  anatomy (photo, line label, name, score badge, price) but **without** the
  reasons list and blurb, plus a new distance line:
  `<span class="bmwm-distance">19.5 miles · John Clark Tayside</span>`.
  Round to 1dp; omit the tile's distance line entirely if `distance` is
  `undefined` rather than printing a bare unit.
- Section heading: **"Worth the drive"**, with a lede that names the anchor
  (`ctx.retailerLabel` is already threaded through) — e.g.
  *"Three more that fit, a short drive from Grassicks BMW."* Final copy to
  follow `docs/tone-style-guide.md`.
- Render into a scroll-snap carousel track; keep the existing
  `View at <retailer> ›` CTA per tile, which already links to the right
  retailer's PDP via `car.link`.

### 7. `blocks/bmw-matcher/bmw-matcher.css` — carousel styles

- Remove `.bmwm-contenders`, `.bmwm-contender`, `.bmwm-contender-score`
  (lines ~369–382).
- Add `.bmwm-nearby` (track: `display: flex; overflow-x: auto;
  scroll-snap-type: x mandatory; gap: var(--bmwm-space-4)`),
  `.bmwm-nearby-card` (`flex: 0 0 clamp(240px, 72vw, 300px);
  scroll-snap-align: start`), and `.bmwm-distance`.
- Reuse existing tokens only (`--bmwm-space-*`, `--bmwm-accent`,
  `--bmwm-font-bold`) per `docs/design-tokens.md`; no new colours.
- Desktop: 3 tiles fit without scrolling; mobile: one-and-a-peek to signal
  swipeability. Hide the scrollbar but keep keyboard/AT access — the track
  gets `role="region"` + `aria-label` and `tabindex="0"` so it's reachable
  without a pointer.

## Risks & open questions

- **Cold-cache latency.** The nearby path adds one ~2MB directory fetch
  (once per process) + 4 list pages on top of the existing 3. Mitigated by
  `Promise.all` and the caches; if the first submission feels slow, drop
  `NEARBY_PAGES` to 2 (still reaches ~3 retailers from Perth).
- **The dealer directory is an undocumented third-party host.** It's a
  Cloud Run URL scraped from BMW's own locator, and the hostname says
  `-develop-` even though BMW's production page iframes it (verified: no
  `-prod`/`-production` sibling exists; that host *is* production). It could
  move or lock down without notice. Contained to `dealers.js`, fails soft
  (no carousel, hero results unaffected). Two documented fallbacks: PDP
  scraping (verified, same answer), or a one-row DA config addition
  ("Retailer Postcode"). Don't build either until needed.
- **Be a polite client of it.** ~2MB per fetch, memoised per process, so a
  long-lived server hits it once. Don't move it inside the request path or
  re-fetch per quiz submission.
- **Urban anchors will differ.** From Perth, 4 pages spans 5 retailers over
  31 miles. In London, 400 nearest cars may cover far fewer retailers in far
  fewer miles — "worth the drive" may show tiles 3 miles away. Fine
  editorially, but worth eyeballing with `?retailer=` on the harness before
  calling this done.
- **Thin nearby pools.** If hard filters (budget, seats) cut the nearby pool
  below 3, render what we have; the section is `nearby.length ? … : null`.
  Should the section show 1 tile, or hide below a threshold? Suggest render
  what exists — an honest single option beats a hidden section.

## Verification

`docs/live-stock-plan.md` notes local Node is 16 (no global `fetch`, can't
run the test runner) — new server code must stay on `node:https`, and tests
run in CI. Beyond that:

1. `?retailer=96` on the harness → hero = Grassicks, carousel = John Clark
   Tayside / Arnold Clark Kirkcaldy / Douglas Park Stirling at ~19–25 mi.
2. Confirm **no Grassicks car appears in the carousel** (decision 2).
3. Confirm distances are non-zero, plausible, and match the table above.
4. `?retailer=51` (Sytner Luton) → different anchor, sane distances,
   proving nothing is hardcoded to Perth.
5. Kill the nearby fetch (bad `NEARBY_PAGES`/offline) → hero results still
   render, carousel silently absent.
6. Point `dealers.js` at a dead host → same soft failure, hero unaffected.
7. Mobile viewport → carousel swipes, one-and-a-peek; keyboard reaches it.

Unit-testable without network (worth doing, given the join is the crux):
`dealer_number` → postcode lookup against a fixture of a few directory
records, including a retailer absent from the directory.

## Built

Implemented as planned, with these deltas worth knowing:

- **`matchCard(match, { big, compact })`** — the carousel tile reuses the hero
  card rather than a separate `nearbyCard()`. `compact` trades the blurb,
  reasons and the 0-62/economy specs for a distance line.
- **Compact names are clamped to two lines at 16px.** Most feed names are ~24
  chars, but a minority are raw Auto Trader dumps up to 80 ("BMW 1.5 118i Sport
  Hatchback 5dr Petrol Auto Euro 6 (s/s)") which took four lines and still
  clipped at the hero card's 24px. No `title` tooltip: ~6% of feed names
  (21/352 near Perth) arrive *already* truncated with an ellipsis from BMW, so
  a tooltip would promise a full name we don't have.
- **`fetchNearbyStock` throws on an empty pool** rather than caching it. An
  empty result means the 400 nearest cars were all the anchor's own — not
  plausible — so it's a broken feed, not "no neighbours".
- **`Promise.allSettled`, not `Promise.all`** in `handleMatch`: the hero
  matches must survive a nearby failure.

### Verified against the live feed

| Check | Result |
|---|---|
| Anchor resolution (96) | `dealer_number 11107` → `PH1 3GA` |
| Nearby pool, Perth | 352 cars / 4 retailers, 18.1–33.1 mi |
| Nearby pool, Luton (51) | 298 cars, Stevenage 10.8 / Tring 9.9 / MK 15.5 mi |
| Anchor excluded | yes, both anchors |
| Hero cards carry distance | no (correct — they're the anchor's own stock) |
| `retailerId` leaked to client | no |
| Directory dead (`DEALER_DIRECTORY_URL` → 404) | HTTP 200, 3 hero matches, `nearby: []`, one warning |
| Engine tests | 12/12 pass |

Note the distances differ slightly from the research table above: the anchor is
now Grassicks' real postcode `PH1 3GA` (from the directory), not the `PH1 1RA`
town-centre postcode used while probing.

### Known follow-up

The nearby pool spans model lines the anchor doesn't stock, so `mapping.js`
logs `no MODEL_SPECS for line "X3M" / "X5 M" / "6 Series" / "i3 Series"` and
falls back to `DEFAULT_SPEC` — those cars score on approximate boot/seats/0-62.
Pre-existing gap, widened by this feature. Tracked separately.
