# Logo — asset ledger — 2026-08-14

**REVISED 2026-08-14.** An earlier version of this file stated that no logo file could be
retrieved in this run. That was wrong, and the reason it was wrong is worth recording: the
harness fetcher **saves a fetched binary to disk** even though it cannot render the bytes as
text. Four first-party PNGs were retrieved that way and are now in this folder. See
[`../../CAPABILITY.md`](../../CAPABILITY.md).

## Files on disk, all first-party, all verified with `file(1)`

| File | Source URL | Dimensions | Colours (measured) |
|---|---|---|---|
| `vauxhall-logo-stellantis-dam.png` | `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/vauxhall-logo.png` | 1080 x 1080, RGBA | `#eb0000` 80.68%, `#00003a` 19.32% |
| `vauxhall-stellantis-dam.png` | `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/vauxhall.png` | 1280 x 720, RGBA | identical to the above |
| `vauxhall-vertical-blue-presskit.png` | `https://www.media.stellantis.com/uploads/uk/brand/verticalbluecopy-69a81b0da8eff.png` | 1634 x 1411, RGBA | `#002a42` 98.25%, remainder anti-aliasing |
| `vauxhall-footer-logo-presskit.png` | `https://www.media.stellantis.com/uploads/uk/vauxhall-footerLogo.png` | 131 x 130, RGBA | `#ffffff` 100% |

No embedded ICC profile in any of the four, so sRGB is assumed.

**Caution on the fetcher's own metadata:** the fetching model reported pixel dimensions that
were wrong for three of the four files (it read 568 x 568 for the 1080 x 1080 file and
460 x 460 for the 131 x 130 file). `file(1)` and Pillow agree with each other and are the
authority here. Do not trust IHDR readings quoted out of a text rendering of a binary.

## What the mark actually is

Confirmed by viewing the files, not inferred.

**Construction:** a **vertical lockup**. A circular emblem sits above a wordmark. Inked
aspect ratio 1.1753 (emblem plus wordmark, excluding transparent margin).

**Emblem:** a circular ring enclosing a left-facing **griffin** in profile, wing raised, with
a **flag device carrying a letter V** held in front of it. The griffin, the ring and the flag
are one flat colour; the ground inside the ring is transparent, not white, so the emblem
reverses cleanly onto any background.

**Wordmark:** `VAUXHALL`, seven letters plus a repeated L, all caps, a heavy geometric sans
with flat terminals and a pointed apex on the A. Set noticeably wider than the emblem in the
DAM lockups. The wordmark is artwork in these files, not live text, so it identifies no
typeface. See [`../type/type.json`](../type/type.json): the corporate typeface remains
UNIDENTIFIED, and a logotype would not settle it even if it were identified.

## Variants evidenced

Three of the four canonical treatments are now evidenced by first-party files:

1. **Full colour**, red emblem plus navy wordmark. Two renditions, 1080 x 1080 and 1280 x 720.
2. **One-colour**, whole lockup in `#002a42`. This is the file whose name,
   `verticalbluecopy`, previously read as evidence of a blue-led identity. It is a monochrome
   variant of the same lockup.
3. **Reversed / knockout**, whole lockup in pure white, for dark backgrounds.

**Not evidenced:** a horizontal lockup, an emblem-only or wordmark-only mark, a
co-branding lockup with Stellantis or with a sub-brand, and any vector master. All four files
are raster. **No first-party SVG was located**, and `www.vauxhall.co.uk`, where a vector
master would normally sit, is walled.

The two DAM files are the **same artwork** at different canvas sizes: identical colour
proportions and aspect ratios of 1.1753 and 1.1755. They are one source in two renditions.
Do not cite them as two corroborating sources.

## The third-party artefact, and why it is now demoted

`https://upload.wikimedia.org/wikipedia/en/1/18/Vauxhall_logo_2019.svg` (3,146 bytes,
344 x 291, fair-use non-free). Source field: "Logo obtained from Logopedia", a Fandom fan
wiki. No author. Uploaded 2020-06-15. Authority A4, provenance FAILED.

It declares `#d7001c` and `#000037`. The Evans Halshaw dealer SVG declares the same two
values. **Both differ from the measured first-party assets** (`#eb0000`, `#00003a`). Two
third-party sources agreeing on a value that first-party artwork contradicts is the signature
of shared upstream lineage, not of independent corroboration. Full reasoning in
[`../color/palette.json`](../color/palette.json) under `contradictions`. Do not reproduce
either file as the official mark, and do not use their hexes.

## Rules

Clear space, minimum size, misuse, exclusion zone, co-branding, which variant to use when:
**none found on any reachable surface.** These live at logo-ladder rungs 1 and 2 (brand
portal, press kit), both unreachable. The Vauxhall press room has no logo download, no
brand-asset section and no press-kit link in its navigation, confirmed twice. Status is
**NOT REACHABLE**, not NOT PUBLISHED.

One rule can be *inferred* from the assets themselves, and it is inference, not published:
the transparent emblem interior and the existence of both a one-colour and a reversed
treatment together imply the mark is designed to sit on photography and on dark grounds.
That is a description of the artwork's capability, not a permission granted by the brand.
