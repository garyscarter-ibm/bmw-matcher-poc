# SMMT: registration data by brand, and the actual industry segment vocabulary

Rung 2 (trade body, first-party to the industry, third-party to the brand, A3). Reached.
Confidence: high for the figures as published, and note the disagreement below.

Source s50, `https://www.smmt.co.uk/vehicle-data/car-registrations/`, covering **July
2026** and **year to date January to July 2026**, each against the 2025 equivalent. The
download file is labelled "New car registrations data July 2026".

## Vauxhall figures, exactly as published

| Period | 2026 | Share '26 | 2025 | Share '25 | % change |
|---|---|---|---|---|---|
| July | 5,840 | 3.73 | 4,892 | 3.49 | 19.38 |
| Year to date | 54,841 | 4.24 | 51,574 | 4.36 | 6.33 |

Model rankings: **Corsa** 10th in July (2,326) and **5th year to date (20,796)**.
**Frontera** appears among July BEV models (1,248).

Market totals: July 156,571 in 2026 against 140,154 in 2025, +11.71%. Year to date
1,294,499 against 1,182,373, +9.48%.

## DISAGREEMENT: 4.24% versus Vauxhall's own 4.8%

Vauxhall's own release (s11, press index headline dated 2026-07-06) claims "VAUXHALL
ACHIEVES TOTAL MARKET SHARE OF 4.8% IN FIRST HALF OF 2026". SMMT's car-only year-to-date
share for January to July 2026 is **4.24%**.

**Not resolved.** Two plausible reconciliations, both unverified here:

1. **Different denominators.** Vauxhall says "total market share", which in UK trade usage
   usually means cars **plus** light commercial vehicles. Vauxhall is proportionally
   stronger in LCV than in cars, so a combined figure would sit above the car-only figure.
   SMMT publishes LCV registrations separately at `/vehicle-data/lcv-registrations/`,
   **NOT PROBED**.
2. **Different periods.** Vauxhall's figure is H1, January to June. SMMT's is January to
   July. Vauxhall's July car share (3.73%) is below its year-to-date share, so adding July
   pulls the average down, though not by 0.56 points on cars alone.

A guideline should treat "total market share" as a term of art requiring the denominator
to be stated. The underlying press release was **not fetched**; only its headline is
evidenced, from the press index (s41).

## Segment vocabulary: the brief's expectation is NOT met

The brief anticipated "industry-standard segment vocabulary" such as Supermini, Lower
Medium, Dual Purpose, MPV. The fetcher confirms **none of those terms appear anywhere on
this page**, and that there is **no body-style or size segment table** on it. Available
tabs are: Overview, fuel type, sales type, July By Brand, 2026 By Brand, Top models,
Top BEV models.

Recorded as **NOT PUBLISHED on this page**, not as absent from SMMT. The historic
Supermini/Lower Medium/Dual Purpose taxonomy may well sit behind DataShop
(`https://datashop.smmt.co.uk/shop/product`, paid, **not probed**) or in the ZIP download.

Note the consequence for a guideline: **Vauxhall's own copy uses European letter
segments** ("B-segment icon", "the important and highly competitive C-segment", "C-SUV",
s54), while its trade body's public data does not publish size segments at all. So the
letter-segment vocabulary is a Stellantis and European convention, not something inherited
from SMMT.

## The segmentations SMMT actually does publish

**By fuel type**, using these exact category labels: **BEV, HEV, PHEV, PETROL, DIESEL.**
July 2026: BEV 43,106 (27.5% share, +44.5%), HEV 20,711, PHEV 23,359, PETROL 62,799
(-5.2%), DIESEL 6,596 (-17.7%). Year to date BEV 327,683 (25.31%). Important
methodological note stated on the page: petrol and diesel figures **absorb mild hybrids**,
because MHEVs are "not presented as a separate powertrain category in headline figures".

**By sales type**, using: **Private, Fleet, Business.** July 2026: Private 58,137 (37.1%),
Fleet 93,734 (59.9%), Business 4,700 (+61.3%). **Definitions given on the page: Fleet is
companies running 25 or more vehicles; business is fewer than 25.** That definition is
directly load-bearing for the van and business copy split, since Vauxhall's own van
release addresses "Retail (SME) business customers", "sole traders" and "SME customers"
(s46), which map to SMMT's "Business" band rather than "Fleet".

Competitive context, July top models: Ford Puma 3,531, Nissan Qashqai 3,224, Kia Sportage
3,205. Year to date: Puma 33,173, Sportage 29,033, Jaecoo 7 26,549. July top BEVs:
Renault 5 1,805, Kia EV3 1,691, Jaecoo E5 1,291, Skoda Enyaq 1,255. So the Corsa is a
top-five car year to date while no Vauxhall appears in the July BEV top four, and Frontera
is the Vauxhall BEV that does register (1,248).

## Linked resources captured, NOT fetched

- Data download ZIP: `https://smmtweb.lon1.cdn.digitaloceanspaces.com/wp-content/uploads/2024/01/Jul-2026-new-car-regs.zip`
  (binary, out of capability this run)
- DataShop, paid granular data: `https://datashop.smmt.co.uk/shop/product`
- Registrations news feed: `https://www.smmt.co.uk/news/?_sft_category=news&_sft_post_category=car&_sft_subcategory=car-registrations`
- EV registrations: `/vehicle-data/electric-vehicle-registrations/`
- **LCV registrations: `/vehicle-data/lcv-registrations/`** (the probe that would settle
  the 4.8% question)
- Car and van outlook: `https://www.smmt.co.uk/vehicle-data/uk-new-car-and-van-outlook/`

No individual press release URL or standalone PDF is linked on the page.
