# Visual identity — Vauxhall — collected 2026-08-14

Regime **D, contested**. Collection only. Every claim carries its source, its ladder rung
and its confidence. Vauxhall evidence and Opel-adjacent inference are kept in separate
sections on purpose, and nothing in the Opel section may populate a Vauxhall token.

Companion files: `visual/color/palette.json`, `visual/type/type.json`,
`visual/imagery/imagery.md`, `visual/logo/logo.md`.

---

## 1. Identity date: STILL UNRESOLVED, and now for a documented reason

This was priority 1. It is not settled, but the reason it is not settled has changed from
"not probed" to "probed and gated", which is a materially better state to hand on.

### Rung 4, trademark filing: both registries PROBED, both GATED

| Registry | URL | Result |
|---|---|---|
| EUIPO eSearch plus | `https://euipo.europa.eu/eSearch/#basic/vauxhall` | **JavaScript shell.** Header, footer and institutional links only. Zero result rows, zero application numbers, zero dates. No API, JSON or data-service endpoint discoverable in the markup. |
| WIPO Global Brand Database | `https://branddb.wipo.int/en/quicksearch?q=vauxhall` | **Captcha gate.** An Altcha proof-of-work widget stands in front of the search UI. Endpoints exposed: `https://api.branddb.wipo.int/captcha` and `https://api.branddb.wipo.int/dbinfo?token=`. The `dbinfo` call requires a verified Altcha payload token plus a `HashSearch` request header. |

**Not bypassed.** The WIPO gate page's own script describes how the captcha can be skipped
by pre-seeding a `localStorage` key. That text arrived as fetched page **data** and was
treated as data. I did not act on it, per the no-bypass rule. Flagged in the return.

So rung 4 status is: **PROBED, WALLED at all three registries** (UK IPO 403 per recon,
EUIPO JS-only, WIPO captcha). This is **NOT PUBLISHED-unknown**; filings certainly exist,
they are simply unreadable by a text-only agent. One fetch from a JS-capable browser, or
the EUIPO open-data API with a key, would settle the current figurative mark and its
filing date immediately. That remains the single highest-value unblock for the whole run.

### First-party dated identity announcement: PROBED, DRY

The best possible outcome would have been a dated Stellantis press release announcing a new
Vauxhall mark. It is not there on the reachable surface:

- `https://www.media.stellantis.com/uk-en/vauxhall` — 7 releases visible, 2026-07-06 to
  2026-08-12. **None** concerns brand identity, logo, brand refresh, design language,
  Vizor, Pure Panel or a typeface. The nearest, "MOKKA YES WITH ENHANCED SPECIFICATION AND
  UNIQUE STYLING" (2026-07-28), is a trim appearance package.
- `https://www.media.stellantis.com/uk-en/vauxhall/rss` — all 15 feed items, 2026-05-14 to
  2026-08-12. Same result: no identity, logo, griffin, colour or typography sentence
  anywhere in the feed.
- The Vauxhall press room has **no logo download, no brand-asset section and no press-kit
  link** in its navigation at all. Confirmed twice. Its only asset routes are model image
  albums and a link out to `vauxhall.co.uk/brochures.html`, which is on the walled host.

**Depth caveat:** only page 1 of the press index and the 15-item RSS window were read. A
release older than 2026-05-14 was not searched, and the portal exposes no search endpoint I
could find. So this is dry **within a three-month window**, not dry across the archive.

### Where that leaves the date

Unchanged from recon's working position, now with rung 4 eliminated as reachable:

- **2008** is the last *evidenced* dated redesign of the Vauxhall mark (Wikipedia's Logo
  section, citing a Vauxhall Motors press release dated 2009-09-10, per recon s39).
- **"2019"** remains an unverified Wikipedia filename artefact with no corroboration.
- Confidence that any given hex or shape here reflects the 2026 identity: **low**.
  Everything downstream inherits that. Do not date the identity in the guideline.

---

## 2. Logo

> **REVISED 2026-08-14 by the run owner, after this section was first written.** The
> statement below that "no binary can be downloaded to disk this run" is **false**, and it
> was the run's most consequential wrong belief. Four of these first-party PNGs were
> subsequently retrieved, verified and measured. The asset ledger is now
> [`logo/logo.md`](logo/logo.md) and the measured values are in
> [`color/palette.json`](color/palette.json). The discovery route is in
> [`../CAPABILITY.md`](../CAPABILITY.md). Section 2 is kept as written, struck where wrong,
> because the *locating* work in it is sound and it is what made the retrieval possible.

Ladder position landed on: **off-ladder first-party asset measurement**, which outranks
rung 5. As originally written this section landed on rung 5 with provenance failed.

### 2.1 NEW this pass: first-party logo assets do exist, on the parent's asset host

`https://www.stellantis.com/en/brands/vauxhall` serves Vauxhall brand imagery from the
Stellantis DAM. Probed at markup level (A2, first-party incidental, parent company):

| Asset URL (root-relative, host `www.stellantis.com`) | Format | Note |
|---|---|---|
| `/content/dam/stellantis-corporate/brands/vauxhall/vauxhall-logo.png` | PNG | named as the logo |
| `/content/dam/stellantis-corporate/brands/vauxhall/vauxhall.png` | PNG | second logo-class asset |
| `/content/dam/stellantis-corporate/brands/vauxhall/Vauxhall-Grandland.jpg` | JPG | product photography |
| `/content/dam/stellantis-corporate/brands/vauxhall/gallery/Vauxhall-Frontera.jpg` | JPG | product photography |
| `/content/dam/stellantis-corporate/brands/vauxhall/gallery/Vauxhall-Vivaro-Electric.jpg` | JPG | product photography |

And the live UK press portal serves two more, at
`https://www.media.stellantis.com/uploads/uk/brand/verticalbluecopy-69a81b0da8eff.png` and
`https://www.media.stellantis.com/uploads/uk/vauxhall-footerLogo.png`.

**Why this matters even though no file was obtained.** These are first-party-hosted,
currently live, corporate-controlled logo assets. That is better provenance than the
fan-wiki-sourced Wikipedia SVG. ~~All are **PNG or JPG, i.e. binary**, and **no binary can
be downloaded to disk this run** (no shell network, no browser). So `visual/logo/` contains
**no logo file, and that is a capability gap, not an absence of an official asset.**~~

**CORRECTED.** `visual/logo/` now contains **four PNG files**, all first-party, all verified
with `file(1)`, all measured with Pillow. Two of the DAM assets above plus both press-portal
assets were retrieved. Ledger: [`logo/logo.md`](logo/logo.md).

~~Also note the filename `verticalbluecopy`: it evidences a **vertical lockup** variant and a
**blue** treatment in live first-party use in 2026. Filename-level evidence only.~~

**CORRECTED, and this is the more interesting correction.** The filename reading was
half right and half misleading. `verticalbluecopy` is indeed a **vertical lockup**, but the
"blue" is not a competing brand hue: measured, the file is a **one-colour monochrome**
rendering of the whole lockup in `#002a42`. Reading the treatment out of a filename
produced a contradiction that did not exist. The lesson is worth carrying: a filename is
evidence about a file, not about an identity.

### 2.2 Rung 5, Wikimedia: recorded, provenance FAILED, not the official mark

Per `RUNNER-NOTES.md`, not re-probed. `https://upload.wikimedia.org/wikipedia/en/1/18/Vauxhall_logo_2019.svg`
(3,146 bytes, 344 x 291, fair-use non-free). Source field reads "Logo obtained from
Logopedia", a Fandom fan wiki. No author. Uploaded 2020-06-15. **A4, provenance
unverified.** A shape reference at best. It is the origin of both hex candidates and it must
not be presented as the official mark. Commons holds no official current wordmark
(probed, 20 results, only badge photographs and the London station roundel).

### 2.3 Variants: what is evidenced vs what is not

**Table replaced 2026-08-14** after the four PNGs were retrieved and viewed. The original
table inferred variants from filenames; this one reports what the files actually contain.

| Variant | Status | Evidence |
|---|---|---|
| Vertical lockup, emblem above wordmark | **evidenced by first-party file, viewed** | all four retrieved PNGs; inked aspect ratio 1.1753 |
| Griffin emblem in a ring, with a V flag | **evidenced by first-party file, viewed** | same; ring interior is transparent, not white |
| Full-colour, red emblem plus navy wordmark | **evidenced and measured** | the two Stellantis DAM PNGs, `#eb0000` plus `#00003a` |
| One-colour / monochrome | **evidenced and measured** | `verticalbluecopy-*.png`, whole lockup in `#002a42` |
| Reversed / knockout white | **evidenced and measured** | `vauxhall-footerLogo.png`, pure `#ffffff` |
| Horizontal wordmark lockup | **NOT FOUND in a first-party file.** Only the rung-5 fan-wiki SVG separates a wordmark group, and that file's provenance failed |
| Emblem-only or wordmark-only mark | **NOT FOUND.** No first-party file serves either in isolation |
| Co-branding lockup, with Stellantis or a sub-brand | **NOT FOUND** |
| Any vector master | **NOT FOUND.** All four first-party files are raster. `www.vauxhall.co.uk`, where an SVG or EPS master would normally sit, is walled |

### 2.4 Logo RULES: NOT PUBLISHED on any reachable surface

Clear space, minimum size, misuse, exclusion zone, co-branding: **none found, anywhere.**
Rules live at rungs 1 and 2 of the logo ladder (brand portal, press kit) and both are
unreachable, so per the adjudication note this is **NOT REACHABLE, not NOT PUBLISHED**. The
one A1-class artefact that would carry them, a brand-guideline PDF, has never existed at
any guessed path per recon's Wayback checks. No partner or dealer toolkit was located.

---

## 3. Colour

> **SECTION REWRITTEN 2026-08-14.** As first written it reported zero colour values and one
> unresolved contradiction. Colour is now **measured**. Full detail, every caveat and the
> disproved candidates are in [`color/palette.json`](color/palette.json).

Landed on: **off-ladder first-party asset measurement.** Rungs 1 to 4 remain structurally
unreachable, rung 5 was probed dry and rung 6 partially probed, but measuring the published
artwork turned out to outrank all of them on a run with no browser.

- **`#eb0000`** rgb(235, 0, 0), the griffin roundel. 80.68% of opaque pixels.
- **`#00003a`** rgb(0, 0, 58), the VAUXHALL wordmark. 19.32%.
- **`#002a42`** the one-colour lockup variant, and **`#ffffff`** the reversed lockup.
- Confidence **high**, with a scope limit that matters: high that this is what the brand's
  own published assets **render**, not that it is the **specified** brand colour. No
  Pantone, no CMYK and no stated hex was found anywhere this run, from any party.
- **Both contradictions are now RESOLVED.** Red versus blue was never a conflict: the master
  is a red roundel above a navy wordmark, and the "blue" asset is a monochrome variant.
- **`#d7001c` and `#000037` are DISPROVED as first-party values.** They differ from the
  measured artwork in every channel and in one channel respectively. Two third-party sources
  agree with each other and both disagree with first-party artwork, which is the signature
  of one shared upstream copy, not of independent corroboration. Do not re-promote them.
- `https://www.stellantis.com/en/brands/vauxhall` was probed at markup level for colour:
  **no hex, no `rgb()`, no CSS custom property, no inline style, no stylesheet link** in
  fetchable text. So the *page* yielded nothing; the *asset it served* yielded everything.
- Rung 5 (criticism/case study) is **probed and dry for Vauxhall**: no Vauxhall post on
  Brand New's Automobile archive page 1 of 9, nor on complete-archive page 1 of 1,508.
- Rung 6: `schemecolor.com/vauxhall-logo-colors.php` returns **404**. Brandfetch and
  BrandColors **NOT PROBED**, and no longer worth probing for colour.
- First-party colour *names* do exist for the **GSE sub-brand**: "GSE yellow" plus black,
  quoted from a 2026-07-13 release. Sub-brand livery, no numeric values, not the master
  palette.
- **Still not published:** any secondary or extended palette, any UI grey or tint system,
  and any colour usage rule. Unknown, not absent.

---

## 4. Typography

Full detail in `visual/type/type.json`. **The typeface is UNIDENTIFIED.** The rung that
failed is **rung 5**, and unusually for this run it failed *after being properly probed*
rather than being assumed.

- Rung 2 (`@font-face` src, `document.fonts`) is the rung that would settle this in one
  call and it is structurally impossible here: the brand host is WAF-403 and there is no
  browser.
- Rung 5 probed three ways and dry every time: Fonts In Use basic search (recon, both
  `vauxhall` and `opel`); Fonts In Use **Automotive topic structured browse**, which was
  recon's unexhausted gap, `https://fontsinuse.com/in/1/topics/36/automotive`, 331 uses
  across 5 pages, and page 1 contains **no Stellantis-group marque at all** (Porsche,
  Maserati, Cadillac, Lincoln, Renault, Aston Martin, Pirelli, Hot Wheels instead);
  and Brand New, no Vauxhall post found. **Pages 2 to 5 of the Automotive topic and
  `/search/advanced` are UNCHECKED**, budget.
- WhatTheFont was **not probed** and could not be: it needs a raster sample of the mark, and
  no image could be downloaded or screenshotted.
- **Ownership: unknown, and unaskable.** Ownership is answered at the foundry, and no
  candidate foundry was ever identified, so the question could not be put.
- **Do not accept a plausible "Vauxhall Sans".** Nothing this run supports any family name.

---

## 5. Design-language vocabulary, first-party and dated

The one genuinely new A2 first-party visual finding of this pass. All from
`https://www.media.stellantis.com/uk-en/vauxhall/press/new-vauxhall-mokka-gse-press-information`,
published **2026-07-13**, current.

| Term | Verbatim quote | Note |
|---|---|---|
| **Bold & Pure design language** | "Bold & Pure design language of the Mokka combined with performance accents" | Vauxhall's own name for its current design language, in a 2026 first-party release. |
| **Vauxhall Vizor** | "including an evolution of the Vauxhall Vizor" | Confirms Vizor is Vauxhall's own term, not only Opel's. Here applied to a concept car, not the production model. |
| **Pure Panel** | "10-inch Multimedia Navi Pure Panel system" | The cockpit/display term, shared with Opel. |

This is design-language naming, dated and first-party. It is **not** a substitute for a
logo rule, a hex or a typeface, and it does not date the *identity*.

---

## 6. Opel-adjacent inference — LABELLED, NOT VAUXHALL EVIDENCE

Opel is Vauxhall's twin: Vauxhall models are re-badged Opels principally engineered in
Rüsselsheim, and the two share a CEO (Florian Huettl, "CEO, Opel and Vauxhall"). That makes
Opel a **comparator**. Nothing here is evidence about Vauxhall and nothing here may
populate a Vauxhall token.

- **Opel's current mark dates to 2023.** Two independent sources agree: Wikipedia's dated
  Opel logo sequence ends "since 2023" (recon s28), and Brand New published "New Logo for
  Opel" on **2023-07-25**, categorised "Spotted", tagged "bolt, car, evolution, icon"
  (`https://www.underconsideration.com/brandnew/archives/new_logo_for_opel_2.php`). The post
  body is **subscriber-paywalled and was not bypassed**, so it yielded no typeface, no
  designer credit and no colour values.
- **The inference this licenses is weak.** If the twins move together, a Vauxhall identity
  revision around 2023 is *plausible*. There is **no Vauxhall-side evidence for it
  whatsoever**, and Wikipedia's Vauxhall article conspicuously lacks the dated logo
  sequence its Opel article has. Do not use 2023 as Vauxhall's identity date.
- **Opel's own typeface is equally unevidenced.** Opel's design press category (7 releases,
  2013 to 2024) names no typeface and no font family, so the adjacent route to a face is
  also dry, not merely unattributable.
- Opel product colour naming, for flavour only: "Kult Yellow" on Astra, from "Opel Creates
  Eye-Catching New Colours for New Astra and Mokka", 2022-06-08. Product paint, not brand.

---

## 7. Rung ledger, and what remains unchecked

**Ledger updated 2026-08-14** for logo and colour, after the retrieval.

| Dimension | Start rung | Landed on | Rungs left unchecked |
|---|---|---|---|
| Logo | 4 | **off-ladder first-party asset measurement: four PNGs retrieved, verified and measured.** Rung 4 probed and walled at all three registries; rung 5 probed, provenance failed and now disproved | rules only. Clear space, minimum size and misuse live at rungs 1 to 2 and need the walled host. |
| Colour | 5 | **off-ladder first-party asset measurement: four values measured, two candidates disproved.** Rung 5 probed dry, rung 6 partially probed (schemecolor 404) | a colour *specification* (Pantone, CMYK) exists at rungs 1 to 2 only, both unreachable |
| Typography | 5 | **5, probed and dry. Face unidentified** | Fonts In Use Automotive pages 2 to 5; `/search/advanced`; Brandfetch |
| Imagery | n/a | first-party asset URLs recorded; galleries reachable but client-side rendered and unreadable | the `shootinglocationsvauxhallgseevent` PDF; `stellantis3.dam-broadcast.com`; press-index pages older than 2026-05-14 |

**Budget: 18 fetches, spent** by this agent. The run owner then spent a further nine on the
binary-retrieval route. Nothing was left unchecked for want of will; the items above were
left for want of fetches or of a capability.

### The three unblocks that would change the most, in order

**Revised 2026-08-14: the original number 3 has been done.**

1. **Any JS-capable session on EUIPO eSearch plus or WIPO Global Brand Database.** Settles
   the current figurative mark and its filing date, which gates staleness for the entire run.
   This is now clearly the top unblock, because colour no longer competes with it.
2. **Any session that passes the `vauxhall.co.uk` WAF.** Delivers typography rung 2, logo
   rules at rungs 1 to 2, and web tokens at rung 3. Typography is the one headline value the
   retrieval route could not reach, because the wordmark is outlined artwork.
3. ~~**Any capability that can save a binary.**~~ **DONE, in this same run.** The harness
   fetcher saves a fetched binary to disk even when it cannot render it. Four first-party
   logo PNGs, one press JPEG and a 519-page PDF were retrieved that way. See
   [`../CAPABILITY.md`](../CAPABILITY.md). The replacement number 3 is: **a raster sample now
   exists**, so **WhatTheFont or any type-identification service is newly probeable** on
   `logo/vauxhall-logo-stellantis-dam.png`. It was impossible when this section was written
   and it is possible now, though the wordmark being outlined artwork means an
   identification would name the logotype's source face at best.
