# Ingredient database pipeline

Builds the Rakk Ingredients database from bulk regulatory sources
(`MD Files/rakk-phase2-database-population.md` §11–§13) and ships it to
Supabase and to the app's offline bundle.

No dependencies beyond Node 24, Python 3 (stdlib, for reading `.xlsx`), and
`tsx` (already used by `rakk-app/scripts`). Everything a build reads is listed
in `sources.mjs`.

## Run

```bash
cd pipeline
node fetch.mjs                          # download sources → sources/raw/, record sources/manifest.json
cd ../rakk-app
npx tsx ../pipeline/build.ts            # merge → pipeline/out/{ingredients,provenance,build-report}.json
npx tsx ../pipeline/verify.ts           # independent second pass → out/verify-report.json (exit 1 on any failure)
npx tsx ../pipeline/emit.ts             # → supabase/migrations/NNNN_ingredient_release_<version>.sql
                                        #   + rakk-app/src/data/catalog/bundled.json  (refuses unless verify passed)
node scripts/test-catalog-lookup.mjs    # subset + server lookup ≡ full database, on ~3,000 labels
cd ../pipeline
node diff.mjs                           # §12.D change review vs the last committed build → out/change-review.md
node review-sample.mjs                  # §15 reviewer sheet → out/review-sample.csv
```

Deploying is committing the new release migration: Supabase's GitHub
integration applies it. A release migration that is not yet committed is
replaced by the next `emit`; once committed it is history.

## Sources

| id | what | access | terms |
|---|---|---|---|
| `fda_saf` | FDA Substances Added to Food, full export (3,971 substances) | direct download | US public domain |
| `fda_gras_notices` | FDA GRAS Notice Inventory (1,336 notices) | direct download | US public domain |
| `fda_color_additives` | FDA Color Additive Status List (304) | direct download | US public domain |
| `ecfr_21_*` | 21 CFR Subchapter B (Parts 100–199) + Parts 73, 74, 81, 82 | eCFR versioner API | US public domain |
| `eu_1333_2008` | Reg. (EC) 1333/2008, latest consolidated text | EU Publications Office (Cellar) | reuse with acknowledgement — **confirm** |
| `efsa_openfoodtox` | EFSA OpenFoodTox 3.0 (ADIs, formulas) | Zenodo | CC BY-ND 4.0 — **confirm** |
| `hk_legislation` | HK Cap. 132BD, 132H, 132U, 132AR | DATA.GOV.HK bulk XML | DATA.GOV.HK terms — **confirm** |
| `codex_ins` | Codex CXG 36 (INS list) | **manual**: FAO serves it behind a bot challenge, which this pipeline does not bypass | FAO/WHO; likely NC — **confirm** |

EUR-Lex's own website and FAO sit behind bot challenges; the pipeline uses
documented machine interfaces only (Cellar for EU law) and never works around
a challenge.

## The rules the build holds to

- **Nothing from model memory.** Every value is parsed from a source (excerpt
  kept), taken from the curated seed, or produced by the fixed vocabulary in
  `lib/vocab.mjs` from a parsed code. `out/provenance.json` records which, for
  every field of every row.
- **Joins on identifiers, not fuzzy names** (§13): CAS number, E-number/INS,
  Colour Index number, then exact normalised names.
- **A citation must LIST the substance, not mention it.** The substance must be
  the section's subject, in its identity paragraph (a), one entry of a list
  section, or a term the section defines. Mentions don't count: § 73.85
  (caramel) mentions potassium phosphate as a reactant; § 184.1434 is
  magnesium phosphate. Both were being cited for potassium phosphate. The rule
  lives in `parse/ecfr.mjs` (`listsSubstance`) and is shared with
  `rakk-app/scripts/verify-citations.mjs`.
- **Packaging is not food.** Parts 175–178, 186 and §§ 182.70/182.90/182.99 are
  food-contact or pesticide lists; a substance cited only there is described as
  such, and a curated food never inherits such a citation.
- **The seed wins on curated fields** (explanation, allow-list, dosage); bulk
  data fills what it left empty and corrects what verification disproves.
- **One name, one ingredient**, checked on the matcher's own needles
  (`needlesFor`), plurals included. Ambiguous aliases are dropped from every
  row that claims them.
- **Nothing unverified ships.** `emit.ts` refuses to run unless `verify.ts` is
  newer than the build and reported zero failures.

## What the vocabulary writes

~4,400 bulk rows have no hand-written explanation. Their `plain_explanation`
comes from the regulation's own 21 CFR 170.3(o) technical effect (or FDA's
inventory field), through one plain-English line per effect in
`lib/vocab.mjs` — "Used in food to help oil and water stay evenly mixed." It is
accurate and dull. Reviewing that one file reviews every templated sentence.
The grounded LLM extraction pass in §13 is the way to do better; see
`PHASE-2-REPORT.md`.

## Files

```
sources.mjs         source registry (URLs, terms)
fetch.mjs           downloader; writes sources/manifest.json (committed)
parse/              one parser per source; ecfr.mjs also holds listsSubstance()
lib/text.mjs        entities, CSV, CAS check digit, name keys
lib/vocab.mjs       the fixed vocabularies (effects, US status wording, allergen rules)
lib/xlsx2csv.py     stdlib .xlsx reader (OpenFoodTox)
build.ts            merge → out/
verify.ts           independent second pass
emit.ts             release migration + bundled offline subset
diff.mjs            §12.D change review
review-sample.mjs   §15 reviewer sheet
out/                the committed build: ingredients, provenance, reports
```
