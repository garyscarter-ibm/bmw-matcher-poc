# UX review after the engine re-layer

Walked the flow end to end against all seven personas on the
`engine-relayer` branch, 2026-07-28. The matching changes shifted which
result state most people land in, and that shift exposes one issue that now
dominates everything else.

## The headline: the tie is mostly the same car repeated

Priya's results page says **"SIX OF THESE FIT YOU EQUALLY WELL"** and then
shows:

| # | Car | Colour | Price | Score |
|---|---|---|---|---|
| 1 | BMW iX2 eDrive20 M Sport | Portimao Blue | £31,498 | 96% |
| 2 | BMW iX2 eDrive20 M Sport | Portimao Blue | £32,898 | 96% |
| 3 | BMW iX2 eDrive20 M Sport | Brooklyn Grey | £32,898 | 96% |
| 4 | BMW iX2 eDrive20 M Sport | Alpine White | £36,890 | 96% |
| 5–6 | BMW X1 xDrive25e M Sport | | | 95% |

Four of the six are the same model, and the top two are the same model **in
the same colour**, differing by £1,400 and a thousand miles. Chloe's page is
the same shape: three identical "MINI Hatch Cooper C 3 Door".

It isn't six cars. It's two models and six listings — and it reads as the page
stuttering rather than as a choice. This was logged as issue 2 in
[persona-findings.md](persona-findings.md) when ties were one state among
several; the re-layer makes the tie the state most personas land in, so it is
now the first thing a stakeholder will see.

## It is also why the new taste-pick state never fires

`tasteLead` came back **false for all seven personas**. The reason falls out of
the table above: the state only fires when the top two cars differ on taste by
6+ points, and the top two are usually *the same model*, which by definition
scores identically on character, performance and trim.

So the middle state built in this branch is currently dead code in practice —
not because the idea is wrong, but because duplicate listings sit in front of
it. Group the duplicates and the comparison becomes iX2 (taste 86) versus X1
25e (taste 87), which is a real choice the buyer's priorities could decide.

**One fix unlocks both problems.**

## BUILT (2026-07-28) — see the results below

## Recommended: group listings by model

One card per model+trim, carrying the cluster of individual listings:

> **BMW iX2 eDrive20 M Sport** — 96%
> 4 available, £31,498–£36,890, in Portimao Blue, Brooklyn Grey or Alpine White
> *[See all four ›]*

Consequences, all good:

- The "six fit you equally well" claim becomes true — it would read "two of
  these fit you equally well", which is the honest count.
- The taste pick can fire, because #1 and #2 are now genuinely different cars.
- The refine chips get sharper. Today "Blue" leaves two identical blue iX2s;
  against grouped models the chips separate models rather than listings.
- Colour stops being wasted as a differentiator between clones and becomes a
  choice *within* the chosen model, which is where Chloe actually wants it.

## Secondary findings

**TASTE_PTS needs recalibrating after grouping.** It's set to 6 points, chosen
before we knew the comparison would usually be between clones. Post-grouping
the real gaps look more like 1–2 points (iX2 86 vs X1 87), so 6 would still
suppress the state. Re-measure rather than guess.

**Tyler slipped from a decree to a tie.** He's the zero-friction persona; on
live stock he now lands on a 3-way tie where he used to get a single confident
answer. Worth checking after grouping — if his three are duplicates, grouping
restores the decree for him.

**The match % changed meaning and nothing says so.** It's now an 80/20 blend of
fit and taste rather than a single weighted sum. Four cards showing an
identical 96% is accurate but uninformative. Low priority, but if the number
stays, a hover explanation ("how well this suits what you told us") would earn
its place.

**The refine chips have no axis for the duplicate case.** When colour and
equipment are identical across listings, the only real differentiators are
price and mileage, which aren't offered as chips. Grouping mostly removes the
need; if it doesn't, add "fewest miles" / "lowest price" as axes.

## What still works well

- All five result states render correctly and the copy holds; the trade-off
  line, the rescue note and the closest-here frame are unaffected by the
  re-layer.
- Martin's state 3 improved: he now gets a single clean "closest match here"
  rather than a two-car tie of near-identical coupés.
- Meg's genuine tie (two identical Electrics, Chili Red vs Midnight Black) is
  still exactly the case the refine chips were built for, and still lands
  there. That one is a real choice and should stay a tie.


---

## Outcome after implementing the grouping

Grouped on line + body + fuel + 0-62 + trim (not on `name` — the feed writes
the same car two ways). Measured on live stock:

| Persona | Before | After |
|---|---|---|
| Priya | "SIX fit you equally well" over 4 iX2s + 2 X1s | **"TWO fit you equally well"** — iX2 (4 available) vs X1 25e (2 available) |
| Tyler | fit tie, 3 cars | **decree restored** — his 3 were one car |
| Meg | 2-way tie, identical Electrics | **decree**, one card, "2 available in Chili Red or Midnight Black" |
| Reyes | fit tie, no pick | **taste pick fires**: "We'd go for the Countryman C." |
| Chloe | 6 cards, 3 identical | 4 cars, genuine tie |

The prediction held: grouping unlocked the taste-pick state, because the top
two are now different cars rather than the same one twice. It also fixed
Tyler's regression from the re-layer for free.

Each card now carries its stock depth — "4 available · £31,498–£36,890 ·
Portimao Blue, Brooklyn Grey or Alpine White" — and the refine chips filter on
what a model is *available* in rather than on whichever listing ranked first.

**Honest note on stickiness:** it barely moved (70% → 72% BMW, 76% MINI). That
metric is now partly measuring the wrong thing: if a buyer changes one answer
and the iX2 is still genuinely the best car for them, returning it is correct,
not deaf. The metric can't tell a stable right answer from an unresponsive one.
What did improve is what the page *says* and whether the preference questions
have any influence at all (BMW `priorities` 0% → 20%, MINI `miniVibe` 50%).


## Follow-up: grouping ended the journey a step early

Caught immediately after shipping the grouping: narrowing now stopped at
**model and trim**. A card saying "4 available" linked only to whichever
listing ranked first, so the buyer never chose the actual car — and the choice
being skipped was colour, which is precisely what Chloe and Meg decide on. The
API was already sending the individual listings; the UI ignored them.

Fixed with a "Choose yours" / "Which one, then?" picker on hero cards: each
listing as a row with its colour swatch, price and mileage, and selecting one
re-describes the card and repoints the link. Meg's answer now ends where it
should — one MINI Hatch Electric Level 3, and she picks Chili Red at 11,340
miles or Midnight Black II at 15,024, both £17,500.

The funnel is now complete end to end: constraints eliminate → fit ranks →
taste chooses the model → the buyer chooses the car.


## Follow-up 2: the refine layer was still judging cards by one listing

Grouping changed what a card *is* — a model the retailer has several of — but
the refine and reject layer still tested `m.car`, the representative listing.
Three things were wrong as a result:

- **"Not the Chili Red" deleted the black one too.** Meg's card is *2
  available, Chili Red or Midnight Black II*. Rejecting the red removed the
  whole card, taking with it the exact car she'd have said yes to.
- **The chips and the reject menu disagreed about the same card.** Chips used
  `shadesOf()`, which knew a group has several colours; reject used
  `car.colour`, which knew only the first. So "Blue" kept a card that "Not the
  blue" would kill.
- **"Under £31,498"** on a card spanning £31,498 to £36,890 could not be
  answered by that card's own cheaper copies, because the test never saw them.

Fixed by moving every filter down a level: **filters test listings, a card
survives while any of its listings do, and the card is rebuilt from the
survivors** (count, price range, colour list, representative paint and link).
The API now sends `listings` for every match rather than only grouped ones, so
there is one code path instead of two.

What this buys, beyond correctness: chips now narrow *within* a card. Clicking
"Green" on "MINI Countryman C, 3 available in British Racing Green IV or Legend
Grey" leaves the green one. Previously that chip could not even appear, because
an axis only qualified while it split the *cards* — a single card offered
nothing. That implicit bound is gone, so chips are now capped at six
(`MAX_AXES`); an equipment-rich cluster otherwise produced eleven, and a wall
of chips is a filter panel, which is the thing this was built not to be.

Two smaller defects fixed alongside:

- **"Colour n/a" in the picker.** Grouping copies the representative into a new
  `car` object and leaves the originals in `listings`, so enriching one did not
  enrich the other — and alternatives' listings were never enriched at all.
  Both are now in the enrichment list, ordered visible-first, with the budget
  raised to 4.5s (the cache is permanent, so it is paid once per car ever).
  Where paint is genuinely unknown the row falls back to mileage, which is the
  next thing that actually separates two identical cars.
- **The picker only half-updated the card.** Choosing a listing changed the
  mileage and the link but left the spec line naming the previous car's paint,
  so the card described two cars at once. The spec line is now rebuilt on
  selection: paint, swatch, price, plate and mileage.
