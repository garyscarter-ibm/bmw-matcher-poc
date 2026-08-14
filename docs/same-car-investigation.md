# "It always recommends the same MINI" — investigated

Stakeholder feedback, tested 2026-07-28. **Verdict: substantially true as
experienced, and not MINI-specific.** Reproduce with `npm run audit stick`
(new pass in `scripts/audit-questions.mjs`).

## The claim doesn't survive a literal reading

Over 300 uniformly random answer sets at Sytner Luton (27 cars in the
fixture), the tool crowns **16 distinct winners**; the most frequent takes 20%
of runs. So it is not literally recommending one car.

That is also the wrong test. Nobody uses the tool by answering randomly.

## Under realistic use, they're right

A real person answers as themselves, then tweaks one thing and looks again.
Starting from each persona's answers ([personas.md](personas.md)) and changing
exactly **one** answer to every other value it could take:

| Persona | Winner unchanged | Their winner |
|---|---:|---|
| Meg (MINI) | **93%** | MINI Hatch Electric Level 3 |
| Tyler (BMW) | **89%** | BMW 1 Series M135i xDrive |
| Martin (BMW) | 81% | BMW M2 Coupe |
| Reyes (MINI) | 78% | MINI Countryman Cooper Classic |
| Daniel (BMW) | 74% | BMW 520d M Sport Touring |
| Priya (BMW) | 63% | BMW iX2 eDrive20 M Sport |
| Chloe (MINI) | 62% | MINI Hatch Cooper C 3 Door |

**BMW 77% · MINI 78%.** Change something about yourself and roughly four times
in five you get the same car back. The complaint is an accurate description of
the product's behaviour.

**It is not a MINI problem.** BMW is equally sticky; the stakeholder happened
to notice it on MINI, where thinner stock (27 cars vs 45) makes the repetition
more obvious.

## Diagnosis: most of the quiz cannot change the answer

How often changing a single question moves the winner, under realistic answers:

| | BMW | MINI |
|---|---:|---:|
| fuel | 50% | 30% |
| bodyStyles | 42% | 46% |
| charging | 42% | 0% |
| budget | 38% | 25% |
| people | 25% | 33% |
| miniVibe | — | 50% |
| primaryUse | **0%** | 17% |
| mileage | **0%** | — |
| style | **0%** | — |
| priorities | **0%** | 7% |
| doors | — | **0%** |

**Four of BMW's nine questions never change the recommendation.** Not rarely —
never, across every alternative value, for every persona.

### Why: the arithmetic

Weights (`engine.js`): body **4.5**, fuel **2.5 + 4.0** when a fuel is named,
budget **3.0**. That's ~14 of ~19 total, about **three-quarters of the blend in
three questions**. The lifestyle dimensions — character 2.0, performance 1.5,
economy 1.5, size 1.0 — share the remaining quarter, and `priorities` only
nudges those by 1.0–1.8.

So the three constraint questions pick the car, and the five preference
questions are arithmetically incapable of overturning them. The perverse part:
**the questions that feel most personal are the ones that matter least.** A
user changes "what matters to you" and "what will you use it for", sees the
same car, and reasonably concludes the tool isn't listening.

### Ruled out

- **The tie-break is not the cause.** 53–66% of winners are decided by
  tie-break rather than a clear win, so it looked like a prime suspect. But
  letting *any* tied car win instead of the cheapest changes 16 distinct
  winners into 18 — negligible.
- **The July fuel fix is not the cause.** Measured with the old FUEL_TABLE
  restored: stickiness 76% before, 77% after. Within noise; this behaviour
  predates it.

## Why this wasn't caught earlier

The original [question-stock-audit.md](question-stock-audit.md) measured
sensitivity with **uniformly random** answer sets and reported BMW `style` at
63%, `mileage` at 67%, `priorities` at 83% — healthy-looking numbers. Under
realistic answers those same questions measure **0%**.

Random sampling pairs extreme combinations no real buyer produces (a £150k
budget with a city-car use case and economy priorities), and those collisions
manufacture sensitivity. The audit's own caveat said absolute figures were
"optimistic" — it was worse than optimistic for this question, because the
*ordering* the caveat promised to preserve also changes.

**Methodological lesson for future passes: sensitivity must be measured against
realistic answer distributions, not uniform ones.** The new `stick` pass does
that, and should be the standard for "does this question earn its screen".

## Options (not yet actioned — needs a product call)

1. **Rebalance the blend.** Raise the preference dimensions, or make
   `PRIORITY_BOOSTS` big enough to overturn a constraint tie. Cheapest change;
   risks weakening the constraint honesty the fuel/body fixes just established.
2. **Let preferences break ties instead of scoring.** Constraints narrow to a
   cluster (they already do — that's `decisive`/`clusterSize`), then the
   preference answers *choose within it*. This is what the refine chips do
   manually today; doing it automatically would make the soft questions
   decisive exactly where the engine currently shrugs.
3. **Cut the inert questions.** Repo precedent: the `boot` question was removed
   at 13% sensitivity. Four questions at 0% are a stronger case than boot ever
   was. Shortens the quiz, at the cost of the reason strings they generate.
4. **Show the user what their change did.** A transparency fix rather than a
   scoring one: if an answer genuinely doesn't change the shortlist, say so
   instead of silently returning the same car.

Recommendation: **2 + 4**. Option 2 uses machinery that already exists and
matches the product's own model of the world (constraints filter, taste
decides); option 4 is honest about the cases where nothing moved. Option 3
should follow only for questions still inert after 2.

**Designed as option 2**, with acceptance criteria and a staged build order:
[engine-relayer-design.md](engine-relayer-design.md). The conclusion there is
that this is a re-layering rather than a rewrite — every scorer, filter and
result state survives; what changes is which questions feed which stage.
