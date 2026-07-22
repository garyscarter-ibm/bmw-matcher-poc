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
- **"Don't like the look of it" mostly maps to nothing** — the feed has no
  body-colour field, confirmed exhaustively, and the PDP that might carry one
  is `robots.txt`-disallowed ([refinement-audit.md](refinement-audit.md), blind
  spots). The honest handling is exclude-this-car and diversify what's shown
  next, never a fake filter. **The one exception is MINI's contrast roof**
  (`contrastRoof`, known for 88% of MINI stock, splits at every retailer) —
  a real aesthetic axis the tool *can* offer, and the closest thing available
  to the "I want the blue one" want.

Proposed why-menu (each mapped to its action):

| reason | action |
|---|---|
| Don't like the look | exclude this car; diversify the next cards. **No colour data — do not pretend otherwise.** |
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
2. **Expose it.** `publicCar` currently withholds `features`/`transmission`
   (deliberately — no consumer yet). Phase 2 starts by exposing them.
3. **Cluster-aware results.** Compute the cluster server-side; return it with
   the margin so the block can choose between decree and "any of these".
   Requires replacing the fixed `TOP_MATCHES` slice.
4. **Refinement questions from cluster variance** — the push half. Pure
   function of the cluster: no authoring, no per-brand lists.
5. **Reject + why** — the pull half, with visible revocable chips.
6. **Empty-pool handling** — reuse `tradeOffs`/`unmetWants` copy patterns.

Steps 3–5 are the design lift; 1–2 are plumbing.

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
