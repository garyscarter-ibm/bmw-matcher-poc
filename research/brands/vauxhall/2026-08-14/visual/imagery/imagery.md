# Imagery and art direction — Vauxhall — 2026-08-14

## Read this first: what this file is, and is not

> **REVISED 2026-08-14 by the run owner.** ~~**No image was viewed.**~~ **One image was
> retrieved and viewed**, after this file was written, once the binary-retrieval route was
> found. See "The one photograph actually seen" below. Everything else in this file remains
> filename-and-alt-text inference and is still capped at `low`.

~~**No image was viewed.**~~ This run has no browser and no shell network. Everything below
except the one section flagged as measured is inferred from **image filenames, alt text,
attachment filenames and press-release body copy** on the live first-party press room. It is
a description of what the text says about the pictures, not a description of the pictures.
Confidence is capped at `low` for any claim about how a photograph actually looks.

## The one photograph actually seen

| Field | Value |
|---|---|
| File | [`../../raw/visual/mokka-gse-press-image-01.jpg`](../../raw/visual/mokka-gse-press-image-01.jpg) |
| Source | `https://admin.media.stellantis.com/uploads/uk/content-image/6742/image-20260713123714-1_6a54cdeb35ab0.jpeg` |
| Source id | `s89` |
| Published | 2026-07-13, in the Mokka GSE press information release |
| Dimensions | 378 x 252, JPEG, 15.9 KB |
| Confidence | **high** on what the picture shows, because it was viewed |

**What it shows.** Not the Mokka GSE. A **white 1980s Astra GTE three-door**, photographed
in a panning motion shot: low three-quarter front angle, natural daylight, hillside scrub in
the background, motion blur across the wheels and the background while the car stays sharp.
Heritage photography, not product photography.

**Why it matters beyond itself.** The industry dimension found that Vauxhall's GSE
sub-brand claims lineage from **GTE and GSi** and never mentions VXR or OPC. This is that
claim made in a picture rather than a sentence: the lead image of a 2026 electric
performance launch is a forty-year-old petrol hot hatch. It is one image, so it evidences
one editorial choice, not an art-direction rule.

**Two limits.** At 378 x 252 this is the **web-optimised inline copy**, not the
full-resolution press asset, so it cannot support a claim about grading or crop
conventions. And sibling URLs **cannot be guessed**: each asset carries its own hash suffix
and the `-5_` variant with the same hash returns 404. The remaining ten inline images of
this release would each need their own URL discovered.

A second, sharper limitation: **the press-room galleries are client-side rendered.** Three
separate gallery URLs were fetched and all three returned only the navigation shell with
zero gallery items, zero captions and zero asset URLs. So the richest source of
first-party captions on the whole site was reachable but unreadable. That is a
**capability gap, probed**, not an absence of captions.

Gallery URLs that returned an empty shell (record for a later unblocked run):

- `https://www.media.stellantis.com/uk-en/vauxhall/media-library/gallery`
- `https://www.media.stellantis.com/uk-en/vauxhall/media-library/press-images/574244?model=corsa`
- `https://www.media.stellantis.com/uk-en/vauxhall/corsa`
- `https://www.media.stellantis.com/uk-en/vauxhall/media-library/press-videos`

## Observed: asset inventory from one press release

Source: `https://www.media.stellantis.com/uk-en/vauxhall/press/new-vauxhall-mokka-gse-press-information`,
published 2026-07-13, authority A2, first-party, current.

Eleven inline JPEGs, all on the admin asset host, all sequentially named with a single
generation timestamp:

```
https://admin.media.stellantis.com/uploads/uk/content-image/6742/image-20260713123714-1_6a54cdeb35ab0.jpeg
... through ...
https://admin.media.stellantis.com/uploads/uk/content-image/6742/image-20260713123714-11_6a54cdec1a9a3.jpeg
```

Thumbnail: `https://www.media.stellantis.com/cache/8/a/e/e/f/8aeefcaf6b99b696027fbba5fe710a0628579e52.jpeg`

Full-resolution galleries attached to the same release:
`/uk-en/vauxhall/media-library/press-images/655608?pr=6742` and
`/uk-en/vauxhall/media-library/press-videos/656172?pr=6742` (both shell-only, see above).

**Observed convention: press images carry no captions.** Every one of the eleven inline
images renders as an untitled element with empty alt text. The only alt text on the page
is the article thumbnail, which simply repeats the headline,
`"NEW VAUXHALL MOKKA GSE – PRESS INFORMATION"`. Filenames are machine-generated and carry
no descriptive content. So Vauxhall's press photography is published **undescribed**, and
the usual route of reading art direction off captions is closed for this brand
specifically, not just for this run.

**Observed: no image usage, credit or copyright statement anywhere.** Not on the release,
not in the footer, not on any gallery shell. The footer carries only a privacy policy, a
cookie policy and an RSS link. There is a UI affordance labelled `"Select files to
download"` and an `"Embed code"` control with a copy action, which implies press images
are intended to be redistributed, but **no stated conditions were found**. Record as NOT
PUBLISHED on the reachable surface, with the caveat that a media-registration flow may
state terms behind a login that was not entered.

## Inferred: one strong art-direction signal, from an attachment filename

The same release attaches two PDFs:

- `/uploads/uk/attachment/6742/specsheetvauxhallmokkagse-6a54d63882cf9.pdf`
- `/uploads/uk/attachment/6742/shootinglocationsvauxhallgseevent-6a54d63885636.pdf`

The second reads **"shooting locations vauxhall gse event"**. A brand that issues a
locations document to press alongside a launch is running **on-location photography at a
press driving event**, not studio-only capture. This is the single most direct evidence
about art direction found this run, and note that it is still an inference from a
filename: the PDF itself was not read ~~(it is a binary and could not be downloaded)~~.
Confidence `low`, authority A2, and it is worth one fetch on an unblocked run because a
shooting-locations document is close to a stated photography convention.

> **REVISED 2026-08-14.** The struck reason is **wrong**. Binaries **are** retrievable on
> this install, and a 519-page PDF was in fact downloaded and read later in the run. The real
> blocker for this document is narrower and worth stating precisely: **its full URL was never
> resolved.** The path above was read out of the release markup, and the trailing hash suffix
> that every asset on this host carries could not be confirmed for it. So this is
> **NOT REACHABLE for want of a URL**, not a capability limit. One fetch closes it the moment
> the URL is known.

## Inferred: subject and finish vocabulary from body copy

These are verbatim quotes from the release body. They describe the **product**, and only
indirectly what the photography emphasises. Treat as vocabulary evidence, not as
photographic direction.

- `"sleek, modern, and aggressive lines that make an immediate statement of its performance pedigree"`
- `"tinted rear windows, and high-gloss cladding to give an athletic silhouette"`
- `"Prominent bumpers and grille inserts with a rally-inspired look"`
- `"a lower grille framed by a distinctive GSE accent and logo enhance the front profile"`
- `"GSE badged panels are located along the flanks of the vehicle"`
- `"20-inch GSE performance diamond-cut two-tone alloy wheels"`
- `"Black bonnet (optional) – a nod to bonnets fitted to Vauxhall rally car legends of old"`

Reading these as a set: the copy repeatedly directs attention to the **front profile**,
the **flank/silhouette** and the **wheels**. Front three-quarter and profile framing would
serve that copy, and detail shots of badging and callipers are implied by the badge,
lettering and calliper references. **This is a reading of the copy, not an observation of
the images.** No angle is stated anywhere.

## Not established

| Question | Status |
|---|---|
| Studio vs location, as a stated convention | INFERRED (location, from one attachment filename). Not stated. |
| Camera angle convention | NOT PUBLISHED on the reachable surface. Not inferable beyond the copy reading above. |
| Human presence in brand photography | NOT FOUND. No caption, alt text or body sentence in any fetched page references a person, driver, model or occupant. Cannot be reported as absence: the galleries were unreadable. |
| Environment (urban, rural, road, plinth) | NOT FOUND. The shooting-locations PDF would answer it and was not readable. |
| Retouching, lighting or crop rules | NOT PROBED. No document exists on the reachable surface that would carry them. |
| Video/motion identity | NOT PROBED. `/uk-en/vauxhall/media-library/press-videos` is shell-only; Opel's footage host `opel-tv-footage.com` was discovered but not fetched. |

## Adjacent, Opel only, do not attribute to Vauxhall

Opel's press room links an external footage library at
`https://www.opel-tv-footage.com/index.php` and serves gallery assets from a separate DAM
host, e.g. `https://stellantis3.dam-broadcast.com/medias/domain12808/media110502/3150615-lmaxb15qq8-whr.jpg`
(source: `https://www.media.stellantis.com/em-en/opel/`, retrieved 2026-08-14). The
`-whr` suffix and `dam-broadcast` host suggest a shared Stellantis DAM that may also serve
Vauxhall assets. Unverified for Vauxhall. Worth probing on an unblocked run.
