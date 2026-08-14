# Source map — Vauxhall — reconnaissance, 2026-08-14

`WEBSEARCH: unavailable` — the call errored before executing: `API Error: 400
{"message":"tool type 'web_search_20250305' is not supported for this model"}`. Every
source below was found by deterministic host-guessing and by following links inside
reachable first-party pages (mainly the Stellantis corporate site and Wikipedia/Wikidata),
not by search. Absence of a source type in this map is therefore weaker evidence than
usual — say "not probed," not "doesn't exist."

## Identity date — the load-bearing open question

**Not established with confidence.** The brief's own framing (Wikipedia's infobox file is
named `Vauxhall logo 2019.svg`) turns out to be the weakest link in the chain, not the
strongest:

- The file's **source field says "Logo obtained from Logopedia"** — a Fandom fan wiki,
  third-party — not Vauxhall, not vauxhall.co.uk, not even the dealer site it later cites.
  No author is credited (s29).
- Its **upload history starts 2020-06-15**, not 2019, with a "now including the updated
  wordmark" revision on 2020-07-10 citing "an official SVG from a Vauxhall dealer site" —
  still not first-party. Nothing on the file page explains where "2019" comes from.
- Wikipedia's own **dedicated "Logo" section** (s39) gives a clean, cited, dated
  narrative of the griffin's revisions and stops at **2008** (a redesign of a 2005 mark,
  quoting GM UK's then-chairman, citing a dead Vauxhall Motors press release dated
  2009-09-10). It says nothing about 2019.
- Wikidata (s32) carries no logo-image claim for the entity at all beyond an old neon-sign
  photograph, and no inception/identity-revision date newer than 1857 (founding).
- The only genuinely dated **2019** event found anywhere is Vauxhall's headquarters move
  from Griffin House to Chalton House (2019-05-07, per Wikidata P159 qualifiers) — an
  address change, unrelated to the mark.
- UK trademark search (the one source that could settle this with a filing date) is
  **walled** (s36, HTTP 403). EUIPO and WIPO were **not probed** — budget ran out first.
  > **SUPERSEDED at Step 4 by the run owner.** Both were subsequently probed and both are
  > **walled**, not unprobed: **EUIPO** eSearch is JavaScript-only and returns no results to
  > a text fetch; **WIPO** Global Brand Database sits behind an Altcha captcha. All three
  > registries are therefore walled, and the identity date stays UNRESOLVED. See
  > "Step 4 adjudication" below and [`GAPS.md`](GAPS.md).

**Working position for the next agents: treat 2008 as the last *evidenced* dated
redesign, and treat "2019" as an unverified filename artefact until a trademark filing or
a first-party dated source corroborates it.** For comparison, Opel's own Wikipedia article
carries a clean dated sequence (2009–2017, 2017–2020, 2020–2023, since 2023, s28) —
Vauxhall's article conspicuously lacks the equivalent, which is itself worth noting as a
gap rather than assuming Vauxhall tracked Opel's cadence.

## Identity disambiguation

"Vauxhall" collides with a London district and its rail/Underground station. Confirmed
concretely: a Commons file search for "Vauxhall logo" surfaced `Vauxhall Cross
roundel.svg` (s31), the transport interchange roundel, not the car brand. Filter on
automotive context in every search; the brief's warning was justified.

## Reachability (read this before spending a fetch)

**Walled (WAF/bot-block, confirmed, do not re-probe):**
`www.vauxhall.co.uk` (root, `/robots.txt`, `/sitemap.xml`), `www.opel.com`,
`trademarks.ipo.gov.uk` (UK IPO trademark search — 403, same class of block), `logos.fandom.com`
(402 Payment Required, not a WAF but equally blocking — this is the very site the
Wikipedia logo file cites as its source, so its claims can't be checked).

**Dead ends (resolved but confirmed non-existent/refusing, do not re-probe):**
`media.vauxhall.co.uk` (ECONNREFUSED on 443), `uk-media.stellantis.com`,
`media.stellantis.co.uk`, `stellantis-media.co.uk` (all ENOTFOUND), `api.github.com/orgs/opel`
(404, no such org), a guessed `vauxhall.co.uk/brand-guidelines` and
`vauxhall.co.uk/about-us/brand.html` (Wayback has never captured either path).

**Reachable and load-bearing:**
`www.stellantis.com` (all paths tried worked — brand page, investors, careers),
`media.stellantis.com` / `www.media.stellantis.com` (international press portal, and
critically its `/uk-en/vauxhall` sub-path — the Vauxhall-specific press room, fully live,
outside the WAF), `registry.npmjs.org` search API, `api.github.com` (search and org
endpoints), `en.wikipedia.org` (article text and the `action=parse` API for exact
sections), `wikidata.org` (`Special:EntityData` JSON), `commons.wikimedia.org` search API,
`fontsinuse.com` (reachable, but dry on basic search), `underconsideration.com` (reachable,
but its `?s=` search doesn't function — inconclusive, not dry), `itunes.apple.com/search`
(JSON, works well for app listings), `archive.org/wayback/available` (JSON, dates things,
cannot read them).

**Not probed at all (say so, don't imply absence):** EUIPO eSearch, WIPO Global Brand
Database, Google Play Store, Meta Ad Library, Google Ads Transparency Center, YouTube/social
channels, `careers.stellantis.com` (linked but not opened), the Stellantis annual report
PDF itself (only the investor hub page was opened), `api.github.com/orgs/Stellantis/repos`
(the org's 9 repos were counted but not listed), Fonts In Use's advanced search / Automotive
topic browse (only the basic search box was tried).

> **PARTLY SUPERSEDED at Step 4 and after, by the run owner.** Four items on that list were
> subsequently probed, and the outcomes differ from "unprobed":
> - **EUIPO eSearch** and **WIPO Global Brand Database**: probed, both **walled** (JavaScript-only,
>   and an Altcha captcha, respectively).
> - **The Stellantis annual report PDF**: probed and **read**. It became `s68` and is the
>   audience dimension's primary source. Five pages of extracted text are retained at
>   [`raw/audience/stellantis-2025-annual-report-extract.txt`](raw/audience/stellantis-2025-annual-report-extract.txt).
> - **Fonts In Use, Automotive topic browse**: page 1 probed, **no Vauxhall entry**. Pages 2 to 5
>   remain genuinely unprobed and are listed under "Leads never probed" below.
>
> The rest of the list stands as unprobed. Current status for every item is in
> [`GAPS.md`](GAPS.md), which is the file to trust over this one where they differ.

## Per-dimension regime, ranked sources, start rung

### Copy / voice — regime C/D
No published verbal identity guide; no reachable register-spread of the marketing site
(walled) for rung 2. Ranked sources: (1) `media.stellantis.com/uk-en/vauxhall` press
releases, dated, real, first-party (s11); (2) Stellantis brand-page tagline/descriptor
(s19); (3) App Store listing copy for MyVauxhall (s37); (4) Wikipedia sponsorship/press
citations (s40) for register clues. **Start rung: 3** (press release boilerplate / ad-adjacent
copy) — rungs 1–2 of the voice ladder are structurally unavailable this run.

### Visual — regime D, contested
No design system, no token package (npm/GitHub both dry), no reachable press-kit logo
download, no reachable trademark filing. The only "current" logo artefact is a fan-wiki
sourced, undated, non-first-party SVG re-upload on Wikipedia (s29/s30) with two candidate
hex values (#d7001c, #000037) that must be labelled candidates, not tokens, until a
first-party source corroborates them. **Start rung: 5** (Wikimedia, and it fails its own
provenance check) — rung 4 (trademark filing) is the one unblock that would help most and
is currently walled/unprobed (UK IPO walled; EUIPO/WIPO unprobed).

> **SUPERSEDED.** All three registries are **walled**, none unprobed. And this start rung was
> overtaken entirely: colour and logo artwork landed **off-ladder**, on direct measurement of
> four first-party PNGs, which **disproved** both candidate hexes rather than corroborating
> them. The measured values are `#eb0000` and `#00003a`.

### Web/digital — regime D, effectively unworkable from here
`vauxhall.co.uk` itself carries every CSS custom property, manifest.json and rendered
value this dimension wants, and it is completely walled — no shell, no browser, no
Wayback proxy. The press portal (`media.stellantis.com`) is a different codebase and not
representative of the consumer site. **Start rung: none reachable** — flag to the web
agent that it should attempt the walled hosts itself (an escalation may have unblocked
something), and if still blocked, report the shortfall rather than substitute the press
portal's incidental styling as if it were the brand site's tokens.

### Audience — regime C/D
No segmentation, no media kit, no Vauxhall-specific investor figures. Ranked signal: (1)
live UK market-share figure in a 2026 press release ("4.8%" H1 2026, s11); (2) the
"electric equality for all" / "British automotive brand" positioning (s19), which reads
mass-market/access rather than premium; (3) sponsorship pattern — national football teams
since 2011, grassroots/Football Conference 1986–98, current athletics and rally
sponsorship (s11, s40) — consistent mass-participation, not elite/luxury, sponsorship
choices. **Start rung: 3.**

### Industry-specific (automotive) — regime C
Best-served dimension this run. Wikipedia's Sponsorships section (s40) and the live press
room (s11) together give a dated sponsorship and motorsport history spanning 1986 to
2026 (Football Conference → national teams → GSE Rally Cup). App listing (s37) adds the
owner-app angle (MyVauxhall, connected-car tier "CONNECT ONE/PLUS"). **Start rung: 2–3.**

## Top three sources overall

1. `https://www.media.stellantis.com/uk-en/vauxhall` (s11) — the single best find: a live,
   dated, first-party Vauxhall press room sitting entirely outside the WAF that blocks
   vauxhall.co.uk.
2. `https://www.stellantis.com/en/brands/vauxhall` (s19) — the only positioning statement
   ("Energising a Better Britain") found anywhere in this run.
3. `https://en.wikipedia.org/wiki/Vauxhall_Motors` (s27), specifically its Logo (s39) and
   Sponsorships (s40) sections — the richest dated structured history available, and the
   source that surfaced the 2019-filename discrepancy in the first place.

## Conspicuously absent

No design system. No token package on npm or GitHub (both searched with multiple targeted
queries, both dry). No downloadable brand-guideline PDF at any guessed path, ever, per
Wayback. No reachable trademark filing (the one source that would date the current mark
definitively). No first-party "About Vauxhall" boilerplate paragraph found anywhere,
including on the press-room landing page where it would normally sit. No official SVG
logo hosted first-party or even reliably third-party — the one candidate fails its own
provenance check.

---

# Step 4 adjudication — the strategy actually issued, and how it held up

Recorded 2026-08-14 by the run owner. Recon's map is above; this is what was done with it,
so the decision is auditable on a later read.

## The four Step 4 checks

1. **Identity sanity-check: PASSED.** Every source describes Vauxhall Motors Limited, the UK
   volume car and van marque owned by Stellantis N.V. The known same-name traps (Vauxhall the
   London district, Vauxhall railway station, the Vauxhall Bridge roundel) appeared only in
   Wikimedia Commons image results and were excluded there. No cross-industry contamination.
2. **Challenged the one suspiciously good source.** Recon's `Vauxhall_logo_2019.svg` looked
   like the run's best visual artefact. Dating it broke it: its own file page credits
   "Logopedia", a Fandom fan wiki, with no author, uploaded 2020-06-15 while named 2019.
   Demoted to A4 with provenance FAILED before any dimension agent could lean on it. That
   call was later vindicated: measurement **disproved** both of its hex values.
3. **Challenged the empty results.** Regime D on visual and web was accepted only after
   confirming the probes had run. npm and GitHub were both searched with multiple queries;
   guessed guideline paths were checked against Wayback; the WAF was re-tested with a full
   desktop UA. Two claimed-absent rungs were then **re-opened** and found merely unprobed:
   Fonts In Use's Automotive topic browse, and the trademark registries. Both were probed in
   the fan-out and both came back dry-or-walled rather than absent.
4. **Set each dimension's strategy.** Issued per dimension, below.

## Strategy issued per dimension, and the outcome

| Dimension | Regime issued | Start rung issued | Where it actually landed |
|---|---|---|---|
| copy | C/D | rung 2, first-party press releases | **rung 4.** Eleven artefacts across a register spread. The strongest dimension of the run |
| visual | D, contested | rung 4, trademark filing, to date the identity | rung 4 **walled** at all three registries. Landed **off-ladder on first-party asset measurement**, which no one had predicted |
| web | D | rung 3, live CSS and manifests | **nothing.** The only dimension that returned no tokens at all, for two independent structural reasons |
| audience | C/D | rung 2, corporate filings, not the marketing site | **rung 2.** The 519-page annual report was the single richest artefact in the run |
| industry | C | rung 2, regulators and the trade body | **rung 2**, across ASA, BCAP, FCA, VCA and SMMT |

**No token package and no design system exist**, so the prominent Step 4 instruction to
redirect the visual and web agents to read rather than measure did not apply. Both were told
the opposite: measure what you can reach, and record what you cannot as unreachable.

## The one strategic call that was wrong

Every agent was told, correctly for the time, that **no binary could be downloaded**. That
was the run's central capability claim and it was **false**. It was disproved late, by
following up an offhand remark in the audience agent's return about extracting text from a
PDF, which could not have happened if binaries were unreachable. Chasing that inconsistency
rather than accepting it produced the run's only measured values.

The lesson for a future run is a sequencing one: **probe for binary retrieval in Step 1**,
alongside the `curl` capability check, rather than inferring it from the shell's network
state. A `text-only` run is not necessarily an unmeasured run.

---

# Sources added after recon

Recon wrote `s1` to `s40`. The five dimension agents plus the run owner added `s41` to `s90`,
merged into one namespace and deduplicated by URL by the run owner. Per the skill, agents
reported new sources in their returns rather than editing the manifest, which is what kept
five parallel writers from clobbering it.

| Range | Added by | Contents |
|---|---|---|
| `s41`-`s54` | copy and industry | the eleven first-party press releases and packs, plus the press index |
| `s55`-`s63` | industry | ASA, BCAP, FCA, VCA and SMMT |
| `s64`-`s66` | industry | Wikipedia API section reads |
| `s67`-`s70` | audience | Stellantis financial reporting, the annual report, the iTunes API, careers |
| `s71`-`s75` | web | two dealer sites, the Evans Halshaw SVG, two press-portal build manifests |
| `s76`-`s84` | visual | EUIPO, WIPO, Fonts In Use, three Brand New URLs, Opel design category, RSS, schemecolor |
| `s85`-`s90` | run owner | the four logo PNGs, the press JPEG, the press gallery shell |

**Two collisions were resolved rather than guessed.** Copy and industry independently
proposed `s41`-`s51` and `s41`-`s57` for **different** URLs. Asking the copy agent for its
exact mapping surfaced a second error worth recording: its **count** was wrong, not its
reading. It had read **ten** releases, not nine, and the Mokka GSE pack of 2026-07-13 was
read but never captured to a `copy/pages/` file. Its material reached `phrase-bank.md` and
`tone.json` without a page file behind it. That release is now `s51` and it turned out to be
load-bearing across three dimensions.

## Leads never probed

These are leads, not sources, so they are recorded here rather than in `sources.json`.
`not-probed` is not a retrieval status: a source that was never fetched has no retrieval
outcome to record, and writing one would be the exact error this skill warns about.

| Lead | Why it might matter | Why not probed |
|---|---|---|
| `autosynergy.co.uk` | surfaced as a possible Vauxhall dealer-marketing toolkit host, which is where a brand guideline leaks in this industry | budget |
| `stellantis3.dam-broadcast.com` | a third Stellantis DAM host, distinct from the two used | budget |
| `web21st.imgix.net`, `pentagon-v4.imgix.net` | dealer-group image CDNs; an imgix host often exposes source-image paths | budget |
| Fonts In Use Automotive pages 2-5, and `/search/advanced` | the typeface is the run's biggest single gap | budget. Page 1 of 5 contained no Stellantis-group marque at all |
| Press index older than 2026-05-14 | an identity announcement would be older than the visible window | **pagination is inert.** `?page=2` and `?page=5` both re-serve page 1, and no search endpoint was found |
| Brandfetch, BrandColors | aggregator colour | A4 and now pointless: first-party colour is measured |
