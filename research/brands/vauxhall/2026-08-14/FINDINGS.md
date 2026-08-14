# Findings — Vauxhall UK — 2026-08-14

**Entity:** Vauxhall Motors Limited, a UK volume car and light commercial vehicle marque
owned by Stellantis N.V.
**Market:** United Kingdom.
**Run capability:** `text-only`, with one significant qualification (below).
**Evidence regime:** **D overall**, varying by dimension: copy and audience C/D, industry C,
visual and web D.

> **Scope.** This run researched and collected. It does not write the guideline and it makes
> no recommendations. Where something is missing, this document says it is missing and why.
> Nothing here fills a gap by invention.

---

## The headline: where Vauxhall documents itself, and where it does not

**Vauxhall publishes no brand documentation that this run could reach, and probably none at
all.** There is no design system, no token package on npm or GitHub (both searched with
multiple queries, both dry), and no downloadable brand-guideline PDF at any guessed path,
ever, per Wayback. That is a finding about the brand, not only about the run.

What the brand does publish, abundantly, is **press releases**. The single best source found
was `media.stellantis.com/uk-en/vauxhall`: a live, dated, first-party Vauxhall press room
that sits **entirely outside the WAF** that blocks `vauxhall.co.uk`. Eleven artefacts from it
carry the copy dimension to high confidence on its own.

The second-best source was not a marketing surface at all. It was the **519-page Stellantis
2025 Annual Report and Form 20-F**, which positions Vauxhall more precisely than any
brand-facing page: among the group's `mainstream` brands, explicitly against named premium
stablemates.

**The brand's own website was never reachable.** `www.vauxhall.co.uk` returns 403 to every
route available here, and so does the whole Stellantis brand-site estate.

## The capability correction that changed the run

The run was classified `text-only` and every agent was told, correctly for the time, that
**no binary could be downloaded**. That was **false**, and it was the run's most consequential
wrong belief.

The harness fetcher **saves a response body to disk** even when it cannot render those bytes
as text, and reports the path. The sandboxed shell can read that path. So binaries are
retrievable from any host that already answers.

It was found by chasing an inconsistency rather than accepting it: the audience agent
mentioned extracting text from a PDF, which could not have happened if binaries were
unreachable. Following that up produced **the run's only measured values**. Six binaries were
retrieved: four first-party logo PNGs, one press photograph, and the annual report.

Two cautions came with it. The fetching model's own description of a binary is **unreliable**
(it misreported pixel dimensions on three of four PNGs; `file(1)` and Pillow are the
authority). And it is per-URL, so it **does not defeat the WAF**.

---

## Copy and voice — confidence **high**, rung 4, regime C/D

The strongest dimension. Eleven first-party artefacts across a deliberate register spread.

**Files:** [`copy/tone.md`](copy/tone.md), [`copy/tone.json`](copy/tone.json),
[`copy/phrase-bank.md`](copy/phrase-bank.md), [`copy/pages/`](copy/pages/) (12 captures).

**Mechanics, lexicon and legal hedging are all high confidence.** Third person throughout.
`we` appears only inside attributed quotes. `you` appears **once in eleven artefacts**, in a
finance disclosure. No em dashes, no exclamation marks and no semicolons anywhere in
first-party copy. Units close up against the figure (`281PS`, `48.7mpg`). Imperial for
consumers, metric for engineering, and **never kilometres**. `Retailer`, never `dealer`.

**One finding worth flagging to whoever authors next.** The `ABOUT VAUXHALL MOTORS`
boilerplate is **modular, not invariant**: the Team GB sentence appears on four releases and
is absent from the Mokka GSE pack. Treating the block as fixed would be wrong.

**Open questions.** No verbal-identity document exists on any reachable surface, so all of
this is inferred from output rather than read from a rule. The register spread is narrow by
necessity: press releases plus two app-store listings, with no advertising, email, in-car UI
or configurator microcopy. `rhythm` is the one low-confidence sub-finding, because sentence
length across eleven press releases is as much a genre artefact as a brand one.

## Visual identity — confidence **medium** overall, and deliberately uneven

**Files:** [`visual/visual.md`](visual/visual.md),
[`visual/color/palette.json`](visual/color/palette.json),
[`visual/logo/logo.md`](visual/logo/logo.md), [`visual/type/type.json`](visual/type/type.json),
[`visual/imagery/imagery.md`](visual/imagery/imagery.md).

A single confidence label cannot carry this dimension, so it is split.

### Colour: **high**, off-ladder first-party asset measurement

Four first-party PNGs were retrieved, verified with `file(1)` and measured with Pillow.

| Value | RGB | Applied to | Share of opaque pixels |
|---|---|---|---|
| **`#eb0000`** | 235, 0, 0 | griffin roundel, ring and V flag | 80.68% |
| **`#00003a`** | 0, 0, 58 | the VAUXHALL wordmark | 19.32% |
| **`#002a42`** | 0, 42, 66 | one-colour lockup variant, whole mark | 98.25% |
| **`#ffffff`** | 255, 255, 255 | reversed knockout lockup | 100% |

**The scope limit matters.** These are high confidence as **what the brand's published assets
render**. They are **not** a colour specification: no Pantone, no CMYK and no stated hex was
found anywhere this run, from any party. A spec may define a build that converts to a
slightly different sRGB hex.

### Logo artwork: **high**, viewed and measured

A **vertical lockup**: a circular ring enclosing a left-facing **griffin** with a **V flag**,
above a heavy geometric all-caps wordmark. Inked aspect ratio 1.1753. The ring interior is
**transparent, not white**, so the mark reverses cleanly.

Three of the four canonical treatments are evidenced by first-party files: **full colour**,
**one-colour**, and **reversed**. Not evidenced: a horizontal lockup, an emblem-only mark,
any co-branding lockup, and **any vector master**. All four files are raster.

### Logo rules: **none**, and NOT REACHABLE rather than NOT PUBLISHED

Clear space, minimum size, misuse, exclusion zone, co-branding: **none found anywhere**. These
live at ladder rungs 1 and 2 (brand portal, press kit) and both are unreachable. The Vauxhall
press room has no logo download and no brand-asset section at all, confirmed twice.

### Typography: **none**. UNIDENTIFIED

**No family name, no foundry, no weight set, no file.** The rung that settles this in one call
is structurally unreachable, and rung 5 was probed three ways and was dry every time. The
wordmark in all four retrieved files is **outlined artwork**, so it carries no font reference
and would not settle the question even if a face were named.

**The trap to avoid:** the only `@font-face` families seen anywhere in this run were **Gotham**
and **Open Sans**, and they belong to the **Stellantis press portal**, not to Vauxhall. Gotham
is a licensed retail face from Hoefler & Co. Neither is evidence about Vauxhall.
**Do not accept a plausible "Vauxhall Sans".**

### Imagery: **low**, plus exactly one photograph actually seen

Galleries are client-side rendered: three gallery URLs returned the navigation shell with zero
items and zero captions, so the richest source of first-party captions on the site was
reachable but unreadable. One image was retrieved and viewed, and it is telling: the lead
image of a 2026 **electric** performance launch is a **white 1980s Astra GTE** in a panning
motion shot. That is the GSE heritage claim made in a picture rather than a sentence.

### The identity date, still unresolved, and it gates everything

**2008** is the last **evidenced** dated redesign. The widely repeated **2019** traces to a
Wikimedia **filename artefact** with no corroboration, on a file uploaded 2020-06-15 from a
Fandom fan wiki. All three trademark registries were probed and all three are walled: UK IPO
403, EUIPO JavaScript-only, WIPO behind a captcha. Opel's mark dates to 2023 and the twins
often move together, but there is **no Vauxhall-side evidence** for a 2023 revision.

Consequence: **nothing in this run can be checked for staleness.** Do not date the identity.

## Web and digital — confidence **none**, no rung reached, regime D

**Files:** [`web/tokens.json`](web/tokens.json) (`tokens` empty by design),
[`web/observations.md`](web/observations.md), [`web/css/`](web/css/),
[`web/markup/NO-CAPTURE.txt`](web/markup/NO-CAPTURE.txt).

The only dimension that returned nothing at all. Two **independent** structural blocks, and
the second is the more interesting:

1. `www.vauxhall.co.uk` answers **403**, and every guessed first-party asset subdomain
   (`assets.`, `cdn.`, `static.`, `images.`, `content.`, `business.`) is **DNS ENOTFOUND**.
   There is no un-walled first-party host to read CSS from.
2. The fetcher **converts HTML to markdown before any model sees it**, which strips
   `<link rel=stylesheet>`, `<style>` and `<script src>`. A stylesheet URL cannot be
   discovered from **any** page in this run, reachable or not.

So the dealer-template fallback, the most promising substitute, was **defeated by the fetcher
rather than by the dealer**: both dealer sites returned 200 and reported zero stylesheets.

**One thing was readable, and it is quarantined.** The Stellantis press portal's own CSS is
recorded under `nonRepresentative` with a warning. It is FCA-legacy, every class carries an
`.fca-` prefix, and it contains **zero Vauxhall selectors**. The Vauxhall press room is
branded by swapped logo images, not by CSS theming. It is not Vauxhall's design system and
must never be presented as one.

## Audience — confidence **medium**, rung 2, regime C/D

**Files:** [`audience/audience.md`](audience/audience.md),
[`audience/audience.json`](audience/audience.json),
[`raw/audience/stellantis-2025-annual-report-extract.txt`](raw/audience/stellantis-2025-annual-report-extract.txt).

Four evidenced segments, drawn from **corporate filings rather than the marketing site**,
which is the right source for this dimension and is easy to get wrong.

The annual report places Vauxhall verbatim "under the **mainstream** brands Citroen, FIAT,
Opel, Peugeot, Vauxhall as well as premium brands Alfa Romeo, DS and Lancia". That single
sentence positions the brand more precisely than anything on a brand-facing page. The filing
also evidences the affordability strategy, UK ZEV mandate exposure, and Ellesmere Port.

Two segments come from the brand's own campaigning rather than its product marketing: an
**accessibility-constrained** segment (an FOI-based release on accessible EV charging) and an
**SME and van** segment (electric vans at diesel monthly cost).

**Open questions.** No first-party segmentation document, so segments are inferred from what
the brand says and sells. **No demographic data of any kind** from any source. Claimed versus
observed could not be closed, because observing requires the walled site.

## Industry, automotive — confidence **high**, rung 2, regime C

**Files:** [`industry/industry.json`](industry/industry.json) plus 12 topic files.

This dimension exists to catch what the other four miss, and it corrected three pieces of
received wisdom:

- **The sub-brand is `GSE`, not `GSe`.** Every first-party body-text instance uses GSE,
  expanded as "Grand Sport Electric". The brand claims lineage from **GTE and GSi** and
  **never mentions VXR or OPC** in any 2026 source read.
- **No formal ASA ruling against Vauxhall exists.** Five cases were **informally resolved**
  between 2021-11-17 and 2025-01-08, all broadcast. So the hoped-for route of reading
  Vauxhall's own ad copy quoted verbatim by a regulator is **NOT PUBLISHED**, not merely
  unreached.
- **The emissions rulebook that was probed is the wrong one for the website.** The VCA states
  that websites "are not considered to fall within the definition of promotional literature",
  so its CO2 presentation rules do not govern the brand's own site. **CAP Code section 3,
  non-broadcast, is the operative regime and it is unprobed.**

Also recorded: independent SMMT registration data, the twin-brand relationship with Opel, and
the spec-vocabulary and units conventions that the copy dimension depends on.

---

## Contested values

Every disagreement is recorded rather than tidied away. Full detail in
[`research.json`](research.json) under `contested`.

| Claim | Values | Resolution |
|---|---|---|
| **Logo emblem red** | `#d7001c` (two third-party sources) vs **`#eb0000`** (measured, first-party) | **Measured wins.** `#d7001c` is **disproved** as a first-party value |
| **Logo wordmark navy** | `#000037` (same two sources) vs **`#00003a`** (measured) | **Measured wins.** Blue channel 58, not 55 |
| **Which hue leads the identity** | red, vs blue inferred from the filename `verticalbluecopy` | **RESOLVED. Never a conflict.** The master is a red roundel above a navy wordmark; the "blue" file is a one-colour monochrome variant |
| **UK market share 2026** | 4.8% (Vauxhall, H1, car plus van) vs 4.24% cars and 8.02% LCVs (SMMT, Jan to Jul) | **UNRESOLVED, and deliberately not averaged.** Different bases, different periods |
| **Sub-brand orthography** | `GSe` (secondary coverage) vs **`GSE`** (first-party) | **First-party wins on its own name** |
| **Identity date** | 2019 (filename artefact) vs 2008 (last evidenced) | **UNRESOLVED.** Neither is usable |

### The most useful of these, for a future run

Two third-party sources state `#d7001c` and `#000037` **exactly**, and **both differ from
first-party artwork**. That is the signature of **one shared upstream copy**, not of
independent access to the master. Wikipedia's own file history cites "an official SVG from a
Vauxhall dealer site", which is the likely common ancestor.

**Consequence: the "two independent sources agree" stopping rule must not be applied to this
pair.** They are recorded in `palette.json` under `disproved` specifically so a later run does
not re-promote them. Knowing what value circulates in the dealer and fan-wiki supply chain is
still useful when auditing third-party Vauxhall material. It is not a token.

---

## What a downstream authoring step can and cannot use

**Can use, with confidence:** the copy mechanics, lexicon and legal hedging; the four measured
colour values, carrying their scope limit; the logo artwork description and the three
evidenced variants; the GSE orthography and lineage; the regulatory envelope; the mainstream
positioning.

**Cannot use, and must not be filled in:** any typeface; any logo rule; any colour
specification, secondary palette or usage ratio; any web, geometry, motion or component token;
any identity date; any demographic figure.

**Run path:** `research/brands/vauxhall/2026-08-14`
**Assets on disk:** 6 (4 logo PNGs, 1 press JPEG, 1 extracted document), about 364 KB of
binaries, 1.0 MB total including text.
**Sources:** 90 URLs considered; 64 cited; 6 downloaded, 64 read text-only, 11 dead-end,
9 walled.
