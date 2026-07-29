# The results page, main vs now, against personas v3

Assessed 2026-07-29 on `engine-relayer` at `31af0cb`, against `main` at
`01cd26b` run side by side from a worktree (main on :8788/:3001, current on
:8787/:3000) so both were driven with live stock through the same browser.

Personas v3 added triggers, money, and a **"walks away when"** clause to every
persona, plus **Rob Jennings**, a deliberate rejector. The walk-away clauses
are the useful part: they are pass/fail conditions rather than descriptions.

**Verdict in one line: the page architecture is now clearly better, and the new
personas are mostly failing it on something else entirely.**

## What got fixed, measured

Every `main` page tested has an inverted score order. Every current page is
monotonic within each group.

| Persona | main | now |
|---|---|---|
| Daniel | 91 82 81 **91 91 91** 81 86 | 89 83 82 ‖ 89 89 89 85 83 |
| Priya | 95 95 95 95 95 95 **98** 97 97 97 97 | 96 95 ‖ 99 97 97 97 |
| Martin | 76 65 57 **81 80 78** | 71 ‖ 79 79 76 |
| Tyler | 81 73 73 **85 85 85** 77 | 79 76 ‖ 84 84 84 78 |
| Rob | 68 65 63 **73 73 73** 68 | 67 65 ‖ 75 70 70 68 |
| Chloe | 87 87 87 86 84 **91 91 91** | 90 89 87 83 83 ‖ 93 93 93 |
| Reyes | 91 90 87 88 **93 92 92** 89 | 93 90 90 90 90 85 ‖ 95 95 95 91 89 |
| Meg | 96 96 **67** 96 96 96 | 97 ‖ 97 97 97 |

Meg's main row is the cleanest example of the old shape's problem: **"It's a
two-way tie"** with a 67% wedged between the 96s. Read `main`'s Priya row as a
buyer would: **"six of these fit you equally
well"** over six 95s, and a **98** four cards below them. Chloe's is worse in
its own way, **"It's a five-way tie"** over 87 87 87 86 84 with three 91s
underneath, and **sixteen chips** above it, which is a filter panel rather than
a nudge.

Three other differences that matter:

- **Card count.** main shows 6 to 11 cards regardless of score. Now it is 4 to
  8, bounded by relevance, so nobody sees a 73% under a 96% headline.
- **Chips.** Chloe goes from 16 to 2. The axes are now judged on whether they
  would change anything.
- **Scope.** main's headline never says which retailer it searched. Four of
  seven now do, and only when a car elsewhere actually outranks the local one.

The listing picker and the working note do not exist on main at all.

## Persona by persona, against the walk-away clause

| Persona | Walks away when | main | now |
|---|---|---|---|
| Daniel | gap in service history; warranty behind a lead form | no lead form ✓, service history absent ✗ | same |
| Priya | a boot claim she cannot picture; ISOFIX she cannot confirm | both absent ✗ | same |
| Martin | he is handled; a result that ignores what he asked for | admits the miss ✓ | admits it and says where ✓✓ |
| Tyler | total monthly crosses the line; details asked before numbers | no monthly, no insurance ✗ | same |
| Chloe | told which car is "best"; a wall of grey | 16 chips, no colour choice ✗ | 2 chips, picker, colour named ✓ |
| Reyes | practicality reads like brochure copy | reasons are generic ~ | same ~ |
| Meg | gearbox implied not stated; battery condition left unasked | both absent ✗ | same |
| Rob | the tool recommends rather than filters | admits the miss ✓ | admits it, and shows the filter ✓ |

## The finding: v3 is testing content, and the page has none of it

Five of the eight walk away on a **fact neither version prints**:

- **Gearbox is never stated on a card.** It exists only as a filter chip.
  Meg's clause is explicit that implied is not good enough.
- **Battery state of health does not exist** anywhere in the system. Meg is a
  used-EV buyer and this is her stated dealbreaker.
- **Boot is never shown**, in litres or in her terms. Priya's clause asks for
  buggies-plus-dog, and we do not even give her the number.
- **ISOFIX is not in `CONCEPT_LABELS`**, so it can never appear as equipment or
  as a chip.
- **No monthly payment and no insurance group.** Tyler's whole decision is the
  total monthly, and the page shows a cash price.

None of that is a results-page structure problem, and none of it was
introduced by this branch. It is the personas getting sharper and finding the
next layer. Worth saying plainly: **the architecture work is done and the
content work has not started.**

## Rob is the sharpest test, and we half-pass

Rob walks away when "the tool recommends rather than filters", and winning him
looks like the tool saying **"we do not have the right car for you this week"**
when that is true.

His numbers are the ones to look at:

    top match 67%, and it carries a trade-off: he asked for an estate, got a saloon
    11 of 48 cars survived his budget

Both versions do better than expected here. The headline is already **"The
closest matches at Grassicks BMW."**, not a recommendation, and the card admits
what it misses. The current version adds the funnel, *"We went through all 48
BMWs in stock here. 11 were in budget and big enough for you."*, which is
literally the filter-not-recommend evidence he is asking for.

**Where we still fail him: there is no confidence band.** A 67% leader is
presented in exactly the same voice as an 85% one. Nothing distinguishes "this
is a good answer" from "this is the least bad of eleven", except the score
badge, which is unexplained. The page can say *the closest here misses your
brief*, and it can say *nothing here is close to what you asked for*, but it
only has words for the first.

## Recommended next, in order

1. **A low-confidence state.** When the best local car is below a threshold, or
   misses a primary want, say so instead of presenting closest matches as an
   answer. The working note already carries the raw material ("11 of 48"), so
   this is mostly copy plus one threshold. Closes Rob, and strengthens Martin.
2. **State the gearbox on the card.** One word in the spec line. Closes Meg's
   first clause outright and costs nothing, the data is already there.
3. **Boot and seats on the card**, in numbers. Closes half of Priya's clause.
4. **Battery state of health** for used EVs, if the feed carries it. Needs a
   check against the PDP data before promising anything.
5. **Monthly and insurance group** are the biggest content gap and the biggest
   lift; Tyler cannot be satisfied without them.

   **Correction (2026-07-29, from Gary):** the monthly figure IS obtainable.
   The usedcars sites let you toggle price display to monthly cost, so the
   number exists on the same platform we already read stock from, rather than
   needing a finance API. My "not in the feed" was true of `cash_price` on the
   list endpoint and wrong as a conclusion about the source. Deferred to a
   separate feature, not written off. Insurance group is still genuinely
   external and remains out of scope.

Items 2 and 3 are small. Item 1 is the one that changes what the tool is
willing to say, which is the thing Rob was added to test.
