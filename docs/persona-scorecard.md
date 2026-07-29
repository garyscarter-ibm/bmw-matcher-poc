# Persona scorecard: main vs this branch

All eight personas driven end to end through both versions, 2026-07-29, in the
same browser against the same live stock. `main` at `01cd26b` on :8788/:3001,
this branch at `0ec10a8` on :8787/:3000.

Scored out of 10 against **each persona's own stated criteria** from
`docs/personas.md`, not against taste. The "walks away when" clause is a hard
gate: if it fires, the score is capped at 4 however good the rest is.

| Persona | main | now | What moved it |
|---|---|---|---|
| Daniel, motorway manager | 5 | **7** | Gearbox, boot and seats stated; the funnel shows the search. Service history still absent. |
| Priya, family consolidator | 3 | **8** | Both her dealbreakers fixed: boot stated (525 litres), ISOFIX shown and filterable. |
| Martin, reward buyer | 6 | **9** | Already told him straight; now the convertibles he wants sit in the list rather than a separate band, and the scores stop inverting. |
| Tyler, first-premium striver | 4 | **5** | Better page, but his decision is the monthly payment and we still show a cash price. |
| Rob, whole-market shopper | 5 | **9** | "Nothing at Grassicks BMW is close to what you asked for", plus 11 of 47 eligible and the best reaching 67%. |
| Chloe, statement buyer | 5 | **9** | 16 chips down to 6, colour named with a swatch, and she picks the actual car. |
| Reyes, fun-sized family | 5 | **8** | Boot stated, contrast roof filterable, and the lead car is British Racing Green rather than another grey crossover. |
| Meg, electric downsizer | 3 | **7** | Gearbox confirmed rather than implied, decree restored. Battery health still absent. |
| **Average** | **4.5** | **7.75** | |

## The single biggest difference

**Every one of the eight `main` pages has an inverted score order.** Not most:
all of them.

    daniel   91 82 81 91 91 91 81 86
    priya    95 95 95 95 95 95 98 97 97 97 97
    martin   76 65 57 81 80 78
    meg      96 96 67 96 96 96

Priya's reads "six of these fit you equally well" with a **98** four cards
below the six 95s. Meg's says "it's a two-way tie" with a **67** wedged between
96s. Every current page is monotonic inside each group.

## Where each version stands

**main scores 4.5.** It is not a bad tool. The reasons are decent, the
trade-off line works, and Martin's rescue note was already good. What sinks it
is that the page contradicts itself on every single persona, and that the card
carries almost nothing a buyer decides on: no gearbox, no boot, no seats, no
ISOFIX, no evidence of any search.

**This branch scores 7.75.** The contradictions are gone, the card answers most
of what the personas actually decide on, and the tool will now admit a miss.
The three it does not close are all missing DATA, not missing design: monthly
cost, battery health, service history.

## The two personas still failing, and why

**Tyler, 5/10, is the weakest and the gap is real.** His clause is explicit:
he walks when "the total monthly (payment plus insurance) crosses the line",
and winning looks like "numbers he can say out loud: the monthly, the insurance
group, the 0–62". We give him one of three. Everything else on his page
improved and his score barely moved, which is the right result: a better page
that still does not answer his question is still not his tool.

Worth noting his funnel reads **"9 were in budget and big enough for you"** out
of 47. His budget is doing almost all the filtering, and the page has that fact
but does not use it.

**Meg, 7/10.** Gearbox is now stated, which closes half her clause. Battery
state of health is the other half and is not in the feed.

## UX improvements worth making

Ordered by value, from what this run exposed rather than from the earlier list.

**1. Say when the budget is the binding constraint.** Tyler: 9 of 47. Rob: 11
of 47. Both are being shown the best of a small remainder, and in both cases
the reason is budget. The funnel already carries the numbers; one line
("your budget rules out most of what is here") turns a statistic into advice,
and it is free.

**2. Trim the working note.** It has grown to three sentences: the funnel, the
margin, and the match-score explanation. On Daniel's page that is a paragraph
of small grey text closing the page. The score explanation would sit better as
a tooltip on the badge itself, where the number is.

**3. Meg's margin claim sits oddly next to her nearby group.** "Nothing else
here got within 30 points" is true and scoped to the retailer, but three cars
at 97% are visible immediately below it. Both statements are correct; together
they read as a contradiction to anyone not tracking the word "here".

**4. Daniel gets eight cards and no chips at all.** His lead is a single card,
so no axis splits it, and the seven tail tiles have no filtering. Either offer
axes computed across everything shown, or accept it and say nothing.

**5. Reasons repeat across cards in a tie.** Chloe and Tyler both show "The
petrol power you wanted / The hatchback shape you asked for" on adjacent cards.
Correct per card, and reads as filler when two cards sit side by side saying
the same thing. Reasons could lead with what makes THIS car different from the
one next to it.

## Scoring notes

Nothing here is precise to the point. The gates are: does the walk-away clause
fire, is the page honest about what it shows, and is the thing "winning looks
like" actually delivered. Two people scoring this would agree on the ordering
and might differ by a point on Daniel and Reyes.
