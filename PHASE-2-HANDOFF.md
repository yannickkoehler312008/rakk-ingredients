# Phase 1 → Phase 2 handoff

> **Phase 2 is done — read `PHASE-2-REPORT.md`.** This file is kept as Phase 1
> wrote it; the report says which of its open items were closed and how.

Written at the end of the Phase 1 app build, for whoever picks up
`MD Files/rakk-phase2-database-population.md`.

Phase 1 delivered a working app running on a seed dataset. **Phase 2's job is
to replace that dataset.** §10 step 8 frames the swap as "a data cutover, not a
code change, if §7's API contract is followed" — that has been held, and this
document is mostly about what the contract is and what Phase 1 learned the hard
way about getting ingredient data right.

---

## 1. The contract Phase 2 must satisfy

**One file defines everything:** `rakk-app/src/types/ingredient.ts`. It is
Appendix A / §11 field for field, in the spec's own snake_case, deliberately —
so the column names, the TypeScript type and the seed records all match and the
cutover is a data swap.

Produce rows that satisfy `Ingredient` and the app works. Nothing in
`src/app/` or `src/components/` knows where ingredients come from.

Two invariants the app relies on:

- **`everyday_allowlist`** drives §3's flagging rule, which is expressed in
  exactly one line of `src/services/matcher.ts`:
  `flagged = matched && !everyday_allowlist`. Nothing else enumerates
  ingredients. Moving a row on or off the allow-list changes app behaviour
  with no code edit — that is §3's "config this, don't hardcode".
- **Names must be unique across `canonical_name` + `aka`.** Two ingredients
  claiming one name makes matching non-deterministic and is invisible in the
  UI. `scripts/check-seed.mjs` fails the build on it; it caught three real
  collisions during Phase 1.

### Where matching runs

`src/services/matcher.ts` runs **on the client**, which contradicts §7 ("runs
server-side as a Postgres function using `pg_trgm`"). It is there only because
Phase 1 had no backend, it is confined to that one module, and it returns the
same `ResolvedScan` every screen already reads. Moving it to Postgres is a
swap of that file — no screen changes.

If matching moves server-side, note the invariant the Label screen depends on:
**concatenating every `LabelRun.text` in order must reproduce
`raw_ingredient_text` byte for byte.** That is what lets §5's signature
interaction render the list as real running text instead of rebuilding it from
matched names. `scripts/test-matcher.mjs` asserts it on six labels; keep that
passing against whatever implementation replaces the client-side matcher.

---

## 2. What the seed actually is, and what it is not

`rakk-app/src/data/seed/` — **270 entries**: 91 on the everyday allow-list,
179 flaggable, 131 US CFR citations, 74 with dosage context.

**It is throwaway.** §9 requires coverage of the full FDA/GRAS/Codex set
(~4,000) at launch, not a curated shortlist. Every row carries
`source: 'manual_curation'` and `last_full_review_at: null` — Appendix A's own
signal that a row has not been reviewed end to end.

Worth reading before writing a new pipeline: `seed/types.ts` has a compact
authoring shape plus an `expand()` that fills defaults and derives what can be
derived (citation strings, eCFR URLs, E-number citations). Deriving beat
hand-writing every field, because most transcription errors happened in the
repetitive parts.

`seed/dosage.ts` is a **separate layer** merged onto records at load. Dosage
comes from published risk assessments rather than the CFR, is reviewed on its
own cadence, and is prioritised by scan frequency (§12.B2). Keep that split.

---

## 3. The findings that matter most

### 3.1 Hand-written citations were ~7% wrong, and plausibly so

131 US CFR citations were written by hand from domain knowledge. Machine-checked
against eCFR, **9 were wrong** — and none looked wrong:

| cited | what the section actually is |
|---|---|
| 21 CFR 184.1318 for gelatin | **Glucono delta-lactone** |
| 21 CFR 184.1763 for sodium selenite | **Sodium hydroxide** |
| 21 CFR 184.1250 for choline bitartrate | **a cellulase enzyme preparation** |
| 21 CFR 172.615 for tara gum | **Chewing gum base** |
| 3 more | sections that do not exist at all |

**Assume the same error rate of any source that has not been mechanically
verified**, including a bulk import that looks authoritative. §9 makes citation
accuracy the whole trust proposition; a wrong citation is worse than none,
because it is confidently checkable and wrong.

### 3.2 There is already a verifier — use it at scale

`rakk-app/scripts/verify-citations.mjs` fetches each cited 21 CFR section from
eCFR and confirms both that it exists and that it names the substance. It is
the single most reusable thing Phase 1 produced. Currently **131/131 pass**.

Two bugs in the first version, both of which made *good* data look bad — worth
knowing before trusting a fresh run:

- eCFR returns XML, so `FD&C Red No. 40` arrives as `FD&amp;C Red No. 40`.
  Entity-decode before matching or every ampersand-bearing colour fails.
- eCFR throttles under concurrency. A single failed fetch is not evidence a
  section is missing — retry with backoff before concluding anything.

Also: CFR headings interpolate. §184.1343 is titled *"Locust (carob) bean gum"*,
which no contiguous form of "locust bean gum" matches. The verifier falls back
to an all-significant-words check.

**eCFR API shape** (it 406s without both of these):
```
https://www.ecfr.gov/api/versioner/v1/full/<date>/title-21.xml?part=<part>&section=<section>
Accept: application/xml
Accept-Encoding: gzip      # "This endpoint requires response compression"
```

### 3.3 ADI figures could not be verified, and that gap is open

`seed/dosage.ts` figures are hand-written and **not machine-checked**. JECFA's
database uses opaque internal IDs (chemical `1861` is *Argon*) and its search
endpoints redirect, so no cheap programmatic lookup was found. Given 3.1,
assume a similar error rate.

What *is* enforced: §11's structural rule that no dosage claim exists without a
traceable source. `check-seed.mjs` fails the build if a `usage_context` has no
`risk_assessment_refs`. Finding a real verification path for ADIs — EFSA
OpenFoodTox, the JECFA monograph PDFs, or the EU additives database — is
genuinely valuable Phase 2 work.

### 3.4 Coverage gaps, with names

**31 flaggable ingredients have no jurisdiction entry at all** and render an
honest "No regulatory entry on file yet" chip. `check-seed.mjs` lists them.
They cluster into: enzymes (amylase, protease, rennet, lactase,
transglutaminase), protein isolates (whey, casein, soy, pea, wheat gluten),
refined oils (palm, soybean, interesterified, MCT), and a few nutrients whose
citations were removed as wrong in 3.1.

Many are foods rather than regulated additives, so the right answer may be a
different kind of status entry rather than a CFR cite. Worth deciding
deliberately, because it affects how §9's "never a flag without a source" reads.

### 3.5 Open Food Facts is patchy, in two distinct ways

Product data comes from OFF, not from your ingredient database — see §5 below
if that distinction is unclear.

- **Names can be junk.** `0016000275287` has `product_name: "Cheerios"` but
  `product_name_en: "My Bff"`. The client prefers the plain field for names.
- **`ingredients_text_en` is usually *better* than the plain field** — more
  complete, sub-ingredients spelled out. So the two fields get **opposite**
  preference. That asymmetry is deliberate and documented in
  `src/services/openFoodFacts.ts`.
- Many products are in OFF with **no ingredient list at all** (e.g. Aquafina,
  `0012000001086`). That has its own designed state, and it is why the photo
  path exists.

Normalising crowd-sourced data properly belongs in the backend ETL (§6's
scheduled OFF job), not on the client. The client's field-picking is a
stopgap.

### 3.6 The allow-list is a product decision, not a data one

§3 describes ~40–60 everyday ingredients. It is at **91**, because applying the
rule literally underlined almost every word of a fortified cereal label —
Cheerios came out **14 flagged of 18**, which makes the underline carry no
information.

The fix was to move *familiar names* (Vitamin C, Iron, Zinc) onto the
allow-list while leaving the *chemical forms* (sodium ascorbate, pyridoxine
hydrochloride) flagged and explainable. Cheerios is now 9 of 17.

If Phase 2 changes allow-list membership, re-check a fortified cereal. The
metric that matters is not the count — it is whether an underline still means
something.

### 3.7 Counts follow printed entries, not matched records

"Vitamin C (sodium ascorbate)" is **one** ingredient, the way a human reading
the package counts, even though both halves match records. Counting records
inflated every fortified product. See the comment in `matcher.ts`.

---

## 4. Things that will silently break if changed carelessly

- **Cached scans re-match on read.** `scanStore.ts` stores the *product* and
  re-runs matching, because storing the computed result meant a scan taken
  before a seed change replayed the old matcher forever — Cheerios kept
  showing pre-change numbers. When the database updates after launch (§12.D),
  this is what stops history going stale. Do not "optimise" it back.
- **The copy guard.** `scripts/check-copy.sh` enforces the two
  non-negotiables: no score/grade/rating/verdict in naming, no judgment
  adjectives in copy, no colour literals outside the token file. It scans
  `src/`, `scripts/` and `supabase/`. Four files are excluded **by path**
  because their job is to name the banned words. Wire it into CI before
  anything ships.
- **`risk_assessment_refs` is not a rating.** It is Appendix A's own field name
  and holds citation links. It is the one identifier containing "risk" that the
  guard allows, by exact name.

---

## 5. If the two data sources are confusing

They are different things and it caused confusion once already:

| | what it answers | where it comes from |
|---|---|---|
| **The ingredient database** | what *is* sodium benzoate? status? dose? | the seed now; Phase 2's real database later |
| **The product's ingredient list** | what is in *this packet*? | Open Food Facts (barcode) or OCR (photo) |

Phase 2 builds the first. It does not affect the second.

---

## 6. State at handoff

Build order §10 complete except step 8 (the cutover Phase 2 enables).

Verified working against the live Supabase project: barcode → OFF → match →
flagged label → cards with citations and dosage; Compare against real history;
auth, rate limiting and both Edge Functions deployed.

**Two claims not yet verified, both blocked on Anthropic billing credit:**

1. whether the chat assistant's *model* obeys its system prompt
   (`scripts/live-guardrail-check.mjs`, ~$0.10). The deterministic layers —
   an output filter that withholds rule-breaking replies, and personal-health
   questions refused without a model call — are tested and hold regardless.
2. OCR transcription quality (`supabase/functions/read-label/`). The parsing
   safeguards are tested; whether the vision model transcribes faithfully
   rather than "helpfully" is unknown. This matters: a language model shown a
   blurry `sodium ben?oate` will write `sodium benzoate`, and an invented
   ingredient is a confident false statement about a real package. The user
   confirms the transcription before matching, which is a deliberate addition
   to §4's flow.

### Run these before trusting anything

```bash
cd rakk-app
npx tsc --noEmit
bash scripts/check-copy.sh          # the two non-negotiables
node scripts/check-seed.mjs         # integrity + §11's dosage-source rule
node scripts/test-matcher.mjs       # matcher invariants, 16 assertions
node scripts/verify-citations.mjs   # every US CFR citation, against eCFR
node scripts/test-guardrails.mjs    # chat guardrails, 31 cases
node scripts/test-transcription.mjs # OCR safeguards, 14 cases
npx expo-doctor
```

All green at handoff.
