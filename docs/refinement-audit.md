# Results-refinement audit — is the decree earned?

Status: **analysis complete, no UX built.** The design these numbers support is
[refinement-plan.md](refinement-plan.md). Numbers from the national fixture
dumps captured 2026-07-18 (~13k BMW / ~4.3k MINI), measured 2026-07-22;
re-run `npm run audit:refine [decree|features|vocab|all]` after a
`dump-stock` refresh to see if they still hold.

Companion to [question-stock-audit.md](question-stock-audit.md), which asked
whether each *question* earns its screen. This asks the same of the *results*.

## The question being tested

The results page names a single winner — "YOUR PERFECT MINI IS THE ACEMAN" —
and shows three cars. Two things have to be true for that to be honest:

1. The model can actually tell #1 from #2.
2. If it can't, there's something else to separate them by.

Both were measured by replaying the real engine (`rankCars` + brand tuning)
over the national dumps: 40 retailers per brand sampled across the stock-size
distribution, 200 random answer sets each, seeded PRNG shared with the question
audit so the two are directly comparable.

## Headline: the decree is usually hollow

A "cluster" is every car within 3 points of #1 — the set the model is treating
as interchangeable.

| | BMW small | BMW med | BMW large | MINI small | MINI med | MINI large |
|---|---:|---:|---:|---:|---:|---:|
| #1 vs #2 gap (median pts) | 3 | 2 | 1 | 3 | 3 | 2 |
| **dead tie** (gap 0 — winner is the tie-break) | 19% | 29% | **35%** | 19% | 25% | 29% |
| gap ≤3 | 63% | 63% | 67% | 52% | 58% | 58% |
| cluster size (median / p90) | 2 / 4 | 2 / 6 | 2 / 7 | 2 / 4 | 2 / 5 | 2 / 9 |
| **cluster overflows the 3 shown** | 11% | 25% | **32%** | 12% | 22% | **32%** |
| cluster differs on equipment | 100% | 95% | 97% | 91% | 93% | 96% |
| cluster differs on gearbox | 3% | 2% | 1% | 12% | 25% | 27% |

Three findings, in order of how much they should change the product:

1. **In 52–67% of rankings the top two are within 3 points, and in 19–35% they
   are exactly tied** — the winner picked by the cheaper-car tie-break in
   `rankCars`, not by merit. The page states a preference the model doesn't
   have.
2. **The tie rate RISES with stock depth** (BMW large 35% vs small 19%), which
   is counter-intuitive until you see why: deep stock means several physical
   examples of essentially the same car. Three 118i M Sports differing only in
   colour, mileage and options are genuinely indistinguishable on life-fit —
   the difference between them *is* taste.
3. **The page silently truncates cars the model rates equal.** The cluster
   overflows the three shown in up to 32% of cases. A buyer whose actual
   favourite sits 4th in a five-way tie never sees it.

And the thing that makes a fix possible: **91–100% of multi-car clusters differ
on at least one parsed equipment concept.** There is nearly always something
real to separate them by. Gearbox is a MINI-only axis (25–27% of clusters vs
1–3% for BMW, whose used stock is ~97% automatic).

## What can be asked about: the equipment vocabulary

The feed carries a full factory options list on **100% of stock, both brands** —
manufacturer option names, not free text (~260 distinct strings above 1%
frequency for BMW, ~230 for MINI). `FEATURE_CONCEPTS` in `server/mapping.js`
parses them into concept keys on every mapped car.

A concept is **requireable** where it *splits* a retailer's pool — some cars
have it, some don't. Universal or absent means nothing to refine with. Split
rate below is the share of retailers (≥10 cars) where it splits:

| concept | BMW national / splits | MINI national / splits |
|---|---:|---:|
| panoRoof | 17% / 97% | 36% / 100% |
| contrastRoof | 2% / 7% — too rare | 68% / 100% |
| heatedWheel | 32% / 100% | 41% / 100% |
| headUpDisplay | 16% / 99% | 41% / 100% |
| premiumAudio | 59% / 100% | 39% / 100% |
| adaptiveLights | 63% / 100% | 39% / 99% |
| climateControl | 64% / 100% | 54% / 100% |
| ambientLighting | 67% / 100% | 55% / 100% |
| keylessEntry | 50% / 100% | 78% / 97% |
| sportsSeats | 72% / 100% | 76% / 99% |
| cruiseControl | 41% / 100% | 57% / 100% |
| navigation | 8% / 71% | 61% / 100% |
| parkingCamera | 10% / 86% | 31% / 99% |
| tintedGlass | 83% / 99% | 26% / 96% |
| smartphoneIntegration | 6% / 60% | 53% / 100% |
| heatedSeats | 96% / 27% — **universal, dead** | 88% / 79% |
| parkingSensors | 100% / 0% — **universal, dead** | 96% / 30% |
| manual gearbox | 3% / 11% | 12% / 81% |
| towbar, electricSeats, sunroof | rare / rarely splits | rare |

**14–16 concepts per brand clear the bar, live at 86–100% of retailers.** The
refinement step will essentially never be starved of a real question to ask.

Note how the same data tiers differently per brand — heated seats are dead for
BMW and live for MINI; gearbox is a MINI question only. This falls out of the
measurement, so it needs no per-brand authoring: **selection is by live stock
variance, not by an authored list.** (Same conclusion the question audit
reached about pruning, arrived at from the other end.)

## Colour: absent from the list feed, present on the PDP

**Resolved — colour is available, and now fetched.** The list endpoint every
other field comes from genuinely has no paint on it, confirmed twice over: a
walk across every string value in the raw dumps looking for known BMW/MINI paint
names returns only *alloy wheel* colours ("19\" M Double-spoke Jet Black Alloy
Wheels"), one edition name inside a derivative ("Protonic Frozen Yellow
Edition"), and MINI's roof/mirror trim — and a live list response has no
`colour` key at all.

The **vehicle detail page** has it. There's no detail JSON endpoint (the
obvious paths 404); the PDP server-renders the entire vehicle into an inline
`UVL.AD = {…}` variable, which is why the browser's network tab shows no
request carrying the colour you can see on screen. Inside it:

```json
"colour": {"colour": "White", "finish": "Metallic", "manufacturer_colour": "Mineral White"}
```

Verified across both brands (BMW Brooklyn Grey / Alpine White, MINI Ocean Wave
Green / Chili Red II / Nanuq White). `enrichColours` in `server/stock.js` reads
it for the cars a page is about to show — one page fetch per car makes it
unaffordable for a whole pool and cheap for a cluster of six, and since an
advert's paint is immutable the cache never expires.

Note for anyone extending this: `robots.txt` carries `Disallow: /vehicle/`,
which covers the PDP *and* the `/vehicle/api/list/` endpoint this tool already
runs on. Fetching it is a deliberate call for a BMW-facing POC over BMW's own
public data, taken with the project owner's sign-off — not a default to copy
into something public-facing without asking again.

## Known blind spots in the feed

- **Seat upholstery.** Grades (Vernasca, Dakota, MINI Yours Lounge) appear on
  <1% of either brand's stock. "Leather seats" is not answerable. What the feed
  *does* state, often, is a leather steering wheel — hence the concept is named
  `leatherWheel` rather than implying more than the data supports.

### The partial answer: MINI's contrast roof

Chasing the colour gap did turn up the one **aesthetic** choice this feed
states, and it's a signature MINI one — the contrast roof:

| | share of MINI stock |
|---|---:|
| contrast roof stated (black / white / silver / Chili Red / yellow / blue) | 68% |
| roof in body colour | 21% |
| **either — i.e. the fact is known** | **88%** |

It splits the pool at **119 of 119** MINI retailers, and is absent from BMW
stock (2%, which doesn't offer it) — so `contrastRoof` needs no per-brand
authoring, exactly like gearbox and heated seats. It is not body colour, but it
is a visible styling choice buyers hold opinions about, and it is the closest
this data gets to the "I want the blue one" want.

Caveat for anyone re-measuring: the feed repeats each option string across
several nestings (per-category *and* a flat list), so occurrence counts
overstate coverage badly — "Panoramic Glass Sunroof" reads as 69% counted per
occurrence and 36% counted per car. **Always dedupe within a car**, as
`featureStrings` + `featuresFor` do.

## Two parser bugs the `vocab` pass caught

The `vocab` pass lists frequent option strings that no concept matches — the
maintenance signal for the concept table. It immediately earned itself:

1. **"Parking Assistant" (59% of BMW stock) didn't match `park assist`**,
   understating `parkingSensors` roughly fourfold. Fixed to `park(ing)?
   assist`; the honest result is that the concept is *universal* on BMW and so
   dead as a question — the opposite of what the broken parse implied.
2. **Concepts matched the joined option blob, not individual strings**, so
   "sport leather steering wheel" read as leather *seats*, and "heated steering
   wheel" + "sport seats" combined into "heated seats" across the join.
   Matching now runs per string with an optional exclusion pattern.

Re-run `npm run audit:refine vocab` after any fixture refresh; new frequent
unmatched strings are candidate concepts (or noise to ignore, like "DAB radio"
and "tyre repair kit", which every car has).

## Caveats

- Random answer sets, not real-user distributions — real buyers pick correlated
  answers, so absolute percentages are optimistic. The *ordering*, the
  tie-rate-rises-with-stock effect, and the near-universal equipment variance
  are robust.
- "Within 3 points" is a judgement about what counts as indistinguishable. The
  dead-tie column (gap exactly 0) needs no such judgement and is damning on its
  own.
- Split rates are measured per retailer against current stock; a retailer's mix
  churns, which is exactly why selection must be computed live rather than
  authored from this table.
