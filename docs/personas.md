# Buyer personas — BMW & MINI approved used

Status: research-informed working personas, created 2026-07-22. Six personas,
three per brand. The machine-readable answer sets live in
`fixtures/personas.json` and replay against a running API with
`node scripts/persona-check.mjs`; end-to-end findings from the first replay
are in [persona-findings.md](persona-findings.md).

**Evidence honesty:** these are synthesised from published market research
(sources at the bottom), the brands' own positioning, and this project's stock
audits. They are not interview-based. Treat them as strong hypotheses that
structure testing, not as ground truth about real customers.

## What the research says, in brief

- **The journey is online-first, purchase is local.** UK buyers put ~14 hours
  into online research before contacting anyone; roughly 40% of serious
  research happens 7–9pm. Dealers still take the overwhelming share of actual
  purchases, and in 2025 ~47% of buyers travelled 25 miles or less to buy
  (average ~45 miles). A retailer-anchored tool with a "worth the drive" tier
  matches how people actually behave.
- **Under-35s research on mobile (~60% of their research); over-45s skew
  desktop.** Chloe is a phone user; Daniel and Meg are on laptops.
- **Price sensitivity is the dominant mood.** Large shares of buyers say they'd
  switch brands over price; monthly affordability drives decisions and loan
  terms keep stretching. Nothing in the quiz asks about monthly budget, only
  total price. That gap shows up in several personas.
- **Colour is a real decision factor** (an Axalta survey has ~88% calling
  colour a key purchase factor), even though ~80% of the market ends up in
  white/black/grey/silver. Taste narrows late, exactly where the refine step
  sits.
- **BMW's core buyer:** ~35–55, established in career, household income well
  above average, gender-balanced, values performance, quality and status.
  Approved Used buyers specifically buy *certainty* (the "no surprises"
  register the tone guide already documents).
- **MINI's core buyer:** younger-skewing, urban, well-educated, image-conscious
  ("a car says a lot about them"), historically female-targeted; the
  Countryman deliberately courts young families who don't want to graduate
  into a grey crossover. The brand DNA is "go-kart fun".

---

## BMW

### 1. Daniel Okafor, 47 — "The Motorway Manager"

Regional operations director, lives outside Perth, ~22,000 miles a year, much
of it A9/M90. Two teenagers. Coming out of a company-car scheme and buying
privately for the first time in a decade, which makes him precisely the
Approved Used "no surprises" customer: he wants the warranty, the history, the
certainty.

- **Says he wants:** a comfortable, frugal motorway car. Diesel by habit,
  plug-in-hybrid-curious but no charger at home yet.
- **Actually decides on:** total cost of ownership and the absence of doubt.
  He will read every line of the history and warranty pages. Adaptive cruise
  and a proper head-up display matter more than he admits.
- **Digital behaviour:** desktop, evenings, spreadsheet open in the next tab.
- **Success looks like:** a 520d/530e-shaped answer with economy and mileage
  reasoned about *in his terms* ("kind on a big annual mileage").
- **Asks the tool can't hear:** monthly finance cost; warranty length;
  service history; adaptive cruise as a requirement (parsed but never asked
  upfront, only refinable in a tie).

### 2. Priya Sharma, 38 — "The Family Consolidator"

GP in Perthshire, two children under 8 and a spaniel. Household is going from
two cars to one good one, so it has to do everything: school run, surgery
commute, grandparents in Glasgow. Driveway with a wallbox already fitted for
the car they're replacing.

- **Says she wants:** an electric or plug-in SUV/estate, £25–45k, safe and big
  enough for the dog *and* the buggy.
- **Actually decides on:** whether she believes the boot claim (she thinks in
  buggies-plus-dog, not litres), rear-seat ISOFIX, and range on the Glasgow
  run in winter.
- **Digital behaviour:** mobile in stolen moments, then desktop with partner
  to decide. Shares links.
- **Success looks like:** an iX1/iX3/330e-Touring-shaped answer with the
  practicality reasons front and centre, and honest range numbers.
- **Asks the tool can't hear:** ISOFIX/safety ratings; boot in real-object
  terms; winter range honesty; towbar for the bike rack (parsed, rarely
  splits); monthly cost on PCP.

### 3. Martin Hughes, 56 — "The Reward Buyer"

Sold his share of an engineering firm, kids gone, promised himself something
silly for two decades. Wants wind in what's left of his hair. Knows exactly
what this purchase is *for*, which makes him decisive about the shape and
open-minded about the badge on the boot.

- **Says he wants:** a petrol convertible, £30–60k, quick enough to feel it.
- **Actually decides on:** how it makes him feel on the test drive; the sound;
  the colour against his gravel drive. Will happily drive 50 miles for the
  right car, which makes him the "worth the drive" tier's ideal customer.
- **Digital behaviour:** desktop, decisive; he'll ring the dealer rather than
  fill in a form.
- **Success looks like:** a Z4/4-Series-convertible-shaped answer even if it
  isn't at his local dealer, with the tool being straight about where it is.
  He is the living test of state 3 (Grassicks holds no convertibles).
- **Asks the tool can't hear:** exhaust/sound character; a test-drive booking;
  colour preference upfront (deliberate: taste narrows late, and colour is on
  the cards + refine chips).

---

## MINI

### 4. Chloe Bennett, 29 — "The Statement Buyer"

Marketing manager in Luton commuting into London three days a week. First car
bought entirely with her own money, and it is not allowed to be boring. It's a
MINI or a Fiat 500, and the 500 is losing on the go-kart thing.

- **Says she wants:** a petrol 3-door hatch, £14–22k, Classic trim is fine.
- **Actually decides on:** the colour and the roof. Full stop. She has a
  Pinterest board. The one that photographs best outside her flat wins.
- **Digital behaviour:** entirely mobile, 9pm, three tabs of the same car in
  different colours.
- **Success looks like:** a tie she gets to break herself: chips for colour
  and contrast roof, cards whose paint she can see. She is the blue-car
  scenario made flesh and the refine step's primary customer.
- **Asks the tool can't hear:** monthly payment and insurance group (she
  budgets monthly, not in totals); colour upfront (deliberately unasked, but
  she'd try to say it early if she could).

### 5. Sam & Jordan Reyes, 34 — "The Fun-Sized Family"

Graphic designer and a paramedic in Luton, one toddler, allotment, street
parking. Adamant that parenthood does not mean a grey crossover; a Countryman
or Clubman keeps the self-image intact while fitting the buggy.

- **Says they want:** a Countryman or Clubman, £18–30k, petrol (no charger on
  their street), cheap to run.
- **Actually decides on:** whether the buggy fits with the weekly shop; rear
  doors that open wide in tight car parks; and it still has to *look* like
  theirs, which the contrast roof carries.
- **Digital behaviour:** mobile, in shifts, sending each other links with
  "this one?".
- **Success looks like:** Countryman-shaped answers with practicality reasons
  they believe, and the styling still speaking MINI.
- **Asks the tool can't hear:** boot in buggy terms; door aperture/access
  (the doors question only exists for hatchbacks, correctly); running costs
  beyond mpg (tax, insurance).

### 6. Meg Whitlow, 58 — "The Electric Downsizer"

Recently retired teacher in St Albans, downsizing from an ageing X1 that's
too big for what her life now is: town trips, garden centre, grandchildren
twenty minutes away. Wallbox went in last spring. She's not a badge buyer;
she's buying *this size of car with this plug*, and a MINI happens to be the
charming version of it.

- **Says she wants:** a small electric automatic, £15–25k, comfortable.
- **Actually decides on:** trust. Real-world range said plainly, heated seats
  and parking sensors present, a dealer she can reach. She reads the warranty
  page twice.
- **Digital behaviour:** desktop, daytime, methodical; prints things.
- **Success looks like:** a MINI Electric with the range stated honestly and
  comfort equipment visible; refine chips for heated seats/parking sensors
  are built for exactly her.
- **Asks the tool can't hear:** winter-range honesty; charging cost per mile;
  gearbox reassurance (all MINI EVs are automatic, but SHE doesn't know that
  and the page never says it).

---

## How to use these

- **Replay:** `node scripts/persona-check.mjs` with the API running replays
  every persona and reports the result state, leads, and whether stated wants
  were honoured. Deep-link hashes for eyeballing render in its output.
- **When designing a question or feature,** name the persona it serves. If
  none, it probably serves us.
- **Refresh trigger:** re-validate against stock after each `dump-stock`
  refresh; Chloe's tie and Martin's state 3 are stock-dependent facts.

## Sources

- [Wonderful.co.uk — UK used car market trends 2025](https://wonderful.co.uk/blog/uk-used-car-market-trends-2025-a-future-of-growth)
- [Motortech.ai — The UK Car Buyer in 2025](https://motortech.ai/motortech-blog/the-uk-car-buyer-in-2025)
- [Cox Automotive — 2025 Car Buyer Journey Study](https://www.coxautoinc.com/retail/resources/2025-car-buyer-journey-dealers/)
- [Hedges & Co — BMW owner demographics](https://hedgescompany.com/blog/2019/03/new-bmw-owner-demographics/)
- [Research-Methodology — BMW segmentation, targeting, positioning](https://research-methodology.net/bmw-segmentation-targeting-and-positioning/)
- [Latterly — MINI Cooper marketing mix](https://www.latterly.org/mini-cooper-marketing-mix/)
- [AMI — MINI ANZ on shifting small-car perceptions / Countryman families](https://ami.org.au/knowledge-hub/making-mini-bigger-mini-anz-top-marketer-on-shifting-small-car-perceptions-with-larger-suv-balancing-brand-distinctiveness-ev-sustainability-conundrum/)
- [Axalta via StockTitan — colour a key factor for ~88% of buyers](https://stocktitan.net/news/AXTA/axalta-survey-reveals-color-is-a-key-factor-in-88-of-vehicle-r0nnc3180r15.html)
- [CarZing — most popular car colours 2025](https://www.carzing.com/blog/car-buying-tips/the-most-popular-car-colors-of-2025-whats-hot-whats-not-and-why-it-matters/)
- Plus this repo's own stock audits: [refinement-audit.md](refinement-audit.md), [question-stock-audit.md](question-stock-audit.md).
