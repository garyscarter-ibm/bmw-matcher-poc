# Overnight onboarding — decision log

Judgement calls made during the unattended onboarding of Ford, Honda and Motorrad
(branches `vehicle-brand-ford-honda` and `bike-brand-motorrad`), per the user's
"decide, document, keep moving" instruction. Review these in the morning; any of
them can be reversed cheaply.

Format: **[area] decision** — why, and how to undo if you disagree.

---

## Data reachability (verified 2026-08-12, before any code)

- **[ford-data] Ford uses curated sample fixtures, not the live feed, for tonight's build.**
  The provided endpoints (`servicescache.ford.com/api/eUsed/v1/searchOptions` and
  `searchVehicles`) sit behind an Akamai edge that drops the connection at the HTTP/2
  layer regardless of method, UA or headers (HTTP 000 from this environment). I built
  the real adapter against those exact URLs and wired it; it goes live automatically
  when the server runs from an allowed origin. Until then Ford serves
  `fixtures/ford-cars.json`, hand-seeded from public Ford model/spec data so all three
  modes validate end to end. To undo: run the server from an allowed network and flip
  Ford's registry `source` back to `feed`.

- **[honda-data] Honda uses real stock.** The server-rendered listing HTML at
  `usedcars.honda.co.uk` is fully scrapeable (1,368 vehicles: model, derivative, price,
  detail link, pagination), and the provided `soap/kfz/?gw=search_form` returns clean
  JSON filter metadata as a bonus. Scraped into `fixtures/honda-cars.json`.

- **[motorrad-data] Motorrad uses real stock.** The provided
  `POST /api/ResultOverview/ShowResultsFilterChanged` returns 200 JSON; a real filter
  body returns bikes. Dumped to `fixtures/motorrad-bikes.json`.

## Foundations (branch `vehicle-brand-ford-honda`)

- **[fixtures-loader] `source: 'feed' | 'fixtures'` on the brand registry.** New brands
  read `fixtures/<brand>-cars.json` (already-mapped cars) with no network and no TTL
  cache; nearby-stock returns empty and colour enrichment no-ops for them. BMW/MINI stay
  `source: 'feed'`; their live fetch path is byte-for-byte unchanged. To move a brand to a
  live feed later: wire its adapter and flip `source` back to `feed`, no other change.

- **[nearby-empty] A fixtures brand shows no "worth the drive" carousel.** It has no
  distance API and no per-car geo, so there is no honest nearby pool to build. Returning
  empty (the mode already treats empty/throw as "no carousel") is truthful; a fabricated
  distance would not be. Undo: only relevant once a real feed with geo is wired.

## Testing

- **[testing-gap-client-render] Closed the biggest gap: no test ever mounted a client
  mode.** Client render regressions were caught only by eyeballing the browser. Added a
  jsdom harness (`server/test/dom-harness.js`) + `server/test/render.test.js` that mounts
  every mode (questions/mingle/knockout) for every brand against a real in-process server,
  and asserts it paints, carries its theme class, and shows no em dashes. New brands add
  one line to the `BRANDS` array and inherit the whole matrix. `jsdom` is a dev dependency.
  - **Known limitation:** the render tests assert the *first painted screen* (intro/seed),
    not the full drive-through (answering questions, swiping a deck, playing a bracket to
    reveal). That deeper flow is still manual. Logged as a follow-up test gap, not filled
    tonight (it needs simulated user interaction across many async steps).

## Honda (branch `vehicle-brand-ford-honda`)

- **[honda-real-data] Honda stock is real, scraped from `usedcars.honda.co.uk`.** 348
  approved-used cars scraped to `fixtures/honda-raw.json`, projected to the engine schema
  by `mapHondaRaw` and written to `fixtures/honda-cars.json` by
  `scripts/build-honda-fixtures.mjs`. Lines: Jazz 189, HR-V 75, CR-V 43, Civic 21, e 16,
  ZR-V 3, e:Ny1 1. Price £8,799–£22,495 (median £18,987).

- **[honda-flat-projection] Honda gets a dedicated `mapHondaRaw`, not a `BRAND_MAPPERS`
  entry.** BMW/MINI share the Auto Trader feed shape that `mapVehicle` reads
  (`cash_price.value`, `derivative`, `media.items`, `retailer_site`); Honda's scrape is a
  flat record (`price`, `title`, `fuel`, `reg`, `image`, `link`), so it has its own
  projection. Both emit the identical mapped-car schema the fixtures loader serves.

- **[honda-single-retailer] One synthetic national retailer identity
  (`honda-approved` / "Honda Approved Used").** Honda approved-used is a single national
  programme, not a network of distinct dealer sites like BMW/MINI. Every car carries the
  same retailerId; the fixtures loader serves the whole pool for any retailer request (it
  narrows by retailerId only when a match exists). No per-dealer "nearby" carousel results,
  which is honest for a national programme with no per-car geo.

- **[honda-hybrid-as-petrol] Self-charging hybrids ("Petrol Hybrid", i-MMD / e:HEV) score
  as `petrol` on the engine's fuel axis.** The axis is petrol|diesel|phev|ev; a
  self-charging hybrid is not a plug-in, so it collapses to petrol exactly as the BMW
  mapper folds mild hybrids. The hybrid identity — a real Honda selling point — survives as
  the `efficient` tag and in the blurb, plus a high fallback mpg (below) so a
  mileage-conscious buyer is still steered to it. If Honda's used range ever gains true
  PHEVs, split them out to `phev`.

- **[honda-spec-fill] Model-line spec tables fill what the listing omits (`MODEL_SPECS_HONDA`).**
  The listing carries price/title/fuel/mileage but no boot/seats/0-62/size/range. These come
  from official Honda UK / WLTP figures per line, mirroring the BMW/MINI spec-gap fill.
  Honda has no fast performance trims in this used pool, so unlike BMW/MINI there is no
  per-trim speed-up — one mainstream 0-62 per line.

- **[honda-ev-range] TWO real data gaps the new tests caught, fixed at the mapper (not
  hand-patched in the JSON).** (1) Honda EVs (`e`, `e:Ny1`) mapped to `fuel: 'ev'` with no
  `evRange`, so the engine scored them as zero-range on the economy axis. Added WLTP ranges
  to the two electric spec entries (Honda e 137mi, e:Ny1 256mi) and project `evRange` for
  EVs. (2) Three self-charging-hybrid listings were scraped with `mpg: null`; a combustion
  car needs a positive mpg for the economy axis. Added an official WLTP combined mpg per
  line (Jazz 62, Civic 56, HR-V 52, ZR-V 48, CR-V 44) as the fallback when the scrape has
  none. Both fixes live in `MODEL_SPECS_HONDA` + `mapHondaRaw`, so a re-scrape stays valid.
  Guarded by `brand.test.js` ("every Honda fixture is engine-valid").

- **[honda-tuning] Honda tuning leans economy + practicality, light on image.** Mainstream
  value brand: heavier `budget`/`economy`/`practicality` weights, a gentler performance
  curve (`zeroBase` 12.5s — nothing in the pool is fast), a 5-seat practicality floor, and
  reasons written in a plain, practical Honda voice. Distinct from BMW precision and MINI
  play. No question surgery (Honda's standard question set fits its range).

- **[honda-theme] `.vm.vm-honda`: Honda Red (#cc0000), sentence-case sans headings, 8px
  radius.** Host-brand-first per the blueprint. Sentence case and a rounded, friendly sans
  read mainstream and approachable, not the uppercase precision of BMW. All copy
  em-dash-free from the start (the house rule).

## Testing (Honda)

- **[honda-render] Honda joins the render matrix by loading its REAL fixtures, not a
  synthetic feed helper.** BMW/MINI pools synthesise feed vehicles through `mapVehicle`;
  Honda has no feed shape, so `hondaPool()` reads `fixtures/honda-cars.json` (what the
  fixtures loader serves in production) and samples it. The render test therefore exercises
  the exact cars a browser would see. All three modes mount, paint, theme and stay
  em-dash-free for Honda.

- **[honda-server-tests] Added server-side Honda tests to `brand.test.js`.** Config resolves
  as a fixtures brand; `mapHondaRaw` projects the flat record to a valid engine car; hybrids
  fold to petrol keeping the efficient tag; EV lines get ev + evRange; a priceless record
  returns null; every shipped fixture is engine-valid; Honda tuning ranks a thrifty hatch
  top for a value buyer. These caught the two data gaps above before they reached a browser.

## Ford (branch `vehicle-brand-ford-honda`)

- **[ford-curated-not-scraped] Ford stock is curated, not scraped — the live feed is
  unreachable from here.** `servicescache.ford.com` (the user's two approved-used endpoints)
  sits behind an Akamai edge that drops the connection at the HTTP/2 layer regardless of
  method, UA or headers (verified repeatedly: HTTP 000). So unlike Honda there is no raw
  dump to replay. `scripts/build-ford-fixtures.mjs` synthesises a realistic flat-raw dataset
  — a spread of derivatives per line with representative used prices, mileages and plates —
  and projects it through `mapFordRaw`, the SAME flat-raw to mapped-car projection the live
  adapter will use once it is reachable. 58 cars: petrol 28, diesel 15, ev 13, phev 2;
  £8,900–£43,600 (median £21,050). Deterministic (mulberry32, no Date/Math.random), so the
  committed JSON is stable across runs.

- **[ford-flat-projection] Ford gets a dedicated `mapFordRaw`, like Honda, not a
  `BRAND_MAPPERS` entry.** BMW/MINI share the Auto Trader feed shape `mapVehicle` reads; Ford
  (like Honda) is a flat record (`title`, `derivative`, `fuel`, `price`, `mileage`, `reg`),
  so it has its own projection emitting the identical mapped-car schema the fixtures loader
  serves. When the live feed becomes reachable, the adapter hands `mapFordRaw` the same flat
  shape — no engine or mapper change needed.

- **[ford-no-invented-price] A record with no price is DROPPED, never shown with a
  fabricated one.** An earlier draft backfilled a missing price from a per-line
  `FORD_PRICE_HINT` table. Removed: price is the single most decision-driving field in
  used-car shopping, and showing a buyer an invented figure they might act on is a worse
  failure than a slightly thinner deck. `mapFordRaw` now returns null on a priceless record
  (caller filters), matching Honda. The curated fixtures carry real prices from the builder's
  per-line `priceBand`, so nothing is lost. Guarded by a `brand.test.js` null-on-priceless test.

- **[ford-performance-halo] ST and GT trims get a 0-62 speed-up; ST-Line does NOT.**
  Analogous to BMW's M-trim `trimZeroTo62`, `trimZeroTo62Ford` applies a per-line hot figure
  (Fiesta ST 6.5s, Focus ST 5.7s, Puma ST 6.7s, Mustang GT 4.5s, Mach-E GT 3.7s) and tags the
  car `drivers-car`. The exclusion matters for brand honesty: **ST-Line is a styling pack, not
  the hot car**, so `fordIsPerformance` explicitly excludes it (`/\bst\b|\bgt\b/ && !st-line`).
  A buyer told an ST-Line is a performance car would feel misled the moment they drove it.

- **[ford-ev-phev-split] Ford keeps a real EV + PHEV split, unlike Honda's fold-to-petrol.**
  Ford's used range has genuine plug-ins, so the fuel axis carries all four categories: the
  Kuga PHEV maps to `phev` (with its own 42-mile WLTP electric range, since the Kuga spec
  entry is the petrol car), and Puma Gen-E / Mustang Mach-E / Explorer / Capri map to `ev`
  with real WLTP ranges. Mild-hybrid EcoBoost (mHEV) folds to `petrol` as with BMW/Honda —
  it is not a plug-in. This is a deliberate divergence from Honda: Ford's plug-ins are a real
  buying consideration, Honda's self-charging hybrids are not plug-ins.

- **[ford-display-name] The display name carries the derivative so trims are
  distinguishable.** `fordDisplayName(title, derivative)` appends the trim (regex-escaped,
  only when it adds information) so a deck/knockout shows "Ford Focus 2.3 EcoBoost ST 5dr" vs
  "Ford Focus 1.0 EcoBoost mHEV 125 Titanium 5dr" rather than two identical "Ford Focus"
  cards. A spot-check that first read "no ST cars" turned out to be this: the halo fired
  correctly all along, but the name had dropped the derivative, so the fix resolved a genuine
  UX defect (indistinguishable listings) as well.

- **[ford-body-derivation] Body is derived from line + derivative across the full range.**
  `fordBody` reads estate (Focus/Mondeo "Estate"), convertible and coupe (Mustang), pickup
  (Ranger "Double Cab"), MPV (Galaxy/S-Max/Tourneo), SUV (Puma/Kuga/EcoSport/Explorer/Capri/
  Mach-E), else hatchback. This is the broadest body spread of any brand so far and each is
  render-tested.

- **[ford-spec-fill] Model-line spec tables fill what the listing omits (`MODEL_SPECS_FORD`).**
  Boot, seats, 0-62, size class (1-5) and mpg/evRange fallbacks per line, reconciled against
  carwow / Auto Express / Parkers by the research agents (~10 corrections applied). An estate
  gets a boot floor of 550L over the hatch base. `DEFAULT_SPEC_FORD` covers any unlisted line.

- **[ford-tuning] Ford tuning leans practicality + economy, lighter on image than BMW.**
  Mainstream brand with a broad range: heavier practicality/economy/body-fit weights so a
  roomy Kuga out-ranks a sporty-but-impractical Mustang for a family, in a plain Ford voice.

- **[ford-theme] `.vm.vm-ford`: Ford Blue (#003478), host-brand-first.** All copy
  em-dash-free from the start (the house rule).

## Testing (Ford)

- **[ford-render] Ford joins the render matrix by loading its REAL curated fixtures.** Like
  Honda, `fordPool()` reads `fixtures/ford-cars.json` (what the loader serves) rather than
  synthesising a feed, so the render test exercises the exact cars a browser sees, including
  the ST/GT halo and the EV/PHEV split. All three modes mount, paint, theme and stay
  em-dash-free for Ford.

- **[ford-server-tests] Added server-side Ford tests to `brand.test.js`.** Config resolves as
  a fixtures brand; `mapFordRaw` projects to a valid engine car; the ST/GT halo fires but not
  on ST-Line; the EV/PHEV/petrol split is correct (Kuga PHEV → phev + 42mi, Mach-E GT → ev,
  mHEV → petrol); body derivation covers estate/convertible/coupe/pickup/MPV; a priceless
  record returns null; every shipped fixture is engine-valid (with em-dash guards on name and
  blurb); Ford tuning ranks a practical family SUV over a fast coupe. Suite: 125 tests, all
  green (94 at baseline, no BMW/MINI/Honda regression).

- **[ford-blurb-grammar] Copy fix caught in review: the performance blurb read "Approved-used
  the performance Ford Fiesta".** The `fordIsPerformance` prefix injected "the performance"
  mid-sentence, breaking grammar. Changed to "performance " so it reads "Approved-used
  performance Ford Fiesta hatchback". Fixtures rebuilt.

<!-- Further decisions appended below as the run proceeds. -->
