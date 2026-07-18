# MINI 0-62 mph figures (sources)

The MINI 0-62 mph acceleration figures used by `MODEL_SPECS_MINI` and
`miniTrimZeroTo62` in [server/mapping.js](../server/mapping.js) are official
MINI / manufacturer figures cross-checked across authoritative UK sources
(carwow, Auto Express, ev-database.org, BMW Group Press). They are NOT
estimates. Current generation (2024+ F66 Hatch, U25 Countryman, J01/J05
electric) except the Clubman, which is the discontinued F54.

Note on basis: carwow and parkers label their table figures "0-60 mph" while
MINI official / Auto Express / ev-database use "0-62 mph (0-100 km/h)". For
almost every variant the number is identical, so carwow's "0-60" is effectively
the official 0-62 relabelled. Where sources genuinely conflict, we use the
official MINI 0-62 figure for a consistent basis.

| Variant | 0-62 (s) | Source |
|---|---|---|
| Cooper C (petrol hatch) | 7.7 | carwow |
| Cooper S (petrol hatch) | 6.6 | carwow / parkers |
| Cooper E (electric hatch, ~184hp) | 7.3 | ev-database / carwow |
| Cooper SE (electric hatch, ~218hp) | 6.7 | ev-database / carwow |
| JCW hatch (petrol, ~231hp) | 6.1 | carwow / Auto Express |
| JCW Electric hatch (~258hp) | 5.9 | carwow / Autocar / ev-database |
| Countryman C (petrol) | 8.3 | carwow |
| Countryman S ALL4 (petrol) | 7.1 | carwow |
| Countryman E (electric FWD ~204hp) | 8.6 | ev-database / carwow |
| Countryman SE ALL4 (electric ~313hp) | 5.6 | ev-database / carwow |
| JCW Countryman (petrol ALL4 ~300hp) | 5.4 | carwow (parkers: 5.2 for 295hp) |
| Aceman E (~184hp) | 7.9 | carwow |
| Aceman SE (~218hp) | 7.1 | carwow / ev-database |
| JCW Aceman (electric ~258hp) | 6.4 | carwow / ev-database |
| Cooper Convertible C (petrol) | 8.2 | Auto Express / What Car? (parkers: 7.9) |
| Cooper Convertible S (petrol) | 6.9 | Auto Express / carwow (parkers: 6.7) |
| JCW Convertible (petrol ~231hp) | 6.4 | BMW Group Press (parkers: 6.2) |
| Clubman Cooper (petrol, F54) | 9.0 | Auto Express 9.2 (0-62) / parkers 8.9 (0-60) |
| Clubman Cooper S (petrol, F54) | 7.3 | Auto Express / Honest John (parkers ~7.0) |
| JCW Clubman 306HP (ALL4) | 4.9 | Auto Express / BMW Group Press |
| Coupe JCW (discontinued R58) | 6.9 | historical MINI spec |

### How these map in mapping.js

- `MODEL_SPECS_MINI[line].zeroTo62` holds the **base** (slowest common) trim per
  line: Hatch/Electric Cooper C/E, Convertible C, Clubman Cooper, Countryman C,
  Aceman E.
- `miniTrimZeroTo62(base, line, derivative)` overrides for S / SE / JCW trims,
  keyed off the trim badge in the derivative (and the line for the ALL4/JCW
  crossovers).
- The petrol vs electric JCW hatch (6.1 vs 5.9) can't be told apart from the feed
  derivative, so both use 6.1 — a 0.2s difference that doesn't change scoring
  (both max the performance dimension).

Refresh the derivation against real stock with `node scripts/dump-stock.js mini`
and inspect `fixtures/mini-cars.json`.
