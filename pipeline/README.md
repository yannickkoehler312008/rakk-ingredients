# Ingredient database pipeline

Builds the Rakk Ingredients database from bulk regulatory sources
(`MD Files/rakk-phase2-database-population.md` §11–§13) and ships it to
Supabase and to the app's offline bundle.

Needs Node 24, Python 3 (stdlib, for reading `.xlsx`), `tsx` (already used by
`rakk-app/scripts`), and one pinned npm package, `pdfjs-dist`, for reading the
Codex PDF — run `npm ci` in `pipeline/` once. Everything a build reads is
listed in `sources.mjs`.

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
node check-release.mjs                  # the committed migration, offline bundle and build agree
```

**This runs by itself.** `.github/workflows/data-refresh.yml` does all of
the above on the 1st of each month and opens a pull request if the data
changed. `.github/workflows/checks.yml` runs the checks on every push.

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
| `codex_ins` | Codex CXG 36-1989, 2026 edition (674 INS entries, 27 functional classes) | FAO Open Knowledge repository (the fao.org copy is behind a bot challenge) | CC BY 4.0 — credit FAO and WHO |

EUR-Lex's own website and fao.org sit behind bot challenges; the pipeline uses
documented machine interfaces and public repositories only (Cellar for EU law,
FAO Open Knowledge for Codex) and never works around a challenge.

**Codex is an identifier, not an approval.** CXG 36's introduction: "Inclusion
in the INS does not imply approval by Codex for use as food additives." Codex
chips say exactly that, and `verify.ts` fails any that don't. The table is read
from the PDF's own drawn rules (a rule crossing the INS column is a row edge),
because merged cells make text spacing ambiguous; the parser fails loudly
rather than guess.

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
- **A shared number is not enough.** The EU and Codex mostly number additives
  alike, but not always (E1210 is carbomer; INS 1210 is sodium polyacrylate).
  A number joins two sources only if the names also agree, and a row answers
  to "INS n" only if Codex itself gives it n. Bracketed numbers count:
  "Polyoxyethylene (8) stearate" and "(40) stearate" are different.
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
parse/              one parser per source; ecfr.mjs also holds listsSubstance(),
                    codex-ins.mjs reads the CXG 36 PDF
curation/links.mjs  the few joins a person made, each with its reason
check-release.mjs   migration ↔ bundle ↔ build ↔ verification agree (CI)
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
