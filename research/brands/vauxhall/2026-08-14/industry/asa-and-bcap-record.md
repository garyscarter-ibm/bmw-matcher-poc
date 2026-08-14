# ASA record for Vauxhall, and the BCAP rules its ads have touched

Rung 1 to 2 (the regulator's own published case database and code text). Confidence:
high for what the database shows. This was flagged in the brief as potentially the best
find available. The result is valuable but **not in the way the brief anticipated**.

## The finding: zero formal rulings, five informally resolved cases

Searching the ASA rulings database for "Vauxhall" (s47) returns:

- **Rulings (0)**
- **Mail order cases (0)**
- **Database cases (0)**
- **Informally resolved (5)**

So there is **no formal ASA adjudication against Vauxhall in the searchable database**.
The brief's hope was that a ruling would quote the advertiser's copy verbatim, dated and
brand-named. **That evidence does not exist here**, because informally resolved cases are
settled without a formal adjudication and, per the ASA's own description on the page, the
informally resolved list records parties who "agree to amend or withdraw their ad without
being subject to a formal ruling". No advertisement copy is published for them.

Recorded as **NOT PUBLISHED**, not as not found: the cases exist, the copy does not.

## The five informally resolved cases

Advertiser name exactly as the ASA gives it: **"Vauxhall Motors Ltd"**.

| Date | Outcome | Complaints |
|---|---|---|
| 08 January 2025 | Informally resolved | 1 |
| 18 December 2024 | Informally resolved | 0 |
| 18 September 2024 | Informally resolved | 1 |
| 09 November 2022 | Informally resolved | 1 |
| 17 November 2021 | Informally resolved | 1 |

No per-case URLs are present in the fetched content, and the fetcher explicitly declined
to invent any. Whether per-case pages exist is **unresolved**.

Note the 18 December 2024 entry shows **0 complaints**, which implies an ASA-initiated or
compliance-team-initiated intervention rather than a consumer complaint. Recorded as an
observation.

## Which rules were engaged: the filter panel is the real prize

The search page's filter panel lists **BCAP Code** rules with counts: **3.1, 3.9, 3.33
and 3.39, each showing one case.** The fetcher notes these relate to the informally
resolved items rather than to any published ruling.

Two things follow. First, **BCAP** is the broadcast code, so these were **television or
radio** advertisements, not press or online. Second, we now know which four obligations
Vauxhall's broadcast advertising has actually fallen foul of. That is a targeted list, and
it is far more useful than a generic code summary.

Exact rule text, from BCAP Code section "03 Misleading advertising" (s51):

- **3.1, General:** "Advertisements must not materially mislead or be likely to do so."
- **3.9, Substantiation:** "Broadcasters must hold documentary evidence to prove claims
  that the audience is likely to regard as objective and that are capable of objective
  substantiation." The section adds that the ASA may treat unsubstantiated claims as
  misleading.
- **3.33, Availability:** "Advertisements must not provide materially inaccurate
  information on market conditions or the availability of the product or service", with
  the remainder covering doing so intending to induce purchases on worse-than-normal
  market terms. **Marked with an asterisk, denoting a prohibited practice.**
- **3.39, Comparisons / Other Comparisons:** "Advertisements that include comparisons
  with unidentifiable competitors must not mislead, or be likely to mislead, consumers."
  It goes on to bar cherry-picking comparison elements for an unrepresentative advantage.

Read together, the four cases cluster on: an objective claim without evidence (3.9), an
availability or stock claim (3.33), and an unattributed competitive comparison (3.39),
each also engaging the general misleadingness rule (3.1). For an automotive brand, 3.33
most plausibly attaches to offer availability or delivery timing, and 3.39 to
against-the-market claims. That reading is **inference, flagged as such**, since no copy
is published.

## Adjacent BCAP rules a guideline in this industry needs

Also captured from s51, because they govern exactly the constructions Vauxhall uses:

- **3.24, "from" and "up to" pricing:** such claims "must not mislead by exaggerating the
  availability or amount of benefits likely to be obtained by consumers." This is the
  rule that governs "from £x per month".
- **3.10 and 3.11, qualification:** 3.10 requires that significant limitations not be
  omitted and that qualifications not contradict the claims they qualify; **3.11:
  "Qualifications must not mislead by not being presented clearly."** BCAP guidance on
  superimposed text supports 3.11. **This, not the VCA, is the source of the
  small-print-legibility discipline in broadcast automotive advertising.**
- **Prices, 3.18 to 3.23:** 3.18 bars misleading by "omission, undue emphasis or
  distortion"; 3.19 requires non-optional taxes and fees in quoted prices, with a limited
  VAT-exclusive exception (relevant to the van copy's "excl. VAT" figures); 3.20 covers
  charges that cannot be calculated up front; 3.21 concerns instalment advertising;
  3.22 optional delivery and postal charges; 3.23 linked-product pricing commitments.
- **"Free" claims, 3.25 to 3.28:** 3.25 is asterisked (prohibited practice) and restricts
  "free", "gratis", "without charge" to cases where consumers pay no more than
  unavoidable response or delivery costs, with sub-rules 3.25.1 packing and handling,
  3.25.2 inflated response costs, 3.25.3 reduced quality; 3.26 requires clarity on the
  commitment involved; 3.27 restricts calling a package element free; 3.28 bars "free
  trial" for money-back or non-refundable-purchase offers. Joint BCAP and CAP guidance on
  "free" is referenced. Relevant to the observed "Ohme EV charger up to the value of
  £1,050 (incl. VAT) with standard installation" offer (s46).

## Process facts worth having

Per s47, ASA rulings are "published every Wednesday" and record "how, following a formal
investigation, the advertising rules apply".

## Gaps and what would unblock them

- **CAP Code (non-broadcast) section 3 NOT PROBED.** Only BCAP was fetched. Since the
  VCA explicitly excludes websites from the CO2 regulations, the CAP Code is the operative
  regime for vauxhall.co.uk copy, so this is the highest-value remaining probe in this
  area.
- ASA rulings against **Vauxhall dealers or dealer groups** NOT PROBED as a separate
  search. The "Vauxhall" query returned only the manufacturer as advertiser.
- Per-case pages for the five informally resolved matters: existence unresolved.
- ASA search URL pattern confirmed working: `https://www.asa.org.uk/codes-and-rulings/
  rulings.html?q=<term>`, with in-page anchors `#rulings`, `#informally-resolved`,
  `#mail-order-cases`, `#database-cases`, and sort and date-range filters available.
