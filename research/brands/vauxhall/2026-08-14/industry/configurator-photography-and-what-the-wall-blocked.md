# Configurator, stock-listing UX and photography conventions: what the wall blocked

Rung: none reachable for the primary evidence. Confidence: low for anything positive
here. This file exists to record **blocked, not absent**, per the brief's instruction.

## What is structurally unavailable this run

Configurator flow, trim-selector UX, stock-listing filters and result-card anatomy, and
the brand's photography angle conventions are all normally read off the live consumer
site. `www.vauxhall.co.uk` returns **HTTP 403 to the harness fetcher on every path
tried** (s1, s2, s3), there is no shell internet, and no browser. `www.opel.com`, the
obvious sister-brand substitute, is behind the **same WAF** (s4). The Wayback proxy
`web.archive.org/web/...` is blocked at the fetcher, so the archived site cannot be read
either.

So: **BLOCKED, not absent.** A run with browser capability or an unblocked fetcher would
get all of this cheaply.

## What was recovered anyway

### Photography, indirectly

- **Press image library exists and its paths are known**, from reconnaissance:
  `https://www.media.stellantis.com/uk-en/vauxhall/media-library/gallery`, with the
  international pattern `/em-en/{brand}/media-library/{press-images|press-videos|gallery}`
  (s9, s11). Some sections sit behind `/em-en/login`. **NOT PROBED this run.** This is the
  single best available source for approved photography and its angle conventions, and it
  is outside the WAF.
- Two first-party brand image paths were captured in reconnaissance but **not fetched**,
  because they are binaries and this run is text-only:
  `/uploads/uk/brand/verticalbluecopy-69a81b0da8eff.png` and
  `/uploads/uk/vauxhall-footerLogo.png` (s11). The filename fragment "verticalbluecopy"
  is itself a weak signal of a vertical lockup and a blue colourway, and should be treated
  as a filename artefact only, not as a colour claim.
- **Angle vocabulary observed in third-party alt text**, s57: "Grey Vauxhall Corsa
  Electric **Front**", with asset folder paths of the form `corsa/2025/electric`. That
  implies the supplied asset set is organised by model, model year and powertrain, and that
  named views exist ("Front"). This is one alt string from a dealer site, so it is weak
  evidence of Vauxhall's own naming, but it is the only view-naming evidence found.
- The dealer page mixes "studio and lifestyle vehicle photography" likely supplied by the
  manufacturer with generic in-house tiles, and demonstrably reuses an image from the
  Hyundai section of the same site for a service tile (s57). So supplied photography and
  local photography coexist in the retail channel without visible separation.

### Caption and image conventions from press releases

The releases collected carry technical annotation rather than descriptive captions. Two
observations that bear on image use:

- **Trim-level footnoting attaches to imagery of wheels**: in s44 an asterisk on the trim
  wheels expands to "Unique design of 18-inch wheels fitted as standard on all electric
  versions". So wheel specification is footnoted rather than shown, which implies imagery
  cannot be relied on to represent trim.
- **A German third-party endorsement mark is footnoted**: in s44 an AGR asterisk expands
  to the healthier-backs campaign "Aktion Gesunder Rücken e.V". A UK-market release
  carrying an untranslated German certification is a twin-brand artefact worth noting.
- **Embargo convention**: s53 carries "EMBARGO: Driving Impressions – Wednesday, 22nd July
  @ 00:01 (UK)". Note the format: label, subject, weekday, ordinal date, `@`, 24-hour
  time, territory in brackets. Releases close with "ENDS".

### Stock-listing and configurator, indirect signals only

- The dealer hub (s57) is "a functional, link-heavy brand landing page" that defers all
  price and finance detail to linked stock and leasing pages. Those linked pages are
  reachable and were **NOT PROBED**. They are the practical substitute for the walled
  brand configurator and would show result-card anatomy, filter vocabulary and per-listing
  disclaimers.
- Vauxhall's own connected-car and owner-app tiers are named: `CONNECT ONE` and `CONNECT
  PLUS` for MyVauxhall 2.0, released 2025-04-28 and initially limited to New Grandland
  Electric (s37, reconnaissance). `Vauxhall Connect` is described on the dealer site as
  providing "real time traffic updates, journey planning, and scheduled charging" (s57).
  `Vauxhall PureSense` and `Vauxhall PureConnect` are named as feature packages (s53).
  These are the naming conventions a configurator would surface.
- The **Motability Scheme** appears on the dealer site (s57) and in no press release
  collected. Motability is a very large UK channel and would have its own listing and
  pricing conventions. **NOT PROBED.**

## The clean list of what a next run should do here

1. `https://www.media.stellantis.com/uk-en/vauxhall/media-library/gallery`, reachable,
   unprobed. Best source for approved photography.
2. Evans Halshaw Vauxhall stock and leasing pages, reachable, unprobed. Substitute for
   configurator and stock-listing UX plus retail disclaimer patterns.
3. A second dealer group for corroboration.
4. Binary capability to pull the two first-party PNG brand assets at s11.
