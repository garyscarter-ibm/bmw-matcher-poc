# Phase 2 — from "three cars fit you" to "this one"

Status: **designed, not built.** The data layer is in (`FEATURE_CONCEPTS` +
`transmission` on every mapped car); no UX exists yet. Evidence for every claim
here is [refinement-audit.md](refinement-audit.md).

## Why this exists

The matcher was originally a **model** matcher — "which BMW suits your life?" —
and the car pool was later switched to real used stock. The question set never
caught up. Used-car buying is more granular than model-choosing, and it has
dealbreakers: someone who wants a panoramic roof will not be talked out of it.

The symptom, measured: when the page says "YOUR PERFECT MINI IS THE ACEMAN", the
top two cars are within 3 points in 52–67% of rankings and *exactly tied* in
19–35%, with the winner chosen by a cheaper-car tie-break. At a dealership with
ten cars that fit your brief, the right one might be the blue one. The tool
currently picks for you and sounds certain about it.

## The framing: replicate the function, not the interaction

"Do what a dealer does" is the wrong target — most people (including the person
who commissioned this) actively dislike the dealer interaction. What a good
salesperson *does* separates into three jobs:

1. **Qualify** — budget, life, needs. → the existing question set. Still right.
2. **Walk the lot** — show real cars, read reactions, narrow by taste. → **missing.**
3. **Negotiate the trade-off** when the perfect car doesn't exist. → already
   built (`tradeOffs` per match + the pool-level `unmetWants` note).

So the diagnosis is narrow and specific: **the tool exits the funnel one step
early.** It takes a buyer from "I don't know what I want" to "three cars fit
you" and stops, when the job only ends at "*this* one."

## Rejected approaches (don't re-propose these)

- **More granular questions upfront.** Asking "must it have a panoramic roof?"
  on screen four is a user-applied hard filter against a median 33-car MINI
  retailer — it recreates exactly the runtime-pruning problem rejected in
  [question-stock-audit.md](question-stock-audit.md), except the user does the
  pruning to themselves and lands on zero results. Upfront granularity and thin
  used stock are structurally at war.
- **Rebuilding advanced search.** usedcars.bmw.co.uk already has filters. The
  buyer who can state "blue manual JCW with a pano roof" is served there. This
  tool's user is the one who *can't articulate that yet* — the funnel from
  vague to specific is the whole product.
- **A reject-only loop.** See below: rejection alone makes the tool look like
  it's failing rather than learning.

## The mechanism

### Phase 1 — unchanged (plus one fix)

Life-fit questions produce a **cluster**, not a winner. The layer isn't wrong;
it's doing the qualifying job. One standalone gap worth closing regardless:
**gearbox is never asked**, is a genuine dealbreaker, is a clean feed field, and
splits 12% of MINI stock (dead for BMW at ~97% automatic — so it earns its place
by variance, like everything else here).

### Phase 2 — the lot-walk

When the top scores bunch, **drop the decree**: "Any of these six would suit you
— now it's taste." Then two affordances, which are *not* two skins on one
mechanism. They're complementary halves of a loop:

**Push — variance-driven refinement.** Ask about what actually differs *inside
the cluster*: if all ten cars have a pano roof, never mention roofs; if six do
and four don't, that's one tap worth offering. Because the questions are
generated from live stock variance, they can never be dead — the problem that
kills upfront granularity solves itself at this end of the funnel. 91–100% of
multi-car clusters differ on at least one parsed concept, so there's nearly
always something to ask.

**Pull — reject and say why.** The highest-signal interaction in the tool,
because it's a reaction to a real car rather than an answer about a hypothetical
one. Dealbreakers are mostly *revealed*, not stated: nobody knows they hate
white cars until shown one.

Why both: push shortcuts what rejection discovers slowly (if all three shown
cars fail for the same reason, one question beats three rejections), and pull
catches what push can't (a constraint we never modelled — "I had that engine
once, never again").

### The "why" prompt earns its place by attribution

Rejecting a white 3-door with 40k miles tells us nothing on its own — which
property was rejected? Acting on an unattributed rejection is how you mislearn a
dealbreaker and empty a 33-car pool. That's the *whole* reason to ask, and it
dictates the constraints:

- **One tap, and skippable.** Forcing a reason makes people pick at random,
  which poisons the constraint set — worse than no signal. "Just not this one"
  must be first-class: excludes the car, generalises nothing.
- **Every option maps to an action the data can execute.** No decorative
  reasons.
- **Hard vs soft.** Categorical reasons (gearbox, a missing feature) are
  dealbreakers → filters. Scalar reasons (price, mileage) are directions, not
  cliffs — rejecting a £24k car doesn't mean £23,999 is fine → re-weight, don't
  filter.
- **"Don't like the look of it" now maps to something real.** Colour was the
  gap this whole design was built around; it turned out to live on the PDP and
  is now fetched for shown cars ([refinement-audit.md](refinement-audit.md)).
  So a look-based rejection can exclude *that colour*, not merely that car —
  with MINI's `contrastRoof` as a second aesthetic axis. Interior trim remains
  unanswerable, so "don't like the inside" still means exclude-and-diversify.

Proposed why-menu (each mapped to its action):

| reason | action |
|---|---|
| Don't like the look | exclude this colour (paint is now on every shown car), else just this car |
| Too expensive / cheaper than I want | re-weight budget toward the stated direction |
| Too many miles | soft-penalise above this car's mileage |
| Wrong gearbox | filter (MINI-relevant; ~dead for BMW) |
| Missing something I need | opens *this car's* parsed concepts as tap-to-require |
| Just not this one | exclude only |

### Two mechanical consequences

1. **Re-rank against the full cluster, not the visible three.** This is where
   the rejection loop and the truncation finding meet: reject #1 for its roof
   and the hidden #4 that has one surfaces. The loop *is* the fix for cluster
   overflow — the buyer paginates through the tie by expressing taste. The
   `TOP_MATCHES = 3` cap must give way to "show the cluster".
2. **Learned constraints must be visible and revocable** — chips like
   "Panoramic roof ✕". At MINI stock levels two learned dealbreakers will
   regularly empty the pool, and invisible learned state plus thin stock is a
   tool that mysteriously runs out of cars. When it does empty, the existing
   trade-off machinery is the graceful exit: *"Nothing left with a pano roof
   under 20k miles — here's the nearest 15 miles away, or here's what you'd
   relax."*

### Worth considering alongside

A **"more like this" / shortlist** action. A dealer reads lingering as well as
walking away, and a pin is cheaper for the buyer than reject-plus-why while
carrying nearly as much signal.

## Build order

1. ~~Data layer — parse equipment concepts + gearbox onto every mapped car.~~
   **Done** (`FEATURE_CONCEPTS`, `featuresFor`, `transmissionFor` in
   `server/mapping.js`; fixtures re-mapped via `dump-stock.js --remap`).
2. ~~**Expose it.**~~ **Done** — `publicCar` sends `features`, `transmission`
   and `colour`. Colour needed its own source: `enrichColours` (stock.js),
   fetched per shown car from the PDP.
3. ~~**Cluster-aware results.**~~ **Done** — `matchCars` returns `decisive` +
   `clusterSize`; the block renders a hero when the win is real and co-equal
   cards when it isn't, demoting non-tied cars to "More at <retailer>" so the
   headline count is always the true tie. Cards now name their paint, which is
   what makes a tie navigable.
4. ~~**Refinement questions from cluster variance**~~ — **Done.**
   `refinementAxes` (block) derives one tappable axis per thing that actually
   splits the tied set: equipment concepts, gearbox, and paint. Ranked by how
   evenly each splits, because a 3/3 question tells us more per tap than 5/1.
   No authoring and no per-brand lists, exactly as planned — gearbox surfaces
   for a mixed MINI cluster and stays quiet for BMW's all-automatic stock
   purely because of what's in front of it.
5. **Reject + why** — the pull half. **Next.**
6. **Empty-pool handling** — reuse `tradeOffs`/`unmetWants` copy patterns.

### How step 4 landed, and one property worth keeping

It runs entirely in the page. Everything it needs — features, gearbox, colour —
already arrives with the match, so narrowing six cars to one costs no round
trip. The chip row recomputes after every tap against what's *still on screen*,
which produces a property the design didn't originally plan for and should
keep: **an axis is only offered while it still splits the visible set**, so
applying one always leaves at least one car, and an impossible combination is
never presented. The empty state therefore can't be reached by chips alone; it
remains in the code because rejection (step 5) *can* empty a set for real.

That "only offer live axes" rule is also the honest one. The axes describe this
cluster, not the retailer's stock — so telling someone "nothing has a pano roof
in green" would be a claim about inventory we never checked.

The payoff: tap "Panoramic roof" and a six-way tie becomes a three-way one; add
"Grey" and the page says *"Your perfect MINI is the Hatch John Cooper Works"* —
this time having earned it, with the tie lede dropped because it's no longer
true. The user got there in two taps without stating a spec upfront.

### What step 4 has to work with, now that 1–3 are in

A live six-way tie at Sytner Luton (petrol city hatch, £20–35k) returns two JCW
Hatches at 88% and four Cooper C/S at 87%. Within that cluster the engine has
nothing left to say — but the cars differ by paint (Legend Grey, Midnight Black
II, Ocean Wave Green, Melting Silver III, Nanuq White), by concept count (3 to
11 of them), and on gearbox. That is the raw material for the questions, and
it's now all on the wire.

## Open questions

- ~~**Does the PDP endpoint carry paint colour?**~~ **Closed, mostly.** Body
  paint is confirmed absent from the list feed, and the PDP can't be probed
  automatically (`Disallow: /vehicle/`). Design around the gap; MINI's
  `contrastRoof` covers part of it. Still worth a *human* glance at one PDP in
  a browser to know whether paint is shown to buyers at all — if it is, the
  question becomes whether there's a sanctioned way to get it, not whether it
  exists.
- **What is the cluster threshold in the UI?** 3 points is the audit's
  analytical choice. The product may want "everything within N% of #1", or
  simply "the top 6 when the gap is small".
- **Does refinement re-rank or filter?** A required concept could hard-filter
  the cluster or just add weight. Filtering is honest and legible; weighting is
  softer but risks showing a car that lacks the thing they just demanded.
- **Session state.** Learned constraints currently have nowhere to live — the
  share link (`#m=`) encodes answers only. Either extend it or accept that
  refinements don't survive a share.
