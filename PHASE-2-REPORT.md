# Phase 2 — database population: report

Picks up from `PHASE-2-HANDOFF.md`. Spec: `MD Files/rakk-phase2-database-population.md`.

**State:** the ingredient database is built, verified and wired into the app.
It is **not deployed**: the three new migrations take effect once they are
pushed (see "To ship"). Until then the app falls back to its bundled offline
subset, and it was checked working in that state.

---

## 1. What exists now

| | |
|---|---|
| **Ingredients** | **4,719** rows satisfying `rakk-app/src/types/ingredient.ts` (Phase 1: 270) |
| from | FDA Substances Added to Food 3,773 · GRAS notices 549 · EU-only 112 · FDA colour list 13 · curated seed 272 |
| US FDA status | 4,527 rows; **1,910 with a 21 CFR citation verified to list the substance** |
| EU status | 346 rows, from Reg. (EC) 1333/2008 Annex II (consolidated 2026-08-18) |
| HK status | 114 rows, from Cap. 132BD / 132H / 132U |
| Codex | 3 (seed only; see §4) |
| Dosage context | 108 rows (76 seed + 32 new from EFSA opinions, each with a DOI) |
| Identifiers | CAS 3,286 · E-number 344 · formula 1,664 |
| Flaggable with no regulatory entry | 12 (was 31) |
| Verification | 0 failures across ~18,700 independent checks |

Every field of every row has provenance in `pipeline/out/provenance.json`,
covering the source, where in it the value came from, the verbatim text, and
whether the value was parsed, curated, or produced by the fixed vocabulary.

### The pieces

- **`pipeline/`** fetches the sources, builds, verifies and emits. See
  `pipeline/README.md`.
- **`supabase/migrations/0003_ingredients.sql`** holds the §11 table
  (public-read), the name-lookup table, `lookup_ingredients()`, the
  unmatched-ingredient backlog (§12.B) and `pg_trgm`.
- **`0004_app_events.sql`** is §14 instrumentation. It records event types and
  ingredient ids only, with no user or install id. The `dosage_research_queue`
  view lists the most-opened ingredients that lack dosage context: §12.B2's
  prioritisation, made real.
- **`0005_ingredient_release_2026-09-29_21b67c74.sql`** is the data (5.0 MB,
  generated).
- **App cutover** (`src/services/catalog.ts`): the app bundles a 314-row
  offline subset (§8). For each label it sends the label's word runs to
  `lookup_ingredients` and matches against bundled + returned rows. The full
  database never lives on the device (§7), and **the Label result is identical
  to matching against the full database**. `scripts/test-catalog-lookup.mjs`
  proves it on 3,007 labels. Screens are unchanged. Fetched rows are cached for
  offline re-match and refreshed when the server publishes a new release.

## 2. Findings — the data errors this caught

The handoff predicted this (§3.1: "assume the same error rate of any source
that has not been mechanically verified"). It held.

1. **Three more wrong seed citations**, which Phase 1's checker passed because
   it accepted a name whose words appeared *anywhere* in a section:
   - Tripotassium phosphate → § 184.1434, which is **magnesium phosphate**
   - Powdered cellulose and microcrystalline cellulose → § 182.90, which lists
     **substances migrating from paper packaging**

   All three are removed. The checker now requires the section to *list* the
   substance, as its subject, in paragraph (a), or as a list entry. With that
   rule it passes 128/128 and agrees with the pipeline.
2. **Calcium sorbate (E203) is not authorised in the EU.** The seed said it
   was; E203 is absent from the current Annex II (withdrawn in 2018). It now
   reads "Not on the EU list".
3. **The seed's "Soy lecithin" row also answered to "lecithin", "E322" and
   "sunflower lecithin", and carried the soy allergen flag.** Any
   sunflower-lecithin product was told its lecithin was derived from soy.
   Split into Lecithin (no allergen claim), Soy lecithin, and Sunflower
   lecithin. Sunflower lecithin has no CFR entry (§ 184.1400 names soy,
   safflower and corn), and the pipeline found its GRAS notice (GRN 1267).
4. **FDA's own inventory cites 107 CFR sections that no longer exist**, and
   1,665 that exist but don't list the substance (mostly food-contact
   sections and standards of identity). None of these is emitted.
5. **Titanium dioxide**: the EU annex still lists E 171, with a footnote that
   it "is not authorised in the food categories listed in Part D and E". A
   naive parse reads that as authorised. The pipeline carries footnotes, so it
   reads "Not authorised for use in food; kept on the EU list only for use in
   medicines".
6. **Seed ADIs, checked for the first time** (handoff §3.3): 16 of 29 match
   EFSA exactly. 13 differ, and all 13 are attributed to JECFA or FDA, which
   set their own values, so a difference is expected. They are listed in
   `pipeline/out/build-report.json` → `seed_dosage_check` for the reviewer.
   Nothing was overwritten.

## 3. §13's spike, answered

- eCFR returns clean, parseable XML for every Part needed. The whole of
  Subchapter B is one 21 MB call.
- **FDA Substances Added to Food *does* have a bulk export.** §12.B assumed it
  didn't. The inventory page links a full CSV, and so do the GRAS Notice and
  Colour Additive inventories. That made the substance list a parse, not a
  scrape.
- EPA CompTox (FDAFOODSUBS) was not needed. The FDA export carries CAS numbers
  and synonyms directly, and EFSA OpenFoodTox supplies formulas.
- EU: EUR-Lex's website sits behind a bot challenge, but the Publications
  Office's Cellar API serves the same consolidated text by CELEX number.
- **Codex is blocked.** FAO serves CXG 36 and GSFA behind a Cloudflare
  challenge, and the pipeline does not bypass it.
- HK: all of Cap. 132 is on DATA.GOV.HK as bulk XML. Preservatives are keyed
  by INS number, so they join cleanly.

## 4. Not done, and why — what needs you

| # | What | Why it isn't done | What unblocks it |
|---|---|---|---|
| 1 | **Deploy** | Deploying is pushing to `main`, which I don't do without a go-ahead | Commit and push; the GitHub integration applies 0003–0005. Then scan once and check that `lookup_ingredients` returns 200 |
| 2 | **Codex INS** | FAO bot challenge | Download CXG 36 in a browser into `pipeline/sources/manual/codex/`; a parser then needs writing against the real file. Confirm the licence first: FAO material is commonly CC BY-NC-SA, and NC matters for a paid app |
| 3 | **Licences** | §13 says confirm, don't assume | A human read of the EU (acknowledgement required, so it likely needs an in-app attribution), EFSA OpenFoodTox (**CC BY-ND**: is showing an extracted ADI a derivative?), and DATA.GOV.HK terms. Status per source is in `pipeline/sources.mjs` |
| 4 | **§15 food-science review** | Needs a qualified person | `pipeline/out/review-sample.csv`: 821 claims from 355 ingredients. It covers every dosage claim, every name-derived allergen flag, 60 common additives, and a spread of bulk rows, each paired with its source text |
| 5 | **Grounded LLM extraction** (§13) | The handoff says Anthropic billing was blocked; I didn't build an LLM path I couldn't run | Numeric use-level limits are still in the CFR text, unextracted. ~4,400 bulk explanations are templated from FDA's technical-effect codes: accurate, but generic. The verification half already exists (`verify.ts` re-checks every excerpt against its source) |
| 6 | **JECFA ADIs** | Still no machine-readable source (handoff §3.3) | EFSA now covers what it has evaluated; JECFA-only figures stay hand-written and unverified |
| 7 | **Dosage coverage** | Only 108 rows, because the data exists for few | `dosage_research_queue` will order the backlog by real card opens once deployed |
| 8 | **Allergen flags on bulk rows** | 88 rows get a flag derived from the name ("whey protein" → milk) | Narrow rules, each one listed; in the review sheet. §15's legal review should decide whether name-derived flags ship |
| 9 | **Privacy policy** | The unmatched log and event table are new data collection, even without identifiers | Disclose both (§14, §15) |
| 10 | Abuse limits | `log_unmatched_ingredients` and `record_app_event` are writable anonymously (capped per call, validated, no read access) | Add rate limiting if abuse shows up |
| 11 | 18 HK-listed additives and 12 flaggable rows without regulatory entries | Nothing joins them to a row, or they are foods rather than additives (palm oil, soybean oil, syrups) | Listed in `build-report.json`; the handoff's §3.4 question on how "foods" should be described still stands |
| 12 | `expo-doctor` | 4 Expo patch releases shipped since Phase 1 | `npx expo install --check` (unrelated to Phase 2) |

## 5. Changes to Phase 1 code

All deliberate, and all small:

- **`matcher.ts`**: `needlesFor` and `candidatePhrases` are extracted and
  exported, so the database's lookup table is built from the matcher's own
  function. Names that can't be matched from a label (not word-bounded, or
  over 12 words) are not indexed; the seed has none. Needle ties now break by
  needle and id rather than catalog order, so a subset matches exactly like
  the whole.
- **`scan.tsx`, `scanStore.ts`, `label.tsx`, `_layout.tsx`**: match against
  the catalog service instead of `SEED_INGREDIENTS`. "Matching ingredients" is
  now its own visible progress step (§9). A label opened online re-asks the
  database about names it couldn't match offline.
- **Seed**: 3 wrong citations removed; lecithin split into three rows.
- **`verify-citations.mjs`**: uses the shared "listed, not mentioned" rule and
  the 2026-09-25 eCFR.
- **`check-copy.sh`**: now also scans the pipeline's code and vocabulary. It
  caught a field I had named `verdict`.
- **`IngredientSource`**: two values added, `fda_color_additives` and
  `eu_additives_regulation`, because rows from those sources are neither SAF
  nor manual curation. Nothing in the app reads `source`.

The seed stays as the curated layer: the pipeline reads it, and its content
wins on the fields a human wrote.

## 6. Run before trusting anything

```bash
cd rakk-app
npx tsc --noEmit
bash scripts/check-copy.sh
node scripts/check-seed.mjs
node scripts/test-matcher.mjs
node scripts/test-catalog-lookup.mjs   # new: subset + lookup ≡ full database
node scripts/verify-citations.mjs      # now "listed, not mentioned"
node scripts/test-guardrails.mjs
node scripts/test-transcription.mjs
npx tsx ../pipeline/verify.ts          # new: the whole database, re-checked against its sources
```

All green at the end of Phase 2, except `expo-doctor`'s patch-version notice
(item 12).

## 7. Keeping it current (§12.D)

Monthly: `fetch → build → verify → diff → emit`. `out/change-review.md` lists
the sources whose hash moved, every row whose regulatory status changed (the
manual pass is exactly that list), and this month's slice of the annual
full-review sweep, with dosage and allergen rows first. `last_full_review_at`
is null on every row. Nothing has had a human end-to-end review yet, and the
field says so.
