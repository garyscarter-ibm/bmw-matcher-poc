# Merge plan: `origin/main` into `russ-playground`

Recon banked 2026-09-04. **The merge has NOT been started.** Working tree is clean,
nothing pushed, no PR opened. This file is the intel needed to do the merge; read it
first and resume from the checklist at the bottom.

## Situation

- Branch `russ-playground` is **227 ahead / 17 behind** `origin/main`. Local `main`
  already equals `origin/main`, so no fetch/pull of `main` is needed.
- Merge base: `e0d6329735c3817388ec89dce85571f79d01b073`.
- Dry-run merge (`git merge-tree --write-tree`, read-only, tree `3fc59baf64b14d689957d0621e86a9091675899e`)
  reports **four conflicts**: `README.md`, `blocks/vehicle-matcher/modes/podium.js`,
  `index.html` (content), `homepage.html` (modify/delete).
- **Auto-merging** (the dangerous set, because a clean textual merge can be
  semantically broken with no error): `.gitignore`,
  `blocks/vehicle-matcher/engine.js`, `modes/knockout.js`, `modes/mingle.js`,
  `blocks/vehicle-matcher/vehicle-matcher.css`.
- The 17 commits on main that create the risk: `a16f218` rename mode keys;
  `1cdaa4b` extract design tokens to `tokens.css` + brand-accent picker;
  `ba45c4c` shorten/reorder MINI podium questions + single-choice selected state;
  `a994385` add `CLAUDE.md`, refresh README for 6 brands and 4 modes;
  `313594a` serve the homepage at `/`, skip the localhost login, fix the podium reject chip.

Recon was six read-only agents in two sequential batches of three (concurrency 3 per
the standing rule); all six banked. Their findings follow verbatim.

---

## homepage.html modify/delete conflict

### What main did

313594a (the ONLY commit that touched homepage.html on main) did not delete it — it RENAMED it. `git diff --stat -M e0d6329:homepage.html origin/main:index.html` reports `homepage.html => index.html | 50 insertions(+), 20 deletions(-)`, i.e. main's `index.html` IS the branded homepage/picker. The same commit renamed the old bare EDS harness `index.html` -> `block.html`. So `/` now serves the branded homepage on both hosts. `scripts/serve.js` is byte-identical on both sides (`git diff origin/main HEAD -- scripts/serve.js` is empty) and needed no change — its directory handler already does `filePath = join(filePath, 'index.html')`. Main's own edits inside the renamed file: a `main { max-width: 1280px }` page surface, a new `brandAccent(key)` helper that reads `--vm-accent-spot` off a hidden `.vm.vm-<brand>` probe, `tile.style.setProperty('--tile-accent', ...)`, removal of `.demo-picker-head`/`.demo-picker-note`, `pageIsLocal` added to the up-front-password bypass, and every `index.html` mention in comments re-pointed to `block.html`. d0cbaf8 "Removed junk files" is irrelevant here and is NOT on main — `git merge-base --is-ancestor d0cbaf8 origin/main` returns NO; it is a branch commit that deleted only hello-gary.md and hello-gary-2.md.

### What the branch did

The branch's entire delta to homepage.html is 26 lines in one place: the retailer-name copy fix (commits e957c21, 490a250, both 2026-09-02). It rewrote `BRAND_RETAILER_NAMES` so `bmw: 'Grassicks BMW'` -> `bmw: 'BMW Approved Used'` and `mini: 'Sytner Luton MINI'` -> `mini: 'MINI Approved Used'` (homepage.html:182-184), deleted the whole `RETAILER_NAMES = { 96: 'Grassicks BMW', 92: 'Sytner Luton MINI' }` id->name map, dropped `|| RETAILER_NAMES[retailerOverride]` from the precedence chain at homepage.html:357, kept `BRAND_RETAILER_IDS = { bmw: '96', mini: '92' }` at :193, and rewrote two comment blocks to justify it ("BMW and MINI walk the whole national feed (nationalStock in server/stock.js), so naming one dealer would claim a pool that was never searched"). NOTHING else. Grepping the branch's homepage.html for guess|scope|geocode|card|mingle|knockout finds zero hits — no Guess Who wiring, no `?scope=` passthrough, no Scope config row (renderShell authors only Brand / Retailer ID / Retailer Name / Title at :301-305). All the branch's real scope work went into index.html (the harness) on 2026-09-04, not here.

### Collisions (5)

#### `homepage.html`:1 - duplicate-definition - **BREAKS SILENTLY**

merge-tree's own message is "Version HEAD of homepage.html left in tree" — the DEFAULT resolution keeps the branch's file. Meanwhile .github/workflows/pages.yml is untouched on the branch (`git diff --quiet e0d6329 HEAD -- .github/workflows/pages.yml` passes) so it auto-merges to main's line 57 `cp -R index.html block.html blocks assets _site/`, which does not copy homepage.html. Result: the repo carries two 487/517-line branded homepages (homepage.html and index.html) that are 87% identical, only one of which is served or deployed.

**Resolution:** Run `git rm homepage.html` as part of the merge resolution. Do not leave it to the default.

#### `index.html`:170 - semantic-only - **BREAKS SILENTLY**

I simulated the index.html 3-way merge with `git merge-file --diff3` on /tmp copies (base=e0d6329:index.html, ours=origin/main:index.html, theirs=HEAD:index.html). It yields 4 conflict hunks, but `const BRAND_RETAILER_NAMES = { bmw: 'BMW Approved Used', mini: 'MINI Approved Used', ... }` lands at merged line 369 OUTSIDE every conflict marker (hunk 3 ends at 368, hunk 4 starts at 377) — git auto-merges the branch's values into MAIN'S HOMEPAGE document, because both sides descend from the same base text and share the identical surrounding lines. `const getRow = (label) => findRow(label)?...` also auto-merges in at merged line 308. Whoever resolves the four visible hunks will never see these and will assume both sides agreed. Main's homepage then renders `renderShell`'s Retailer Name row (main index.html:306 `const retailerName = BRAND_RETAILER_NAMES[brandKey]`) as 'BMW Approved Used' while `retailerId` is '96' and no Scope row is authored, so resolveScope() returns DEFAULT_SCOPE.

**Resolution:** After resolving index.html, explicitly re-check the auto-merged region: restore main's `bmw: 'Grassicks BMW'` / `mini: 'Sytner Luton MINI'` and main's `RETAILER_NAMES` map + `|| RETAILER_NAMES[retailerOverride]` precedence line, and delete the orphaned `getRow`/`findRow` helpers unless you deliberately port the full scope treatment. Treat main's stage-2 index.html as a whole document to keep, not a file to line-merge.

#### `homepage.html`:183 - semantic-only - **BREAKS SILENTLY**

The branch's homepage.html copy fix is superseded by the branch's own later thinking and is now wrong. `DEFAULT_SCOPE = 'dealer'` in blocks/vehicle-matcher/vehicle-matcher.js:155 landed in 6dc363f on 2026-09-04; homepage.html was last edited 2026-09-02 (490a250). With no Scope row authored (homepage.html:301-305) and retailerId '96', the block searches ONE forecourt while the copy says 'BMW Approved Used'. The branch's index.html:170-196 — written 2026-09-04, after DEFAULT_SCOPE — names this exact failure: "a dealer pool labelled 'BMW Approved Used', implying twelve thousand cars when it searched forty-one", and solves it properly with `const scope = params.get('scope')...? 'national' : 'dealer'` (index.html:151), `DEALER_NAMES = { 96: 'Grassicks Garage', 92: 'Sytner Luton' }` (:182), and `poolName` (:188-196). So there is nothing worth rescuing from homepage.html; main's 'Grassicks BMW' is the CORRECT label for the default dealer scope.

**Resolution:** Carry nothing across from homepage.html. If the homepage should also become scope-aware, do it as a follow-up by porting index.html:138-196 (findRow/getRow/scope/DEALER_NAMES/poolName) into main's index.html renderShell — not by preserving the Sep-2 half-fix.

#### `block.html` - stale-doc - **BREAKS SILENTLY**

block.html exists only on main (`ls /Users/usget/Claude/vehicle-matcher/block.html` -> No such file), so it merges in as main's version with no conflict at all. Its line 81 reads `Keys: questionnaire, swipe, head-to-head, podium.` — four keys. The branch's modes/index.js exports `MODES = [questionnaire, mingle, knockout, podium, guessWho]` (five), and the key STRINGS disagree: branch has 'mingle'/'knockout'/'card', main has 'swipe'/'head-to-head' (a16f218). Whatever the modes/index.js resolution decides, this doc line is wrong and nothing will flag it.

**Resolution:** After the modes/index.js key-name resolution is settled, update block.html:81 to the surviving five keys. Note the branch's Guess Who key is the string 'card', not 'guess-who'.

#### `index.html`:80 - textual-conflict - visible

The branch's harness delta belongs in block.html, not index.html, and one hunk of it overlaps main's block.html edit. Branch index.html:80-94 adds `?scope=dealer|national — that retailer's forecourt, or the whole network (BMW/MINI only; default dealer)` to the query-string doc comment and rewrites the "No Mode row is authored here on purpose" paragraph to "No 'Mode' or 'Scope' row"; main's block.html:80-81 changed the adjacent `?mode=<key>` line to add `Keys: questionnaire, swipe, head-to-head, podium.` Same paragraph, both sides. Base index.html vs main block.html is only 33 changed lines (max-width 880 not 1280, that mode-keys line, and the pageIsLocal/apiIsLocal gate), so the other ~75 lines of the branch's harness delta apply to block.html without contest.

**Resolution:** Apply `git diff e0d6329 HEAD -- index.html` to block.html by hand, keeping main's `Keys:` line and inserting the branch's `?scope=` line above it; then extend the key list per the block.html finding above.

### Recommendation

ACCEPT MAIN'S DELETION. Nothing needs carrying across, and nothing needs de-referencing.

1. `git rm homepage.html` explicitly during the merge. merge-tree says "Version HEAD of homepage.html left in tree", so doing nothing is doing the wrong thing — you get an undeployed 487-line duplicate of index.html that pages.yml never copies and no test covers.

2. Rescue list from homepage.html: empty. Its only delta is the 2026-09-02 retailer-name copy fix, and that fix is a regression under the branch's own `DEFAULT_SCOPE = 'dealer'` (added 2026-09-04, two days later). Main's `bmw: 'Grassicks BMW'` is the correct label for the pool the block actually searches. No Guess Who content, no `?scope=` content, no mode links, no mode key list — verified by grep of HEAD:homepage.html.

3. De-referencing: none required, verified file by file. Every branch file that mentions the string `homepage.html` as a path is unmodified on the branch and already fixed on main, so all four auto-merge to main's corrected text — `.github/workflows/pages.yml` (lines 47/56/57/78/85), `assets/brand-hero/README.md` (lines 3/22), `blocks/vehicle-matcher/demo-chrome.css` (line 7), `scripts/persona-check.mjs`, `docs/onboard-brand-blueprint.md`. `git grep -n homepage.html origin/main` returns nothing. `scripts/serve.js` and `start-servers.command` are byte-identical on both sides and never named the file. The single surviving mention is `docs/guess-who-research-salvage.md` (untracked, branch-only) where it appears in pasted `ls -l` and `git log` output — cosmetic transcript text, no functional path.

4. THE ACTUAL RISK IS NOT homepage.html — it is the index.html hunk that this rename creates. Tell whoever owns index.html that main's stage-2 index.html is the ex-homepage, a different document from the branch's stage-3 harness, and that git silently auto-merges the branch's stale `BRAND_RETAILER_NAMES` programme-name values and its `getRow` helper into main's homepage OUTSIDE the conflict markers (merged lines 308 and 369, between hunks). Resolve index.html by taking main's document whole, then port the branch's harness delta into block.html instead.

5. Follow-up, not merge-blocking: update block.html:81's `Keys:` list for the 5th mode once the modes/index.js key-name fight ('mingle' vs 'swipe', 'knockout' vs 'head-to-head', Guess Who = 'card') is settled, and consider porting index.html:138-196's scope-aware `poolName` into the homepage so its Retailer Name row stops being a single hardcoded label.

---

## Mode keys, after main's a16f218 "Rename mode keys to match their switcher labels"

### What main did

a16f218 re-slugged two mode keys to match their visible switcher labels: `blocks/vehicle-matcher/modes/mingle.js` `key: 'mingle'` -> `'swipe'` (main line 1230) and `blocks/vehicle-matcher/modes/knockout.js` `key: 'knockout'` -> `'head-to-head'` (main line 1311). Filenames (mingle.js/knockout.js) and CSS classes were deliberately NOT renamed, so key != filename is now a documented divergence. `questionnaire` and `podium` were untouched. It touched only 5 files: those two modes plus 3 doc sites (block.html:80-81 gained "Keys: questionnaire, swipe, head-to-head, podium."; docs/mini-mingle-requirements.md:133,764,808; docs/onboard-brand-blueprint.md:277). It did NOT touch modes/index.js, vehicle-matcher.js, any test, README.md, CLAUDE.md, the onboard-brand skill, or the two requirement docs' "| Mode key |" header rows. Two later main commits then added doc that contradicts it: a994385 added CLAUDE.md (line 61 lists the keys as `questionnaire, mingle, knockout, podium`) and refreshed README (lines 114-117, 161-162, which DO carry the new keys), and 9b377a8/246573c added .claude/skills/onboard-brand/SKILL.md (lines 119-120, "questionnaire/mingle/knockout/podium", "all four modes").

### What the branch did

The branch added a 5th mode, `blocks/vehicle-matcher/modes/guess-who.js`, exporting `{ key: 'guess-who', label: 'Guess Who', mount }` at line 2043, and registered it in `blocks/vehicle-matcher/modes/index.js` with one import (`import guessWho from './guess-who.js';`, line 25) and one array entry (`export const MODES = [questionnaire, mingle, knockout, podium, guessWho];`, line 27). It appended, so `DEFAULT_MODE = MODES[0]` is still questionnaire. It extended `server/test/render.test.js:52` to `const MODES = ['questionnaire', 'mingle', 'knockout', 'podium', 'guess-who'];` (a FILENAME list, see below) and added guess-who to two client-file path lists (render.test.js:289, :361). It edited vehicle-matcher.js (scope plumbing) but left `resolveMode` (line 172) and the switcher's `option.value = mode.key` (line 196) untouched. Critically, the branch never touched the `export default` line of mingle.js or knockout.js (its diffs vs base stop at hunks @@ -1020 and @@ -1098), so it still carries the OLD keys `'mingle'` (line 1231) and `'knockout'` (line 1311). It also renamed nothing in docs, so it still carries `?mode=mingle` etc. in three doc sites, and its README is the pre-a994385 one that documents a mode key `questions` that has never existed.

### Collisions (17)

#### `blocks/vehicle-matcher/modes/mingle.js`:1231 - semantic-only - **BREAKS SILENTLY**

Branch: `export default { key: 'mingle', label: 'Swipe', mount };`. Main: `export default { key: 'swipe', label: 'Swipe', mount };`. The branch never edited this line or the 5-line comment above it, so this three-way merges CLEANLY to main's version — verified: merge tree 3fc59baf64b14d689957d0621e86a9091675899e has `key: 'swipe'` at line 1232. The branch's key therefore changes under it with no marker, no error and no failing test.

**Resolution:** Accept main's `key: 'swipe'` (nothing to do at merge time). Then audit every branch-side consumer of the string 'mingle' as a key — see the doc findings below. Note the deliberate retirement: any existing link `?mode=mingle` now falls through to the unlocked switcher instead of locking.

#### `blocks/vehicle-matcher/modes/knockout.js`:1311 - semantic-only - **BREAKS SILENTLY**

Branch: `export default { key: 'knockout', label: 'Head to head', mount };`. Main: `export default { key: 'head-to-head', ... };`. Same situation — auto-merges to main's; merged blob has `key: 'head-to-head'` at line 1313. Comment at branch line 1309 ("key stays 'knockout' — the ?mode= and authored \"Mode\" value") is replaced by main's rewritten comment, so no stale comment survives here.

**Resolution:** Accept main's `key: 'head-to-head'`. `?mode=knockout` is retired by design.

#### `blocks/vehicle-matcher/modes/guess-who.js`:2043 - semantic-only - visible

`export default { key: 'guess-who', label: 'Guess Who', mount };`. This already satisfies a16f218's new convention (key == slugified label: slug('Guess Who') === 'guess-who'), so the branch's new mode needs NO rename. `resolveMode` lowercases the request (`(params.get('mode') || readBlockConfig(block).mode || '').toLowerCase()`, vehicle-matcher.js:174), and all five post-merge keys are lowercase and distinct: questionnaire, swipe, head-to-head, podium, guess-who. No duplicate-key collision.

**Resolution:** No change. This is the one place the two sides agree by accident; confirm and move on.

#### `server/test/render.test.js`:52 - semantic-only - **BREAKS SILENTLY**

`const MODES = ['questionnaire', 'mingle', 'knockout', 'podium', 'guess-who'];`. Despite the name, these are FILENAMES, not keys: they flow only into `loadMode(k)` (line 62) which does `import(new URL(`modes/${key}.js`, BLOCK_DIR))` (dom-harness.js:150). Post-merge the files are still mingle.js/knockout.js, so the suite stays green — but that is the problem: grep confirms NO test in server/test/ ever asserts a mode's `.key`. The whole rename is untested on both sides, so a wrong key ships green. Worse, this array plus the stale JSDoc at dom-harness.js:148 is an active trap: 'correcting' it to 'swipe'/'head-to-head' to match the new keys makes every render test fail with ERR_MODULE_NOT_FOUND on modes/swipe.js.

**Resolution:** Do NOT change line 52's strings. Rename the constant to MODE_FILES to kill the trap, and add one assertion that guards the keys: `assert.deepEqual(MODE_FILES.map((f) => modes[f].key), ['questionnaire','swipe','head-to-head','podium','guess-who'])`. That is the only machine check that would have caught this merge changing keys silently.

#### `server/test/dom-harness.js`:148 - stale-doc - **BREAKS SILENTLY**

`/** Dynamically import a mode module by key (questionnaire | mingle | knockout). */` — post-a16f218 the argument is a FILENAME stem, not a key ('mingle' and 'knockout' are no longer keys at all), and the list omits podium and guess-who. Main never touched this file; the branch's version wins outright, so the wrong doc survives the merge unmarked.

**Resolution:** Rewrite to: `/** Dynamically import a mode module by FILENAME stem (questionnaire | mingle | knockout | podium | guess-who) — note the file names differ from the mode keys ('swipe', 'head-to-head'). */`

#### `server/test/dom-harness.js`:6 - stale-doc - **BREAKS SILENTLY**

Header comment says "it actually MOUNTS each interface mode (questionnaire / swipe / knockout) in a real DOM" — mixes one post-rename key ('swipe') with one filename ('knockout'), and omits podium and guess-who. Branch version wins; main did not touch it.

**Resolution:** Say "each interface mode (questionnaire, swipe, head-to-head, podium, guess-who)" and keep the filename/key distinction to line 148.

#### `blocks/vehicle-matcher/modes/index.js`:16 - stale-doc - **BREAKS SILENTLY**

The registry's own contract comment: "Adding an interface = a new modes/<key>.js exporting this shape". After the merge this is false for two of the five modes — key 'swipe' lives in mingle.js and key 'head-to-head' lives in knockout.js. Separately, and importantly: main did NOT touch modes/index.js at all (it is identical on main and base), so the file is NOT in merge-tree's auto-merge list — the branch's version is taken whole and the guessWho import (line 25) plus the 5-entry MODES array (line 27) survive intact, with MODES[0] still questionnaire so DEFAULT_MODE is unchanged. There is no reorder or rename collision here.

**Resolution:** index.js needs no merge work. Update the comment at line 16 to: "a new modes/<name>.js exporting this shape — the filename need not match the key (mingle.js is 'swipe', knockout.js is 'head-to-head')".

#### `docs/mini-mingle-requirements.md`:8 - stale-doc - **BREAKS SILENTLY**

Header table row `| Mode key | `mingle` |`. a16f218 fixed this file's lines 133, 764 and 808 (all now say 'swipe') but missed the header table, so the row is wrong on main AND on the branch. Identical on both sides -> no conflict, no auto-merge entry, the wrong value simply survives. Merged file will read `| Mode key | `mingle` |` at line 8 while line 133 says `key: 'swipe'` and line 808 says `?mode=swipe`, i.e. self-contradictory two screens apart.

**Resolution:** Change line 8 to `| Mode key | `swipe` (file `modes/mingle.js`) |`.

#### `docs/mini-knockout-requirements.md`:8 - stale-doc - **BREAKS SILENTLY**

Header table row `| Mode key | `knockout` |`. a16f218 did not touch this file at all. Identical on both sides, so it merges silently and stays wrong; line 9 already says the switcher label is `Head to head`, which is now also the key.

**Resolution:** Change line 8 to `| Mode key | `head-to-head` (file `modes/knockout.js`) |`.

#### `CLAUDE.md` - stale-doc - **BREAKS SILENTLY**

File does not exist on the branch; arrives as an add from main (a994385). Main line 60-61: "A mode is a plain object `{ key, label, mount(root, ctx) }` registered in `blocks/vehicle-matcher/modes/index.js` (currently `questionnaire`, `mingle`, `knockout`, `podium`; first is the default)" — explicitly labelled as keys, and wrong for two of them (a994385 landed AFTER a16f218 and reintroduced the old names). Post-merge it is wrong twice over: stale keys AND missing the branch's 5th mode. Main line 63 repeats the false "a new `modes/<key>.js`" rule. This is the file every future Claude session in this repo reads first, so the error propagates.

**Resolution:** On main's CLAUDE.md line 61 write: "(currently `questionnaire`, `swipe`, `head-to-head`, `podium`, `guess-who`; first is the default; note two keys differ from their filenames — `swipe` is mingle.js, `head-to-head` is knockout.js)". Fix line 63's `modes/<key>.js` to `modes/<name>.js`.

#### `.claude/skills/onboard-brand/SKILL.md` - stale-doc - **BREAKS SILENTLY**

File does not exist on the branch; arrives as an add from main. Main line 119: "Headless DOM harness: mount each mode (questionnaire/mingle/knockout/podium) for the brand" — these read as filenames so they still work, but guess-who is missing. Main line 120: "Local run: `?brand=<key>&mode=…` for all four modes" — now five, and this is the step that would have caught a broken key by hand.

**Resolution:** Line 119: add guess-who to the list. Line 120: "for all five modes", and spell the keys the URL actually takes: `questionnaire`, `swipe`, `head-to-head`, `podium`, `guess-who`.

#### `block.html` - stale-doc - **BREAKS SILENTLY**

File does not exist on the branch (main created it by renaming base's index.html in 313594a); arrives as an add. Main line 80-81 is a16f218's authoritative key list: "?mode=<key> — lock to one interface, else the switcher shows. / Keys: questionnaire, swipe, head-to-head, podium." Post-merge this is the ONLY place in the tree that lists mode keys in the harness, and it omits guess-who — so the merge introduces a fresh doc error against the branch's flagship new mode.

**Resolution:** Append guess-who: "Keys: questionnaire, swipe, head-to-head, podium, guess-who." Also decide with the index.html/homepage.html resolution whether block.html and the branch's index.html are now two copies of the same harness — if so, keep one and delete the other rather than maintaining two key lists.

#### `index.html`:85 - textual-conflict - visible

Branch index.html IS the block harness (main renamed base's index.html to block.html and moved homepage.html to index.html, so this is a whole-file rename collision). Branch line 85 reads "?mode=<key>       — lock to one interface (else the switcher shows)" with no key list; main's index.html at that position is homepage markup. Verified by hand-merging the three stages: the conflict block spans merged lines 61-115 and swallows line 85, so it is a marked conflict, not a silent one.

**Resolution:** This file's resolution belongs to the index.html/homepage.html agent. For keys: whichever file ends up as the harness must carry "Keys: questionnaire, swipe, head-to-head, podium, guess-who" (copy main's block.html:80-81 wording, plus guess-who). Do not end up with the key list in block.html only while index.html is the page people actually open.

#### `README.md`:110 - stale-doc - **BREAKS SILENTLY**

Branch README's project layout lists only `questions.js` under modes/ (a file that does not exist). Main's a994385 replaced that block with the correct four (`mingle.js  #  'swipe'`, `knockout.js  #  'head-to-head'`, `podium.js  #  'podium'`). The branch did not edit this region, so main's wins with no conflict — verified by hand-merge: merged README lines 112-117. But it stops at podium: `guess-who.js` is absent from the merged layout.

**Resolution:** Accept main's block, then insert after merged line 117: "    guess-who.js      #   'guess-who' — a hard-filter Guess Who board".

#### `README.md`:149 - stale-doc - **BREAKS SILENTLY**

Branch documents the Mode config row as "Set it to a mode key (e.g. `questions`)" — a key that never existed — and the example table at branch line 191 says `| Mode | questions |`. Main's version (merged lines 159-164) is correct and current: "Keys: `questionnaire` (default), `swipe`, `head-to-head`, `podium`." This region auto-merges to main's, so the bogus `questions` disappears on its own. What remains wrong is the omission of `guess-who`.

**Resolution:** Accept main's text; edit merged lines 161-162 to "Keys: `questionnaire` (default), `swipe`, `head-to-head`, `podium`, `guess-who`." and add a clause that `swipe`/`head-to-head` are served by mingle.js/knockout.js.

#### `README.md`:200 - textual-conflict - visible

The one genuine README conflict in this area. Ours (branch): "locks the page to the questions interface with no switcher. **Scope** and **Retailer Name** agree, so the copy names the forecourt it actually searched.)" Theirs (main): "locks the page to the questionnaire interface with no switcher.)" Both sides changed the same sentence — the branch added the Scope/Retailer Name clause, main fixed the wrong mode name. Verified conflict at merged lines 212-217.

**Resolution:** Take the union with main's noun: "locks the page to the questionnaire interface with no switcher. **Scope** and **Retailer Name** agree, so the copy names the forecourt it actually searched.)"

#### `docs/onboard-brand-blueprint.md`:277 - stale-doc - **BREAKS SILENTLY**

Branch: "open `?brand=<key>&mode=questionnaire|mingle|knockout`". a16f218 fixed this to `questionnaire|swipe|head-to-head`. Branch did not edit the file, so main's fixed line wins with no conflict (merged line 305). Residual gap: the list still omits `podium` and `guess-who`, so the manual onboarding check skips two of five modes.

**Resolution:** Accept main's line, then extend to `?brand=<key>&mode=questionnaire|swipe|head-to-head|podium|guess-who` and update the surrounding "each mode" prose to five.

### Recommendation

Answer to the headline question. YES — after the merge `?mode=` works for all five modes, and no code needs editing to make that true. The merged keys are `questionnaire`, `swipe`, `head-to-head`, `podium`, `guess-who`. Verified against the actual merged tree 3fc59baf64b14d689957d0621e86a9091675899e: mingle.js:1232 has `key: 'swipe'`, knockout.js:1313 has `key: 'head-to-head'`, and modes/index.js:27 still has the branch's `MODES = [questionnaire, mingle, knockout, podium, guessWho]`. Question 4 is settled: modes/index.js does NOT conflict and is not even in the auto-merge list, because main never touched it (identical on main and base) — no reorder, no rename, guessWho's import and array entry survive whole, DEFAULT_MODE is still questionnaire.

Two things do break, though, and neither shows up as a conflict.

(1) The branch's keys change under it silently. `?mode=mingle` and `?mode=knockout` stop locking and fall through to the unlocked switcher. That is main's stated intent, so accept it — but grep the branch's own bookmarks/demo links before you do.

(2) No test guards keys at all. `server/test/render.test.js:52` looks like a key list and is actually a filename list feeding `loadMode` -> `import(modes/${key}.js)` (dom-harness.js:150). It stays green either way, and nothing in server/test/ ever reads `mode.key`. Fix in this order: (a) rename the constant to MODE_FILES; (b) add `assert.deepEqual(MODE_FILES.map((f) => modes[f].key), ['questionnaire','swipe','head-to-head','podium','guess-who'])`. Do NOT "correct" the strings on line 52 to the new keys — `modes/swipe.js` does not exist and every render test would die with ERR_MODULE_NOT_FOUND. Fix dom-harness.js:148 and :6 at the same time, since that JSDoc is what would mislead someone into making exactly that change.

Then the doc sweep, highest-impact first, because the merge leaves seven doc sites wrong and three of them arrive wrong FROM main as clean adds:
- CLAUDE.md:61 (arrives from main) — says the keys are `mingle`/`knockout`, and omits guess-who. Highest priority: every future session reads it.
- block.html:80-81 (arrives from main) — the only harness key list post-merge, and it omits guess-who.
- .claude/skills/onboard-brand/SKILL.md:119-120 (arrives from main) — "all four modes", no guess-who.
- README.md — accept main's version everywhere (it kills the branch's bogus `questions` key), then add guess-who to the modes/ layout (merged line 117) and the Keys list (merged 161-162), and resolve the one real conflict at merged 212-217 by taking the branch's Scope sentence with main's word "questionnaire".
- docs/mini-mingle-requirements.md:8 and docs/mini-knockout-requirements.md:8 — `| Mode key |` rows a16f218 missed; wrong on both sides, so they merge silently and stay wrong while the same files' bodies say the new keys.
- docs/onboard-brand-blueprint.md — accept main's fix, then add podium and guess-who.
- blocks/vehicle-matcher/modes/index.js:16 — the registry's own "modes/<key>.js" rule is now false for two of five modes; say so, since that divergence is deliberate and load-bearing.

Nothing else keys off these strings: no `vm-${mode.key}` class, no storage key, no analytics, no server or CI reference (server/*.js and DECISIONS.md hits are prose only), and the branch's untracked `.claude/` holds no mode strings. `resolveMode` (vehicle-matcher.js:172) and the switcher's `option.value = mode.key` (line 196) are branch-only edits main never touched, so they merge whole and work against the new keys unchanged.

---

## CSS — blocks/vehicle-matcher/vehicle-matcher.css, tokens.css, demo-chrome.css, after main's 1cdaa4b (design-token extraction, brand-accent picker, 2-line comment rule)

### What main did

1cdaa4b moved every `--vm-*` design token out of `vehicle-matcher.css` (-324 lines) into a new sibling `blocks/vehicle-matcher/tokens.css` (+346 lines), wired only by `@import url('./tokens.css')` as the first rule of `vehicle-matcher.css` (merged line 40) — no HTML `<link>` anywhere points at tokens.css. Main still ships vehicle-matcher.css; both harness pages (`block.html:11`, `index.html:8`) link it, so the tokens arrive transitively. The split: brand-INVARIANT tokens promoted from `.vm` to `:root` (`--vm-space-1..16`, `--vm-text-*`, `--vm-surface-alt-2`, `--vm-radius-soft`, `--vm-border-width`), brand-SPECIFIC tokens kept on `.vm` / `.vm.vm-{mini,honda,ford,motorrad,ferrari}`. The six `.vm.vm-<brand>` token blocks were replaced in vehicle-matcher.css by 2-line pointer comments; `@font-face` and all brand-scoped COMPONENT rules stayed. Brand-accent picker: `index.html` gained `brandAccent(key)`, which appends a hidden `<span class="vm vm-${key}">` probe to `document.body`, reads `--vm-accent-spot` off it, and sets it as each tile's `--tile-accent`; `demo-chrome.css:337` reads it back as `border-color: var(--tile-accent, #4c8bf5)`. Main also deleted four now-dead picker rules from demo-chrome.css (`.demo-picker-head/-title/-lede/-note`) and trimmed that file's comments. Comment rule: CLAUDE.md and README.md now say "keep code comments to 2 lines max" — but 1cdaa4b only enforced it in demo-chrome.css; main's own vehicle-matcher.css still holds 146 comments longer than 2 lines. Separately, 313594a renamed `index.html`→`block.html` and `homepage.html`→`index.html`, and added `.vm-podium-card { position: relative }` to vehicle-matcher.css plus the matching `cardWrap` element in podium.js:923.

### What the branch did

The branch appended a ~605-line Guess Who section to `vehicle-matcher.css` (branch lines 4204-4808: `.vm-gw`, `-bar`, `-lead`, `-wordmark`, `-tally`, `-count`, `-title`, `-note`, `-chips`, `-chip*`, `-tools`, `-tool`, `-board`, `-cell`, `-photo`, `-tile-*`, `-reject`, `-pop*`, `-place-*`, a `data-stage='dot|chip|tile|card'` size ladder, an `is-out` elimination transition, and a `prefers-reduced-motion` block), plus 5 brand-scoped GW rules for MINI/Ferrari/Motorrad. Crucially it DEFINES no custom property: the only new `--vm-*` names (`--vm-gw-track`, `--vm-gw-gap`, `--vm-gw-cell-h`, `--vm-gw-exit`, `--vm-gw-tint`) are written from JS via `board.style.setProperty` (guess-who.js:823-824, 1277, 1435-1437, 1968-1971) and read in CSS with literal fallbacks (`var(--vm-gw-track, 46px)` etc.) — the same instance-var pattern main already uses for `--vm-podium-rule`, `--vm-drag-stamp` and `--vm-mingle-swatch`. Elsewhere the branch replaced the tab mode switcher with a `<select>` (`.vm-switcher-tab*` → `.vm-switcher-select`, matching vehicle-matcher.js:192), expanded `.vm-podium-q` (16→28 hits), and dropped `.vm-podium-lede`.

### Collisions (6)

#### `homepage.html`:231 - dead-reference - **BREAKS SILENTLY**

Main deleted `.demo-picker-head` (base demo-chrome.css:358), `.demo-picker-title` (:359), `.demo-picker-lede` (:364) and `.demo-picker-note` (:416) as dead, because main's rewritten picker in index.html emits only `.demo-picker > .demo-picker-grid > .demo-picker-tile`. The branch's homepage.html still emits all four: `<div class="demo-picker-head">` (231), `<h1 class="demo-picker-title">See the matcher in place</h1>` (232), `<p class="demo-picker-lede">` (233), `<p class="demo-picker-note">` (236). The branch never touches demo-chrome.css, so it auto-merges to main's trimmed version with zero conflict markers. All 27 other `demo-*` classes in the branch's homepage.html still have rules; these four are the only casualties.

**Resolution:** Resolve the homepage.html modify/delete conflict by porting the branch's picker markup into main's index.html and either (a) dropping the head/title/lede/note elements to match main's stripped picker, or (b) restoring the four rules into demo-chrome.css after `.demo-picker-grid` (main line 313), rewritten to the 2-line comment rule. Do not silently keep the markup with main's CSS.

#### `blocks/vehicle-matcher/vehicle-matcher.css`:3947 - dead-reference - **BREAKS SILENTLY**

The CSS auto-merge imports main's new `.vm-podium-card { position: relative }` (merged line 3457), added by 313594a as the positioning context for `.vm-podium-reject`, which is `position: absolute; top: var(--vm-space-2); right: var(--vm-space-2)` in both versions (branch line 3947 / main line 3607). The element that carries that class is created in main's podium.js:923 (`const cardWrap = el('div', 'vm-podium-card')`); the branch's podium.js has no such line — it goes straight from `.vm-podium-step` (938) to the card. podium.js is a textual conflict, so a resolver who favours the branch side there gets main's CSS rule with no markup to match it.

**Resolution:** When resolving podium.js, carry main's `cardWrap` element (`vm-podium-card`) into the branch's `renderStep`, wrapping the card + reject chip below the rank eyebrow. Otherwise the chip's absolute position resolves against `.vm-podium-step` (which is `position: relative`, branch line 3730) and floats up into the eyebrow band — exactly the bug 313594a fixed — and `.vm-podium-card` becomes an orphaned selector.

#### `homepage.html`:245 - semantic-only - **BREAKS SILENTLY**

Main's brand-accent picker has two halves: JS (`brandAccent()` in index.html, setting `tile.style.setProperty('--tile-accent', …)` from a `.vm.vm-<brand>` probe's `--vm-accent-spot`) and CSS (`demo-chrome.css:337  border-color: var(--tile-accent, #4c8bf5)`). The CSS half auto-merges in. The branch's homepage.html renderPicker (line 245, `tile.className = 'demo-picker-tile'`) contains no occurrence of `tile-accent`, `brandAccent` or `accent-spot` — grep returns nothing. If homepage.html's picker wins the modify/delete conflict, every tile falls back to the neutral `#4c8bf5` and main's feature is dead with `--tile-accent` left as an unset var reference.

**Resolution:** Take main's index.html `brandAccent()` + `tile.style.setProperty('--tile-accent', brandAccent(key))` verbatim, and layer the branch's homepage.html query-param-carrying link logic on top of it — not the reverse.

#### `blocks/vehicle-matcher/vehicle-matcher.js`:226 - stale-doc - **BREAKS SILENTLY**

Comment reads `// brand's theme (vehicle-matcher.css) overrides the design tokens under its // own .vm-<brand> scope; the base .vm block is the BMW-default look.` Main did not touch vehicle-matcher.js at all (it is absent from `git diff --stat e0d6329 origin/main`), so this file auto-merges byte-clean and the comment survives pointing at the wrong file — the `.vm.vm-<brand>` token blocks now live only in tokens.css. Same class of staleness as the branch's own `docs/podium-requirements.md:324` / `docs/mini-knockout-requirements.md:185` file maps, and CLAUDE.md's mode list (`questionnaire, mingle, knockout, podium`) which needs `guess-who`.

**Resolution:** Change `(vehicle-matcher.css)` to `(tokens.css)` at vehicle-matcher.js:226. `docs/design-tokens.md:28` is NOT stale — it points `@font-face` at vehicle-matcher.css, which main deliberately kept there.

#### `server/test/render.test.js`:368 - semantic-only - **BREAKS SILENTLY**

The em-dash guard's `CLIENT_FILES` array ends with `'vehicle-matcher.css'`. The branch edits this exact array (adds `'modes/guess-who.js'` at branch line 361); main adds a new CSS file, tokens.css, and never adds it to the list (main did not touch render.test.js). The array merges cleanly, so the ~324 lines main moved out of the scanned file land in an unscanned one — the guard silently loses coverage of the file that now holds every token. No current offender exists (tokens.css is pure custom-property declarations, no `content:` strings), so no test fails.

**Resolution:** Add `'tokens.css',` alongside `'vehicle-matcher.css',` in CLIENT_FILES while resolving the branch's `'modes/guess-who.js'` addition.

#### `blocks/vehicle-matcher/vehicle-matcher.css`:4205 - stale-doc - visible

1cdaa4b documented a 2-line comment maximum in CLAUDE.md and README.md. The branch's Guess Who section opens with a 32-line block comment (branch lines 4204-4239) and contains 28 comments longer than 2 lines across 182 comment lines. Reported for completeness only, and it cuts both ways: main's own post-1cdaa4b vehicle-matcher.css still carries 146 over-2-line comments (max 32 lines), so 1cdaa4b enforced the rule in demo-chrome.css alone. Applying it to the GW section but not the rest of the file would be inconsistent.

**Resolution:** Optional. If tightened, compress the 32-line header at 4204 to its two load-bearing facts (content-visibility is mandatory at 12k cells; only transform/opacity animate) and keep the rest — or leave it and note that vehicle-matcher.css section banners are the standing exception.

### Recommendation

Direct answer: YES, the Guess Who board still picks up every brand's theme after the merge, and NO new rule duplicates or shadows a shared token. That part is clean, and I verified it rather than inferred it:

1. The three-way merge of vehicle-matcher.css (base e0d6329 / main / branch, run via `git merge-file` into /tmp) returns exit 0, zero conflict markers, 4534 lines.
2. The merged file retains `@import url('./tokens.css')` and it is the FIRST rule — the only things above it are comments (verified by stripping comments: first construct is line 4, the @import; next is `@font-face` at line 7). That ordering matters, since an @import after any other rule is dropped by the parser.
3. The merged file contains exactly TWO `--vm-*` definitions: `--vm-podium-rule` at lines 3590 and 3611. Those are pre-existing component-local vars present identically in base, main and branch — not tokens. Every one of the ~140 token definitions from the `.vm` and five `.vm.vm-<brand>` blocks is gone, replaced by main's pointer comments. No shadowing, no duplicate definition.
4. The Guess Who section (merged lines 3931-4535) defines ZERO custom properties. I cross-checked every `var()` name in the merged file against every definition in tokens.css + merged.css: the only unresolved names are the five JS-set `--vm-gw-*` instance vars (all with CSS fallbacks) plus main's own `--vm-drag-stamp` and `--vm-mingle-swatch`, which are the same pattern.
5. Theming path confirmed end to end: `vehicle-matcher.js:228  block.classList.add('vm', 'vm-${brandKey}')` is byte-identical on both sides (main:203); the mode stage is a child of that block (vehicle-matcher.js:249); every GW node is appended under `root` (guess-who.js:1950-1951 `shell.append(...); root.append(shell)`), including the popover. So `.vm.vm-mini .vm-gw-chip.is-on` (merged 4504) and `.vm.vm-mini .vm-gw-count` (4511) match, and `var(--vm-accent-spot)` resolves to MINI's British Racing Green from tokens.css. Nothing in the block reads tokens through getComputedStyle (zero hits repo-wide in blocks/), so there is no out-of-scope probe to break.
6. Selector sweep: nothing appears in the merged file that is in neither parent; nothing main added is lost; the only branch selectors dropped are the five `.vm.vm-<brand>` token blocks, which is the intended move. `.vm-podium-lede`, `.vm-podium-q*` and `.vm-switcher-tab*` show as "lost from main" but all exist in the BASE — the branch removed or renamed them itself (tab switcher → `.vm-switcher-select`), so the merge preserved branch intent, not a main regression.
7. `docs/spikes/guess-who-render-spike.html` is self-contained (its own unprefixed `--card/--gap/--dur/--ease`); it duplicates nothing.
8. README's project-layout block was NOT touched by the branch, so main's `tokens.css` line 110 and the Conventions section survive the README merge — the sole README conflict is at merged line 212, the `questions`→`questionnaire` mode-key wording, not CSS.

Resolution order, highest risk first:
1. Resolve homepage.html + index.html as ONE decision, not two. Main's index.html IS the branch's homepage.html (renamed by 313594a), and main's block.html IS the branch's index.html. Start from MAIN's index.html — it has `brandAccent()` and matches main's trimmed demo-chrome.css — then port the branch's query-param-carrying picker links and any scope/geocode wiring onto it. Doing it the other way round loses the brand-accent picker AND leaves four unstyled elements.
2. When resolving podium.js, carry main's `vm-podium-card` wrapper across, or delete `.vm-podium-card` from the CSS. Don't leave the CSS rule with no markup.
3. Take the CSS auto-merge as-is otherwise. It is correct.
4. Housekeeping while in the area: `vehicle-matcher.js:226` comment → tokens.css; add `'tokens.css'` to render.test.js CLIENT_FILES; add `guess-who.js` to main's README mode list and CLAUDE.md's `(currently questionnaire, mingle, knockout, podium)`; and consider adding a Layer-4 note to `docs/onboard-brand-blueprint.md` that a new brand's GW rules go in the file's Guess Who section, since the blueprint predates the 5th mode.

Pre-existing bug, on BOTH sides, so not a merge issue but worth an issue of its own: `var(--vm-space-7)` is consumed at merged line 1703 (`margin-top`) but never defined — the space scale jumps 6→8. It resolves to nothing today and has since before the merge base.

---

## Content conflict in blocks/vehicle-matcher/modes/podium.js (plus its CSS dependency)

### What main did

Two commits touch this file, and they are much smaller than the commit subjects suggest.

313594a ("fix the podium reject chip") — the substantive one. In `buildStep` it replaces the two flat appends
    step.append(matchCard(safeMatch(m), { big: ..., compact: !gold, brand: ctx.brand }));
    step.append(rejectTrigger(m, step));
with a positioned wrapper `const cardWrap = el('div', 'vm-podium-card');` holding `matchCard(...)` + `rejectTrigger(m, step)`, then `step.append(cardWrap)`, plus a 6-line comment. Dismissal target stays `step`. Paired with a new CSS rule in vehicle-matcher.css: `.vm-podium-card { position: relative; }` inserted directly after `.vm-podium-step { position: relative; ... }`. Reason: the chip was absolutely positioned against `.vm-podium-step`, whose first child is `.vm-podium-rank` (tallest on gold), so it floated in the eyebrow band.

ba45c4c ("Shorten and reorder MINI podium questions, and fix selected state on single-choice buttons") — its podium.js footprint is ONE line: `PODIUM_COPY.mini.lede` loses the trailing sentence, `'as you go. No waiting about.'` -> `'as you go.'`. Nothing else in podium.js.

Two things about ba45c4c that matter and are counter-intuitive:
(a) Its `renderOptionList` "selected state" fix (`optionButtons.forEach(({button,value}) => { button.classList.toggle('is-selected', ...); button.setAttribute('aria-checked', ...) })`) is NOT in origin/main. `git rev-parse origin/main:blocks/vehicle-matcher/modes/question-ui.js` = 8fec6ce, byte-identical to the merge base e0d6329; ba45c4c's blob was ca46f89. It was lost in the katie-playground merge 4595391 (the base already carried an equivalent repaint at lines 168/181). So there is zero question-ui.js interaction to resolve — `git diff origin/main HEAD -- question-ui.js` equals `git diff e0d6329 HEAD -- question-ui.js`.
(b) The "shorten and reorder questions" work is all in server/ — server/brands.js `drop: ['mileage','style']` -> `['mileage','style','primaryUse','people','priorities']`, `doors.insertAfter` 'bodyStyles' -> 'charging' (help text dropped), `miniVibe.insertAfter` 'people' -> 'charging'; and server/questions.js retitles/retrims MINI copy and adds an `optionsOverride` array path in `questionsForBrand`. The branch touches neither file, so these land untouched.

### What the branch did

Three separate things, none of which overlap main's `buildStep` edit:

1. Scope threading, two lines only:
   - line 528: `api: ctx.api, retailer: ctx.retailer, brand: ctx.brand, scope: ctx.scope, group: true,` in the `createPreviewFeed({...})` call.
   - line 804: `result = await apiMatch(ctx.api, state.answers, ctx.retailer, ctx.brand, ctx.scope);`

2. Layout restructure of `buildStage`/`renderSkeleton`: a new full-width `.vm-podium-head` (wordmark + title + `.vm-podium-progress` + `.vm-podium-banner`) hoisted out of `.vm-podium-ask`, and a new `.vm-podium-grid` wrapper around ask+results in both the skeleton and the real stage. As part of that it DELETES the `el('p', 'vm-podium-lede', copy.lede)` render call, and therefore deletes the `lede:` key from all six brands in `PODIUM_COPY` (mini, bmw, honda, ford, motorrad, ferrari).

3. Collapsible questions: `buildQuestion` becomes `h3.vm-podium-q-heading > button.vm-podium-q-toggle` (with `aria-expanded`/`aria-controls`, `.vm-podium-q-text`, `.vm-podium-q-badge`, `.vm-podium-q-chevron`) plus a `.vm-podium-q-panel` holding help + control, and `updateProgress` now toggles the `.vm-podium-q-badge` hidden state per answered question.

Confirmed by `grep -n lede blocks/vehicle-matcher/modes/podium.js`: the only remaining hit on the branch is line 560, `el('p', 'vm-lede', copy.errLede)` — a different key on the error screen. `copy.lede` is referenced nowhere.

### Collisions (4)

#### `blocks/vehicle-matcher/modes/podium.js`:103 - textual-conflict - visible

The ONLY conflict marker in this file — verified with `git merge-file` on the three blobs, which produced exactly one hunk. It lands between HEAD line 103 (`    title: 'YOUR TOP THREE, LIVE.',`) and HEAD line 104 (`    bannerStart: 'Nothing decided yet. ...'`), inside `PODIUM_COPY.mini`. Ours (russ-playground) side is EMPTY (the branch deleted the `lede` key); theirs (origin/main) side is the two shortened lines `    lede: 'Tell us what you’re after on the left. The podium on the right shuffles '` / `      + 'as you go.',`. Main's `buildStep` hunk and the branch's scope threading at lines 528 and 804 are far apart and all auto-merge — they do NOT interact.

**Resolution:** Take OURS: delete all five lines `<<<<<<< HEAD` / `=======` / the two `lede:` lines / `>>>>>>> origin/main`. Exact final text for the hunk, four consecutive lines with no `lede` key:

  mini: {
    wordmark: 'MINI Podium',
    title: 'YOUR TOP THREE, LIVE.',
    bannerStart: 'Nothing decided yet. We’ve made a start from your budget anyway.',

Justification, not preference: nothing renders `copy.lede` after the merge — the branch removed the `el('p', 'vm-podium-lede', copy.lede)` call from `buildStage` and moved wordmark/title into `.vm-podium-head`. Keeping main's line would leave a dead `lede` on `mini` alone, since the five sibling deletions (bmw/honda/ford/motorrad/ferrari) auto-merge without a marker. Main's editorial intent (shorter MINI copy) is already satisfied — the whole sentence is gone. I resolved this way in /tmp and `node --check` passes; the result diffs against HEAD only in the `buildStep` region, which is exactly main's hunk arriving.

#### `blocks/vehicle-matcher/vehicle-matcher.css`:3827 - dead-reference - **BREAKS SILENTLY**

THE DANGEROUS ONE. Main's `.vm-podium-card` wrapper auto-merges into `buildStep` with no marker, changing the DOM from `.vm-podium-step > .vm-card` to `.vm-podium-step > .vm-podium-card > .vm-card`. The branch has five direct-child selectors inside `@media (min-width: 1080px)` that stop matching, at HEAD lines 3827, 3831, 3839, 3847-3848 and 3854-3855:
  .vm-podium-steps:not(.is-tied) .vm-podium-step.is-gold > .vm-card > .vm-card-media  { flex: none; max-height: 280px; }
  ... > .vm-card > .vm-card-body { display: block; columns: 2; column-gap: var(--vm-space-8); }
  ... > .vm-card > .vm-card-body > * { break-inside: avoid; }
  ... > .vm-card > .vm-card-body > .vm-blurb:not(:last-child) { break-after: column; }
  ... > .vm-card > .vm-card-body > .vm-why-label { break-after: avoid; }
These are the branch's measured desktop hero: the spanning gold card's photo becomes a 280px cinematic band and its body runs two columns, bringing the hero to ~595px so 2nd and 3rd clear the fold. Post-merge all five go dead and the hero silently reverts to portrait anatomy (16:9 photo, single column, the ~721px case the comment at HEAD 3816-3826 explicitly calls out as the problem it solves). `.vm-podium-steps ... .is-gold { grid-column: 1 / -1; }` at line 3814 still matches, so the card still spans — it just spans badly. This is a pre-existing latent bug on origin/main too (main ships the same five selectors alongside its own wrapper), so the merge does not create it, it imports it onto the branch where those rules currently work.

**Resolution:** After resolving podium.js, edit those five selectors in vehicle-matcher.css to go through the wrapper, e.g. `.vm-podium-steps:not(.is-tied) .vm-podium-step.is-gold > .vm-podium-card > .vm-card > .vm-card-media` (and the same insertion of `> .vm-podium-card` in the other four). Prefer that over loosening `>` to a descendant combinator, which would also catch a nested card. Verify by loading the podium at >=1080px with a non-tied gold and checking `.vm-card-body` computes `column-count: 2` — no test covers this.

#### `blocks/vehicle-matcher/vehicle-matcher.css`:3728 - stale-doc - **BREAKS SILENTLY**

The branch's comment above `.vm-podium-step` (HEAD lines 3726-3729) asserts "It is the positioning context for the reject trigger, and it carries the dismissal transition for the whole tile." After main's wrapper lands, the first clause is false: `.vm-podium-card { position: relative; }` (which merge-file places immediately below, between `.vm-podium-step` and `.vm-podium-step .vm-card`) becomes the containing block for the absolutely-positioned `.vm-podium-reject` (HEAD 3947, `position: absolute; top: var(--vm-space-2); right: var(--vm-space-2)`). The second clause stays true — `rejectTrigger(m, step)` still targets the step, so `.is-dismissing`/`.is-dismissed` still fade the whole tile.

**Resolution:** Reword to: "It carries the dismissal transition for the whole tile; the chip's positioning context is the .vm-podium-card wrapper below the eyebrow." Main's own comment on `.vm-podium-card` already states the new arrangement, so the two comments will otherwise contradict each other.

#### `blocks/vehicle-matcher/modes/podium.js`:409 - semantic-only - **BREAKS SILENTLY**

Low severity, no textual conflict, listed because it is the only other cross-side interaction. Main's server/brands.js adds `primaryUse`, `people`, `priorities` to MINI's `drop` list, so MINI's question set goes from 9 to 6 declared (budget, bodyStyles, fuel, charging, doors, miniVibe; `charging` and `doors` are conditional, so 4-6 visible). That makes three `Q_LABELS` entries in the branch's podium.js dead for MINI — line 408 `primaryUse: 'Main use'`, line 409 `people: 'Who’s on board'`, line 413 `priorities: 'Priorities'`. They stay live for the other five brands, and `shortLabel` (HEAD 424) has an id-to-spaced-words fallback, so nothing misrenders. Separately the branch's skeleton hardcodes `for (let i = 0; i < 5; i += 1)` (HEAD line 579) skeleton lines in `.vm-podium-ask`; against MINI's new 4-6 visible questions that is now roughly right rather than badly under-drawn, so no action needed. Branch touches neither server/brands.js nor server/questions.js nor quiz-meta.js — confirmed empty `git diff e0d6329 HEAD --stat` for all three — so main's `insertAfter: 'charging'` repointing of `doors`/`miniVibe` and its new `optionsOverride` path in `questionsForBrand` land unopposed.

**Resolution:** No edit required. Leave Q_LABELS and the skeleton loop alone. Do NOT delete the three label entries — bmw/honda/ford/motorrad/ferrari still ask those questions.

### Recommendation

In order:

1. Resolve the single podium.js conflict by taking OURS (delete the five marker lines at HEAD 103/104). The resulting `PODIUM_COPY.mini` block is:
       mini: {
         wordmark: 'MINI Podium',
         title: 'YOUR TOP THREE, LIVE.',
         bannerStart: 'Nothing decided yet. We’ve made a start from your budget anyway.',
   That is the whole conflict. There is no second hunk to adjudicate and no union to hand-craft.

2. Accept main's `buildStep` hunk verbatim as git auto-merged it — the `.vm-podium-card` wrapper, its 6-line comment, and `rejectTrigger(m, step)` inside `cardWrap.append(...)`. Do not touch it.

3. Confirm both scope threads survived — they are outside the conflict and untouched:
       grep -n "scope: ctx.scope, group: true" -> line 528
       grep -n "ctx.brand, ctx.scope)" -> line 804
   If either is missing after the merge, something went wrong upstream of this file.

4. Then fix the five `@media (min-width: 1080px)` selectors in vehicle-matcher.css (branch lines 3827, 3831, 3839, 3847, 3854) to insert `> .vm-podium-card`. This is the only silent breakage in the area and nothing tests it; skipping it costs the branch's measured desktop hero layout. Reword the `.vm-podium-step` comment at 3726-3729 while there.

5. Do nothing in question-ui.js, server/brands.js, server/questions.js or quiz-meta.js. Main's question-ui.js `is-selected` fix from ba45c4c is not on origin/main at all (blob 8fec6ce, identical to the merge base) — if the team believes that fix is live, they are wrong and it needs re-applying as separate work, not as part of this merge. The server-side MINI question changes land cleanly because the branch never touched those files.

6. Smoke test rather than trusting the tests: no test in server/test/ references `vm-podium-lede`, `vm-podium-card`, `vm-podium-head` or `vm-podium-grid`, and `git diff e0d6329 origin/main -- server/test/render.test.js` is empty. So load the MINI podium, check the head band renders wordmark/title/progress with no lede paragraph, check the "Not this one" chip sits on the card's top-right on the gold tile, and check the ≥1080px gold hero body is two columns.

---

## README.md content conflict (plus every mode-count / mode-list / mode-key staleness the merge creates across the repo's docs)

### What main did

a994385 "Add CLAUDE.md guidance; refresh README for 6 brands and 4 modes" (plus 1cdaa4b and 313594a) rewrote README.md around the post-rename, 6-brand, 4-mode world. Concretely, main: (1) named all six brands in the lede and Brand row (`BMW`, `MINI`, `Ford`, `Honda`, `Motorrad`, `Ferrari`), (2) swapped the harness file naming — `index.html` is now the branded demo homepage/picker served at `/` and `block.html` is the bare EDS harness (README lines 63, 65, 129, 130, 220), (3) added `tokens.css` and `demo-chrome.css` to the Project layout tree and expanded `modes/` into a per-file list (`questionnaire.js`, `mingle.js` `'swipe'`, `knockout.js` `'head-to-head'`, `podium.js` `'podium'`), (4) enumerated the Mode row's legal keys as "`questionnaire` (default), `swipe`, `head-to-head`, `podium`" and changed the example table row to `| Mode | questionnaire |`, (5) repointed the tuning tables at `server/brands.js` per-brand `tuning`, (6) added a "Conventions" section on 2-line comments. Ordering matters: a16f218 (key rename mingle->'swipe', knockout->'head-to-head') landed BEFORE a994385, so main's README key list is correct for main. Main also added CLAUDE.md (94 lines) and .claude/skills/onboard-brand/SKILL.md (129 lines), both of which restate the mode roster. Main did NOT touch the `/api/match` bullet, so main still carries the phantom `RETAILER_SITE` env var claim at its README:228.

### What the branch did

Seven auto-commits (52fbfce..d18879f) added +44/-7 to README.md only, in three places, all inside the "Porting to Adobe EDS" and "API contract" sections: (1) a new authored **Scope** config-row bullet (`dealer` default / `national`), rewrote the **Retailer ID** bullet to say it falls back to `defaultRetailer` in `server/brands.js` and does double duty as the distance anchor, and rewrote **Retailer Name** to be scope-dependent (`Grassicks Garage` at dealer scope vs `BMW Approved Used` at national); (2) added `| Scope | dealer |` to the example table, changed `| Retailer Name |` from `Sytner Luton MINI` to `Sytner Luton`, and appended a sentence to the parenthetical after it; (3) a new paragraph documenting `?mode=<key>` and `?scope=dealer|national` as query-string overrides that need no authored row, and rewrote the `POST /api/match` bullet to `{ answers, retailer?, brand?, scope? }`, deleting the false "`RETAILER_SITE` env var, or `96` if unset" and replacing it with the brand's `defaultRetailer` (`96` BMW / `92` MINI), plus noting `/api/preview`, `/api/field`, `/api/pool` take the same two params. The branch never touched the lede, the Project layout tree, the Mode-keys list, or the CLAUDE.md/docs that main added, so all of main's structure survives untouched — which is exactly why the staleness below lands silently.

### Collisions (19)

#### `README.md`:212 - textual-conflict - visible

The ONLY textual conflict in README.md is one line. Base: `locks the page to the questions interface with no switcher.)`. BRANCH: `locks the page to the questions interface with no switcher. **Scope** and` + `**Retailer Name** agree, so the copy names the forecourt it actually searched.)`. MAIN: `locks the page to the questionnaire interface with no switcher.)`. Both sides edited the same line; main fixed the stale word `questions` -> `questionnaire`, the branch appended a second sentence while keeping `questions`.

**Resolution:** Take main's word plus the branch's added sentence. Exact final two lines (replacing the whole conflict block, markers included):

locks the page to the questionnaire interface with no switcher. **Scope** and
**Retailer Name** agree, so the copy names the forecourt it actually searched.)

Everything else in README.md auto-merges: main wins the Brand row / Project layout / Mode-keys list / `block.html` renames, the branch wins the Scope bullet, the Retailer ID+Name rewrites, the `| Scope | dealer |` table row, the `?scope=` paragraph and the `/api/match` bullet (so the RETAILER_SITE correction survives with no manual work).

#### `README.md`:161 - semantic-only - **BREAKS SILENTLY**

Merged text reads: `switcher — the production case. Keys: \`questionnaire\` (default), \`swipe\`, \`head-to-head\`, \`podium\`. Leave it blank/absent...`. Post-merge `blocks/vehicle-matcher/modes/index.js` exports `MODES = [questionnaire, mingle, knockout, podium, guessWho]` and `guess-who.js:2043` exports `{ key: 'guess-who', label: 'Guess Who', mount }`. The branch never touched this line so main's four-key list wins verbatim: the fifth authorable Mode key is undocumented.

**Resolution:** Replace lines 161-164 with:
     switcher — the production case. Keys: `questionnaire` (default), `swipe`,
     `head-to-head`, `podium`, `guess-who`. Leave it blank/absent to show every
     registered mode with a switcher (the showcase). Mode keys live in
     `blocks/vehicle-matcher/modes/index.js`.

#### `README.md`:117 - stale-doc - **BREAKS SILENTLY**

Project layout tree lists exactly four mode files (lines 114-117: `questionnaire.js`, `mingle.js  # 'swipe'`, `knockout.js  # 'head-to-head'`, `podium.js  # 'podium'`). `blocks/vehicle-matcher/modes/guess-who.js` (2043 lines, the branch's whole 5th mode) is absent. Main authored this tree block; the branch never touched the section, so it auto-merges to main's four-file version.

**Resolution:** Insert after line 117:
    guess-who.js      #   'guess-who' — a hard-filter board (Distance filter at national scope)

#### `README.md`:174 - dead-reference - **BREAKS SILENTLY**

The branch's Scope bullet says `...national scope is the group/programme case, and turns on Guess Who's Distance filter (with one forecourt there is nothing to sort by distance, so it hides itself).` This is the ONLY mention of Guess Who in the merged README, and it is a bare forward reference: the mode list at 161-162 and the file tree at 114-117 (both main's) never introduce a mode called Guess Who, so the reader meets a proper noun with no antecedent.

**Resolution:** Fixing the two entries above (README:161 and README:117) gives this sentence its antecedent; no edit needed here once `guess-who` appears in the Keys list and the tree.

#### `README.md`:124 - stale-doc - **BREAKS SILENTLY**

The `server/` tree (lines 118-128, authored by main) lists index.js, engine.js, brands.js, questions.js, stock.js, mapping.js, {honda,ferrari,motorrad}-listing.js, data.js, test/, package.json. The branch adds `server/geocode.js` (new file, imported at `server/index.js:46` as `geocodePostcode`, served at `server/index.js:924` as `GET /api/geocode`). It is a clean file add so nothing flags its absence from the tree.

**Resolution:** Insert after line 124 (`mapping.js`):
  geocode.js        # postcode -> lat/lon for the Distance filter (/api/geocode)

#### `README.md`:241 - stale-doc - **BREAKS SILENTLY**

`The backend exposes two endpoints (plus \`GET /health\` → \`{ ok: true }\`):` — inherited unchanged from base by both sides. The merged file itself then names five (`/api/questions`, `/api/match`, `/api/preview`, `/api/field`, `/api/pool` at line 257, `/api/nearby` at 265), and `server/index.js` on the branch actually routes seven: /api/field, /api/geocode, /api/match, /api/nearby, /api/pool, /api/preview, /api/questions. The branch's own edit at 257-258 is what makes the sentence self-contradicting two lines later.

**Resolution:** Replace line 241 with:
The backend exposes these endpoints (plus `GET /health` → `{ ok: true }`):

and add a `/api/geocode` bullet after the `/api/nearby` sentence, since the Distance filter's postcode lookup is currently documented nowhere.

#### `README.md`:228 - semantic-only - **BREAKS SILENTLY**

The branch's new paragraph (224-230) says `The harness re-derives **Retailer Name** from whichever brand and scope are in the URL, so its label always matches its pool`. That code is `index.html:151` (`const scope = params.get('scope')...`) through `index.html:196` (`setRow('retailer name', ...)`) on the branch — but main renamed the bare harness to `block.html` and repurposed `index.html` as the demo homepage. Merged README:220 correctly says `The standalone \`block.html\` harness`, so "the harness" in the branch's paragraph now means `block.html`, which on main has no `?scope=` handling and a contradictory name map. Also note the two sides define the SAME identifier `BRAND_RETAILER_NAMES` with opposite meanings: branch `index.html:170-177` has `bmw: 'BMW Approved Used'` (national programme names) whereas main `block.html:143-150` has `bmw: 'Grassicks BMW'` (dealer names, with a separate `RETAILER_NAMES` at 151-154 for IDs).

**Resolution:** Not a README edit — a dependency on the index.html/homepage.html resolution (another agent's area). Flag it: the branch's `?scope=` block and its `DEALER_NAMES = { 96: 'Grassicks Garage', 92: 'Sytner Luton' }` / `BRAND_RETAILER_NAMES` (national-programme flavour) must be ported into main's `block.html`, and main's dealer-flavoured `BRAND_RETAILER_NAMES` kept under a distinct name, or README:224-230 and the README:178 `Grassicks Garage` / `BMW Approved Used` prescription both describe code that does not exist.

#### `CLAUDE.md`:61 - stale-doc - **BREAKS SILENTLY**

Main adds CLAUDE.md; the branch has no CLAUDE.md at all, so main's lands as a clean add with no conflict. Line 61 reads `(currently \`questionnaire\`, \`mingle\`, \`knockout\`, \`podium\`; first is the default)` immediately after `A mode is a plain object \`{ key, label, mount(root, ctx) }\` registered in \`blocks/vehicle-matcher/modes/index.js\``, so it reads as a list of keys. TWO defects: (a) already wrong on main — a16f218 renamed those keys to `swipe` and `head-to-head`; `mingle`/`knockout` are now filenames only; (b) `guess-who` missing post-merge. This is the file agents read first, so it will keep producing `?mode=mingle` links that silently fall through to the switcher.

**Resolution:** Replace on line 61: `(currently \`questionnaire\`, \`swipe\`, \`head-to-head\`, \`podium\`, \`guess-who\`; first is the default)`. Optionally add `— note the keys deliberately diverge from the filenames \`mingle.js\`/\`knockout.js\` (see a16f218)`.

#### `CLAUDE.md`:74 - stale-doc - **BREAKS SILENTLY**

`\`/api/match\` fetches the retailer's live used-stock feed (\`stock.js\`) and maps each vehicle into the engine schema via \`mapping.js\`.` Post-merge that is only true at `scope=dealer`; at `scope=national` it pools every retailer of the brand. Grepping main's CLAUDE.md for `scope` returns nothing — the entire ?scope= axis the branch threaded through /api/match, /api/preview, /api/field and /api/pool is absent from the architecture doc, and no test covers a doc.

**Resolution:** Amend line 74 to `...fetches the live used-stock feed for the requested \`scope\` — one retailer's forecourt (\`dealer\`, the default) or every retailer of the brand (\`national\`) — and maps...`, and add scope to the "Cross-file invariants" list: an unrecognised scope resolves to `dealer` deliberately, so a mistyped scope never widens a pool the page has already named.

#### `.claude/skills/onboard-brand/SKILL.md`:120 - stale-doc - **BREAKS SILENTLY**

`5. Local run: \`?brand=<key>&mode=…\` for all four modes — populates, photos de-prioritised, knockout reads head-to-head, ...`. The literal string "all four modes" — the only numeric mode count anywhere in the repo's docs. New file on main, untouched by the branch, so it merges clean and stays wrong at five modes.

**Resolution:** Change "for all four modes" to "for all five modes".

#### `.claude/skills/onboard-brand/SKILL.md`:119 - stale-doc - **BREAKS SILENTLY**

`4. Headless DOM harness: mount each mode (questionnaire/mingle/knockout/podium) for the brand, assert it paints.` Four modes listed; `guess-who` missing. Since this is a skill an agent executes, a new brand will be onboarded and signed off without Guess Who ever being mounted for it.

**Resolution:** Change to `(questionnaire/mingle/knockout/podium/guess-who)`.

#### `docs/onboard-brand-blueprint.md`:305 - stale-doc - **BREAKS SILENTLY**

`3. Local run: \`npm run serve\`, open \`?brand=<key>&mode=questionnaire|swipe|head-to-head\` — each mode paints...`. a16f218 updated this line's keys but never added `podium`, and the merge adds a fifth mode it also omits. So the acceptance step for a new brand exercises three of five modes.

**Resolution:** Change to `?brand=<key>&mode=questionnaire|swipe|head-to-head|podium|guess-who`.

#### `docs/onboard-brand-blueprint.md`:190 - stale-doc - **BREAKS SILENTLY**

`(The tab *labels* stay brand-neutral by design — "Questionnaire"/"Swipe"/"Head to head" —`. Omits "Podium" (pre-existing) and "Guess Who" (merge-created). Labels come from the `label:` field of each mode's default export.

**Resolution:** Change to `"Questionnaire"/"Swipe"/"Head to head"/"Podium"/"Guess Who"`.

#### `docs/mini-mingle-requirements.md`:121 - stale-doc - **BREAKS SILENTLY**

`    index.js        # + import mingle;  MODES = [questionnaire, mingle, knockout, podium]` — a four-entry registry snapshot. a16f218 fixed this file's lines 133, 764 and 808 (key `mingle` -> `swipe`) but left 121 and 8 alone.

**Resolution:** Either append `, guessWho` to the array, or (preferred for a historical requirements doc) leave it and note at the top that the registry snapshot is as-of authoring. Pick one policy and apply it to all four requirements docs below.

#### `docs/mini-mingle-requirements.md`:8 - stale-doc - **BREAKS SILENTLY**

`| Mode key | \`mingle\` |` — already wrong on main: a16f218 renamed the key to `swipe` and explicitly retired `?mode=mingle` ("such links now fall back to the switcher instead of locking"), but missed this header row. Pre-existing on main, not merge-created, but it is the single most quotable line in the file.

**Resolution:** Change to `| Mode key | \`swipe\` (filename stays `mingle.js`) |`.

#### `docs/mini-knockout-requirements.md`:183 - stale-doc - **BREAKS SILENTLY**

Two defects in one file, neither touched by a16f218 or by the branch. Line 8: `| Mode key | \`knockout\` |` — the key is now `head-to-head`; `?mode=knockout` is retired and falls through to the switcher. Line 183: `blocks/vehicle-matcher/modes/index.js          # registry — MODES = [questionnaire, mingle, knockout, podium]` — four entries, missing `guessWho`.

**Resolution:** Line 8 -> `| Mode key | \`head-to-head\` (filename stays `knockout.js`) |`; line 183 -> append `, guessWho` (or apply the as-of-authoring note policy).

#### `docs/podium-requirements.md`:36 - stale-doc - **BREAKS SILENTLY**

`MODES = [questionnaire, mingle, knockout, podium]` at line 36 and again at line 322 (`blocks/vehicle-matcher/modes/index.js          # registry: MODES = [questionnaire, mingle, knockout, podium]`). Four entries; `guessWho` missing post-merge. (Line 8 `| Mode key | \`podium\` |` is still correct — podium was not renamed.)

**Resolution:** Append `, guessWho` at both 36 and 322, or apply the as-of-authoring note policy.

#### `docs/live-stock-plan.md`:85 - stale-doc - **BREAKS SILENTLY**

`(falling back to the \`RETAILER_SITE\` env var, default \`96\`, if omitted),`. Identical on base, branch and main. `grep -rn RETAILER_SITE` over the merged tree finds NO such env var in server/ or scripts/ — the real fallback is `defaultRetailer` in `server/brands.js` (`'96'` at brands.js:542, `'92'` at :556). The branch deleted this exact false claim from README's /api/match bullet; after the merge the repo asserts the corrected version in README:253 and the phantom version here, in the doc that specifically explains the stock client.

**Resolution:** Change to `(falling back to the brand's \`defaultRetailer\` in \`server/brands.js\` — \`96\` for BMW, \`92\` for MINI — if omitted),`. This is the last surviving instance; README's is fixed by the merge and no code reference exists.

#### `docs/guess-who-requirements.md` - stale-doc - **BREAKS SILENTLY**

Absent. `docs/` post-merge contains mini-mingle-requirements.md, mini-knockout-requirements.md and podium-requirements.md — a requirements doc per mode — plus `docs/onboard-brand-blueprint.md` and `docs/how-it-works.md`. The branch's only tracked Guess Who artefact is `docs/spikes/guess-who-render-spike.html`; `docs/guess-who-research-salvage.md` and `docs/spikes/pool-bmw.json` are UNTRACKED and will not be in the merge at all. So the 2043-line 5th mode ships with no requirements doc and, unless the untracked file is committed first, no research record.

**Resolution:** Commit `docs/guess-who-research-salvage.md` before merging (it is currently untracked and would be lost from history), and add a `docs/guess-who-requirements.md` matching the shape of the other three mode requirements docs. Also add Guess Who to `docs/how-it-works.md`, which currently describes no modes by name at all.

### Recommendation

Order of operations:

1. Resolve the single README.md conflict as main's word + the branch's sentence (exact text in collision 1). That is the entire manual merge work for README.md — every other branch edit (Scope bullet, Retailer ID/Name rewrites, `| Scope | dealer |`, the `?scope=` paragraph, the `/api/match` rewrite that kills `RETAILER_SITE`) auto-merges cleanly on top of main's refreshed structure, and every one of main's structural changes survives. Do NOT hand-merge more than that one line.

2. Then make four small post-merge edits to README.md, none of which any conflict marker or test will point you at:
   - line 117: insert `    guess-who.js      #   'guess-who' — a hard-filter board (Distance filter at national scope)`
   - line 124: insert `  geocode.js        # postcode -> lat/lon for the Distance filter (/api/geocode)`
   - lines 161-162: add `, \`guess-who\`` to the Keys list
   - line 241: `two endpoints` -> `these endpoints`, and document `/api/geocode`

3. Fix CLAUDE.md:61 (the merge's highest-leverage staleness — it is the file every future agent reads, and it is wrong on TWO counts: it lists retired keys `mingle`/`knockout` instead of `swipe`/`head-to-head`, an error main shipped itself, and it omits `guess-who`). While there, add the `scope` axis to CLAUDE.md:74 and to its "Cross-file invariants" list — `scope` appears nowhere in main's CLAUDE.md, so the branch's biggest architectural addition would be invisible to the architecture doc.

4. Fix the two executable docs, because they are instructions an agent will follow and will silently under-test: `.claude/skills/onboard-brand/SKILL.md:120` ("all four modes" -> five, the only numeric mode count in the repo) and `:119` (mount list), plus `docs/onboard-brand-blueprint.md:305` (mode= list is missing podium AND guess-who) and `:190` (label list).

5. Fix `docs/live-stock-plan.md:85` — after the merge it is the last place asserting a `RETAILER_SITE` env var that exists nowhere in the tree, and it now directly contradicts README:253.

6. Decide one policy for the four historical requirements docs (mini-mingle:8,121; mini-knockout:8,183; podium:36,322) — either update the `MODES = [...]` snapshots and the two wrong `| Mode key |` rows, or add an "as-of-authoring" note at the top of each. Note that mini-mingle:8 and mini-knockout:8 are wrong on main today, independent of this merge.

7. Before merging, commit `docs/guess-who-research-salvage.md` (currently UNTRACKED — it will not be in the merge and its history is at risk), and add a `docs/guess-who-requirements.md` so the 5th mode has the same paper trail as the other four.

One cross-area dependency to hand to the index.html/homepage.html agent: README:220-230 (main's `block.html` naming + the branch's `?scope=` paragraph) is only true if the branch's `?scope=` derivation from `index.html:151-196` — including `DEALER_NAMES = { 96: 'Grassicks Garage', 92: 'Sytner Luton' }` and its national-programme-flavoured `BRAND_RETAILER_NAMES` — is ported into main's `block.html`. Both sides define an identifier literally named `BRAND_RETAILER_NAMES` with contradictory values (branch: `bmw: 'BMW Approved Used'`; main `block.html:143`: `bmw: 'Grassicks BMW'`), so a careless resolution will keep one name and the other's semantics.

---

## The content conflict in index.html (plus its true post-merge home, block.html, and the homepage.html modify/delete that is the same conflict's other half)

### What main did

313594a is a three-way FILE SWAP that git records as one modify plus one add plus one delete, so no rename is detected: (a) the old index.html — the standalone harness with the authored Brand / Retailer ID / Retailer Name config rows — was copied to a NEW file block.html, with two changes of its own: `main { max-width: 1280px }` reduced to `880px` (block.html:25, comment truncated to drop the 1280px justification), and a localhost login skip added at block.html:226-244 (`pageIsLocal` from protocol/hostname, `apiIsLocal` from `new URL(block.dataset.api, ...)`, gate condition becomes `sessionStorage.getItem(ACCESS_KEY_STORAGE) || pageIsLocal || apiIsLocal`); (b) homepage.html — the brand picker + themed shell + BRANDS content map — was moved wholesale INTO index.html so it serves at `/`, with `const root = document.getElementById('demo-root')` replacing `const block = document.querySelector('.vehicle-matcher')` at index.html:71, the same localhost skip at index.html:496-513 (via `DEFAULT_API = pageIsLocal ? LOCAL_API : REMOTE_API` and `apiHost` from `params.get('api') || DEFAULT_API`), and every "index.html" self-reference in comments reworded to "block.html"; (c) homepage.html deleted. pages.yml was updated in step with `cp -R index.html block.html blocks assets _site/`. Then 1cdaa4b added `brandAccent()` (index.html:228-248) and stripped the picker head/note, and a16f218 rewrote block.html:80-81's `?mode=<key>` doc line to add "Keys: questionnaire, swipe, head-to-head, podium." after renaming mingle->swipe and knockout->head-to-head. Crucially: main did NOT touch the `?key=` handling in either file — the `keyFromUrl` / `params.delete('key')` / `history.replaceState` block is byte-identical to the merge base in both (block.html:173-184, index.html:424-435, the latter only reflowed to `{}, '',` on one line).

### What the branch did

The branch made four surgical edits to index.html, all to the STANDALONE HARNESS (which main has since moved to block.html), and none to the password gate at all: (1) index.html:83-84 added a `?scope=dealer|national` line to the query-string doc block and rewrote the "No Mode row is authored here on purpose" note (lines 88-94) to cover Scope and to say Retailer Name is re-derived; (2) index.html:106 changed the authored Retailer Name from `Grassicks BMW` to `Grassicks Garage` (the real feed name, correct for the default dealer scope); (3) index.html:128-138 split `setRow` into a `findRow` / `setRow` / `getRow` trio so the label logic can read the block's EFFECTIVE config back rather than re-deriving `?brand`/`?retailer` precedence; (4) index.html:148-196 replaced the old `nameOverride` chain with a scope-aware derivation: `const scope = params.get('scope')?.trim().toLowerCase() === 'national' ? 'national' : 'dealer'`, `BRAND_RETAILER_NAMES` repointed from branch names to programme names (`bmw: 'BMW Approved Used'`, `mini: 'MINI Approved Used'`), a new `DEALER_NAMES = { 96: 'Grassicks Garage', 92: 'Sytner Luton' }`, `RETAILER_NAMES` deleted, and `setRow('retailer name', params.get('retailerName') || poolName)` called UNCONDITIONALLY where `poolName = scope === 'national' ? BRAND_RETAILER_NAMES[brandKey] || BRAND_RETAILER_NAMES.bmw : DEALER_NAMES[getRow('retailer id')] || 'this retailer'`. Separately the branch edited homepage.html (main's future index.html) at lines 182-193 and 356-358: same programme-name values in `BRAND_RETAILER_NAMES`, `RETAILER_NAMES` deleted, and `|| RETAILER_NAMES[retailerOverride]` removed from the precedence chain — but it added NO scope awareness there (`grep -c scope HEAD:homepage.html` = 0). The block itself reads scope on its own: `resolveScope()` at blocks/vehicle-matcher/vehicle-matcher.js:156 takes `params.get('scope') || readBlockConfig(block).scope`, defaulting to 'dealer'.

### Collisions (9)

#### `index.html`:114 - semantic-only - **BREAKS SILENTLY**

Branch index.html:114 is `const block = document.querySelector('.vehicle-matcher');`. Main changed that exact line to `const root = document.getElementById('demo-root');` (origin/main:index.html:71). The branch did not touch it, so the three-way merge takes main's line SILENTLY — it lands in the auto-merged common region between conflict hunk 1 and hunk 2 (merged output line 160), with no conflict marker anywhere near it. Every `block` reference in the branch's script is then undeclared: `block.dataset.api = apiOverride` (branch:119), `[...block.children]` inside findRow (branch:128), `decorate(block)` (branch:261, 267, 269).

**Resolution:** Do not resolve any index.html hunk toward the branch. index.html becomes main's homepage verbatim (which correctly keeps `const root` at line 71 and declares `const block = renderShell(brandKey)` locally at line 480); the branch's `const block = document.querySelector('.vehicle-matcher')` survives untouched in origin/main:block.html:105, which is where the branch's script now belongs.

#### `index.html`:1 - textual-conflict - visible

All four merge-file conflict hunks in index.html (merged-output lines 61-155, 163-303, 310-368, 377-632) are false conflicts caused by an undetected rename: main's 313594a moved the harness OUT of index.html into a new block.html and moved homepage.html's contents INTO index.html. The two sides are editing different documents that happen to share a filename. Verified with `git merge-file --diff3 HEAD:index.html e0d6329:index.html origin/main:index.html` -> exit 4. Note the `<head>` (merged lines 1-26) and the whole tail from the `keyFromUrl` block onward (merged lines 633-747) AUTO-MERGE to main's homepage version, so a naive 'keep my side' resolution of the four body/script hunks yields main's homepage <head> (title 'Find Your Car — in place', a demo-chrome.css link, no `padding: 4vh 16px`) bolted onto the branch's harness <main>.

**Resolution:** `git checkout origin/main -- index.html block.html` and `git rm homepage.html` — accept main's swap outright — then replay each side's real intent into its new home (see recommendation steps 2 and 3). Do not hand-merge the four hunks.

#### `index.html`:188 - semantic-only - **BREAKS SILENTLY**

`BRAND_RETAILER_NAMES` (origin/main:index.html:188-195) AUTO-MERGES to the branch's programme-name values — it sits in the common region at merged-output lines 369-376, no marker — because the branch changed the same map identically in both index.html:170-177 and homepage.html:182-189 while main only reworded the comment above it. So main's homepage script ends up with `bmw: 'BMW Approved Used'` / `mini: 'MINI Approved Used'` while `renderShell()` still authors `Retailer ID` = `BRAND_RETAILER_IDS[brandKey]` = 96/92 (index.html:200, 330) and the block still defaults `resolveScope()` to 'dealer' (vehicle-matcher.js:158). Result on the DEFAULT URL `/?brand=bmw`: the block searches Grassicks Garage's ~41-car forecourt and labels it 'BMW Approved Used' — verbatim the failure the branch's own comment at index.html:167-169 calls out ('a dealer pool labelled "BMW Approved Used", implying twelve thousand cars when it searched forty-one').

**Resolution:** Keep the auto-merged programme-name values (they are the branch's deliberate choice) AND make the homepage actually run national, by adding one authored row to renderShell's template after index.html:331: `              <div><div>Scope</div><div>national</div></div>`. readBlockConfig slugifies the key to `scope` (vehicle-matcher.js:56) and resolveScope reads `params.get('scope') || readBlockConfig(block).scope`, so `?scope=dealer` still overrides it. Alternative if the homepage must stay dealer-scoped: port the branch's scope-aware `poolName` block (index.html:182-196) into applyOverrides instead.

#### `index.html`:386 - dead-reference - **BREAKS SILENTLY**

`|| RETAILER_NAMES[retailerOverride]` at origin/main:index.html:386, and the `RETAILER_NAMES = { 96: 'Grassicks BMW', 92: 'Sytner Luton MINI' }` map at index.html:196-199, are on MAIN's side of conflict hunk 4 (merged-output lines 424-427) — so taking main's side keeps both, even though the branch deliberately deleted them in homepage.html (branch diff hunk @@ -351,10 +353,8 @@). They also survive on main's side of hunk 4 in the harness. Combined with the previous finding, the merged precedence becomes contradictory: `/?brand=bmw` labels the pool 'BMW Approved Used' but `/?brand=bmw&retailer=96` labels the identical pool 'Grassicks BMW', because RETAILER_NAMES is consulted before BRAND_RETAILER_NAMES. Nothing errors; the two URLs just disagree.

**Resolution:** Delete origin/main:index.html:196-199 (`const RETAILER_NAMES = {...};`) and change lines 383-386 to exactly:
      // Retailer-name precedence: ?retailerName= > BRAND_RETAILER_NAMES[brand].
      const nameOverride = params.get('retailerName')
        || (brandOverride && BRAND_RETAILER_NAMES[brandOverride.toLowerCase()]);
This is precisely hunk 2 of `git diff e0d6329 HEAD -- homepage.html`, which applies cleanly to main's index.html at offset +29 (verified by dry run).

#### `block.html`:80 - textual-conflict - visible

The branch inserted its `?scope=dealer|national` doc lines (branch index.html:83-84) immediately ABOVE the `?mode=<key>` line, and main rewrote that very `?mode=<key>` line in a16f218 (origin/main:block.html:80-81). Overlapping windows. Verified: `git diff e0d6329 HEAD -- index.html | patch --dry-run -p1 origin/main:block.html` -> 'Hunk #1 failed at 80'; hunks 2, 3 and 4 succeed at offset -2. This is the ONE manual union needed in block.html.

**Resolution:** Hand-write origin/main:block.html lines 74-85 as, exactly:
         defaults for local dev, overridable via the query string:
           ?brand=bmw|mini   — which brand to theme + source
           ?retailer=<id>    — which retailer's stock
           ?scope=dealer|national — that retailer's forecourt, or the whole
                               network (BMW/MINI only; default dealer)
           ?mode=<key>       — lock to one interface, else the switcher shows.
                               Keys: questionnaire, swipe, head-to-head,
                               podium, guess-who.
           ?api=<url>        — point at a deployed backend

         No "Mode" or "Scope" row is authored here on purpose: both are read
         from the query string by the block itself, and unlocked the block shows
         its mode switcher — this page IS the multi-interface showcase.

         Retailer Name is authored to match the DEFAULT scope, but the script
         below re-derives it whenever brand or scope changes, because one
         hardcoded label cannot be true for both scopes. -->

#### `block.html`:81 - stale-doc - **BREAKS SILENTLY**

origin/main:block.html:81 documents the lockable mode keys as 'Keys: questionnaire, swipe, head-to-head, podium.' The branch adds a fifth mode: blocks/vehicle-matcher/modes/index.js:27 becomes `export const MODES = [questionnaire, mingle, knockout, podium, guessWho]` and modes/guess-who.js:2043 is `export default { key: 'guess-who', label: 'Guess Who', mount };`. The branch never touched the key lines in mingle.js/knockout.js (verified: no `key:`/`label:` lines in `git diff e0d6329 HEAD -- modes/mingle.js modes/knockout.js`), so main's swipe/head-to-head rename survives the auto-merge intact and the list is right except for the omission. A comment cannot fail a test, and the only place this list exists is here.

**Resolution:** Included in the block.html union text above: '                               podium, guess-who.' The key does follow main's a16f218 convention (slugified switcher label), so no rename is needed.

#### `block.html`:25 - semantic-only - **BREAKS SILENTLY**

313594a set `main { width: 100%; max-width: 880px; ... }` in block.html:25 and deleted the merge-base comment sentence that justified 1280 ('Matches the block's own 1280px column (vehicle-matcher.css `.vm`) so the white surface ends where the block does — a narrower wrapper here would clamp the block back down and hide the change'), carrying that sentence and the 1280px value into index.html instead. So block.html re-introduces exactly the clamp the merge-base index.html existed to remove: `.vm` is capped at 1280px (vehicle-matcher.css:325) but an 880px wrapper wins. The branch's Guess Who board picks its cell size FROM the measured width — `measureLayout(count, width, track)` at modes/guess-who.js:664 computes `cols = Math.floor((width + stage.gap) / (track + stage.gap))`, and `pickLayout` walks tracks down from `STAGES[0].max` against a height budget (lines 702-714), with `stageFor(track)` selecting card(236-330px) / tile(128-236) / chip(44-128) / dot(9-44). At 880px instead of 1280px the same car count drops a stage or more, so the harness renders the board at a smaller size than the branch measured and tuned it at. No error, no test, and the harness is the page you would use to review it.

**Resolution:** Restore the merge-base value and comment in block.html:18-27 — `max-width: 1280px` and the four-line comment ending 'clamp the block back down and hide the change.' — matching what main itself put in index.html:21-27. If the 880px was deliberate for the harness, say so explicitly in the comment and re-check the Guess Who staging at 880px before merging.

#### `homepage.html`:1 - textual-conflict - visible

CONFLICT (modify/delete): main deleted homepage.html in 313594a after moving its contents into index.html; the branch modified it (lines 182-193 and 356-358). merge-tree leaves HEAD's version in the tree, so a careless `git add .` resurrects a 24KB duplicate of index.html that nothing serves — pages.yml on main copies only `index.html block.html blocks assets` (line 57), and its brand-logo guard now greps `index.html` (line 85), so the stale copy would silently rot with no CI signal.

**Resolution:** `git rm homepage.html`. Its two branch hunks are the delta to apply to index.html instead (see recommendation step 3) — they are not lost, they are relocated.

#### `docs/onboard-brand-blueprint.md`:277 - stale-doc - **BREAKS SILENTLY**

The branch did not touch this file (`git diff --stat e0d6329 HEAD -- docs/onboard-brand-blueprint.md` is empty), so main's version is taken silently. Main already updated it for the swap, but its instructions describe the PRE-branch retailer-name model: line 277 'Add the new brand to `BRAND_RETAILER_NAMES` in block.html (and the same map in index.html, the demo…)' and lines 341-342 '`BRAND_RETAILER_NAMES[<brand>]` added in block.html and index.html so `?brand=<key>` shows the brand's own retailer, not "Grassicks BMW"'. Post-merge those are no longer the same map (block.html carries BRAND_RETAILER_NAMES for national scope PLUS DEALER_NAMES for dealer scope; index.html carries only BRAND_RETAILER_NAMES) and 'shows the brand's own retailer' inverts the branch's whole rule, which is that at national scope you must NOT name a retailer. An onboarder following this checklist adds a branch name to a national map.

**Resolution:** Rewrite lines 273-277 and checklist item 341-342 to name three maps and the scope rule: BRAND_RETAILER_NAMES (programme name, used at ?scope=national and by the homepage), DEALER_NAMES in block.html (branch name keyed by retailer ID, used at ?scope=dealer), BRAND_RETAILER_IDS in index.html (nearby-lookup anchor only). Also fix README.md lines 62/120/208 on the branch, which still call index.html the harness — main's README:63/129/130/203 already says block.html, and that file is a separate conflict.

### Recommendation

Treat this as a rename, not a content merge. Do NOT hand-resolve index.html's four hunks — every one is a false conflict, and the two edits that actually matter (`const block` at branch:114, `BRAND_RETAILER_NAMES` at main:188) are OUTSIDE the markers, in auto-merged regions.

STEP 1 — accept main's swap wholesale:
  git checkout origin/main -- index.html block.html
  git rm homepage.html
Nothing of the branch's is lost; steps 2-3 replay it into the right files.

STEP 2 — replay the branch's HARNESS work into block.html:
  git diff e0d6329735c3817388ec89dce85571f79d01b073 HEAD -- index.html | patch -p1 block.html
Dry-run verified: hunks 2 (Grassicks Garage), 3 (findRow/setRow/getRow) and 4 (scope + DEALER_NAMES + poolName) apply cleanly at offset -2. Hunk 1 fails at line 80 — hand-write the config-comment union given in the block.html:80 collision above (adds ?scope=, keeps main's "Keys:" line, adds guess-who as the fifth key). Main's own block.html changes are all outside those hunks, so the 880px rule and the pageIsLocal/apiIsLocal skip survive automatically. Then restore `max-width: 1280px` at block.html:25 with the merge-base comment.

STEP 3 — replay the branch's HOMEPAGE work into index.html:
  git diff e0d6329735c3817388ec89dce85571f79d01b073 HEAD -- homepage.html | patch -p1 index.html
Dry-run verified: hunk 2 (drop `|| RETAILER_NAMES[retailerOverride]`) applies at offset +29. Hunk 1 fails at 172 for one reason only — main reworded "carried over verbatim from index.html" to "...from block.html". Keep MAIN's wording on that header line and the BRANCH's comment and values below it (exact text in the index.html:188 collision). Then delete `const RETAILER_NAMES = {...}` at index.html:196-199 and add the Scope row after index.html:331:
              <div><div>Scope</div><div>national</div></div>
Without that row the merged homepage's default URL searches one 41-car forecourt under a national label — the single silent regression the auto-merge creates.

STEP 4 — the ?key= question, answered: the branch's gate logic is neither redundant nor wrong, and the branch never touched it. Main's localhost skip is purely ADDITIVE to the same gate; the `keyFromUrl` block (store, `params.delete('key')`, `history.replaceState`) is byte-identical to the merge base in origin/main:block.html:173-184 and origin/main:index.html:424-435, so `?key=` is still read and still self-strips in both merged files. Nothing in the tree asserts on it — `grep -rn '?key='` finds only three comments (index.html:207, 264; homepage.html:251) and no test, doc or script, so no branch verification breaks. Two true consequences worth knowing: (a) `?key=dev` is now a no-op on the local path the branch verified with, because `pageIsLocal || apiIsLocal` short-circuits the prompt anyway — it still writes `dev` to sessionStorage and still self-strips, and if a local server IS keyed differently the 401 -> vm-auth-failed handler re-prompts exactly as before; (b) `?key=` remains load-bearing for the deployed Pages link, where `pageIsLocal` is false and `?api=`/REMOTE_API is not localhost, so the up-front overlay fires and `?key=` is the only way to make a shareable link skip it. One behaviour to be aware of rather than fix: main's `pageIsLocal ||` makes the up-front prompt unreachable for a page served from localhost but pointed at the keyed Render backend via `?api=`; the block then calls it bare, takes a 401 and re-prompts. That is main's own documented trade-off (index.html:496-503), not a merge collision.

STEP 5 — the getRow question, answered: no conflict, and it ports. main's renderShell GENERATES the config rows (`<div><div>Brand</div><div>${brandKey}</div></div>` at index.html:329-332) in exactly the two-cell shape findRow walks, so `findRow`/`getRow`/`setRow` work unchanged against generated markup; the extra `Title`/`Scope` rows are simply ignored by label lookup. Two ordering facts to preserve if you ever port the scope-aware poolName into index.html's applyOverrides rather than authoring a Scope row: `getRow('brand').toLowerCase()` must run AFTER `setRow('brand', brandOverride)` (main's applyOverrides:377-378 passes the raw, un-lowercased `?brand=` value), and `getRow('retailer id')` must run after `setRow('retailer id', ...)`. The branch's own ordering already satisfies both. Deliberately authoring no Scope row remains correct for block.html — resolveScope reads the query string itself — but is NOT correct for index.html, where the homepage's fixed Retailer ID makes the default scope load-bearing on the label.

STEP 6 — verify by eye, since no test covers either page. Serve locally and check: block.html?brand=bmw -> "Grassicks Garage"; block.html?brand=bmw&scope=national -> "BMW Approved Used"; block.html?brand=mini&scope=dealer&retailer=92 -> "Sytner Luton"; block.html?brand=ford -> "Ford Approved Used"; block.html?retailer=999&scope=dealer -> "this retailer"; block.html?mode=guess-who -> board renders at the full 1280px column; index.html -> picker, no password prompt on localhost; index.html?brand=bmw -> "BMW Approved Used" with the Scope row present; index.html?brand=bmw&retailer=96 -> still "BMW Approved Used" (proves RETAILER_NAMES is gone); and confirm a picker tile click preserves ?scope= (main's renderPicker copies `params` at index.html:280, so it does).

---
## Resume checklist

The single most important fact, and the one that reframes the whole merge: main's
`313594a` **renamed two files past each other**. `homepage.html` became `index.html`
(the branded picker now serves at `/`), and the old bare EDS harness `index.html`
became `block.html`. So the branch's scope work, which all went into `index.html`,
belongs in **`block.html`** after the merge, and the `homepage.html` "modify/delete"
conflict is the other half of that same rename. Resolving `index.html` and
`homepage.html` as two independent decisions is how this merge goes wrong.

Do it in this order:

1. `git merge origin/main` (do not commit yet).
2. **`homepage.html` + `index.html` + `block.html` as one decision.**
   `git checkout origin/main -- index.html block.html`, then `git rm homepage.html`
   (merge-tree leaves HEAD's copy in the tree, so doing nothing here ships an
   undeployed 487-line duplicate). Then replay the branch's harness delta into
   `block.html` and its homepage delta into `index.html` per the verified `patch`
   commands in the index.html section above. **Add the `Scope | national` row to
   `index.html`** - without it the merged homepage searches one 41-car forecourt
   under a national label, which is the only silent regression the auto-merge creates.
3. **`podium.js`**: take OURS on the one conflict (the `PODIUM_COPY.mini` block);
   accept main's auto-merged `.vm-podium-card` wrapper verbatim; then confirm both
   scope threads survived (`grep -n "scope: ctx.scope, group: true"` -> 528,
   `grep -n "ctx.brand, ctx.scope)"` -> 804).
4. **`vehicle-matcher.css`**: take the auto-merge as-is (verified clean: `@import
   url('./tokens.css')` stays the first rule, Guess Who defines no custom property,
   MINI/Ferrari/Motorrad GW theming still resolves). Then add `> .vm-podium-card`
   to the five `@media (min-width: 1080px)` podium selectors, or main's new wrapper
   silently costs the branch's desktop hero layout.
5. **`README.md`**: main's word + the branch's sentence on the one conflicted line,
   and nothing more by hand. Then the four small post-merge insertions listed above.
6. **Mode keys**: nothing to do at merge time - `?mode=` works for all five
   (`questionnaire`, `swipe`, `head-to-head`, `podium`, `guess-who`) with no edit,
   because `modes/index.js` does not conflict and `guess-who` already satisfies
   main's key-equals-label convention. But `?mode=mingle` and `?mode=knockout` are
   retired by main's design, so check any bookmarked demo links.
7. **Docs staleness the merge creates, highest leverage first**: `CLAUDE.md:61`
   (arrives wrong FROM main - retired keys, and no `guess-who`), `block.html:80-81`
   Keys list, `.claude/skills/onboard-brand/SKILL.md:119-120` ("all four modes"),
   `docs/onboard-brand-blueprint.md`, `server/test/dom-harness.js:6` and `:148`,
   `blocks/vehicle-matcher/modes/index.js:16`, `docs/live-stock-plan.md:85`.
8. **Add the one missing machine check** - rename `render.test.js:52` to `MODE_FILES`
   (they are filenames, not keys) and assert the five real keys. Nothing in the suite
   reads `mode.key` today, so this whole rename shipped, and merges, untested.
   Do NOT "correct" line 52's strings: `modes/swipe.js` does not exist.
9. `cd server && npm test` (230 passing before the merge), then re-verify both
   scopes in the browser per the eye-check list in the index.html section.
10. Push and open the PR. **Recommend squash-merge in the PR body** - all 227 branch
    commits are titled "Auto-commit: <file>".

### Two things worth deciding before the PR

- `docs/spikes/pool-bmw.json` (1.1 MB spike data) and
  `docs/guess-who-research-salvage.md` (195K of raw agent output) are **untracked**
  and currently excluded. The README recon argues the salvage doc should be committed
  before the merge so its history is not at risk. `docs/spikes/guess-who-render-spike.html`
  is already committed and will be in the PR.
- One finding contradicts a branch decision, and it is worth reading rather than
  actioning blind: main's `bmw: 'Grassicks BMW'` label is arguably now *correct*,
  because the branch's own `DEFAULT_SCOPE = 'dealer'` (added two days after the
  2026-09-02 copy fix that changed it to `'BMW Approved Used'`) means the block
  searches one forecourt by default. Both sides define `BRAND_RETAILER_NAMES` with
  contradictory values, so a careless resolution keeps one side's name with the
  other's semantics.

### Pre-existing bugs found in passing (on both sides, not merge issues)

- `var(--vm-space-7)` is consumed at `vehicle-matcher.css` (merged line 1703,
  `margin-top`) but never defined - the space scale jumps 6 to 8.
- `ba45c4c`'s single-choice `is-selected` fix is **not on `origin/main`**.
  `origin/main:question-ui.js` is byte-identical to the merge base; the fix was lost
  in the `katie-playground` merge `4595391`. If the team believes that fix is live,
  it is not, and re-applying it is separate work - not part of this merge.
