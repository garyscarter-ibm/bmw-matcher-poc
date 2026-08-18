# Podium requirements

**An everything-on-screen interface mode: answer on the left, watch a live ranked podium re-order on the right.**

| | |
|---|---|
| Status | Building |
| Mode key | `podium` |
| Switcher label | `Podium` (neutral, brand-agnostic tab); the campaign wordmark lives inside the stage in `PODIUM_COPY`, same convention as Swipe's §9 and Head to head |
| Brand | brand-agnostic by design: `mini`, `bmw`, `honda`, `ford`, `motorrad`, `ferrari`, each with its own `PODIUM_COPY` entry and a `bmw` fallback |
| Depends on | the shared engine (`server/`, via `blocks/vehicle-matcher/engine.js`), the shared render modules (`modes/brand-copy.js`, `modes/result-card.js`, `modes/question-ui.js`, `modes/preview-feed.js`) and `celebrate()` from `modes/match-signal.js` |
| Siblings | the questionnaire (**not** replaced by this), the swipe game ([`mini-mingle-requirements.md`](./mini-mingle-requirements.md)) and the knockout ([`mini-knockout-requirements.md`](./mini-knockout-requirements.md)) |
| Sources | the PRD's "Page 1, Questionnaire" (`mini-matcher-requirements.md`) and its clickable prototype, re-specified for this repo's architecture |

---

## 1. What this is

The source PRD described its first page as a two-pane questionnaire: every question
in a fixed left pane, and a **live, always-visible ranked shortlist** in the right
pane, presented as a **podium**. A hero first place, two runners-up beneath it, then
an "also worth a look" tail. A "Find my perfect match" button commits the brief with
a burst of confetti, and every card carries a "Not this one" dismissal.

The repo already has a `questionnaire` mode, and it is **not that interface**. It asks
one question at a time and then hands off to a deep refinement results page:
`renderRefine`, six result states (`empty`, `weak`, `closest`, `decree`, `taste`,
`tie`), deep-linked answers and a nearby-retailer search. Both shapes are legitimate,
and they serve different people: one is a considered path with a rich destination, the
other is a glanceable surface where the answer is on screen from the first paint and
improves as you fill the brief in.

So `podium` is a **fourth sibling**, not a rewrite:

```
MODES = [questionnaire, mingle, knockout, podium]
```

It obeys the same core rule as the other three:

> **The interface is only an input method; the real engine does the matching.**

Nothing here scores a car. The left pane collects the same answer keys
(`server/questions.js`), the right pane renders what `/api/preview` and `/api/match`
return, and every claim on screen is one the engine made.

## 2. It's a mode, like the others

Mounts through the mode contract (`{ key, label, mount(root, ctx) }`,
`blocks/vehicle-matcher/modes/index.js`) and shares the shell, brand theme, engine
client and API base with the other modes. No app header, no bespoke navigation: the
shell owns switching, and `?mode=podium` works the moment the array entry lands.
`mount(root, ctx)` is synchronous and fire-and-forget. It paints the two-pane
skeleton now, fetches the question set in a detached `boot()`, and swaps in real
content. Per-run state (answers, the last preview, the dismissed set, the commit
flag) lives on a fresh local object, never on the shared `ctx`, so a re-mount from the
switcher starts clean.

Layout is a CSS grid the mode owns: one column on mobile (questions above, podium
below), `minmax(280px, 320px) 1fr` at 720px and up, opening to
`minmax(320px, 360px) 1fr` with a wider seam at 1080px. The shell contributes no
layout, exactly as with Swipe and Head to head.

Every pixel the block's own column gained beyond the brief's measure goes to the
**results** pane, not the brief: the brief is eight short questions in one column and
reads worse the wider it gets, while the podium is the mode. At the block's 1184px
content column that leaves the pane ~784px, which is what makes the row layout in §5
possible.

## 3. The decisions (locked)

1. **Sibling, not a replacement.** The `questionnaire` mode is untouched. It keeps
   deep-linking (`#m=`), `renderRefine`, the six result states and the nearby search;
   podium ships none of them (§9). Podium is the lighter always-on surface: less
   destination, more dashboard.

   > **Why a fourth mode, not a rewrite of the third.** The two interfaces disagree
   > about what a result *is*. The questionnaire treats it as a page you arrive at,
   > with room to explain a tie, a trade-off or an empty pool; podium treats it as a
   > live readout that must stay legible while the brief is still half-filled. Folding
   > both into one file would mean a mode that is two products behind a flag, and it
   > would put the questionnaire's shipped, tested result states at risk for a
   > feature nobody asked to change. The mode seam exists precisely so a second
   > opinion about the interface costs one file and one array entry.

2. **Live and debounced, and live from the first paint.** Every answer change
   re-scores via `POST /api/preview` through a shared scheduler: a 250ms debounce
   with a latest-wins sequence guard, so a fast run of taps issues one useful request
   and a slow response can never overwrite a newer one. Crucially there is **no
   placeholder state**: `renderRangeSlider` persists its starting value immediately,
   and a valid budget is all `/api/preview` requires, so the podium is populated on
   the very first paint and only sharpens from there.

   > **Why no "answer three questions to see results" gate.** The PRD's whole
   > progressive-reveal principle is that the shortlist is a *reaction*, and a reaction
   > you have to earn is just a results page with extra steps. Because budget is
   > answered by default, there is nothing to gate: the first podium is the honest
   > answer to "everything in your price range", and each subsequent answer visibly
   > moves it. An empty right pane on load would teach people the panel is decorative.

3. **The commit beat is real, not decorative.** `/api/preview` carries `score`,
   `reasons`, `tradeOffs`, `listings` and `stretch` (it returns `publicMatch` objects),
   but it does **not** carry `unmet`, `decisive`, `clusterSize` or `alternatives`.
   Those come only from `matchCars`, via `/api/match`. So the CTA is a genuine second
   call: it fetches `/api/match`, upgrades the hero card to show the engine's real
   "why it suits you" reasons, fires `celebrate()`, and enables the honest note. See §5.

   > **Why a button at all, when the podium is already live.** Because the two
   > endpoints know different things. Without the commit call there is no `unmet` set
   > and no `decisive`/`clusterSize`, which means no honest note and no exact tie check
   > (§3.5). The button is not a submit; it is the moment we stop guessing and ask the
   > engine the full question. That it also earns the confetti is a bonus, not the
   > reason.

4. **Grouped preview, opt-in at the server.** `/api/preview` gains a `group` boolean
   (default `false`). When set, the handler ranks the full pool, runs the existing
   `groupListings`, and only then slices to `PREVIEW_COUNT = 9`. Podium passes
   `group: true`; the questionnaire drawer passes nothing and is bit-for-bit unchanged.

   > **Why the server, not a client de-dupe.** `/api/preview` is ungrouped today
   > because the questionnaire's preview strip is a horizontal glance where three
   > listings of the same model reads as availability. A podium of three medals reads
   > as three *choices*, so gold, silver and bronze all being the same Countryman in
   > different colours is a lie the layout tells. De-duping on the client would mean
   > slicing after the cut and sometimes rendering four cards where seven were asked
   > for. Grouping before the slice is the only way to get nine distinct models, and
   > an opt-in flag mirrors the `enrich` precedent already on `/api/field`: one engine,
   > an interface-shaped read each.

5. **The podium must not fake a ranking.** Medals assert a strict 1 > 2 > 3, and the
   engine frequently returns cars it considers level (this is why the questionnaire has
   a whole `tie` state and why `CLUSTER_PTS = 3` exists). When the top cars fall within
   `CLUSTER_PTS` of each other, render them as **joint first**, a shared gold row rather
   than a fabricated silver and bronze, and use the `tiedTitle` / `tiedLede` copy already
   in `BRAND_COPY`. In the live state the check is inferred from the returned `score`
   values; in the committed state `/api/match` supplies `decisive` and `clusterSize`, so
   the check is exact.

   > **Why joint first, not "close enough".** A medal is a claim of difference. Awarding
   > silver to a car the engine rates identically invents a distinction the buyer will
   > act on, and it is the same failure as a chart with a truncated axis. This is the
   > discipline the other modes already keep: the knockout's verdict tag returns nothing
   > when the two scores are level, and the swipe result refuses to promote a car the
   > engine did not return. A podium that sometimes says "these two, equally" is more
   > useful than one that always ranks.

6. **All questions at once, but the quiz stays reactive.** The PRD assumed a fixed set
   of eight questions. The real question set is brand-dependent and has conditionals:
   `SHOW_IF.charging` appears once an electrified fuel is picked, `SHOW_IF.doors` once a
   hatchback is. After every answer change the pane recomputes `visibleQuestions` and
   **inserts or removes those blocks in place**. The progress denominator is the live
   visible count, never a hardcoded 8.

   > **Why insert in place, not rebuild the pane.** A rebuild is one line of code and it
   > throws away scroll position and focus, which on a long single-scroll pane means the
   > act of answering a question can move the next one out from under the reader's thumb.
   > It also re-triggers every block's entrance animation on every tap. Splicing one block
   > in or out is the only version that behaves.

7. **Reuse, not a second card.** The pieces both modes need were lifted out of
   `questionnaire.js` first, as a behaviour-preserving refactor proved green before a
   line of podium code was written: `modes/brand-copy.js` (`BRAND_COPY`, `TRADE_COPY`,
   `UNMET_PHRASES`, the list helpers), `modes/result-card.js` (`matchCard`, `previewTile`,
   `mediaWell`, the spec and swatch tables), `modes/question-ui.js` (`visibleQuestions`,
   `renderRangeSlider`, a factored-out `renderOptionList`) and `modes/preview-feed.js`
   (the debounce and latest-wins guard as a `createPreviewFeed()` factory).

   > **Why extract rather than copy, when the games did copy.** Swipe and Head to head
   > own their cards deliberately: a swipe card and a face-off card are different objects
   > with a different voice, and sharing them would have forced a lowest common
   > denominator. Podium renders the *same* card as the questionnaire, in the same voice,
   > down to the trade-off labels and the reject hints. Two copies of that would drift
   > within a sprint, and the drift would show up as two brands' worth of copy fixes
   > landing in one file and not the other. The one real refactor was
   > `renderRangeSlider`, which called `schedulePreviewRefresh(ctx)` inline; it now takes
   > an injected `onChange`, so the questionnaire passes its scheduler and podium passes
   > its repaint.

8. **"Not this one" is load-bearing, not theatre.** The PRD's two-step popover ships,
   but every branch writes back to a **real answer key** and re-runs the debounced
   preview, so dismissing a card visibly re-ranks the podium (§6). And the mode only
   ever offers a branch that can change the result **for that brand**: MINI drops the
   `mileage` question in `brands.js`, so MINI must not offer Mileage.

   > **Why not just hide the card.** A dismissal that only removes a tile teaches the
   > buyer that the panel is a shortlist they curate, then contradicts itself the moment
   > the next answer brings the car back. Worse, offering a "too expensive" branch that
   > has nowhere to write is a button that does nothing while looking like it did
   > something. Same rule as the knockout's stat rows, which return `null` when the
   > metric is missing rather than printing a zero.

## 4. Flow

1. **Mount** paints the two-pane skeleton and returns. `boot()` fetches
   `apiGetQuestions(ctx.api, ctx.retailer, ctx.brand)`.
2. **Left pane** renders the progress bar, a banner, one block per visible question and
   the commit CTA. The budget slider persists its default on render, which is enough to
   score.
3. **Right pane** paints its first podium immediately from a grouped `/api/preview`:
   gold hero, silver and bronze, then up to four "also worth a look" cards.
4. **Every answer change** recomputes visibility (§3.6), schedules a debounced preview
   (§3.2) and repaints the podium in place.
5. **Commit** calls `/api/match`, upgrades the hero, fires the confetti and enables the
   honest note (§5).
6. **Editing after commit** drops straight back to the live state and re-arms the CTA.

## 5. Live scoring and the commit beat

Two states over **one layout**, so committing does not reflow the pane under the
reader.

**Live (pre-commit)**, from grouped `/api/preview`:

- Gold: `matchCard(m, { brand })` inside a `.vm-podium-gold` frame.
- Silver and bronze: two `matchCard(m, { compact: true })`.
- Tail: up to four more compact cards under the "also worth a look" heading.
- Joint first when the leaders are within `CLUSTER_PTS` (§3.5).
- Every card carries the dismissal control (§6).

**Committed (post-CTA)**, from `/api/match`:

- The hero upgrades to `matchCard(m, { big: true })`, which is what surfaces the
  engine's real "why it suits you" reasons. This is the visible payoff for pressing the
  button, and the reason the button is honest.
- `celebrate(screen, { brand })` from `match-signal.js`, the same shared burst the swipe
  reveal and the knockout champion fire, so the three modes cannot drift. Gated on
  `prefers-reduced-motion`.
- **The honest note** fires here and only here: `unmet` wants, or a hero scoring below
  `WEAK_SCORE`, get one soft in-character line reusing the existing `UNMET_PHRASES` and
  `weakTitle` copy. Never an apology, never a per-card label.
- The CTA relabels (`commitDone`) and goes inactive.
- **Answers stay editable.** Changing anything returns to the live state and re-arms the
  CTA. The PRD's dead-end button was a prototype artefact; a live panel whose controls
  stop working is a bug wearing a feature's clothes.

The medal treatment comes from `--vm-accent` / `--vm-accent-spot` weight and card
elevation, not literal gold, silver and bronze hex, which would fight every brand theme
(see [design-tokens.md](./design-tokens.md)).

## 6. "Not this one"

The PRD's floating two-step popover, rendered through `matchCard`'s existing
`rejectOptions` / `rejectLabel` / `rejectPrompt` hook, so the card builder needs no
signature change.

- **Step 1**: up to six reasons. Price, Fuel type, Colour, Size, Mileage, Just not for me.
  Cancel restores the card untouched.
- **Step 2 (forked)**: the card fades to about 0.25 opacity (it is committed to the
  dismissal) and the popover shows a reason-specific follow-up. Each writes somewhere real:

| Reason | Writes to |
|---|---|
| Price | `answers.budget`, via the shared `renderRangeSlider` |
| Fuel type | `answers.fuel` |
| Size | `answers.bodyStyles` |
| Mileage | `answers.mileage` |
| Colour | a client-side shade filter over the returned pool, reusing the `shadeOf` / `c:<shade>` axis idiom, because there is no colour answer key |
| Just not for me | nothing; dismisses that one card |

- **Only offer a branch that can move the result for this brand** (§3.8). Build the reason
  list from the brand's live question set, not a constant.
- **Done**: the card fades to 0 and scales to 0.93 over 350ms, then hides, and the answer
  edit fires the debounced repaint, so the podium re-ranks a beat later. The re-rank is the
  point; the fade is just the handover.
- Outside-click, Back and `Esc` all restore the card fully.

## 7. Accessibility & re-mount

- The popover is `role="dialog"`, traps focus while open, closes on `Esc` with the card
  restored, and is clamped to the viewport rather than allowed to overflow off-screen.
- Question blocks are the existing option-list and slider controls, so keyboard and
  screen-reader behaviour is inherited from the questionnaire rather than re-invented.
- Inserting or removing a conditional block preserves scroll and focus (§3.6).
- The debounced feed cancels in flight on unmount, and the sequence guard means a late
  response for an older brief is discarded rather than painted.
- `prefers-reduced-motion` kills the confetti, the card fade and the re-rank transition.
  Every state stays reachable and legible; the JS commits and paints instantly.
- Re-mount safe: switching tabs re-calls `mount` and starts a clean run.

## 8. Files

```
blocks/vehicle-matcher/modes/podium.js         # the whole mode
blocks/vehicle-matcher/modes/brand-copy.js     # shared voice, lifted from questionnaire.js
blocks/vehicle-matcher/modes/result-card.js    # shared matchCard/previewTile/mediaWell, lifted
blocks/vehicle-matcher/modes/question-ui.js    # shared visibleQuestions/renderRangeSlider/renderOptionList
blocks/vehicle-matcher/modes/preview-feed.js   # shared debounce + latest-wins scheduler (createPreviewFeed)
blocks/vehicle-matcher/modes/match-signal.js   # celebrate() for the commit burst (shared with Swipe/Head to head)
blocks/vehicle-matcher/modes/index.js          # registry: MODES = [questionnaire, mingle, knockout, podium]
blocks/vehicle-matcher/engine.js               # apiPreview gains the opt-in `group` flag
blocks/vehicle-matcher/vehicle-matcher.css     # a scoped .vm-podium-* section (reuses .vm-card-*/.vm-score/.vm-slider*/.vm-option/.vm-reject-*)
server/index.js                                # /api/preview honours `group`: groupListings before the PREVIEW_COUNT slice
server/test/render.test.js                     # 'podium' in MODES; the new client files in CLIENT_FILES
```

`ui.js`, the engine and its scoring are untouched, and so is every existing
`/api/preview` caller: the flag defaults to `false`, so the questionnaire drawer sends
and receives exactly what it did before.

## 9. Out of scope (v1)

Deep-linking and shared `#m=` links (the questionnaire keeps those, and they encode its
answer shape); the nearby-retailer search; the `renderRefine` chip refinement system and
its six result states; "Saved for later" and any cross-session persistence; a "hear us
out" second chance for a dismissed car the engine still rates highly; and any vehicle
photography beyond what the live feed returns.
