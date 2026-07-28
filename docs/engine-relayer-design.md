# Engine re-layer — design

Status: **design, not built.** Proposed in response to
[same-car-investigation.md](same-car-investigation.md): four of nine questions
can never change the recommendation, and the same car wins 77% of the time
when a real person tweaks one answer.

This is a re-layering, not a rewrite. Every scorer, hard filter, mapping rule
and presentation state survives; what changes is **which questions feed which
stage of the decision**.

## The problem in one paragraph

`rankCars` blends eight dimensions into one weighted sum. A weighted sum cannot
tell a *constraint* ("it must be a convertible") from a *preference* ("I care
about comfort"), so it fails in both directions and the two failures pull
against each other. Making constraints heavier fixed a diesel out-ranking the
petrol estate someone asked for; it also drowned the preference questions,
which is today's bug. Body 4.5 + fuel 6.5 (when named) + budget 3.0 is roughly
three-quarters of the blend, leaving `priorities`, `style`, `primaryUse` and
`mileage` arithmetically unable to move the answer. Re-tuning weights just
moves the failure from one end to the other.

## The principle

**Constraints eliminate. Fit ranks. Taste chooses.**

The presentation layer already tells this story — "these fit you equally well,
now it's taste" — and the refine chips already let taste choose. The engine
just doesn't work that way yet. This aligns the engine with the product model
we've already shipped.

## Stage assignment

Every scorer stays; each moves to a stage. No scorer is rewritten.

| Stage | Dimension | Reads | Why here |
|---|---|---|---|
| **1. Constraint** | hard filters | budget, people | Already eliminate. Unchanged. |
| | budget | budget | A price you can't pay isn't a taste question |
| | body | bodyStyles | A stated shape is a constraint (July fix made it bind; keep it) |
| | fuel | fuel, charging | A stated fuel is a constraint (July fix; keep it) |
| | doors | doors (MINI) | Stated want |
| **2. Fit** | practicality | people, primaryUse | Objective: does the boot hold the buggy |
| | size | primaryUse | Objective: road trips need more car than city runs |
| | economy | mileage, charging | Objective: what it costs to run *at your mileage* |
| **3. Taste** | character | priorities, style, primaryUse | Subjective: tag-matching against what you like |
| | performance | style, priorities | Subjective: how spirited you want it |
| | styleLine | miniVibe (MINI) | Subjective: trim character |
| | *(existing refine axes)* | colour, equipment, gearbox | Already taste-only, already built |

Note that a question can feed two stages, and should: `primaryUse` genuinely
carries an objective signal (boot need) *and* a taste signal (fun vs commute).
Only its objective half belongs in fit.

## How the pipeline changes

```
today:   filter → weighted sum (all 8) → rank → slice → cluster → refine
                                                          ↑ bolted on

proposed: filter → FIT score (constraint + fit dims) → cluster
                 → TASTE score orders within each cluster → refine
```

Two scores per car instead of one:

- **fitScore** — constraint + fit dimensions. This is the number shown as the
  match %, because the whole honesty layer (trade-offs, unmet wants, "the
  closest matches here") is about fit.
- **tasteScore** — taste dimensions, driven mainly by `priorities`. Never
  displayed; it decides *order within a cluster*.

`priorities` stops being a weight-nudge on the sum and instead defines the
taste score. That's the specific change that makes it matter.

## Three result shapes (and how they map to the five states)

| Fit | Taste | Result | Headline |
|---|---|---|---|
| one car leads | — | decisive | "Your perfect BMW is…" *(unchanged)* |
| several tie | one leads | **new middle state** | "Six fit you equally well. This one best matches what matters to you." |
| several tie | also tie | genuine tie | current tie UI + refine chips *(unchanged)* |

The middle row is the fix. It's also a better product: today a fit-tie is
handed to the user unranked, when we *do* have information (their stated
priorities) that could order it.

The bottom row becomes rarer and more meaningful — reserved for cars that are
identical on everything we know. That's exactly Meg's case: two MINI Electrics,
same spec, Chili Red vs Midnight Black. No engine should pretend to separate
those; the user must. That's what the refine chips are for.

## Acceptance criteria (measure before/after with the harness)

| Metric | Today | Target | Pass/fail |
|---|---:|---|---|
| Stickiness (winner unchanged on one tweak) | 77% BMW / 78% MINI | **≤ 55%** | must improve |
| `priorities` moves the winner | 0% BMW / 7% MINI | **> 25%** | must improve |
| `style` / `primaryUse` move the winner | 0% | **> 15%** | must improve |
| Fuel intent violations | 5% / 5% | **≤ 5%** | must not regress |
| Body honesty | 63% / 70% | **≥ 62% / 69%** | must not regress |
| Outcome diversity | 65% / 47% | **≥ today** | should rise |
| Persona pass rate | 49/64 | **≥ 49/64** | must not regress |
| Cluster size (p90) | 4–9 | watch | may grow; see risks |

If stickiness doesn't fall below 55% while fuel and body hold, the design is
wrong and should be reconsidered rather than tuned around.

## Risks

1. **Fewer fit dimensions → more bunching → bigger clusters.** The most likely
   side effect. Mitigations, in order: re-check `CLUSTER_PTS` (3 was calibrated
   against the old blend), and lean on the fact that taste now orders within a
   cluster so a big cluster is no longer an unranked pile. Measure
   `clusterSize` p90 before/after; if it grows past ~8, tighten the threshold.
2. **Tests assert specific winners.** Some of the 60 will legitimately change.
   Each break must be read as "is the new answer better?", not auto-updated.
3. **The displayed % changes meaning** (now fit only), so numbers shift. This
   is arguably more honest — the % has always been presented as "how well this
   matches what you asked for" — but it's a visible change.
4. **Taste can be noisy** for someone who picks generic priorities. Handled by
   design: if taste can't separate, we fall through to the genuine-tie state,
   which is correct.
5. **MINI's `miniVibe` already works** (50% winner-move). Moving it to taste
   must not weaken it; it should act within the cluster instead of across it.
   Watch this one specifically.

## Scope: what changes, what doesn't

**Changes** (~200 lines): `WEIGHTS` splits into fit/taste sets per brand in
`brands.js`; `effectiveWeights` splits accordingly; `rankCars` returns both
scores; `matchCars` clusters on fit and orders by taste; one new result state
in the block plus its copy, both brands.

**Unchanged:** every scorer function, hard filters, `mapping.js`, `stock.js`,
the API shape (one added field), share links, the refine/reject machinery, all
five result states bar the new middle one, and the whole audit harness — which
is what makes this measurable.

## Build order

1. Split the weight tables; add `tasteScore` to `rankCars` **without** changing
   behaviour (compute it, don't use it). Verify all metrics unmoved — proves
   the split itself is inert.
2. Switch `matchCars` to cluster-on-fit, order-by-taste. Re-run the full
   harness; this is where the numbers should move.
3. Read the test failures individually.
4. Add the middle result state + copy.
5. Re-run personas end-to-end and the live spot-checks.

Step 1 existing separately matters: if step 2's numbers disappoint, step 1 is
still a safe, committed refactor rather than something to unpick.

## Open questions for the product owner

- **Is the middle state's headline right?** "Six fit you equally well; this one
  best matches what matters to you" is honest but wordier than a decree.
- **Should the % show fit only, or fit+taste?** Design says fit; the alternative
  keeps today's numbers more familiar.
- **How hard should taste push?** It currently only orders within a cluster. It
  could instead be a small additive term, which would blur the two-stage model
  but produce fewer ties.
