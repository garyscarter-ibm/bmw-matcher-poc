# Checklist match — a score that can read 100%

Status: **built for review** on branch `feat/checklist-match` (off
`feat/question-set-fixes`). Answers the recurring question: a buyer who asks
for N things and finds a car that meets all N expects to see 100% — but the
blended score never says that. This changes *what the number measures*.

## The problem

The engine's blended `score` answers "how good is this car for you, weighted
by your priorities" — a panel of eight judges, several grading on a curve
(0–62 time, character-tag overlap, size). Perfect 10s on those need a car
that barely exists, so a real car tops out in the low 90s and a literal 100
never happens. That's honest, but it measures the wrong thing for the mental
model a buyer brings: *"I asked for these things — how many did I get?"*

## The split: asks vs context

Not every answer is an ASK. Some are things a car can meet or miss; others are
CONTEXT about the buyer that steer the ranking but that no car "meets".

| Ask (a car meets/misses it) | Context (steers ranking, not "met") |
|---|---|
| budget, body style, fuel, seats (family/crew), doors (MINI), trim (MINI) | charging, annual mileage, priorities, primary use, comfort/sport lean |

"No preference" answers (`any`, `open`, "just me") state no ask at all. So the
checklist denominator is only the asks the buyer *actually stated*, and a car
meeting all of them is a genuine **100%**.

## What shipped

- **`matchChecklist(answers, car, tuning)`** (engine.js) → `{ met, missed }`,
  each an `{id, label}`. `matchPct = met / (met + missed)` — or null when no
  ask applies. Attached to every ranked match alongside the blend.
- **Satisfaction-first ranking**: `rankCars` now sorts by matchPct first, blend
  second. So a car that meets more of your asks leads, and the blend only
  breaks ties among equally-satisfying cars (the quickest of the cars that
  tick every box still wins). This is the dealership model: "these three all
  fit your brief — here's the one I'd pick, and why."
- **The card shows matchPct** (can be 100%), not the blend, with a plain-English
  line under it — "Meets everything you asked for" / "Meets 4 of your 5 asks"
  (BMW), "Ticks every box you gave us." / "Ticks 3 of your 4 boxes." (MINI).
- **Trade-offs section** on the hero ("Worth knowing" / "THE SMALL PRINT."):
  the asks this car *misses*, phrased as shortfalls ("Petrol, not the fuel you
  picked"). Usually empty — the top match tends to meet everything, and an
  empty section is itself a signal. The blend still powers the "Why it suits
  you" reasons, so quality and shortfalls sit side by side.
- **The drawer** (mid-quiz) shows matchPct too — computed against the asks
  answered *so far*, so after budget alone an in-budget car honestly reads
  100% ("of what you've told us"), and differentiation appears as answers
  land. This is the original "why is an in-budget car only 70%?" complaint,
  fixed: early under-scoring is gone.

## Two deliberate design calls

- **Unknown ≠ miss.** A trim or door count we couldn't read from the
  derivative (≈47% of MINI stock states no style word) is N/A — it's left off
  that car's checklist entirely, never counted as a miss. Consequence worth
  knowing: a "Cooper S 3 Door" with an unreadable trim shows 100% for a Sport
  seeker (we can't claim it misses what we can't read). It still ranks below a
  confirmed Sport car via the blend tie-break. Penalising a car for our
  parsing gap would be the worse error.
- **The number stops encoding quality.** A base Cooper and a JCW can both be
  100% for a sporty brief. That's intended — quality moved to rank position
  and the reasons copy, where it always belonged (a percentage was a strange
  place to hide "this one's faster"). Ties at 100% are common at a thin
  retailer; ordering + reasons carry the rest.

## Precedence with the unmet note

The page-level unmet note (from the earlier honesty work) states *pool*-level
gaps ("No fully electric MINIs nearby"); the card trade-offs state *car*-level
ones. When both would name the same want, `pruneTradeoffs` drops it from the
card once nearby resolves — the page owns that shortfall at the top, so it
isn't said twice. When a want has stock in the pool but not on this car (an EV
exists, just not as the convertible you wanted), the two are independent and
both correctly show.

## Validation

- 54 server tests pass (7 new): 100% when all asks met, context/no-preference
  excluded, wrong-fuel miss, stretch → budget miss, unknown trim is N/A,
  satisfaction-first ordering.
- Live in-browser (MINI, real Sytner Luton feed): a sport/3-door/petrol brief
  renders a 100% hero ("Ticks every box you gave us."); an EV-convertible
  brief renders a 75% hero ("Ticks 3 of your 4 boxes.") with a "THE SMALL
  PRINT." trade-off ("Petrol, not the fuel you picked"), correctly ranked
  above the wrong-shape EVs. No console or server errors.

## To weigh (review)

1. **Satisfaction-first ranking changes the hero** in edge cases (a
   fully-matching-but-plainer car now tops a stellar-but-misses-one car). This
   is the intended dealership model, but it's a real change to the ranking —
   worth a gut-check against a few briefs.
2. **BMW copy** ("Meets everything you asked for") vs MINI's playful register —
   both drafted; tune to taste.
3. **The number's lost authority.** If the retailer wants the algorithmic feel
   back, an option is matchPct primary with the blend shown small + secondary.
   Not built — flag if wanted.
