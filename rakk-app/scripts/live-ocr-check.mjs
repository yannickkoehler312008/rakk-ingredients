/**
 * LIVE photo-reading check, end to end — the deployed `read-label` function.
 *
 * Takes real ingredient-panel photos from Open Food Facts (CC BY-SA), resizes
 * them the way the app does (1600 px), sends them through the deployed
 * function with an anonymous session, and compares each transcription with
 * the ingredient text Open Food Facts has for that product. Reports accuracy
 * (word overlap), measured cost per photo, and which model answered — so two
 * models can be compared by switching the OCR_MODEL secret between runs.
 *
 * The comparison text is crowd-sourced and may describe a different printing
 * of the pack, so accuracy is relative: use it to compare models, not as an
 * absolute score. Read the transcriptions in live-ocr-<model>.json too.
 *
 * Run from rakk-app/ (macOS: uses `sips` to resize):  node scripts/live-ocr-check.mjs
 * Cost: one vision call per photo (8 photos ≈ $0.05 on Haiku 4.5).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const UA = 'RakkIngredients/0.2 (live OCR check)';

// Products with an English ingredient photo on Open Food Facts.
const BARCODES = ['0016000275287', '3017620422003', '5000159461122', '7622210449283', '5449000000996', '0049000028911', '0038000138416', '8000500310427'];
const DIR = '.ocr-samples';
mkdirSync(DIR, { recursive: true });

const signup = await fetch(`${URL_}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }) });
const token = (await signup.json()).access_token;
if (!token) { console.error('Could not start an anonymous session.'); process.exit(1); }

const words = (s) => (s.toLowerCase().normalize('NFKD').match(/[a-z]{3,}/g) ?? []);
const PRICE = { 'claude-haiku-4-5': [1, 5], 'claude-haiku-5-5': [0.1, 0.5] };
let spent = 0, n = 0, model = '?', recallSum = 0, precSum = 0;
const out = [];

for (const code of BARCODES) {
  const p = await (await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,ingredients_text_en,image_ingredients_url,selected_images`, { headers: { 'User-Agent': UA } })).json();
  const truth = p.product?.ingredients_text_en;
  // The full-resolution version of the ingredients photo.
  const url = (p.product?.selected_images?.ingredients?.display?.en ?? p.product?.image_ingredients_url ?? '').replace(/\.\d+\.jpg$/, '.full.jpg');
  if (!truth || !url) { console.log(`- ${code}: no English ingredient photo, skipped`); continue; }
  const raw = `${DIR}/${code}.jpg`, small = `${DIR}/${code}.1600.jpg`;
  if (!existsSync(raw)) writeFileSync(raw, Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer()));
  execFileSync('sips', ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', raw, '--out', small], { stdio: 'ignore' });

  const res = await fetch(`${URL_}/functions/v1/read-label`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: readFileSync(small).toString('base64'), media_type: 'image/jpeg' }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.model) model = body.model;
  if (body.usage) {
    const [pi, po] = PRICE[body.model] ?? [0, 0];
    spent += ((body.usage.input ?? 0) * pi + (body.usage.output ?? 0) * po) / 1e6;
    n++;
  }
  const got = body.raw_ingredient_text ?? '';
  const t = new Set(words(truth)), g = words(got);
  const recall = [...t].filter((w) => g.includes(w)).length / Math.max(1, t.size);
  const precision = g.filter((w) => t.has(w)).length / Math.max(1, g.length);
  if (got) { recallSum += recall; precSum += precision; }
  out.push({ code, product: p.product.product_name, status: res.status, error: body.error, detail: body.detail, recall, precision, transcription: got, open_food_facts: truth });
  console.log(`- ${code} ${String(p.product.product_name).slice(0, 28).padEnd(28)} ${res.status === 200 ? `words found ${(recall * 100).toFixed(0)}% · words correct ${(precision * 100).toFixed(0)}%` : `${res.status} ${body.error ?? ''} ${body.detail ?? ''}`}`);
}
const read = out.filter((o) => o.transcription).length;
console.log('─'.repeat(70));
console.log(`model ${model}: ${read}/${out.length} photos transcribed · avg words found ${((recallSum / Math.max(1, read)) * 100).toFixed(0)}% · avg words correct ${((precSum / Math.max(1, read)) * 100).toFixed(0)}%`);
if (n) console.log(`cost $${spent.toFixed(4)} for ${n} photos = $${(spent / n).toFixed(5)} per photo`);
writeFileSync(`live-ocr-${model}.json`, JSON.stringify(out, null, 1));
