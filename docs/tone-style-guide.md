# Tone & style guides (BMW + MINI)

The matcher is multi-brand. Each brand has its own voice, applied to the quiz
copy per brand (see the per-brand copy overrides in `server/questions.js`,
selected by `questionsForBrand(brand)`). The **BMW/Grassick** guide is below;
the **MINI/Sytner Luton** guide follows it. Companion to
[design-tokens.md](design-tokens.md), which covers the visual system —
this covers the words.

---

# Grassick's (BMW) tone & style guide

Extracted from `grassicksbmw.co.uk` (homepage copy, offer blurbs, section
intros) to bring the matcher's wording in line with how a real BMW retailer
site talks to customers.

## Voice in three words

**Direct. Warm. Understated.** Confident about the product, modest about
itself. It never has to try hard to sound exciting — the cars do that.

## What Grassick's copy actually does

Reading the homepage top to bottom:

- **Headings are short noun phrases in sentence case**, not questions or
  jokes: "NEW CAR LOCATOR.", "EXPLORE OUR RANGE.", "BUSINESS AND FLEET."
  (the site sets these in caps via CSS `text-transform`, but the underlying
  copy is plain sentence case, not written-in-caps or title case).
- **CTAs are two or three words, verb-first, no exclamation marks**: "Search
  Now", "View offer", "Read more", "Find out more", "Contact us", "Book an
  appointment". No "Let's go!", no "Get started →", no filler.
- **Body copy is plain-spoken and factual first, benefit second.** E.g. "Save
  up to 40% on parts required when your car is serviced or repaired by us."
  States the fact, then who it's for. Doesn't lead with a hook.
- **Warmth shows up in short, sincere asides, not jokes.** "We hope to
  welcome you soon", "Our friendly staff are here to answer your
  questions", "leave the admin to us and skip to the best bit". This is the
  only place the copy allows itself a touch of personality — and even then
  it's earnest, not witty.
- **No wordplay, no puns, no rhetorical questions used for flourish.** The
  copy never asks "Wondering what to do next?" or similar — it just tells
  you the next step.
- **Numbers and specifics carry the excitement**, not adjectives: "up to
  500 miles range", "4.9 secs", "40% off parts", "3 years' free servicing".
  Superlatives are backed by a stat, not asserted alone.
- **Legalese is fenced off**, not woven in: footnote markers (¹) and a
  dense small-print block at the very end. The main copy stays clean; the
  caveats live separately.
- **Local and human**: names actual towns ("Perth, Blairgowrie, Cupar,
  Crieff and Auchterarder"), refers to "our friendly staff", signs off
  person-to-person rather than corporate ("We hope to welcome you soon").

## What this means for matcher copy

The matcher's current copy ("Wafting or carving?", "Maximum attack",
"Surprise me", "I'm ready") is chattier and more quippy than anything on
Grassick's — closer to a lifestyle-brand quiz than a dealership tool. Bring
it in line:

1. **Turn quiz questions into plain statements or the mildest possible
   question, not personality-driven one-liners.** "Wafting or carving?"
   becomes something a Grassick's page would actually print: "Comfort or
   sportiness?" — the choice stated, not performed.
2. **Option labels state the fact, not a persona.** "I'm ready" →
   "Fully electric". "Maximum attack" → "Maximum sportiness". Keep `sub`
   text factual and short, the way the site's card copy works.
3. **CTAs stay two—three words, verb-first, sentence case, no
   exclamation marks.** "Start the quiz" and "See my matches" already fit
   this; keep new copy to that length and register.
4. **Keep one warm, sincere line, not more.** Grassick's allows itself
   exactly this much personality per section. The matcher's intro lede is
   the right place for it — factual first ("Answer N quick questions..."),
   one small human touch, not a joke.
5. **No rhetorical flourishes or jokes in headings.** Drop "That's a tough
   brief…" style phrasing in favour of a plain statement of what happened
   and what to do next.
6. **Keep disclaimers/legal copy fenced off at the bottom**, factual and
   plain, exactly as the matcher already does with `.bmwm-disclaimer`.

---

# MINI (Sytner Luton) tone & style guide

Observed from `sytnerlutonmini.co.uk` (homepage, about, finance). MINI's voice
is the near-opposite of BMW's understatement — where BMW lets the cars do the
talking, MINI *performs*. This is the register the MINI quiz copy adopts.

## Voice in three words

**Playful. Spirited. Iconic.** Cheeky and warm, leaning on MINI's "go-kart"
character and heritage. It has fun with the words — but stays clear, never
cryptic.

## What MINI's copy actually does

- **Headings are UPPERCASE with a full stop**: "FIND YOUR MINI.", "SYTNER
  LUTON.", "WHY MINI?", "ALL IN. SIMPLY SMART." The full stop is a MINI
  signature — a confident little beat, not a shout.
- **Short, punchy declaratives** with personality: "Look who's gone electric.",
  "The original reborn.", "Meet the ace in the pack.", "Powered up icon." One
  idea per line, landed with a full stop.
- **"go-kart" is the core brand metaphor** — agility, fun, cornering. "Turning
  a new corner go-kart style.", "From speed bumps to mountain peaks." Driving a
  MINI is framed as a *feeling*, not a spec.
- **Heritage + character words**: "icon", "original", "free spirit", "reborn",
  "ace". MINI sells identity and joy, not refinement or status.
- **Warm and human**, like Grassick's, but wittier — it allows itself a wink
  where BMW stays earnest.
- **Numbers still stated plainly** for prices/finance ("From £26,905 OTR*") —
  the play is in the framing, not the facts.

## What this means for MINI matcher copy

1. **Titles become UPPERCASE-with-a-full-stop and gain a bit of cheek** where it
   fits: "What's your budget?" → "WHAT'S THE DAMAGE?"; "Comfort or sportiness?"
   → "HOW DO YOU LIKE TO DRIVE?" Still a clear question, just in MINI's voice.
2. **Option labels lead with character, keep the meaning obvious.** "Weekend
   driving" → "Weekend fun"; "Maximum sportiness" → "Full go-kart"; "City
   driving" → "Nipping round town." The value it maps to is unchanged.
3. **`sub` lines can be playful** ("go-kart grins on your favourite B-road")
   rather than purely factual, but never at the cost of clarity.
4. **Keep it kind and inclusive**, not laddish — MINI is joyful, not aggressive.
5. **BMW copy is untouched** — these two voices live side by side, chosen by the
   configured brand. Meaning and answer values are identical across both so the
   shared scoring engine is unaffected; only the words change.
