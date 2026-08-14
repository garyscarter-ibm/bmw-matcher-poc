# App Store listings — MyVauxhall and MyVauxhall 2.0

- URL: `https://itunes.apple.com/search?term=vauxhall&country=gb&entity=software&limit=25`
- Recon source id: s37 (recon used `limit=10`; this pass used `limit=25`).
- Party: first (seller `Vauxhall`). Authority: A2. Currency: current. retrievedAt: 2026-08-14.
- **Closest reachable thing to consumer-register first-party copy this run.** Still not the
  consumer marketing register: App Store copy is functional feature-listing, written to be
  scanned.

## Fidelity warning

The fetcher refused to reproduce either `description` field in full, citing its 125-character
quote cap, and returned summaries. **The description copy below is therefore mostly the
fetcher's paraphrase, and only the bracketed strings are exact.** This is the one place in the
dimension where I asked for verbatim consumer-facing copy and could not get it. It is a known,
probed shortfall, not an absence.

## MyVauxhall (the main app)

Metadata (EXACT):

- `trackName`: MyVauxhall
- `sellerName`: Vauxhall
- `releaseDate`: 2019-11-11T08:00:00Z
- `currentVersionReleaseDate`: 2026-08-03T05:38:15Z
- `version`: 1.54.2
- `releaseNotes`: `This new version includes technical improvements as well as several fixes following the last release.`

Recon (s37) additionally captured this exact positioning fragment from the same field:

> the official app for Vauxhall drivers – to enhance the driving and ownership experience

Note the spaced en dash inside that line, matching press-release dash habits.

Description content `[FETCHER PARAPHRASE except where bracketed]`. The listing splits capability
into an unconnected tier and a Bluetooth-linked tier. Without vehicle pairing: dashboard warning
light glossary, multi-car garage, how-to videos for infotainment and safety systems, parked
location tagging and sharing, retailer search with favourites, service booking, brand news and
offers, and infotainment/navigation updates delivered over a phone charging cable. With
Bluetooth pairing on supported infotainment: trip and drive dashboards, vehicle alerts, fuel
level and average consumption, plus the named feature `Last Miles Guidance` for completing a
journey on foot.

Lexicon carried over from the wider brand: `retailer` (not "dealer"), `garage` for the
multi-vehicle list, `drivers` and `ownership experience` for the audience.

## MyVauxhall 2.0 (preview successor)

Metadata (EXACT):

- `trackName`: MyVauxhall 2.0
- `sellerName`: Vauxhall
- `releaseDate`: 2025-04-28T07:00:00Z
- `currentVersionReleaseDate`: 2026-08-11T09:43:30Z
- `version`: 02.11.26080100
- `releaseNotes`: `Bugfixes and Improvements`

Connected-car tier names as written (EXACT): **`Connect ONE`** and **`Connect PLUS`**.

Note the casing. Recon (s37) recorded these as `CONNECT ONE` / `CONNECT PLUS`, all caps; this
pass returned `Connect ONE` / `Connect PLUS`, initial-cap `Connect` with an all-caps tier word.
**The two retrievals disagree on the casing of `Connect`.** Not resolved. The all-caps recon form
may have come from a headline-cased context in the listing. Both are recorded; treat the tier
word (`ONE`, `PLUS`) as reliably all-caps and `Connect` as contested.

Description content `[FETCHER PARAPHRASE except where bracketed]`. Presented as an early preview
limited to the `New Grandland Electric`. Advertises a rebuilt, more intuitive interface and two
service tiers. `Connect ONE` covers baseline vehicle management plus emergency support, agent
contact and dealer service scheduling, included for ten years from the warranty start date.
`Connect PLUS` adds remote vehicle control, maintenance history and condition monitoring for a
monthly or annual fee. Subscriptions are managed under the Vehicle tab's `Subscriptions` menu.
The listing states availability varies by model, infotainment system and country of sale.

Disclaimer (EXACT):

> ALL IMAGES DISPLAYED ARE FOR ILLUSTRATIVE PURPOSES ONLY.

That is a full-caps disclaimer, matching the press-side habit of reserving all caps for
structural and legal furniture (`ENDS`, `ABOUT VAUXHALL MOTORS`, trim names).

Naming note: `New Grandland Electric` uses `New` as part of the product string, which matches the
press headlines (`NEW MOKKA YES`, `NEW ASTRA`, `NEW GRANDLAND GRIFFIN`, `NEW CORSA GSE`). `New`
functions as a persistent prefix in Vauxhall product naming, not just as an adjective.

## Third-party apps excluded

`My Vauxhall Corsa`, `OPL Monitor`, `Performance Vauxhall Magazine`, `e-ROUTES` are
third-party developers, not `sellerName: Vauxhall`. Excluded from the voice evidence.
