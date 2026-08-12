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

<!-- Further decisions appended below as the run proceeds. -->
