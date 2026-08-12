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

<!-- Further decisions appended below as the run proceeds. -->
