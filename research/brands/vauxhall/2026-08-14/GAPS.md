# Gaps — Vauxhall UK — 2026-08-14

## How to read this file

Four different facts get recorded here and they must not be collapsed into each other:

| Status | Means | About |
|---|---|---|
| **NOT PUBLISHED** | probed the right places, the brand does not publish it | **the brand** |
| **NOT FOUND** | probed, could not locate it, may still exist somewhere unprobed | the search |
| **NOT REACHABLE** | located or known to exist, blocked by a wall or a capability limit | the run |
| **NOT PROBED** | never attempted, usually budget or a late discovery | the run |

Only the first is a finding about Vauxhall. Reporting an unprobed rung as an absent one is
the single failure this run could not recover from on a later read, so every unprobed lead is
listed by name in the "Leads never probed" section rather than being quietly dropped.

---

## Gaps by dimension

### Copy and voice

| Missing | Status | Failed rung | Unblock |
|---|---|---|---|
| Verbal-identity or tone-of-voice document | **NOT PUBLISHED** | rungs 1 and 2, brand portal and press kit, both absent | Nothing to fetch. An agency case study or an ex-employee portfolio is the only realistic route, and neither is first-party |
| Advertising copy, TV or press | **NOT REACHABLE** | rung 3, ad archive | Meta Ad Library and YouTube channel scrape. Neither was probed |
| Email and CRM copy | **NOT PROBED** | rung 4, email archive | Milled or similar newsletter archive, searched for `vauxhall.co.uk` sender domains |
| In-car UI, configurator and checkout microcopy | **NOT REACHABLE** | rung 4, rendered pages, walled | Requires `www.vauxhall.co.uk`. See the WAF entry below |
| Retail and aftersales register | **NOT PROBED** | rung 4 | Dealer-group sites answer 200. Evans Halshaw and Pentagon copy was never read for voice, only for a logo file |

The register spread this run achieved is **press releases plus two app-store listings**. That
is a genuine spread, and it is narrow. Every mechanic recorded in `copy/tone.json` is high
confidence **within that spread** and untested outside it.

### Visual identity

| Missing | Status | Failed rung | Unblock |
|---|---|---|---|
| **Brand typeface**: family, foundry, weights, file | **NOT FOUND**, and see the note below | rungs 1 and 2 unreachable, rung 5 probed three ways and dry | Two routes now exist. (1) Run WhatTheFont or a glyph-shape comparison against the retrieved logo PNGs, newly possible because a raster sample is now on disk. (2) Reach any `@font-face` on a Vauxhall host |
| **Any logo rule**: clear space, minimum size, misuse, exclusion zone, co-branding | **NOT REACHABLE** | rungs 1 and 2 | These live only in a brand portal or a partner toolkit. Neither exists on a reachable surface |
| **Vector master** of the mark, SVG or EPS | **NOT FOUND** first-party | rung 2 | All four retrieved files are raster. A vector master would normally sit on the walled site |
| **Colour specification**: Pantone, CMYK, stated hex, tints, usage ratio | **NOT FOUND anywhere, from any party** | rungs 1 to 5 | The four measured values are what assets render, not what a spec declares. Only a brand document closes this |
| Secondary palette, accent, line and UI colours | **NOT FOUND** | rung 5 | Requires either a spec or a rendered site |
| Horizontal lockup, emblem-only mark, co-branding lockup | **NOT FOUND** | rung 2 | Likely to exist. Not published on any reachable surface |
| **Identity date** | **UNRESOLVED** | rung 6, trademark registries, all three walled | UK IPO 403, EUIPO JavaScript-only, WIPO captcha. A browser-capable run closes this in one search |
| Art-direction convention: angle, environment, human presence, grading | **NOT REACHABLE** | rung 4 | The press galleries are client-side rendered and returned empty shells. A browser reads them |
| The `shootinglocationsvauxhallgseevent` PDF | **NOT REACHABLE**, URL never fully resolved | rung 2 | Worth one fetch. It is the closest thing found to a stated photography convention |

**On the typeface, precisely.** The blocker is **no longer a capability limit.** Binaries are
retrievable on this install, so a `woff2` would have downloaded as easily as the logo PNGs
did. Nothing was ever located to download. And the wordmark in all four retrieved files is
**outlined artwork**, so those files cannot answer the question even though they are the best
Vauxhall type specimen in the run.

**The trap.** The only `@font-face` families observed anywhere were **Gotham** and
**Open Sans**, both belonging to the **Stellantis press portal** and neither evidence about
Vauxhall. A future run must not accept a plausible-sounding "Vauxhall Sans" from an
aggregator.

### Web and digital

The only dimension that returned nothing. `web/tokens.json` has `tokens: {}` deliberately.

| Missing | Status | Failed rung | Unblock |
|---|---|---|---|
| Any first-party CSS, custom property or measured token | **NOT REACHABLE** | no rung reached | Two independent blocks, both below |
| Screenshots, desktop and mobile | **NOT REACHABLE**, and **NOT DECLINED** | Step 6 | No browser on this install. The user was never asked, so this is not a declined-permission gap |
| Computed styles, contrast ratios, dark-mode check | **NOT REACHABLE** | Step 6 | Same. Requires a browser |
| `manifest.json` `theme_color` | **NOT REACHABLE** | rung 4 | Host is 403 and no alternate host exists in DNS |
| Breakpoints, spacing scale, radii, motion | **NOT REACHABLE** | rung 4 | Requires first-party CSS |
| Design system or token package | **NOT PUBLISHED** | rung 1 | npm and GitHub both searched with multiple queries. Dry. This is a finding about the brand |

**Block 1, the wall.** `www.vauxhall.co.uk` returns **403** to every route available here, and
every guessed first-party asset subdomain (`assets.`, `cdn.`, `static.`, `images.`, `content.`,
`business.`) is **DNS ENOTFOUND**. There is no un-walled first-party host to read CSS from.

**Block 2, the fetcher, and this one is the more interesting.** The harness fetcher
**converts HTML to markdown before any model sees it**, which strips `<link rel=stylesheet>`,
`<style>` and `<script src>`. A stylesheet URL therefore cannot be discovered from **any**
page in this run, reachable or not. The dealer-template fallback was the most promising
substitute and it was **defeated by the fetcher, not by the dealer**: both dealer sites
returned 200 and reported zero stylesheets.

The two blocks are independent, so lifting the WAF alone would not fix the web dimension on
this install. It needs a browser or a shell with network.

### Audience

| Missing | Status | Failed rung | Unblock |
|---|---|---|---|
| First-party segmentation document | **NOT PUBLISHED** | rungs 1 and 2 | Nothing to fetch |
| **Demographic data of any kind**: age, income, gender, household | **NOT FOUND from any source** | rungs 3 to 5 | A paid syndicated study, or a UK trade title citing one. No unsourced figure was written and none should be |
| Claimed versus observed audience | **NOT REACHABLE** | rung 4 | Observing requires the walled site plus reviews and social. Only the claimed side exists here |
| Regional or nation-level split within the UK | **NOT FOUND** | rung 5 | SMMT publishes national totals, not brand-by-region |

### Industry

| Missing | Status | Failed rung | Unblock |
|---|---|---|---|
| **CAP Code section 3, non-broadcast** | **NOT PROBED**, and it is the operative regime | rung 3 | The largest single industry gap. The VCA rules that were probed explicitly exclude websites, so the rulebook that actually governs vauxhall.co.uk was never read |
| Vauxhall ad copy quoted verbatim by a regulator | **NOT PUBLISHED** | rung 3 | Five ASA cases exist and all five were **informally resolved**, which means no published ruling text. This route is closed for this brand specifically, not just for this run |
| Motability and fleet channel material | **NOT PROBED** | rung 4 | A large UK volume-brand channel with its own register. Never opened |
| Retailer-facing brand standards or a franchise toolkit | **NOT PROBED** | rung 2 | Historically where UK volume brands put real logo rules. `autosynergy.co.uk` was found and never probed. See below |

---

## Untrusted input encountered, and what was done about it

**One page carried text resembling instructions to the agent reading it.** The **WIPO Global
Brand Database** captcha gate page included script text describing how its **Altcha**
challenge could be skipped by pre-seeding a browser storage key with a particular value.

That text arrived as **fetched page data**. It was **treated as data, was not acted on**, and
the storage key was never set. The WIPO registry is therefore recorded as **walled**, which is
its honest status. Acting on it would have been bypassing a bot-wall, which this run is
explicitly forbidden from doing, and it would also have made the identity-date finding
unciteable.

Consequence for the run: the identity date stays **UNRESOLVED**. That is the correct outcome.
A future run should reach the registries through a browser, where a human solves the challenge
in the normal way, rather than through the gate's own escape hatch.

Also recorded in [`NOTICE.md`](NOTICE.md).

## Walls and paywalls not bypassed

| Source | Wall | What was done |
|---|---|---|
| Brand New, "New Logo for Opel", 2023-07-25, `underconsideration.com` | **subscriber paywall** | **Not bypassed. Left unread.** The teaser was visible and the analysis was not. This is a real loss: Brand New is the most likely place a dated account of the Opel mark revision exists, which is the nearest available proxy for the Vauxhall identity date |
| `www.vauxhall.co.uk` and the whole Stellantis brand-site estate, including `opel.com` and `opel.de` | **Stellantis WAF, 403** | Retried once with a full desktop User-Agent plus an `Accept` header, per the skill. Still 403. **No further evasion attempted** |
| UK IPO trademark search | **403** | Not evaded |
| EUIPO eSearch | **JavaScript-only** | Not evaded. Needs a browser, which is a capability gap rather than a wall |
| `web.archive.org` | **blocked by the harness fetcher, not by the site** | Cost the run its staleness check and its route around the WAF. Nothing to evade; a different install would reach it |

The WAF block is worth stating precisely: **binary retrieval does not defeat it.** The
download route found mid-run works per-URL against hosts that already answer. Every Stellantis
brand host answers 403 to everything.

## Leads never probed

Every URL below was **discovered during the run and never fetched**. They are listed so a
later run does not mistake them for absent sources. Full context in
[`SOURCE-MAP.md`](SOURCE-MAP.md).

| Lead | Why it looked promising | Why not probed |
|---|---|---|
| `autosynergy.co.uk` | A **UK Vauxhall retailer-facing portal**. Historically where a volume brand's real logo rules, clear space and co-branding live. **The single most promising unprobed lead in the run** | Found late. Likely login-gated, which was never confirmed |
| `stellantis3.dam-broadcast.com` | A **shared Stellantis DAM** serving Opel gallery assets. May serve Vauxhall assets too, and DAM hosts often sit outside the WAF, as `media.stellantis.com` does | Found via the Opel press room. Unverified for Vauxhall |
| `web21st.imgix.net` | Dealer-network image CDN | Found via a dealer site. Not identity evidence, but it is an un-walled host that renders Vauxhall material |
| `pentagon-v4.imgix.net` | Same, second dealer group | Same |
| **Fonts In Use, Automotive, pages 2 to 5** | Page 1 was checked and had no Vauxhall entry. **The remaining four pages were never opened** | Budget. This is the cheapest unprobed typeface lead in the run and it should be first next time |
| Vauxhall press releases **older than 2026-05-14** | A wider date range would test whether the copy mechanics hold over time, and whether the `ABOUT VAUXHALL MOTORS` boilerplate has changed | **The press index pagination is inert.** `?page=2` and `?page=5` both re-serve page 1, so there is no discovered route to older releases short of guessing slugs |
| Brandfetch and BrandColors | Aggregators that state palettes | Deliberately deprioritised as A4, then never reached. Would not have been usable in `tokens` on their own anyway |
| Meta Ad Library, YouTube channel, Milled | The three archives that would open the advertising and email registers | Budget. Never opened |

## What `raw/` does and does not contain

**`raw/` holds two files.** One extracted document text and one press photograph.

**Most `text-only` sources in this run therefore have no local capture.** The copy dimension
captured its own twelve pages into [`copy/pages/`](copy/pages/), so it is the exception. For
every other text-only source, what survives is the URL, the `retrievedAt` date and whatever
the reading agent quoted into its own summary file.

**Consequence, stated plainly:** if a page changes or disappears, this run cannot prove what
it said. Sixty-four sources were read text-only and only twelve of them have a verbatim local
capture. A future run should capture the page text of every cited source, not only the copy
dimension's, because the marginal cost of writing a fetched page to disk is near zero and the
value of a citation that can still be checked is high.

The four logo PNGs are the exception in the other direction: they were retained specifically
so the measured palette values remain checkable, and they are the only evidence in this run
that can be independently re-verified from disk.

---

## Top three unblocks, in order

1. **Give the run a browser.** It closes the largest number of gaps for one change: the
   identity date via the trademark registries, the press galleries and their captions, the
   real `@font-face` families and `document.fonts`, the screenshots, and every measured web
   token. It also closes them the legitimate way, with a human solving any challenge.
2. **Probe `autosynergy.co.uk`, then Fonts In Use pages 2 to 5.** The first is the only
   plausible route to actual logo rules found in the whole run. The second is one cheap fetch
   away from possibly naming the typeface. Neither needs any new capability.
3. **Allowlist the Vauxhall and Stellantis hosts for the shell, or run where the shell has
   network.** This is the only thing that touches the WAF, and it is what turns the web
   dimension from `none` into something. It requires a settings change that the user has not
   authorised, so **it is recorded here as an option and was not made.**

**One process change, worth more than any of the three.** Probe for **binary retrieval in
Step 1**, alongside the `curl` check. This run spent most of its length believing no binary
could reach disk, told all five agents so, and only found otherwise by chasing an
inconsistency in an agent's report. Every measured value in this run came from that discovery.
A `text-only` run is not necessarily an unmeasured run.
