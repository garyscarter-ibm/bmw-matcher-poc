---
name: onboard-brand
description: Onboard a new vehicle marque (or a non-car domain like motorcycles) into the vehicle-matcher EDS block. Use when the user asks to add a brand, wire a new inventory feed into the matcher, theme/tune/voice a brand, or stretch the block onto a new vehicle type. Invoke as /onboard-brand <key> <listing-url> [voice-url], where the optional voice-url is the brand's national site used for tone (preferred over the used-listing site). Walks the five-layer blueprint (feed, mapping, tuning, theme, copy) end to end with the exact files and functions to touch.
---

# Onboard a brand into the vehicle-matcher

You are adding a brand to a **brand-agnostic** block: one scoring engine, one shell,
many brands. A brand is *data and dressing*, never logic. The full reference is
[`docs/onboard-brand-blueprint.md`](../../../docs/onboard-brand-blueprint.md) — read it
if you need the why. This file is the *procedure*: do these steps in order.

> **Permanent copy rule:** no em dashes in any user-facing string (labels, subs, blurbs,
> reason strings, CTAs, share text). Use commas, full stops or parentheses. Code comments
> and docs may keep them. Self-check before you finish.

Invoke as `/onboard-brand <key> <listing-url> [voice-url]`:
- `<key>` — the brand key (below).
- `<listing-url>` — the used-vehicle listing (stock + spec data; the Step 0 probe target).
- `[voice-url]` — optional, the brand's **national/marketing site** for tone. Prefer this for
  voice: the used-listing site is transactional dealer boilerplate, the national site carries the
  brand's actual register. If omitted, fall back to the listing site for voice.

## Inputs to gather first

- **Brand key** (lower-case, one word, e.g. `ford`). This is the CSS scope and registry key.
- **Listing source**: the brand's used-vehicle listing — the stock feed and per-model spec data,
  and the Step 0 reachability target.
- **Voice source** (separate, and preferred): the brand's **national site** (e.g.
  `toyota.co.uk`, not `toyota.co.uk/used-cars`). Read it for tagline, register and vocabulary in
  Step 5. Only fall back to the listing site for voice when no voice URL is given.
- **Whether it's a car brand** or a new domain (bikes, vans…). Non-car → also do Step 6.

## Step 0 — Is the data reachable? (do this before writing anything)

Probe the listing/API from the shell:
```
curl -s -m 25 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
  -H 'Accept: application/json' -o /tmp/probe.json \
  -w "HTTP %{http_code} type=%{content_type} size=%{size_download}\n" "<url>"
```
Classify into one of three, and record the choice in `DECISIONS.md`:
1. **Same platform as BMW/MINI** (`/vehicle/api/list/` + CSRF) → registry `source: 'feed'`, just add `origin`+`defaultRetailer`.
2. **Different live API** → write a fetch adapter (Step 1b), `source: 'feed'` pointing at it.
3. **Blocked here** (HTTP 000 after TLS = edge bot-wall) or SPA-only → scrape or curate `fixtures/<brand>-cars.json`, set `source: 'fixtures'`, and wire the real adapter anyway for later.

**A "session-gated" feed is not automatically outcome 3 — check if the session self-issues.** Before assuming a token means "browser capture only", look for a server-embedded session: Motorrad's GMB-SID is *not* minted by JS, the results landing page carries a fresh one in `#hfSID`, so the whole chain runs cold (GET landing page, scrape SID, POST per page — see `mintMotorradSid` in `server/stock.js` and `fetch-motorrad-all-pages-cold.mjs`). Only a token that is genuinely client-forged/signed (Ford's `x-eusl-k`) forces a one-off human capture — and forging it is off-limits. Older "copy the cURL from the browser" notes predate the Motorrad self-mint; prefer the cold path.

## Step 1 — Feed (`server/brands.js`, `server/stock.js`)

- Add `BRANDS.<brand>` with `label`, `origin`, `defaultRetailer`, `budget { max, default }` (real price range), `source`, and `tuning` (Step 3).
- **1b.** If not same-platform: add a per-brand fetch adapter inside `server/stock.js` behind the `source` switch, so the TTL cache / single-flight / warmer still wrap it. A `fixtures` source reads `fixtures/<brand>-cars.json` (already-mapped car objects) and does no network.
- **Never touch the BMW/MINI live fetch path.** Additions only.

## Step 2 — Mapping (`server/mapping.js`)

- Add `BRAND_MAPPERS.<brand>` (pure functions: `line`, `body`, `zeroTo62`, `tags`, `displayName`, `blurb`, optional `styleLine`/`doors`) — see the `bmw`/`mini` entries as templates.
- Add `MODEL_SPECS_<BRAND>`: the feed lacks 0-62 / boot / seats, so key real spec data by model line. This table is **not optional** — without it the engine scores garbage.
- Output must be the identical engine schema every other brand emits. If you're tempted to add a field only one brand uses, it belongs in tuning or copy, not the schema.
- **Detect fuel from a spec property, never a model name.** Gate `ev` on `cc === 0` / an electric flag / a positive `evRange`, so every electric variant is caught. `line === '<one model>'` silently mis-maps the next EV in the range to petrol (this bit Motorrad: the CE 02 was mapped petrol because only `CE 04` was named). Then assert in `brand.test.js` that every EV in the spec table resolves to `ev`.
- **After ANY mapper change, re-bake that brand's fixture — it does not re-run itself.** Fixtures-source brands serve a *mapped* JSON baked once by a builder; change `map<Brand>Raw` to surface a new field and the served fixture is a build behind (the field is missing on every card while the mapper and tests are both correct). Re-run the builder, then the suite: `build-honda-fixtures.mjs`, `build-ford-fixtures-from-capture.mjs`, `fetch-motorrad-all-pages-cold.mjs`. (This bit Honda colour/power/cc and Motorrad real cc/power.)
- **A display field clears THREE gates or it never shows: mapper writes it → `publicCar` (`server/index.js`) allowlists it → the card renderer reads it.** `publicCar` is a hard allowlist projection, not a passthrough; a mapped, baked field still vanishes if it's absent there (Motorrad's `cc` was mapped but not allowlisted, so no card saw it). Prefer REAL per-listing values, and never present a generic MODEL_SPECS value as measured for the individual car — keep real and generic in separate fields, and don't let a spec value overwrite a real one (`cc: num(raw.cc) || spec.cc`, not `cc: spec.cc`).

## Step 3 — Tuning (`server/brands.js`, `BRANDS[brand].tuning`)

- Build via `mergeTuning({...})` onto `BMW_TUNING`; override only what must differ. A mainstream brand leans economy/practicality over image; a small quick range needs different 0-62 and boot curves than a big fast one. Each field maps to a scorer — see the commentary in `brands.js`.

## Step 4 — Theme (`blocks/vehicle-matcher/tokens.css` + `vehicle-matcher.css`)

- **Tokens and component rules live in two files — put each edit in the right one.** The `--vm-*` design tokens are in `blocks/vehicle-matcher/tokens.css` (`@import`ed at the top of `vehicle-matcher.css`, which is the only file a real EDS page auto-loads); every brand-scoped **component rule**, the `@font-face` run, and the base `.vm` layout stay in `vehicle-matcher.css`.
- Add a `.vm.vm-<brand>` block **to `tokens.css`** defining the **full token contract**: colours (`--vm-ink*`, `--vm-accent*`, `--vm-line`), fonts (`--vm-font-*`), geometry (`--vm-radius*`), motion character (`--vm-ease`, `--vm-pop`). Copy the `.vm.vm-mini` block there as the worked example. Only **brand-invariant** values (the `--vm-space-*` / `--vm-text-*` scales, `--vm-radius-soft`, `--vm-border-width`, `--vm-surface-alt-2`) sit on `:root` in that file — never move a brand-overridden token to `:root` or every brand collapses to BMW's. Add brand-scoped **rules** (to `vehicle-matcher.css`) only for what tokens can't express.
- **The neutral brand picker themes itself — no picker edit needed.** Each tile's hover highlight is derived at runtime from the brand's tokens (index.html `brandAccent()` reads `--vm-accent-spot` off a hidden `.vm.vm-<brand>` probe and sets `--tile-accent`). So a new brand gets a branded picker tile automatically — just ensure its `--vm-accent-spot` is **legible on a dark ground** (that's why it uses spot, not raw `--vm-accent`: MINI's accent is near-black and would vanish, so MINI's spot is British Racing Green). The base `.vm` defaults `--vm-accent-spot` to `--vm-accent`, so a brand that omits it still resolves a value.
- **Package the brand typeface; don't rely on the host.** Commit the real woff/woff2 to `blocks/vehicle-matcher/fonts/`, declare it with `@font-face` at the top of `vehicle-matcher.css` (the `@font-face` run stays there — its `./fonts/` paths are relative to that file, not `tokens.css`), and name that packaged family FIRST in `--vm-font-*` (in the brand's `tokens.css` block) — so it renders in the standalone harness too (which has no host to inherit from; this was the "fonts don't show" bug). One family per typeface with real `font-weight`s (100/300/400/700); never a per-weight family name (`'Brand-Bold'`) — an undeclared weight-family silently falls through to Helvetica. Check each file's internal `usWeightClass` (fontTools) and declare each `@font-face` at the weight the CSS requests, not the file's design weight (MINI's "regular" is a 500 Medium, its "bold" a 900 Black). A sub-brand reuses the parent's files (Motorrad points at the same `'BMW Type Next'` @font-face). **Verify the real face the live site loads — don't guess a "<Brand> Sans"** (Honda's placeholder said "Honda Sans"; the site actually serves Proxima Nova). Record the self-host licence decision in DECISIONS.md, and **check whether the face is brand-owned or a licensed third-party retail face**: BMW Type Next / FordF1 / MINI are brand-owned; Honda's Proxima Nova is a commercial licensed face on weaker footing (flag it to the owner before packaging; clean fallback is a free near-match under the same family names). Only leave a brand host-first if you truly can't source the files, and say so in the comment. Verify colours against brand guidelines too (Ford Blue `#003478`, Honda Red `#CC0000` confirmed correct).
- **Set button fill, heading weight and casing deliberately — the base is BMW's.** `.vm-btn-primary` fills with `--vm-accent`, right for accent-led CTAs (BMW/Honda/Ford) but wrong for brands that use black buttons and reserve the accent for links (MINI, BMW Motorrad — override `.vm.vm-<brand> .vm-btn-primary` to near-black). `.vm-title` is BMW-cars Light-300 uppercase; override the whole heading set (`.vm-title,.vm-question,.vm-subhead,.vm-preview-heading,.vm-nearby-heading`) to the brand's own weight+casing (MINI heavy uppercase, Honda/Ford sentence-case, Motorrad bold uppercase). Uppercase button labels via the `--vm-btn-transform` / `--vm-btn-letter-spacing` tokens in the brand's `tokens.css` block — the base `.vm-btn` reads both (Ferrari sets `uppercase` + `0.05em` that way, no component rule) — never by editing copy. Eyeball the real site — tests don't catch rendered typography, so Motorrad shipped blue thin-headline buttons that all passed CI.
- **The mode switcher tabs are brand chrome too — theme the RESTING state, not just the active tab.** `.vm-switcher-tab` reads the shared tokens, but only the active tab picks up `--vm-accent`; the inactive tabs are transparent grey pills for every brand, so a bold brand (Motorrad) looks un-themed. The base now uses `--vm-font-bold` + accent-on-hover; if a brand's CTA signature differs from `--vm-accent`, mirror it on `.vm.vm-<brand> .vm-switcher-tab` exactly as you did for `.vm-btn` (Motorrad → UPPERCASE tabs + near-black active fill, not blue). The tab *labels* stay brand-neutral by design (the brand name is the in-stage wordmark); this is colour/font only. Only shows when unlocked (no `mode` row), so eyeball it with the switcher visible.
- Register the brand key in the client's `KNOWN_BRANDS` list in `blocks/vehicle-matcher/vehicle-matcher.js` (one line) so the shell accepts and themes it.
- Add the brand to `BRAND_CELEBRATION` in `blocks/vehicle-matcher/modes/match-signal.js` (particle count = exuberance; colour/easing come from CSS).

## Step 5 — Copy (there are TWO `BRAND_COPY` maps — wire both)

- **Source the voice from the national site, not the used-listing site — and from the whole site,
  not just the homepage.** Read the `[voice-url]` (the brand's national/marketing site) for its
  tagline, register and vocabulary before writing a word — that is where the brand actually speaks
  ("Make Life a Ride" is Motorrad's national line, not something the approved-used listing ever
  says). The used-listing site is dealer boilerplate; don't voice the brand off it.
  - **Don't stop at the homepage.** The landing page is one curated hero line; the real register
    lives across the site. Read a **spread of at least 4-6 pages** before you write: the homepage,
    a range/model-listing page, one or two individual model pages, and an "about / why us /
    ownership" or brand-story page (finance, aftersales and sustainability pages are good tone
    tells too). Pull these with `WebFetch` per URL, or a shell `curl` + a text pass. Look across
    them for: the recurring tagline/claim, sentence length and rhythm, how they address the reader
    ("you" vs third person), whether they lead on emotion/driving or spec/value, and the concrete
    nouns they favour. A voice read off one page over-indexes on a slogan and misses the register.
  - If no voice URL was given, say so and lift what tone you can from the listing site, but flag
    that the voice is under-sourced. Capture the register in a one-line code comment above the
    brand's client `BRAND_COPY` entry (as Honda/Ford/Motorrad do) and, for a fuller treatment
    (the recurring phrases and the do/don't for the brand), in `docs/tone-style-guide.md`.
- **Server `BRAND_COPY.<brand>`** (`server/questions.js`) — question/option **text only**, never ids or `value`s (the engine reads those). Voice it as the brand, distinct from BMW precision and MINI play.
- **Client `BRAND_COPY.<brand>`** (`blocks/vehicle-matcher/modes/brand-copy.js`) — the intro/results *display* copy (lede, headings, CTAs). This is **separate** from the server map and resolves **all-or-nothing**: the client does `BRAND_COPY[brand] || BRAND_COPY.bmw`, so a missing key silently shows BMW's "...cars at Grassicks BMW" (this is why every new brand read "bikes at Grassicks BMW"). Add a full entry (spread `...BRAND_COPY.bmw`, then override), and match the brand's vocabulary — "cars"/"bikes"/"Hondas"/"Fords", not the default "cars".
- **Rewrite the voice, don't swap the noun.** Spreading the BMW base and changing only "cars"→"Hondas" leaves the most-read string — the intro `lede` — in BMW's register, so every brand sounds the same ("N quick questions about your life, your miles and your budget. We'll match you with the approved-used ___ that suit you best, and tell you why."). That is the bug the owner caught: only MINI read distinctly. Rewrite `lede`, `title`, `cta`, `tasteLede`, `tiedLede`, `working*` and the reject/refine lines in the brand's own words (see `docs/tone-style-guide.md` for BMW/MINI; the per-brand code comment for Honda plain-practical, Ford confident-British, Motorrad rider-first-technical, Ferrari Italian-romantic-heritage). Test: read all brands' ledes side by side — if swapping the marque nouns makes them indistinguishable, it isn't done.
- **Demo harness retailer name** (`index.html`) — the "Retailer Name" config row is hardcoded to "Grassicks BMW"; add the brand to `BRAND_RETAILER_NAMES` there so `?brand=<key>` shows the brand's own retailer, not BMW's.
- If the range needs different questions, use `BRANDS[brand].questions = { drop, add }` and give each added option a `scoresAs` that folds into a standard answer key (`applyBespokeAnswers`). New questions must never teach the engine a new id.
- **A label must not assert an attribute its members don't all share.** No fuel/size/capability in a category label unless every member has it (Motorrad's "Electric scooter" was wrong — two of its scooters are petrol; use "Scooter / maxi-scooter"). Help text that names specific models must stay correct as the range grows, or name none.
- **A bespoke question's options must cover every value the other layers emit.** Cross-check the added question against the brand's `body`/`tags` vocabulary (Motorrad's `ridingStyle` has no roadster/naked, though `bodyStyles` does). Don't let a re-titled base question and a bespoke one read as near-duplicates.
- **No em dashes.**

## Step 6 — Non-car domains only (generalise, don't fork)

- User-facing "car" → "vehicle", "test drive" → "book a test ride", via Step 5 copy + the modes' neutral strings.
- Map the domain's real specs onto the engine's scored axes as **documented proxies** (bike cc/weight/seat-height/category → size/practicality/performance). Record every proxy in `DECISIONS.md`.
- Use `questions { drop, add }` + `scoresAs` for domain-native questions (riding style, licence class, engine cc).
- A "nearly all one power type plus a couple of EVs" domain (bikes) is exactly where a name-based fuel check and a fuel-asserting label go wrong. Gate `ev` on a spec property and keep category labels power-neutral (see Steps 2 and 5).

## Step 7 — Validate (all of it)

1. `cd server && npm test` — green, and **no existing brand drifts**. `brand.test.js` parametrises over every shipped brand (bmw, mini, ford, honda, motorrad, ferrari), so a regression on Ford or Ferrari fails CI exactly as a BMW/MINI one would. Onboarding is additions only: if any *other* brand's output moves, you edited shared logic, not brand data — back it out.
2. `node --check` every edited `.js`; CSS brace balance.
3. Parametrise `server/test/brand.test.js` over the new brand (mapping → valid schema; budget/tuning sane; questions resolve). **Assert edge cases against the spec table, not just the shipped fixtures** — every EV resolves to `ev`, every category maps to a body — because thin curated fixtures may not contain the row that exposes a bug (Motorrad ships no scooters/EVs, so its CE 02 fuel mis-map stayed invisible).
4. Headless DOM harness: mount each mode for the brand, assert it paints. The harness takes the mode's **filename** stem, so that's `questionnaire`/`mingle`/`knockout`/`podium`/`guess-who` — not the `?mode=` keys below.
5. Local run: `?brand=<key>&mode=…` for all five modes (`questionnaire`, `swipe`, `head-to-head`, `podium`, `guess-who` — two keys differ from their filenames) — populates, photos de-prioritised, knockout reads head-to-head, reveal fires, reduced-motion safe, re-mount safe. **Eyeball the rendered result** against the real brand site: button fill + label casing, heading weight + casing, fonts actually loading (not Helvetica), and the mode switcher tab bar at rest (open `?brand=<key>` with NO `mode` lock so it shows — inactive tabs must wear the brand, not grey). Tests pass on all of these while looking wrong.
6. `grep -r "<other brand's retailer>\|<other brand's vehicle noun>" blocks server` → the new brand must not surface another brand's retailer name or vocabulary (catches the `|| BRAND_COPY.bmw` fallback leak and a stale demo retailer row).
7. Read every brand's intro `lede`/`title`/`cta` side by side — indistinguishable-but-for-the-noun means the voice work (Step 5) isn't done.
8. `grep` user-facing strings for em dashes → zero.

## Done when

Every checkbox in the blueprint's Section 7 is ticked, tests are green with no drift on any
existing brand (bmw, mini, ford, honda, motorrad, ferrari), and each decision/proxy is in
`DECISIONS.md`.
