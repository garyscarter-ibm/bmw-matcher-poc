# Stock fixtures

Point-in-time snapshots of the full national used stock for each brand, for
offline validation and tuning of the matching engine. **Not** a live source —
the app always fetches live; these let us replay rankings against real cars
without the network (and calibrate `MODEL_SPECS_*` / brand tuning against the
actual trim vocabulary).

## Files

- `bmw-cars.json`, `mini-cars.json` — every vehicle run through
  `mapVehicle(v, brand)`, i.e. exactly what the engine scores (line, body, fuel,
  0-62, boot, seats, tags, price…). **Committed.**
- `bmw-raw.json`, `mini-raw.json` — the raw feed vehicles (every field the
  platform returns). **Gitignored** (100M+); regenerate when you need them.

## Refresh

```
node scripts/dump-stock.js all        # both brands
node scripts/dump-stock.js mini       # one brand
```

Throttled + backs off on 429; a full national dump takes a few minutes.
Used stock churns, so these drift — re-run before a validation pass that needs
current stock. Counts at last capture: ~13k BMW, ~4.3k MINI.

## Example: replay a ranking offline

```js
import { readFileSync } from 'node:fs';
import { rankCars } from '../server/engine.js';
import { brandTuning } from '../server/brands.js';
const cars = JSON.parse(readFileSync('fixtures/mini-cars.json', 'utf8'));
const top = rankCars(answers, cars, brandTuning('mini'))[0];
```
