# BMW MODEL_SPECS gap fill (sources)

The used-stock dump (`fixtures/bmw-cars.json`, ~13k cars) surfaced 12 BMW lines
that had no `MODEL_SPECS_BMW` entry and were falling back to `DEFAULT_SPEC`
(43 cars, 0.3%). One of those ("I Series") was a mapping bug, not a missing
spec. All are now handled in [server/mapping.js](../server/mapping.js).

## Mapping fixes (no spec needed)

- **"I Series"** — the feed's generic catch-all title; the real model is in the
  derivative (`iX xDrive50 M Sport…`). `lineFromTitle` now derives the i-line
  from the derivative → maps to the existing `iX` spec. (8 cars, all iX.)
- **"Z3 Series" / "Z8 Series"** — folded to the bare `Z3` / `Z8` spec keys.
- **Alpina** — inconsistent titles ("Alpina B3", "Alpina XB7", or "Alpina
  Unspecified Models" with the model in the derivative). Normalised to
  `Alpina <model>` keys.

## Spec figures added

Sourced from carwow / Auto Express / Parkers (Parkers publishes 0-60 mph, used
as a close proxy for 0-62; official 0-62 is ~0.2-0.3s slower). boot = litres,
seats up. Base/slowest-common trim's 0-62.

| Line | boot (L) | seats | 0-62 (s) | body | source |
|---|---|---|---|---|---|
| i8 | 154 | 4 | 4.4 | coupe | carwow / Auto Express |
| 2 Series Gran Tourer | 560 | 7 | 9.5 | mpv | Parkers (218i) |
| 6 Series Gran Coupe | 460 | 5 | 5.4 | saloon | Auto Express / carwow (640i/d) |
| 3 Series Gran Turismo | 520 | 5 | 7.7 | hatchback | Parkers (320d) |
| 5 Series Gran Turismo | 590 | 5 | 6.7 | hatchback | Parkers (530d) |
| Z8 | 200* | 2 | 4.5 | convertible | Parkers (0-62); *boot not published, estimated |
| Z3 | 165* | 2 | 6.7 | convertible | Parkers (2.8i); *boot not published, estimated |
| Alpina B3 | 500 | 5 | 3.8 | estate | Parkers (G21 Touring Bi-Turbo) |
| Alpina D3 | 500 | 5 | 4.6 | estate | Parkers (D3 S Touring) |
| Alpina D5 | 530 | 5 | 4.7 | saloon | Parkers (D5 S) |
| Alpina XB7 | 326 | 7 | 4.1 | suv | Parkers / X7 body |

\* Z8 and Z3 boot capacity is not published by the cross-checked UK sources
(both list "not known"); estimated from their class (small 2-seat roadsters).
They are 1 car each in the dump and 20+ years old, so the estimate has
negligible impact on matching.

Refresh coverage after a new dump with:
`node scripts/dump-stock.js bmw` then re-map and re-run the gap check.
