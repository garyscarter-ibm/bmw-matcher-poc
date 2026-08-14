# UK regulatory conventions for fuel economy, CO2 and EV claims

Rung 1 to 2 for the regulator (first-party official government source, purpose-made
guidance pages). Confidence: high for what VCA states, and see the important negative
finding below.

Probe results, per instruction:

| Source | Result |
|---|---|
| VCA fuel consumption and CO2 hub (s48) | **REACHED** |
| VCA "Enforcement on Advertising" (s55) | **REACHED**. The most on-point page found. |
| VCA WLTP page | **NOT PROBED** (URL captured, budget) |
| ASA / BCAP code section 03 (s51) | **REACHED**, see `asa-and-bcap-record.md` |
| FCA `/firms/consumer-credit/financial-promotions-adverts` (s49) | **HTTP 404, dead end** |
| FCA Handbook CONC 3.5 (s52) | **REACHED**, see `motor-finance-advertising.md` |
| SMMT car registrations (s50) | **REACHED**, see `smmt-registrations-and-segments.md` |
| gov.uk ZEV mandate collection | **NOT PROBED**. Reached only by reference, see below. |

## The governing regulations, named

Per s55 and s48: the **Passenger Car (Fuel Consumption and CO2 Emissions Information)
Regulations 2001**, with amendment Regulations in **2004, 2013 and 2018**. VCA links the
statutory instruments directly:

- 2001: `http://www.legislation.gov.uk/uksi/2001/3523/contents/made`
- 2004: `http://www.legislation.gov.uk/uksi/2004/1661/contents/made`
- 2013: `http://www.legislation.gov.uk/uksi/2013/65/contents/made`
- 2018: `http://www.legislation.gov.uk/uksi/2018/984/contents/made`

Also named: **EU Directive 1999/94/EC** (requires new car fuel consumption and CO2 data
"to be made freely available to consumers", and dealers "are required to display a label
on (or near to) every new car displayed for sale"); the **EU Tyre Labelling** regulation
in force since November 2012 covering C1, C2, C3 tyres; and **The Vehicle Emissions
Trading Schemes Order 2023 (ZEV Mandate)**, which s48 lists by name. That is the ZEV
mandate's legal instrument, captured by citation from a government source, though the
mandate's own text and any advertising implications were **not probed**.

## CRITICAL FINDING: websites are outside the CO2 advertising regulations

s55 defines "promotional literature" as "all printed matter used in the marketing,
advertising and promotion of a new passenger car", covering advertisements, guidebooks
and mainly graphical items such as billboard posters, and then states explicitly:

> "Websites, workshop manuals or owners' handbooks are not considered to fall within the
> definition of promotional literature."

This matters more than anything else on this page for a brand guideline. **The mandated
fuel-consumption and CO2 presentation rules bite on print and outdoor, not on the brand's
own website.** Online claims are instead governed by the ASA's CAP Code and, for finance,
by the FCA. A guideline that applies one disclaimer regime across all channels would be
wrong in both directions.

## What must be shown, and how prominently

Per s55, where promotional literature advertises, sells or leases a new car, the
vehicle's fuel efficiency and CO2 figures must be shown, **taken from official fuel
consumption and emissions tests**, and this includes **BEVs and PHEVs**. The presentation
test is qualitative, not metric. The text must be:

- "easy to read"
- "easily understandable"
- "no less prominent than the main part of the information"

**No font size, point size, colour-contrast ratio or placement rule is specified.** VCA
instead describes the common failure modes: omitting the data entirely, using "a smaller
font", or a colour "not as prominent as the main text".

For multi-model literature, figures must cover the vehicles included, but "this can be
limited to the range of data from lowest to highest performing examples". This is the
regulatory basis for the span convention observed in Vauxhall's own releases
(`132-134 g/km`, `47.9-48.7mpg`); see `spec-vocabulary-and-units.md`.

## NOT PUBLISHED, as distinct from not found

**No mandated caveat wording exists on the VCA pages reached.** The fetcher confirms
there is no "for comparison purposes only" text, and no prescribed form of words, on
either s48 or s55. So the familiar automotive caveat sentence is **not** a VCA-dictated
string. Any such wording in Vauxhall material is either a CAP/BCAP-driven qualification
(BCAP 3.10 and 3.11, see `asa-and-bcap-record.md`) or house practice. Recorded as NOT
PUBLISHED by this regulator, not as not found.

## WLTP

Per s48: WLTP "replaced the NEDC test procedure for establishing the official Fuel
Consumption and CO2 emissions of new cars in September 2017", becoming mandatory for all
new internal-combustion cars by September 2018. s55 references WLTP only as background
to the 2018 amendment. **Neither page prescribes how the WLTP qualifier should be
written.** That is consistent with, and probably explains, the five different
capitalisations Vauxhall itself uses.

## Enforcement and penalties

- **VCA is "the nominated UK enforcement body"** for figures in promotional literature.
- **Trading Standards** handles point of sale.
- VCA monitors "national/local newspapers, magazines, flyers and other printed
  manufacturer material".
- Penalties are decided "on a case-by-case basis": VCA writes setting out the
  circumstances, invites comment, then a "nominated Decision Officer" reviews and decides.
- A **voluntary pre-print opinion service** exists, via `adverts@vca.gov.uk`. Worth
  noting for a guideline, since it is the mechanism by which a brand can clear creative
  before publication. VCA adds that "Interpretation of the law remains the sole
  prerogative of the courts."

## Point of sale and labelling

Per s48, dealers "are obliged to present a label showing the official fuel consumption
and CO2 data for every new car displayed in a showroom or as part of an exhibition".
This is a dealer obligation, so it belongs with the dealer-tone material.

## Downloadable guidance documents, captured but NOT fetched

Recorded for a later run with binary or PDF capability. None of these were opened.

- New Car and Van CO2 Regulations Guidance 2025 V4:
  `https://www.vehicle-certification-agency.gov.uk/download-publication/3899/New%20Car%20and%20Van%20CO2%20Regulations%20Guidance%202025%20V4/`
- Environmental Labels 2026, Guidance for Industry (VCA062, Rev 6):
  `https://www.vehicle-certification-agency.gov.uk/download-publication/2603/VCA062%20Environmental%20Labels%202026%20-%20explanation%20of%20fields%20used%20Rev%206/`
- The Passenger Car (Fuel Consumption and CO2 Emissions Information) Regulations (VCA061):
  `https://www.vehicle-certification-agency.gov.uk/publication/vca061-3/`
- DfT/VCA GB car and van CO2 emission regulations manufacturer workshop, 30 March 2021
- UK Eco Innovation Application Form

Note the "Environmental Labels 2026" document is the most likely to carry the exact
label field definitions, which is the nearest thing to a prescribed presentation format.

## Related VCA pages captured, NOT fetched

WLTP page, Fuel Consumption Labelling, Responsibilities of manufacturers/importers/
dealers, Point of Sale (POS) System, Tyre Labelling, New Car Fuel Consumption guide,
Car Fuel Data and CO2 Tools, and the tools disclaimer (which states data is supplied
"by manufacturers on a voluntary basis and subject to checks"). Full URLs are in the
RETURN's new-sources list.

## Dating note

The VCA hub page (s48) states it was **last updated 7 January 2021**, yet it links a
guidance document dated 2025 and an Environmental Labels document dated 2026. So the
page date understates currency of the linked material. Recorded rather than resolved.

## The Electric Car Grant, a live 2026 UK policy affecting price copy

Not a VCA matter, but it is the dominant regulatory-adjacent qualifier in current
Vauxhall price copy, so it belongs here. Observed first-party:

- `£34,495 OTR (£32,995 inc. Electric Car Grant*)` and "Corsa GSE is priced at £32,995,
  including the Electric Car Grant (ECG)*." (s45, 2026-08-05)
- `£36,995 OTR (£35,495 inc. Electric Car Grant)` (s53, 2026-07-13)
- `ECG £1,500` on Astra Electric, and a claimed `ECS saving £2,200 in VED over six
  years` (s44, 2026-07-24; note "ECS" appears where "ECG" would be expected, an
  apparent source inconsistency, recorded not corrected)
- The asterisk expands to exactly: **"*Pending government approval"** (s45)

So the ECG amount is model-dependent (£1,500 on Astra, £1,500 implied on Mokka GSE from
£36,995 to £35,495, £1,500 on Corsa GSE from £34,495 to £32,995 which is actually
£1,500), and the grant is being cited in price copy **before** approval, guarded by a
four-word asterisk. That is a live compliance pattern a guideline must address.
