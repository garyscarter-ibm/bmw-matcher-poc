# Results page analysis — one honest frame for five states

Status: **analysis, no code.** The proposal is a restructure of the results
renderer's information architecture, not a reskin. Follows on from
[refinement-plan.md](refinement-plan.md) (the lot-walk, built) and the finding
in [refinement-audit.md](refinement-audit.md) that the decree was mostly a
tie-break. Decisions taken here: none yet — one is explicitly reserved for the
project owner (see "The positioning decision").

## The trigger

Ask Grassicks BMW for a petrol convertible, £25–60k, for fun (2026-07-22, live
stock). Grassicks holds no convertibles. The page renders:

- Headline: **"TWO OF THESE FIT YOU EQUALLY WELL"** — two M2 coupés at 75%,
  each carrying "The trade-off: a coupé, where you asked for a convertible."
- Below the fold, in a band whose lede reads **"Not quite it?"**: a Z4 M40i
  **convertible at 94%**, 18 miles away at John Clark Tayside.

Every fact on the page is true, and the hierarchy still tells the wrong story
twice over:

1. **The layout ranks cars by whose lot they're on; the scores rank them by
   fit — and the orderings disagree.** The best-fitting car on the page (94%,
   meets the stated want) is presented as an afterthought to two cars that
   don't (75%, both missing it).
2. **The tie copy overclaims.** "Fit you equally well" about two cars that
   both carry a trade-off line isn't fitting the buyer equally well; it's
   *failing* them equally well. The tie copy was written for ties among good
   fits and doesn't know the difference.

## Why it happened — the missing state

The page has framing copy for exactly two situations:

- **"You asked, we have it"** — the decree / tie headline.
- **"Nobody reachable has it"** — the SMALL SNAG / unmet note, which only
  fires when the retailer AND the nearby tier both lack the want
  (`agreedUnmet`).

Live probing (2026-07-22) showed the second state is **close to unreachable**:
both default retailers have a real gap (Grassicks no convertibles, Sytner
Luton no PHEVs), and so do the most isolated retailers findable (Falmouth,
Aberdeen, Exeter, Carlisle, Northern Ireland) — but the ~400-car nearby tier
rescued every single case, exactly as the pool analysis in
[question-stock-audit.md](question-stock-audit.md) predicted.

Which means the state that occurs **constantly** — *"we haven't got it here,
but it's 18 miles away"* — is precisely the one with no framing at all. It's
the state `agreedUnmet` deliberately suppresses, on the correct rule that we
mustn't claim scarcity the network doesn't have. We suppressed the false
message and never wrote the true one.

The root cause is older: the frame is **retailer-first** because iteration one
was a single-dealer demo. Every honesty feature since — unmet note, per-car
trade-offs, clusters, refine, reject, colour — was fitted *inside* that frame.
The frame itself encodes the stale assumption: local stock is the answer,
nearby is consolation. The audit's own doctrine ("never let the anchor
retailer's inventory hide a preference the nearby tier could honour") is
honoured in the data and violated in the layout.

## The state model

The headline should answer the question the buyer actually has: **"did you
find what I asked for, and where?"** Five states, in the order they should be
tested. "Meets the brief" = zero `tradeOffs` — the stated stock-fact wants
(fuel, body style), same scope as `unmetWants`; budget and mileage never enter
into it.

| # | State | Detection (all data already on the wire) | Headline claim | Today |
|---|---|---|---|---|
| 1 | Met here, clear winner | leads meet brief, `decisive` | "Your perfect BMW is the …" | ✅ works |
| 2 | Met here, tie | leads meet brief, `!decisive` | "It's a six-way tie" + refine | ✅ works |
| 3 | **Not met here, met nearby** | `retailerUnmet` non-empty, nearby has cars without that trade-off | **"Not here — 18 miles away"** + best-local as honest runners-up | ❌ **no framing; the common case** |
| 4 | Not met anywhere reachable | `agreedUnmet` non-empty | SMALL SNAG note | ✅ built, ~never fires |
| 5 | Nothing survives filters | `matches.length === 0` | "No matches found" | ✅ works |

Detection for state 3 is the exact complement of the machinery state 4 already
uses: `agreedUnmet` = wants both halves lack (→ state 4);
`retailerUnmet − agreedUnmet` = wants met nearby but not here (→ state 3).
Nearby responses carry `tradeOffs` per car (`publicMatch`), so "which nearby
cars actually meet the missed want, and how far" is a client-side filter — no
new endpoint, no server change.

**A distinction worth keeping sharp:** state 3 is about local *absence*
(`retailerUnmet` — the retailer has zero convertibles). A different, milder
situation is local *outranking* — the retailer HAS a convertible but coupés
scored above it. That is not state 3: the want is available locally, the
engine judged other cars closer to the whole brief, and the per-card
trade-off line already tells that story. Only pool-level absence changes the
page's frame.

## State 3, worked through

The dealership script this replicates: *"I haven't got a convertible on the
lot. These M2s are the closest here — here's why they're close. But my
colleague up the road has a Z4."*

### Layout

1. **Headline names the situation, not a false winner.** Draft copy:
   - BMW: `No petrol convertibles at Grassicks Garage right now.` — then lede:
     `The nearest is 18 miles away — and below, the closest matches here.`
   - MINI (own register, drafts): label `NOT HERE — BUT NOT FAR.` then
     `No plug-in hybrid MINIs at Sytner Luton right now. The nearest is a
     short drive — and here's the closest we've got at home.`
2. **The met-your-brief cars become first-class cards**, not carousel tiles:
   full `matchCard`s (photo, score, reasons, colour, distance + retailer made
   prominent). These are the page's real answer.
3. **Best-local renders below, honestly framed**: "Closest at Grassicks" —
   same cards they get today, with reasons (why met) and the trade-off line
   (why not quite). No tie headline over them even when they're tied: the tie
   framing belongs to cars that meet the brief. Refine/reject still apply to
   whichever group leads.
4. **"Worth the drive" carousel then only carries what's left** — nearby cars
   that *don't* meet the missed want stay where they are. The band's "Not
   quite it?" lede is correct again, because the cars that WERE it moved up.

### Two-phase load choreography

Nearby arrives late by design (slow national search; the hero must never wait
on it). So state 3 cannot be known at first paint. The rule: **the first-paint
headline must be true before and after the nearby response lands.**

- First paint (local data only, `retailerUnmet` known): render the local cards
  under an already-honest headline — BMW: `The closest at Grassicks Garage to
  your brief.` It claims nothing about the network.
- Nearby lands: upgrade in place — headline gains the fact (`No petrol
  convertibles at Grassicks right now — the nearest is 18 miles away`), and
  the met-brief nearby cards slot in above the local group. Same late-insert
  pattern the unmet note uses today (`agreedUnmet` → `unmetNote`), inverted
  polarity.
- Nearby fails/empty: the local-only headline simply stands. No claim was
  made, so nothing needs retracting — the same "absence of facts" rule
  `agreedUnmet` already follows.

States 1/2 are unaffected: when the leads meet the brief, first paint is
already the final frame.

## The positioning decision (owner's call, not taken here)

In state 3 the better-fitting car is usually at a **different dealer group** —
John Clark's Z4 promoted above Grassicks' own stock on what is notionally
Grassicks' page. Two readings:

- **Brand-first (recommended for this POC):** the tool is BMW-facing; the
  network is the inventory; honesty about where the car is *is the product*.
  This is the layout above.
- **Retailer-first:** the anchor retailer's stock always leads; nearby stays a
  clearly-labelled second section, but state 3 still gets the honest headline
  and the carousel promotion — the difference is only which group renders
  first.

Either way the *copy* tells the truth; the choice is purely which cards sit
higher. A real multi-tenant deployment would likely make this a per-retailer
config. **Decision needed before build.**

## Element-by-element audit of today's page

What the rebuild keeps, moves, rewrites, or retires:

| Element | Verdict |
|---|---|
| Kicker "Your results" | Keep. |
| Decree headline | Keep — but gate on state 1, i.e. on *fit + decisive*, not decisive alone. Today a decisive winner that misses the brief still gets "Your perfect BMW", contradicted by its own trade-off line two inches down. |
| Tie headline + lede | Keep for state 2 only. In state 3 the tied-locals group gets a section label, not the page headline ("fit you equally well" must never sit above cards carrying trade-offs). |
| Unmet note (SMALL SNAG) | Keep, state 4 only. Becomes one branch of the same upgrade slot state 3 uses — one insertion point, two polarities. |
| Refine panel (chips) | Keep; applies to whichever group leads the page. Open question, deliberately deferred: refine on decisive pages too? Today chips exist only in ties — defensible (nothing to separate), revisit with user feedback. |
| Reject ("Not this one") | Keep, and **fix the inconsistency: it exists only in ties.** A decisive hero can't be rejected today. In the new frame, every full card offers it, decree included — rejecting the decree is exactly the signal that the decree was wrong. |
| Per-card reasons + trade-off + swatch | Keep everywhere full cards render (the trade-off's `big`-only gating was already widened to all lead cards). |
| "MORE AT <retailer>" band | Rewrite. Today it holds non-tied locals with no explanation of why they rank below. In the new frame it's the "closest here" group of state 3, or the runners-up of states 1–2, and its lede should say which. |
| "WORTH THE DRIVE" carousel | Keep, but it only carries nearby cars that *don't* resolve a missed want (those move up in state 3). Its "Not quite it?" lede is then accurate in every state. |
| Share / tweak / start over | Keep as-is. |
| Disclaimer | Keep as-is. |

## Build order

1. **State detection + headline switch** — pure client logic over data already
   on the wire (`decisive`, lead `tradeOffs`, `retailerUnmet`, nearby
   `tradeOffs`/`unmet`). The five-state test, in order, in one place.
2. **State 3 layout** — promote met-brief nearby cars to full cards; demote
   the tie headline to a section label over the local group; the upgrade-slot
   choreography above.
3. **Consistency fixes that ride along** — reject on every full card; fit-gate
   the decree; per-state ledes for "More at" and "Worth the drive".
4. **Re-verify states 1/2/4/5 didn't move** — the tie/refine/reject journeys
   and the SMALL SNAG path all have known-good deep links from this session's
   screenshots to compare against.

Nothing here needs a server change or a new endpoint. The rebuild is one
renderer (`renderResults` + the band fillers) reorganised around the state
test, reusing every existing component.

## Risks

- **The overhaul trap.** The current page carries verified behaviour that a
  blank-sheet rewrite would silently drop: skeletons, two-phase load, share
  links, refine/reject state, per-brand voices, empty states, EDS block
  constraints. The build order above deliberately restructures around the
  existing components rather than replacing them.
- **State flapping.** The late upgrade must only ever *add* (a fact line, a
  group of cards above) — never re-sort or remove what the user is already
  reading. First-paint copy that is true in all outcomes is the mechanism.
- **Tone drift.** State 3 copy is new for both brands; it must come from
  [tone-style-guide.md](tone-style-guide.md) registers, not invented ad hoc —
  BMW states the fact flat, MINI shrugs warmly. Drafts above are placeholders
  until passed through that filter.
