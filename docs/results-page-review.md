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

### Decision (2026-07-28): (c) for now, (a) rejected, (b) open

**(a) is rejected, and the reason kills it properly.** Distance was never an
input. The buyer is never asked how far they will travel, so scoring a car down
for where it is parked invents a preference they did not state — and a 97% car
does not become less suitable by being in Bedford. Its suitability is
unchanged; what changed is the buyer's cost of getting to it, which only they
can price. That is precisely what `rejectOptions` refuses to do when it will
not guess which of three properties someone objected to. A distance penalty
would be the same guess, applied globally and presented as a score.

So the match % keeps meaning one thing: how well this car suits what you told
us. Nothing else may be folded into it.

**Left as (c) for now.** (b) remains open — see below for what it would have
to look like to avoid regressing to the design this replaced.


## What (b) would have to be, if we take it

The stated risk with (b) was that a retailer-scoped headline names a car that
is not first in the list. That is real, and the naive version of (b) slides
straight back into the old design: scope the headline, then order the list
local-first to match it, and you have rebuilt the bands with softer captions.

The version that works separates the two things the old page conflated.
**Bands are allowed to describe PLACE. They are not allowed to make claims
about QUALITY.** The old page failed because "Close, but not level with the
cars above" and "two of these fit you equally well" were both quality claims,
made by different sections, about the same scale — so one could contradict the
other. Labels like "At Sytner Luton" and "Also within reach" cannot contradict
anything, because they assert nothing about fit.

That gives:

- Headline scoped: *"Your perfect MINI at Sytner Luton is the Hatch Electric
  Level 3."*
- The retailer's cars, then the nearby ones, each card carrying its own
  provenance as it does now.
- No caption anywhere ranks one group against the other.

A 99% in the second group then contradicts nothing, because the headline only
ever claimed to be about Sytner Luton.

### The refinement worth having

Qualify the headline only when the qualification is doing work:

| Situation | Headline |
|---|---|
| The local leader is also the best anywhere in reach | "Your perfect MINI is the Hatch Electric Level 3." |
| Something nearby genuinely outranks it | "Your perfect MINI at Sytner Luton is the Hatch Electric Level 3." — plus the existing notice naming the better one and where it is |

The unqualified decree survives wherever it is true, which is most of the time.
The scope appears exactly when it is load-bearing, and the notice turns it from
a limitation into the tool visibly having looked further. The commercial frame
comes back: the retailer's page leads with the retailer's car, and the
competitor's car is offered as a fact rather than as the answer.

**Cost to weigh:** "at Sytner Luton" is a slightly deflating headline, and the
buyer has to notice the scope for it to be honest rather than merely narrower.


---

# BUILT: (b), and the chips moved back (2026-07-28)

Commits `14d7c73` (grouping + scope) and `41f12f8` (chips). Owner took (b);
(a) stays rejected. Screenshots: `06`/`07` before, `08`/`09` after.

## What the page does now

One pool, two groups, sorted by score inside each:

| | Group | Heading |
|---|---|---|
| 1 | The configured retailer's cars | `AT GRASSICKS BMW` / `AT SYTNER LUTON MINI.` |
| 2 | Everyone else's | `AT OTHER RETAILERS` / `ALSO WITHIN REACH.` |

Both headings name a **place** and nothing else. `NEXT BEST` is gone with the
rest: it ranked, and a ranking caption is the thing that let two sections
contradict each other. Every card still carries its own provenance line.

The headline's state (decree / taste / tie / closest) is derived from the
**retailer's** cars, re-derived on every redraw as before. It qualifies with
"at *retailer*" only when a car elsewhere **strictly** outranks the best one
here; a tie does not qualify it, because ties already break local-first. When
it does qualify, `.bmwm-notice` names the car that beat it and where it is, so
the two lines read as one statement.

## The six states, before and after

| | Before (merged list) | After |
|---|---|---|
| Meg (MINI) | "It's a four-way tie." over 97, 97, 97, 97 | **"Your perfect MINI is the Hatch Electric Level 3."** Unqualified: the nearby 97s tie, they don't beat it |
| Priya (BMW) | "five of these fit you equally well." over 99, 97, 97, 97, 96 | "At Grassicks BMW, two of these fit you equally well." (96, 95) + the iX at Arnold Clark |
| Tyler (BMW) | "three of these fit you equally well." over three 84s, none local | "Your best match at Grassicks BMW is the 320i M Sport Saloon." (taste pick restored) |
| Reyes (MINI) | "It's a four-way tie." over 95, 95, 95, 93 | "At Sytner Luton MINI, we'd go for the Countryman C." |
| Chloe (MINI) | "It's a four-way tie." over 93, 93, 93, 90 | "At Sytner Luton MINI, it's a three-way tie." (90, 89, 87) |
| Martin (BMW) | "three of these fit you equally well." over three nearby convertibles | "Your closest match at Grassicks BMW is the M2 Coupe." + rescue note, unchanged |

**The decree came back for Meg only.** The doc predicted the unqualified decree
would survive "most of the time"; it doesn't. Five of six pages still scope,
because at this stock depth somebody within reach usually has something a point
or two better. What (b) actually bought is smaller and still worth having: the
page is now about the retailer it is authored onto, the decree is reachable
again, and **all seven page states agree with what `npm run personas` reads off
the API**, which they did not before (the page said "tie" where the engine said
decree or taste pick).

## Two decisions taken while building it

**Full cards in group 2 are exactly the cars that outrank the best one here**,
clustered by the same `CLUSTER_PTS` rule so the cut lands on a score gap rather
than an arbitrary cap. Everything else there is a tile. This preserves what the
merge was for: a genuinely better car is a card you can reject and read the
trade-off line on, not a tile you have to notice. It is a treatment, not a
caption. No heading says one group beats the other.

**The notice stands down only for the car a rescue note already names.** Martin
would otherwise read "no convertibles here, the nearest is 18.1 miles away at
John Clark Tayside" and then "the 420i Convertible at John Clark Tayside scores
higher". Reyes keeps both lines, because there the note is about a plug-in
hybrid 29.5 miles away and the notice about a Countryman 10.8 miles away.

## What is still weak

- **Meg's page shows three 97% cars under an unqualified "your perfect MINI".**
  Equal scores don't trigger the scope by design (the doc's rule), and the
  tie-break gives the local car the lead, so nothing on the page is false. It
  is still the place a careful reader could push back.
- **Meg now has no chips at all.** Her lead is one card and the offered axes
  are fixed at first paint from the local top six, so none of them still splits
  a single card's two listings. Defensible (the picker covers the colours), but
  it is a capability the four-way tie had.
- **The chip label counts the lead, not every card the chips touch.** A chip
  narrows the whole pool, including group 2. "Narrow these 2 down" points at
  the two cards below it, which is what the chips are offered for (an axis only
  appears while it splits the lead), but it undercounts the visible effect.
- **Scoped headlines are longer.** "At Sytner Luton MINI, it's a three-way tie."
  is a heavier line than "It's a four-way tie.", and on MINI it sets in
  uppercase display serif.


## Correction (2026-07-29): the brief goes back above the cards

"Answer first, then argue with it" moved two things below the grid. It was
right about one of them and wrong about the other, and the difference is what
each thing IS:

- **The chips are a control.** Controls must be visible and next to what they
  control. Fixed earlier: they are back above the grid with a label naming the
  effect and a live count.
- **The brief is a signal, not a summary.** This is where the original
  reasoning failed. It was filed as "a summary belongs after the thing it
  summarises", which is true of summaries and false of this one. Nobody scrolls
  past fourteen cars to read what they themselves typed, so the one element
  whose whole job is to say *the tool holds a model of you* became the one
  element never seen.

Both now sit above the grid, and moving them surfaced two duplications that
were invisible while they were apart:

1. **The applied filters were said twice** — as `+ Blue` in the brief and as a
   removable `[Blue ✕]` chip. Only one of them could be undone. The brief's
   copy is gone; the chip stays.
2. **Two different counts landed two lines apart** — "3 of 13 still match"
   (the whole pool) above "1 of 2, with blue." (the lead). Whichever is more
   useful, a reader has to work out they are not the same measurement. The
   brief's count is gone and `briefCount` deleted from both brands; the chip
   row's own status line keeps it, next to the control that moves it.

**Then corrected again, the same day.** Deleting the "+ Blue / − Not the red"
rows was an over-correction. A chip and a statement are not the same register:
"+ Blue, − Not the red" reads as a model of a person, a row of pills reads as
a filter bar, and the model is the thing this tool has that a stock search
does not. The +/- mark also carries meaning the pills flatten, since a want
and a rule are different kinds of statement.

The duplication objection was still right, so the fix is which one goes, not
whether the list survives. **Applied state now lives only in the list**, with
its own undo; the chip row carries only what could be added NEXT. Each
constraint is stated exactly once, in the register that suits it, next to the
control that clears it. The single count moved into the same panel, because it
belongs with the statements that caused it.


## The count's scope (2026-07-29)

Gary asked whether "1 of 2" only covered the configured retailer's stock, and
whether it needed qualifying per state ("1 of 2 at Grassicks"). It did, and it
was narrower still: `shown` was the local LEAD CLUSTER, so the number ignored
the local tail tiles as well as the entire other-retailers group, while the
chips and rejections cut all three.

Qualifying it would have made it accurate and left it silent about a group
visible on the same screen, which invites "so what happened to those?". The
count is now taken across everything the constraints act on, which removes the
need for a qualifier: one number, one scope, the scope the controls have.

Measured on Priya: the Blue chip takes it to "3 of 13 still match, with blue."
with three cards on screen; a mileage rejection to "1 of 13" with one card;
undoing the chip to "4 of 13" with four. The number and the cards now agree,
which is what makes it checkable rather than merely stated.

**Superseded the same day: the denominator is gone.** See below.


## Relevance, and the death of the denominator (2026-07-29)

Gary asked why Priya's page carried "a load of ~70% matches" under two cars in
the high nineties. The scores answer it:

    96 95 | 78 75 74 73 73 72 71
           ^ a 17-point cliff

Two genuine matches, then six cars answering a different question, under a
headline about how well the first two fit. **A car eighteen points back is not
an alternative, it is a change of subject.** The tail was a flat six per group
and blind to score.

### RELEVANT_PTS = 10

Measured against all eight personas' live distributions. It lands on the
natural cliff in six of the eight and gives a sensible answer in the other two:

| Persona | Scores | Cliff | Within 10 |
|---|---|---|---|
| Priya | 96 95 · 78 75 74 73 73 72 71 | 17pt after #2 | 2 |
| Meg | 97 · 67 65 65 62 62 62 42 41 | 30pt after #1 | 1 |
| Reyes | 93 90 90 90 90 85 · 66 59 59 57 56 | 19pt after #6 | 6 |
| Tyler | 79 76 70 · 60 31 29 | 29pt after #4 | 3 |
| Daniel | 89 83 82 · 73 68 63 62 62 61 | 9pt after #3 | 3 |
| Chloe | 90 89 87 83 83 · 76 69 66 64 | 7pt after #5 | 5 |

It has to be RELATIVE. An absolute floor of 70 shows Priya all nine of hers
and Rob Jennings none at all, his best being 67. The floor is taken from the
best car anywhere on the page rather than each group's own best, so both
groups are judged by one standard.

Priya's page goes from twelve cards to six. `TAIL_SHOWN` stays as a backstop
but rarely binds now.

### The count loses its denominator

Three scopes were tried and all three were wrong:

1. **"1 of 2"** counted the local lead, while the same chip was also cutting
   cars at other retailers shown directly below.
2. **"9 of 13"** fixed the scope but put an invisible number in the
   denominator. Nobody can see thirteen cars to check it against.
3. The relevance bar then made the pool hold cars the page has *deliberately
   decided not to show*, so counting them measures against a set that does not
   exist for the buyer.

What the buyer wants to know is whether the last tap did anything and whether
there is still a choice. **"One car still matches, with blue."** answers both,
is checkable against the cards, and cannot be mis-scoped because it claims
nothing about a total.

### Open question

Meg's page is now a single card. That is correct (nothing else is within 30
points) and it is the decree working as designed, but a results page holding
one car and nothing else may read as thin rather than as decisive.


## Showing the working (2026-07-29)

Meg's page can hold a single card. That is correct, and it still reads as thin
stock rather than as a clear winner, because **the reader cannot tell whether
we searched three cars or three hundred.**

Two ways out were considered.

**Rejected: put weaker cars back.** Her next car is 67 against 97, thirty
points down, which the relevance work above had just established is a change
of subject rather than an alternative. It would reintroduce exactly the noise
that work removed, it would not prove thoroughness (a seven-card page is
equally silent about how many were rejected), and a card is an *invitation*:
offering a car thirty points off the pace to prove it isn't worth having
undermines the claim it was meant to defend.

**Built: say what we did.** The gap was never missing cars, it was missing
evidence of the search. `matchCars` now returns `searched: { total, eligible,
margin }`, and the page closes with it:

> **HOW WE GOT THERE**
> We looked at all 26 MINIs in stock here. 20 were in budget and roomy enough.
> Nothing else here got within 30 points.

This is also the first time the page shows its reasoning at all. `how-it-works`
describes the engine as *constraints eliminate, fit ranks, taste chooses*, and
until now the page showed only the last step's output.

Two things it took two attempts to get right:

- **The margin is measured over the RETAILER's cars, not everything.** Measured
  over everything it never fired once: nearby stock ties at the top on every
  persona (Meg's 97 against three nearby 97s), so the claim was true,
  unclaimable and effectively dead code. Scoped to this retailer it says the
  useful thing, and it matches what the headline is scoped to after (b).
- **It is recomputed per redraw, not taken from the API.** So it re-states as
  the buyer rejects: Priya earns no claim at first (96 against 95) and a
  17-point one after turning her leader down; Martin's goes 10, then 3.

Claimed only at `CLUSTER_PTS` or more. "Nothing else came within 1 point" is
not a boast.

**Honest scope note.** The claim covers the configured retailer's own feed,
which we hold in full. It deliberately says nothing about nearby stock: the
national search is capped at four pages, so any "we looked everywhere" claim
would be false.
