# Onboarding a brand into the vehicle-matcher

**How to add a new marque (or a whole new vehicle domain) to the block, end to end.**

| | |
|---|---|
| Status | Living blueprint |
| Companion | the `/onboard-brand` skill (`.claude/skills/onboard-brand/`), which walks these steps interactively |
| Proven on | BMW + MINI (original), then Ford + Honda (cars) and BMW Motorrad (bikes) |

---

## 1. The one idea

The block is **one engine, one shell, many brands**. A brand is *data and dressing*,
never logic: the scoring engine (`server/engine.js`) and the interface modes
(`blocks/vehicle-matcher/modes/`) do not know which marque they are serving. Adding a
brand means teaching five layers about it and touching nothing else:

```
feed  →  mapping  →  tuning  →  theme  →  copy
(where       (raw vehicle    (how the       (how it     (what it
 stock        → engine        engine         looks)      says)
 comes         schema)        weighs it)
 from)
```

If you find yourself editing `server/engine.js` or a mode's `.js` to fit a brand, stop:
the brand-agnostic seam has sprung a leak, and the fix belongs in one of the five layers
or in a new per-brand hook, not in the shared core. (Section 8 lists the two hooks that
already exist for exactly this reason.)

## 2. Before you write anything: is the data reachable?

The engine scores real, buyable stock. So the first question for any brand is *can we
get its inventory, and in what shape?* Three outcomes, all supported:

1. **Same platform as BMW/MINI** (Auto Trader / Django `/vehicle/api/list/` with the
   CSRF handshake). Then `server/stock.js` already does the fetch; you only add the
   brand's `origin` + `defaultRetailer` to the registry. Cheapest path.
2. **A different live API.** Write a small per-brand fetch adapter (Section 4b) that
   returns raw vehicles for `mapVehicle` to project. Wire it behind the registry's
   `source`/`fetch` hook so the shared cache/warmer still apply.
3. **Not reachable from your environment** (bot-walled, or an SPA whose API you can't
   replay). Then seed a **fixtures file** (`fixtures/<brand>-cars.json`) from a scrape or
   from public spec data, set the registry `source: 'fixtures'`, and wire the real
   adapter anyway so it goes live the day the feed is reachable. Document the gap in
   `DECISIONS.md`.

**How to probe an endpoint quickly** (do this before committing to a shape):
```
curl -s -m 25 -A "<a real browser UA>" -H 'Accept: application/json' \
  -o /tmp/probe.json -w "HTTP %{http_code} type=%{content_type} size=%{size_download}\n" "<url>"
```
HTTP 000 with a completed TLS handshake = an edge bot-wall (Akamai et al.) dropping the
stream; curl cannot pass it, so fall to outcome 3. A 405 on GET often means it wants POST
with a JSON filter body. A server-rendered listing page is scrapeable even with no API.

## 3. The five layers, file by file

### Layer 1 — Feed (`server/stock.js`, `server/brands.js`)
Where the raw stock comes from. For a same-platform brand this is just `origin` +
`defaultRetailer` in the registry. For a different source, add a `source` field and a
fetch adapter (Section 4b). The result is always an array of raw vehicles handed to
`mapVehicle`.

### Layer 2 — Mapping (`server/mapping.js`, `BRAND_MAPPERS[brand]`)
Projects one raw vehicle to the engine's car schema. The feed rarely carries everything
the engine scores (0-62, boot litres, seats), so a per-brand **model-line spec table**
fills the gaps, keyed by a normalised model line. A mapper is a bundle of pure functions:

```
BRAND_MAPPERS.<brand> = {
  defaultTitle, specs: MODEL_SPECS_<BRAND>, fallbackSpec,
  line(title, derivative),        // normalise to a spec-table key
  body(line, derivative),         // engine body vocabulary
  zeroTo62(base, line, derivative),
  tags(line, body, fuel, derivative),
  displayName(title, derivative),
  blurb(line, body, fuel, retailerName),
  styleLine(derivative) | () => null,   // optional extra taste axis
  doors(body, derivative)   | () => null,
}
```
The engine consumes the identical output shape for every brand. The card-facing fields
(`name`, `photo`, `mileage`, `plate`, `link`, `price`) are the same too.

### Layer 3 — Tuning (`server/brands.js`, `BRANDS[brand].tuning`)
How the engine weighs this brand's cars, via `mergeTuning(overrides)` onto `BMW_TUNING`.
Override only what must differ (a small quick MINI needs a different 0-62 curve and boot
scale than a big fast BMW; a mainstream brand leans on economy/practicality over image).
Every field maps to a specific scorer — see the commentary in `brands.js`. Also set
`budget: { max, default }` to the brand's real price range.

### Layer 4 — Theme (`blocks/vehicle-matcher/vehicle-matcher.css`, `.vm.vm-<brand>`)
A token override block. The **contract a theme must define** (see `.vm.vm-mini` for a
worked example):
- Colour: `--vm-ink`, `--vm-ink-strong`, `--vm-ink-muted`, `--vm-accent`,
  `--vm-accent-ink`, `--vm-accent-spot`, `--vm-accent-secondary`, `--vm-accent-soft`,
  `--vm-line`.
- Fonts (host-first, name the host's families): `--vm-font-heading`, `--vm-font-body`,
  `--vm-font-bold`.
- Geometry: `--vm-radius`, `--vm-radius-control`.
- Motion character: `--vm-ease`, `--vm-pop` (the game animations read these, so the same
  keyframes feel crisp or springy per brand).
Plus any brand-scoped rules for buttons/headlines that tokens can't express.

### Layer 5 — Copy (`server/questions.js`, `BRAND_COPY[brand]`; per-brand `questions{}`)
The brand's voice. `BRAND_COPY[brand]` overrides question/option **text only** — ids and
option `value`s are untouched so the engine is unaffected. Per-brand question surgery
(`BRANDS[brand].questions = { drop, add }`) removes near-dead questions and adds ones the
range needs; each added option's `scoresAs` folds into the standard answer fields
(`applyBespokeAnswers`), so **new questions never teach the engine a new id.**

> **Copy rule (permanent): no em dashes in any user-facing string.** Use commas, full
> stops or parentheses. Applies to labels, subs, blurbs, reason strings, CTA + share
> text. Code comments and docs may keep them.

## 4. Client wiring

### 4a. Register the brand key
`blocks/vehicle-matcher/vehicle-matcher.js` resolves the brand from authored config. It
is **registry-driven**: any key present in the shared brand list is accepted (defaulting
to bmw), so a new brand needs no edit here beyond existing in the registry. The block
applies `vm vm-<brand>` classes, which is what the theme (Layer 4) hangs off.

### 4b. A fetch adapter for a non-shared feed
When a brand's stock is not on the BMW/MINI platform, add its adapter behind the
registry's `source`. Keep it inside `server/stock.js` so the TTL cache, single-flight
and warmer still wrap it. A fixtures-backed source reads `fixtures/<brand>-cars.json`
(already-mapped car objects) and needs no network.

## 5. The car-vs-vehicle generalisation (non-car brands)

The domain model is nominally "car" but the engine scores generic axes. To onboard a
non-car brand (e.g. motorcycles), **generalise vocabulary, repurpose axes, do not fork
the engine**:
- User-facing "car" becomes "vehicle"; "test drive" becomes "book a test ride" etc., via
  Layer 5 copy and the modes' brand-neutral strings.
- Map the domain's real specs onto the engine's scored fields as **documented proxies**
  (e.g. a bike's engine cc / weight / seat height / category onto size/practicality/
  performance). Record each proxy in `DECISIONS.md` — this is where honesty matters most.
- Use `questions { drop, add }` + `scoresAs` for domain-native questions (riding style,
  licence class, engine cc) so the engine still only ever reads answer keys it knows.

## 6. Validation (do all of it, per brand)

1. `cd server && npm test` — green, and BMW/MINI output unchanged (no regression).
2. `node --check` every edited `.js`; check CSS brace balance.
3. Local run: `npm run serve`, open `?brand=<key>&mode=questions|mingle|knockout` — each
   mode paints, populates from the brand's stock, photos de-prioritised, knockout reads
   head-to-head, reveal fires, reduced-motion safe, re-mount safe.
4. Headless DOM harness (jsdom): mount each mode per brand and assert rendered output.
5. `grep` the user-facing strings for em dashes — zero.
6. Parametrise `server/test/brand.test.js` over the new brand (mapping yields valid engine
   schema; budget/tuning sane; questions resolve).

## 7. Checklist (copy this per brand)

- [ ] Data reachable? (Section 2) Decide feed / adapter / fixtures; record in DECISIONS.md.
- [ ] `fixtures/<brand>-cars.json` present (real scrape or curated) if not same-platform.
- [ ] `BRANDS.<brand>`: origin, defaultRetailer, budget, tuning, source, questions.
- [ ] `BRAND_MAPPERS.<brand>` + `MODEL_SPECS_<BRAND>` in mapping.js.
- [ ] `.vm.vm-<brand>` theme block defines the full token contract (Section 3, Layer 4).
- [ ] `BRAND_COPY.<brand>` in the brand's voice, no em dashes.
- [ ] Game character registered (Section 8).
- [ ] All of Section 6 passes.

## 8. Per-brand hooks that already exist (use these, don't fork logic)

- **Question surgery**: `BRANDS[brand].questions = { drop, add }` + option `scoresAs`
  (`server/questions.js` `applyBespokeAnswers`). Add/remove questions without an engine change.
- **Game character**: `blocks/vehicle-matcher/modes/match-signal.js` carries a per-brand
  character (confetti density + which CSS-token motion applies). New brands pick a
  character in the map; the default is BMW-restrained. (Colour and easing are the
  stylesheet's job via `--vm-ease` / `--vm-accent-spot`.)

## 9. Known sharp edges

- The feed usually lacks 0-62 / boot / seats — the model-line spec table is not optional.
- Paint colour costs one PDP fetch per shown car (`enrichColours`); only ever enrich the
  handful on screen, never a whole pool.
- A placeholder image is a photo URL shared across several cars; `photosFirst`
  (`match-signal.js`) sinks those. If a brand's feed hands out placeholders differently,
  revisit that heuristic.
