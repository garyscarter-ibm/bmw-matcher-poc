# Verbatim fidelity caveat — read before using any quote in this folder

Retrieved 2026-08-14. Author: copy/voice agent. Applies to every file in `copy/`.

## The constraint

This run is text-only: no shell network, no browser, no WebSearch. `WebFetch` was the only
network tool. `WebFetch` renders a page to markdown and then answers a prompt against it
using a small model, and **that model enforces a hard cap of roughly 125 characters per
quoted excerpt.** It refused, repeatedly and explicitly, to transcribe a press release in
full, including when asked to split the text into sub-100-character lines.

Consequences for this evidence set:

1. **Short elements are recoverable exactly.** Headlines, summary bullets, footnotes,
   disclaimer lines, job titles, CTA lines and single sentences of spokesperson speech are
   naturally short, so most came back inside the cap and are reproduced here as written.
2. **Long sentences are truncated.** Where a line exceeded the cap the fetcher either cut
   it and I have marked it `[TRUNCATED]`, or paraphrased it and I have marked it
   `[FETCHER PARAPHRASE — not verbatim]`.
3. **The "ABOUT VAUXHALL MOTORS" boilerplate could not be recovered whole.** It was
   assembled from targeted single-sentence requests across two different releases, so its
   sentence order is evidenced but three of its sentences survive only as opening clauses.
4. **Nothing in this folder is invented.** Anything not directly quoted is labelled as a
   paraphrase, and the paraphrase is the fetcher's, not the brand's.

## Labelling convention used throughout

- `EXACT` — reproduced as a complete line by the fetcher, inside its cap.
- `[TRUNCATED]` — exact as far as it goes, then cut. The remainder is not recovered.
- `[FETCHER PARAPHRASE — not verbatim]` — the fetcher's own words describing brand text.
- `PARTIAL BULLET` — the fetcher stated up front that it had shortened the bullet list.

## What this does NOT compromise

Mechanics evidence (unit spacing, currency format, date format, casing, dash type,
capitalisation of product and technology names, footnote conventions) is unaffected,
because those are observable in the short elements that did come back exactly. The
mechanics read in `tone.md` is the highest-confidence part of this dimension.

## What it does compromise

Rhythm at paragraph scale. I could not count sentence lengths myself across a full body of
copy; the sentence-length figures in `tone.md` are the fetcher's characterisation of the
Ioan Lloyd rally release plus my own count over the short elements I do hold exactly. That
claim is marked `low` confidence and flagged in `tone.json`.

## Odd or directive-looking text encountered

None from the brand. No press release, footnote or app listing contained anything that read
as an instruction to a reader-agent. The only refusals and meta-instructions in this run
came from the `WebFetch` summarising model stating its own quoting policy, which is tooling
behaviour and not brand content.
