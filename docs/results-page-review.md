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
