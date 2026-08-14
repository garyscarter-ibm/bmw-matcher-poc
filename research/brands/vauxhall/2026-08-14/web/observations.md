# Web and digital identity, Vauxhall, 2026-08-14

Regime **D**. Rung reached for web tokens: **none**. Recon's assessment that this dimension
is "effectively unworkable from here" is **CONFIRMED**, and this pass adds two structural
reasons recon had not identified. Nothing in this file is a measurement of vauxhall.co.uk,
because vauxhall.co.uk was never reached.

Twenty-three network calls were spent, above the 14 to 18 budget. The overage went entirely
on the one line of attack that produced anything (the Webpack asset-map route, and then one
corroborating SVG read), and is flagged here rather than hidden.

## 1. Host probe table

The single most useful artefact for a re-run. Every host and path attempted, with its exact
result. `ENOTFOUND` means DNS has no record, which is stronger evidence of absence than a
403. `403` means the host exists and refused us, which is not evidence of absence at all.

### First-party Vauxhall hosts

| Host or URL | Result | Reading |
|---|---|---|
| `https://www.vauxhall.co.uk/` | **HTTP 403** | Walled. Re-tested once, fresh, per brief. No escalation had unblocked it. Not retried. |
| `https://assets.vauxhall.co.uk/manifest.json` | **ENOTFOUND** | Host does not exist |
| `https://cdn.vauxhall.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://static.vauxhall.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://images.vauxhall.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://content.vauxhall.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://business.vauxhall.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://www.myvauxhall.co.uk/` | **ECONNREFUSED 217.70.184.50:443** | Parked. Not a live surface |
| `https://www.vauxhall.com/` | **ECONNREFUSED 217.70.184.50:443** | Parked, same single IP as above |
| `https://www.vauxhallfinance.co.uk/` | **ENOTFOUND** | Host does not exist |
| `https://www.vauxhallfleet.co.uk/` | **307 to `forsale.godaddy.com`** | Domain parked and for sale. Not Vauxhall's |

Six consecutive `ENOTFOUND` results on `*.vauxhall.co.uk` establish that the zone publishes
very few subdomains and has no wildcard. The step-2 hypothesis, that a WAF protects HTML but
leaves the static asset host open, **fails here for a reason other than the WAF**: there is no
separate asset host in DNS to protect. Vauxhall serves its own assets from the walled host.

### Sibling brand on the same Stellantis platform

| Host | Result | Reading |
|---|---|---|
| `https://www.opel.de/` | **HTTP 403** | Same WAF class as `www.opel.com` and `www.vauxhall.co.uk`. The block is estate-wide, not per-domain |

### Stellantis corporate and press hosts

| URL | Result |
|---|---|
| `https://www.media.stellantis.com/uk-en/vauxhall` | **200** |
| `https://www.media.stellantis.com/manifest.json` | **404**, no web manifest at root |
| `https://www.media.stellantis.com/build/entrypoints.json` | **200**, roughly 45 Webpack Encore entrypoints |
| `https://www.media.stellantis.com/build/manifest.json` | **200**, full hashed asset map |
| `https://www.media.stellantis.com/build/app.css` | **404**, unhashed guess fails |
| `https://www.media.stellantis.com/build/brand-homepage.1804b95a.css` | **200** |
| `https://www.media.stellantis.com/build/app.1cf248ac.css` | **200** |
| `https://www.media.stellantis.com/build/layout.b79f35b3.css` | **200** |

### Third-party dealer and franchise hosts

| URL | Result |
|---|---|
| `https://www.evanshalshaw.com/vauxhall/` | **200**, page reachable, no CSS visible (see section 3) |
| `https://www.pentagon-group.co.uk/vauxhall` | **200**, page reachable, no CSS visible |
| `https://www.evanshalshaw.com/-/media/evanshalshaw/logos/vauxhall/vauxhall-svg.svg` | **200**, SVG markup read in full |

## 2. Newly discovered hostnames

Recorded because an unblocked re-run should go straight at these. None was probed unless the
table above says so.

| Host | What it serves | Probed? |
|---|---|---|
| `stellantis3.dam-broadcast.com` | Stellantis DAM, third-party SaaS. Press photography at `/medias/domain12808/media110501/<id>-<slug>-whr.jpg`. `domain12808` appears to be the Vauxhall UK tenant | **NOT PROBED** |
| `www.autosynergy.co.uk` | Dealer web platform. Serves Vauxhall brand logo PNGs directly at `/assets/logos/vauxhall.png` and `/assets/logos/vauxhall-badge-only-no-bleed.png` | **NOT PROBED**. High value for the visual dimension |
| `web21st.imgix.net` | Dealer vehicle imagery via imgix, e.g. `vauxhall-corsa-2023-yes-front-kiss-red.png` | **NOT PROBED** |
| `pentagon-v4.imgix.net` | Dealer branch and footer imagery via imgix | **NOT PROBED** |
| `www.evanshalshaw.com/-/media/...` | Sitecore media library, holds a Vauxhall SVG lockup | Probed, see above |

Also worth recording: the reachable Vauxhall press room links out to
`https://www.vauxhall.co.uk/brochures.html`, confirming that path exists on the walled host.

## 3. The two blockers recon had not identified

Both are more fundamental than the WAF and both need stating plainly, because they change
what a re-run must arrange.

**A. WebFetch strips the head.** WebFetch converts HTML to markdown before any model sees it.
`<link rel="stylesheet">`, `<style>`, `<script src>` and `<meta>` do not survive. Proven three
times over: the Vauxhall press room, `evanshalshaw.com/vauxhall/` and
`pentagon-group.co.uk/vauxhall` all returned 200 and all reported zero stylesheets, zero
`@font-face` and zero custom properties, while obviously having all three. **Consequence: in
this run a stylesheet URL cannot be discovered from any HTML page, reachable or not.** The
dealer-template route of step 5 is therefore blocked by the fetcher, not by the dealers. It
remains a live and legitimate route for a re-run with a browser or a shell.

**B. There is no separate Vauxhall asset host to find.** See section 1. Step 2's premise does
not hold for this brand.

The one workaround found: **`.css` and `.json` URLs fetched directly do return their real
contents.** So where a build system publishes a public asset map, the whole stylesheet set can
be enumerated and read without a browser. `/build/entrypoints.json` and `/build/manifest.json`
are the Symfony Webpack Encore convention and both were public. The equivalents worth trying
on an unblocked Vauxhall host are `/etc.clientlibs/` (Adobe AEM), `/_next/static/`
(Next.js), `/build/manifest.json`, `/dist/manifest.json` and `/asset-manifest.json`.

## 4. What was evidenced, and on which surface

### Vauxhall's own site
Nothing. No custom property, no `@font-face`, no breakpoint, no component pattern, no colour.
Not one value in this run came from vauxhall.co.uk.

### Vauxhall logo lockup, third-party host
An SVG at Evans Halshaw's Sitecore media library, `viewBox="0 0 59 50"`, `59px` by `50px`. Two
fills declared in the file's own `<style>` block: `.cls-1{fill:#000037;}` on nine navy shapes
forming a seven-letter wordmark, and `.cls-2{fill:#d7001c;}` on one compound path forming a
circular ring enclosing a winged creature form, consistent with the griffin. All glyphs are
outlined paths, so **this file carries no font-family and cannot identify the typeface**.
Inkscape metadata is present (`sodipodi:docname="vauxhall-svg-50x50px.svg"`), so it is an
edited derivative, not a pristine master.

### Stellantis press portal, wrong surface, recorded for completeness only
Kept deliberately separate. This is **not** Vauxhall's design system.

- Platform: Symfony with Webpack Encore, roughly 45 entrypoints.
- **No CSS custom properties exist anywhere observed**, beyond animate.css's own
  `--animate-duration`, `--animate-delay`, `--animate-repeat`. There is no `:root` theme block.
- `html body` sets `color:#1a1a1a` and `font-family:OpenSans-Semibold`, with no base
  `font-size` or `line-height` declared at all.
- `@font-face` families: GothamMedium, GothamBold, GothamProReg, OpenSans, OpenSans-Semibold,
  OpenSans-Bold, plus Font Awesome 5. Sources are `/build/fonts/*.eot` first with woff2, ttf
  and svg fallbacks, which marks it as a long-lived legacy bundle.
- Every class carries an **`.fca-` prefix** (`.fca-Container_Banner`, `.fca-Btn_Primary`,
  `.fca-Slider`), so the portal is inherited FCA press-portal code that predates Stellantis.
- **Zero selectors containing "vauxhall" or "opel"** across the `brand-homepage`, `app` and
  `layout` bundles. The Vauxhall press room is branded by swapped logo images alone, with no
  CSS theming whatever. This is the decisive proof that the portal cannot proxy for Vauxhall's
  tokens: there is no Vauxhall-specific styling in it to borrow.

## 5. Contested values

**`#d7001c` and `#000037` now have two third-party sources that agree exactly. Not resolved.**

| | Source A | Source B |
|---|---|---|
| Where | Wikipedia file `Vauxhall_logo_2019.svg` (s29/s30), sourced from Logopedia, a Fandom fan wiki | Evans Halshaw Sitecore media library, a large UK Vauxhall franchise group |
| Values | `#d7001c` emblem, `#000037` wordmark | `#d7001c` emblem, `#000037` wordmark |
| Geometry | 344 by 291, 3,146 bytes | viewBox 0 0 59 50, Inkscape-edited |
| Party | third | third |

The two are **different files**, so this is not the same artefact seen twice. But the exact
hex agreement admits two readings and this run cannot choose between them:

1. **Independent corroboration.** A franchised retailer's asset library is supplied through
   Vauxhall's dealer marketing channel, so its lockup plausibly descends from the real master.
   That would make these the genuine brand hexes.
2. **Common ancestry.** Wikipedia's own file history records a 2020-09-23 revision citing "an
   official SVG from a Vauxhall dealer site". If Logopedia's copy was itself lifted from a
   dealer site, both sources may descend from one dealer-supplied file, and agreement proves
   only shared lineage, not accuracy.

Reading 2 is specifically supported by Wikipedia's own provenance note, so the agreement must
**not** be treated as two independent sources meeting the stopping rule. Both stay at
`confidence: medium`, `party: third`, and neither should populate `research.json` `tokens`
until a first-party source corroborates. What would settle it: any file from
`www.vauxhall.co.uk`, or a trademark filing, or the unprobed `www.autosynergy.co.uk`
logo assets as a genuinely third independent lineage.

No other contested value arose, because no other value was obtained.

**Unrelated to colour: nothing found this pass speaks to the 2008 versus 2019 identity-date
question.** The dealer SVG is undated and its Inkscape metadata carries no timestamp that
survived the fetch.

## 6. Deliverables that are undeliverable, and why

| Normal deliverable | Status | Reason |
|---|---|---|
| Screenshots, desktop and mobile | **Undeliverable** | No browser. `preview_start` cannot attach to an external URL on this install |
| Measured colour, computed styles | **Undeliverable** | No browser, and no first-party CSS reachable as text either |
| Measured typography, `document.fonts` | **Undeliverable** | Same. No Vauxhall `@font-face` was seen from any host |
| Geometry: radii, spacing scale, border widths | **Undeliverable** | Requires first-party CSS |
| Motion: easing, duration, character | **Undeliverable** | Requires first-party CSS or JS |
| Contrast ratios | **Undeliverable** | Requires measured foreground and background pairs |
| Dark-mode check | **Undeliverable** | Requires `prefers-color-scheme` rendering |
| `manifest.json` `theme_color` and `background_color` | **Undeliverable** | Walled host 403s, and no alternate host exists in DNS |
| Media-query breakpoints | **Undeliverable** | Requires first-party CSS |
| Component patterns: nav, hero, card, form | **Undeliverable for Vauxhall** | Only the press portal's `.fca-` components were readable, and they are not Vauxhall's |
| Accessibility notes | **Undeliverable** | Requires a rendered DOM |

Every one of these is blocked by capability, not by absence. **None of them is evidence that
Vauxhall does not publish these values.** The honest finding is that the site was unreachable.

## 7. What would unblock this dimension

In priority order.

1. **Allowlist `www.vauxhall.co.uk` for the shell**, then `curl` the homepage and grep the
   head for stylesheet URLs. This single change restores essentially the whole dimension.
2. **A browser that can attach to an external URL**, which additionally restores screenshots,
   computed styles, `document.fonts`, contrast and dark mode. Needed for the measured tokens
   that no text fetch can produce.
3. **Unblock `web.archive.org` at the fetcher.** Wayback proxies the walled site, and archived
   snapshots include the stylesheets, so this would recover CSS without touching the WAF. It
   would also date the identity, which is the run's other open question.
4. Failing all three, the **dealer-template route (step 5) is still live and untested on its
   merits**: it was defeated by the markdown conversion, not by the dealers. With a shell or
   browser, read the head of a Vauxhall franchise site and follow its brand CSS. Cap at
   `medium` and note that a dealer template can drift from the national spec.
5. Probe `www.autosynergy.co.uk` and `stellantis3.dam-broadcast.com`, both reachable-looking
   and both unprobed.

## 8. Notes on the fetched material

Nothing prompt-injection-like was encountered. All fetched text behaved as data.

Two honesty notes about provenance of this file's own contents:

- **`raw/web/` holds no untouched bodies.** WebFetch returns a model's reading of a document,
  not the document, so nothing in this run can satisfy the schema's "untouched fetched bodies".
  Values quoted above are as reported by that intermediary.
- **Two fetches were answered with an explicit refusal to reproduce content verbatim**, citing
  an internal quoting limit (the `/build/entrypoints.json` and `/build/manifest.json` calls).
  The CSS paths in `web/css/press-portal-asset-map.txt` are therefore transcribed from a
  paraphrase and each individual hash should be re-verified before being relied on. The three
  hashed URLs that were actually fetched and returned 200 are proven correct.
