# MINI Mingle — requirements

**An intuition-led "swipe" interface mode for the vehicle-matcher block.**

| | |
|---|---|
| Status | Draft — to build |
| Mode key | `mingle` |
| Switcher label | `Swipe` (neutral, brand-agnostic tab); the `MINI Mingle` wordmark lives inside the stage — see §9 |
| Brand | MINI Valentine's campaign, Sytner Luton (retailer `92`); the engine underneath is brand-agnostic |
| Depends on | the shared engine (`server/`, via `blocks/vehicle-matcher/engine.js`) |
| Supersedes | the "Test Your Intuition (Swipe)" page of `mini-matcher-requirements.md` |
| Sources | the PRD (prose) + the clickable prototype `mini-matcher-all.html` (page 3, `#p3`) — §11 pins what the prototype actually does |

---

## 1. What this is, and what changed from the PRD

The source PRD (`mini-matcher-requirements.md`) describes a single self-contained
HTML file with **four pages** and **hard-coded car data** — questionnaire, a
result page, a swipe game, and a knockout game, all sharing one deck of 6–10
fake MINIs. This document extracts **only the swipe game** ("Test Your
Intuition") and re-specs it as a **standalone interface mode** in this repo's
architecture, rebranded **MINI Mingle**.

Three things are deliberately different from the PRD, because the PRD assumed an
architecture we don't have:

1. **It is one mode among several, not a page in a bespoke app.** It mounts
   through the existing mode contract (`{ key, label, mount(root, ctx) }`, see
   `blocks/vehicle-matcher/modes/index.js`) and shares the same shell, brand
   theme, engine client and API base as the questions mode. There is **no app
   header, no left/right two-panel chrome, no `goTo(n)` navigation** — the shell
   owns switching between modes. §2 replaces the PRD's §2.
2. **The deck is real stock, scored by the real engine — not hard-coded.** The
   PRD's "match result is static … no real scoring logic". Here the swipe deck
   is the retailer's **live approved-used stock**, ranked by the same engine the
   questions mode uses, fetched over the same API. No car data lives in the mode.
3. **It is self-contained, but not answer-free.** The PRD's swipe page sits
   *after* an 8-question form and its taste bars react to swipes only. MINI Mingle
   is reachable cold (it's a switcher tab / a locked page), so instead of a form
   it opens with a tiny **"set your type" seed step** — budget + what the car's
   for — that scopes the deck, then learns the rest of the brief **from the swipes
   themselves** (§4.2, §5.3). Two answers upfront, the rest inferred from swiping.

Everything the PRD says about the *questionnaire*, *Your Match* page and *This or
That* knockout is **out of scope here** — the questionnaire already exists as the
`questions` mode; "This or That" is now its own mode, the `knockout` championship
("Head to head"), spec'd in [`mini-knockout-requirements.md`](./mini-knockout-requirements.md).

### 1.0 What this is — the core idea

**"Tinder for used cars."** MINI Mingle is the **matcher, played as a swipe
game** — a Valentine's-flavoured way to answer the same questions the `questions`
mode asks, without it feeling like a form. It ends in a car the person could
genuinely buy, and a nudge to come and meet it. It launches as a February promo
for the Sytner Luton MINI campaign, so it also has to be fun and shareable — but
**matching someone to a car they'd actually buy is the job**, and the game is the
input method, not a replacement for the engine.

The model in one line: **swipes silently answer the questionnaire, and the real
engine does the matching.**

- **Swipes → answers.** Each card is a bundle of the quiz's own axes (body, fuel,
  price band, character). Keeping or passing a card nudges the *same answer keys*
  the `questions` mode produces — so a run of swipes quietly fills in the
  questionnaire (§5.3). The player never sees a form; they see cars.
- **A short "set your type" seed step first.** Like Tinder's "show me people over
  6ft" filters: one or two taps before swiping — **budget** (the engine's one
  hard filter) and **what the car's for** — so the deck is affordable and sensible
  from card one, and the two highest-signal questions swipes *can't* reliably
  infer are answered upfront (§4.1).
- **The engine matches; taste re-ranks.** The inferred answers go to the real
  **`/api/match`** (§6) — the identical call `questions` makes. The engine decides
  the feasible, affordable, practical set; the swipe signal only orders/flavours
  *within* it. So the result is **always something they could actually buy**, and
  when the swipe favourite and the engine disagree, **the engine wins** (§6.1).
- **Honest, because it's the real engine.** If the stock genuinely can't match,
  the engine already says so, and MINI Mingle passes that on gently, in-character
  (§6.2) — no fabricated verdicts.
- **A campaign, so spreading and converting matter.** Because it's a real match,
  the two promo hooks — **sharing** the result and **booking a test drive** — are
  worth building as core, not deferred (§6.3).

**What it is NOT:** a throwaway toy with a matching-shaped veneer. An earlier
draft of this spec drifted into "game with a truthful core" — a separate
frequency-vote ranker with the engine bolted on as a disclaimer. That was wrong:
it reinvented a *worse* matcher alongside the good one. The engine already turns
answers into good matches; MINI Mingle's only real job is the **inverse** — turn
swipes into answers — and then get out of the engine's way.

### 1.1 Design principles (in priority order)

- **A buyable match is the point.** Every result must be a car the person could
  realistically purchase — affordable, practical, in stock. The game serves this;
  it never overrides it.
- **The form is invisible, not absent.** Swiping *is* answering the
  questionnaire. The rigor is the same as `questions`; only the input changes.
- **Intuition over logic** — "don't think, just feel". One card, a binary choice.
  The fun is real; it's just in service of a real answer.
- **Delight where it's free.** Romance framing, hearts, "it's a match", pink,
  confetti — the Valentine conceit is the campaign's reason to exist (§8). Lean
  in, as long as it never distorts the match.
- **Replayable + shareable** — a re-swipe gives a fresh feel and every result is
  one tap from sharing (§6.3); that's how a promo spreads.
- **Low commitment** — swipes reversible (§5.4 undo); result reachable before the
  deck is exhausted, *once there's enough signal to match honestly* (§6.1).

---

## 2. Where it lives in the architecture

MINI Mingle is a new file `blocks/vehicle-matcher/modes/mingle.js`, registered
with one import + one array entry in `modes/index.js`. **No shell, engine, or
CSS-namespace changes** are needed — that is the whole point of the mode seam
built in the prep pass.

```
blocks/vehicle-matcher/
  modes/
    index.js        # + import mingle;  MODES = [questions, mingle]
    questions.js    # unchanged
    mingle.js       # NEW — everything in this document
  engine.js         # apiField drives the deck (roster read); apiMatch the result
  ui.js             # reused (el, cardinal, gbp); add shared helpers only if a 3rd mode needs them
  vehicle-matcher.css # + a .vm-mingle-* section (scoped, brand-themed via tokens)
```

### 2.1 The mount contract (what the mode is handed)

```js
function mount(root, ctx) { /* render into root */ }
export default { key: 'mingle', label: 'Swipe', mount }; // neutral tab; wordmark is in-stage
```

- `root` — a dedicated **stage** element the mode fully owns; it may
  `root.replaceChildren()` freely. This is **not** the block element (the
  switcher sits above it and must survive a mode swap).
- `ctx` — the shell-resolved context, identical to what the questions mode gets:
  - `ctx.api` — resolved API base URL (already trimmed).
  - `ctx.retailer` — retailer_site ID (may be `undefined` → server default).
  - `ctx.retailerLabel` — retailer display name for copy (e.g. "Sytner Luton MINI").
  - `ctx.brand` — `'bmw' | 'mini'`. Drives copy and (via the shell's body class)
    the theme; MINI Mingle **must not** assume MINI (see §9).
  - `ctx.overrides` — authored `{ title, kicker, disclaimer }` copy overrides;
    `null` means "suppress that line", `undefined` means "use default".
- **Return promptly.** `mount` must not `await` the network before returning —
  the shell mounts modes unawaited so a cold backend never holds the page
  hostage. Paint a skeleton immediately (§3.1), fetch the deck, swap it in.
- Per-run state (deck, index, kept list, taste tallies) hangs off a local
  closure or a fresh object — **not** off `ctx` shared fields, so a mode swap and
  re-mount starts clean.

### 2.2 What it must NOT do

- Not read or write `ctx.answers` or the `#m=` deep-link hash — those are the
  questions mode's answer shape. MINI Mingle owns its own state; if it ever
  deep-links, it defines its own hash key (§10).
- Not fetch or hold the car dataset/weights — it only ever sees the public
  display fields the API returns (§4.3).
- Not render an app header or page nav — the shell's switcher is the only nav.

---

## 3. Layout

The PRD's two-panel split (fixed left "taste profile", scrollable right "deck")
is a **desktop-first** layout. Keep the two-panel idea on wide viewports because
the live taste profile is the point — but it must collapse to a single column on
narrow screens (the block is mobile-first; the PRD listed responsive as
out-of-scope, we are not carrying that debt into a real block).

```
┌───────────────────────────────────────────────────────────────┐
│  SEED STEP (§4.1) — "What are you into?"                       │
│  • budget control      • what's it for? (city/commute/…)       │
└───────────────────────────────────────────────────────────────┘
                    ↓ (scopes the deck)
┌─────────────────────────────┬───────────────────────────────────┐
│  TASTE PROFILE (§5)          │  DECK (§4.2/§5)                    │
│  • heading + instruction     │  • progress "3 of 9" + dot row    │
│  • live taste bars           │  • the card stack (top card live) │
│  • kept-so-far list          │  • Pass / Keep controls           │
└─────────────────────────────┴───────────────────────────────────┘
                    ↓ (seed + swipes → answers → apiMatch, §5.3)
┌───────────────────────────────────────────────────────────────┐
│  RESULT overlay — the engine's match + real why + card + CTAs  │
└───────────────────────────────────────────────────────────────┘
```

- Widths: taste panel ~30%, deck ~70% on ≥ 720px; **stacked, deck first** below
  that (a swiper leads with the card, not the analytics).
- All colours/space/radius come from the existing CSS custom properties
  (`--vm-accent`, `--vm-ink`, `--vm-line`, `--vm-radius`, `--vm-radius-control`,
  …). **Do not hard-code the PRD's hex values** (`#001E50`, `#C0536A`, etc.).
  The MINI theme already defines these under `.vm-mini`; BMW gets its own. The
  PRD's "pink / Valentine" accent maps to `--vm-accent-spot`, used sparingly.
- Scope every selector under `.vm` (e.g. `.vm-mingle-card`), consistent with the
  rest of the block, so nothing leaks into the host page.

### 3.1 Loading skeleton

On mount, before the deck arrives: render the panel chrome, a single greyed
placeholder card, and disabled Pass/Keep controls. Matches the questions mode's
"paint a skeleton, swap in real data" behaviour. If the deck fetch **fails**,
replace the skeleton with a plain, on-brand error line (reuse the questions
mode's failure copy register — a friendly sentence, a retry affordance), never a
blank stage.

---

## 4. The seed step and the deck

MINI Mingle produces a real match, so it needs a real brief. It gathers that
brief in two parts: a tiny **seed step** answers the two questions swipes can't
reliably infer (§4.1), and the **swipes** infer the rest (§5.3). The deck itself
is real stock scoped by the seed answers (§4.2/§4.3).

### 4.1 The "set your type" seed step

Before the first card, one short screen — Tinder's "show me people over 6ft"
filters, MINI-flavoured. It collects the **two highest-signal answers a swipe
can't dependably read**:

| Seed input | Answer key it sets | Why upfront, not inferred |
|---|---|---|
| **Budget** — a slider / a tap on price bands | `budget` | The engine's one **hard filter** (`STRETCH_FACTOR`). Guessing it from swipes risks a deck full of unaffordable cars — the fastest way to an unbuyable "match". Ask it. |
| **What's it for?** — a few big tappable tiles | `primaryUse` | Drives size/practicality/seat weighting. Swipes read *taste* (looks, colour) well but *use case* poorly — a person can fancy a two-seater and still need to seat a family. |

- Keep it to **two taps**. This is the price of a buyable match; any more and it
  becomes the form MINI Mingle exists to avoid. Big, flirty, on-brand controls
  ("What are you into?"), not a quiz.
- **Source both from the engine, per brand — same as the questions mode.** The
  seed fetches `apiGetQuestions(ctx.api, ctx.retailer, ctx.brand)` and builds its
  tiles from the returned `budget` and `primaryUse` questions, so MINI shows
  MINI's labels ("Nipping round town", "Go-kart grins…") and MINI-scale money
  (slider `max` ~£50k), while BMW shows its own plainer labels and reaches
  £150k+. The **`primaryUse` tiles are the question's `options` verbatim**
  (value/label/sub); the **budget tiles are quantised from the question's `max`**
  into round "up to £Xk" bands plus an open top — the swipe game wants a few tap
  targets where the quiz uses a dual-thumb slider, but the *range* is the
  engine's, not a local constant. Never hardcode the option text or the budget
  ceiling in the mode.
- The keys and values still map to `server/questions.js` exactly: `budget` is a
  `[min, max]` range; `primaryUse` is one of `city | commute | family |
  roadtrips | fun` (the values behind whatever labels the brand authored).
- These two seed answers are the **starting `answers` object**. They scope the
  deck immediately (§4.2) and are carried straight into the final `/api/match`
  (§5.3) — nothing is thrown away.

> Why exactly these two, and no more: budget and primaryUse are the answers with
> the highest cost-of-being-wrong and the lowest chance of a swipe getting them
> right. Everything else (body, fuel, character, priorities) is *taste*, which is
> exactly what swiping is good at reading — so infer those (§5.3). This split is
> the "seed a pool, then learn by swiping" model, mapped onto the real engine.

### 4.2 The deck — real stock, scoped by the seed

The deck is fetched from **`POST /api/field`** via
`apiField(base, answers, retailer, brandKey, size, enrich)` in `engine.js`, passing
the **seed answers** from §4.1 (not an empty brief), a `size` of `DECK_TARGET`, and
`enrich: true`. That endpoint returns a roster of the retailer's **live** stock (up
to `size`, server-clamped to `FIELD_MAX = 16`) as `{ matches: [...] }`, each match
carrying public display fields **plus colour paint** (because the deck asked to be
enriched — see below) — already filtered to the budget and skewed toward the use
case. So from card one the deck is **affordable and sensible**; the swipes then
refine taste within it.

> Why `/api/field` and not `/api/match` for the deck: `/api/match` returns the
> narrow hero set (top 3) for a *completed* brief; `/api/field` returns a wider
> roster and tolerates a **partial** brief (here: budget + use, taste still
> unknown). A swipe deck wants breadth around the seed, not the final three.
> `/api/match` comes later, once the swipes have filled in the taste (§5.3).
>
> Why `/api/field` and not `/api/preview`: `/api/preview` is the *questions-mode*
> "best guess" drawer — capped at `PREVIEW_COUNT = 9` and always paint-enriched.
> The games (this deck, the knockout bracket) want a controllable **roster**, so
> they read the sibling `/api/field` (same engine, same cached stock) which takes a
> `size` and an opt-in `enrich` flag. The swipe deck passes `enrich: true` because a
> card's paint is a first-class taste signal (§5.2) and the deck is small; the
> knockout omits it so a 16-car field doesn't fetch a PDP per round-one loser.

- **Shuffle the deck — do NOT swipe in rank order.** Within the seed-scoped pool,
  order is a *game* concern, not a ranking one. A deck sorted best-to-worst kills
  it: the first card is the "best" car and it's downhill from there, and every
  session shows the same cars in the same order — destroying the replay value a
  promo needs most. Randomise client-side each session. The engine still does the
  real ranking, but at the **result** (§5.3), not in the swipe order.
- **A wider pool than the final three, for variety.** A lucky-dip wants breadth
  and the odd wildcard. The deck asks `/api/field` for `DECK_TARGET` cars; the
  server clamps to `FIELD_MAX = 16` and returns however many the live feed fills.
  The mode reads whatever it's sent and must **not** assume a fixed count. (To
  widen or narrow the deck, change `DECK_TARGET` client-side — no server change.)
- **Deck size = whatever the mode decides from what it's sent** (0…N). Never
  hard-code 10 (the PRD's number). Drive the progress counter and dot row off the
  live deck length. A good swipe session is ~8–12 cards; sample down to that if
  the pool is bigger.

> Build note on randomness: `Math.random()` is fine for the shuffle (it's the
> game surface, not the reproducible engine). If a *shareable* deck is ever
> wanted (two friends swiping "the same cars"), seed the shuffle from a share
> code — a §6.3 enhancement, not the default.

> Empty-pool case: if the budget is so low that the seed returns **no** stock,
> don't drop into a blank swipe screen — surface it at the seed step ("Nothing at
> Sytner Luton under that just now — nudge it up?") and let them adjust before
> swiping. Better to catch an unbuyable brief before the game than after.

### 4.3 The card — fields available, and how they map

Each deck entry is a `publicMatch`: `{ car, score, stretch, reasons, tradeOffs,
listings }`. The card renders from `car` (a `publicCar`), whose display fields
are (see `server/index.js` `publicCar`):

| PRD card element | Real field | Notes |
|---|---|---|
| Model name | `car.name` | e.g. "MINI Countryman" |
| Variant / spec line | `car.line`, `car.body`, `car.fuel`, `car.plate`, `car.mileage` | compose the PRD's "trim · year · mileage" from these |
| Price | `car.priceFrom`/`car.priceTo` (grouped) or `car.price*` | use `gbp()` from `ui.js`; show a range when grouped |
| Fuel tag pill | `car.fuel` | one of the tag pills |
| Body tag pill | `car.body` | the other tag pill |
| Colour | `car.colour.manufacturerColour \|\| car.colour.colour` | present on matches; used by the taste "Colour" bar |
| Car image | `car.photo` (real photo!) | **replaces the PRD's emoji placeholder** — the live feed carries photos. Fall back to a neutral silhouette/initial if `photo` is absent. |
| Match quality badge | derived from `score` | §4.4 |

- **Photos, not emoji.** The PRD used emoji because it had no data. We have real
  photos on live matches — use them. Provide a graceful no-photo fallback.
- Do not invent fields. If a fact the PRD card wanted isn't in `publicCar` (e.g.
  a distinct model-year), compose it from `plate`/`line` or drop it.

### 4.4 Card badge — flirty flavour, NOT a scored verdict

**Every card in the deck is desirable.** This is a dating game: Tinder never
tells you a profile is a "weak match" — it just shows the next one. So the card
badge is **flavour, not a verdict**. Do *not* import the matcher's `WEAK_SCORE`
banding onto the card, and do *not* render a "Possibility" downer — a card
labelled "meh" is a mood-killer and there's no reason it's even in the deck.

Badges are romance-themed and lightly randomised for fun, e.g.:

- "🔥 Hot right now" · "Your type?" · "Plays a bit hard to get" · "Head-turner"
  · "♥ Strong chemistry"

Pick per card from a small pool (bias the warmer ones toward higher-scoring
cars if you like — but as a *nudge*, never a printed score, and never anything
negative). The "♥" glyph is a nice MINI-Valentine beat. Keep the copy in
`BRAND_COPY[brand]` so a future BMW skin can swap the register.

> Where `WEAK_SCORE` *does* earn its place is the **result**, once, softly: if
> the engine's pick for the player's taste still scores weak, the closing screen
> owns up to it in-character (§6.2). That's the "truthful core." It belongs at
> the end, not stamped on every card mid-game.

---

## 5. Swiping and the live taste profile

### 5.1 The interaction

- One card live at a time (top of stack); the next card faintly visible behind
  it (PRD §5.2.2).
- **Pass** (left) and **Keep** (right):
  - Buttons: a circular ✕ **Pass** (outlined) and a ♥ **Keep** (filled with
    `--vm-accent`, or `--vm-accent-spot` on MINI for the "Valentine" beat).
  - Drag/swipe gesture on the card should mirror the buttons (pointer + touch),
    but the **buttons are the source of truth** — gesture is an enhancement and
    must degrade to button-only where pointer events aren't available.
  - Keyboard: Left arrow = Pass, Right arrow = Keep, so it's operable without a
    pointer (accessibility; the PRD omitted this).
- Advancing: on Pass or Keep, the card animates out, the next becomes live, the
  progress counter and dot row advance.

### 5.2 The live taste profile (learned from swipes)

Four bars, updating in real time (PRD §5.1.1), each derived **only from KEPT
cars** (a Pass is weak signal; a Keep is the intuition we're reading):

| Bar | Tracks | Source field |
|---|---|---|
| Fuel | most-kept `car.fuel` | `car.fuel` |
| Colour | most-kept colour shade | `car.colour` (normalised shade) |
| Budget | average price of kept cars | `car.priceFrom`/price |
| Body | most-kept `car.body` | `car.body` |

- Bars start empty (a placeholder dash, PRD §5.1.1) and fill proportionally as
  keeps accumulate — e.g. the Fuel bar's fill = share of kept cars that are the
  leading fuel.
- **Kept-so-far list** (PRD §5.1.2): a running list of kept car names; empty
  state "Nothing yet — start swiping." (MINI register — soften per `BRAND_COPY`).

### 5.3 Turning swipes into answers, then letting the engine match

This is the heart of the mode, and the thing the PRD ("static result") and an
earlier draft of this spec both got wrong. The swipes are **not** a ranker. They
are an **input method**: keeping and passing cards fills in the *same answer keys*
the questions mode collects, and then the **real engine** does the matching.

**Step 1 — read the kept set into answers.** The seed step (§4.1) already set
`budget` and `primaryUse`. The swipes infer the *taste* keys, from the **kept**
cars only (a Pass is weak signal; a Keep is the intuition we're reading). Map to
the exact keys in `server/questions.js`:

| Answer key | How swipes infer it | Fallback if signal is thin |
|---|---|---|
| `bodyStyles` (multi) | the body types among kept cars (`car.body`), most-kept first | omit → engine doesn't constrain body |
| `fuel` (multi) | the fuel types among kept cars (`car.fuel`) | omit → engine doesn't constrain fuel |
| `style` (1–5 scale) | lean sporty (→4–5) if kept cars skew to sporty bodies/trims (JCW, Cooper S…); calmer (→2–3) otherwise | default `3` (neutral) |
| `priorities` (multi, **max 2**) | derive from the pattern: strong colour/body consistency → `image`; keeping economical fuels (ev/phev) → `economy`; sporty skew → `performance` | omit → engine uses base weights |
| `charging` (conditional) | only relevant if inferred `fuel` includes ev/phev — then set `either`/an "open to it" value | omit unless fuel implies it |

Keys the swipes **can't** honestly read stay at sensible defaults, not invented
signal: `people` derived from the seed `primaryUse` (family → a crew; else solo);
`mileage` left at the questionnaire's own default. Document each default in one
place (§ build note) so it's auditable, not magic.

**Step 2 — call the real matcher.** Assemble `{ ...seedAnswers, ...inferred }`
and call **`apiMatch(ctx.api, base, answers, ctx.retailer, ctx.brand)`** — the
**identical** call the questions mode makes. The engine returns the real
`{ matches, unmet, decisive, ... }`: feasible, affordable, practical cars, ranked,
with real `reasons` and `tradeOffs`. **This response is the result** (§6) — not a
client-side vote.

**Step 3 — the engine wins; taste only re-ranks within the feasible set.** The
engine's returned matches are all buyable. The swipe signal is allowed to
**re-order or flavour among them** — e.g. nudge the car whose colour/body most
matches the kept set to the top of the returned matches — but it may **never**
promote a car the engine didn't return, and never overrule the engine on
feasibility. If the swipe favourite and the engine's top pick disagree, **the
engine's pick is the match**; the swipe favourite can appear as a "you also kept
leaning toward…" aside, not the hero. A used-car match the buyer can't actually
buy is the one failure this mode must not ship.

> Why this way, not a vote: the prototype's `swipeFindDream()` frequency-vote
> feels satisfying but reinvents — worse — what the engine already does well
> (rank real stock against a brief), and it can crown a car that's over budget or
> impractical because it happened to be red. Turning swipes into *answers* and
> deferring to the engine keeps the fun of "my swipes chose this" **and**
> guarantees the result is a car they could buy. The loop still visibly closes
> ("you kept leaning electric — so does your match"); it's just closed by the
> real matcher, and the "why" (§6) is the engine's real reasons, not a tally.

- **Thin signal (0–1 keeps).** Don't fabricate taste. Match on the **seed answers
  alone** (budget + use are a legitimate, if broad, brief) and say so
  in-character — "Playing it cool, then — here's what fits what you told us." The
  result is still a real `apiMatch`, just a less taste-shaped one. Never invent
  keeps.

> Build note: the swipe→answer mapping (which bodies count as "sporty", how many
> keeps make a `fuel` preference vs. noise, the priorities heuristic, the
> defaults for `people`/`mileage`/`charging`) is a small, opinionated tuning
> surface. Keep it in **one clearly commented `swipesToAnswers()` helper** in
> `mingle.js`, the way the questions mode isolates `validBudget`. Err toward
> *omitting* a key rather than guessing it — an omitted key lets the engine use
> its defaults, which is safer than a wrong inference. A few keeps is weak data;
> the copy stays playful about that (§5.3 thin-signal), the engine stays honest.

### 5.4 Undo (new — not in PRD, low cost, high forgiveness)

A single-step **undo** ("↩ bring that one back") restores the last-swiped card
to the top of the stack and reverses its effect on the taste tallies. The PRD
had no undo and leaned entirely on "swipe again" (full reset); a one-step undo is
cheaper for the user and matches the "low commitment" principle. Full "swipe
again" reset still exists at the result (§6.1).

---

## 6. The result

After the last card (or an early "reveal my match" affordance, §6.1), the deck is
replaced by a full-screen **"It's a match!"** overlay — the payoff, and the
moment the campaign converts. The hero car and its "why" are **the engine's real
`apiMatch` result** (§5.3); the romance framing wraps that truth, it doesn't
replace it.

| Element | Detail |
|---|---|
| Header | The Valentine payoff: hearts + "It's a match! ♥" + a warm sub-line ("Your heart's made up its mind."). MINI register from `BRAND_COPY[brand]`. |
| The match | The engine's top match (after taste re-rank within the feasible set, §5.3 step 3). Always a car they could actually buy. |
| Why this one | The engine's **real `reasons`** for this car — the same true "why it suits you" bullets the questions mode shows — given a flirty MINI voice. A swipe callback makes it feel *earned* ("and it's the electric one you kept leaning toward ♥"), but the substance is the engine's, not a swipe tally. |
| Car card | A hero card for the winner: real `car.photo`, name, spec, price, tag pills. Bigger and more lavish than a deck card — this is the one that matters (PRD §10 "prominent top spot"). |
| Primary CTA | **"♥ Book a Valentine's test drive"** — the campaign hook (§6.3). |
| Secondary CTA | "See full details" → the car's real PDP (`car.link`). |
| Share | **"Share your match"** — core, not deferred (§6.3). |
| Reset | "Swipe again" — re-seeds a *fresh, re-shuffled* deck (§4.2) and clears taste state. Replay is the point; make this inviting, not an afterthought. |

- The match and its reasons come from `apiMatch`; the swipe callback is
  presentation only. Never print a "why" the engine didn't back — if the engine
  gave thin reasons, lean on the flirt and the honest note (§6.2), don't invent.
- CTAs link to the **real** retailer PDP (`car.link`) and enquiry flow — no dead
  demo buttons (the PRD's were non-functional). Reuse any enquiry/PDP affordance
  or helper the questions mode already has.

### 6.1 Reaching the result early

Per "low commitment", offer a subtle "**Reveal my match ♥**" affordance once
**≥ 3 cards** have been kept-or-passed, so a player who's had enough isn't forced
through the whole deck. Hidden below that threshold (too little to go on).

### 6.2 The honest "not quite" note — inherited from the engine, not bolted on

Because the result *is* the engine's `apiMatch` output (§5.3), it comes with the
engine's own honesty for free. If the engine's top match for the assembled brief
scores **weak** (below `WEAK_SCORE`, the matcher's own "we don't really have this"
line — see `scripts/persona-check.mjs` and the `weakTitle`/`weakLede` copy already
in `BRAND_COPY.mini`), or the engine returns `unmet` wants, the match overlay
**still celebrates** (it's a game, don't kill the moment) but adds one soft,
in-character line under the card:

> "Full disclosure, though — none of these *quite* nailed your taste. Stock
> changes every week, so it's worth another swipe soon. ♥"

- It's a **reason to come back**, framed as flirty MINI honesty, not an apology
  or an error state. It should feel on-brand, not like a bug.
- It appears **only** at the result, **only** when the check is genuinely weak,
  and **never** as a per-card label (§4.4). One honest beat, well placed.
- Reuse the MINI `weakTitle`/`weakLede`/`rescue*` copy where it fits rather than
  writing a parallel voice — that copy was tuned for exactly this "we haven't got
  your car right now, come back" situation.

### 6.3 Share + test drive — the campaign hooks (core, not deferred)

This is a **dealer promo**; spreading and converting *are* the deliverable. Both
are designed in now, at least in outline, not left to §10.

**Book a test drive (conversion).** The primary result CTA. Valentine's framing
("Book a Valentine's test drive with your match"). Route to the retailer's real
enquiry/booking path for that specific car (`car.link` / whatever enquiry
mechanism the questions mode uses). If a campaign landing/booking URL exists for
February, prefer it — flag as an authored config value (a `Mingle CTA` row, or
reuse the existing config convention) so marketing can point it wherever the
campaign needs without a code change.

**Share your match (reach).** The mechanism that makes a gimmick spread:
- **What's shared:** the matched car — "I matched with a Chili Red Cooper S at
  Sytner Luton MINI. What's your type? 💘" — plus a link back into MINI Mingle so
  the recipient plays too. Use the Web Share API where available
  (`navigator.share`, great on mobile — where this promo lives), with a
  copy-link fallback.
- **The link:** encodes the matched car (and optionally the swipe taste) so the
  landing shows "your friend matched with *this* — now find yours". Define
  MINI Mingle's **own** hash/param for this (not the questions mode's `#m=`;
  see §2.2 / §10). A shared deck "swipe the same cars as your friend" is a nice
  stretch — seed the shuffle from the share code (§4.2 build note).
- **Minimum for v1:** Web Share of a text + link to the mode. The richer
  "landing shows their match" and "shared deck" are fast-followers; spec the
  param shape now so v1 doesn't paint us into a corner.

> These two are why the mode exists commercially. If build time is tight, cut
> confetti (§8) or undo (§5.4) before cutting share or the test-drive hook.

---

## 7. "Not this one" — NOT in this mode

The PRD's elaborate "Not this one" dismissal flow (its §7) is a **questions-mode
/ results-page** concern — it edits a shortlist and captures reject reasons. In a
swipe interface, **Pass IS the dismissal** — there is no separate reject popover.
Do not port PRD §7 here. (If reject-reason capture is wanted later, it belongs in
the questions mode's refinement layer, which already has a reject flow —
`rejectOpen`/`rejectPrompt`/`rejectJust` in `BRAND_COPY`.)

---

## 8. The Valentine's theme is load-bearing (incl. confetti)

The romance conceit is **the product**, not decoration. "It's a match", hearts,
"swipe right", "your type", pink — these are what makes it a February gimmick
worth running, so treat them as designed copy/UX (drawn from `BRAND_COPY[brand]`),
not styling to be sanded off. The earlier draft's instinct to neutralise all this
in the name of brand-agnosticism was wrong for this brief (§9).

- **Confetti** on the match reveal (PRD §8.3): a pink/Valentine burst — keep it,
  it's part of the payoff. Small self-contained function in `mingle.js`; particle
  colour from `--vm-accent-spot` so a future brand skin re-tints it.
- **Gate motion on `prefers-reduced-motion`** — respect the OS setting (the PRD
  didn't). Reduced-motion users still get the match, just without the burst.
- If build time is tight, confetti is a fair cut (§6.3) — the *copy* conceit is
  not.

---

## 9. Brand-aware, but MINI-first by design

MINI Mingle is a **MINI Valentine's campaign**. The name, the pink, the hearts,
the flirt copy *are* the point — so the MINI experience is the primary, fully
designed one, not a theme layered over a neutral abstraction. Don't spend build
time on a dignified brand-neutral version nobody has asked for; that's polishing a
corner while under-building the campaign.

The mode is still brand-*aware* in the cheap ways that come for free: it reads
`ctx.brand`, pulls copy from `BRAND_COPY[brand]`, and themes from the brand's
tokens — so a BMW skin is *possible* later. But:

- **Assume MINI.** Write the copy, badges (§4.4) and result voice (§6) for MINI
  first. A BMW register is a later `BRAND_COPY.bmw` addition, not a v1 concern.
- **The switcher label** is the neutral **"Swipe"**. A mode's `label` is a
  static string today and can't vary by brand, so the brand-agnostic tab stays
  neutral and the **"MINI Mingle"** wordmark is rendered inside the stage
  (`MINGLE_COPY[brand].wordmark`), where a BMW skin can give it its own name
  without a shell-contract change. (Built this way — the tab read "MINI Mingle"
  in the first cut, which put a campaign name on shared shell chrome and
  doubled it up with the in-stage wordmark.)

---

## 10. Out of scope / deferred

- **Rich share landing + shared decks** — v1 ships Web Share of car + link (§6.3
  is *in* scope); the "landing shows your friend's match" and seed-matched decks
  are fast-followers. Spec the param shape in v1 so we don't paint ourselves in.
- **Persisting kept cars across sessions** — the PRD's "Saved for later" tab was
  non-functional; not built here.
- **The other PRD pages** — questionnaire (already the `questions` mode), "Your
  Match" summary, and "This or That" knockout (a separate future mode).
- **Reject-reason capture** — see §7 (Pass *is* the dismissal here).
- **A polished BMW skin** — see §9; MINI-first for the campaign.
- **"Hear us out" / grouping / cheese pun** — PRD §10 future ideas, untouched.
  (The cheese pun is explicitly parked for a later swipe-UI mockup pass.)

---

## 11. Additional detail pulled from the clickable prototype

These are behaviours the PRD prose left implicit but the prototype (`#p3` in
`mini-matcher-all.html`) actually implements. Treat them as the concrete
interaction spec; where they refine an earlier section, the earlier section's
principle still governs (matcher-first, MINI-first, the engine picks the match).

### 11.1 The card stack is exactly three deep

The prototype renders at most three cards: `front`, `back1` (scaled 0.96,
nudged down 9px), `back2` (scaled 0.92, down 18px). The rest of the deck is not
in the DOM until it's near the top. Do the same — a swipe deck only needs to
*suggest* depth, and rendering nine live cards is wasted DOM. Rebuild the stack
after each advance.

### 11.2 Fly-out animation + a busy lock

- Keep: card flies **right** with a `+20deg` rotate; Pass: flies **left**,
  `-20deg`; over ~0.3s ease-in. Advance the index after the animation
  (prototype uses a 280ms timer).
- A **`swipeBusy` lock** ignores further Pass/Keep input while a card is mid-fly.
  This matters — without it a fast double-tap skips a card or corrupts the
  index. Carry the lock over; also disable the buttons visually while busy.
- Respect `prefers-reduced-motion`: when set, skip the fly transform and just
  swap the stack (the lock/timer can collapse to near-zero).

### 11.3 Progress dots have three states

The dot row isn't just filled/unfilled (PRD §5.2.1 undersold it). Each dot is:
`current` (the live card — near-black), `done-keep` (a card you kept — accent
/ MINI pink), or `done-pass` (a card you passed — muted grey). So the row
doubles as a **keep/pass history** at a glance. Reproduce the three states
(themed via tokens, not the prototype's hex).

### 11.4 Colour is a first-class signal, shown on every card

The prototype gives each card a **colour bar** across the top and tints the
image area with that colour (a `CHX` name→hex map, e.g. red `#c0536a`). Colour
is one of the four taste dimensions and the most *visually* expressed one — the
"does your eye agree" cue that makes a swipe feel like taste, not spec-matching.

Mapping to real data: our `car.colour` carries both a marketing name
(`manufacturerColour`, e.g. "Chili Red") and a normalised `colour`/shade. Build
the colour bar/tint from the **normalised shade** mapped to a small
swatch-hex table (define it in `mingle.js`, brand-neutral), falling back to a
neutral swatch when a shade is unknown. Do **not** hard-code the prototype's
five colours — derive the table from the shades the feed actually returns.

### 11.5 The "dream car" algorithm (prototype's, and why ours is the inverse)

The prototype's `swipeFindDream()` is a **frequency vote**: tally the fuel,
colour, body and price-band of every kept car, then score each deck card by how
many of those tallies it hits, and pick the highest. Its "why" string is
assembled from the counts:

> "6 of 8 you liked were electric, 5 were red, 4 were under £30k. This MINI
> scores highest across your choices."

**Take the tally, not the vote.** The count-based *reading of the kept set* is
the useful, honest part — it's built from what the player actually did. But the
prototype then uses it as a **ranker**, picking the winner by vote. Ours does the
inverse (§5.3): the kept tallies become **answer keys** (modal body → `bodyStyles`,
modal fuel → `fuel`, sporty skew → `style`/`priorities`), and the **real
`apiMatch`** ranks feasible stock against them. So:

- the kept counts drive the **inference** (which answers) and a **swipe callback**
  in the copy ("the electric one you kept leaning toward"), but
- the **winner and its reasons come from the engine**, not the tally — because a
  vote can crown an over-budget or impractical car for being red, and the engine
  can't (§5.3 step 3).

Keep the prototype's price-band buckets as the **budget-bar vocabulary** and the
seed-step budget control (under £20k / £25k / £30k / £35k / £35k+ — align to
`BUDGET_BANDS`). Where §5.3/§6.2 and this section differ, **§5.3 governs**: the
engine picks, taste re-ranks within the feasible set, and the honest note is the
engine's own weak-score signal — not a static pick with a disclaimer.

### 11.6 Taste bars fill proportionally, capitalise the value

Each bar's fill width = `(count of the leading value) / (total kept) × 100%`,
and the displayed value is capitalised (`electric` → "Electric"). Bars animate
their width (~0.4s). The budget bar shows the leading **price band**, not a
raw average, so it reads as a preference ("Under £30k") rather than a number.

### 11.7 What the prototype does NOT have (so we decide deliberately)

- **No undo, no gesture-drag** — it's buttons only, and "swipe" is a metaphor,
  not a drag. §5.1 (gesture as progressive enhancement) and §5.4 (one-step
  undo) are **our additions**, not the prototype's. They're worth adding, but
  flag them as scope beyond a like-for-like port.
- **No keyboard support** — arrow-key Pass/Keep (§5.1) is our accessibility
  addition.
- **Hard-coded "1 of 10", a fixed 10-car deck, in rank order** — do **not** copy
  any of it: shuffle, sample a wider pool, and drive counts off the live deck
  length (§4.2). The prototype's static deck is its biggest tell that it was a
  mockup, not a game.
- **Emoji placeholders** — replaced by real `car.photo` (§4.3).
- **Confetti fires unconditionally** on match — we gate it on
  `prefers-reduced-motion` (§8).

---

## 12. Build checklist (for whoever picks this up)

Ordered roughly by priority for a campaign — the top items are the product; the
tail is polish that can be cut under time pressure (§6.3).

**The brief + the game (must-have):**
1. `modes/mingle.js` exporting `{ key: 'mingle', label, mount }`; register it in
   `modes/index.js` (import + array entry) — the switcher then shows two tabs.
2. **Seed step** (§4.1): fetch `apiGetQuestions` first; build the budget bands
   and "what's it for" tiles from the engine's per-brand `budget`/`primaryUse`
   questions (labels + slider `max`), NOT local constants → a starting `answers`
   object (`budget` + `primaryUse`, real keys from `server/questions.js`).
   Empty-pool guard before swiping (§4.2).
3. `mount`: skeleton → after the seed, `apiField(ctx.api, seedAnswers,
   ctx.retailer, ctx.brand, DECK_TARGET, true)` → **shuffle + sample** to an ~8–12-card deck (§4.2);
   never await before returning.
4. Card renderer from `publicCar` fields (§4.3): real `car.photo`, `gbp()` price,
   fuel/body pills, colour bar/tint (§11.4), **flirty badge** (§4.4 — no scored
   "Possibility").
5. Swipe interaction: Pass/Keep buttons (source of truth); fly-out + `swipeBusy`
   lock (§11.2); three-state dots/counter off `deck.length` (§11.3); MINI voice
   throughout (§8/§9).
6. Live taste bars + kept list from the **kept** set only (§5.2/§11.6).

**The real match + payoff + campaign hooks (must-have):**
7. `swipesToAnswers()` helper (§5.3): kept set → taste keys (`bodyStyles`, `fuel`,
   `style`, `priorities`, `charging`); documented defaults for what swipes can't
   read. Assemble `{ ...seedAnswers, ...inferred }`.
8. **The match is `apiMatch`** on that brief (§5.3 step 2) — the same call the
   questions mode makes. **Engine wins; swipe taste only re-ranks within the
   returned feasible set** (§5.3 step 3). Never promote a car the engine didn't
   return. Thin-signal path = match on seed answers alone (§5.3).
9. Result overlay (§6): hero card = engine's top match; "why" = engine's **real
   `reasons`** with a swipe callback; **confetti**. Honest "not quite" note driven
   by the engine's own `WEAK_SCORE`/`unmet` (§6.2) — inherited, not bolted on.
10. **Test-drive CTA** → real enquiry/`car.link`, campaign URL as authored config
    (§6.3). **Share** → Web Share of car + link, own hash/param defined (§6.3).
11. "Swipe again" → fresh re-shuffled deck (§6/§4.2). Reveal-early affordance (§6.1).

**Polish / cut-lines:**
12. `.vm-mingle-*` CSS, scoped under `.vm`, tokens only; verify under `.vm-mini`
    (BMW skin is later — §9). `prefers-reduced-motion` disables fly + confetti.
13. Nice-to-haves, cut first under time pressure: one-step undo (§5.4), gesture
    drag + arrow-key support (§5.1), confetti (§8). **Do not** cut share, the
    test-drive hook, or the `apiMatch` result to save time (§6.3/§5.3).

**Verify:** showcase page shows both tabs; MINI Mingle at Sytner Luton
(`?brand=mini&retailer=92`) runs the seed step, then swipes a *shuffled, real*
budget-scoped deck that reorders on reload; the result is a real `apiMatch` pick
the buyer could afford (cross-check against `questions` for the same brief); a
`Mode: mingle` row (or `?mode=mingle`) locks the page with no switcher; a
weak/unmet brief shows the honest note without killing the celebration;
`cd server && npm test` stays green (engine untouched).
