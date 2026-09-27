# Rakk Ingredients — app

React Native (Expo) app for iOS and Android. Built against
`../MD Files/rakk-phase1-app-build.md`. Section references in code comments
(§4, §5, §9…) point at that file.

**Current state: build-order step 5 — the ingredient chat assistant.**

## Run it

```bash
cd rakk-app
npx expo start          # then scan the QR with Expo Go on a phone
```

Web (`npx expo start --web`) exists only as a dev preview for checking layout
on a laptop. The product is native — not a web app, not a PWA (§6). Nothing in
`src/` is written for the browser.

## Checks

```bash
npx tsc --noEmit                   # types
bash scripts/check-copy.sh         # positioning constraints — see below
node scripts/check-seed.mjs        # seed integrity
node scripts/test-guardrails.mjs   # chat assistant guardrails
node scripts/verify-citations.mjs  # every US CFR citation, against eCFR
```

`scripts/check-copy.sh` is the guard for the two non-negotiables:

1. **No score, grade, rating, or verdict** — in UI, data model, or internal
   naming. Not even as a placeholder. (`risk_assessment_refs` is allowed by
   exact name: it is Appendix A's own field, and it holds citation links to
   published assessments, not a rating.)
2. **No adjectives of judgment** in any copy, including placeholder text.
3. **No colour literals outside `src/theme/tokens.ts`** — this is how a
   red/amber/green scale would get in by accident.

It scans `src/`, `scripts/` and `supabase/`, so the chat endpoint's copy is held
to the same rule as the app's. Three files are excluded **by path**, because
their job is to name the banned words: the guard itself, `guardrails.ts`, and
the guardrail test fixtures.

Wire it into CI before the first build that leaves this machine.

## Step 5: the ingredient chat assistant

A bar at the bottom of the Label screen expands into a thread scoped to the
scanned product. §7 routes this one call through a backend endpoint — every
other read goes client-to-Supabase directly — for exactly two reasons: **the
API key stays server-side**, and **per-user rate limiting can be enforced**.

### Guardrails: three layers, not one

§4 requires the assistant to inherit §1/§9's copy discipline exactly, and notes
a chat interface is far easier to lead into "so is this safe for me?" territory
than a static card. A system prompt is a request, not a guarantee, so:

| layer | where | what it does |
|---|---|---|
| 1. system prompt | `guardrails.ts` | states the rules: facts not verdicts, no judgment adjectives, redirect "is it safe", decline personal health advice, never fabricate |
| 2. output filter | `screenReply()` | checks every reply BEFORE the user sees it; a reply that breaks the rule is **withheld**, not shown-and-apologised-for |
| 3. question routing | `classifyQuestion()` | personal-health questions are refused deterministically **without spending a model call** — the model cannot be talked out of it |

```bash
node scripts/test-guardrails.mjs   # 31 adversarial cases, no API key needed
```

The subtlest case that suite covers: a naive ban on "safe" would suppress every
**"Generally Recognized as Safe"** citation — the single most important fact
this app reports. Protected regulatory phrases are redacted before scanning.

**What those tests cannot cover:** whether the model obeys the system prompt.
That needs a real key:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.local   # gitignored; never committed
node scripts/live-guardrail-check.mjs               # ~25 real calls, ~$0.10
```

That script asks the real model 21 adversarial questions — verdict bait,
persona attacks, fabrication bait, and legitimate questions that must still be
answered — and runs every reply through the same `screenReply()` the endpoint
uses. Layers 2 and 3 are deterministic and hold regardless of what the model
does.

### Setting it up

You need a Supabase project. None of this ships a key in the app.

```bash
npm i -g supabase && supabase login
supabase link --project-ref <your-project-ref>
supabase db push                                  # creates the rate-limit table
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # server-side ONLY
supabase functions deploy ingredient-chat
```

Then copy `.env.example` to `.env.local` and fill in your project URL and anon
key. Enable **anonymous sign-ins** in Authentication → Providers: §7 wants a
session per user so usage can be metered, and real Apple/Google auth is §4's
onboarding work, not built yet.

Until that's done the chat shows a designed "not switched on yet" state and the
rest of the app is unaffected.

### Cost (§8)

Model is **`claude-haiku-4-5`**, the cheapest available ($1/MTok in, $5/MTok
out), chosen deliberately: the assistant rephrases facts handed to it rather
than reasoning from scratch, which is what the small model is good at.

Measured prefix (system prompt + product context) is **~860–2100 tokens** on
real scans. A grounded question therefore costs roughly **$0.004** — a few
hundred questions per subscriber per month before the chat costs more than the
$2.50 subscription earns net of store fees. Rate limit is 30/hour/user.

**Three things about Haiku 4.5 specifically**, all documented at the top of
`index.ts` because each fails badly if forgotten:

1. `output_config.effort` **returns a 400** on this model — it is rejected, not
   ignored. There is no effort knob.
2. It uses the older `thinking: {budget_tokens}` shape, not adaptive thinking.
   We omit `thinking` entirely: no thinking, billed at output rates avoided.
3. **Its minimum cacheable prefix is 4096 tokens.** Our prefix is well under
   that, so the `cache_control` marker is a **no-op** — it fails silently with
   `cache_creation_input_tokens: 0` and no error. The marker is kept because it
   is correct code that starts working on a model with a lower minimum (Claude
   Opus 5's is 512). Do not assume caching is saving anything without checking
   that field.

## Step 4: cards, citations and dosage context

Tapping a flagged term opens its card in place. Three variants, all exercised:

| variant | count | what it shows |
|---|---|---|
| dosage block | 74 | threshold of concern, typical use, exposure route, sources |
| citation only | 74 | regulatory status per jurisdiction (§4: never looks broken) |
| no entry yet | 31 | honest "No regulatory entry on file yet" |

§1 calls dosage context "the single most defensible reason a user picks Rakk
over a red/yellow/green scanner", so it lives in its own layer
(`src/data/seed/dosage.ts`) — different source type, different review cadence,
prioritised by scan frequency (§12.B2) rather than alphabetically.

**The threshold and the typical use are labelled and stacked so the reader can
compare them.** The card never draws the comparison itself; that would be a
verdict.

⚠️ **ADI figures are NOT machine-verified.** CFR citations are checked against
eCFR; there is no equivalent for ADIs, because JECFA's database uses opaque
internal ids with no usable search endpoint. Every figure was written by hand
and needs checking against the named assessment before launch. What IS enforced
by `check-seed.mjs` is §11's structural rule: **no dosage claim without a
traceable source.**

## Step 3: matching and flagging

A scan now resolves to matched ingredients with flagged terms underlined in
place, and tapping one opens its card with a regulatory citation.

**§3's flagging rule lives in exactly one line** of `src/services/matcher.ts`:
flagged = matched in the database AND NOT on the everyday allow-list. §3 says
"config this, don't hardcode", so the rule reads `everyday_allowlist` from the
data — no code enumerates ingredients. Move an entry to the allow-list and
behaviour changes with no code edit.

### The seed dataset

270 entries in `src/data/seed/`, 91 of them the everyday allow-list. Hand
written, and **not the database** — Phase 2 replaces it. Every record carries
`source: 'manual_curation'` and `last_full_review_at: null`, Appendix A's own
signal that a row has not been reviewed end-to-end.

```bash
node scripts/check-seed.mjs        # duplicate ids, alias collisions, coverage
node scripts/verify-citations.mjs  # every US CFR citation, against eCFR
```

The allow-list includes familiar nutrient names (Vitamin C, Iron, Zinc). Labels
gloss a chemical with the name everyone knows — "Vitamin C (sodium ascorbate)"
— and flagging both halves underlined almost every word of a fortified cereal
label, which made the underline carry no information. The familiar half is
quiet; the chemical form stays flagged, because that is the half worth
explaining. Cheerios went from 14 flagged of 18 to 9 of 17.

Counts follow **printed entries**, not matched records: "Vitamin C (sodium
ascorbate)" is one ingredient, the way a human reading the package counts.

`verify-citations.mjs` fetches each cited 21 CFR section from eCFR and confirms
it exists and names the substance. **The first run found 9 citations that were
simply wrong** — 21 CFR 184.1318 is Glucono delta-lactone, not gelatin;
184.1763 is Sodium hydroxide, not sodium selenite. Those were removed. All 131
remaining citations verify, and the script is wired to catch regressions.

What it cannot check: whether a cited section is the *most apt* one, or whether
the status wording is right. Those still need a human.

## Step 2: what's live

Scanning a barcode resolves a real product from Open Food Facts and renders its
ingredient list **exactly as printed — no flagging, no cards, no counts.**
Matching is step 3.

The invariant that makes that work without special-casing: **`ResolvedScan.runs
=== []` means "not matched yet"**. The Label screen reads that one fact and
renders plain printed text under "The label, as printed". Step 3 fills `runs`
in and the same screen becomes "The label, translated" with no code change.
Counts are hidden until matching has run, because "0 flagged" before matching
would state something we haven't established.

Every outcome of a lookup is a designed state (§9), reachable and checked:
found · product found but no ingredient list · barcode not in the database ·
offline · lookup failed · camera permission not granted / permanently denied.

**Verified behaviours**
- A scan persists and appears on Home; re-scanning moves it up rather than
  duplicating it.
- §8's promise holds: re-scanning a known barcode completes with **zero**
  network calls, served from the on-device cache.

## Before this ships

- **`CONTACT` in `src/services/openFoodFacts.ts` is a placeholder.** Open Food
  Facts asks API consumers to identify themselves with a reachable address in
  the User-Agent. Replace it.
- Searching by product **name** is not built. §4 asks for it; step 2 ships
  manual **barcode** entry as the fallback, which is the minimum honest out.
- **Open Food Facts is crowd-sourced and its data quality varies.** Product
  names in particular can be junk (`0016000275287` is `product_name: "Cheerios"`
  but `product_name_en: "My Bff"`), and many products have no ingredient list at
  all. `openFoodFacts.ts` picks fields defensively and documents why, but real
  normalisation belongs in the backend ETL (§6), not the client.

## Layout

```
src/
  app/            routes (expo-router; every file is a screen)
    _layout.tsx   stack + font loading
    onboarding    carousel + auth  (§4, Appendix B)
    home          scan CTA + recently scanned  (§4)
    scan          framing guide + fallback  (§4)
    label         THE CORE SCREEN  (§4)
    compare       side-by-side overlap  (§4)
    states        dev-only gallery of §9's states — not a shipping screen
  components/
    AnnotatedLabel.tsx  the signature interaction (§5) — read this one first
    IngredientCard.tsx  expandable explanation card (§4)
    CitationChip.tsx    regulatory citation (§9)
  services/
    openFoodFacts.ts  product lookup; becomes the backend's ETL source (§6)
    scanStore.ts      on-device cache + history (§8)
    matcher.ts        parsing, matching, flagging (§3, §12.C)
    chat.ts           chat client — never sees an LLM key (§7)
    navigation.ts     back that survives a deep link
  theme/          §5's tokens and type scale, replicated exactly
  types/          Appendix A schema + §7's resolved-scan contract
  data/
    seed/         THE SEED DATASET — 270 hand-written entries, replaced by Phase 2
      dosage.ts   dosage/exposure layer, merged onto records (§1, §4, §11)
    mockScans.ts  dev fixtures: invented labels run through the REAL matcher
```

## What is mock, and what is contract

`src/types/` is the real thing: `Ingredient` is Appendix A field-for-field, and
`ResolvedScan` is §7's "one assembled response". Screens read `ResolvedScan` and
nothing else, so swapping mock data for the backend is a data cutover, not a
code change (§10.8).

`src/data/` is throwaway. In particular:

- **`mockIngredients.ts` citations are NOT verified.** They were hand-written to
  give step 1 realistic content. §9 makes citation accuracy the whole trust
  proposition — every value needs re-checking against the primary source. Phase
  2 replaces this file wholesale.
- **`src/services/matcher.ts` runs on the client.** §7 puts fuzzy matching
  server-side in Postgres with `pg_trgm`. It runs here only because there is no
  backend yet, and is confined to one module returning the same `ResolvedScan`
  every screen already reads — so moving it to Postgres is a swap of that file.

## Not built yet (later in §10's build order)

OCR / photo path (6), Compare wired to real product selection (7). Billing is out of this phase entirely — the trial line in onboarding and
on Home is Appendix B's structural countdown, with no paywall attached.

## OS floors (§8)

Minimum **iOS 16.4** and **Android 8.0 (API 26)**, set in `app.json` via
`expo-build-properties`. Target stays current. iOS is 16.4 rather than 16.0
because Expo SDK 57 refuses anything lower.
