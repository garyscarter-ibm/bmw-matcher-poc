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
  _Superseded on contract detail by [motorrad-images-real-source] / [motorrad-images-gate] and then
  [motorrad-restable-is-html]: the JSON route is `/api/ResultOverview/...` (not `/UK/...`), auth is a
  `GMB-SID` **header** (not a cookie), the body needs `MarktId: 2`, and — the key correction — the
  envelope's `ResTable` is an HTML table string parsed by `motorrad-listing.js`, not a JSON array
  read by field name. The adapter in `stock.js` was corrected to match. This entry's high-level shape
  (dormant, degrade-to-fixtures, shared mapper) still holds._

## Testing (Motorrad)

- **[motorrad-tests] Nine server tests + two adapter tests in `brand.test.js`, plus the render
  matrix.** The server tests cover: the fixtures-source config (and the `fixturesFile` override),
  `mapMotorradRaw` projecting the full engine schema, category→body derivation across all seven
  categories, the CE 04 being the only EV (petrol everywhere else, no double-"electric" blurb),
  null-on-priceless, "every Motorrad fixture is engine-valid" (the same guard the render test
  relies on, with em-dash checks on name and blurb), the bespoke drop/add question shape, the
  `ridingStyle` scoresAs fold, and — the keystone — **the adventure/roadtrips tuning test that
  proves a GS out-ranks an S 1000 RR for an adventure rider**, end to end through the real
  `applyBespokeAnswers` and `rankCars`. The live-listing adapter tests (updated for the real HTML
  shape, see [motorrad-restable-is-html]) pin the parser against a captured `ResTable`
  (`test/fixtures/motorrad-restable.html`): `splitRows` isolating the result rows, `parseRow`/
  `parseResTable` field extraction (price, cc, leading-kW power, real `GetImg` photo, detail link),
  `motorradRowsFromEnvelope` routing a string `ResTable` at either envelope depth (plus the JSON-array
  resilience fallback and null-safety), the parse→`mapMotorradRaw` contract asserting every bike is
  engine-valid **with its real photo intact and no em dash in the blurb**, the model-line/category
  resolution for the five captured rows (nineT not collapsing to R 12 nineT; GS Adventure not
  defaulting to naked), and the `motorradDisplayName` sales-tail trim. Motorrad is also in the
  headless render matrix (`render.test.js`): all three modes mount and paint for bikes, carry the
  `vm-motorrad` theme class, show the "BMW Motorrad" wordmark on the questions intro, and paint no
  em dashes. Full suite: **150 green, no BMW/MINI/Ford/Honda regression** (was 94 at the start of the
  run).

- **[motorrad-test-gap] Known gap, logged not closed: the live adapter's NETWORK path is untested.**
  The endpoint won't answer without a live session from this environment, so the POST/handshake/
  degrade-to-fixtures flow can't be exercised hermetically here. The pure parsing/projection helpers
  ARE tested (exported for exactly that); the network round-trip and the degrade-on-failure branch
  should get an integration test the first time the adapter runs from an allowed origin (or against
  a recorded session capture). Noted here so it isn't mistaken for covered.
  _Update (see [motorrad-self-issuing-session]): the network path is now proven live from this
  environment via the self-issuing session, `parseMotorradSid` (the handshake seam) has a unit test,
  and `scripts/motorrad-live-probe.mjs` exercises the full cold round-trip. The remaining untested
  branch is the degrade-to-fixtures-on-failure path, which is still worth a hermetic integration test._

## Honda goes live

- **[honda-live] Honda is now a genuinely live feed, not fixtures.** The user's brief is "keep this
  as real and live as possible." Of the three fixtures brands, Honda is the one whose real inventory
  is reachable from this environment: `usedcars.honda.co.uk` server-renders its listing pages, so the
  adapter fetches them on demand, parses the cards, and maps them through `mapHondaRaw` — the exact
  same projection the committed snapshot went through. Registry flipped `honda.source` from
  `'fixtures'` to `'live-honda'`. Verified end to end this session: a real fetch returns ~96 cars,
  all with real prices, mileages, and `/picserver` photos, in valid engine schema.

- **[honda-live-shared-parser] One parser, two callers.** The parse logic (card split, spec
  extraction, price/image/reg pulls) is lifted verbatim into `server/honda-listing.js` and shared by
  both the offline scraper (`scripts/scrape-honda.mjs`) and the live adapter (`stock.js`). Pure, no
  network — callers fetch the HTML and hand it in. This means the live path and the snapshot path
  literally cannot drift in how they read a card. Exports: `parseListingHtml`, `parseCard`,
  `listingUrl`, plus the base/warranty constants.

- **[honda-live-degrade] On any fetch failure Honda degrades to the committed snapshot, not a blank
  deck** (the "decide and keep moving" rule). `hondaLiveStock` throws `StockUnavailableError` on a
  non-200 first page, a parse that yields nothing, or an empty pool; the dispatch catches it and
  serves `fixtures/honda-cars.json` (348 cars, all photo-bearing). So the worst case is stale-but-
  real stock, never an empty screen.

- **[honda-live-location] Honda's dealer filter is location-based (postcode + radius), NOT a
  dealer id.** Investigated and corrected an earlier assumption: the listing has no `dealer=<id>`
  facet (the `dealerID` in the page is an analytics blob; `DealerKey=WAY200` is a finance-widget
  key). The real "near me" facet is `zip` + `radius` (miles), verified live (`SW1A1AA&radius=10` →
  1 car vs `PH13GA&radius=10` → 12). `listingUrl(page, {zip, radius})` carries it; pagination is a
  `/pageN` PATH segment, not a query param.

- **[honda-live-nearby] Honda serves no "near you" carousel, by design.** The location facet narrows
  the MAIN pool honestly, but the carousel needs per-car distances and a distinct anchor dealer to
  rank "other dealers near you" — and Honda's cards carry neither (no per-car distance, one national
  "Honda Approved Used" retailer). Rather than fake a distance ranking, `fetchNearbyStock` returns
  `[]` for `live-honda`, exactly as it does for the other non-Auto-Trader brands. `enrichColours`
  also short-circuits: the listing already carries an "Exterior colour" per card, so there's no
  colour PDP to fetch.

- **[honda-live-tests] Four adapter tests added (144 green total, up from 140).** They pin the
  fragile seam — parsing real HTML — against a card in the site's true shape: `parseCard` reads one
  card (cash price beats monthly, mileage/fuel/doors/colour/year, absolute link + image);
  `parseListingHtml` keeps real cards and drops chrome; the parseCard → `mapHondaRaw` handoff is
  proven engine-valid (the live == snapshot contract); and `listingUrl` carries the warranty
  programme + the zip/radius facet with pages as a path segment. The existing config test was
  updated to assert `source: 'live-honda'`.

## Motorrad images: real source found, gated behind a browser session

- **[motorrad-images] Root cause of the missing images: the fixtures are synthesised per MODEL and
  never carried an image field.** `build-motorrad-fixtures.mjs` emits one raw record per (model,
  price, mileage) with no `image`, so every mapped bike had `photo: undefined`. The mapper already
  supports `photo` (reads `raw.image`); the data side just never populated it. Confirmed by data:
  honda-cars 348/348 have photos, motorrad-bikes 0/49.

- **[motorrad-images-real-source] The real per-vehicle photos live in the approved-used listing
  feed, and its contract is now fully reverse-engineered.** From the site's own Angular bundle:
  the feed is `POST /api/ResultOverview/ShowResultsFilterChanged` (ApplPath is "/", so the JSON
  route is under `/api/`, NOT the `/UK/...` path — that returns the HTML shell); it authenticates
  with a **`GMB-SID` request header** (read from the page's hidden `#hfSID` field, a base64 of
  `<caller-ip>;<guid>`); the body needs `MarktId: 2` (UK). Vehicle rows carry the photo as
  `ImageSrc` (overview) / `sliderImageLinks` / `ImageLinks` arrays. Verified live: with the correct
  route + header the endpoint returns real `application/json` (was HTML before), proving the
  contract.
  _Corrected by [motorrad-restable-is-html]: the JSON envelope's `ResTable` is itself an HTML table
  string, and the per-row photo is a `GetImg` URL on the `ChildImg` anchor — there are no
  `ImageSrc`/`sliderImageLinks`/`ImageLinks` array fields. The route/header/session findings hold._

- **[motorrad-images-gate] But the rows themselves are gated behind a live browser session.** Even
  with the correct route, a freshly-scraped SID (whose embedded IP matches our egress IP), the
  MarktId body, and browser-like headers, the endpoint returns `{"SearchFilter":null,"ResTable":null}`
  — the null envelope that means "no live session." The AngularJS app mints a valid session through
  an in-browser bootstrap sequence we can't replicate with `curl`/node. So the real photos are
  genuinely unreachable from this scripted environment. This is the same gate documented under
  [motorrad-data]; the added detail is that we now know the exact contract and that the block is the
  session bootstrap, not the route or the auth mechanism.

- **[motorrad-images-decision] User's call: capture the feed from a browser; do NOT substitute
  generic marketing images.** When asked, the user directed: use the real used-bike LISTING images,
  not the model/press shots from the public bmw-motorrad.co.uk site, and chose to capture the feed
  themselves. So we did NOT wire in the (reachable, official, but generic) per-model nav images from
  the brand site — that would misrepresent a marketing render as a used-listing photo. The honest
  state ships: Motorrad cards render photo-less until a real capture lands.

- **[motorrad-images-turnkey] Everything is staged so a capture is a one-step rebuild.** (1) The live
  adapter (`stock.js`) is corrected to the proven contract (route, `GMB-SID` header, MarktId body,
  and `motorradRowToRaw` now reads the real `ImageSrc`/`sliderImageLinks`/`ImageLinks` fields). (2) A
  new `scripts/build-motorrad-fixtures-from-capture.mjs` ingests a saved feed response (raw JSON or a
  HAR), runs it through the SAME production path (`motorradRowsFromEnvelope → motorradRowToRaw →
  mapMotorradRaw`), validates every bike is engine-valid, and writes `fixtures/motorrad-bikes.json`
  with real photos. Its header carries the exact browser capture recipe. When the user pastes a
  capture, the fixtures rebuild from genuine data + images with no further reverse-engineering.

- **[motorrad-images-degrade] Photo-less cards degrade cleanly, so shipping without images is safe,
  not broken.** The mode renderers guard with `if (car.photo)` and fall back to a `.no-photo`
  treatment with the model initial; a broken `img.src` self-heals via an `error` handler that removes
  the image and adds `.no-photo`. `photosFirst` sinks photo-less cars to the back of the field. So
  the Motorrad deck looks flatter than the photo-bearing brands but shows no broken-image icons and
  no empty media boxes.

## Motorrad images: the capture landed, and the real shape was not what we assumed

- **[motorrad-restable-is-html] Correction: `ResTable` is a server-rendered HTML table, NOT a JSON
  array of vehicle objects.** A real feed response, captured from a live browser session, settled
  the shape. The `SearchFilter` envelope's `ResTable` field is a `<table>` string — one `<tr
  class="… ergebnissColor">` per bike — with `totalItemCount: 963` alongside. Each row carries the
  real per-vehicle photo as `https://approvedused.bmw-motorrad.co.uk/api/Image/GetImg?imgId=<guid>`
  on the `ChildImg` anchor, plus cash price, mileage, first-registration, power (`kW (HP)`),
  capacity (`ccm`), colour and dealer. This **supersedes the field-name detail in
  [motorrad-images-real-source]** (there is no `ImageSrc`/`sliderImageLinks`/`ImageLinks` array —
  that was inferred from the Angular bundle and was wrong) and **corrects the earlier premise that
  the feed "returns no rows"**: it does return real rows, just as HTML. The session gate in
  [motorrad-images-gate] stands — a scripted request from here still gets the null envelope — but it
  is a session/auth gate, not a "no data" one. This is exactly why the old fixtures had no images:
  the synthetic builder never set `image`, AND the reverse-engineered adapter looked for a JSON array
  that does not exist.

- **[motorrad-html-parser] Built `server/motorrad-listing.js`: a pure HTML parser, mirroring
  `honda-listing.js`.** Honda taught us the pattern — the site renders its listing server-side, so it
  is as scrapeable as Honda's. `parseResTable(html)` → `splitRows` (slice on `ergebnissColor`) →
  `parseRow` → a flat raw record (`{id, title, price, mileage, powerKw, cc, firstReg, year, image,
  link}`), the exact shape `mapMotorradRaw` consumes. Regexes anchor on stable class names so a
  cosmetic change degrades a field to null rather than crashing. `stock.js`
  `motorradRowsFromEnvelope` now detects a **string** `ResTable` and routes it through the parser (a
  pre-parsed JSON array still projects through `motorradRowToRaw` as a resilience fallback). Two
  parser bugs found and fixed against real data: power `"81 kW (109 HP)"` was fusing into `81109`
  (fixed: take the leading kW), and the model-line map had gaps (`R nineT` collapsing to `R 12
  nineT`, `R 1250 GS Adventure` falling through to a naked default) — fixed by expanding
  `MODEL_SPECS_MOTORRAD` to the real range and rewriting `motorradLine` with nineT disambiguation
  first and specific→general canonical-key matching.

- **[motorrad-images-shipped] The deck now ships with real listing photos.** This **supersedes
  [motorrad-images-decision] and [motorrad-images-degrade]** on the "ships photo-less" state. The
  user captured the feed and provided it; `scripts/build-motorrad-fixtures-from-capture.mjs` (now
  accepting a bare `ResTable` HTML fragment as well as a JSON/HAR envelope) rebuilt
  `fixtures/motorrad-bikes.json` through the same production path the live adapter uses. Result:
  **5/5 bikes carry a genuine `GetImg` listing photo** (was 0/49), verified end-to-end through
  `/api/field` — each match's `car.photo` is a real per-vehicle URL, with correct category, honest
  specs, real mileage and a real detail link. The photo-less degrade path in
  [motorrad-images-degrade] remains as a safety net for any future row that lacks an image; it is
  simply not exercised by the current deck. Honesty rule from [motorrad-images-decision] is kept:
  every photo is the real used-listing image, never a model/press render.

- **[motorrad-deck-size] The deck shrank from 49 synthetic bikes to 5 real ones, on purpose.** The
  captured response held five visible rows (the full result set is 963, but only the first page's
  rows were in the capture). The call: a small deck of real, photo-bearing, correctly-specced bikes
  beats a large deck of synthetic photo-less ones — it fixes the reported bug (no images) and keeps
  every card honest. When a fuller capture lands (more of the 963), the same one-step rebuild grows
  the deck with no code change. Logged as a known trade-off, not a silent truncation.

- **[motorrad-display-name] The card heading trims the dealer sales tail off the real title.** Real
  titles append marketing to the model ("… Ex Demo, Top Spec, Low Miles!", "… TE 2 YEAR BMW
  WARRANTY"). `motorradDisplayName` keeps the model and its genuine trim/spec pack (Option 719 Gold,
  Adventure TE, Sport SE) but cuts at the first comma and strips trailing warranty/condition phrases,
  so a card reads as a bike, not an advert. Follows Honda's precedent of tidying scraped-title
  artefacts while preserving the trim. Pinned by a test.

## Motorrad goes genuinely live: the session is self-issuing, no browser needed

- **[motorrad-live-endpoint] The real feed is `POST /api/ResultOverview/ShowResults`.** The user
  captured the browser's own feed request as a cURL; replaying it proved the endpoint. Body is a
  compact JSON filter envelope (`MarktId:'2'`, `Marke:10` = BMW Motorrad), paged by
  `ResOverviewData.selectedPage` at `pagingSize:20`. The response is
  `{ ResOverviewData, ResTable, ErrMsg }` where `ResTable` is the server-rendered HTML table already
  parsed by `server/motorrad-listing.js` (see [motorrad-restable-is-html]). ~963 bikes, ~49 pages.

- **[motorrad-self-issuing-session] The GMB-SID session token is embedded in the landing page, so a
  plain server GET self-issues a session — the browser gate from [motorrad-images-gate] is gone.**
  The cold `ShowResults` POST returns a null envelope because it needs a `GMB-SID` header. That token
  is NOT minted by JS or a bootstrap endpoint; the AngularJS app reads it via `$("#hfSID").val()`,
  and the server embeds a fresh one in the results landing page (`/UK/ergebnisse.cshtml`) as
  `<input id="hfSID" value="…">` (base64 of UTF-16LE `<caller-ip>;<guid>`). So `mintMotorradSid()`
  does a server-side GET of the landing page, scrapes `#hfSID` (via the exported `parseMotorradSid`),
  and uses it to authorise the feed POST. Proven cold, end-to-end, no browser
  (`scripts/motorrad-live-probe.mjs`). This **supersedes [motorrad-images-gate] and the capture-only
  posture of [motorrad-images-decision]/[motorrad-deck-size]**: Motorrad now runs live like BMW/MINI.

- **[motorrad-totalcount-echo] The feed does NOT compute `totalItemCount` — it echoes back whatever
  the request body sends.** Send `totalItemCount:0`, get `0` back, so `Math.ceil(0/20)=1` page and
  the loop stops after page 1 (the captured cURL only worked because its body had `963` baked in).
  Fix: `motorradLiveStock` **walks until dry** — it keeps paging until a page returns fewer than
  `pagingSize` rows or adds nothing new, never trusting the echoed total. Documented in the function.

- **[motorrad-batched-paging] Paging is batched 8-wide, not sequential, and warmed at boot.** 49
  sequential round-trips took ~93s; `MOTORRAD_PAGE_BATCH=8` concurrent requests (folded in page order
  for a deterministic dry-page stop) cut it to ~38s. `server/index.js` boot-primes Motorrad alongside
  BMW/MINI/Honda/Ford, so the ~38s cold walk happens once at startup and no user ever pays it. The
  live path reuses the existing `cachedFetch` single-flight + TTL cache and background warmer; a live
  failure degrades to `fixtures/motorrad-bikes.json` via `StockUnavailableError`, same as every brand.

- **[motorrad-deck-963] The committed fallback deck is now the full 963 real bikes, all with real
  photos.** `scripts/fetch-motorrad-all-pages.mjs` replays a captured cURL across every page, dedupes
  by offer id, projects through the SAME production path (`mapMotorradRaw`), and writes the fixture.
  Result: 963/963 carry a real `GetImg?imgId=` listing photo, 0 duplicates, 0 invalid. This
  **supersedes [motorrad-deck-size]** (the 5-bike capture-only deck): the fallback is now the whole
  approved-used pool, and the live path serves the same pool fresh.

- **[motorrad-line-honesty] Fixed 9 of 963 bikes that resolved to the wrong model family.** An
  end-to-end audit caught `F 750 GS` titles resolving to `R 1250 GS` (×6), `K 1600 Grand America` to
  `R 1250 R` (×2), and `K 1300 S` to `R 1250 R` (×1) — wrong badge, wrong cc, wrong category. Root
  cause: `MODEL_SPECS_MOTORRAD` lacked those three lines and `motorradLine` had no probes for them,
  so each fell through to a loose family fallback. Added the three spec entries (F 750 GS 853cc
  adventure; K 1600 Grand America 1649cc tourer; K 1300 S 1293cc sport) and the matching probes in
  correct specificity order. Cross-family mismatches now 0/963, pinned by a regression test. Follows
  the standing "stay as real and live as possible" honesty rule: a card must wear its own badge.

## Fonts: package all four brands' typefaces into the block

- **[fonts-packaged-all-four] The block self-hosts every brand's real typeface under
  `blocks/vehicle-matcher/fonts/`, declared with `@font-face` at the top of the CSS and named
  FIRST in each brand's `--vm-font-*` token stack.** Rationale: the standalone harness (and the
  GitHub Pages build) has no host page to inherit fonts from, so a host-first stack fell straight
  through to Helvetica there — the reported "fonts don't render" bug. Packaging makes each brand
  render correctly everywhere it's embedded. One family per typeface with real `font-weight`s (never
  a per-weight family name, which silently synthesises); `font-display: swap`. The Pages workflow
  copies `blocks/` recursively and the EDS sync mirrors the whole block, so the files ship on both
  paths with no extra wiring.

- **[fonts-bmw-mini] BMW Type Next (BMW + Motorrad) and MINI Serif / MINI Sans (MINI) are the
  exact woff/woff2 the live retailer sites load.** BMW Type Next: Thin 100 / Light 300 / Regular 400
  / Bold 700 (woff2). MINI faces are woff only; the internal cuts are heavier than their filenames
  suggest (MINI Sans "regular" is a Medium/500, both "bold" files are Black/900), each declared at
  the 400/700 the CSS requests so weights resolve exactly rather than synthesising. Motorrad reuses
  BMW Type Next (same @font-face, no separate files). These are brand-owned faces; self-hosting is
  the straightforward call.

- **[fonts-ford] Ford packages FordF1 (its current 2023-on brand face) plus Ford Antenna (the
  previous one) as a same-stack fallback.** FordF1 woff2 (Regular 400 / Medium 500 / Bold 700) from
  Ford's CDN via TrustFord; Ford Antenna woff (Regular 400 / Bold 700) self-hosted on TrustFord.
  Stack is `'FordF1','Ford Antenna',<host bridge>,<system>`. Ford headings were retuned from
  `font-weight: 600` to `500` because FordF1 ships no 600 cut and 500 (Medium) is the weight
  ford.co.uk itself sets headings at — avoiding a synthesised weight. Both are Ford-owned brand
  faces, so this sits on the same footing as BMW/MINI.

- **[fonts-honda-proxima-caveat] Honda's real web face is Proxima Nova, NOT a "Honda Sans" (that
  was a placeholder guess), and self-hosting it is a deliberate owner decision on weaker licence
  footing.** honda.co.uk uses Proxima Nova Extra Condensed for display/headings (Light 300 / Regular
  400 / Semibold 600 by internal `usWeightClass`) and regular-width Proxima Nova for body (400). Two
  caveats, both flagged to and accepted by the owner: (1) Proxima Nova is a **commercial Mark
  Simonson retail typeface Honda licenses**, not a Honda-owned brand asset like BMW Type Next — so
  self-hosting it in this block has no clear licence, unlike BMW/Ford/MINI. (2) The woff files Honda
  serves have **deliberately scrambled internal name tables** (an anti-reuse measure); that doesn't
  break us because `@font-face` matches on the family name we declare (`'Proxima Nova'` /
  `'Proxima Nova ExCn'`), not the file's internal name. The owner chose "package everywhere" for
  consistency with BMW/MINI, accepting the weaker footing. If the licence is ever challenged, the
  clean swap is a freely-licensed condensed sans (e.g. Barlow/Saira Condensed) under the same family
  names — no CSS change beyond the `@font-face` `src`.

<!-- Further decisions appended below as the run proceeds. -->
