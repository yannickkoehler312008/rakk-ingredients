# Rakk Ingredients — Phase 1: App Build

> Split from `rakk-ingredients-product-spec.md` (the full product spec) for a phase-scoped hand-off to Claude Code. If anything here references a section number (e.g. §11) that isn't included in this file, it's in one of the sibling phase files or the full spec, kept in this same folder.

This is the build brief for the app shell itself: screens, design system,
navigation, and the plumbing to the backend. Build against the seed/mock
data approach described in §10 below — do not wait on full ingredient
database coverage (that's Phase 2, in `rakk-phase2-database-population.md`).

---

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

## Appendix A: Ingredient schema (for reference while building against the API)

The full sourcing plan for this data lives in Phase 2
(`rakk-phase2-database-population.md`). This is just the schema shape so the
app's API contract (§7) and screens (§4) can be built against something
concrete before the full database is populated.

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

---

## Appendix B: Monetization (build this into onboarding/paywall now, not later)

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
