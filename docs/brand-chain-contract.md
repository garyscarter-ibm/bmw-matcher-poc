# The brand chain contract

Status: **contract agreed, skills not yet built.** This is the interface. Four skills read and
write the artefacts described here; none of them may invent one.

Onboarding a brand used to be one skill walking all five blueprint layers in a single pass. That
worked, and it left two things undone.

**No shipped token traces back to evidence.** BMW's tokens came from
[`design-tokens.md`](design-tokens.md) line 3, "computed styles, live-inspected" on
`grassicksbmw.co.uk`. Ford's FordF1 woff2 came from Ford's CDN via TrustFord
([`DECISIONS.md`](../DECISIONS.md) `[fonts-ford]`). Honda's real face was found only by
downloading the woff files and reading their internal `usWeightClass`, after a placeholder
"Honda Sans" nearly shipped (`[fonts-honda-proxima-caveat]`). Every one of those is good work.
None of it is recorded per token, so nothing in the CSS can be re-checked, re-dated, or
distinguished from a guess.

**Voice authoring sat next to data engineering,** which is how the project's worst observed bug
happened. Every brand spread `...BRAND_COPY.bmw` and changed only the noun, so only MINI read
distinctly. The blueprint records the fix as "rewrite the voice, don't swap the noun", but the
structure that caused it stayed in place.

The chain exists to close both. Its promise: **if an identity pack exists, every value in it is
evidenced, and every value names its evidence.**

---

## 1. The four skills

| Skill | Where | Owns |
|---|---|---|
| `brand-research` | `~/.claude/skills/` (global) | **Measurement.** Every piece of evidence, including computed styles, stylesheets and font binaries |
| `generate-brand-id` | `.claude/skills/` (project) | **Judgement.** The token set, the four signature calls, voice, authored copy strings, personas |
| `implement-brand` | `.claude/skills/` (project) | **Wiring.** Feed, mapping, tuning, installing the pack, demo registration |
| `onboard-brand` | `.claude/skills/` (project) | **Orchestration.** Sequencing, state handoff, gate enforcement |

`brand-research` stays global and keeps its name: it is brand-agnostic and project-agnostic, and
a rename is churn. The other three are specific to this block's architecture (a named token set,
two `BRAND_COPY` maps, the engine's scored axes) and belong to the project.

### Three boundaries, stated because they are easy to draw wrong

**Measurement belongs entirely to research.** Tokens are not derived from research, they *are*
research output. A live-inspected computed style and a downloaded font file are measurements. If
`generate-brand-id` measures anything, it will invent when measurement fails, which is exactly
how a plausible "Vauxhall Sans" or "Honda Sans" reaches production. `generate-brand-id` reads
`research.json` and never fetches.

**The authored `BRAND_COPY` strings belong to `generate-brand-id`,** next to the tone guide, not
to the wiring skill. Writing twelve ledes is voice work. Pasting them into two maps is wiring.
Splitting the guide from the strings across two skills reproduces the noun-swap bug by
construction, because whoever writes the strings is then in wiring mode.

**No skill in this chain edits the engine.** A brand is data and dressing, never logic. There are
four sanctioned seams for brand variation and every brand to date has fitted through them:

- `mergeTuning` in [`server/brands.js`](../server/brands.js)
- `questions { drop, add }` with `scoresAs`, folding into standard answer keys
- `BRAND_MAPPERS` plus `MODEL_SPECS_<BRAND>` in [`server/mapping.js`](../server/mapping.js)
- `BRAND_CELEBRATION` in
  [`blocks/vehicle-matcher/modes/match-signal.js`](../blocks/vehicle-matcher/modes/match-signal.js)

A change to `server/engine.js` or a mode's `.js` to fit one brand means the brand-agnostic seam
has sprung a leak. It risks regressing six shipped brands, so it escalates out of the chain as
its own task with its own review. `implement-brand` may report that a brand needs one. It may not
make one.

---

## 2. The handoff artefact

`generate-brand-id` writes a pack at **`docs/brands/<brand>/`**.

| File | Contents | Consumed by |
|---|---|---|
| `identity.json` | The machine-readable identity. Every value carries its evidence | `implement-brand`, and any later audit |
| `tokens.css` | The ready-to-paste `.vm.vm-<brand>` block, with its `@font-face` declarations | `implement-brand` |
| `voice.md` | Tone guide, shaped like the per-brand sections of [`tone-style-guide.md`](tone-style-guide.md) | humans |
| `copy.json` | Authored strings, keyed by which `BRAND_COPY` map each installs into | `implement-brand` |
| `personas.md`, `personas.json` | Shaped like [`personas.md`](personas.md) and [`fixtures/personas.json`](../fixtures/personas.json) | `scripts/persona-check.mjs` |
| `GATE.md` | The verdict. Always written, pass or block | humans |

### `identity.json`

The load-bearing field is **`sourceId` on every value**, resolving into that research run's
`sources.json`. That is the whole point of the chain: token, source URL, retrieval date.

Illustrative only. The token values below are MINI's real shipped ones, read from
`.vm.vm-mini`, but **no MINI research run exists yet**, so the `researchRun` path and the
`sourceId`s are placeholders showing the shape. Reverse-engineering a real MINI `identity.json`
from the shipped CSS plus [`design-tokens.md`](design-tokens.md) is the first test of this
contract: if a brand that already works cannot round-trip through it, the contract is wrong.

```json
{
  "brand": "mini",
  "researchRun": "research/brands/mini/<date>",
  "regimes": { "copy": "B", "visual": "B", "web": "A", "audience": "C", "industry": "C" },
  "verdict": "pass",
  "tokens": {
    "--vm-accent": {
      "value": "#111111",
      "origin": "measured",
      "confidence": "high",
      "sourceId": "s12",
      "note": "Near-black. MINI reserves the green for --vm-accent-spot."
    }
  },
  "signatureCalls": {
    "primaryButtonFill": { "value": "near-black", "sourceId": "s12" },
    "headingWeightAndCasing": { "value": "heavy, uppercase", "sourceId": "s14" },
    "buttonLabelCasing": { "value": "uppercase via text-transform", "sourceId": "s14" },
    "switcherTabsAtRest": { "value": "near-black active fill", "sourceId": "s12" }
  },
  "typeface": {
    "families": [
      { "name": "MINI Serif", "role": "heading", "ownership": "brand-owned",
        "files": [{ "weight": 400, "usWeightClass": 500, "file": "mini_serif-regular-web.woff" }],
        "sourceId": "s17" }
    ]
  }
}
```

`origin` is one of **`measured`** (the run observed it), **`read`** (an authoritative brand
document stated it), or **`owner-decision`** (see section 3). There is no fourth value. In
particular there is no `inferred` and no `provisional`: a value that is none of the three does not
go in the file, and its absence blocks the pack.

`usWeightClass` is recorded separately from `weight` because they differ and the difference has
bitten before: MINI's "regular" is a 500 Medium and its "bold" a 900 Black, so each `@font-face`
must be declared at the weight the CSS requests, not the weight the file was designed at.

### The token set

The floor is the sixteen the blueprint names. `.vm.vm-mini` in
[`vehicle-matcher.css`](../blocks/vehicle-matcher/vehicle-matcher.css) is the worked example and
declares twenty, adding `--vm-surface-dark` and three button-geometry tokens. Extras are fine and
carry the same evidence requirement.

```
colour    --vm-ink  --vm-ink-strong  --vm-ink-muted  --vm-accent  --vm-accent-ink
          --vm-accent-spot  --vm-accent-secondary  --vm-accent-soft  --vm-line
font      --vm-font-heading  --vm-font-body  --vm-font-bold
geometry  --vm-radius  --vm-radius-control
motion    --vm-ease  --vm-pop
```

MINI is the useful example precisely because it diverges most from the BMW base: `--vm-accent` is
near-black `#111111` and the marque green lives in `--vm-accent-spot`. A brand whose accent is
simply its logo colour is the easy case, not the normal one.

### `copy.json`

Two maps, and they are not interchangeable:

- **`server`** installs into `BRAND_COPY` in [`server/questions.js`](../server/questions.js).
  Question and option **text only**, never ids or `value`s, because the engine reads those.
- **`client`** installs into `BRAND_COPY` in
  [`blocks/vehicle-matcher/modes/questions.js`](../blocks/vehicle-matcher/modes/questions.js).
  Intro and results display copy.

The client map resolves **all-or-nothing** (`BRAND_COPY[brand] || BRAND_COPY.bmw`), so a missing
key silently serves BMW's words. `copy.json` must therefore carry a complete client entry, and
`generate-brand-id` must author rather than inherit: `lede`, `title`, `cta`, `tasteLede`,
`tiedLede`, the `working*` strings and the reject and refine lines. No em dashes in any of them.

### `personas.json`

Entries are `{ key, name, tagline, brand, retailer, answers }`, and `answers` must use the
engine's real answer keys (`budget`, `bodyStyles`, `fuel`, `charging`, `primaryUse`, `people`,
`mileage`, `style`, `priorities`) so
[`scripts/persona-check.mjs`](../scripts/persona-check.mjs) can replay them.

Note that `name` embeds an age ("Daniel Okafor, 47"). That is a demographic claim. If the research
run has no demographic evidence, the name carries no age. Emitting fewer personas, or personas
without ages, is correct. Filling the template is not: `personas.json` is replayed against the
tuning, so a persona-check passing against invented personas asserts nothing while looking like
coverage.

---

## 3. The gate

`generate-brand-id` runs the gate before writing anything.

**The verdict is all-or-nothing.** Any layer below threshold blocks the whole identity, and the
skill writes `GATE.md` and nothing else. No partial pack, no provisional tokens, no directory of
half-populated files. The reason is the promise in the header: a reviewer must be able to trust a
pack's existence, without reading it for flags. A "provisional" state is a flag nobody reads.

**Diagnosis is per-layer,** so `GATE.md` is a short punch list rather than a verdict.

| Layer | Threshold |
|---|---|
| Theme | Every token in the set has a `value` with an `origin` and a `sourceId`. Typeface named **and** files sourced, with ownership recorded as brand-owned or licensed retail face |
| Copy | A register spread wide enough to author distinct ledes. One page is not a spread |
| Personas | At least evidenced segments. Demographics optional, never invented |

Feed, mapping and tuning are not gated here. They are `implement-brand`'s concern and have their
own reachability outcomes.

### What the gate reads, and the one field research does not yet emit

The gate is mechanical wherever it can be. Dry-run against the Vauxhall run, it reads:

- `tokens.type.families` is a non-empty list. Vauxhall's is `[]`, which is the block.
- Every entry in `tokens.color` and `tokens.color.palette` carries a `sourceId`. Vauxhall's five
  palette entries all do, so colour fails on **coverage** (four of sixteen tokens) rather than on
  provenance.
- `tokens.color.omitted` exists and names what was deliberately left out. Vauxhall declares one,
  which is the run behaving correctly: an omitted token is recoverable, a wrong one is not.
- Per dimension, `regime` and `rung`.

**One field is missing and the chain needs it.** `research.json` dimensions carry `regime`,
`rung`, `summary`, `files`, `sourceIds` and `gaps`, but **no per-dimension `confidence`**.
Confidence exists only as a top-level value and, for the visual dimension, inside
`subDimensions`. Everywhere else it lives in prose, in `summary` and in `FINDINGS.md`.

So `brand-research` gains one required output: a **`confidence`** field on every dimension, one of
`high` / `medium` / `low` / `none`, matching what `FINDINGS.md` already states in words. Until
then the gate falls back to `regime` and `rung`, which are weaker (Vauxhall's copy dimension is
regime `C/D` at rung 4 and high confidence, so regime alone would understate it).

### The one route past a block

An **explicit owner decision**, recorded in [`DECISIONS.md`](../DECISIONS.md) in the shape of the
existing `[fonts-honda-proxima-caveat]` entry: the gap, the decision taken, the weaker footing it
sits on, and that it was flagged to and accepted by the owner. Honda's Proxima Nova is the
precedent and it is a good one, because it records a real licence exposure rather than hiding it.

It then appears in `identity.json` as `origin: "owner-decision"` with the DECISIONS key as its
`sourceId`, so it is visibly different from a measurement at every later read.

**The skill never fills a gap. A human may, and signs it.**

### Worked example: Vauxhall blocks today

The run at `research/brands/vauxhall/2026-08-14` is the case this contract was designed against.

- Copy: **passes.** High confidence, ladder rung 4, eleven first-party artefacts across a
  register spread. Mechanics, lexicon and legal hedging are all usable.
- Audience: **passes thinly.** Four evidenced segments from the Stellantis annual report, and no
  demographic data of any kind from any source, so personas carry no ages.
- Theme: **blocks.** Four of the token set measured (`#eb0000`, `#00003a`, `#002a42`, `#ffffff`,
  all from first-party PNGs measured with Pillow), and the typeface is UNIDENTIFIED. No family
  name, no foundry, no file.

So the identity blocks, and the copy work waits on disk. `GATE.md` names the two cheapest unblocks
the run already identified: Fonts In Use Automotive pages 2 to 5, and `autosynergy.co.uk`, the
retailer-facing portal that is the run's most promising unprobed lead for actual logo rules.

The trap `GATE.md` must also carry: the only `@font-face` families seen anywhere in that run were
**Gotham** and **Open Sans**, and both belong to the Stellantis press portal, which is inherited
FCA code where every class carries an `.fca-` prefix. Neither is evidence about Vauxhall.

---

## 4. What is actually reachable, on this install

Written down because the chain's feasibility depends on it and because two of these were believed
wrong for most of the Vauxhall run.

**Blocked.** Shell `curl` reaches two allowlisted hosts only. Browser URL-attach previews are
"not enabled on this install", probed rather than assumed. WebSearch is unavailable on this model.

**Blocked, and the one that surprises people.** WebFetch converts HTML to markdown before any
model sees it, so `<link rel=stylesheet>`, `<style>`, `<script src>` and `<meta>` do not survive.
Proven three times over, on the Vauxhall press room plus `evanshalshaw.com/vauxhall/` and
`pentagon-group.co.uk/vauxhall`, all of which returned 200 and reported zero stylesheets while
obviously having them. **A stylesheet URL cannot be discovered from an HTML page here.**

**Not blocked, and this is what makes the theme layer viable.** WebFetch saves a response body to
disk even when it cannot render those bytes, and reports the path, which the sandboxed shell can
read. So binaries download from any host that answers. And **`.css` and `.json` URLs fetched
directly return their real contents.**

Those two combine into the route: **find the public build asset map, enumerate the stylesheets,
fetch each directly.** The Vauxhall run proved it with 200s on three hashed stylesheets reached
via `/build/manifest.json`, while an unhashed `/build/app.css` guess 404s. The asset map is the
load-bearing step; guessing is not a substitute.

`brand-research` must therefore probe these as **first-class deterministic probes**, alongside
`sitemap.xml` and `robots.txt`:

```
/build/manifest.json      /build/entrypoints.json     (Symfony Webpack Encore)
/_next/static/                                        (Next.js)
/etc.clientlibs/                                      (Adobe AEM)
/dist/manifest.json       /asset-manifest.json
```

Two limits on that route. It needs the host to answer 200, so it does nothing for Vauxhall, whose
estate 403s every path. And the fetching model's self-reported binary metadata is unreliable: it
misreported pixel dimensions on three of four PNGs in the Vauxhall run. `file(1)` and Pillow are
the authority, and fontTools is the authority on a font file's internal weights.

**Two process rules for `brand-research`,** both bought with the Vauxhall run's own mistakes:

1. **Probe binary retrieval in Step 1,** alongside the `curl` check. That run spent most of its
   length believing no binary could reach disk, told all five dimension agents so, and found
   otherwise only by chasing an inconsistency in an agent's report. Every measured value in the
   run came from that discovery. A `text-only` run is not necessarily an unmeasured run.
2. **Capture the page text of every cited source.** That run cited 64 text-only sources and only
   12 have a verbatim local capture, so 52 citations cannot now be checked if the page changes.
   The marginal cost of writing a fetched page to disk is near zero.

---

## 5. Status discipline, inherited

`brand-research` distinguishes four statuses and the chain must not collapse them, because only
the first is a finding about the brand:

| Status | Means |
|---|---|
| **NOT PUBLISHED** | Probed the right places. The brand does not publish it |
| **NOT FOUND** | Probed, could not locate it, may exist somewhere unprobed |
| **NOT REACHABLE** | Known to exist, blocked by a wall or a capability limit |
| **NOT PROBED** | Never attempted |

`GATE.md` uses these verbatim. A blocked layer must say which of the four it is, because
NOT PROBED is cheap to close and NOT PUBLISHED is not closeable at all. Reporting an unprobed
rung as an absent one is the single failure that cannot be recovered from on a later read.

Two conventions carry through the whole chain. Dates are absolute (`2026-08-14`), never "today",
because these files get read months later. And copy authored by the chain, as opposed to verbatim
brand quotes preserved as evidence, uses **no em dashes** in anything that could become on-screen
text.
