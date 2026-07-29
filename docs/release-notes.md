# Matcher update: what's changed and why

For stakeholders. Covers the work on the `engine-relayer` branch, 2026-07-21
to 2026-07-29. Non-technical; the workings behind each claim are in `docs/`.

---

## At a glance: the feature list

### Matching

| | What it does |
|---|---|
| **Split scoring** | 80% "does this suit you", 20% "would you like it", with the taste half protected so it cannot be squeezed out. The preference questions now change the answer; BMW's went from 0% influence to about 20%. |
| **Grouped listings** | Four identical cars are one result carrying the spread, not four results. Fixes the page looking like it was repeating itself. |
| **Relevance cut** | Nothing appears more than ten points behind the best match. One page dropped six results in the low seventies from underneath two in the high nineties. |

### The results page

| | What it does |
|---|---|
| **One ranked list** | Replaces three separate lists that contradicted each other. One page used to run 96, 95, then 78, then 99. |
| **Grouped by place** | The retailer's own stock first, then cars within reach elsewhere. Each card says where it is, and the host retailer is never visually outweighed by cars from other showrooms. |
| **Live headline** | Re-checked on every interaction rather than decided once, so it is always true of what is on screen. Narrowing a tie to one car turns it into a straight recommendation by itself. |
| **Retailer-scoped headline** | Names the retailer only when a car elsewhere genuinely beats the local one, with a line saying which and where. |
| **Smarter filters** | Chips appear only when they would change something. One page went from sixteen to two. They stay available all the way down to a single car. |

### Choosing a car

| | What it does |
|---|---|
| **Pick the actual car** | Once it is down to one model, choose which of the retailer's copies: colour, price, mileage. Photo, paint, price, gearbox and link all follow the choice. |
| **"Not this one"** | Turning a car down offers a reason ("not the red", "under £31,498"), applies it, and brings the next car up. |
| **Filters work inside a card** | "Green" on a card with three colours leaves the green one, rather than keeping or discarding all three. |

### What each card tells you

| | What it does |
|---|---|
| **Gearbox** | Stated, not implied. A stated dealbreaker for one of our buyer profiles. |
| **Boot and seats** | So a practicality claim can be checked rather than taken on trust. |
| **ISOFIX** | Shown as equipment and available as a filter, for buyers fitting child seats. |
| **Colour, with a swatch** | Where the engine cannot separate two cars, paint is very often the real difference, so it belongs on the card rather than buried on the retailer's own page. |
| **Trade-off line** | Each card admits what it misses: "A coupé, where you asked for a convertible." |
| **Reasons that hold up** | Concrete and specific to the car and the buyer, rather than brochure copy. |

### Showing its thinking

| | What it does |
|---|---|
| **"Not this week"** | The tool will say it does not have the right car when that is true, rather than presenting the least bad option as an answer. Built for a buyer profile added specifically to break it: someone who assumes a retailer's own matcher ranks on margin, and is persuaded only by a tool willing to admit a miss. |
| **Running summary** | What the buyer said at the start plus everything added since, each item removable. |
| **Shows its working** | "We looked at all 26 MINIs in stock here. 20 were in budget and roomy enough. Nothing else here got within 30 points." |
| **Match score explained** | The percentage now says what it measures instead of appearing without comment. |
| **Rescue note** | "No convertibles at Grassicks right now. The nearest is 18.1 miles away at John Clark Tayside." |

---

## The headline: "it always recommends the same car" was true, and it's better

A stakeholder told us the tool kept recommending the same MINI. We tested it by
taking real buyer profiles and changing one answer at a time, the way a person
actually would.

They were right. The tool returned the same top car **77% of the time on BMW
and 78% on MINI**. It was not a MINI problem; BMW was just as stuck.

Two causes, both now addressed.

**The scoring was dominated by the hard requirements.** Budget, body shape and
fuel made up roughly three quarters of the score, so the questions about taste
and priorities barely moved the answer. On BMW, "what matters most to you"
changed the result **0% of the time**. It was on screen doing nothing.

The score is now split: **80% is "does this car actually suit you"** and
**20% is "would you like it"**, with that 20% protected so it cannot be
squeezed out. The preference questions now genuinely count. BMW's priorities
question went from **0% to around 20%** influence, MINI's vibe question to 50%.

**The page showed four copies of the same car.** Where a retailer had four
identical cars, the page listed all four, so it looked like the tool was
repeating itself. Repeat listings are now one result carrying the spread, and
the buyer picks the actual car at the end.

**Result:** the repeat rate came down from 77% to 72% on BMW, and 78% to 76% on
MINI. We were aiming for 55%, so **we did not hit the target and are not
claiming we did.** What clearly improved is what the page says, and whether the
questions earn their place on screen.

---

## The results page has been rebuilt

The old page was three separate lists stacked on top of each other, each
sensible on its own and contradictory together. On one real buyer's page the
scores ran **96, 95, then 78, then 99**. It told her two cars fitted her best,
then showed her a better one further down.

It is now **one ranked list**, and each card says where the car is rather than
which section it came from. Alongside that:

- **Fewer, better cards.** Six to eleven cards became four to eight, and
  nothing appears that is more than ten points behind the best.
- **The headline is re-checked constantly.** It used to be decided once and
  never revisited, so narrowing the results could leave it claiming two cars
  "fit you equally well" over a 96% and a 73%. It now re-derives from what is
  actually on screen.
- **Far fewer filters.** One page went from sixteen filter chips to two.

---

## The tool will now tell you when it hasn't got it

The change we would put in front of a sceptic.

One of our buyer profiles exists purely to break the tool: he shops the whole
market, keeps three tabs open, and assumes that a matcher operated by a seller
ranks on margin rather than on fit. Good recommendations do not move him. What
moves him is a tool willing to say **"we do not have the right car for you this
week"**, because a tool that will admit a miss earns the right to be believed
on a hit.

Until now the page could say *the closest ones here miss what you asked for*.
It had no way to say *nothing here is close*, so a weak result was delivered in
the same confident voice as a strong one. It can now tell the difference and
say so, with the search behind it on show: how much stock was looked at, how
much of it was even eligible, and how far clear the winner is.

---

## It behaves like a tool on a retailer's website

This block sits on one specific retailer's page, and an earlier version of the
rebuild lost sight of that: it started leading with competitors' cars whenever
they scored higher.

The results are now grouped by **place**, the retailer's own stock first, then
cars within reach elsewhere, and the competitor section can never outweigh the
host. The headline names the retailer only when it needs to, so "Your perfect
MINI is the Hatch Electric Level 3" stays as it is when that car is genuinely
the best anywhere nearby, and becomes "Your perfect MINI at Sytner Luton is..."
only when something further afield genuinely beats it, with a line saying which
car and where.

We deliberately did **not** penalise cars for being further away. The buyer is
never asked how far they will travel, and a car does not become less suitable
by being in Bedford. The match score means one thing only: how well the car
suits what they told us.

---

## What this version does not do

Stated plainly, because a tool that admits a gap is easier to believe on
everything else.

- **No monthly cost or insurance group.** The page shows a cash price. The
  monthly figure is obtainable from the same platform we already read stock
  from and is queued as its own piece of work. Insurance group is genuinely
  external and is not planned.
- **No battery condition on used electric cars.** Not available in the data we
  read. It is a real gap for electric buyers and we are not going to estimate
  it.
- **No service history.** Same reason.
- **The repeat-recommendation rate missed its target**, as above.

---

## How to look at it

The tool runs against **live retailer stock**, so results change as stock does.
Everything above was measured against real cars at Grassick's of Perth (BMW)
and Sytner Luton (MINI).

Eight buyer profiles, researched and source-audited, are used to test every
change end to end. They live in `docs/personas.md`, and the shareable version
is `docs/personas-pack.pdf`.
