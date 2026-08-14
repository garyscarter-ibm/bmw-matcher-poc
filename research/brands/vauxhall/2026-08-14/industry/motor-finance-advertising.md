# Motor finance advertising: the FCA rules, and Vauxhall's observed small print

Two independent rungs, joined. Rung 1 for the rules (FCA Handbook, first-party official,
purpose-made). Rung 2 for the practice (dated first-party press release). Confidence:
high for both.

## Probe results

- `https://www.fca.org.uk/firms/consumer-credit/financial-promotions-adverts` (s49):
  **HTTP 404, dead end.** Do not re-probe this path.
- `https://www.handbook.fca.org.uk/handbook/CONC/3/5.html` (s52): **REACHED.** The
  Handbook host is a different host from `www.fca.org.uk` and it works. This is the
  better target.

## The rules, from CONC 3.5 (page states last updated 06/04/2020)

CONC 3.5 is titled "Financial promotions about credit agreements not secured on land",
which is exactly the motor-finance case (PCP, HP, conditional sale).

**What triggers a representative example: CONC 3.5.3R(1).** Where a promotion "indicates
a rate of interest or an amount relating to the [cost of credit]", it must include a
representative example and give a postal contact address. Exceptions: promotions caught
by CONC 3.5.7R that show only the representative APR (3.5.3R(2)); promotions relating
only to agreements where "the [APR] is 0%" (3.5.3R(2A)).

Guidance CONC 3.5.4G(1) notes a rate of interest "is not limited to an annual rate of
interest but would include a [monthly] or daily rate or an [APR]". **This is the rule
that catches "from £x per month" copy**: a monthly amount relating to the cost of credit
is a trigger.

**What the representative example must contain, CONC 3.5.5R(1), in the order the
Handbook lists them:**

(a) the rate of interest, and whether fixed, variable or both, as an annual percentage
on credit drawn down; (b) "the nature and amount of any other charge included in the
[total charge for credit]"; (c) total amount of credit; (d) representative APR; (e) for
deferred payment for specific goods, services or land, the cash price and any advance
payment; (f) duration of the agreement; (g) total amount payable; (h) "the amount of
each [repayment] of [credit]".

Relaxations: CONC 3.5.5R(6), open-ended agreements need not show duration, total amount
payable or each repayment. CONC 3.5.5R(7), certain authorised non-business overdraft
promotions need not show a representative APR.

**Prominence, CONC 3.5.5R(5).** The information must be "specified in a clear, concise
and prominent way", labelled with the words **"representative example"**, "presented
together with each item of information being given equal prominence", and given no less
prominence than other cost-of-credit information (except ancillary-service statements
under CONC 3.5.10R) or any 3.5.7R indication or incentive. Note the two distinct
prominence obligations: internal equality between the example's own items, and external
parity against the marketing claim.

**When a representative APR must be included, CONC 3.5.7R(1).** Where a promotion
(a) states or implies credit is available to individuals "who might otherwise consider
their access to [credit] restricted"; (b) includes a favourable comparison, express or
implied, with another person, product or service; or (c) includes **"an incentive to
apply for [credit]"** or to enter into a credit agreement. The APR must be "given no
less prominence than any of the matters in (1)" (3.5.7R(2)). Exclusions in 3.5.7R(3):
certain non-business overdrafts, 0% APR agreements, community finance organisation
lending. Presentation rules in CONC 3.5.9R, for example shown as **"%APR"**, accompanied
by "variable" where changeable, and by "representative".

**Representative APR definition.** Not on this page. It links the Glossary term (G3354).
CONC 3.5.6G(1A) refers firms to that Glossary definition and to the **"51% test"** in it,
taking account of the APR of agreements reasonably expected to result from the promotion.
The Glossary entry was **NOT PROBED**.

## Vauxhall's own observed finance copy, s46, dated 2026-05-14

From "VAUXHALL VANS: ELECTRIC FOR THE SAME MONTHLY PRICE AS DIESEL". This is a single
release carrying **three different finance products** with three different disclaimer
sets, which is unusually good evidence.

**1. LEASYS Business Contract Hire**

- Combo Electric Pro at "£305 per month", initial rental "£1,830"
- Vivaro Electric at "£335 per month", initial rental "£2,010"
- Both "36 months, 10,000 miles per annum, six months' initial rental"
- Small print: "Excess mileage charges apply." Vehicles ordered "between 08/05/2026 and
  31/05/2026". Provider address given in full: "Leasys, Pinley House, 2 Sunbeam Way,
  Coventry, CV3 1ND."

**2. SFS Conditional Sale** (SFS = Stellantis Financial Services)

Combo: "60 Monthly Payments of" "£299"; OTR "£29,917.00" (diesel) vs "£34,569.00"
(electric); deposits "£6,911.22" / "£6,832.64"; credit "£15,211.86"; interest
"£2,728.14"; totals payable "£25,851.22" / "£25,772.64"; **"Fixed rate of interest per
year" "6.9%"**; **"APR Representative" "6.9%"**.

Vivaro: "£339" monthly; OTR "£37,291.00" vs "£47,075.00"; deposits "£9,409.97" /
"£9,398.70"; credit "£17,246.89"; interest "£3,093.11"; totals "£30,749.97" /
"£30,738.70"; 60-month term at "6.9%".

Small print: "Applicants must be 18+."; "12 to 60 month term available."; "Finance by
Stellantis Financial Services, RH1 1QA."

**Mapping to CONC 3.5.5R(1):** the observed table supplies the rate of interest and that
it is fixed (a), total amount of credit (c), representative APR (d), cash price and
advance payment (e), duration (f), total amount payable (g), and each repayment (h). So
the disclaimer block is visibly rule-shaped, item for item. Note the label used is
**"APR Representative"**, word order inverted from the Handbook's "representative APR",
and the block is not observed to carry the literal heading "representative example". Both
recorded as observations; whether the live advertisement carries that heading cannot be
checked because vauxhall.co.uk is walled.

**3. SFS Finance Lease**

Combo "35 Monthly Payments of" "£289", initial rentals "£855" / "£185.99"; Vivaro "£319",
initial rentals "£2,155.74" / "£795.68"; "Pro Days Contribution" "£1,000" throughout.
Small print: "Price excludes VAT."; **"You will not own the vehicle."** rendered in bold
in the source; "Excess mileage and vehicle condition charges may apply."

The bolded ownership warning is the finance-lease risk warning, and it is the only piece
of small print observed to receive typographic emphasis.

**4. Broker status disclosure**

- "Vauxhall Motors Limited is a credit broker and not a lender"
- "Vauxhall will not receive a commission for any introduction"
- "Vauxhall Motors Limited reserves the right to change, amend or withdraw this offer at
  any point in time."

The commission disclosure is notable given the FCA's motor-finance commission work. The
legal entity is written **"Vauxhall Motors Limited"** in full in legal copy, versus
"Vauxhall" in marketing copy. ASA records the advertiser as "Vauxhall Motors Ltd" (s47),
so both "Limited" and "Ltd" appear across sources.

## Non-finance offer small print in the same release

- "additional £1,000 saving (incl. VAT) on all models and powertrains", orders "until
  31st May, registered by 30th September"
- Charger offer: "an Ohme EV charger up to the value of £1,050 (incl. VAT) with standard
  installation"; "Customer value of up to £875 (excl. VAT)"; **"Offer applies to GB
  Mainland only."**

Note the dual VAT presentation, inclusive for consumer-facing value and exclusive for
business, in the same release. And the GB Mainland territorial carve-out, which excludes
Northern Ireland and the islands, is a standing UK automotive convention.

## Contrast: the car releases carry almost no finance copy

s45 (Corsa GSE, 2026-08-05) states prices, P11D, VED, BiK and the ECG, and the fetcher
confirms **"No monthly payment, APR, PCP or deposit figures appear in the release."**
Same for s44 and s53. So finance detail is concentrated in the van and offer releases,
which is consistent with the audience split documented in
`commercial-vehicle-register.md`.

## Gaps

- CONC 3.3 (general fair, clear and not misleading rule) and CONC 3.6 NOT PROBED.
- FCA Glossary definition of representative APR and the 51% test NOT PROBED.
- No PCP representative example observed at all. Every example collected is Business
  Contract Hire, Conditional Sale or Finance Lease, all van products. **PCP is the
  dominant UK consumer car product and no consumer PCP illustration was found**, because
  it lives on vauxhall.co.uk, which is walled (s1).
- FCA motor-finance-specific pages on `www.fca.org.uk` NOT PROBED beyond the one 404.
