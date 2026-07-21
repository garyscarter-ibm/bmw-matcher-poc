# A MINI-first question set — proposal

Status: **built and validated (2026-07-21).** Follows
`docs/question-stock-audit.md` (which established the current set works for
MINI but is inherited from BMW's range shape) and the range investigation of
2026-07-21 (no sanctioned source for the new-car range exists; everything
below is measured from the used-stock dumps' `derivative` field, which
carries trim and doors). The proposal below is preserved as written; the
"Built + validated" section at the foot records what shipped and the audit
numbers after.

## Built + validated

All four changes landed for MINI only (BMW is provably untouched — see below):

- **Parsing** (`mapping.js`): MINI derivatives now yield `styleLine`
  (classic/exclusive/sport/jcw, else null) and `doors` (3/5, Hatch only,
  else null). Coverage: styleLine parses for **53%** of MINI stock, doors for
  **50%** — the older "Cooper S 3 Door" naming states the performance *tier*
  (C/S), not a style *word*, so ~47% score neutral on styleLine (never
  penalised — unknown ≠ wrong). BMW: both null everywhere.
- **Scoring** (`engine.js`): `scoreStyleLine` + `scoreDoors`, weighted only
  for MINI. A dimension a brand doesn't weight, or whose question wasn't
  answered (no vibe; doors = "either"), is fully inert — it never dilutes.
- **Questions** (`brands.js`): MINI drops `mileage` + `style`; adds a
  conditional `doors` question and repoints `miniVibe` at the real trim lines
  (Classic/Exclusive/Sport). The vibe's `scoresAs` folds `styleLine` **and**
  the `style` value the dropped question used to collect.

Audit `sens` after (40 retailers/brand, 300 answer sets):

| | MINI before | MINI after | BMW before | BMW after |
|---|---:|---:|---:|---:|
| Outcome diversity | 37% | **47%** | 66% | 66% |
| Body honesty | 72% | 70% | 67% | 67% |
| Top-1 score (median) | 79 | 77 | 76 | 76 |

Per-question sensitivity, MINI after: budget 100%, bodyStyles 90%,
people 90%, **miniVibe 87%**, fuel 80%, primaryUse 77%, priorities 70%,
**doors 40%**, charging 40%.

Reading it: MINI **outcome diversity rose 10 points** — the quiz is
materially more expressive. The repointed **`miniVibe` jumped to 87%** (from
~60% as invented vocabulary), now one of MINI's strongest questions. `doors`
earns its conditional screen at 40% despite only half of stock stating a
count. Body honesty and top-1 score held within run noise. **Every BMW
figure is identical** — the new dimensions are inert for it, confirmed by a
same-answers A/B test in `brand.test.js`.

Open questions 1–3 below were resolved as the proposal recommended: JCW folds
into Sport, "Electric era" dropped (fuel carries it), editions parse to null.

## The question this answers

If we designed the quiz for MINI first — no BMW context — would it ask the
same things? The audit already showed most of the current set *works* for
MINI (body 90% sensitivity, people 90%, fuel 80%). What it couldn't show is
what's *missing*: dimensions of MINI's range the quiz never asks about. The
`derivative` field answers that.

## Evidence: how each brand's range actually splits

Measured across the national dumps (13,066 BMW / 4,285 MINI vehicles):

| Dimension | MINI | BMW |
|---|---|---|
| Model lines (effective¹) | 9 (2.2) | 51 (14.2) |
| Body → model line | 100% determined | 15% determined |
| Style line (trim) | Exclusive 16.7% / Classic 15.2% / Sport 13.4% / JCW 7.5% | **M Sport 73.0%**, nothing else >2.7% |
| Performance tier | base 52.5% / S 40.0% / JCW 7.5% | (not comparable — M is its own model line) |
| Doors, within Hatch | 3-door 55% / 5-door 45% (stated for 83.3% of hatches) | stated in 0.5% of all derivatives |

¹ effective = perplexity of the distribution; "how many choices it behaves
like" once the long tail is discounted.

Two MINI dimensions split the range hard and are invisible to the quiz.
Both are also *near-dead for BMW* — the exact mirror of the `boot` finding
(a BMW-shaped question that was dead weight for everyone). The brand
`add`/`drop` hook exists for precisely this asymmetry.

## The orthogonality test — which axis is genuinely new information

A new question earns a screen only if the engine can't already infer its
answer. Median price / 0-62 by group:

| Group | n | price | 0-62 |
|---|---|---|---|
| **Perf tier** base | 2,306 | £20,295 | 7.7s |
| Perf tier S | 1,659 | £21,699 | 6.6s |
| Perf tier JCW | 320 | £28,990 | 6.1s |
| **Style line** Classic | 653 | £16,707 | 7.7s |
| Style line Exclusive | 714 | £19,495 | 7.7s |
| Style line Sport | 576 | £18,890 | 7.3s |

- **Performance tier is NOT new information.** Base → S → JCW is a clean
  price + 0-62 ladder, and the engine already scores both (the 0-62 curve
  sees a JCW at 6.1s vs a base at 7.7s; budget sees the £9k spread). The
  `style` question plus `priorities:performance` already steers between
  tiers. **Do not add a trim-tier question** — it would re-ask what
  comfort-vs-sporty and budget already answer.
- **Style line IS new information.** Classic vs Exclusive vs Sport is an
  aesthetic register — near-identical 0-62 (7.3–7.7s) and overlapping
  prices. Nothing the engine scores distinguishes a Classic from an
  Exclusive; today it recommends between them arbitrarily.
- **Doors are new information.** Pure use-case preference (kids in the
  back vs looks), not derivable from anything asked, and it cuts MINI's
  single biggest line (Hatch, 60% of stock) roughly in half.

## Proposal

### Add 1 — doors, for MINI, conditional on hatch interest

> **THREE DOORS OR FIVE?**
> Three is the icon. Five makes the school run easy.
> · The classic three-door · Five-door practicality · Either works

- Conditional: shown only when `bodyStyles` includes `hatchback` or `any`
  (same `conditional` mechanism the charging question uses).
- Scoring must be a *soft* preference, and cars whose derivative doesn't
  state a door count (~17% of hatches) must score **neutral, never
  penalised** — unknown is not a miss. Non-hatch bodies are unaffected
  either way.

### Change 2 — repoint `miniVibe` at the real style lines

`miniVibe` (classic charm / electric era / JCW) already reaches for the
style-line axis but with invented vocabulary, and its electric option
duplicates the fuel question. Rather than adding a fourth bespoke question,
make the existing one speak the range's actual language:

> **WHICH MINI ARE YOU?**
> · **Classic** — timeless, pared-back, the icon (n. Classic trim)
> · **Exclusive** — plush, polished, a little fancy (n. Exclusive trim)
> · **Sport** — stripes, spoilers, go-kart energy (n. Sport trim, JCW when
>   you mean it)

Each option maps to real trim vocabulary the retailer uses on the car's own
listing page, so the "why this car" reasons can say *"Sport trim, just like
you asked"* — a reason we currently cannot give. Sport keeps the
`scoresAs: { style: 5-ish, priorities: performance }` nudge that JCW has
today, so the perf-tier steering `miniVibe` already provides is preserved.

### Remove 3 — drop `mileage` for MINI, fold `style` into the vibe

The mirror of the additions: a MINI-first set is *shorter*, not just
different. A removal A/B — rank identical answer sets with each answer
present vs deleted (as if never asked), 40 MINI retailers × 200 sets, BMW
as control — measured what each question is actually worth:

| MINI question | top-3 changes | winner changes | Δ winner score |
|---|---:|---:|---:|
| mileage | 27% | **8%** | 0.6 |
| style | 24% | **9%** | 0.8 |
| miniVibe | 28% | 11% | 1.5 |
| priorities | 42% | 16% | 2.1 |
| charging | 27% | 17% | 2.4 |

- **Drop `mileage` for MINI** (the never-used `questions.drop` hook). It
  changes the recommended car for 8% of users, and by 0.6 points when it
  does — the weakest question on every measure. Structural, not marginal:
  mileage exists to arbitrate diesel-vs-petrol running costs, and MINI has
  11 diesels in 4,285 cars. The EV-viability signal it also carries already
  lives in `charging`. BMW keeps it (12% winner-change, and diesel
  arbitration is real there) — so this is `drop`, MINI-only.
- **Fold `style` into the repointed vibe, don't just delete it.** Also weak
  standalone (9%), for the same structural reason as `boot`: on a
  one-model-per-shape range, comfort-vs-sporty rarely separates cars the
  body question hasn't. But its signal (the sporty→performance weight nudge,
  the comfort tag) shouldn't vanish — the Classic/Exclusive/Sport vibe
  carries it through `scoresAs`, exactly as `boot` folded into
  `people`/`primaryUse`. Two overlapping character questions become one.

**Keep `charging` and `priorities`.** The A/B first made `charging` look
cuttable, but a missing charging answer defaults to `'none'` (engine.js) —
i.e. "can't charge", which suppresses EVs — so its 17% is the question
doing real work, and it gates whether an EV can be honestly recommended at
all. It's already conditional (EV-curious users only). `priorities` (16%)
feeds the reasons copy as well as the ranking.

Net: MINI moves from 10 questions to ~8 (drop mileage, merge style into
vibe, add doors — shown only to hatch-interested users), each earning more
of its screen; BMW keeps all 10, both cuts being MINI-scoped via the hook.

Caveat: random answer sets overstate answer independence (real users answer
in correlated clusters), and this measures ranking impact only — being
asked about annual miles may carry a "this quiz is thorough" trust value
the numbers can't see. That last point is a product call.

### Not proposed

- **A perf-tier (Cooper/S/JCW) question** — redundant; see the
  orthogonality test.
- **Any BMW change.** M Sport at 73% means trim carries almost no signal;
  doors carry none. This entire proposal is `mini`-scoped via the brand
  hook, which is the architecture working as designed.
- **Dropping `mileage`/`style` for MINI.** Both scored middling-not-dead in
  the audit (43%); cutting them is a separate decision and needs its own
  A/B, not a ride-along here.

## What it takes to build

The blocker is that trim and doors currently die in mapping: `mapVehicle`
never reads them out of `derivative`, so the engine cannot see them.

1. **mapping.js** — parse `derivative` per brand into two new optional car
   fields: `styleLine` (`classic|exclusive|sport|jcw|null`) and `doors`
   (`3|5|null`). MINI's 146 distinct derivatives make this a tractable,
   testable parse; BMW simply never sets the fields.
2. **engine.js** — two small scorers (or one "fit" scorer) that no-op when
   the car field or the answer is absent. BMW never asks, so BMW behaviour
   is provably unchanged; the engine stays brand-agnostic (fields are
   generic, only the MINI question feeds them).
   Note the bespoke-question hook as-is is NOT enough: `scoresAs` can only
   remap onto *existing* standard answers, and no standard answer carries
   doors or style line. The hook gains a way for a bespoke answer to pass
   through to these scorers — that's the one genuinely new mechanism.
3. **questions.js / brands.js** — the doors question under `questions.add`;
   `miniVibe` options repointed. Copy per the MINI tone guide.
4. **Card reasons** — new reason strings ("Sport trim, just like you
   asked"), which also means `publicCar` may expose `styleLine`/`doors` as
   display fields. They're on the retailer's own listing page, so exposing
   them leaks nothing.

## Validate before building the UI

The audit harness can measure both proposed questions **offline, before any
UI work**: teach `scripts/audit-questions.mjs` the two candidate questions
(and mapping the two fields), then check
(a) their flip-one-question sensitivity — a proposed question that scores
under ~40% at median MINI retailers is not worth its screen, and
(b) that `bodyStyles`/`style`/`priorities` sensitivity doesn't drop
(cannibalisation — most likely between the Sport option and `style`).
Thin-stock behaviour needs particular attention: at a 27-car retailer with
four Sport cars, a hard style-line preference could collapse diversity the
way body did for MINI pre-tuning; the scorer weights should be tuned against
the same A/B method used for the body fix.

## Open questions (Gary)

1. Repointing `miniVibe` loses "Electric era" as a vibe (it duplicates
   `fuel`, but it may have brand-marketing value the data can't see). Keep
   a fourth option, or let fuel carry it?
2. Should JCW be Sport's "when you mean it" extreme (proposed) or its own
   option? Own-option risks re-adding the perf-tier redundancy.
3. Trim names drift per generation (Resolute/Untamed editions exist in the
   tail). Parse maps them to the nearest of the three lines, or to null?
