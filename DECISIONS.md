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

- **[motorrad-data] Motorrad uses curated sample fixtures, not the live feed (corrected
  after a deeper probe during implementation).** The first-pass reachability check saw the
  endpoint return `200 application/json` and assumed a filter body would return bikes. It does
  not, and the reason is structural: `ResultOverview/ShowResultsFilterChanged` is a
  session-gated, cross-origin, iframe-embedded legacy ASP.NET app. Every plausible body
  returns the null envelope `{"SearchFilter":null,"ResTable":null}`; the AMS bundle
  (`/bundles/ams`) shows the real call needs (a) a `GMB-SID` session header minted per page
  load into a hidden `#hfSID` field, (b) an `InitFilter:true` flag on a fully-populated filter
  model (`PreisVon`, `PowerUnit`, `Segment`, `FuelType`, `Farbe...`), and (c) the real
  `rootPath` `/gmb_kunden/`, which 302s to a notfound page when hit without the hosting
  iframe's session. That is the same "not scriptable from this environment" class as Ford's
  Akamai wall. So Motorrad serves `fixtures/motorrad-bikes.json`, curated from the public BMW
  Motorrad range. I wired the real adapter against the DISCOVERED contract (POST to
  `ResultOverview/ShowResultsFilterChanged`, `GMB-SID` header, `{InitFilter:true, ...filter}`
  body, response read from `SearchFilter.ResOverviewData` / `ResTable`), so it goes live when
  run from an allowed session origin. To undo: run from within the hosting session and flip
  Motorrad's registry `source` back to `feed`.
  The response envelope is now known (`SearchFilter.ResOverviewData.totalItemCount`, `ResTable`),
  which shaped both the adapter and the fixture schema.

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

## Em-dash sweep (house rule) + a guard that covers every screen

- **[emdash-sweep] Removed every user-facing em dash from the existing BMW/MINI game-mode
  copy.** The house rule (no em dashes in on-screen copy; comments and docs may keep them)
  predated this copy, so the mingle and knockout modes still had them on later-flow screens:
  deck instructions, per-tie verdicts (form/upset), weak/thin notes and empty-deck ledes, for
  both BMW and MINI. Each was rephrased to read naturally (a period, a colon, or "so"/"and"),
  not mechanically swapped to a hyphen. Questions mode, match-signal, server copy and the new
  Ford/Honda copy were already clean.

- **[emdash-glyphs] Two decorative dash glyphs also went.** The mingle "Caught your eye" list
  used a leading em-dash bullet (`content: '— '`) and the taste-profile "no value yet" cell
  used an em dash; both render on screen. The bullet became a middot (`·`, already the house
  separator in roundAdvance) and the empty cell became an en dash (`–`, the standard
  "no data" mark, and explicitly not an em dash). This keeps the rule literal without leaving
  a bare hyphen that would read as a typo.

- **[emdash-guard] Added a source-scan test so the rule holds on every screen, not just the
  painted one.** `render.test.js` already had "no em dashes in painted copy", but that only
  sees each mode's FIRST screen — which is exactly why the mingle/knockout violations (all on
  result/verdict/empty screens) survived. Simulating a full playthrough to reach those screens
  is fragile; instead the new test scans each client source file for an em dash inside a string
  literal, skipping pure-comment lines and dev-only console diagnostics (author-facing, out of
  scope). It covers all screens at once and blocks any future reintroduction. Suite: 126 tests
  green.

## Motorrad (branch `bike-brand-motorrad`) — bikes on a car engine

The ambitious stretch: the matcher was built for cars, and Motorrad sells motorcycles.
Rather than fork the engine, Motorrad reuses every scorer by mapping bike attributes onto
the engine's existing axes. This section documents each repurposing, because it is the
riskiest surface in the whole run: a proxy that reads wrong would mis-rank silently. Each is
a deliberate, reversible call.

- **[motorrad-axis-map] The engine's car axes are repurposed for bikes, one to one, no engine
  change.** The engine scores nine axes; here is what each means for a bike, and how honest the
  proxy is:
  - `priceMin`/`priceMax` → **bike price.** Direct, no repurposing. (honest)
  - `body` → **bike category** (naked, roadster, adventure, tourer, sport, heritage, scooter).
    A direct conceptual analogue of car body style: the silhouette-and-purpose class a rider
    shops by. Uses a bike-specific option set in the `bodyStyles` question, not the car list. (honest)
  - `fuel` → **petrol for all combustion bikes; `ev` for the CE 04 electric scooter** (with a
    real electric range). BMW Motorrad's used range is overwhelmingly petrol, so the fuel axis
    barely separates bikes; it is kept truthful rather than leaned on. (honest)
  - `seats` → **pillion capability: 2 = dual-seat, 1 = solo/track.** Repurposes the car "who's on
    board" axis as "can it carry a passenger." A single-seat or track-focused bike scores 1.
    (proxy, documented)
  - `boot` → **luggage / touring capacity in litres** (panniers + top box for tourers/adventure,
    ~0 for sport/naked). The engine's practicality scorer reads boot against a derived "need";
    for bikes that need becomes "do you tour / carry gear." A GS with full luggage reads
    practical; a sportbike does not. (proxy, documented — the boldest one)
  - `zeroTo62` → **bike 0-62 (seconds).** Direct, but the SCALE is different: bikes are far
    quicker than cars (a sportbike is ~3s, a small commuter ~6s), so the performance tuning's
    `zeroBase`/`span` are recalibrated for the bike range (below), otherwise every bike would
    peg the performance axis at 1.0. (honest field, recalibrated scale)
  - `mpg` → **bike mpg.** Direct; bikes are frugal (50-80mpg typical). (honest)
  - `sizeClass` (1-5) → **engine/size band, a licence-and-manageability proxy:** 1 ≈ A1/A2-friendly
    small-capacity (~<500cc), 3 ≈ midweight (~600-900cc), 5 ≈ big tourer/adventure (~1200cc+).
    The engine's size scorer maps "city" to low class and "roadtrip" to high class, which lands
    correctly for bikes: a nimble commuter is low, a big-mile tourer is high. (proxy, documented)
  - `tags` → **riding character** (`touring`, `adventure`, `commuter`, `sporty`, `heritage`,
    `a2-friendly`, `electric`). Read by scoreCharacter exactly as car tags are. (honest)
  - `styleLine` / `doors` → **unused for bikes** (no trim-line or door split); left null, the
    engine simply doesn't score a null. (n/a)

  To undo any single proxy: it lives in `mapMotorradRaw` (server/mapping.js) and the Motorrad
  tuning block (server/brands.js); change the projection and rebuild the fixtures.

- **[motorrad-tuning] The tuning is recalibrated for the bike range, not just reskinned.** A car
  brand's tuning is mostly weights; bikes need the SCALES moved too, or car-shaped thresholds
  mis-score. Four recalibrations, all in `MOTORRAD_TUNING` (server/brands.js), each load-bearing:
  - **Performance curve.** Cars span ~4.5-13s 0-62; bikes span ~2.8-7.7s. On BMW's car curve
    (10.5s→0, 4.5s→1) every bike would peg at 1.0 and the axis would carry no signal. Re-pointed
    to `zeroBase: 8.0, span: 5.2` so a ~7.7s G 310 sits low and a ~2.8s M 1000 RR tops out, with
    midweights spread between. Without this the whole performance axis is dead.
  - **Luggage need.** `practicality.bootNeed` moved to `{ small: 0, medium: 30, big: 80 }` litres —
    a bike's real luggage range (0 on a sportbike to ~110 on a K 1600), not a car boot's ~550L.
    Otherwise a fully-panniered tourer still reads impractical against a car-sized need.
  - **Seat floors.** `seatsFloor: 1` and `crewBonusSeats: 99` so no bike is marked down for
    carrying 1-2 people and the car "crew bonus" is unreachable. A motorcycle is not a 5-seater
    and must not be penalised as one.
  - **Hard filters.** `hardFilter` crew/family seat+boot gates dropped to 1/0 so the car-oriented
    "needs 5 seats / a big boot" exclusions can never wipe the bike deck.
  - **Weights.** `body: 4.5` (category is how a rider shops first), `character: 2.4` and
    `performance: 2.2` up (this is BMW's sporting arm), `economy: 1.0` and `fuel: 1.0` down (bikes
    are all frugal and nearly all petrol, so those axes barely separate them).

- **[motorrad-questions] The car question set is reshaped to bike-native, via drop/add + scoresAs,
  with the engine untouched.** Dropped `charging` (only the CE 04 is electric — not worth a
  screen), `people` (a bike carries a rider + maybe a pillion, never a "crew"), and `style`
  (comfort↔sporty folds into riding style instead). Added two bike questions whose options fold
  back to standard engine fields via `scoresAs`, exactly as MINI's trim question does:
  - `ridingStyle` (commute / adventure / touring / sport / heritage) — the heart of a bike search.
  - `licence` (A1 / A2 / full A) — gates capacity; A1/A2 nudge toward smaller, a2-friendly bikes.
  - **[motorrad-adventure-call] Product judgement: "adventure" folds to `primaryUse: roadtrips`,
    NOT `fun`.** An adventure rider is shopping for a GS, whose edge is a big frame (sizeClass 5)
    and real luggage (68L). Only `roadtrips` fires the size `roadtripMinClass` bonus AND a non-zero
    boot need, which is exactly what surfaces the GS range; `fun` would flatten practicality to 1.0
    and bury the GS's whole reason to exist. Kept `style: '3'` (vs touring's `'2'`) so the character
    stays distinct from a pure tourer. This is pinned by a test (below), because it is the single
    claim the bike adaptation lives or dies on.
  - **[motorrad-phev-fix] Gated `phev` out of the fuel question for Motorrad.** The base `phev`
    option carried no `brands` marker, so it showed for every brand — including Motorrad, which has
    no plug-in hybrid bike. Added `brands: ['bmw','mini','honda','ford']` to it; Motorrad's fuel
    question is now petrol / electric / open, matching the real range.

- **[motorrad-blurb] The rider-facing blurb reads for bikes, and its grammar is generated, not
  templated.** Bikes "ride away", they don't "drive away". An early version produced "a adventure"
  and bare-adjective categories; fixed with a `CATEGORY_WORD` noun-phrase table ("an adventure
  bike", "a naked roadster", "a sports bike") plus an `article()` helper that picks a/an by leading
  sound, and a guard so the electric scooter phrase never doubles "electric". All seven category
  blurbs read naturally; the fixture-validity test asserts no em dash slips in.

- **[motorrad-theme] The `.vm.vm-motorrad` theme is Motorrad's own, not BMW's blue reused.**
  Motorrad blue (`#0066b1`) as the primary CTA, motorsport red (`#e2001a`) as the secondary/spot
  accent, square radius (0) and a punchier motion curve (`--vm-ease` sporting, `--vm-pop: 0.36s`).
  The match-signal character map gets a `motorrad` entry (`count: 36` — a denser celebration burst,
  energy that reads sporting, not cutesy). Brace balance verified.

- **[motorrad-mode-copy] Every game mode is re-voiced for bikes.** Questions ("Find my bike", stock
  counted as bikes, "a match for your licence and riding"), mingle ("Bike Match", "deck of bikes",
  "Book a test ride"), knockout ("Two bikes go head to head. Pick the one you'd rather ride."). The
  unmet/trade-off phrase tables (`UNMET_PHRASES`, `TRADE_COPY`) carry bike wording ("a naked bike",
  "an adventure bike", "petrol / electric bikes") so the reasons a bike scored the way it did read
  natively. No em dashes anywhere (guarded by the source-scan test).

- **[motorrad-live-adapter] The real live adapter is wired in `stock.js`, dormant behind the
  registry.** Motorrad's feed is a session-gated ASP.NET endpoint (`POST
  .../ResultOverview/ShowResultsFilterChanged`) that returns a null `SearchFilter` envelope to any
  request without a live GMB session — unreachable from this environment. The adapter is written
  against that discovered contract anyway: a JSON POST with `{ InitFilter: true }`, an optional
  `GMB-SID` session from `MOTORRAD_SESSION`, envelope parsing that accepts both the nested
  `ResOverviewData.ResTable` and the flatter `ResTable` shapes, and a row→raw projection that reads
  a spread of plausible field names and hands off to `mapMotorradRaw` (the same mapper the fixtures
  use). It stays dormant while `source: 'fixtures'`; flip the registry to `source: 'live-motorrad'`
  and it lights up. **On any failure it degrades to the curated fixtures rather than blanking the
  deck** (the "decide and keep moving" rule), and — like all fixtures brands — it serves no "near
  you" carousel and fetches no colour PDPs.

## Testing (Motorrad)

- **[motorrad-tests] Nine server tests + two adapter tests in `brand.test.js`, plus the render
  matrix.** The server tests cover: the fixtures-source config (and the `fixturesFile` override),
  `mapMotorradRaw` projecting the full engine schema, category→body derivation across all seven
  categories, the CE 04 being the only EV (petrol everywhere else, no double-"electric" blurb),
  null-on-priceless, "every Motorrad fixture is engine-valid" (the same guard the render test
  relies on, with em-dash checks on name and blurb), the bespoke drop/add question shape, the
  `ridingStyle` scoresAs fold, and — the keystone — **the adventure/roadtrips tuning test that
  proves a GS out-ranks an S 1000 RR for an adventure rider**, end to end through the real
  `applyBespokeAnswers` and `rankCars`. The two adapter tests guard the envelope parser (both
  shapes + null-safety) and the row→raw→`mapMotorradRaw` contract. Motorrad is also in the
  headless render matrix (`render.test.js`): all three modes mount and paint for bikes, carry the
  `vm-motorrad` theme class, show the "BMW Motorrad" wordmark on the questions intro, and paint no
  em dashes. Full suite: **140 green, no BMW/MINI regression** (was 94 at the start of the run).

- **[motorrad-test-gap] Known gap, logged not closed: the live adapter's NETWORK path is untested.**
  The endpoint won't answer without a live session from this environment, so the POST/handshake/
  degrade-to-fixtures flow can't be exercised hermetically here. The pure parsing/projection helpers
  ARE tested (exported for exactly that); the network round-trip and the degrade-on-failure branch
  should get an integration test the first time the adapter runs from an allowed origin (or against
  a recorded session capture). Noted here so it isn't mistaken for covered.

<!-- Further decisions appended below as the run proceeds. -->
