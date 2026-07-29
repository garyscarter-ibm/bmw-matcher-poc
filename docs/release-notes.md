# Matcher update: what's changed and why

For stakeholders. Covers the work on the `engine-relayer` branch, 2026-07-21
to 2026-07-29. Non-technical; the workings behind each claim are in `docs/`.

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
  nothing appears that is more than ten points behind the best. One buyer's
  page used to carry six results in the low seventies underneath two in the
  high nineties.
- **The headline is re-checked constantly.** It used to be decided once and
  never revisited, so narrowing the results could leave it claiming two cars
  "fit you equally well" over a 96% and a 73%. It now re-derives from what is
  actually on screen, so narrowing a tie down to one car changes it to a
  straight recommendation by itself.
- **Far fewer filters.** One page went from sixteen filter chips to two. Chips
  now only appear when they would change something.

---

## Four things the tool can now do that it could not

**1. Choose the actual car, not just the model.** Once it is down to one model,
the buyer picks which of the retailer's copies: colour, price, mileage. The
photo, paint, price and link all change with the choice.

**2. Say "not this one", and mean it.** Turning a car down now offers a reason
("not the red", "under £31,498", "fewer than 6,000 miles"), applies it, and
brings the next car up. Reasons are about the exact car on screen, so on a
four-colour card the reason follows whichever one the buyer is looking at.

**3. Show what it has understood.** A running summary sits above the results:
what they told us at the start, plus everything they have added by filtering or
turning cars down, each removable.

**4. Show its working.** The page now closes with how it got there: *"We looked
at all 26 MINIs in stock here. 20 were in budget and roomy enough. Nothing else
here got within 30 points."* This matters more than it sounds. A result with
one car used to look like thin stock; it now reads as a clear winner because
the search behind it is visible.

---

## It now behaves like a tool on a retailer's website

This block sits on one specific retailer's page, and an earlier version of the
rebuild lost sight of that: it started leading with competitors' cars whenever
they scored higher.

The results are now grouped by **place**, the retailer's own stock first, then
cars within reach elsewhere. The headline names the retailer only when it needs
to, so "Your perfect MINI is the Hatch Electric Level 3" stays as it is when
that car is genuinely the best anywhere nearby, and becomes "Your perfect MINI
at Sytner Luton is..." only when something further afield genuinely beats it,
with a line saying which car and where.

We deliberately did **not** penalise cars for being further away. The buyer is
never asked how far they will travel, and a car does not become less suitable
by being in Bedford. The match score means one thing only: how well the car
suits what they told us.

---

## What this version does not do

Stated plainly, because a tool that admits a gap is easier to believe on
everything else.

- **No monthly cost or insurance group.** The page shows a cash price. Monthly
  is obtainable from the same platform and is queued as its own piece of work.
- **No battery condition on used electric cars.** Not available in the data we
  read. It is a genuine gap for electric buyers and we are not going to
  estimate it.
- **No service history.** Same reason.
- **The repeat-recommendation rate missed its target**, as above.
- **The match percentage is not yet explained on the page.** Landing shortly.

---

## What is landing next

A final round is in progress before this version is shared: stating the gearbox
and boot space on cards, adding ISOFIX as something buyers can filter on, and
one more significant change, **a way for the tool to say "we do not have the
right car for you this week" when that is true.**

That last one exists because of a buyer profile added specifically to break the
tool: someone who shops the whole market and assumes a retailer's own matcher
ranks on margin rather than fit. He is not persuaded by good recommendations.
He is persuaded by a tool willing to admit a miss. Right now the page can say
*the closest ones here miss what you asked for*; it has no way to say *nothing
here is close*.

---

## How to look at it

The tool runs against **live retailer stock**, so results change as stock does.
Everything above was measured against real cars at Grassick's of Perth (BMW)
and Sytner Luton (MINI).

Eight buyer profiles, researched and source-audited, are used to test every
change end to end. They live in `docs/personas.md`, and the shareable version
is `docs/personas-pack.pdf`.
