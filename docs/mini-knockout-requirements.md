# MINI Knockout — requirements

**A championship "This or That" interface mode for the vehicle-matcher block.**

| | |
|---|---|
| Status | Built |
| Mode key | `knockout` |
| Switcher label | `Head to head` (neutral, brand-agnostic tab); the `MINI Knockout` wordmark lives inside the stage — same convention as Swipe's §9 |
| Brand | MINI Valentine's campaign, Sytner Luton (retailer `92`); the engine underneath is brand-agnostic |
| Depends on | the shared engine (`server/`, via `blocks/vehicle-matcher/engine.js`) and the shared game helpers (`blocks/vehicle-matcher/modes/match-signal.js`) |
| Sibling | the swipe game, [`mini-mingle-requirements.md`](./mini-mingle-requirements.md) — this mode follows its process and principles |
| Sources | the PRD's deferred "This or That" knockout (see the mingle doc §1), extended into a bracket |

---

## 1. What this is

The original PRD imagined a fourth interface — a **"This or That" knockout** — that
the swipe spec deferred. This is that mode, taken past a single either/or into a
**World-Cup-style championship**: a field of real cars enters a knockout bracket, lean
head-to-head matchups whittle it to a champion, and the champion is the star of the reveal.

It obeys the **same core rule** as the swipe game and the questions form:

> **The game is only an input method; the real engine (`/api/match`) does the matching.**

Every head-to-head pick is the player quietly answering the same questionnaire the
`questions` mode asks. Those picks become the **same answer keys** the engine reads, and
the engine is consulted for the real "why" and its own honesty. What differs from the swipe
game is only the shape of the game (a versus bracket, not a swipe stack) and one
deliberate result choice (below).

## 2. It's a mode, like the others

Mounts through the mode contract (`{ key, label, mount(root, ctx) }`,
`blocks/vehicle-matcher/modes/index.js`) and shares the shell, brand theme, engine client
and API base with the other modes. No app header, no bespoke navigation — the shell owns
switching. `mount(root, ctx)` is synchronous and fire-and-forget: it paints a skeleton now,
does network in a detached `boot()`, and swaps in real content. Per-run state lives on a
fresh local object (never on the shared `ctx`), so a re-mount from the switcher starts clean.

## 3. The decisions (locked)

1. **Champion, engine validates.** The car that wins the bracket final IS the hero at the
   reveal — always honoured, never swapped out. The real `apiMatch` call still runs, to
   attach the champion's true `reasons` and to know when to add the honest note. This is
   the one place this mode diverges from the swipe game's "engine's pick wins outright":
   here the *player's* crowned car leads, and the engine's role is to validate and explain
   it (§6).
2. **When the champion isn't fully backed** — the engine didn't return it in the feasible
   set, it scores below `WEAK_SCORE`, or there are `unmet` wants — still show the champion
   as hero, add one soft in-character "not quite" note, and *optionally* name the engine's
   own top pick as a supportive aside ("the numbers are also head-over-heels for the X").
   Celebrate anyway; never apologise, never swap the hero.
3. **Seed step, like Swipe.** Reuse the swipe seed exactly: per-brand budget bands +
   `primaryUse` tiles sourced from `apiGetQuestions` (NOT local constants), then
   `apiField` scopes the field (see below). Budget is the engine's one hard filter, so the
   field is affordable from the first round.
4. **Adaptive bracket size.** Snap the shuffled feasible pool DOWN to the largest power of
   two it can fill (capped at 16; minimum 2) — 16 → 8 → 4 → 2, with no byes and no fabricated
   cars. Both brands' live feeds are big (BMW ~38 eligible, MINI ~31), so a healthy budget
   fills a full **Round of 16**; a tight budget or a genuinely thin pool snaps down cleanly
   (8, then 4, then a lone Final). Below 2 feasible cars → the empty-pool nudge (widen the
   budget). Round names adapt: a field of 8 opens on "Quarter-final", of 4 on "Semi-final".

   > **Why a dedicated `/api/field`, not `/api/preview`.** The field is fetched from
   > `POST /api/field` (via `apiField` in `engine.js`), a sibling to `/api/preview` over the
   > same engine and the same cached retailer stock. `/api/preview` is the questions-mode
   > "best guess" *drawer* — deliberately capped at `PREVIEW_COUNT = 9` and always paint-
   > enriched. A championship wants a *roster*, not a top-9 shortlist, so `/api/field` returns
   > up to `FIELD_MAX = 16` ranked cars (server-clamped to [2, 16]) and skips paint by default.
   > This is the server half of the block's "one engine, an interface-shaped read each" seam;
   > `PREVIEW_COUNT` and the questions drawer are untouched.
5. **Lean face-off UI.** Each matchup is two clean comparison cards side by side with a
   "vs" between, plus a bracket progress rail (round name + "Match n of m") and the slim
   **form indicator** (§3.8) beneath it. Minimal chrome, emphasis on the choice — a distinct
   "versus" feel, not the swipe card stack.
6. **Taste weighted by advancement.** Head-to-head picks still become engine answer keys
   (the point of the mode), but a car's voice scales with how far it advanced: champion
   heaviest, then finalist, semi-finalist, … first-round exit lightest. This is the mode's
   one tuning surface (§5).
7. **Make a thing of the round.** Advancing must *feel* like advancing, not a label
   ticking over. Between rounds `advanceRound()` runs a **ceremony**: by default a
   full-width **inline sweep banner** (`vm-knockout-sweep`) naming the round the player is
   *entering* animates across the stage (~800ms via `--vm-ease`/`--vm-pop`), then the next
   matchup paints — no extra tap. Reaching **the Final** (2 survivors) escalates to a
   dedicated **interstitial** (`renderRoundInterstitial()`): a big "The Final", the two
   finalists shown as crests (`buildCrest`), a `celebrate` burst, and one "tap to continue"
   CTA — the climax earns the one extra tap, once. Under reduced motion (or a lone Final /
   ≤1 survivor edge case) the ceremony collapses straight to `startRound()`, so the round
   change is still legible but instant. Copy key: `roundAdvance({ round, survivors })`.
8. **Surface the engine's own signal — the "form" indicator.** `/api/field` returns a
   `score` per car that the mode used to discard when it mapped the field down to bare
   `car` objects. Now `loadField` keeps it: `state.scoreById` (keyed by `idOf`) and
   `state.bestScore` (the field's top score) are built *before* the shuffle. A slim
   labelled bar in the progress rail (`renderForm` → `formPercent()`) shows the **average
   engine-score of the cars still standing, normalised against the field's best**, so it
   climbs as the player advances the cars the engine also rates and dips when they back an
   underdog. It's honest — it's the engine's own number, not a fabricated meter — and it's
   the "make the most of the engine" beat with **zero server change** (the score was
   already in the response). Null-safe: an unscored field simply hides the bar.
   `bracketToAnswers` is unaffected — it reads the winner/loser *cars*, which still carry
   through unchanged.

## 4. Flow

1. **Seed** — budget + what's-it-for, from the engine's per-brand questions.
2. **Field** — `apiField(ctx.api, seed, retailer, brand, MAX_FIELD)` → shuffle → snap to a
   power of two (§3.4). The field plays a
   bracket: `pairUp` into round-1 matchups; each pick advances the winner and logs the
   result; when a round's matchups are exhausted, `advanceRound()` runs the **round
   ceremony** (§3.7) before its winners seed the next round; one car left → champion → result.
3. **Result** — the champion is the hero; `apiMatch(bracketToAnswers(rounds, seed))`
   supplies its real reasons and the honesty signal (§6).

## 5. Turning picks into answers — `bracketToAnswers` (in `match-signal.js`)

Same discipline as the swipe game's `swipesToAnswers` — infer only *taste* keys, err toward
**omitting** a key over guessing it, and only ever emit values observed on real cards (so
it can't emit a brand-excluded value like `saloon`/`diesel` for MINI). The difference is
weighting: each car is repeated into the "liked" bag `weight` times, where `weight = rounds
survived + 1` (a first-round loser = 1 ballot, the champion = the most). That weighted bag
runs through the **same** `likesToAnswers` machinery the swipe game uses, so there is one
inference idiom shared between the two games, not two that can drift. `budget` and
`primaryUse` come from the seed and are never touched.

## 6. The result — champion, engine validates

- **Hero** = the champion the player crowned, always.
- **Why** = the engine's real `reasons` for the champion, found by locating the champion
  inside `apiMatch`'s returned matches (by stable identity, `idOf` = PDP link). A **crown
  callback** ("it saw off three rivals to take the crown") makes it feel earned; the
  substance is the engine's, not the bracket's.
- **Honest note** (§3.2) when the engine can't fully back the crown: the champion is absent
  from the feasible set, or scores `< WEAK_SCORE`, or there are `unmet` wants. One soft
  line, plus an optional aside naming the engine's own favourite. The hero never changes.
- **CTAs**: test drive → `car.link`; full details → `car.link`; Web Share (with copy-link
  fallback) of the champion; "New tournament" → a fresh reshuffled field on the same seed.
- **Motion**: the champion card gets an `is-revealing` entrance (spring on MINI, crisp on
  BMW, via `--vm-ease`/`--vm-pop`) and the shared **`celebrate(host, { brand })`** burst
  from `match-signal.js` — the *same* crescendo the swipe reveal fires, so the two games
  can't drift (BMW measured/monochrome, MINI warm with hearts). Pick fly-out, the round
  ceremony (§3.7), the entrance and the confetti are all gated on `prefers-reduced-motion`.

## 7. Accessibility & re-mount

- The whole contender is a `<button>` (full tap target); `←`/`→` pick the left/right car.
- A `busy` lock ignores a second pick while a matchup transitions out.
- `prefers-reduced-motion` skips the fly-out, the round ceremony travel (§3.7), the
  champion entrance and the confetti (the JS commits/paints instantly — every screen stays
  legible and every round reachable).
- Re-mount safe: switching tabs re-calls `mount` and starts a clean run.

## 8. Files

```
blocks/vehicle-matcher/modes/knockout.js       # the whole mode
blocks/vehicle-matcher/modes/match-signal.js   # shared helpers + bracketToAnswers (also used by Swipe)
blocks/vehicle-matcher/modes/index.js          # registry — MODES = [questions, mingle, knockout]
blocks/vehicle-matcher/modes/engine.js         # +apiField (the roster read; sibling to apiPreview)
blocks/vehicle-matcher/vehicle-matcher.css     # a scoped .vm-knockout-* section (reuses .vm-mingle-* for card/hero/why/CTA/confetti/seed)
server/index.js                                # +/api/field (FIELD_MAX=16, opt-in colour enrich)
```

`ui.js`, `questions.js`, the engine/scoring, and `/api/preview` (the questions drawer) are
untouched. The face-off card's colour bar is best-effort: the knockout asks `/api/field`
for its 16-car roster **without** paint (`enrich` omitted) — painting all 16 would fetch a
PDP for cars that lose in round one — so `swatchFor` falls back to a neutral swatch. Any
paint that shows is a free hit on the shared, permanent colour cache warmed by the swipe
deck or the questions drawer for the same car.

## 9. Out of scope (v1)

Shared/replayable bracket links; seeding by engine rank (round-1 pairings are random from
the shuffled field); cross-session persistence; a polished BMW skin; an animated bracket-
tree visualisation (the progress rail is a round indicator, not a full tree).
