# Spec vocabulary and unit conventions

Rung 2 (first-party dated press releases, 2026-05-14 to 2026-08-05). Confidence: high
for the forms observed, and the inconsistencies below are themselves the finding.

Sources: s44 (Astra press information, 2026-07-24), s45 (Corsa GSE, 2026-08-05),
s46 (vans, 2026-05-14), s53 (Mokka GSE press information, 2026-07-13).

## Power: PS and hp are BOTH used, kW is always parenthetical

This is the single largest internal inconsistency found.

| Form | Source | Date |
|---|---|---|
| `281PS (207kW)` and `281PS (207kW), 345 Nm of torque` | s45 | 2026-08-05 |
| `281hp (207kW)` | s53 | 2026-07-13 |
| `Electric 156PS`, `195PS`, `145PS`, `130PS` in variant strings | s44 | 2026-07-24 |
| `156hp`, `136hp engine + 21hp motor = 145hp`, `130PS` in prose | s44 | 2026-07-24 |
| `100hp`, `120hp`, `136hp` for vans | s46 | 2026-05-14 |
| `115bhp`, `158hp`, `100bhp`, `105bhp`, `197bhp` for heritage cars | s53 | 2026-07-13 |

Two press-information documents three weeks apart give the same 207kW figure as `281PS`
and `281hp` respectively. Observations on the pattern, offered as pattern not rule:
`PS` dominates inside formal variant designations; `hp` appears in vans and in flowing
prose; `bhp` appears only for historic vehicles. Metric `kW` is never the headline unit,
always the bracketed conversion. No space before the unit in `281PS`, `207kW`, `136hp`.

Derived power metrics: `181hp/tonne` (s45), `176hp/tonne` and `216Nm/tonne` (s53).

## Torque

`345Nm` (closed) and `345 Nm` (spaced) both appear in s45. Also `270Nm`, `360Nm`,
`230Nm` (s44), `300Nm`, `800Nm` (s53). Historic figure in imperial: `145lb/ft` (s53).

## Range, efficiency, CO2

- Range in **miles**, always with a WLTP qualifier: `up to 232 miles (WLTP)`,
  `220 miles of range (WLTP)`, `209 miles (WLTP)`, `up to 213 miles on a single charge
  (WLTP combined cycle)`, `range of up to 219 miles (WLTP combined cycle)`,
  `281 miles (hatch) / 275 miles (Sports Tourer)`, `52 miles EV range`.
- Ranges given as spans in tables: `280-281 (hatch); 274-275 (ST)`.
- EV efficiency in two different units: `4.1-4.2 miles/kWh` (s44) versus `3.4 m/kWh`
  and `3.5 m/kWh` (s53). The abbreviation `m/kWh` for miles per kWh is ambiguous and
  inconsistent with the spelled form used three weeks earlier.
- Fuel economy in **mpg**, as a span: `122.8mpg`, `57.6-58.9 mpg (hatch); 56.5-57.6
  (ST)`, `47.9-48.7mpg (hatch); 46.3-47.9 mpg (ST)`. Spacing before `mpg` varies within
  the same document.
- CO2 in `g/km`, as a span for combustion and PHEV: `49-52 g/km`, `108-112 / 111-114
  g/km`, `132-134 / 133-136 g/km`. BEVs given as `CO2 0 g/km` (s44) or just `CO2 0`
  (s53). Note s45, an all-electric car, states **no** CO2 figure at all.

## WLTP qualifier: five different capitalisations observed

`(WLTP)`, `(WLTP combined)`, `(WLTP Combined)`, `(WLTP Combined High)`,
`(WLTP combined cycle)`. All within four releases across three months. There is no
observable house rule. See `uk-regulatory-figure-presentation.md` for what the regulator
does and does not require here.

## Battery and charging

- Battery in `kWh`, with gross and useable distinguished: `54kWh (51kWh useable)
  lithium-ion battery`, `54kWh (gross) lithium-ion battery (51kWh useable capacity)`,
  `58kWh battery`, `17.2kWh` (PHEV), `52kWh battery (gross capacity)`, `75kWh battery
  (gross)`. Voltage occasionally: `377V` (s53).
- Charging speed in `kW`, time as a percentage window plus duration:
  `0-80% takes 30 minutes from a 100kW DC rapid charger`, `100kW DC 20-80% in 32
  minutes`, `0-100% charge from an 11kW AC charger will take 5 hours and 45 minutes`,
  `7kW AC charger will take approximately 7 hours and 30 minutes`, `11kW AC 3h 20min`,
  `7kW 8 hours`. Duration format varies: "5 hours and 45 minutes" versus "3h 20min"
  versus "5h 45 mins".
- On-board charger stated as a component: `An 11kW on-board charger`, and PHEV
  `3.7kW standard, 7.4kW option (£500)`.
- `V2L` used as an unexpanded initialism, with "adapter sold separately" (s53).

## Performance and dynamics

`0-62mph in 5.5 seconds` is the standard acceleration metric, and `0-60mph 8.5 seconds`
appears only for a 1984 heritage car. Top speed in `mph`: `112mph`, `93mph`, `124mph`,
`105mph`, `130mph`, `140mph ("84 electric")`. Drag coefficient as `0.269 (cd)` and
`0.30cd`. Deltas expressed as signed millimetres and percentages: `-24mm front, -11mm
rear`, `+54mm front, +20mm rear`, `+189% rear anti-roll stiffness`, `torsional stiffness
+31%`. Steering as a bare ratio, `14.5 rack ratio`, plus `2.7 turns lock-to-lock` and
`turning circle 10.41m`. Brakes in `mm`: `355mm front brake discs`, `380mm ventilated
front, 268mm rear`, with the supplier trademarked: `Alcon® four-piston front callipers`,
`Torsen® lock`.

## Dimensions, weight, capacity

Dimensions in `mm` with thousands separators: `length 4,374mm / 4,642mm`, `width
1,859mm`, `height 1,441mm`, `wheelbase 2,675mm`. Van lengths in metres instead:
`Medium (4.98m) or XL (5.33m)` (s46). Weight in `kg`: `Kerb weight 1,597kg`, `GVW
1,830kg`, `876kg`. Boot volume in **litres**, seats-up then seats-folded:
`310 litres seats up; 1,060 seats folded (to roof)`, `352/516 and 1,268/1,553 litres`.
Small storage also in litres to one decimal: `armrest 6.2 litres`, `door pockets 2.6
litres`, `glovebox 7.7-litre`. Van load volume in **spelled-out cubic metres**:
`4.4 cubic metres`, `6.6 cubic metres`, not `m3`.

## Tyres, safety, ratings

Tyre spec written in full with EU label grades: `Michelin Pilot Sport EV 225/40 R20
(wet A / efficiency C)`, `Goodyear Eagle F1 Asymmetric 3 (wet B / efficiency B)`, and
range is quoted **per tyre choice** (`201 miles (Michelin) / 209 miles (Goodyear)`),
which is a WLTP consequence worth noting. `Euro NCAP four-star` with the four
sub-scores as percentages: `adult 73%, child 75%, vulnerable road users 58%, safety
assist 64%`. Lighting counted: `Intelli-Lux HD with more than 50,000 elements (from
168)`.

## Money, tax and warranty

`£27,495 (On The Road)` and `The official On-The-Road (OTR) price is £34,495` (both
hyphenations appear), `£34,495 OTR (£32,995 inc. Electric Car Grant*)`, `P11D price
£34,430`, `VED (Yr.1/Yr.2-) £10/£200`, `BiK rate (26/27) 4%`, `insurance 32E`,
`No Cost Option`, `£650 optional extra`. Warranty: three years, unlimited mileage in
year one, 60,000 miles years two and three; EV battery `eight-year/100,000 miles`
guaranteeing at least 70% of original charging capacity (s44).

## Gaps

- No first-party style guide for units. Everything above is induced from usage.
- Movano figures not collected: s46 names `Movano Electric` but the fetched extract
  carried payload and volume for Combo and Vivaro only.
- Towing collected for vans only (`towing capacity (braked) of 750kg` / `1,000kg`),
  none for cars.
