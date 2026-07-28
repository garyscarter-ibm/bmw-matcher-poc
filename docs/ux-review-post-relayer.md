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
