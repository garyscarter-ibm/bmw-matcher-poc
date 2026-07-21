# Question-vs-stock audit — findings & decision framework

Status: **analysis complete; all three fixes built** (see "The fixes" below for
what each one became). The headline numbers in this doc are the *pre-fix*
measurements that motivated them — re-run the harness for current figures.
Numbers from the national
fixture dumps captured 2026-07-18 (~13k BMW / ~4.3k MINI); re-run
`node scripts/audit-questions.mjs` after a `dump-stock` refresh to see if they
still hold. The harness replays the real engine (`rankCars` + brand tuning)
offline, so results reflect exactly what users would see.

## The question being tested

Should the quiz be a completely different question set per brand, and/or
dynamic on current stock — so matching is as sharp as it can be for the brand
and the moment? The audit measures whether each question *earns its screen*:

- **dead** — options with zero cars behind them, per retailer and nationally.
- **sens** — flip one question at a time across random answer sets: how often
  does the top-3 change? Plus outcome diversity and body-style honesty.
- **size** — the same, split by retailer stock size (small/medium/large),
  which is the direct test for "should the quiz adapt to stock level?".

## Headline numbers

Per-question sensitivity (% of cases where changing ONLY that answer changes
the top-3):

| question   | BMW (median) | MINI large (>60 cars) | MINI small (<25 cars) |
|------------|-------------:|----------------------:|----------------------:|
| budget     | 100%         | 100%                  | 100%                  |
| bodyStyles | 97%          | 100%                  | ~90%                  |
| fuel       | 100%         | ~85%                  | **48%**               |
| people     | 77%          | ~75%                  | **~90%**              |
| primaryUse | 90%          | ~78%                  | ~68%                  |
| priorities | 83%          | 76%                   | ~58%                  |
| miniVibe   | —            | ~65%                  | ~46%                  |
| charging   | 70%          | ~50%                  | **24%**               |
| style      | 63%          | 48%                   | ~34%                  |
| mileage    | 67%          | ~54%                  | 40%                   |
| **boot**   | **13%**      | **~25%**              | **~22%**              |

(Exact figures vary a little run-to-run with the sampling seed; the ordering
and the starred outliers are stable.)

Other findings:

- **Body-style honesty** (user named a shape → it appears in the top 3):
  **BMW 53%, MINI 72%**. MINI's `body: 6.0, miss: 0` tuning (brands.js) fixed
  exactly this; BMW's gentle `miss: 0.15` lets a wrong-shape car into the
  top 3 nearly half the time.
- **Outcome diversity** (distinct top-3s across 300 random answer sets,
  median retailer): BMW 62%, MINI 36% — thin stock collapses the quiz's
  expressiveness.
- **Dead options**: `fuel:phev` has zero stock at **60% of MINI retailers**
  (`fuel:ev` 19%); 13% of MINI retailers have no electrified car at all, so
  the whole conditional charging screen refines a choice with nothing behind
  it. BMW's only notable one is `bodyStyles:mpv` (dead at 40% of retailers).
  Nationally, *every* option both brands offer has stock — there are no
  brand-intrinsic dead options left to cut statically.
- **Budget slider**: the retailer's real p5–p95 price span covers a median of
  only **35% (BMW) / 39% (MINI)** of the slider's range.
- Median retailer stock: BMW 93 cars (108/131 retailers hold >60), MINI 33
  (only 9/121 hold >60). Stock-level adaptation is mostly a MINI problem.

## What the audit overturned

The intuitive version of the hypothesis — "MINI needs its own question set;
`people`/`boot` are dead for a brand with no 7-seaters" — was wrong in three
places:

1. **`people` is one of MINI's strongest questions** (~90% at small
   retailers): the crew hard-filter effectively asks "Countryman or not?",
   which is real discrimination in a thin pool. Don't cut it.
2. **`boot` is near-dead for BOTH brands** (13% BMW). It's a shared-question
   flaw — practicality's weight is split with seats and nearly every car
   clears the thresholds — not a brand mismatch.
3. **The wrong-shape problem is BMW's, not MINI's** (53% vs 72% honesty).
   The "thin-stock hack" in MINI's tuning is actually the better calibration.

## Decision (2026-07-21): no runtime pruning of answers or budget

Stock-aware option pruning + dynamic budget bounds were proposed from these
findings and **rejected**: the quiz captures what the user *wants*; hiding
"fully electric" because of a temporary stock gap turns a preference question
into an inventory filter, and options flickering in and out as stock churns
confuses more than a dead option costs. Questions always show the brand's
full authored vocabulary (national-pool dead options like MINI saloon/diesel
remain the only, static, cuts). Stock gaps are instead handled where reality
belongs: **in the results** — see fix 3.

## The fixes (in value order)

1. **Cut or fold `boot`** (static, both brands) — the one genuinely wasted
   screen. Its only real signal (big-boot need) can live inside `people` /
   `primaryUse`.
   *Built:* the question is gone; `bootNeedKey` (engine.js) derives the same
   small/medium/big need from `people` (0/1/2) + `primaryUse` (0/1), summed.
   A controlled A/B on identical answer sets shows every other question's
   sensitivity, diversity and honesty unchanged to within a point.
2. **Port MINI's body tuning to BMW** (static, tuning only): raise body's
   weight and drop `body.miss` toward 0 so a named shape is honoured whenever
   one fits. Re-run the `sens` pass after to confirm honesty rises without
   diversity collapsing.
   *Built:* BMW moved to body weight 4.5 / `miss` 0 — not MINI's 6.0, which
   BMW's deeper stock doesn't need. Honesty 53% → 67%, and diversity *rose*
   62% → 66%. MINI unchanged (mergeTuning has it restating both fields).
3. **Unmet-want honesty in results** (dynamic, replaces pruning). Today a
   user who asks for an EV at an all-petrol MINI retailer silently gets
   petrol heroes (fuelStrictBoost drags their scores down, but nothing says
   *why*). Instead, when a stated want (fuel, body style) has zero cars in
   the reachable pool, the results page says so plainly — "no electric MINIs
   near Luton right now" — and frames what it shows as the closest fit.
   Same data the pruning would have read; applied at the honest end.
   *Built:* `unmetWants` (engine.js) is reported by `/api/match` and
   `/api/nearby` for their own pools, measured against the stock as fetched
   rather than the survivors of the hard filters (a budget mismatch is not a
   stock gap). The block renders a brand-voiced note above the hero only when
   both halves agree — a failed nearby lookup sends `unmet: null` and claims
   nothing.

## Which pool decides what

*(Written when pruning was still on the table; kept because the pool
definitions still govern fix 3 — an unmet-want message must be computed
against the reachable pool, for the same reason pruning would have been:
the nearby tier may honour a want the anchor retailer can't.)*

The recurring design question: adapt to the *retailer's* stock or the *whole*
pool? The answer falls out of what each pool means to a session. A session's
results can draw on the configured retailer's stock (hero matches) **plus**
the nearby carousel — up to `NEARBY_PAGES × 100 = 400` distance-sorted cars
from other retailers (stock.js). Call that union the **reachable pool**; both
halves are already fetched and cached per session key.

| Pool | What it decides | Cadence |
|---|---|---|
| **National** (all retailers) | The *question set and option vocabulary* a brand offers. An option dead nationally is brand-intrinsic → cut statically in `brands.js`/`questions.js` (as saloon/diesel already are for MINI). Today nothing else qualifies. | Authored; revisit per `dump-stock` refresh |
| **Reachable** (retailer + nearby ≈400) | *Pruning and bounds*: hide options with zero reachable cars, skip `charging` with no reachable EV/PHEV, fit budget slider to reachable p5–p95. | Live, per session (cache already warm) |
| **Retailer alone** | *Nothing about the questions.* It only decides ranking — which cars are heroes vs "worth the drive". | — |

The rule that resolves the dilemma: **never let the anchor retailer's
inventory hide a preference the nearby tier could honour.** A user who wants
a convertible that Sytner Luton doesn't have should still get to say so —
that's precisely what "Worth the drive" exists for. Pruning against the
retailer alone would delete the question that feature answers; pruning
against the reachable pool keeps every option that can lead to a real car.
At reachable-pool scale (~400 cars) the dead-option rate collapses to near
zero anyway, so in practice this mostly bounds the budget slider and rescues
the rare all-petrol corner of the MINI network.

Implementation note (fix 3): no new endpoint needed. `/api/match` already
holds the answers and the retailer pool, and `/api/nearby` the nearby pool —
each can flag unmet wants for its own half (e.g. `unmet: { fuel: ['ev'] }`
on the response) and the block renders the page-level note. Since the two
responses arrive independently, the block should only declare a want fully
unmet once both halves agree.

## Caveats

- Random answer sets, not real-user distributions — real users pick
  correlated answers (city + small boot + hatchback), so absolute
  sensitivities are optimistic; the *ordering* is the finding.
- "Top-3 changed" counts any change, not necessarily a better result.
- Fixtures are a point-in-time snapshot of churning used stock.
- The `sens`/`size` passes sample retailers and seed a PRNG; medians are
  stable, individual cells wobble a few points between code edits.
