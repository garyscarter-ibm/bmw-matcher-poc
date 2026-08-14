# National brand voice versus franchised dealer voice

Rung 3 to 4 (third-party first-party, i.e. the dealer's own site, which is A2 for the
dealer and evidence-by-artefact for the brand relationship). Confidence: medium. One
dealer group observed, so this is a single data point, not a pattern.

## The reachability point the brief predicted, confirmed

`www.vauxhall.co.uk` is walled (s1, HTTP 403). **`www.evanshalshaw.com/vauxhall/` (s57)
loaded fully.** Dealer group sites are third-party hosts outside Vauxhall's WAF, so they
are a usable proxy for brand material when the brand's own site is not. Evans Halshaw is
part of the Pendragon group and is one of the largest UK Vauxhall retailers.

## NOT FOUND: any retailer toolkit or communication standard

No dealer toolkit, retailer brand centre, franchise portal or communication standard was
found. Note this is **NOT FOUND, not NOT PUBLISHED**: such material is normally behind a
dealer login, and WebSearch does not exist in this run (per SOURCE-MAP.md), so the usual
route to finding one was unavailable. Guessed paths on vauxhall.co.uk cannot be probed at
all because the whole host is walled.

## What the dealer actually does with the brand, observed

**Model names.** Written plainly, no trademark symbols, no all-caps styling: Frontera,
Grandland, Corsa, Astra, Mokka, Combo. So the dealer gets the base names right.

**Electrified naming drifts away from the brand's convention.** The dealer does not use
Vauxhall's `<Model> Electric` form as a badge. Instead:

- Image alt text uses the suffix style, for example "Grey Vauxhall Corsa Electric Front",
  and folder paths such as `corsa/2025/electric`
- Category headings prefer a combined phrase: **"Hybrid and Electric Range"**, **"Vauxhall
  Hybrid and Electric Vans"**, with URL slug `hybrid-electric`
- The fetcher reports **no use of Vauxhall's own sub-brand naming conventions anywhere on
  the page**: no `Electric` as a formal trim badge, no `-e`, no `GSe` or `GSE`

So the dealer flattens the brand's naming architecture into generic powertrain categories.
That is precisely the failure mode a guideline's dealer section exists to prevent.

**Taglines are not reused.** Vauxhall's own slogans do not appear. The copy is
dealer-authored and service-led, for example "Discover new and used cars and vans,
servicing and more through Evans Halshaw Vauxhall". Promotional flourishes are the
dealer's own invention: "Switch it up with an exciting, eco-friendly and electric new
Vauxhall from Evans Halshaw." Note "eco-friendly", an unqualified environmental claim of
exactly the kind the ASA scrutinises, appearing in dealer copy and not in any Vauxhall
release collected.

**Co-branding, with dealer primacy.** The composite **"Evans Halshaw Vauxhall"** is used
consistently as a single entity name, in headings, tiles and news items. Vauxhall's logo
sits at the top of the page while the Evans Halshaw logo holds the site-wide header slot.
So visually the retailer keeps primacy and the manufacturer mark is a section badge.

**Relationship claims the dealer makes about itself.** "we have built a long-lasting
relationship with Vauxhall", "As one of the leading Vauxhall retailers", claimed brand
expertise via "an excellent knowledge of the brand's range of vehicles", and network reach
via "conveniently located dealers".

## Finance and compliance: the notable absence

The fetcher reports **no pricing, no monthly figures, no PCP or HP mention, and no
representative APR or representative example anywhere on the page.** No asterisked
footnote, no terms-apply line, no finance-provider identification, and **no credit-broker
statement**. The only legal-adjacent material is footer navigation (Legal, Terms and
Conditions, Cookie Policy, Trading Companies, Privacy Notice) plus "© 2026 Evans Halshaw.
All rights reserved."

Offers are described only in unquantified terms: "a wide variety of competitive offers",
"great deals on used Vauxhall Cars", "Discover our wide range of Vauxhall personal and
business leasing options and exclusive deals." Leasing is presented as "Vauxhall Contract
Hire & Leasing", split personal and business. An affinity discount is teased as a question
rather than a figure: "Did you know that you could be entitled to a discount on new
vehicles if you work for a company that is partnered with Vauxhall?"

**Reading, offered as inference:** this is consistent with deliberate compliance
architecture rather than an oversight. By stating no rate and no cost-of-credit amount,
the page avoids triggering CONC 3.5.3R(1), and by teasing the discount as a question
rather than an incentive figure it stays clear of 3.5.7R(1)(c). Finance detail is deferred
to the linked stock and leasing pages. Compare Vauxhall's own van release, which does
state monthly figures and consequently carries full representative tables (s46). See
`motor-finance-advertising.md`.

## Signals that the content is locally authored, not brand-supplied

The fetcher identified several tells, which together are good evidence that this page is
**not** produced to a brand template:

- A typo survives in the vans section, "award-winng" for award-winning
- Inconsistency between the heading "MyVauxhall App" and its alt text "My Vauxhall App"
- One tile reuses an image asset from the **Hyundai** section of the same site for "Book a
  Service", so generic multi-franchise tiles are mixed with Vauxhall-specific ones

Likely manufacturer-originated elements: the Vauxhall logo asset, the studio and lifestyle
vehicle photography, and product concepts referenced rather than described, namely
**Vauxhall Connect** ("real time traffic updates, journey planning, and scheduled
charging"), the **MyVauxhall** app, and the **Motability Scheme**.

Motability is worth flagging: it is a UK disability mobility scheme and a very large
channel for Vauxhall volume, and it appears on the dealer page while no Motability copy
was found in any press release collected.

## The regulatory obligation that sits on the dealer, not the brand

Per VCA (s48), dealers "are obliged to present a label showing the official fuel
consumption and CO2 data for every new car displayed in a showroom or as part of an
exhibition", and Trading Standards, not VCA, enforces at point of sale. So a guideline's
dealer section has a hard external obligation to reference, distinct from the
manufacturer's own promotional-literature obligation.

## Gaps

- One dealer group only. No second group, and no single-site franchised dealer, probed.
- The dealer's actual **offers** and **stock listing** pages, where the representative
  examples and the real disclaimer patterns will be, were **NOT PROBED**. That is the
  single highest-value follow-up in this area, and it is reachable.
- No evidence found on what the brand permits or forbids. Everything here is what one
  dealer does, which evidences the gap between national and local practice but not the
  rule.
