# Next steps

Supabase project: `xqsjnopgekmanshqsyxj` (dashboard:
https://supabase.com/dashboard/project/xqsjnopgekmanshqsyxj). Background for
everything here is in `PHASE-2-REPORT.md`.

## Now

### 1. Try the app on your phone

You need the free **Expo Go** app (App Store / Google Play). No account is
needed. Your Mac and phone must be on the same Wi-Fi.

```bash
cd "Rakk Ingredients/rakk-app"
npm install          # only if node_modules is missing
npx expo start
```

A QR code appears in the terminal. **iPhone:** point the Camera app at it and
tap the banner. **Android:** open Expo Go and scan it. The app loads over
Wi-Fi; editing code reloads it live. If the phone can't connect (office or
hotel Wi-Fi often blocks this), use `npx expo start --tunnel` instead.

**What to try:**
- Scan a few packets, including one that lists E-numbers or INS numbers.
- Tap underlined ingredients and read the cards.
- Scan something with canola or sunflower oil: it should now be underlined.
- Type a barcode by hand ("Enter the barcode instead").
- Turn on airplane mode and reopen a product you already scanned; it should
  still work.

Expo Go is for development. The real app is built later with EAS (Phase 3).

### 2. Get a free USDA FoodData Central key (2 min)

The second barcode source is live but uses a shared demo key, which allows
only a few dozen lookups an hour.
1. Sign up at https://fdc.nal.usda.gov/api-key-signup (name and email; the
   key arrives by email).
2. In the Supabase dashboard: **Edge Functions → Secrets → Add new secret**,
   name `FDC_API_KEY`, value: the key.

### 3. One GitHub setting, so the monthly refresh can open its pull request

GitHub → the repository → **Settings → Actions → General → Workflow
permissions** → tick **"Allow GitHub Actions to create and approve pull
requests"** → Save.

### 4. Anthropic credit

https://console.anthropic.com → **Plans & Billing**. This unblocks:
- the extraction step: numeric use limits from the regulations, and proper
  explanations for ~4,500 ingredients that now have generic ones;
- Phase 1's two unverified checks (chat model behaviour, photo reading).

## Automatic from now on

- **Checks on every push** (GitHub → Actions → "Checks"). A red run means
  something broke; fix it before relying on that change.
- **Monthly refresh** on the 1st (GitHub → Actions → "Monthly data refresh").
  If anything changed, it opens a pull request whose description lists every
  ingredient whose regulatory status changed. Read it and merge; merging
  deploys. It can also be run by hand with "Run workflow".

## At the very end

- **Lawyer and food-scientist review:** send them `REVIEW-BRIEF.md`. It lists
  everything each of them needs to check, including the data licences
  (nothing to import; it's a terms check plus a credits screen in the app).
- **Hong Kong shop test:** about 50 barcodes from HK/Asian grocery products, to
  measure Open Food Facts coverage there.
- **Credits screen** in the app, with the text drafted in `REVIEW-BRIEF.md` A4.
- **Privacy policy:** what to disclose is listed in `REVIEW-BRIEF.md` A5.

## Reference

- **Database counts and findings:** `PHASE-2-REPORT.md`
- **How the pipeline works and how to run it:** `pipeline/README.md`
- **Supabase SQL Editor queries, once real users exist:**
  ```sql
  select * from unmatched_ingredient_backlog limit 50;  -- what the database still misses
  select * from dosage_research_queue limit 50;          -- most-opened ingredients, missing dosage data first
  select * from scan_funnel;                             -- where scans fail, by week
  ```
