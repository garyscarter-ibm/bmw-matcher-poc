# Runner notes — 2026-08-14

Findings made in the main thread, before and alongside the agent waves. Folded into
`FINDINGS.md` and `research.json` at consolidation. Kept separate so the provenance of
each finding stays clear.

## Step 0 — brand identity

| Field | Value | Source |
|---|---|---|
| Legal entity | Vauxhall Motors Limited (name restored 2017-09-18, replacing General Motors UK Limited, in use since 2008-04-16) | `en.wikipedia.org/wiki/Vauxhall_Motors` |
| Parent group | Stellantis, from 2021-01-16 (Groupe PSA + FCA merger). Immediate parent entity: Opel Automobile GmbH | same |
| Prior owners | General Motors 1925-2017 (acquired 1925-11-16 for US$2.5m); PSA Group 2017-2021 (deal announced 2017-03-06, €2.2bn, Opel Automobile GmbH passed to Peugeot S.A. by 2017-08-01) | same |
| Industry | Automotive — cars and light commercial vehicles, plus vehicle financing | same |
| Market | United Kingdom only. The marque was withdrawn from all other markets during the early 1980s | same |
| Twin brand | Opel. Ranges converged from 1980; Vauxhall models are re-badged Opels "principally engineered in Rüsselsheim am Main". Shared CEO: Florian Huettl, "CEO, Opel and Vauxhall" | Wikipedia + `stellantis.com/en/brands/vauxhall` |
| Sub-brands | GSe (current performance line), VXR (performance), Bedford (commercial, ended 1994), IBC | Wikipedia |
| Identity date | OPEN QUESTION at time of writing. Wikipedia's infobox file is `Vauxhall logo 2019.svg`; a corporate logo revision is dated 2008. Recon was tasked with establishing whether the 2019 identity is still current in 2026 | see below |

**Primary market chosen: UK.** Vauxhall sells in no other market, so the market choice is
forced rather than a judgement call. This also means there is no multi-market voice or
palette variation to reconcile, which is unusual and simplifies the copy dimension.

**Identity disambiguation.** "Vauxhall" is also a district of south London and a
rail/Underground station. Commons' `Vauxhall Cross roundel.svg` is the station roundel,
not the marque. Filter these out of any search result set.

## Positioning boilerplate, first-party

From `https://www.stellantis.com/en/brands/vauxhall` (retrieved 2026-08-14, undated page):

- Tagline / claim: **"Energising a Better Britain"**
- Descriptor: **"The British automotive brand. More than just a car maker, Vauxhall is a
  mobility provider focused on ensuring electric equality for all."**
- Models pictured on that page: Grandland, Frontera, Vivaro (electric variant).

Authority A2 (first-party incidental, corporate parent rather than the brand itself).
Undated, so currency `undated`. Note "electric equality for all" is a positioning phrase
worth cross-checking against the audience dimension: it claims a mass-market, access-led
framing rather than a premium one.

## Logo — ladder descent, and where it stopped

Rungs 1 and 2 (brand portal, press kit) are unreachable: `vauxhall.co.uk` is WAF-403 and
`media.vauxhall.co.uk` refuses connections. Rung 3 (SVG from the live DOM) is unreachable
for the same reason. Rung 5 (Wikimedia) was probed:

- **Commons holds no official current wordmark.** A 20-result Commons file search returned
  only photographs of badges and grilles, plus the London station roundel. Recorded as
  probed and dry, not as absent.
- **en.wikipedia hosts the mark locally as non-free:**
  `https://upload.wikimedia.org/wikipedia/en/1/18/Vauxhall_logo_2019.svg`,
  `image/svg+xml`, 3,146 bytes, 344 x 291. Licence: `Fair use`, `NonFree: true`,
  `Copyrighted: True`.
  - **Provenance fails the check.** The source field reads exactly "Logo obtained from
    Logopedia" — a fan wiki, not Vauxhall. Author field absent (categorised "Files with
    no machine-readable author"). Original upload 2020-06-15 by Conor M98; current
    revision 2020-12-28. A 2020-07 revision is noted as "Now including the updated
    wordmark". The page makes no statement about the years the logo was in use.
  - Treat as **A4, provenance unverified, rung 5**. It is a shape reference at best.

**The file could not be saved to disk.** `WebFetch` returns model-processed text, not
bytes, and it declined to reproduce the full markup. So there is no logo file in
`visual/logo/`, and that is a capability gap, not an absence of an official asset.

**Colour values read out of that SVG** (reported by the fetcher from the markup, not
measured from a rendered page):

| Hex | Applied to | Status |
|---|---|---|
| `#d7001c` | the emblem path — the griffin badge and its surrounding ring | candidate only |
| `#000037` | the `<g>` group holding the wordmark glyph paths | candidate only |

These are **candidates, not tokens.** They come from a fan-wiki-sourced reupload at
authority A4 with unverified provenance, which per the output contract cannot carry high
confidence and must not be presented as the published palette. They are worth recording
because they give a later run something concrete to verify a first-party value against.
If the current identity postdates 2019 they are `superseded` as well as unverified.

## Steps 6 and 7 — not performed

Step 6 (live-surface capture: screenshots, `preview_inspect` measurements, resolved
`:root` custom properties, `document.fonts`) and Step 7 (browser base64 binary rescue)
both require the in-app browser to attach to an external URL. That is not enabled on this
install, and `preview_start("brand-site")` failed with that error. Neither step ran. See
`CAPABILITY.md`. Consequence: this run contains **no measured values at all**, so the
adjudication tiebreak "measurement wins on rendered facts" never fires — every rendered
fact here rests on a document or a third party.
