# Review brief — for the lawyer and the food scientist

**When:** at the very end, once the app and its content are final (product
spec §15). **Before sending**, regenerate the reviewer sheet so it matches
the database being shipped:

```bash
cd pipeline && node review-sample.mjs     # → pipeline/out/review-sample.csv
```

This brief is written so each reviewer can work through a fixed list instead
of discovering the app. Part A is for the lawyer, Part B for the food
scientist / regulatory-affairs reviewer. Part C says what to send back.

---

## The app in one page

Rakk Ingredients scans a packaged food's barcode, or reads a photo of its
ingredient panel, and explains each ingredient. It gives **no health score,
grade or verdict**: it states what an ingredient is, how regulators classify
it, and published intake limits where they exist. The reader draws the
conclusions. Users see "Rakk is an informational reference tool, not health
advice" at onboarding and in the chat.

**What the Label screen shows**
- The ingredient list as printed. Some ingredients are **underlined
  ("flagged")**. Flagged means *worth reading about*; it is not a warning.
  Everyday foods (water, salt, flour, olive oil…) are not underlined.
- A count, e.g. "17 ingredients, 9 flagged".

**What a tapped ingredient card says**, field by field:

| Card element | Example | Comes from |
|---|---|---|
| Name, E/INS code | Sodium benzoate · E211 | regulators' lists |
| Category · origin | Preservative · Synthetic | curated, or the regulation's stated purpose |
| Explanation (1–2 sentences) | "The sodium salt of benzoic acid. It stops yeast and mould…" | hand-written for ~280 common ingredients; generated from a fixed vocabulary for the rest |
| Allergen line | "Derived from soy." | curated, or read from the name (see A2) |
| Regulator chips | US FDA · EU · Codex · Hong Kong, each with status and citation | the regulators' own documents |
| Dosage & exposure | Acceptable Daily Intake, typical use, sources | published assessments (JECFA, EFSA, FDA) |

There's also a **chat assistant** that answers questions about the scanned
product. It is restricted to the product's ingredients, declines personal
health advice, and has an output filter that blocks judgment words.

**Size:** about 4,900 ingredients. Every field records which source document
it came from, and the exact source text, in `pipeline/out/provenance.json`.

---

## Part A — Lawyer

Each item is a question. Where to look is given so you don't have to search.

### A1. Health-claim exposure
- **Q:** Is "informational reference tool, not health advice", placed where it
  is, sufficient for a consumer app in the US, EU, UK and Hong Kong?
  *(Onboarding screen and chat sheet.)*
- **Q:** "Flagged" ingredients are underlined. Can underlining by itself be
  read as an implied health claim?
- **Q — owner decision to check:** all **seed oils** (canola, sunflower,
  soybean, corn, cottonseed, grapeseed, rice bran, safflower, sesame,
  "vegetable oil") are flagged by product choice. **The app does not say
  why**, and does not say they cause inflammation or anything else about
  health. If marketing, or the chat, ever says so, is that a health claim
  needing substantiation?
- **Q:** The "Dosage & exposure" block shows Acceptable Daily Intakes beside
  typical use levels, without comparing them. Is that sufficiently
  non-advisory?

### A2. Allergen statements — the sharpest liability (spec §15)
- About 120 ingredients show "Derived from [allergen]". About 30 are curated;
  about **90 are read from the name** ("whey protein" → milk), under narrow
  rules in `pipeline/lib/vocab.mjs` (`ALLERGEN_RULES`).
- **Q:** Should name-derived allergen lines ship at all, or only curated ones?
- **Q:** What disclaimer, if any, must sit beside allergen information
  ("always check the package")?
- Context: the build already caught one error of exactly this kind. "Lecithin"
  and "sunflower lecithin" had been labelled as soy-derived; they are now
  separate.

### A3. Regulatory status wording
- Statuses quote or closely paraphrase each regulator, with a citation
  (e.g. "Affirmed by FDA as GRAS — 21 CFR 184.1733"). Two forms deserve a
  look:
  - **EU absence:** "Not on the EU list of authorised food additives" is shown
    where an E-number is missing from Regulation (EC) 1333/2008 Annex II
    (e.g. calcium sorbate, E203).
  - **Codex:** "Has Codex INS number 211 (preservative). An INS number
    identifies an additive; it is not a Codex approval." The wording follows
    the guideline's own statement that INS inclusion "does not imply
    approval".
- **Q:** Is either wording a risk if a regulator's list changes between the
  monthly refreshes? (Data refreshes monthly; see `NEXT-STEPS.md`.)
- **Q:** Some flagged ingredients show "No regulatory entry on file yet"
  (mostly foods such as palm oil). Is that acceptable?

### A4. Data licences and the credits screen
Nothing needs installing or importing for these; what's needed is a decision,
plus a credits screen in the app. Draft credits text is below.

| Source | Terms | Question for you |
|---|---|---|
| US FDA inventories, 21 CFR (eCFR) | US government works, public domain | none |
| USDA FoodData Central (product fallback) | public domain (CC0) | none |
| EU Reg. (EC) 1333/2008 via EUR-Lex | reuse allowed if the source is acknowledged ([legal notice](https://eur-lex.europa.eu/content/legal-notice/legal-notice.html)) | Is the credit line enough? |
| EFSA OpenFoodTox ([record](https://zenodo.org/records/19388272)) | **CC BY-ND 4.0** | We show individual ADI figures, each citing the EFSA opinion by DOI. Is that a "derivative" under ND? If yes, the 32 EFSA-sourced dosage figures must go |
| Hong Kong Cap. 132 via DATA.GOV.HK ([terms](https://data.gov.hk/en/terms-and-conditions)) | reuse with attribution | Is the credit line enough? |
| Codex CXG 36-1989, FAO/WHO ([record](https://openknowledge.fao.org/handle/20.500.14283/cd8953en)) | **CC BY 4.0** | none beyond credit |
| Open Food Facts (product data) | **ODbL** database licence; content licences vary | The app caches products users scan. Does ODbL's share-alike apply to that cache or to anything we derive? |

**Draft credits text:**
> Ingredient information includes material from: US Food and Drug
> Administration; US Code of Federal Regulations (eCFR); USDA FoodData
> Central; EU Regulation (EC) No 1333/2008 © European Union,
> eur-lex.europa.eu; EFSA OpenFoodTox (CC BY-ND 4.0); FAO and WHO, Codex
> Alimentarius Guideline CXG 36-1989 (2026) (CC BY 4.0); Hong Kong e-Legislation
> via DATA.GOV.HK. Product information: © Open Food Facts contributors (ODbL).

### A5. Personal data (GDPR, CCPA, HK PDPO)
What the app actually does, for the privacy policy:

| Data | Where it goes | Kept? |
|---|---|---|
| Scan history, cached products | on the phone only | until the user clears it |
| Anonymous account (a random user id) | Supabase Auth | yes; used for per-user rate limits |
| Chat questions and product context | sent to Anthropic to answer | **not stored** by Rakk; only a per-hour counter |
| Label photos | sent to Anthropic to transcribe | **not stored** by Rakk; only a counter |
| Unrecognised ingredient names + product barcode | Supabase, `unmatched_ingredient_log` | yes, **no user id** |
| Usage events: scan outcomes, which ingredient cards are opened, that a chat question was asked, onboarding timing | Supabase, `app_events` | yes, **no user or install id**, never chat text |
| Barcode lookups | Open Food Facts; USDA via Supabase | not stored beyond the phone cache |

- **Q:** What has to be disclosed, and is consent needed for the usage events
  in the EU?
- **Q:** Processors to list: Supabase (hosting), Anthropic (chat and photo
  reading), Open Food Facts and USDA (lookups). Do any need a data processing
  agreement?

### A6. The chat assistant
- Its rules are in `supabase/functions/ingredient-chat/guardrails.ts`, and
  there are 31 automated test cases.
- **Q:** Is declining personal health questions (as designed) enough, or is a
  standing disclaimer in each reply needed?

---

## Part B — Food scientist / regulatory affairs

### B1. The claim-by-claim sheet — `pipeline/out/review-sample.csv`
About 880 claims, each next to the source text it was taken from. Fill in
`reviewer_check` (ok / wrong / unclear) and `reviewer_notes`.

| Stratum | What | Why it's in the sample |
|---|---|---|
| A | **every** dosage claim (ADI, typical use) | §15 names these first |
| B | every allergen flag read from a name | sharpest liability |
| C | 60 common additives | stands in for "most scanned" until real usage data exists |
| D | a spread of the bulk database, every source type | measures the pipeline's error rate, not just the curated part |

### B2. Seed dosage figures that differ from EFSA
`pipeline/out/build-report.json` → `seed_dosage_check`. Hand-written figures
(mostly JECFA) compared with EFSA's. Differences are often legitimate, since
the bodies set their own values. **Q:** Is each figure correct for the body it
names?

### B3. One file reviews ~3,700 explanations — `pipeline/lib/vocab.mjs`
Ingredients without a hand-written explanation get one sentence built from the
FDA's technical-effect code ("Used in food to help oil and water stay evenly
mixed."). There are 38 such sentences (`EFFECTS`). **Q:** Is each accurate and
neutral? Codex-only additives instead quote Codex's own definition of their
class verbatim.

### B4. The everyday list — what is never underlined
130 entries: water, salt, sugar, flour, spices (21 CFR 182.10), olive oil,
coconut oil… Listed in `rakk-app/src/data/seed/everyday.ts`, plus the spices
the build adds (`build-report.json` → `allowlist_added`). **Q:** Does anything
on it deserve a card, or anything off it not?

### B5. Hand-made joins — `pipeline/curation/links.mjs`
Six places where a person decided two names are one substance (e.g. Hong
Kong's "Vegetable Black" = E153 vegetable carbon). Each has its reason
written beside it. **Q:** Is each right?

### B6. Known gaps (for awareness, not a fault)
- 18 flagged ingredients have no regulatory entry: mostly foods such as oils
  and syrups.
- Dosage context exists for 108 ingredients. Most additives have no published
  intake limit, and the app shows nothing rather than guess.
- JECFA figures can't be machine-checked (no machine-readable source); EFSA's
  can, and are.

---

## Part C — What to send back

1. The completed `review-sample.csv`.
2. A list of answers to the **Q:** items, numbered as above (A1…, B2…).
3. Required wording changes, quoted exactly as they should read.

Then: corrections go into the curated seed or the pipeline, the database is
rebuilt and re-verified, and reviewed rows get their `last_full_review_at`
date. That date is currently empty on every row, and that is accurate: no
human has reviewed them end to end yet.
