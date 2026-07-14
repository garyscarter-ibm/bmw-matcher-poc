# BMW / Grassick's design tokens

Status: **spec complete, not yet applied**. Extracted directly from
`grassicksbmw.co.uk` (computed styles, live-inspected) so the matcher can be
reskinned to sit seamlessly inside a BMW retailer site. This is the
"design tokens first" phase from [live-stock-plan.md](live-stock-plan.md) —
a documented variable layer, applied lightly; the full visual reskin of
`bmw-matcher.css` is the next step once this is signed off.

## Font

Grassick's uses BMW's official proprietary typeface, in four weights:

```
BMWTypeNextLatin-Thin
BMWTypeNextLatin-Light      ← headings
BMWTypeNextLatin-Regular    ← body
BMWTypeNextLatin-Bold       ← eyebrow/micro-labels
```

**Proprietary — cannot be shipped or hotlinked.** On the real EDS/retailer
site it will already be loaded site-wide, so the block should simply
reference the family name and fall through. For the standalone preview
harness, fall back to a neutral system stack that approximates the
light/geometric feel:

```css
--bmwm-font-heading: 'BMWTypeNextLatin-Light', 'Helvetica Neue', Arial, sans-serif;
--bmwm-font-body: 'BMWTypeNextLatin-Regular', 'Helvetica Neue', Arial, sans-serif;
--bmwm-font-bold: 'BMWTypeNextLatin-Bold', 'Helvetica Neue', Arial, sans-serif;
```

## Colour

| Token | Value | Use |
|---|---|---|
| `--bmwm-ink` | `#262626` | primary text (dominant — 356 uses on the homepage) |
| `--bmwm-ink-strong` | `#000000` | pure-black text/CTAs, top nav |
| `--bmwm-ink-muted` | `#666666` | secondary/caption text |
| `--bmwm-surface` | `#FFFFFF` | page background (dominant) |
| `--bmwm-surface-alt` | `#F5F5F5` | section band background |
| `--bmwm-surface-alt-2` | `#F9F9F9` | secondary section band |
| `--bmwm-surface-dark` | `#262626` | dark section band (e.g. offer banners over imagery) |
| `--bmwm-accent` | `#1C69D4` | **BMW Blue** — primary CTA, links, highlights |
| `--bmwm-accent-ink` | `#FFFFFF` | text/icon colour on the accent |
| `--bmwm-accent-secondary` | `#0085AC` | BMW i teal — secondary/electric-related accent |

Note: this is a **light theme** — the opposite of the matcher's current dark
graphite look. The reskin should default to light, with the existing dark
palette possibly kept as an optional dark-mode variant later.

## Type scale

Confirmed line-height is a consistent **1.2×** the font size throughout.

| Token | Size | Line-height | Weight/family | Transform | Use |
|---|---|---|---|---|---|
| `--bmwm-text-h1` | 40px (32px mobile) | 1.2 | Light | UPPERCASE | page hero heading |
| `--bmwm-text-h2-lg` | 36px | 1.2 | Light | none | section heading ("NEWS & OFFERS") |
| `--bmwm-text-h2` | 24–28px | 1.2 | Light | none/uppercase (contextual) | subsection heading |
| `--bmwm-text-h3` | 24px | 1.33 | Light | none | card/module heading |
| `--bmwm-text-body-lg` | 18px | 1.2 | Light | none | intro/lede paragraph |
| `--bmwm-text-body` | 16px | 1.5 | Regular | none | default body text |
| `--bmwm-text-label` | 13px | ~1.3 | Regular | none | button/UI label |
| `--bmwm-text-eyebrow` | 10px | 1.2 | **Bold**, letter-spacing 0.8px | none | micro-label above a heading (e.g. "Promotion") |

Mobile: h1 steps down 40px → 32px; treat other headings as scaling
proportionally (~80%) under a `min(...)`/`clamp()` or a single breakpoint.

## Spacing scale

Site-wide spacing values cluster on **multiples of 4px** (4, 8, 12, 16, 20,
24, 28, 40, 48, 56, 60, 64 all observed). Adopt a standard 4px-based scale:

```css
--bmwm-space-1: 4px;
--bmwm-space-2: 8px;
--bmwm-space-3: 12px;
--bmwm-space-4: 16px;
--bmwm-space-5: 20px;
--bmwm-space-6: 24px;
--bmwm-space-8: 32px;
--bmwm-space-10: 40px;
--bmwm-space-12: 48px;
--bmwm-space-16: 64px;
```

## Geometry

**Sharp, flat, editorial** — the opposite of the matcher's current rounded
pill-button dark-card look.

- Border radius: **`0px`** almost everywhere. The only rounded elements
  observed were a `4px` link and `50%` (avatar/icon circles). Cards have no
  radius, no box-shadow — flat colour fields or hard 1px borders only.
- Buttons: `1px solid` border (same colour as background for filled, or
  `#262626`/ink for outline), **no radius**, fixed height **46px**,
  `min-width: 232px` on primary CTAs, padding `12px 20px 15px` (note the
  asymmetric bottom padding — likely optical alignment for the typeface's
  cap-height), font-size 13px, weight 400, normal case (NOT uppercase,
  despite headings being uppercase).

```css
--bmwm-radius: 0px;
--bmwm-radius-soft: 4px;   /* rare exception, e.g. inline links */
--bmwm-btn-height: 46px;
--bmwm-btn-padding: 12px 20px 15px;
--bmwm-btn-min-width: 232px;
--bmwm-border-width: 1px;
```

## Buttons (confirmed variants)

| Variant | Background | Text | Border |
|---|---|---|---|
| Primary | `--bmwm-accent` (#1C69D4) | white | 1px solid `--bmwm-accent` |
| Secondary / outline | white | `--bmwm-ink` (#262626) | 1px solid `--bmwm-ink` |

Both variants share the same geometry (height, padding, radius, font-size).
This maps directly onto the matcher's existing `.bmwm-btn-primary` /
`.bmwm-btn-ghost` classes — same two-variant model, different values.

## Layout

- Full-bleed photographic hero with white text overlaid directly on the
  image (no scrim box) for the homepage banner.
- Black (`#000`) top navigation bar with the BMW roundel.
- Section bands alternate white / light-grey (`#F5F5F5`) to create rhythm
  without borders.
- No card component was found on the homepage itself (marketing-led, not
  inventory-led) — vehicle-tile styling wasn't directly observable there.
  When reskinning the matcher's result cards, extrapolate from the
  confirmed flat/no-radius/no-shadow geometry rather than copying a
  concrete card that wasn't found: flat colour fields, hard 1px dividers
  if any separation is needed, generous internal padding (24px+), photo
  full-width at the top of the card (16:9, matching the live stock photos'
  `aspect_ratio: sixteennine` from the usedcars API).

## Breakpoints

Only one confirmed data point: H1 steps from 40px → 32px between desktop
(1280px tested) and mobile (375px tested). No intermediate/tablet sample
taken. Reasonable default: treat the matcher's current single mobile-first
breakpoint approach as sufficient; a small max-width media query (e.g.
`@media (min-width: 768px)`) scaling headings up matches the observed step.

## Mapping onto the existing block

`bmw-matcher.css` already isolates everything under `.bmwm` with its own
custom properties (see the top of that file) — the reskin is a matter of
swapping those property values, not restructuring selectors. Plan:

1. Add the tokens above as a new `:root`/`.bmwm` custom-property block
   (light theme), leaving the current dark values as a commented-out
   alternate or a `data-theme="dark"` variant.
2. Swap accent blue, ink, and surface colours first (highest visual impact,
   lowest risk).
3. Set `--bmwm-radius: 0` and adjust `.bmwm-btn`, `.bmwm-option`,
   `.bmwm-card` accordingly — these currently use pill/rounded shapes that
   need to go fully square.
4. Apply the type scale to `.bmwm-title`/`.bmwm-question`/etc., including
   the uppercase treatment on top-level headings only (not body/buttons).
5. Verify contrast: `#1C69D4` on white passes AA for large text/UI but
   should be checked for small body text; `#262626` on white is safe.

## Not yet done

- No direct sample of a vehicle-listing/result card from a BMW retailer
  site (homepage is marketing-led). If a closer match is wanted, inspect
  `usedcars.bmw.co.uk`'s own search-results grid (already reverse-engineered
  for its API in [live-stock-plan.md](live-stock-plan.md)) for real card
  markup before finalising `.bmwm-card`.
- No dark-mode/alternate-theme confirmation from the retailer site itself
  (their dark sections are used for banners/overlays, not full dark theme).
