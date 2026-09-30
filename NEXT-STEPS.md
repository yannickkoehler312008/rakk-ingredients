# What needs doing after Phase 2 — and how

Ordered by what unblocks what. Supabase project: `xqsjnopgekmanshqsyxj`
(dashboard: https://supabase.com/dashboard/project/xqsjnopgekmanshqsyxj).
Background for every item is in `PHASE-2-REPORT.md`.

---

## 1. Confirm the database deployed (10 min)

Pushing to `main` hands migrations `0003`–`0005` to Supabase's GitHub
integration.

> **Status 2026-09-29: deployed and checked from outside.** The production
> API serves release `2026-09-29.21b67c74` with 4,719 ingredients and 28,883
> names, and `lookup_ingredients` answers. The public key cannot read
> `app_events`, and an invalid event is rejected. What's left is the phone
> test (3), and the dashboard check (1) if you want to see it yourself.

1. **Check that it ran.** In the dashboard, open **Integrations → GitHub**. The
   latest deployment should be the Phase 2 commit, marked successful. If it
   failed, open its log and send it to me.
2. **Check the data.** In **SQL Editor**, run:
   ```sql
   select version, row_count from ingredient_dataset_releases;       -- 2026-09-29.21b67c74, 4719
   select count(*) from ingredients;                                   -- 4719
   select count(*) from ingredient_names;                              -- 28883
   select id from lookup_ingredients(array['sodium benzoate','e 211']); -- ing_sodium_benzoate
   ```
3. **Check the app.** Run `cd rakk-app && npx expo start`, open it on your
   phone with Expo Go, and scan a packet. The "Matching ingredients" step
   should appear, and the label should resolve.
4. **If the integration is not set to deploy `main` to production**, use the
   CLI instead:
   ```bash
   brew install supabase/tap/supabase
   supabase login
   cd "Rakk Ingredients" && supabase link --project-ref xqsjnopgekmanshqsyxj
   supabase db push            # applies any migration the project hasn't run
   ```

## 2. Put the data checks into CI (30 min, or ask me)

Every check in `PHASE-2-REPORT.md` §6 runs locally only. Add a GitHub Actions
workflow (`.github/workflows/checks.yml`) that runs them on every push:
typecheck, `check-copy.sh`, `check-seed.mjs`, `test-matcher.mjs`,
`test-catalog-lookup.mjs`, `test-guardrails.mjs`, `test-transcription.mjs`.
Leave out `verify-citations.mjs`: it hits eCFR over the network.
`check-copy.sh`'s own header says "wire it into CI before the first build that
leaves this machine". I can write this workflow.

## 3. Licences — read before anything ships (1–2 h, you)

§13 says to confirm these rather than assume them. For each one, decide yes or
no and note it in `pipeline/sources.mjs` (set `confirmed: true`).

| Source | Read | The question |
|---|---|---|
| EU Reg. 1333/2008 | https://eur-lex.europa.eu/content/legal-notice/legal-notice.html | Reuse needs "the source is acknowledged". Plan an **attribution line in the app** (settings/about): "Contains EU legal text © European Union, https://eur-lex.europa.eu" |
| EFSA OpenFoodTox | https://zenodo.org/records/19388272 (CC BY-ND 4.0) | We show EFSA's ADI numbers with a DOI citation to the opinion. Is quoting a figure from an ND-licensed database a "derivative"? If unsure, ask the lawyer in step 6 |
| Hong Kong | https://data.gov.hk/en/terms-and-conditions | Commercial reuse with attribution: add HK to the same attribution line |
| Codex (step 4) | https://www.fao.org/contact-us/terms/en/ | FAO often uses CC BY-NC-SA. **NC (non-commercial) is a problem for a paid app.** Answer this before step 4 |
| FDA / eCFR | — | US government works, public domain. Nothing to do |

## 4. Codex INS list (you download it, I parse it)

FAO blocks automated downloads with a bot challenge, and the pipeline won't go
around it.

1. In a normal browser, open the Codex guidelines list
   (https://www.fao.org/fao-who-codexalimentarius/codex-texts/guidelines/en/),
   find **CXG 36-1989, Class Names and the International Numbering System for
   Food Additives**, and download the English PDF.
2. Save it as `pipeline/sources/manual/codex/CXG_036e.pdf`. That folder is
   git-ignored until the licence in step 3 is confirmed.
3. Tell me it's there. I'll write the parser against the real file, rebuild,
   and Codex entries will attach to rows by INS number the way HK's do.

## 5. Anthropic credit — unblocks three things

1. Add credit at https://console.anthropic.com → **Plans & Billing**.
2. Make sure the Edge Functions have the key. It was set in Phase 1, so check
   in **Dashboard → Edge Functions → Secrets** that `ANTHROPIC_API_KEY` is
   there. If not:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
3. This unblocks:
   - **Phase 1's two unverified claims:** `node scripts/live-guardrail-check.mjs`
     (~$0.10) checks the chat model obeys its rules. Then photograph a few real
     labels to check OCR transcribes faithfully.
   - **The grounded extraction pass (§13)**, which I'd build next. It extracts
     numeric use limits from the CFR text ("not to exceed 0.1 percent") and
     writes better explanations for the ~4,400 bulk rows. Each value must quote
     its source paragraph verbatim, and `verify.ts` rejects any that don't. To
     run it locally the pipeline needs the key in your shell only
     (`export ANTHROPIC_API_KEY=…`), never in a file.

## 6. Human review before launch (§15)

**Food scientist or regulatory-affairs consultant.** Budget a few hours of their
time.

1. Send them `pipeline/out/review-sample.csv`: 821 claims about 355 ingredients.
   Each line has the claim as the app shows it, next to the source text it came
   from.
2. They fill in the `reviewer_check` column (ok / wrong / unclear) and
   `reviewer_notes`.
3. Also send `pipeline/out/build-report.json` → `seed_dosage_check`: 13 seed
   dosage figures that differ from EFSA's. Some differ legitimately (JECFA and
   FDA set their own), and the reviewer should confirm which.
4. Send the completed sheet back to me. I'll apply the corrections to the seed
   and pipeline, rebuild, and record the reviewed rows. (`last_full_review_at`
   is currently null everywhere. Nothing has had a full human review yet, and
   the data says so.)

**Lawyer (§15, a scoped few-hour engagement).** Ask specifically about:
- the **88 allergen flags derived from names** ("whey protein" → milk). They're
  listed in the review sheet, stratum B. Should name-derived flags ship?
- the "informational, not health advice" framing
- the new data collection in step 7
- the licence questions from step 3 you couldn't settle yourself

## 7. Privacy policy (you, with the lawyer)

Phase 2 added two kinds of collection. Neither stores a user or install id, but
both must be disclosed:
- **Unmatched ingredients:** the printed name of any ingredient the database
  doesn't recognise, plus the product barcode (`unmatched_ingredient_log`).
- **Usage events:** scan outcomes, which ingredient cards are opened, that a
  chat question was asked (never its text), and onboarding timing
  (`app_events`).

## 8. Use what the app now collects (monthly, 15 min)

After real scans come in, run these in **SQL Editor**:
```sql
select * from unmatched_ingredient_backlog limit 50;  -- what the database still misses, most-seen first
select * from dosage_research_queue limit 50;          -- most-opened ingredients; those without dosage data first
select * from scan_funnel;                             -- where scans fail, by week
```
The first query is the curation backlog (§12.B). The second is where dosage
research should go next (§12.B2): look up the EFSA/JECFA assessment for the top
rows with `has_dosage_context = false`, and add them to
`rakk-app/src/data/seed/dosage.ts`.

## 9. Monthly data refresh (§12.D, 20 min, or schedule it)

```bash
cd pipeline && node fetch.mjs
cd ../rakk-app && npx tsx ../pipeline/build.ts && npx tsx ../pipeline/verify.ts && npx tsx ../pipeline/emit.ts
node scripts/test-catalog-lookup.mjs
cd ../pipeline && node diff.mjs && node review-sample.mjs
```
Then read `pipeline/out/change-review.md`. It lists every row whose regulatory
status changed, which is your manual check, plus this month's slice of the
annual review. Commit and push, and the new release deploys. The app refreshes
its cached rows on next launch. I can set this up as a scheduled monthly task.

## 10. Smaller things

- **Expo patch updates:** `cd rakk-app && npx expo install --check`, accept,
  then rerun the checks. Four patch releases have shipped since Phase 1.
- **Abuse limits:** the unmatched log and event recording accept anonymous
  writes (validated, capped per call, unreadable from the app). Watch the
  table sizes in **Database → Tables**, and add rate limiting if they jump.
- **Twelve flaggable ingredients have no regulatory entry** (palm oil, soybean
  oil, syrups, some protein isolates). They are foods rather than regulated
  additives. Decide whether they belong on the everyday allow-list or need a
  different kind of entry (handoff §3.4). The list is in
  `pipeline/out/build-report.json` → `no_jurisdiction`.
