# Rakk Ingredients — Phase 2: Database Population

> Split from `rakk-ingredients-product-spec.md` (the full product spec) for a phase-scoped hand-off to Claude Code. If anything here references a section number (e.g. §11) that isn't included in this file, it's in one of the sibling phase files or the full spec, kept in this same folder.

This is the product's actual asset: sourcing, extracting, and verifying the
ingredient database. It runs in parallel with Phase 1
(`rakk-phase1-app-build.md`), not before or after it.

**One-line product context**: Rakk Ingredients is a native iOS/Android app
that scans a packaged food's ingredient list and translates unfamiliar
ingredients into plain English with regulatory citations and dosage/exposure
context — no health score or verdict. Full product context is in
`rakk-ingredients-product-spec.md` §1 if needed.

---

---

# PHASE 2 — Database Population

This is the product's actual asset, and its own project with its own
timeline — realistically weeks, not days, even using the bulk-sourcing
shortcut in §13. It runs in parallel with Phase 1, not before or after it;
Phase 1 unblocks itself with the seed dataset in §10 rather than waiting.

## 11. Ingredients database — schema

Build it as its own versioned table, decoupled from any single data source,
so you can merge FDA + Codex + your own curation over time without a schema
migration every time.

This schema is deliberately wide — the goal (§1) is to capture everything
reasonably knowable about an ingredient, not just enough to render a flag.
Most fields are nullable, since not every source will populate every field
for every ingredient at launch — but "nullable" means "backfill this," not
"skip it."

```
Ingredient
  id
  canonical_name         text, e.g. "Sodium benzoate"
  aka                    array of text — alt names, common misspellings,
                          trade/brand names ("Na benzoate")
  cas_number              text, nullable — CAS Registry Number, the
                          standard cross-reference for looking this
                          substance up in any other database or paper
  e_number_ins_code       text, nullable — EU E-number / Codex INS code
                          (e.g. "E211"), kept as its own structured field
                          rather than buried in `aka` since it's used
                          programmatically to match non-US labels (§12.A),
                          and as the primary cross-reference key when
                          merging bulk sources across jurisdictions (§13)
  chemical_formula        text, nullable
  category                enum: preservative, thickener, emulsifier, filler,
                          colorant, flavor, sweetener, acidity_regulator,
                          leavening_agent, antioxidant, other
  origin                  enum: natural, nature_identical, synthetic,
                          unknown — "how this is actually made," a common
                          user question the citation alone doesn't answer
  typical_uses            array of enum — food, cosmetics, pharmaceutical,
                          industrial (a lot of additives cross categories;
                          useful for the OCR/photo path where a user scans
                          something that isn't strictly a food label)
  allergen_flags          array of enum — recognized allergen categories
                          this ingredient is derived from or commonly
                          cross-reacts with, if any (nullable/empty if none)
  plain_explanation       1–2 sentences, plain English, what it is / why used
  jurisdictions           array of {jurisdiction, status, citation,
                          citation_url}, one entry per regulator this
                          ingredient has a known status in (US_FDA, EU_EFSA,
                          CODEX, HK_CFS at minimum — see §17.5). Replaces a
                          single flat regulatory_status/citation pair, since
                          "GRAS in the US, restricted in the EU" is exactly
                          the kind of fact this product exists to surface,
                          not collapse into one answer (§17.4).
  risk_assessment_refs    array of text, nullable — links/citations to the
                          specific FDA/EFSA/JECFA risk assessment or CFR
                          use-level limit that a `usage_context` entry
                          (below) is drawn from, so no dosage claim is ever
                          asserted without a traceable source
  usage_context            object, nullable — dosage/exposure context:
                          {threshold_of_concern: text/nullable, typical_
                          concentration_range: text, product_type_context:
                          enum [leave_on, rinse_off, ingested, topical,
                          other]}. Prioritized by scan frequency (§12.B2,
                          §14), not capped to a fixed shortlist — nullable
                          where no dose-response data exists to responsibly
                          populate it. Powers the dosage-aware card copy on
                          the Label screen (§4) and the chat assistant's
                          grounded answers — see §1 for why this is core
                          v1 scope, not a later add-on.
  source                  enum: fda_substances_added_to_food, fda_gras_notice,
                          codex_alimentarius, usda_fooddata_central,
                          manual_curation
  source_updated_at       date — when the core classification fields were
                          last verified against the source
  last_full_review_at     date, nullable — when every field on this row
                          (not just regulatory status) was last reviewed
                          end-to-end against primary sources; distinct from
                          source_updated_at so a stale enrichment field
                          doesn't hide behind a fresh classification check
  everyday_allowlist      bool — true for the ~40-60 ingredients that should
                          never be flagged (salt, water, sugar, etc.) — also
                          the base of the offline-bundled subset (§8)
```

## 12. Data import — how to actually populate this (read carefully)

Being direct about what's realistic here, because the sourcing landscape is
uneven across your data needs:

**A. Raw ingredient lists per product (barcode → ingredients)**
- **Open Food Facts** is the right starting point — it's free, openly
  licensed (ODbL), and has a bulk data export (full product database as
  CSV/MongoDB dump, or a live API for on-demand barcode lookups). Use the
  bulk export to seed your product database, then hit the live API for
  barcodes you don't have cached yet.
- Coverage is weaker outside the US/EU. Before committing, pull a sample of
  ~50 Hong Kong / Asia grocery barcodes and check hit rate against Open Food
  Facts — if coverage is thin, you'll need a manual-entry fallback (let users
  submit a photo of a label you don't have, OCR it, and add it to your own
  database) from day one rather than as a v2 feature.
- **USDA FoodData Central** has clean bulk CSV/JSON downloads (Branded,
  Foundation, SR Legacy datasets) and is a good secondary source for
  US-branded products specifically.

**B. Ingredient explanations + regulatory status (the actual "Rakk Ingredients" data)**
This is the part with no single clean bulk API for the FDA's own search
tool specifically — plan for it accordingly, though §13 below describes a
faster route through the underlying regulatory text than scraping that
tool directly. The v1 target is full coverage, not a curated subset: every
entry in FDA Substances Added to Food (~4,000 substances), the GRAS Notice
Inventory, and Codex INS numbers, each fully populated against the §11
schema (including `cas_number`, `origin`, `jurisdictions`, etc. wherever the
source has that data) — not just the "most common" few hundred. Be
realistic about what that means operationally, because it's a genuinely
bigger undertaking than a curated shortlist:
- **FDA Substances Added to Food** (the successor to EAFUS) is the
  authoritative source. Its own search interface has no officially
  documented bulk export, but §13 below covers a faster path: the
  underlying legal text (21 CFR) and a structured EPA CompTox chemical
  list both give bulk access to effectively the same data.
- Log any ingredient your app encounters at runtime that still isn't
  matched (should be rare once the full set is imported, but real-world
  labels always surface edge cases) and batch-process that backlog against
  the source data on a standing cadence.
- **openFDA** (api.fda.gov) does NOT cover this specific dataset — its
  food-related endpoints are recalls/enforcement actions, not additive
  classifications. Don't build a pipeline assuming an API exists here.
- **Codex Alimentarius INS numbers** (WHO/FAO) — import the full INS list
  too, both to translate E-numbers/INS codes seen on non-US labels and as
  its own source of `jurisdictions` entries (§11) for ingredients Codex
  covers that the FDA doesn't classify the same way.
- **GRAS Notice Inventory** (also FDA) — import in full; it fills in
  ingredients not in the main additive list and is sourced/verified with
  the same pipeline as the rest of §B.

**B2. Dosage / exposure threshold data (powers the `usage_context` field in
§11 — core v1 scope, see §1)**
This is a heavier sourcing lift than straight classification data, and
honestly not every one of the ~4,000+ substances in §B has published
dose-response data to responsibly populate it from — so the realistic v1
target is "every ingredient where the source data actually exists," not a
fixed shortlist:
- Prioritize by expected scan frequency, not an arbitrary preset number —
  start with the additives most likely to actually appear on the grocery
  products people scan (a reasonable proxy list going in, refined by real
  usage data once there's a beta cohort and live analytics per §14), and
  keep expanding the backlog outward from there rather than stopping at a
  fixed cutoff.
- A meaningful share of this is actually free, not a separate research
  task: many CFR/EU regulation entries state an explicit numeric use-level
  limit directly in the same text pulled for classification data (§13) —
  extract this in the same pass rather than treating it as separate work.
- For the remainder — ingredients with no explicit regulatory limit stated
  — source from FDA/EFSA/JECFA risk assessments (the published safety
  evaluations that set an ADI or NOAEL) rather than a third-party summary;
  this is genuine per-ingredient research and the slower tier of this work
  (see §15 on getting it reviewed).
- Where no responsible threshold data exists for a given ingredient, leave
  `usage_context` null and show the citation chip alone (§4) — never
  backfill with a guess. Coverage of *classification* data (§B) should
  hit ~100% before launch; coverage of *dosage* data will realistically
  stay partial for longer, because the underlying research doesn't exist
  for everything, and that's an honest limitation to build around rather
  than paper over.
- Typical/measured concentration ranges by product category (e.g. the
  practical range for a given preservative across grocery products vs.
  cosmetics) — a mix of published food-science literature and reasonable
  category-level defaults where a precise industry figure isn't available;
  record which is which per entry rather than presenting an estimate as if
  it were a directly-sourced number.
- Product-type context (leave-on vs. rinse-off, ingested vs. topical) is
  usually inferable from the product category already captured elsewhere in
  the product record — don't require a separate manual field per ingredient.
- Treat this with the same discipline as §12.D's regulatory-status
  spot-checks: note when each `usage_context` entry was last verified so
  stale threshold data gets caught, not just written once and forgotten.

**C. Practical build order for the database**
1. Pull the bulk regulatory sources in §13 (eCFR, EPA CompTox, Codex GSFA
   text, EUR-Lex) rather than scraping search tools substance-by-substance
   — this is the fast path, not the scraping described above
2. Run a grounded-extraction-and-verification pass on the pulled text (§13)
   — every extracted field traceable to the exact source paragraph it came
   from, with a second pass confirming the claim actually appears there
3. Run a human-verification sample against that output, weighted toward
   highest-scan-frequency ingredients and anything with a `usage_context`
   value — see §15 for who should do this and how much
4. Alongside that same effort, research and fill in `usage_context` (§11,
   §B2) for as many ingredients as sourcing supports, prioritized by
   expected scan frequency — this is core v1 scope, not a follow-on pass,
   since it's the product's main differentiator (§1)
5. Cut a small hand-picked seed dataset (a few hundred common additives)
   out of the in-progress pipeline early, so Phase 1's app-build steps
   (§10) aren't blocked waiting for full coverage
6. Import the verified full dataset (classification fields for ~100% of
   entries, `usage_context` for whatever subset has sourceable dosage
   data) as the seed data for the Ingredient table once ready
7. Wire up Open Food Facts for barcode → raw ingredient list
8. Build the parsing/matching layer (fuzzy-match ingredient names against
   `canonical_name` + `aka`, since labels phrase things inconsistently —
   "Vitamin C" vs "Ascorbic acid" vs "Sodium ascorbate" need to resolve
   correctly)
9. Ship with the "unmatched ingredient" case handled gracefully (should be
   rare given full coverage, but show it unflagged/unstyled rather than
   erroring, and log it for your backlog)

**D. Keeping it current**
Regulatory status can change (substances get delisted). Store
`source_updated_at` per ingredient. At ~4,000+ entries, a full manual
quarterly review of every row isn't practical — so pair a lightweight
automated re-scrape (diff the FDA/Codex/GRAS sources against your stored
`jurisdictions` and flag any row where the source has changed since
`source_updated_at`) with a manual verification pass limited to whatever
the diff actually flags, plus a rolling `last_full_review_at` sweep so
every row gets a genuine human look at least once a year even without a
detected change. There's no webhook/notification system from these
sources for this — it's a review discipline your tooling should support,
not something engineering can fully automate away.

## 13. Fastest path to bulk-sourcing the data

The shortcut is: don't scrape regulators' search-UI tools one substance at
a time — pull the actual consolidated regulatory text they're built from,
which several sources publish in bulk, and turn this into a parsing
problem instead of a per-ingredient research problem.

- **US classification + a free slice of dosage data**: eCFR (the official
  U.S. Code of Federal Regulations site) publishes a real bulk API and full
  XML dumps of Title 21, and GovInfo's bulk data service publishes the same
  as structured XML. Title 21 Parts 172, 173, 180, 182, 184, and 186 are
  the actual legal text behind "Substances Added to Food" — every direct
  food additive listing, its CFR citation, and, for many entries, an
  explicit numeric use-level limit stated right in the text (this is where
  a meaningful chunk of §12.B2's dosage data comes from for free, in the
  same pass as classification).
- **Chemistry enrichment**: the EPA's CompTox Dashboard hosts a chemical
  list called FDAFOODSUBS — the FDA Substances Added to Food list, already
  structured with CAS numbers and identifiers, with export options. Use
  this for bulk `cas_number`/`chemical_formula`/`aka` enrichment instead of
  chasing each one down individually.
- **Codex/INS**: the Codex General Standard for Food Additives is published
  as one consolidated document with the full INS-numbered additive index
  and use levels by food category — parse that document once rather than
  querying the GSFA Online search tool per ingredient.
- **EU**: Regulation (EC) No 1333/2008's consolidated text on EUR-Lex,
  Annexes II and III specifically, lists every approved E-number, the food
  categories it's approved in, and the max level for each — again, one
  document rather than the EU's search-UI additives database.
- **Hong Kong CFS**: small enough in scope (Cap. 132V schedules) to hand a
  single document to an extraction pass directly.

**Pipeline**: pull these bulk sources once. Key every entry by CAS number
or E-number/INS code (§11's `e_number_ins_code` field exists specifically
for this) to merge across jurisdictions — not fuzzy name matching, which is
slower and more error-prone as a join key. Run an LLM extraction pass per
regulation section (not per ingredient) into the §11 schema, always keeping
the exact source paragraph attached as the citation — every field must be
grounded in text actually fetched, never generated from model memory. Run a
second, cheap verification pass that re-checks each extracted field against
its stored source paragraph before accepting it. This collapses classification
coverage from "~4,000 individual fetch-and-extract loops" to "download five
or six large structured documents, then run an extraction pass over each" —
realistically a one-to-two-week build-and-run effort for classification
data, versus a much longer scrape-per-substance approach.

**What this does not skip**: bulk sourcing removes the *search* cost, not
the *verification* cost. An LLM can still misread a table or attach the
wrong limit to the wrong substance even when reading the right document —
the grounded-extraction-plus-check pipeline above, and the human sample
review in §15, are still required regardless of how the source text was
obtained.

**Before committing engineering time to this architecture**: spend a
half-day spike confirming the eCFR API/GovInfo bulk files actually return
clean, parseable data for the specific Parts needed, and check reuse/
redistribution terms for the EU and Codex material specifically (US federal
regulatory text is normally public domain; EU/Codex material may carry
different terms — confirm rather than assume before building around it).

## 14. Analytics & instrumentation

This exists specifically to make §12.B2's "prioritize `usage_context` by
scan frequency" a real mechanism rather than a sentence with nothing behind
it — without capturing real usage data, there's no way to know which
ingredients are actually worth researching first.

Events to instrument from launch:
- Every scan attempt and its outcome (barcode resolved / OCR succeeded /
  manual search used / lookup failed) — shows where the funnel actually
  breaks, relevant to §4's "always give the user an out" design principle
- Every ingredient card expansion — this *is* the scan-frequency signal
  that feeds §12.B2's prioritization directly
- Every unmatched ingredient encountered at runtime (§12.B already implies
  logging this — make it an explicit analytics event, not an implicit TODO)
- Chat assistant usage (§4): questions asked per scan, and — without
  logging the free-text content itself by default, for the privacy reasons
  below — which ingredient or product a chat session was attached to, so
  chat engagement can also feed the scan-frequency signal
- Onboarding funnel events (sign-up completed, first scan completed, time
  between the two) — §4 explicitly optimizes for shortest path to first
  scan; this is how you'd know if that's actually working

**Tooling**: something like PostHog or Amplitude — both integrate cleanly
with React Native. PostHog specifically has a generous free tier and a
self-host option, worth keeping in mind given the multi-jurisdiction
privacy considerations in §15.

**Privacy discipline**: log ingredient IDs and event types, not raw photos
or anything that reconstructs a detailed personal shopping/health history.
Chat messages in particular should not be logged verbatim by default — a
log of "this anonymous user asked about sodium benzoate" is fine; storing
full conversation transcripts tied to an identity is a deliberate decision
that needs to be disclosed in the privacy policy, not a default that falls
out of turning on analytics. Tie this back to the legal review in §15.
