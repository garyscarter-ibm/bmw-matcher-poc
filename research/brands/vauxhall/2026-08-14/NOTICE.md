# Provenance and licence notice

Brand: Vauxhall (Vauxhall Motors Limited, Stellantis N.V.)
Market researched: United Kingdom
Run date: 2026-08-14
Run capability: `text-only`

## Trademark statement

Vauxhall, the Vauxhall griffin device, GSE, VXR, Vizor, Pure Panel, Corsa, Astra, Mokka
and Grandland are trademarks of Vauxhall Motors Limited or of Stellantis N.V. Opel and
the Opel Blitz device are trademarks of Opel Automobile GmbH. All other marks named in
this run (SMMT, ASA, BCAP, FCA, VCA, Evans Halshaw, Pentagon, Novuna, Alcon, Hoefler &
Co, imgix, Sitecore, Fandom) belong to their respective owners.

Everything in this folder was collected for reference and analysis. Nothing here is a
grant of any licence, and nothing here was collected with permission from the trademark
owner. Third-party trademarks appear here for identification only.

## Assets downloaded to disk: SIX

> **CORRECTED 2026-08-14.** An earlier version of this file stated "**Assets downloaded to
> disk: NONE**" and gave three reasons why no binary could land. The third reason,
> "WebFetch returns model-processed text, never bytes", is **wrong**. The harness fetcher
> **also saves the response body to disk** and reports the path, and that path is readable
> from the sandboxed shell. Six binaries were retrieved on that route. The other two reasons
> stand: the shell still has no network, and there is still no browser. Route documented in
> [`CAPABILITY.md`](CAPABILITY.md).

Total retrieved: **six files, about 8.9 MB fetched**, of which **about 720 KB is retained**
in the run folder. The 8.8 MB PDF was read and not kept, on the grounds that it is freely
re-fetchable and a 519-page filing is not brand evidence in itself.

### Per-asset provenance

Licence status for every Vauxhall and Stellantis asset below is **brand-owned**. None may be
redistributed. All were collected for reference and analysis only.

| File in this run | Source URL | Source id | Retrieved | Published | Licence |
|---|---|---|---|---|---|
| `visual/logo/vauxhall-logo-stellantis-dam.png` | `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/vauxhall-logo.png` | `s85` | 2026-08-14 | unknown, live 2026-08-14 | **brand-owned** |
| `visual/logo/vauxhall-stellantis-dam.png` | `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/vauxhall.png` | `s86` | 2026-08-14 | unknown, live 2026-08-14 | **brand-owned** |
| `visual/logo/vauxhall-vertical-blue-presskit.png` | `https://www.media.stellantis.com/uploads/uk/brand/verticalbluecopy-69a81b0da8eff.png` | `s87` | 2026-08-14 | unknown, live 2026-08-14 | **brand-owned** |
| `visual/logo/vauxhall-footer-logo-presskit.png` | `https://www.media.stellantis.com/uploads/uk/vauxhall-footerLogo.png` | `s88` | 2026-08-14 | unknown, live 2026-08-14 | **brand-owned** |
| `raw/visual/mokka-gse-press-image-01.jpg` | `https://admin.media.stellantis.com/uploads/uk/content-image/6742/image-20260713123714-1_6a54cdeb35ab0.jpeg` | `s89` | 2026-08-14 | 2026-07-13 | **brand-owned, press-photography terms unknown, see below** |
| `raw/audience/stellantis-2025-annual-report-extract.txt` (5 pages of text, extracted; the 8.8 MB PDF itself was **not retained**) | `https://www.stellantis.com/content/dam/stellantis-corporate/investors/financial-reports/Stellantis-NV-20251231-Annual-Report.pdf` | `s68` | 2026-08-14 | 2026-02-26 | **corporate-owned.** A published regulatory filing (Annual Report and Form 20-F). Quoted for research |

**On the four logo PNGs.** All four are the Vauxhall mark, which is a registered trademark.
They are held here as measurement evidence: the palette values in
[`visual/color/palette.json`](visual/color/palette.json) were measured from these pixels and
cannot be checked later without them. Retaining them for that purpose is not a licence to
reproduce the mark. Two of the four (`s85` and `s86`) are the **same artwork** at different
canvas sizes. None carries an embedded ICC profile. No first-party **SVG or other vector
master** was located; all four are raster, and the walled `www.vauxhall.co.uk` is where a
vector master would normally sit.

**On the press photograph.** Licence status is **unknown, and specifically so.** The press
room exposes a "Select files to download" affordance and an "Embed code" control, which
implies press images are intended for redistribution, but **no usage, credit or copyright
statement was found anywhere** on the release, the galleries or the footer. Terms may sit
behind a media registration flow that was not entered. **Do not assume a press licence from
the download button alone.** The retained file is the 378 x 252 web-optimised inline copy,
not the full-resolution press asset.

## Located but not retrieved: first-party asset URLs

Every URL below was confirmed live on 2026-08-14, and each is **brand-owned**. These were
located but left unfetched, so an unblocked run can retrieve them and attach provenance then.

| URL | Type | Why not retrieved |
|---|---|---|
| `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/Vauxhall-Grandland.jpg` | JPG | product photography, not identity evidence |
| `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/gallery/Vauxhall-Frontera.jpg` | JPG | same |
| `https://www.stellantis.com/content/dam/stellantis-corporate/brands/vauxhall/gallery/Vauxhall-Vivaro-Electric.jpg` | JPG | same |
| Ten further inline JPEGs from the Mokka GSE release of 2026-07-13 | JPG | **each URL carries its own hash suffix and cannot be guessed.** A `-5_` variant with the same hash returns 404. Full filename list in [`visual/imagery/imagery.md`](visual/imagery/imagery.md) |
| The `shootinglocationsvauxhallgseevent` PDF referenced by the press portal | PDF | URL never fully resolved |

## Third-party artefacts that were read as text

These were read, not downloaded. Both are **third-party** and neither is the official
mark.

| Artefact | Licence status | Note |
|---|---|---|
| `https://upload.wikimedia.org/wikipedia/en/1/18/Vauxhall_logo_2019.svg` (3,146 bytes, 344 x 291) | **third-party-hosted, non-free.** The file page declares Fair use, NonFree true, Copyrighted True | Source field reads "Logo obtained from Logopedia", a Fandom fan wiki. No author. Uploaded 2020-06-15 by Conor M98, current revision 2020-12-28. Authority A4, **provenance check FAILED.** Shape reference only. Do not reproduce as the official mark. It is the sole origin of the two hex candidates in this run |
| `https://www.evanshalshaw.com/-/media/evanshalshaw/logos/vauxhall/vauxhall-svg.svg` | **brand-owned mark on a third-party retailer host.** No licence stated | A Vauxhall lockup in the Sitecore media library of a UK franchise group. Inkscape-edited, viewBox 0 0 59 50, undated. Declares `#d7001c` and `#000037` in its own style block |

## Typefaces

**No typeface file was downloaded: Vauxhall's brand typeface is UNIDENTIFIED by this run.**
No family name, no foundry, no weight set. See
[`visual/type/type.json`](visual/type/type.json).

The reason is now **not** a capability limit. Binaries are retrievable (see above), so a
`woff2` would have downloaded as easily as the logo PNGs did. The blocker is that **no
Vauxhall font file was ever located**: `@font-face` declarations live on
`www.vauxhall.co.uk`, which is walled, and the fetcher strips `<style>` and
`<link rel=stylesheet>` from every page it converts. Nothing was found to download.

One typeface caution to carry forward anyway, because it is the classic trap here: the
only `@font-face` families observed anywhere in this run were **Gotham** (GothamMedium,
GothamBold, GothamProReg) and **Open Sans**, and they belong to the **Stellantis press
portal**, not to Vauxhall. Gotham is a licensed retail face from Hoefler & Co and cannot
be redistributed or self-hosted without a licence. Open Sans is open-licence. Neither is
evidence about Vauxhall's brand typeface and neither may be recorded as one.

## Text quoted in this run

Verbatim first-party quotes are preserved exactly, punctuation included, because they are
evidence of voice and mechanics. They are quoted for analysis under fair dealing for
research. The principal sources quoted are Stellantis UK press releases (2026-05-06 to
2026-08-12), `www.stellantis.com/en/brands/vauxhall`, and the MyVauxhall app store
listings. Full attribution per quote sits in [`sources.json`](sources.json) and in the
copy dimension's own files.

## Untrusted input encountered

One page carried text resembling instructions. The WIPO Global Brand Database captcha gate
page included script text describing how its Altcha challenge could be skipped by
pre-seeding a browser storage key. That text arrived as fetched page data, was treated as
data, and was **not acted on**. Recorded here and in [`GAPS.md`](GAPS.md).

One paywalled source was **not bypassed**: the Brand New post "New Logo for Opel"
(2023-07-25) on underconsideration.com is subscriber-only and was left unread.
