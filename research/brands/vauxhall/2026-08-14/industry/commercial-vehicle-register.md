# The commercial-vehicle register: van copy versus car copy

Rung 2 (first-party dated press release). Confidence: high for the observed register,
medium for how far it generalises, since it rests mainly on one very rich release.

Primary source s46, "VAUXHALL VANS: ELECTRIC FOR THE SAME MONTHLY PRICE AS DIESEL",
dated **2026-05-14**. Compared against the car releases s44 (2026-07-24), s45
(2026-08-05) and s53 (2026-07-13).

## The split, observed

| | Car releases (s44, s45, s53) | Van release (s46) |
|---|---|---|
| Lead metric | performance, range, technology | **monthly cost parity**, payload, load volume |
| Headline figure type | PS/hp, 0-62mph, miles | £ per month, kg, cubic metres |
| Finance detail | none. No APR, PCP, deposit or monthly figure at all | three finance products, full representative tables |
| Tax framing | VED, BiK, P11D (company-car driver) | VAT inclusive and exclusive, Pro Days contribution |
| Audience named | not named explicitly | "Retail (SME) business customers", "sole traders", "SME customers" |
| Quoted spokesperson | product and strategy voices | Eurig Druce, the UK commercial voice |
| Offer mechanics | ECG only | sales event, order and registration deadlines, charger bundle, territorial carve-out |

The clearest structural finding: **the cars sell capability, the vans sell cost.** The
van headline is a direct cost-parity claim ("ELECTRIC FOR THE SAME MONTHLY PRICE AS
DIESEL") built by pairing a diesel and an electric variant at near-identical monthly
payments, with the price gap absorbed by deposit and contribution. Diesel OTR £29,917.00
against electric OTR £34,569.00, yet monthly payments land at £299 for both.

## Van naming and variant strings

Full variant strings, exactly as written (s46):

- `Combo Panel Van M Diesel 100hp Manual Pro`
- `Combo Electric Panel Van M 136hp Pro`
- `Vivaro Panel Van M Diesel 120hp Manual Prime`
- `Vivaro Electric Panel Van M 136hp Prime`
- `Combo Electric Panel Van M 136hp Prime-Plus`

Structure induced: `<Model> [Electric] Panel Van <size> [fuel] <power>hp [transmission]
<trim>`. Size letters `M` and `XL`. Trim ladder `Pro`, `Prime`, `Prime-Plus`. Power in
`hp` for vans, not `PS`. Fuel named only for diesel; electric is carried by the model
name instead of a fuel token, which is a meaningful asymmetry.

Passenger derivatives are named separately and are listed as passenger cars, not vans:
`Combo Life Electric`, `Vivaro Life Electric`. Electrification dates given in the
release: `Vivaro Electric (2019)`, `Movano Electric (2021)`, `Combo Electric (2018)`.

## Commercial-vehicle spec vocabulary

- **Payload in kg**, phrased as a maximum: "payload of up to 759kg" (Combo Electric),
  "maximum payload of 1,210kg" (Vivaro Electric).
- **Load volume in spelled-out cubic metres**, not `m3`: "4.4 cubic metres" (Combo
  Electric, qualified "with FlexCargo bulkhead"), "6.6 cubic metres" (Vivaro Electric).
  The qualifier matters: the larger figure depends on a named feature.
- **Towing stated as braked capacity**: "towing capacity (braked) of 750kg" (Combo
  Electric), "towing capacity (braked) of 1,000kg" (Vivaro Electric).
- **Length in metres for vans**, unlike cars which use mm: "Medium (4.98m) or XL (5.33m)".
- Battery and range as for cars but with the fuller WLTP qualifier: "52kWh battery (gross
  capacity)", "up to 213 miles on a single charge (WLTP combined cycle)", "75kWh battery
  (gross)", "range of up to 219 miles (WLTP combined cycle)".

## Business and fleet language

- Eurig Druce, `Vauxhall Managing Director & Stellantis UK Group Managing Director`,
  quoted saying the strategy is "helping more motorists make the switch to electric" and
  that Vauxhall is "committed to electrifying Britain's businesses."
  Note "motorists" (consumer register) and "Britain's businesses" (B2B register) sit in
  the same quotation.
- Audience terms observed: **"Retail (SME) business customers"**, **"sole traders"**,
  **"SME customers"**.
- Event naming: **"LCV 'Professional Days' sales event"**, with `LCV` used as an
  unexpanded initialism and the event name in single quotes. A related line item is the
  **"Pro Days Contribution" of "£1,000"**, so the same event is called "Professional
  Days" in prose and "Pro Days" in the finance table.
- SMMT's definitions are the relevant external scale: Fleet is 25 or more vehicles,
  Business is fewer than 25 (s50). Vauxhall's named audience here, SME and sole trader,
  sits in SMMT's **Business** band, not **Fleet**. So this release is small-business
  copy, not large-fleet copy, and a guideline should not treat them as one register.

## Offer mechanics specific to the van register

- "additional £1,000 saving (incl. VAT) on all models and powertrains"
- Orders "until 31st May, registered by 30th September" (note the order-by and
  register-by pair, a standing UK automotive convention)
- Charger bundle: "an Ohme EV charger up to the value of £1,050 (incl. VAT) with standard
  installation"; "Customer value of up to £875 (excl. VAT)"
- "Offer applies to GB Mainland only."
- Contract hire vehicles ordered "between 08/05/2026 and 31/05/2026" (note numeric
  DD/MM/YYYY here versus "31st May" in prose in the same release)

**Dual VAT presentation is the defining B2B tell**: consumer-facing value inclusive of
VAT, business-facing value exclusive, sometimes for the same item. "Price excludes VAT."
appears on the Finance Lease block.

Full finance detail is in `motor-finance-advertising.md`.

## Manufacturing claim tying the van range to the brand story

The standing boilerplate in every release collected states Ellesmere Port is "the UK's
first electric-only manufacturing plant where the Combo Electric van is made." So the
van range carries the brand's principal UK manufacturing proof point, which is a reason
the commercial register is not peripheral to the brand story.

Boilerplate also states Vauxhall was, from 2021, "among the first to offer fully electric
versions of all its vans", and that since the end of 2024 "every car and van in its
line-up has a fully electric version".

## Gaps

- **Movano specifics missing.** The model is named but no payload, load volume, towing or
  range figure for Movano was captured. Movano is the large van and its figures would
  differ most.
- Chassis cab and crew cab body types are listed by Wikipedia (s43) but no first-party
  copy for them was collected.
- No large-fleet or true fleet-manager register found. Everything observed is SME.
- LCV registration data not probed (see `smmt-registrations-and-segments.md`).
