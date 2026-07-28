# Results page review

Walked all five result states in the browser on `engine-relayer`, 2026-07-28,
after the re-layer, the grouping, the listing picker and the listing-level
refine/reject work. The question asked was whether the page structure still
makes sense or whether it has become a stale design with bolt-ons.

**Verdict: the card is in good shape. The page around it is stale.** Not
cosmetically, structurally, and it now says things that are visibly untrue.

## The core problem: four ranked lists stacked vertically

The page is, top to bottom:

| Band | What it claims | Priya's scores |
|---|---|---|
| The matches | "Two of these fit you equally well" | 96%, 95% |
| More at *retailer* | "Close, but not level with the cars above" | 78% |
| Worth the drive | "The closest matches at other retailers" | **99%**, 97% |

Each band is ranked internally and captioned honestly on its own terms. Read as
one page, top to bottom, the scores go **96, 95 → 78 → 99, 97**. The page states
that two cars fit best and then, one scroll down, shows a 99%.

Nobody reads three lists. They read one list, and this one is not sorted.

That structure was right when there was a single ranked list and everything
below it was labelled "extra". It stopped being right when we made the top band
*dynamic* (chips, rejections, grouping, per-listing narrowing) while the two
bands below it stayed frozen snapshots of the original query.

Martin's state is the exception that proves it, and is the best page in the set:
the hero scores 71% and the cars below score 79%, but the copy explains the
relationship first ("No convertibles at Grassicks right now… starting with the
convertibles you asked for"). Given a reason, the inversion reads as helpful.
Without one, it reads as broken.

## Outright defects found while reviewing

**1. The tie headline survives the tie being broken.** Apply the "Blue" chip to
Priya and the page says **"TWO OF THESE FIT YOU EQUALLY WELL"** over a 96% and a
**73%**. They do not.

The cause is in `renderRefine`: `matching()` is `surviving().slice(0, showCount)`
with `showCount` fixed at the original lead count, and the headline is
`frame.tied({ count: shown.length })`. So narrowing back-fills the set from the
pool to keep the count, and the headline only ever counts cards — it never
re-checks whether they still tie. Back-filling is deliberate and correct (a
rejection should promote the next-best car, not leave a hole); the bug is that
nothing re-tests the claim afterwards.

**2. A car that misses a stated want gets promoted into "fits you equally
well".** The same narrowed page puts a 520d **diesel** in the tie, carrying its
own trade-off line: "Diesel, where you asked for fully electric or a plug-in
hybrid." A card cannot be in a set called "fits you equally well" and also
admit it misses the brief. One of the two statements has to go.

**3. "More at *retailer*" outranks the tie after narrowing.** It says "close,
but not level with the cars above" at 78%, above the 73% in the band captioned
as the best fits. Same root cause as 1.

**4. The listing picker is invisible in exactly the state that needs it most.**
It renders only on `big` cards, so ties never get it. Priya's tie shows "4
available · £31,498–£36,890 · Portimao Blue, Brooklyn Grey or Alpine White" with
no way to choose between them, which is the "journey ends a step early" problem
we already fixed once, still live in the state where grouped cards are most
common.

**5. The brief's count disagrees with the page.** "3 of 9 still match" over two
cards. `surviving().length` is the honest number; `matching()` shows fewer.

## Structural problems that are design, not bugs

**The page asks before it answers.** Every state runs: headline → chips → brief
→ cars. So Meg is told "Your perfect MINI is the Hatch Electric Level 3", then
asked "So, what do you fancy?", then shown a summary of her own answers, and
only then shown the car. Two interruptions between the promise and the payoff.
The chips are a tool for editing an answer you have already seen; putting them
above it inverts the transaction.

**The tool's best new work is buried.** Grouping, the picker, per-listing
narrowing and the running brief are the things that make this different from a
stock search. On the page they are, respectively: a grey line of small text, a
control that only appears in one state, an invisible behaviour, and a grey panel
above the fold that mostly repeats the quiz.

**"Not this one" reads as a footnote.** It is a small underlined link between
the reasons and the CTA. It is the second most important control on the page,
because it is the one that makes the page feel like a conversation rather than a
search result, and it is styled like a disclaimer.

**The match % is unexplained and now interleaves badly.** Known already, but the
banded layout makes it worse: four numbers from three differently-scoped lists
sit on one page with no indication they are not comparable. They *are* the same
scale (all `matchCars` scores), which is precisely why the inversions read as
errors rather than as different questions.

## What I would change

Ordered by payoff, not effort.

**1. Merge the bands, or make the relationship explicit.** The honest structure
is one ranked list with provenance on each card ("at Grassicks" / "18 miles
away, John Clark Tayside") rather than three lists in fixed vertical order.
Nearby cars scoring higher then reads as the answer, not the contradiction, and
"worth the drive" becomes a property of a card rather than a section.

If merging is too big, the minimum is to stop the bands from lying about each
other: re-test the tie claim after narrowing, and cap "more at" to cars actually
below the shown set.

**2. Answer first, then offer to refine.** Move the chips and the brief below
the cars in every state. The headline and the car should be the first two things
on the page. The refine label already reads as an invitation ("So, what do you
fancy?"); it works better after the buyer has something to react to.

**3. Give the picker to every card that has listings, not just hero cards.**
This is a small change and it makes grouping legible everywhere.

**4. Promote "not this one" to a real control**, and pair it with what it does.
Right now the buyer cannot tell that turning a car down will bring another one
in. It should look like it acts on the page.

**5. Recompute the headline from the scores, not the count.** The states in
`results-page-states.md` are all defined by relationships between scores
(decisive, cluster, taste lead). After narrowing, the page still has all the
information needed to re-derive which state it is in. It just doesn't.

## What is working and should not be touched

- **The card anatomy.** Photo, name, spec line, availability, blurb, reasons,
  trade-off, picker, CTA is a good order and reads well at both sizes.
- **The trade-off line.** "A coupé, where you asked for a convertible" is the
  single most honest thing on the page and it earns its place every time.
- **Martin's whole state.** Rescue note, then hero, then the thing he actually
  asked for. This is the model the other states should follow.
- **The brief panel's content** (not its position). "Fully electric · The
  classic hatch · £15k–25k", growing as the buyer adds constraints, is exactly
  the "the tool is listening" signal we wanted.


---

# BUILT (2026-07-28)

All of it. Commit `2beac75`. What changed and what it cost.

## Verified fixed

| Was | Now |
|---|---|
| Priya's page ran 96, 95 → 78 → 99, 97 | One list, monotonic in all six persona states |
| "TWO OF THESE FIT YOU EQUALLY WELL" over 96% and 73% | Narrowing that same page produces "Your perfect BMW is the iX2 eDrive20 M Sport" |
| A diesel admitting it misses the brief, inside the tie | Lead cluster is re-derived; a trade-off in the leader forces the closest frame |
| Picker on hero cards only | On every card that speaks for several cars |
| Chips and brief above the cars | Below them |
| "3 of 9 still match" over two cards | Counts what is on screen |
| "Not this one" as an underlined footnote | A bordered control saying what it does |

The headline is now derived from the scores on screen on every redraw, which
is why the tie → decree transition happens by itself. Previously the state was
decided once, by the server, and never revisited.

## The cost, which is a decision rather than a defect

**Merging nearby stock into the list has all but removed the decree state.**

Meg used to get "Your perfect MINI is the Hatch Electric Level 3". She now gets
"It's a four-way tie" over four cars at 97%: her local one, and three at Group
1 Bedford, Group 1 Bedford and Berry Heathrow, 17 to 26 miles away. Every
persona now lands on a tie. The decree and taste-pick states still exist in the
code and still fire on the retailer's own stock (`npm run personas` shows all
seven states unchanged, because it reads the API rather than the page), but on
the page they are almost always outvoted by an equally good car down the road.

This is honest. Those four cars do fit equally well, and pretending otherwise
was the old page's problem. But it costs two things worth naming:

1. **The payoff moment.** "Your perfect MINI is X" is what makes this feel like
   a matcher rather than a search. A four-way tie is a result; a decree is an
   answer.
2. **The commercial frame.** This block is authored onto a retailer's page. It
   now routinely leads with three competitors' cars. The old "Worth the drive"
   band was partly commercial framing, not only information architecture, and
   removing it removed that too.

### Three ways out, if this matters

**a. Weight distance into the score.** A car 20 miles away is not worth the
same as an identical one you can walk to, so a small distance penalty is
defensible on the merits rather than as a fudge. Meg's local 97 leads, the
nearby 97s drop to ~94 and fall out of the cluster into NEXT BEST. The decree
comes back and the list stays monotonic and merged. Changes what the % means,
so it needs saying on the page.

**b. Scope the headline to the retailer.** "The best at Sytner Luton is the
Hatch Electric Level 3", with nearby cars still in the list below. Preserves
the decree and the commercial frame, but the headline then names a car that is
not always first in the list, which is a smaller version of the contradiction
we just removed.

**c. Leave it.** The page is truthful and the buyer is better served. Accept
that the decree is now rare.

My recommendation is (a): it is the only one that keeps the page honest, keeps
the decree, and keeps one list. It is also the only one that requires a
scoring change, so it is the user's call, not mine.
