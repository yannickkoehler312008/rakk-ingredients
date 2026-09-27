# Rakk Ingredients — Phase 3: Pre-Launch Review, Compliance & Hosting

> Split from `rakk-ingredients-product-spec.md` (the full product spec) for a phase-scoped hand-off to Claude Code. If anything here references a section number (e.g. §11) that isn't included in this file, it's in one of the sibling phase files or the full spec, kept in this same folder.

This phase gates public release. Phase 1 (app) and Phase 2 (database) can
both be functionally "done" and the app still shouldn't ship without this.

---

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
