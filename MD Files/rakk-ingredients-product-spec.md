# Rakk Ingredients — Product Specification for Development

## 1. What this is

Rakk Ingredients is a native iOS/Android app — not a website, not a PWA, not a
responsive web app. It scans a packaged food's ingredient list (via barcode or photo) and
translates unfamiliar ingredients into plain English: what it is, why it's in
the product, and its actual regulatory status (e.g. FDA GRAS). It does **not**
assign a health score or verdict — that's a deliberate positioning choice
against apps like Yuka, which lead with a red/yellow/green grade. Rakk Ingredients leads
with explanation, not judgment.

**Legal framing this constrains the whole product**: the app is an
informational reference tool, not a health-advice tool. Every ingredient card
must state a fact ("classified as GRAS by the FDA under 21 CFR 182") rather
than a claim ("this is bad for you"). This isn't just a tone choice — it's
what keeps the product out of unlicensed-health-claim territory. Bake this
into the copywriting guidelines given to whoever (or whatever) writes UI copy,
and to the ingredient chatbot in §4's Label screen — the chatbot inherits this
constraint exactly, see §4.

**The other core differentiator: dosage and exposure context, not just
presence — and this ships in v1, not as a v2 add-on.** Most ingredient
scanners (see §17.1) treat any detected ingredient as a binary hazard
regardless of concentration or how the product is used — the same
preservative gets flagged identically whether it's in a rinse-off soap at a
trace amount or, hypothetically, at an industrial concentration. Rakk
Ingredients's flagged ingredients carry actual dosage/exposure context on
the card wherever the source data supports it (see §11's `usage_context`
field, §12.B2 — prioritized by scan frequency, expanding toward full
coverage over time, not capped to a fixed shortlist): the regulatory threshold of concern where one exists, and
how the product's typical concentration for its category compares to it.
This is what turns "here's a citation" into "here's why this citation means
you don't need to worry" — it's the single most defensible reason a user
picks Rakk Ingredients over a red/yellow/green scanner, and it's a driving
point competitors don't have.

**Coverage is the other half of the trust promise.** The database (§11, §12)
targets full coverage of the FDA's known substances (~4,000 entries) plus
Codex INS and the GRAS Notice Inventory before launch — not a curated
subset of "common" additives. A user shouldn't hit an unmatched ingredient
on anything but genuinely obscure or brand-new substances; "we only mapped
the popular ones" undercuts the same trust proposition the citations are
there to build.

## 2. Target user

Broad on purpose: this isn't a niche health-optimizer tool, it's for anyone
who picks up a package and doesn't recognize something on the label. That
spans a wide range of everyday people — students building a label-reading
habit for the first time, parents restocking a pantry, someone's mom's
friends comparing notes on a product at a dinner party, someone's dad's
friends who've never used a scanning app before, and every ordinary shopper
in between. What they share isn't a diet philosophy, an income bracket, or a
tech-savviness level — it's plain curiosity plus a low tolerance for jargon
or fear-mongering. Design and copy should welcome a first-time app user with
zero label-reading background, while staying precise enough that a more
sophisticated user never feels talked down to.

Two groups the product still explicitly does NOT target in v1 messaging —
this stays narrow even as the general audience broadens, because it's a
liability boundary tied to the legal framing in §1, not a marketing choice:
- A licensed nutritionist or dietitian who needs professional-grade sourcing
  beyond a plain-English card
- Someone managing a diagnosed medical condition who needs clinical
  guidance, not general ingredient information

## 3. Core user flow

1. User scans a barcode, or takes a photo of an ingredients list, or searches
   by product name.
2. App resolves the product to a known record (barcode lookup) or OCRs the
   photo into a raw ingredient string.
3. Raw ingredient list is parsed into individual ingredients (see §12
   parsing notes — this is the fiddly part).
4. Each ingredient is matched against the internal ingredients database
   (see §11). Matched ingredients that are "notable" (defined below) are
   flagged; common/obvious ones (water, salt, sugar, flour) are not.
5. Label screen renders the full ingredient list with flagged terms
   underlined; tapping one expands its explanation card in place.
6. At the bottom of the Label screen, once the ingredient list and cards
   have rendered, an ingredient chat assistant is available for follow-up
   questions about the product or any specific ingredient on it — see §4's
   Label screen for the full spec.
7. Optional: user adds a second product to compare side by side.

**"Notable" definition (config this, don't hardcode)**: an ingredient is
flagged if it is NOT in a small allow-list of ~40–60 everyday kitchen
ingredients (salt, water, sugar, flour, yeast, common oils, common spices,
etc.) AND it has a matching entry in the ingredients database. Anything
matched but not flagged still shows in the list, just unstyled/muted.

## 4. Screens (build these five first)

### Sign up / Onboarding
- Single goal: get a new user scanning their first label in well under a
  minute — every screen here has to earn its place or get cut
- Lead with one-tap auth (continue with Apple / continue with Google) as the
  primary path so there's no password to invent or remember; email is a
  fallback, never the default
- No mandatory profile fields at sign-up (name, birthday, dietary info, etc.
  all deferred or skippable) — nothing blocks a new user from scanning
  immediately. The optional health-profile idea in §18.1, if it's ever
  built, is an opt-in added later, not a gate at sign-up. (Note: this is
  unrelated to the dosage/exposure feature in §1/§11/§4, which is a
  per-ingredient data feature, not a per-user profile — it needs no sign-up
  step at all.)
- Onboarding carousel capped at 2–3 screens (what the app does, the
  "explains, doesn't judge" promise from §1) with a visible skip on every
  screen — don't make a broad, casual audience sit through a tutorial
- First scan should be reachable immediately after sign-up with zero
  additional setup steps — optimize for the shortest path from opening the
  app to seeing a translated ingredient
- Session persists by default (no re-login on every app open); sign-out
  lives in settings, not the main flow, so it never gets in the way
- Empty/loading states here follow §9's discipline — a real progress
  indicator while the account is created, not a bare spinner

### Home
- "Scan a label" primary CTA
- Recently scanned products list: name, brand, relative time, and either a
  flagged-count chip or a "clear" badge (no numeric score, just count)

### Scan
- Camera view with a framing guide for barcode or ingredient-panel capture
- Manual search fallback (product/brand name) for when scanning fails —
  always give the user an out

### Label (the core screen)
- Product name/brand
- Summary strip: total ingredient count, flagged count
- "The label, translated": the actual ingredient list as running text
  (monospace, label-like), flagged terms underlined
- Below that, expandable cards for each flagged ingredient: what it is (1–2
  plain sentences), why it's used (category: preservative/thickener/
  filler/emulsifier/etc.), a small citation chip showing its regulatory
  classification and CFR citation where available, and — for the ~50
  ingredients with `usage_context` populated (§11) — a dosage/exposure line
  stating the known threshold of concern, if any, and how this product's
  typical concentration for its category compares to it (e.g. "this
  preservative is only associated with risk above 2% in leave-on use; this
  product is rinse-off"). Ingredients without `usage_context` yet just show
  the citation chip — never leave the card looking broken, just show what's
  actually known
- No overall score, no color-graded verdict anywhere on this screen
- **Ingredient chat assistant (v1 core scope, not a future add-on)**: once
  the full ingredient list and flagged cards have rendered, a chat entry
  point sits at the bottom of the Label screen (e.g. a persistent "Ask about
  this product" bar the user can expand into a chat thread). This lets the
  user ask free-form follow-up questions about the specific product they
  just scanned, or about any specific ingredient on it — things a static
  card can't anticipate ("is this the same as the preservative in my other
  snack?", "why is this in a rinse-off product at all?", "what's the
  difference between the US and EU status here?"). Requirements:
  - The chat is scoped to the current product/scan — it's given the
    product's full parsed ingredient list and the matched `Ingredient`
    records (including `jurisdictions`, `usage_context`, and citations) as
    context, not open-ended internet access, so every answer can be
    grounded in data already on the card or in the database rather than
    invented on the fly.
  - It inherits the exact copy discipline from §1/§9: no adjectives like
    "harmful," "toxic," or "dangerous," no verdicts, no health advice — the
    chatbot is a more conversational way to explore the same facts already
    on the card, not a second product with looser rules. This needs its own
    explicit system-prompt-level guardrail, since a chat interface is much
    easier to accidentally lead into "so is this safe for me?" territory
    than a static card is — the chatbot should redirect that kind of
    question back to stating facts ("this is classified as GRAS at
    concentrations up to X; that's the extent of what's regulatorily
    established") rather than answering it directly, and should decline to
    give personal health advice ("should I avoid this if I'm pregnant?")
    the same way a card would, pointing to a professional instead.
  - When the chatbot doesn't have grounded data to answer a question (e.g.
    an ingredient with no `usage_context` populated, or a question outside
    what the database covers), it should say so plainly rather than
    generate a plausible-sounding but unsourced answer — the same
    no-fabrication discipline that applies to the database itself (§13)
    applies here.
  - Needs its own empty/loading/error states per §9's discipline (e.g. the
    chat is temporarily unavailable offline — see §8's offline scanning
    section for how this interacts with network availability).
  - Cost and infra: this is a live LLM call per message, which has a
    different cost profile than the rest of the app (which is mostly cached
    lookups) — budget and rate-limit this explicitly (see §7 and §8) rather
    than treating it as free once the database and screens are built.

### Compare
- Two products side by side: name, brand, flagged count out of total
- Shared vs. differing ingredient list below, each row with a colored dot
  per product showing which one(s) contain it — no ranking of "better,"
  just factual overlap

## 5. Design system (already validated — replicate exactly)

**Avoid the default "AI wellness app" look (cream background, soft rounded
sans, pastel everything).** This should read closer to a lab label or a
well-typeset reference document — calm, precise, trustworthy.

```
Colors
--bg:            #F4F6F3   (pale sage-white — NOT cream/#FFF8F0)
--surface:       #FFFFFF
--surface-2:     #EDF1EC
--border:        #DCE3D9
--text:          #1E2A22   (deep forest-black-green, not pure black)
--text-muted:    #6E7A70
--primary:       #2F6B5E   (deep teal-green — used for "verified fact"
                             elements: citation chips, primary CTA, the
                             "clear" state — never used to imply "good/bad")
--primary-bright:#3E8A78
--primary-soft:  rgba(47,107,94,0.10)
--flag:          #B07A2C   (muted amber — used ONLY to mean "here's an
                             ingredient worth reading about," never "warning"
                             or "danger." Keep the tone neutral in copy.)
--flag-soft:     rgba(176,122,44,0.12)

Typography
Headers / product names: Newsreader (serif, editorial feel — weight
  500–600)
UI chrome, explanation body text, chat assistant messages: Inter
  (400/500/600/700)
The actual ingredient list + citation chips: IBM Plex Mono — this is
  deliberate, it should read like a chemical label

Radius: 14–22px, pills fully rounded
```

**Signature interaction**: the ingredient list renders as real running text
(like the actual label), with flagged ingredients underlined rather than
pulled into a separate "watch list." Tapping a flagged word expands an
explanation card directly below it in the flow — the translation happens
in place, on the label itself, not in a disconnected panel. Preserve this;
it's what makes the product feel like "the label, annotated" rather than
"a database lookup tool."

A working reference mockup (static React, no backend) exists — ask for it if
you need the exact JSX/CSS to match pixel-for-pixel.

---

# PHASE 1 — App Build

This phase is the engineering build of the app shell itself: screens, design
system, navigation, and the plumbing to the backend. It can start in
parallel with Phase 2 (database population) using the mock/seed data
approach in §10 — it does not need to wait on full database coverage.

## 6. Tech stack (recommended)

This is a native mobile app, full stop — no web app or browser-based version.
The barcode/camera/OCR flow needs real native device APIs, which is itself a
reason a website build would be the wrong call here.

- **Frontend**: React Native (Expo is fine) — single codebase compiling to
  native iOS and Android, not a webview wrapper
- **Barcode scanning**: native camera + a barcode-reading library (e.g.
  ML Kit on-device barcode scanning — fast, no round-trip needed)
- **OCR for photographed ingredient lists**: cloud OCR (Google Vision API or
  similar) — on-device OCR quality on dense small-print ingredient text is
  usually not good enough for v1
- **Backend**: Postgres for the Ingredient and Product tables, with a
  trigram or fuzzy-text index (e.g. Postgres `pg_trgm`) for ingredient-name
  matching
- **Ingredient chat assistant (§4)**: an LLM call (via a hosted API) scoped
  to the current product's parsed ingredients and matched database records,
  proxied through the backend rather than called directly from the client —
  see §7 for why, and §8 for rate-limiting/cost considerations
- **Data seeding**: a one-time ETL script that loads your curated
  spreadsheet into Postgres, plus a scheduled job that pulls incremental
  Open Food Facts updates

## 7. API contract

The schema in §11 defines what a database row looks like — it does not
define how the mobile app actually talks to the backend over the network.
Pin this down explicitly so it doesn't get silently improvised partway
through the build:

- **Client-to-backend model**: direct Supabase client calls from the app for
  standard reads (product lookup, ingredient fetch) — no custom backend
  layer needed for these, since Supabase's auto-generated REST/GraphQL
  surface covers them. The one exception is the ingredient chat assistant
  (§4, §6): that call should go through a thin backend endpoint (e.g. a
  Supabase Edge Function), not directly from the client to the LLM
  provider, so API keys stay server-side and so per-user rate limiting
  (§8) can actually be enforced.
- **Response shape**: define the exact JSON shape the app expects for a
  "resolved scan" (product + matched ingredients + flagged subset) as one
  assembled response, rather than making the client stitch together
  multiple separate calls — this is worth writing out as literal example
  JSON before building starts, not left to be inferred from the database
  schema.
- **Where matching logic runs**: ingredient fuzzy-matching (§12.C — "Vitamin
  C" vs. "Ascorbic acid" vs. "Sodium ascorbate") runs server-side as a
  Postgres function using `pg_trgm`, not shipped to the client — the client
  should never need the full ingredient database bundled just to match
  names, only the cached/offline subset described in §8.
- **Auth and row-level security**: Supabase Auth session tokens for
  authenticated calls (recently-scanned history, chat). The `Ingredient` and
  base `Product` tables are public-read via row-level security policies —
  no reason to gate ingredient facts behind a login, since the whole point
  is trust and transparency (§1).
- **Versioning on database updates**: since the ingredient database keeps
  being backfilled after launch (§12.D), the app should always read live
  from the backend for full ingredient detail rather than assuming a static
  bundled copy is current — the bundled offline subset (§8) is explicitly a
  cache, not the source of truth, and should be refreshed periodically in
  the background rather than only at app update time.

## 8. Non-functional requirements

- **Minimum OS versions**: define explicit iOS/Android version floors
  before build starts (affects available camera/ML Kit APIs) — don't leave
  this to whatever Expo defaults to.
- **Performance targets**: label parse-and-match (steps 2–4 in §3) should
  complete in a couple of seconds for the barcode path; OCR path will be
  slower and needs its own progress state per §9.
- **App size budget**: set one, since the bundled offline ingredient subset
  (below) adds to install size.

**Offline scanning — what actually works without a connection:**
Barcode *detection* itself is fully on-device (ML Kit) and needs no network
at all. What needs network is (a) looking up an unfamiliar barcode against
Open Food Facts, and (b) the cloud OCR path for photographed labels (§6) —
neither of these can complete offline, and that's an acceptable limitation
to design around rather than solve. The practical design:
- Bundle a snapshot of the ingredient database into the app — at minimum
  the "everyday allowlist" (§11's `everyday_allowlist` field) plus the
  highest-scan-frequency subset (§12.B2, §14) — so that once a raw
  ingredient list is available, matching and card rendering work offline.
- Cache every product a user has successfully scanned before, so
  re-scanning something already looked up works with zero network.
- Give the *first-time* unfamiliar-barcode lookup and the OCR path their
  own explicit offline state — not a generic error toast, but something
  like "no connection — we'll look this up as soon as you're back online,"
  consistent with §9's real-empty-states discipline.
- The chat assistant (§4) requires network by nature (it's a live LLM
  call) — its own offline state should say so plainly rather than hang or
  silently fail.

## 9. Non-negotiables for a "premium, not vibe-coded" feel

- Every flagged ingredient must show its regulatory citation chip — never
  show a flag without a source, that's the whole trust proposition
- Ingredient database coverage must be effectively complete at launch
  (§12.B: the full FDA/GRAS/Codex set, not a curated shortlist) — hitting an
  unmatched ingredient on anything but a genuinely obscure substance
  undercuts the trust proposition as much as a missing citation would
- Every ingredient with sourceable dosage data must show its
  dosage/exposure context (§11, §12.B2, §4), not just a citation — this is
  the feature the whole product is built to prove out, don't let it slip
  to a later release
- Copy discipline: no adjectives like "harmful," "toxic," "dangerous"
  anywhere in ingredient explanations — state classification and use, let
  the user draw conclusions. This applies identically to the ingredient
  chat assistant's responses (§4), not just static card copy.
- Real empty/error states: barcode not found, OCR failed, ingredient not yet
  in database, chat assistant unavailable offline — each needs its own
  designed state, not a generic error toast
- Consistent use of the mono font specifically for ingredient names/citations
  and serif only for product names/headers — don't let these bleed together
- Loading state for scan → parse → match should show real progress, not a
  spinner, since OCR/lookup can take a couple of seconds

## 10. Build order (app build)

1. Static screens with mock data (validate design fidelity first) — this
   can start immediately, in parallel with Phase 2's database work
2. Barcode scan → Open Food Facts lookup → raw ingredient list rendering
   (no flagging yet)
3. Ingredient matching + flagging against a small hand-picked seed dataset
   (a few hundred common additives — see §12.C step 4) so this and later
   steps aren't blocked waiting on Phase 2's full database coverage
4. Expandable explanation cards with citations and, where `usage_context`
   is populated, dosage/exposure context (§4) — this is core v1, not a
   follow-on pass
5. Ingredient chat assistant (§4, §6, §7) — wire up once the card data
   model above is stable, since the chatbot is grounded in the same
   matched-ingredient records the cards render
6. Photo/OCR fallback for unbarcoded products
7. Compare screen last — it's additive, not core to proving the concept
8. Swap the seed dataset for the full Phase 2 database once it reaches
   sufficient coverage (§12.B, §15) — this is a data cutover, not a code
   change, if §7's API contract is followed

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

---

# PHASE 3 — Pre-Launch Review, Compliance & Hosting

This phase gates public release — both phases above can be functionally
"done" and the app still shouldn't ship without this.

## 15. Nutritionist & legal review before launch

Treat this as non-negotiable, not a nice-to-have, and as two separate
engagements for two separate kinds of risk:

**Legal review**: a lawyer (ideally with consumer app or food-tech
experience) should review the actual legal exposure before public launch —
whether the "informational, not health advice" framing in §1 is sufficient
to stay out of unlicensed-health-claim territory, whether allergen-flag
handling (§11's `allergen_flags`) limits liability appropriately given that
a wrong allergen claim is a sharper risk than a wrong general-ingredient
fact, and whether data handling (camera/photo data, scan history, chat
transcripts if any are stored per §14, EU users under `jurisdictions`)
meets GDPR/CCPA/Hong Kong PDPO obligations. This is a scoped, few-hour
engagement, not a large cost, and it's cheap insurance against a mistake
that's expensive to unwind post-launch.

**Food science / regulatory affairs review**: someone who reads risk
assessments and CFR entries professionally (a food scientist, regulatory
affairs consultant, or toxicologist — not necessarily a clinical
dietitian) should sample-review the database, especially the
`usage_context` dosage claims populated via §12.B2/§13. This doesn't need
to be an exhaustive row-by-row audit of all ~4,000+ entries — a
representative sample (weighted toward highest-scan-frequency ingredients
and everything with a populated `usage_context` value, per §14's data)
is a real confidence check on the whole pipeline's error rate. If the
sample comes back clean, that's evidence the pipeline works; if it
doesn't, it's found before users find it.

Both of these happen before public launch, not after — a review that
happens post-launch only tells you what to fix, not what to avoid shipping
in the first place.

## 16. Launch & hosting

- **Build/ship**: Expo EAS. `eas build` produces real iOS/Android binaries
  (not a webview) for internal testing on your own device before any store
  submission; `eas submit` pushes signed builds straight to the App Store and
  Play Store once you're ready. This is the default for an Expo/React Native
  app — don't substitute a different build pipeline without a specific
  reason to.
- **Backend hosting**: Supabase. Postgres + auth + file storage in one place,
  maps directly onto the Ingredient/Product schema in §11 with no
  translation needed, and has a free tier that covers development and a
  soft launch before real usage requires paying. Postgres's `pg_trgm`
  extension (mentioned in §6) is available on Supabase out of the box.
  Supabase Auth also covers the one-tap Apple/Google sign-in called for in
  §4's Sign up / Onboarding screen out of the box, so there's no separate
  auth vendor to stand up.
- **Accounts needed before public release**: Apple Developer Program
  ($99/year, required for App Store submission) and Google Play Console
  (one-time $25 fee). Enroll in both early — account review itself can take
  a few days.
- **Sequence**: build against Supabase → `eas build` for internal test
  builds on your own phone → enroll in both developer accounts → §15's
  legal and food-science review → `eas submit` to both stores. Budget
  separate time for Apple's app review (anywhere from a day to over a week,
  longer for first-time submissions) — it's outside your control and
  shouldn't be on the same timeline as development work.

## 16.5 Monetization

**Model**: subscription, $2.50 USD/month, with a 7-day free trial starting
at sign-up. No separate free tier below that — the trial is the entire
try-before-you-buy window, not an ongoing free scan allowance.

- **Where this plugs into the flow (§4)**: the Sign up / Onboarding screen
  already commits to zero mandatory profile fields and immediate access to
  the first scan — that stays true. The trial should start automatically on
  sign-up (no separate "start trial" tap), so the one-tap Apple/Google auth
  path in §4 doubles as the trial start. Payment method collection at
  trial start vs. at trial end is a real decision (see below) — either way,
  it must not add friction before the first scan, per §4's "shortest path
  to first scan" principle and the onboarding funnel event in §14.
- **Trial-to-paid mechanics**: decide up front whether the trial requires a
  card at sign-up (higher conversion-to-paid-intent tracking, some user
  friction/distrust) or is card-free with a paywall gate on day 7 (lower
  friction, but users can churn out with zero payment info captured and no
  win-back path). Given the low price point and the trust-first positioning
  in §1, a card-free trial with a clear in-app countdown and a paywall
  screen on expiry is probably the better fit here — reconsider if trial
  abuse (repeat sign-ups to dodge payment) becomes a real problem post-launch.
- **What's gated**: the whole product is paid after trial, not select
  features — no scan limits or feature-tiering to design around, which
  keeps the Label/Compare/chat screens in §4 simple. If this changes later
  (e.g. a free tier with limited scans/month to widen the top of funnel),
  that's a pricing-strategy decision to make deliberately, not a default to
  fall into.
- **Implementation**: use native subscription APIs (StoreKit 2 on iOS,
  Play Billing on Android) rather than an external payment flow — both app
  stores require in-app purchase for digital subscriptions, and a workaround
  risks store rejection. RevenueCat is the standard layer on top of both for
  a React Native app (§6) — handles receipt validation, trial-status,
  renewal/cancellation webhooks, and cross-platform entitlement checks in
  one SDK rather than building this against both stores' APIs directly.
  Supabase (§16) doesn't handle subscription billing itself — RevenueCat (or
  a bare StoreKit/Billing integration) sits alongside it, with entitlement
  status synced to the user's Supabase record so backend checks (e.g. the
  chat assistant endpoint in §7, which has real per-message cost) can gate
  on subscription status server-side, not just trust the client.
- **Analytics (§14)**: add trial-started, trial-converted, trial-churned,
  and subscription-cancelled as explicit funnel events alongside the
  existing onboarding events — at $2.50/month, trial-to-paid conversion
  rate is the single number that determines whether this business works,
  and it should be visible from day one, not reconstructed later from App
  Store/Play Console reports.
- **Store fees**: both Apple and Google take a cut of in-app subscription
  revenue (standard commission, reduced after a subscriber's first year on
  each platform, and Apple's Small Business Program can lower the first-year
  rate if the account qualifies — worth checking eligibility during the
  developer account setup in §16). Net revenue per subscriber is materially
  below $2.50/month; model against the net figure, not the sticker price,
  when thinking about unit economics.
- **Not yet decided, worth resolving before launch**: annual pricing as an
  option (common for subscription apps to improve LTV and reduce churn
  volatility), and whether the B2B opportunity in §18.2 would ever run on a
  different pricing model entirely — that's a separate GTM track per §18.2
  and shouldn't be assumed to inherit this consumer price point.

---

# REFERENCE — Competitive Positioning

## 17. Competitive reference: Yuka's known flaws, and how Rakk Ingredients should avoid each one

This section exists because Rakk Ingredients's whole positioning is a reaction against
Yuka's approach. Every flaw below is something Yuka's own users, dietitians,
and toxicologists have criticized publicly. Treat this as a checklist against
scope creep — if a future feature request would reintroduce one of these
problems, that's a reason to say no.

### 17.1 Hazard vs. risk — flagging presence instead of dose

**Yuka's flaw**: Yuka treats any detected ingredient as a binary hazard,
regardless of concentration or how the product is used. A preservative that's
perfectly safe at 0.1% in a lotion gets the same red flag as if it were
present at a hazardous industrial concentration. It also doesn't distinguish
leave-on products (moisturizer) from rinse-off products (soap), where skin
exposure time is completely different.

**Why this matters for Rakk Ingredients**: §1 already commits Rakk Ingredients to no
verdicts/scores, which sidesteps most of this — but the *explanation copy*
can still smuggle in hazard-framing even without a red flag. "Contains
[additive]" read next to a scary-sounding chemical name can feel like an
implicit warning even in neutral color. This applies equally to the chat
assistant's conversational responses (§4) — it's a second surface where
hazard-framing could creep in if not held to the same discipline.

**Rakk Ingredients's answer**:
- Every ingredient card states the *regulatory-approved use context* where
  known — e.g. "approved for use as a preservative in foods at
  concentrations up to X%" rather than just "this is a preservative." This
  is the `usage_context` field on the Ingredient schema (§11), populated for
  every ingredient sourceable dosage data supports at launch, prioritized
  by scan frequency (§12.B2, §14) — this is core v1 scope, see §1.
- Never imply presence = risk. The copy discipline in §9 ("no adjectives like
  harmful/toxic/dangerous") extends explicitly to this feature, and to the
  chat assistant: no phrasing that implies concentration or exposure risk
  unless the citation or `usage_context` entry itself specifies a limit.

### 17.2 Overtaxing calories and fat — the Nutri-Score problem

**Yuka's flaw**: 60% of Yuka's score comes from the Nutri-Score model, which
penalizes calories, sodium, and saturated fat without distinguishing
nutrient-dense whole foods (olive oil, avocado, parmesan) from processed
junk. Meanwhile, zero-calorie/zero-fat engineered foods can score
artificially high.

**Why this matters for Rakk Ingredients**: This entire flaw only exists because Yuka
computes a composite nutritional score at all. Rakk Ingredients's decision *not* to
score anything (§1, §4) already structurally avoids this — this is Rakk Ingredients's
strongest differentiation and should be treated as untouchable, not just a
launch choice. Any future feature (e.g. "healthiness index," "nutrition
grade") should be checked against this before being greenlit.

**Rakk Ingredients's answer**: No action needed beyond staying disciplined — but worth
stating explicitly in the spec so a future PM/designer doesn't quietly
reintroduce a score under a different name (e.g. "freshness rating," "clean
score"). Add this as an explicit anti-goal in §1.

### 17.3 The "organic" bias

**Yuka's flaw**: 10% of the food score is automatically awarded just for
organic certification, regardless of the product's actual nutritional
profile — so an organic sugary snack outscores its conventional identical
counterpart.

**Rakk Ingredients's answer**: Not applicable in the same way since Rakk Ingredients doesn't
score, but the *lesson generalizes*: don't let any single attribute (organic,
non-GMO, "clean label") get special visual or structural treatment that
implies it's a proxy for healthiness. If organic certification is ever
surfaced (e.g. as a product attribute), it should be presented as a factual
badge equal in visual weight to any other attribute, not as a "notable" flag
under §3's flagging logic.

### 17.4 Cherry-picking science / overriding regulatory consensus

**Yuka's flaw**: Yuka reportedly flags ingredients as "high risk" (e.g.
aspartame, sucralose) in ways that override or ignore FDA/EFSA safety
consensus, and has flagged naturally occurring substances (like pectin, a
fruit fiber) as concerning additives. Critics say this reflects
outdated/low-quality source studies rather than current regulatory review.

**Why this matters for Rakk Ingredients**: This is the single most important flaw to
avoid, because Rakk Ingredients's entire value proposition (§1) is *regulatory
accuracy* — "classified as GRAS by the FDA under 21 CFR 182" as the model
sentence. If Rakk Ingredients's database ever drifts from actual current regulatory
status, it becomes exactly what it's positioned against. This is also the
core reason §13's bulk-sourcing pipeline still requires the
grounded-extraction-and-verification discipline and §15's human review —
an AI-populated database with no such discipline risks replacing Yuka's
"outdated science" problem with a "fabricated citation" problem, which is
worse, not better, for a product whose whole pitch is citation accuracy.

**Rakk Ingredients's answer**:
- §11/§12 require the `jurisdictions` field sourced directly from
  FDA/EFSA/Codex/HK CFS — keep this as the single source of truth, never
  substitute a third-party "clean eating" blog or aggregator as a primary
  source, even for convenience.
- §12.D's re-scrape-and-verify discipline is the mechanism that prevents
  drift — treat it as a hard requirement, not a nice-to-have. The
  `source_updated_at` and `last_full_review_at` fields (§11) are the audit
  trail that lets you show (internally, and eventually to press/users)
  that entries are actively maintained, not just written once.
- If a substance has an ongoing regulatory review or a split
  scientific/regulatory opinion (e.g. an ingredient banned in the EU but
  GRAS in the US), the card states *every* jurisdiction's status explicitly
  rather than picking one — the `jurisdictions` array (§11) is built for
  exactly this, and it's a direct point of difference from Yuka's
  single-verdict approach.

### 17.5 Inconsistent regional data / US-EU mismatch

**Yuka's flaw**: Built on European standards first, Yuka's data and scoring
translate awkwardly to North America — duplicate listings for the same
product yield different scores, and the app ignores factors like carbon
footprint or pesticide residue that vary meaningfully by region.

**Why this matters for Rakk Ingredients**: §12.A already flags this exact risk for
barcode coverage (the Hong Kong/Asia sample-testing step) but the same
inconsistency risk applies to *regulatory status itself* — an additive can be
GRAS in the US and restricted/banned in the EU or Hong Kong's own food
regulations.

**Rakk Ingredients's answer**:
- Implemented directly in the Ingredient schema (§11) as the `jurisdictions`
  field — an array of {jurisdiction, status, citation, citation_url}
  entries per ingredient, rather than a single flat enum, so this never
  needs a later migration of every existing row. Given Rakk Ingredients's
  Hong Kong-based dev/testing (per §12.A), a Hong Kong Centre for Food
  Safety entry is populated from day one alongside US_FDA, EU_EFSA, and
  CODEX — not treated as a v2 add-on.
- On the Label screen (§4), show every known jurisdiction rather than
  collapsing to one, but order/highlight the one most relevant to the
  specific product in hand — ideally derived from the product's known
  sale market (e.g. an Open Food Facts "countries sold in" field) rather
  than the user's live physical location, since a product's regulatory
  status tracks where it's marketed, not where the phone happens to be.
  Fall back to device locale/App Store storefront region only when no
  product-market data exists. Don't request live GPS location for this —
  it adds a permission prompt and a privacy-policy line (§15) for
  something a locale setting already covers, with no v1 use case (like
  active travel) that needs live location specifically.
- Deduplicate product records defensively: if barcode data from Open Food
  Facts (§12.A) has multiple entries for the same product, resolve to one
  canonical record rather than showing conflicting ingredient lists for the
  "same" scan — a direct fix for the "two listings, two scores" complaint
  users raise about Yuka.

### 17.6 Missing broader impact data (carbon footprint, sourcing, etc.)

**Yuka's flaw**: Because Yuka focuses narrowly on ingredient-level scoring,
it can't account for sustainability, pesticide residue, or supply-chain
factors — legitimate gaps, but ones its scoring format implicitly claims to
have covered by producing a single confident number.

**Rakk Ingredients's answer**: Rakk Ingredients sidesteps the *credibility* problem here simply
by not producing a single number that implies completeness (§1, §4). Where
Rakk Ingredients is scoped narrower than Yuka (ingredients/additives only, not
sustainability or sourcing), that's fine — but the app should say so
explicitly somewhere discoverable (e.g. an "About Rakk Ingredients" / "What this app
does and doesn't do" screen), so the scope itself doesn't quietly become a
trust issue later. Consider adding this as a sixth core screen in a future
version, not required for the Phase 1 build order in §10.

### 17.7 Socioeconomic bias in recommendations

**Yuka's flaw**: Because organic and "premium clean" products score higher,
Yuka's suggested alternatives skew toward pricier, less accessible options —
a criticism specific to Yuka's "find a better alternative" feature.

**Rakk Ingredients's answer**: Not directly applicable since Rakk Ingredients has no
alternative-recommendation feature in the current spec (§3, §4). Flag this as
a constraint *if* a "find a similar product" or comparison-suggestion feature
is ever added post-Compare-screen (§4, §10 build order item 7): any
suggested alternative should be surfaced on factual overlap (shared/differing
ingredients, as Compare already does) and never ranked or sorted by
implied "healthiness," which would reintroduce a de facto score through the
back door.

### Summary table

| Yuka flaw | Root cause | Rakk Ingredients's structural defense |
|---|---|---|
| Hazard vs. risk conflation | No dose/context in flagging | Neutral copy discipline (§9) + `usage_context` field populated wherever sourcing supports it (§11, §12.B2), live in v1 |
| Overtaxing calories/fat | Composite Nutri-Score-based score | No scoring at all (§1) — treat as untouchable |
| Organic bias | Single attribute weighted into score | No scoring; badges shown at equal visual weight |
| Cherry-picked/outdated science | Weak sourcing discipline | FDA/Codex-only sourcing (§12) + grounded verification (§13) + human review (§15) |
| US/EU data inconsistency | Single-jurisdiction data model | `jurisdictions` multi-jurisdiction schema field, live in v1 (§11, §17.5) |
| No sustainability/sourcing data | Score implies completeness | No score; explicit scope statement (About screen) |
| Socioeconomic bias in alternatives | Recommendations ranked by "healthiness" | No alternative-ranking feature; factual overlap only if added |

---

# FUTURE OPPORTUNITIES (v2+, not required for launch)

## 18. Future opportunities

These are bigger strategic bets, not near-term build items — none of these
belong in Phase 1's build order (§10) or Phase 2's database plan. They're
recorded here so they aren't lost, and so any of them can be scoped properly
when it's actually time to build. Each one is also a genuine expansion of
Rakk Ingredients's "explain, don't judge" positioning (§1), not a
contradiction of it — worth checking future designs against that framing.

*Note: exposure- and dosage-aware explanations, and the ingredient chat
assistant, were originally scoped here as v2 ideas. Both have been pulled
forward into v1 — see §1, §4, §11's `usage_context` field, sourcing in
§12.B2/§13, and the non-negotiables in §9. What remains below are the three
items still genuinely out of scope for launch.*

### 18.1 Personalized "bio-individuality" filtering

**The gap**: Yuka's Nutri-Score-based model (§17.2) applies one universal
scoring rule to every user — it penalizes fat and calories identically
whether the person scanning is a diabetic, an endurance athlete, pregnant, or
managing an autoimmune condition. Since Rakk Ingredients doesn't score at all, this gap
doesn't apply directly, but the *underlying idea* — that flagging relevance
is not one-size-fits-all — is worth carrying forward for what Rakk Ingredients *does*
flag.

**The opportunity**: Let a user set a health profile or dietary context
(e.g. ketogenic, low-glycemic, pregnancy, specific allergen avoidance,
doctor-specified restrictions) that changes which ingredients get surfaced
as notable for *them specifically* — without ever converting that into a
score or verdict. A user on a ketogenic diet doesn't need a "poor" grade on
high-fat avocado oil mayo (Yuka's failure mode) — but a pregnant user
plausibly does want alerts on ingredients specifically flagged for pregnancy
in regulatory guidance, surfaced with the same "state a fact" discipline
(§1) as everything else. This could also let the chat assistant (§4)
personalize which facts it surfaces first, without ever answering "is this
safe for me" directly.

**What this needs that Rakk Ingredients doesn't have yet**:
- A user profile / preferences layer — currently out of scope entirely (the
  app has no accounts or personalization concept beyond auth in §4).
- A per-ingredient tagging system for known population-specific guidance
  (e.g. "FDA advises pregnant individuals limit X" is a citable fact, not a
  judgment call — this can stay consistent with the no-verdict rule in §1 if
  scoped carefully).
- Care to avoid quietly reintroducing Yuka's central flaw: personalization
  should change *what's surfaced as relevant*, never produce a personalized
  score or grade. That distinction is worth writing into the actual feature
  spec whenever this gets built, not just implied.

### 18.2 B2B integration for e-commerce grocery platforms

**The gap**: Rakk Ingredients, like Yuka, is scoped as a consumer mobile app used
while physically standing in a store aisle (§2, §6). But a large and growing
share of grocery shopping happens online (Instacart, Amazon Fresh, regional
delivery apps) where a barcode-scanning mobile flow doesn't fit at all.

**The opportunity**: A B2B API or browser extension that surfaces Rakk Ingredients's
ingredient explanations (not a score — same positioning as §1) directly
inside an online grocery checkout flow, or offers factual ingredient-overlap
comparisons for cart swaps (an online extension of the Compare screen in
§4). This is a largely uncrowded, potentially high-value space specifically
because Yuka and similar apps haven't moved into it.

**What this needs that Rakk Ingredients doesn't have yet**:
- A public-facing API surface for the Ingredient database (§11) — the current
  spec treats this data as internal to the mobile app only, and §7's API
  contract is scoped to the mobile client, not third-party consumption.
- A completely different distribution/sales motion (enterprise/B2B sales to
  grocery platforms) than the consumer app-store launch plan in §16 — this
  is a separate go-to-market track, not a feature toggle, and shouldn't be
  scoped or resourced against the same timeline as the v1 mobile launch.
- Decide early whether this reuses the same regulatory-citation-first
  positioning (§1, §17.4) as the consumer app, or whether a B2B buyer wants
  something closer to a score after all — that's a real product-strategy
  question to resolve before building, not an assumption to inherit
  automatically from the consumer app.

### 18.3 Beyond packaged food — cosmetics, skincare, and household products

**The gap**: v1 is scoped to packaged food (§1, §2) — a toothpaste, a
moisturizer, a shampoo, or a laundry detergent all have ingredient lists a
person is just as unlikely to recognize, and today's spec has no scan path
for any of them. This is also where Yuka itself actually operates two
separate products (food and cosmetics) rather than one unified scanner, so
there's a real precedent for treating it as a genuine expansion rather than
a small tweak.

**The opportunity**: Let the same "scan it, translate it, don't judge it"
flow (§3) work on literally any packaged product with an ingredient list,
not just food — toothpaste, skincare, shampoo, cleaning products, supplements.
The core mechanism barely changes: barcode/photo scan → parse ingredient
list → match against the database → explain, cite, and (where sourceable)
give dosage/exposure context (§1). The product is already positioned to
handle this gracefully: §11's `typical_uses` field already tags each
ingredient as food / cosmetics / pharmaceutical / industrial, and
§17.1's leave-on vs. rinse-off distinction in `usage_context` was written
with exactly this kind of product in mind. Structurally, this is less "add
a new feature" and more "stop artificially filtering out the product
categories the schema already anticipates."

**What this needs that Rakk Ingredients doesn't have yet**:
- A per-category regulatory data source beyond FDA food additives — the
  FDA's Cosmetic Ingredient Database / INCI naming system for personal-care
  products, and possibly EPA/EWG-style sourcing for household chemicals,
  each with their own citation format to fold into `jurisdictions` (§11)
  alongside the food-specific FDA/EFSA/Codex/HK CFS entries.
- INCI-name matching as its own parsing problem (§3, §12) — cosmetic labels
  use standardized INCI names that often differ from a food ingredient's
  common or CFR name for the same underlying substance, so `aka` (§11) needs
  a deliberate INCI pass, not just an incidental one.
- A product-category concept in the data model (food vs. cosmetic vs.
  household) that changes which regulatory source and which citation format
  a card shows — the Label screen (§4) and Home screen's "recently scanned"
  list should probably surface the category too, so a toothpaste doesn't
  read as a mislabeled snack.
- A decision on whether this ships as new screens in the same app or a
  separate companion app — Rakk Ingredients's core identity (§1) is
  food-specific in its name and positioning, so this is a real branding and
  product-scope question, not just an engineering one, and worth resolving
  deliberately rather than growing organically feature-by-feature.
