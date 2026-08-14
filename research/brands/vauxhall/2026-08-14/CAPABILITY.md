# Run capability — probed 2026-08-14

`run.capability: text-only`

## What was probed, and what came back

| Route | Target | Result |
|---|---|---|
| shell `curl` | `https://www.vauxhall.co.uk/` | `CONNECT tunnel failed, response 403`, curl exit 56, HTTP 000 |
| shell `curl` (desktop UA + `Accept: text/html`) | `https://www.stellantis.com/` | HTTP 000 |
| shell `curl` (desktop UA + `Accept: text/html`) | `https://web.archive.org/` | HTTP 000 |
| `WebFetch` | `https://www.vauxhall.co.uk/` | HTTP 403 |
| `WebFetch` | `https://www.vauxhall.co.uk/robots.txt` | HTTP 403 |
| `WebFetch` | `https://vauxhall.co.uk/sitemap.xml` | HTTP 403 |
| `WebFetch` | `https://www.opel.com/` | HTTP 403 |
| `WebFetch` | `https://www.stellantis.com/en/brands/vauxhall` | 200, readable |
| `WebFetch` | `https://registry.npmjs.org/-/v1/search?...` | 200, readable |
| `WebFetch` | `http://archive.org/wayback/available?url=www.vauxhall.co.uk` | 200, readable |
| `WebFetch` | `http://web.archive.org/web/20260714174129/...` | blocked by the harness fetcher |
| `WebFetch` | `https://media.vauxhall.co.uk/` | `ECONNREFUSED` (host resolves, refuses 443) |
| `WebFetch` | `https://uk-media.stellantis.com/` | `ENOTFOUND` |
| browser preview | attach to `https://www.vauxhall.co.uk` | unavailable: URL-attach previews are not enabled on this install |
| `WebSearch` | any | unavailable on this model (`web_search_20250305` not supported for claude-opus-5) |
| `WebFetch` (binary) | `.../brands/vauxhall/vauxhall-logo.png` | **200, binary saved to disk.** 1080 x 1080 PNG, retrieved and measured |
| `WebFetch` (binary) | `.../uploads/uk/brand/verticalbluecopy-*.png` | **200, binary saved to disk.** 1634 x 1411 PNG |
| `WebFetch` (binary) | `.../investors/financial-reports/Stellantis-NV-20251231-Annual-Report.pdf` | **200, 8.8 MB PDF saved to disk**, text extracted locally with `pypdf` |
| `WebFetch` (binary) | `admin.media.stellantis.com/.../image-20260713123714-1_*.jpeg` | **200, JPEG saved to disk.** 378 x 252 |
| `WebFetch` (binary) | same path, `-5_` with the same hash suffix | HTTP 404. Each asset carries its own hash, so sequential URLs cannot be guessed |

## Consequences for this run

1. **The brand's own website is unreachable by every available route.** The Stellantis
   brand-site estate (`vauxhall.co.uk`, `opel.com`) sits behind a WAF that returns 403 to
   the harness fetcher. The shell cannot reach any non-allowlisted host. The browser
   route, which normally rescues exactly this case, is not enabled here. The Wayback
   Machine, which normally proxies a walled site, is blocked at the fetcher.
2. ~~**No binary asset can land on disk.**~~ **CORRECTED 2026-08-14. Binaries CAN be
   retrieved, and five were.** This was the single most consequential wrong belief in the
   run and it was held for most of it. The harness fetcher **saves the response body to
   disk** even when it cannot render those bytes as text: it returns a note reading
   `[Binary content (image/png, 105KB) also saved to <path>]`, pointing at the session's
   `tool-results` directory, which the sandboxed shell CAN read. So the route is:

   `WebFetch <binary url>` → read the saved path out of the tool result → `cp` it into the
   run directory → verify with `file(1)`.

   Confirmed working for **PNG** (four first-party Vauxhall logo assets), **JPEG** (a press
   photograph) and **PDF** (the 519-page, 8.8 MB Stellantis 2025 Annual Report, which
   `pypdf` then extracted locally with no network). Two cautions learned the hard way:
   - The fetching model's own description of a binary is unreliable. It misreported the
     pixel dimensions of three of four PNGs. Always re-verify locally with `file(1)` or
     Pillow.
   - It is per-URL, so it does not defeat the WAF. It only works on hosts that already
     answer. `www.vauxhall.co.uk` remains 403 for binaries exactly as for text.

   Consequence: fonts, images, PDFs and documents are all retrievable from any *reachable*
   host, and a future `text-only` run should attempt them rather than recording them as
   URLs only.
3. **No measured web tokens and no screenshots.** Steps 6 and 7 of the skill remain
   undeliverable: there is no browser, so no computed styles, no `document.fonts`, no
   contrast pairs, no dark-mode check and no screenshots. But the run is **no longer free
   of measurements**. Consequence 2's route produced pixel-measured colour values from
   first-party artwork, and per the precedence rules those win on rendered facts. The
   distinction that matters downstream: colour is measured, **layout and typography are
   not**.
4. **No search engine.** Discovery runs on deterministic probes and known-host guesses
   rather than search, so absence of evidence in this run is weaker than usual. Anything
   not probed is recorded as not probed.

## What would unblock it

- Allowlist `www.vauxhall.co.uk`, `opel.com`, `media.stellantis.com` and
  `web.archive.org` for the shell (the `update-config` skill edits `settings.json`), then
  re-run. This is the single highest-value fix and would restore Steps 6 and 7.
- Or re-run in a session where the in-app browser preview can attach to a URL.
- Or re-run on a model with `WebSearch` available, to restore source discovery.
