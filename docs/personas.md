# Buyer personas — BMW & MINI approved used

Status: research-informed working personas, created 2026-07-22, revised the
same day after a source audit (below). Seven personas: four BMW, three MINI.
The machine-readable answer sets live in `fixtures/personas.json` and replay
against a running API with `node scripts/persona-check.mjs`.

**This document is pure persona.** Who these people are, what they want, and
what would win them over. Everything the tool got right or wrong for them,
and every recommendation that follows, lives in
[persona-findings.md](persona-findings.md).

**Sharing with non-technical stakeholders:** use the visual pack,
[personas-pack.pdf](personas-pack.pdf); its print source is
[personas-pack.html](personas-pack.html) with the regeneration command in its
header comment. This doc remains the source of truth.

**Evidence honesty:** synthesised from published research (audited below),
the brands' own positioning, and this project's stock analysis. Not
interview-based. Strong, testable hypotheses; not ground truth.

---

## The shape of the set, and why

**Four BMW personas to MINI's three, by design rather than symmetry.**
Persona count should track the breadth of *need-space*, not the size of the
model range: BMW's approved-used spread runs from a £15k 1 Series to £100k+
flagships and spans first-premium buyers, fleet defectors, family
consolidators and reward purchases, while MINI's genuinely narrower space
(style-led urban, family-sized fun, small EV) is covered well by three. The
original set was 3–3 out of convenience; the audit that followed judged one
BMW need-space genuinely missing (below) and MINI's coverage adequate. More
BMW personas would be justified by evidence of distinct behaviour, not by the
brochure being thicker.

**Age coverage.** The set was challenged for skewing old. On the MINI side it
doesn't (Chloe is 29, the Reyes are 34); on the BMW side it did — the
youngest BMW buyer was 38, which ignored the brand's most important pipeline:
approved used IS the gateway product for the next generation, because a
three-year-old 1 Series is how a 27-year-old first affords the badge. Tyler
(below) covers that. **Under-25s remain deliberately out of scope:** UK
insurance economics push most of them below premium approved-used price
points; if the tool ever targets them, that decision deserves its own
research, not a token persona.

**Deliberately not represented** (documented so their absence reads as a
decision, not an oversight): the £70k+ luxury/flagship buyer (tiny share of
retailer-anchored used traffic), the M-car collector/enthusiast (buys from
specialist channels on provenance, not matching), trade and export buyers,
and Motability/adapted-vehicle buyers (a real segment the programme serves,
but one whose needs this matching engine doesn't currently model at all).

---

## BMW

### 1. Daniel Okafor, 47 — "The Motorway Manager"

Regional operations director, lives outside Perth, ~22,000 miles a year, much
of it A9/M90. Two teenagers. Coming out of a company-car scheme and buying
privately for the first time in a decade, which makes him precisely the
Approved Used "no surprises" customer: he wants the warranty, the history,
the certainty.

- **Says he wants:** a comfortable, frugal motorway car. Diesel by habit,
  plug-in-hybrid-curious but no charger at home yet.
- **Actually decides on:** total cost of ownership and the absence of doubt.
  He will read every line of the history and warranty pages, and he budgets
  in monthly outgoings as much as in sticker price.
- **Digital behaviour:** desktop, evenings, spreadsheet open in the next tab.
- **What winning him over looks like:** a sensible high-mileage answer with
  the economy argued in his terms — what this car costs to run at his
  mileage — and the programme's certainty visible, not assumed.

### 2. Priya Sharma, 38 — "The Family Consolidator"

GP in Perthshire, two children under 8 and a spaniel. Household is going from
two cars to one good one, so it has to do everything: school run, surgery
commute, grandparents in Glasgow. Driveway with a wallbox already fitted for
the car they're replacing.

- **Says she wants:** an electric or plug-in SUV/estate, £25–45k, safe and
  big enough for the dog *and* the buggy.
- **Actually decides on:** whether she believes the boot claim (she thinks in
  buggies-plus-dog, not litres), rear-seat ISOFIX, and what the range really
  is on a cold Glasgow run.
- **Digital behaviour:** mobile in stolen moments, then desktop with partner
  to decide. Shares links.
- **What winning her over looks like:** a shortlist she can defend to her
  partner — practicality reasons front and centre, honest range numbers, and
  nothing that smells like it's hiding a compromise.

### 3. Martin Hughes, 56 — "The Reward Buyer"

Sold his share of an engineering firm, kids gone, promised himself something
silly for two decades. Wants wind in what's left of his hair. Knows exactly
what this purchase is *for*, which makes him decisive about the shape and
open-minded about almost everything else.

- **Says he wants:** a petrol convertible, £30–60k, quick enough to feel it.
- **Actually decides on:** how it makes him feel; the sound; the colour
  against his gravel drive. Will happily drive 50 miles for the right car.
- **Digital behaviour:** desktop, decisive; he'll ring the dealer rather than
  fill in a form.
- **What winning him over looks like:** being told straight. If the right car
  isn't at his local dealer, say so and say where it is — he has the time and
  the tank to go and get it.

### 4. Tyler Brooks, 27 — "The First-Premium Striver"

Software sales, Dundee, commission just starting to land. Grew up in the back
of a Mondeo; the badge is the point. A three-year-old 1 Series M Sport around
£20k is how he gets it — approved used *is* the brand's front door for his
generation, even if nobody markets it to him that way.

- **Says he wants:** a petrol 1 Series or 2 Series Gran Coupé, M Sport,
  £16–24k, black or white.
- **Actually decides on:** the monthly payment his bank app tolerates and the
  insurance quote it doesn't; how it looks in his building's car park; what
  the YouTube reviewers he trusts said about the exact engine.
- **Digital behaviour:** entirely phone, late night, YouTube and TikTok
  reviews running while he scrolls listings. Zero tolerance for forms.
- **What winning him over looks like:** the M Sport car in the right colour
  with numbers he can say out loud: the monthly, the insurance group, the
  0–62. Speed and zero friction; one whiff of brochure-speak and he's gone.

---

## MINI

### 5. Chloe Bennett, 29 — "The Statement Buyer"

Marketing manager in Luton commuting into London three days a week. First car
bought entirely with her own money, and it is not allowed to be boring. It's
a MINI or a Fiat 500, and the 500 is losing on the go-kart thing.

- **Says she wants:** a petrol 3-door hatch, £14–22k, Classic trim is fine.
- **Actually decides on:** the colour and the roof. Full stop. She has a
  Pinterest board. The one that photographs best outside her flat wins.
- **Digital behaviour:** entirely mobile, 9pm, three tabs of the same car in
  different colours.
- **What winning her over looks like:** getting to make the final call
  herself, between real cars whose paint she can see — not being told which
  one is "best" by a spreadsheet.

### 6. Sam & Jordan Reyes, 34 — "The Fun-Sized Family"

Graphic designer and a paramedic in Luton, one toddler, allotment, street
parking. Adamant that parenthood does not mean a grey crossover; a Countryman
or Clubman keeps the self-image intact while fitting the buggy.

- **Say they want:** a Countryman or Clubman, £18–30k, petrol (no charger on
  their street), cheap to run.
- **Actually decide on:** whether the buggy fits with the weekly shop; rear
  doors that open wide in tight car parks; and it still has to *look* like
  theirs, which the contrast roof carries.
- **Digital behaviour:** mobile, in shifts, sending each other links with
  "this one?".
- **What winning them over looks like:** practicality they believe, in their
  own terms, from a car that still says MINI on the outside and in the
  photos.

### 7. Meg Whitlow, 58 — "The Electric Downsizer"

Recently retired teacher in St Albans, downsizing from an ageing X1 that's
too big for what her life now is: town trips, garden centre, grandchildren
twenty minutes away. Wallbox went in last spring. She's not a badge buyer;
she's buying *this size of car with this plug*, and a MINI happens to be the
charming version of it.

- **Says she wants:** a small electric automatic, £15–25k, comfortable.
- **Actually decides on:** trust. Real-world range said plainly, heated seats
  and parking sensors present, an automatic gearbox confirmed rather than
  assumed, a dealer she can reach, a warranty page she reads twice.
- **Digital behaviour:** desktop, daytime, methodical; prints things.
- **What winning her over looks like:** plain numbers, no cleverness, and the
  comfort equipment stated where she can see it.

---

## Source audit (2026-07-22)

Every source behind the research claims was re-checked by fetching it, not by
trusting search summaries. Scores: **High** = primary research or transparent
methodology from a credible body; **Medium** = named but unverifiable chain,
or credible-but-different-market; **Low** = content-marketing with no
methodology. One attribution error was found and is corrected below.

| Source | Used for | What validation found | Confidence |
|---|---|---|---|
| [Wonderful.co.uk trends post](https://wonderful.co.uk/blog/uk-used-car-market-trends-2025-a-future-of-growth) | 14 hrs research, 78% check ratings, 7–9pm peak, 60% mobile under-35s | Claims present; publisher is a *payments company's blog*. Attributes figures to a What Car? survey of 10,000 UK buyers, Cox, Auto Trader and Meta UK, but links none of them. Plausible, UK-specific, unverifiable chain. | **Medium-Low** |
| [Motortech.ai buyer post](https://motortech.ai/motortech-blog/the-uk-car-buyer-in-2025) | Previously cited for travel-distance and channel-share stats | **Misattribution — corrected.** The page contains none of those numbers (a search-engine summary invented the link). It's a vendor marketing piece with one unsourced stat. Distance claims now rest on Auto Trader instead (next row). | **Low** (dropped) |
| [Auto Trader plc / Motor Trader coverage](https://plc.autotrader.co.uk/news-views/press-releases/selling-online-unlocks-bigger-market-for-retailers-as-the-distance-between-buyer-and-seller-increases-significantly/) | Distance-to-purchase: pre-pandemic average ~40 miles, ~50 by 2021; 46% willing to buy 50+ miles away | Named primary source (Auto Trader's own marketplace data), UK, but 2021-era and "willing to" differs from "did". Directionally solid: distance matters and ~40–50 miles is the working radius. | **Medium-High** |
| [Hedges & Co BMW demographics](https://hedgescompany.com/blog/2019/03/new-bmw-owner-demographics/) | BMW buyer age/income/gender | US registration data, 2019, reputable niche research firm. Wrong market and dated; used only for the broad 35–55/affluent/gender-balanced shape, which UK sources echo. | **Medium** |
| [Research-Methodology BMW STP](https://research-methodology.net/bmw-segmentation-targeting-and-positioning/) | BMW psychographics | Tertiary educational summary, no primary data. Used for framing language only. | **Low** |
| [Latterly MINI marketing mix](https://www.latterly.org/mini-cooper-marketing-mix/) | MINI urban/image-led profile | Tertiary marketing blog. Consistent with the brand's observable positioning, no data. | **Low** |
| [AMI interview, MINI ANZ marketer](https://ami.org.au/knowledge-hub/making-mini-bigger-mini-anz-top-marketer-on-shifting-small-car-perceptions-with-larger-suv-balancing-brand-distinctiveness-ev-sustainability-conundrum/) | Countryman young-family targeting, go-kart DNA | Primary (named MINI executive), but Australia/NZ market. Brand strategy is global enough to carry. | **Medium** |
| [Axalta colour survey via StockTitan](https://stocktitan.net/news/AXTA/axalta-survey-reveals-color-is-a-key-factor-in-88-of-vehicle-r0nnc3180r15.html) | ~88% call colour a key purchase factor | Axalta is a global coatings maker running a long-standing annual colour survey; the 88% figure is theirs. Global not UK; self-interested publisher but real research programme. | **Medium-High** |
| [Cox Automotive journey study](https://www.coxautoinc.com/retail/resources/2025-car-buyer-journey-dealers/) | General journey/satisfaction framing | Genuine large-scale study, transparent programme — but US market. Used for direction only. | **High (US)** — Medium for UK claims |
| Zuto / young-driver finance pages | Tyler's PCP-first framing | Generic lender content; establishes that PCP/HP dominates young buyers' framing but no rigorous UK stat found in this pass. Tyler's money-first behaviour is well-grounded; the specific numbers are not. | **Low-Medium** |

**Net effect on the personas:** no persona stands or falls on a Low source —
the load-bearing claims (local purchase radius, online-first evenings
research, mobile skew by age, colour as a late decider, brand positioning)
are each supported by at least one Medium-or-better source. The precise
percentages previously quoted should be treated as *illustrative*, and the
two originally-cited travel-distance stats (47% ≤25 miles, 45-mile average)
are **withdrawn** — replaced by Auto Trader's 40–50 mile working radius.
