# Persona walkthrough findings — first replay, 2026-07-22

Personas ([personas.md](personas.md), answer sets in
`fixtures/personas.json`) replayed end-to-end against live stock via
`node scripts/persona-check.mjs`, with the interesting pages rendered in a
real browser at desktop and mobile widths. This is the record of what served
each persona, what failed them, and the feature list that falls out.
The personas doc stays *pure persona* by owner decision; every
tool-facing observation, per-persona gap and recommendation lives here.

## What each persona asks that the tool can't hear yet

Moved here from the persona pages (they describe the tool, not the person):

| Persona | Unheard asks |
|---|---|
| Daniel | Monthly finance cost; warranty length and service history up front |
| Priya | Safety ratings/ISOFIX; winter range honesty; monthly cost on PCP |
| Martin | A way to act on the result: phone, enquiry, test-drive booking |
| Tyler | Monthly payment and insurance group before anything else; zero-friction handoff |
| Chloe | Monthly payment and insurance group |
| Reyes | Boot size in buggy terms; running costs beyond mpg (tax, insurance) |
| Meg | Winter range said honestly; gearbox stated on the card (all MINI EVs are automatic — she doesn't know that) |

## Result per persona

| Persona | State landed | What they saw | Verdict |
|---|---|---|---|
| Daniel (Motorway Manager, BMW) | 1 DECREE | 91% 520d M Sport Touring, diesel, with "kind on a big annual mileage" reasoning; 530e PHEV visible as runner-up | **Served.** The high-mileage ramp and economy reasons speak his language |
| Tyler (First-Premium Striver, BMW; added in the same-day revision) | 1 DECREE | 85% M135i xDrive in Alpine White, decisive, meets brief; 218i Gran Coupé as the nearby alternative | **Served on the match** — his exact car in his colour. His sharpest asks (monthly, insurance group, instant handoff) are all in the gaps list below |
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

## main vs main-v2, scored through persona eyes (2026-07-22)

Both branches' backends run side by side against the same live stock, all
seven personas replayed through each, scored on an identical rubric per
persona: the basics (right shape/fuel leads, within budget, reasons in their
language), honesty checks whose *applicability* comes from ground truth (is
there really a tie; does the top car really miss a want; is a missing want
really available nearby), taste/refinement material where the persona is
taste-led, and their known unheard asks, which both versions are expected to
fail so the ceiling stays honest. main includes the per-car trade-off commit
(3ed1cd) and gets full credit for it.

| Persona | main | main-v2 | What v2 changes for them |
|---|---:|---:|---|
| Daniel (Motorway Manager) | 4/6 | 4/6 | Nothing, and correctly so: a decisive clear winner never touches the new machinery |
| Priya (Family Consolidator) | 3/10 | 7/10 | Her 7-way tie admitted and shown in full with paint; main crowned one of seven near-identical cars and hid four |
| Martin (Reward Buyer) | 6/11 | 9/11 | main already admits the miss on the hero (trade-off line) and happens to rank the Z4 top nearby; v2 adds the tie honesty, paint and refinement |
| Tyler (First-Premium Striver) | 4/7 | 5/7 | Paint on cards; his colour-led shortlist works |
| Chloe (Statement Buyer) | 3/10 | 7/10 | The whole tie, the colours, and the chips: her entire decision lives in what main doesn't send |
| Reyes (Fun-Sized Family) | 4/10 | 9/10 | Largest gap: tie honesty + paint + refinement + the PHEV pointed at 21.9 miles away (main's nearby list contains no PHEV at all) |
| Meg (Electric Downsizer) | 5/10 | 8/10 | Red-vs-black is her actual decision; main can't show it |
| **Total** | **29/64 (45%)** | **49/64 (77%)** | No regressions: every delta is v2 adding, never losing |

Reading the deltas: every point v2 gains comes from exactly five capabilities
(tie honesty, whole-tie display, paint on cards, refinable equipment on the
wire, locally-missing wants pointed at nearby), which is the phase-2 work
doing precisely what it claimed. Every point BOTH versions drop is an
unheard ask from the feature list above: monthly cost (three personas),
warranty/trust content, enquiry CTA, insurance group, gearbox display,
winter range, ISOFIX. The ceiling for the current feature set is ~80%, and
closing the rest is off-page work, not matching work.

Neutral observation, same on both sides: Priya's and Chloe's top cards
carried no reason phrased in their language (practicality words for Priya,
character/urban words for Chloe) — worth a look at reason coverage for EV
SUVs and city hatches.

Method caveats: scored at the API level (what the page CAN render), against
live stock on one day; ties and rescues are stock-dependent facts. Harness:
a scratchpad one-off (compare.mjs) pairing `fixtures/personas.json` against
two ports; scores are not comparable across stock refreshes without re-running
both sides together.

## Addendum: external review of the pack (2026-07-29)

An external review scored the pack 7/10. Its two structural criticisms
(geography incoherent; personas never checked against stock) were both
packaging artefacts: the shareable pack said "anchored to one retailer"
without naming either instance, and carried none of this document's replay
results. Pack v2 fixes both (names Grassick's and Sytner Luton, adds one
stock-reality line per persona sourced from the replay table above).
Substantive changes that came out of it:

12. **Used-EV battery health is a new gap.** Priya and Meg now decide on
    state of health, degradation and battery-warranty transfer
    (personas.md updated); the feed almost certainly carries none of it.
    Joins insurance group, winter range and ISOFIX on the
    investigate-before-promising list.
13. **Rob Jennings (the rejector, new persona 8) is Gap 7's test case.**
    His keep-condition is the tool admitting a miss. State 3 and the
    rescue notes already do this when a want is absent locally, but Gap 7
    (a stronger nearby match invisible in fit states) is exactly the
    silence he reads as sales-instrument behaviour. When the owner's call
    on Gap 7 is revisited, judge it through Rob. His answer set is in
    `fixtures/personas.json` (key `rob`, retailer 96); he has not been
    replayed yet.
14. **Triggers and money are now persona facts, not tool gaps.** Every
    persona carries a trigger, a money picture (deposit, part exchange,
    contract end where relevant) and a walks-away condition. The tool
    hears none of them yet; the finance/monthly layer (Gap 6) and any
    future part-exchange or contract-date question should be designed
    against those lines.
15. **Weighting assumptions added** to personas.md: estimated share of
    enquiries and units per persona per instance, all confidence Low,
    to be replaced with DMS and enquiry-log data. The build-order risk
    they guard against: over-serving Martin, under-serving Tyler/Chloe.
