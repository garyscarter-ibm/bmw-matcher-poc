# Persona walkthrough findings — first replay, 2026-07-22

Six personas ([personas.md](personas.md), answer sets in
`fixtures/personas.json`) replayed end-to-end against live stock via
`node scripts/persona-check.mjs`, with the interesting pages rendered in a
real browser at desktop and mobile widths. This is the record of what served
each persona, what failed them, and the feature list that falls out.

## Result per persona

| Persona | State landed | What they saw | Verdict |
|---|---|---|---|
| Daniel (Motorway Manager, BMW) | 1 DECREE | 91% 520d M Sport Touring, diesel, with "kind on a big annual mileage" reasoning; 530e PHEV visible as runner-up | **Served.** The high-mileage ramp and economy reasons speak his language |
| Priya (Family Consolidator, BMW) | 2 FIT TIE | 7-way tie at 95%: iX2s and X1 PHEVs, all meeting the brief | **Served, with friction** — see duplicates + stronger-nearby findings |
| Martin (Reward Buyer, BMW) | 3 CLOSEST HERE | "No convertibles at Grassicks, nearest 18.1 miles away"; M2 coupés owning the trade-off; 94% Z4 leading Worth the drive | **Served.** He's the state-3 design vindicated: happy to drive, told where to |
| Chloe (Statement Buyer, MINI) | 2 FIT TIE | 6-way Cooper tie in five visible colours with swatches, colour chips to break it | **Served.** The refine step was built for her and it shows |
| Reyes (Fun-Sized Family, MINI) | 2 FIT TIE + rescue note | 5 Countrymans meeting the brief, plus "No plug-in hybrid MINIs at ours, nearest 21.9 miles" with PHEVs leading the carousel | **Served.** States compose correctly: their petrol want is met AND their PHEV curiosity is honoured nearby |
| Meg (Electric Downsizer, MINI) | 2 FIT TIE | Two identical-spec MINI Electrics, Chili Red vs Midnight Black; chips offer exactly that choice | **Served, one gap** — nothing tells her it's automatic |

Also verified: mobile layout at 390px is sound (`scrollWidth` exactly 390,
carousel tiles correctly contained in their scroll track). An apparent
overflow in early screenshots was a headless-Chrome artefact: it clamps
windows to ~500px wide and crops, so old captures showed a 500px layout cut
to 390. Probe real widths via an iframe, not `--window-size`, when testing
mobile.

## Issues found (things that are wrong today)

1. **Chip overload in rich ties.** The Reyes tie offers **21 chips** over five
   cars; Chloe gets ~17. They're ranked by how evenly they split, but nothing
   caps the row, so the best question sits next to sixteen mediocre ones.
2. **Duplicate-spec cards make ties feel like a glitch.** Priya's tie shows
   four iX2 eDrive20 M Sports, two of them in the same Portimao Blue,
   distinguishable only by mileage and £250. To a buyer that reads as the
   page stuttering, not as choice.
3. **Tie-overflow contradicts the More-at lede.** Priya's cluster is 7 but
   MAX_SHOWN is 6, so the seventh *tied* car lands in "More at" under "Close,
   but not level with the cars above" — it IS level. The lede lies exactly
   when the tie overflows.
4. **Gearbox is parsed, sent, and never shown.** Meg's dealbreaker is
   "automatic". Every card knows its transmission and none of them says it.
   (All MINI EVs are automatic; SHE doesn't know that.)
5. **MINI cards say "SUV" for a Countryman.** SPEC_LABELS is shared with BMW,
   but the MINI voice rules (quiz options, unmet phrases) deliberately say
   Countryman/Clubman. The spec line breaks the brand's own vocabulary.

## Gaps found (things the tool can't hear yet)

6. **Monthly cost.** The single most research-backed gap. Daniel budgets
   total-cost-of-ownership, Chloe budgets per month; the tool only speaks in
   sticker price. No finance question, no indicative monthly on cards.
7. **A stronger match nearby is invisible in fit states.** Priya's local tie
   tops at 95% while a 98% iX sits 23 miles away, unmentioned above the fold
   (the rescue note only fires when a want is *absent* locally). Retailer-
   first positioning is the owner's decision and stands; the question is
   whether the Worth-the-drive lede should say "including a stronger match"
   when nearby's best outscores the local lead.
8. **No path from result to action.** Martin would ring the dealer; the only
   CTA is "View at <retailer>", a listing link. No phone number, no enquiry,
   no test-drive booking, no way to hold the car he just chose.
9. **Approved-used trust content is absent from results.** Daniel and Meg buy
   *certainty* (warranty, history, no-surprises), the register the tone guide
   documents as Approved Used's core promise, and the results page never
   mentions any of it.
10. **Safety/ISOFIX (Priya) and insurance group/tax (Chloe, Reyes)** are not
    in the feed. Data investigation needed before promising anything.
11. **EV range honesty.** Range renders as the feed's headline figure; Meg
    and Priya both decide on winter reality. Any derating claim needs a
    defensible source, so this is copy + data work, not just copy.

## Feature list (proposed, in order)

**Fix now (small, sharp):**
1. Cap the chip row at ~8 with a "More…" expander (keeps the balance ranking
   meaningful). — *Issue 1*
2. Group identical-spec cars in a tie: one card, "2 available in Portimao
   Blue and Brooklyn Grey", expandable. — *Issue 2*
3. More-at lede variant when the tie overflows MAX_SHOWN ("including one more
   from the tie"). — *Issue 3*
4. Show the gearbox in the spec line. — *Issue 4*
5. Per-brand SPEC_LABELS (Countryman/Clubman for MINI). — *Issue 5*

**Next (design + data):**
6. Monthly-cost layer: indicative finance per card (needs a representative
   APR/deposit model and compliance wording) and/or let the budget question
   speak monthly. — *Gap 6*
7. Retailer handoff: phone + enquiry CTA on every card; test-drive request
   as the primary action on a settled result. — *Gap 8*
8. Approved-used trust strip on results (warranty, history check, returns),
   sourced from the programme's real promises. — *Gap 9*
9. Stronger-nearby signal in fit states, as a Worth-the-drive lede variant.
   Needs the owner's positioning call extended, not reversed. — *Gap 7*

**Investigate before promising:**
10. Insurance group / VED in the feed or a joinable source. — *Gap 10*
11. Winter-range presentation with a defensible basis. — *Gap 11*
12. ISOFIX/safety data availability. — *Gap 10*

## What the walkthrough validated (no action)

- All five result states render correctly through real personas' eyes, and
  they compose (Reyes: fit-tie + rescue note + reordered carousel on one
  page).
- The refine/reject loop is exactly right for the taste-led buyers (Chloe,
  Meg) it was designed for.
- The mileage ramp, EV steering with home charging, and practicality
  reasoning read correctly in persona terms.
- Mobile layout holds at 390px.
