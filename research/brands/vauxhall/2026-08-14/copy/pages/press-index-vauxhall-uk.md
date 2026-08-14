# Vauxhall UK press room — release index

- URL: `https://www.media.stellantis.com/uk-en/vauxhall/press`
- Party: first. Authority: A2. Currency: current.
- Retrieved: 2026-08-14. Retrieval: text-only, HTTP 200.
- publishedAt: n/a (rolling index). Newest item 2026-08-12, oldest item on the index 2026-04-29.
- Recon source id: s11 covers the press room landing page; this is its `/press` index.

## Why this page matters

It is the register spine for the whole dimension. `vauxhall.co.uk` is walled (s1), so rung 2
of the voice ladder is structurally unavailable this run. This index is the only reachable
list of first-party Vauxhall prose, and it is dated.

## Pagination — PROBED, INERT

`?page=5` was fetched as a separate call and returned **the identical 20 items in the same
reverse-chronological order**, starting from the newest. No page-number links, no
next/previous controls, no load-more element appear in the rendered content.

Consequence, stated precisely: the reachable time spread is **2026-04-29 to 2026-08-12,
about 15 weeks**. A spread across years is NOT AVAILABLE from this surface as probed. The
RSS feed at `/uk-en/vauxhall/rss` was NOT PROBED (budget) and is the obvious next attempt.

## Index contents, verbatim, with dates (EXACT)

Headlines are set in ALL CAPS on the index. Dates render as `DD Mon YYYY`.

| Date | Headline (EXACT) | Type |
|---|---|---|
| 12 Aug 2026 | OVER A QUARTER OF BRITS THINK THEY COULD QUALIFY FOR THE LA2028 OLYMPIC GAMES, VAUXHALL RESEARCH REVEALS | survey/PR stunt |
| 05 Aug 2026 | NEW CORSA GSE – ATTAINABLE ELECTRIC HOT HATCH AVAILABLE FOR £32,995 | pricing/launch |
| 29 Jul 2026 | ON-STREET ELECTRIC VEHICLE CHARGING FOR DISABLED DRIVERS DOUBLES IN LAST 12 MONTHS, BUT 75% OF COUNCILS STILL HAVE NO ACCESSIBLE CHARGERS | campaign/advocacy |
| 28 Jul 2026 | VAUXHALL OPENS ORDERS FOR NEW MOKKA YES WITH ENHANCED SPECIFICATION AND UNIQUE STYLING | orders open |
| 24 Jul 2026 | VAUXHALL ASTRA & ASTRA SPORTS TOURER - PRESS INFORMATION | full press pack |
| 20 Jul 2026 | IOAN LLOYD CLAIMS THIRD CONSECUTIVE PODIUM AT RALLYE WEIZ DURING ADAC GSE RALLY CUP | motorsport |
| 16 Jul 2026 | VAUXHALL ANNOUNCED AS OFFICIAL AUTOMOBILE PARTNER OF THE NOVUNA LONDON ATHLETICS MEET | sponsorship |
| 13 Jul 2026 | NEW VAUXHALL MOKKA GSE – PRESS INFORMATION | full press pack |
| 06 Jul 2026 | VAUXHALL ACHIEVES TOTAL MARKET SHARE OF 4.8% IN FIRST HALF OF 2026 | business results |
| 16 Jun 2026 | VAUXHALL GRANDLAND PRODUCTION BECOMES MORE EFFICIENT WITH NEW MONOCOAT PAINT PROCESS | manufacturing |
| 15 Jun 2026 | IOAN LLOYD CELEBRATES VAUXHALL'S FIRST WIN IN ADAC GSE RALLY CUP | motorsport |
| 10 Jun 2026 | THREE VAUXHALL MODELS IN TOP 10 OF AUTO EXPRESS DRIVER POWER SURVEY | third-party award |
| 01 Jun 2026 | IOAN LLOYD SECURES PODIUM FINISH FOR VAUXHALL ON ITS RETURN TO MOTORSPORT | motorsport |
| 28 May 2026 | VAUXHALL OPENS ORDERS FOR NEW ASTRA AND INTRODUCES PETROL AUTOMATIC VERSION | orders open |
| 26 May 2026 | VAUXHALL REVEALS FIRST IMAGES OF MOKKA GSE RALLY AHEAD OF 2026 SEASON OPENER IN THE NETHERLANDS | motorsport |
| 14 May 2026 | VAUXHALL VANS: ELECTRIC FOR THE SAME MONTHLY PRICE AS DIESEL | commercial vehicles |
| 11 May 2026 | VAUXHALL ANNOUNCES NEW SALES EVENT WITH ADDITIONAL £1,000 SAVING | retail offer |
| 08 May 2026 | VAUXHALL ANNOUNCES NEW C-SEGMENT SUV IN EUROPE, FIRST MODEL OF THE INTENDED EXPANDED PARTNERSHIP WITH LEAPMOTOR | corporate/product |
| 06 May 2026 | NEW VAUXHALL CORSA GSE: ELECTRIFYING REBIRTH OF THE HOT HATCH | reveal |
| 29 Apr 2026 | VAUXHALL OPENS ORDERS FOR NEW GRANDLAND GRIFFIN WITH ENHANCED SPECIFICATION AND LOWER PRICE | orders open |

## Structural observations from the index alone

- **URL slugs are the headline, lowercased and hyphenated, with punctuation and currency
  stripped**: `£32,995` becomes `32-995`, `4.8%` becomes `4-8`, `VAUXHALL'S` becomes
  `vauxhall-s`. Slugs are not truncated, so they run to 130+ characters.
- **Headline verb habits, counted over 20 items**: `OPENS ORDERS FOR` x3,
  `ANNOUNCES` / `ANNOUNCED` x3, `REVEALS` x2, `ACHIEVES` x1, `CELEBRATES` x1, `CLAIMS` x1,
  `SECURES` x1. Active, third-person, present tense throughout. No headline uses "we",
  none addresses the reader, none carries a question mark or exclamation mark.
- **Two headline dash styles coexist**: spaced en dash in
  `NEW CORSA GSE – ATTAINABLE...` and `NEW VAUXHALL MOKKA GSE – PRESS INFORMATION`, spaced
  hyphen in `VAUXHALL ASTRA & ASTRA SPORTS TOURER - PRESS INFORMATION`. A colon also
  appears: `NEW VAUXHALL CORSA GSE: ELECTRIFYING REBIRTH OF THE HOT HATCH`,
  `VAUXHALL VANS: ELECTRIC FOR THE SAME MONTHLY PRICE AS DIESEL`.
- **Ampersand used in a headline** rather than "and": `ASTRA & ASTRA SPORTS TOURER`.
- **No "About Vauxhall" boilerplate on the index page itself.** Recon (s11) recorded this
  correctly. It sits at the foot of the individual releases instead, under the ALL CAPS
  heading `ABOUT VAUXHALL MOTORS`, followed by `ENDS` above it.
- Page furniture is Stellantis-group, not Vauxhall: brand selector listing all 14 brands,
  `Press Releases` / `Images` / `Videos` / `Communications Staff` / `RSS` nav, and a
  newsletter block reading `Sign up for the Stellantis Communications Newsletter and stay
  updated on all the news.` with the button `SIGN UP NOW`. Treat that furniture as parent
  register, not Vauxhall register.
