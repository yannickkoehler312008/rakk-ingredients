/**
 * The cutover's central promise (§7, PHASE-2-HANDOFF §1): the device holds
 * only the bundled subset plus rows the server returns for a label, and the
 * Label screen must come out EXACTLY as if the whole database were on the
 * device.
 *
 * This simulates `lookup_ingredients` from the same data the migration loads
 * (pipeline/out/ingredients.json, names derived by the matcher's own
 * `needlesFor`) and compares, label by label:
 *     matchLabel(label, FULL DATABASE)
 *     matchLabel(label, BUNDLED ∪ lookup(candidatePhrases(label)))
 * on runs (text, ingredient, flag), counts and unmatched names.
 *
 * Labels: real ones, plus a few thousand generated from database names in
 * label-like shapes (case, plurals, E-numbers, parentheses, boilerplate).
 *
 * Run: node scripts/test-catalog-lookup.mjs
 */
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const DRIVER = '.catalog-lookup-driver.ts';
writeFileSync(
  DRIVER,
  `
import { readFileSync } from 'node:fs';
import { matchLabel, candidatePhrases, needlesFor } from './src/services/matcher';
import bundledFile from './src/data/catalog/bundled.json';

const FULL = JSON.parse(readFileSync('../pipeline/out/ingredients.json', 'utf8'));
const BUNDLED = (bundledFile as any).rows;

// The server: needle → row, exactly as the release migration loads it.
const byNeedle = new Map();
for (const r of FULL) for (const n of needlesFor(r)) {
  if (byNeedle.has(n)) throw new Error('needle ' + n + ' is not unique');
  byNeedle.set(n, r);
}
const lookup = (phrases) => {
  const out = new Map();
  for (const p of phrases.slice(0, 3000)) { const r = byNeedle.get(p); if (r) out.set(r.id, r); }
  return [...out.values()];
};

// Bundled rows must be byte-identical to the database's version of the row.
const fullById = new Map(FULL.map((r) => [r.id, r]));
let bundledDrift = 0;
for (const b of BUNDLED) if (JSON.stringify(b) !== JSON.stringify(fullById.get(b.id))) bundledDrift++;

// Deterministic PRNG, so a failure reproduces.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const REAL = [
  'sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin',
  'Whole Grain Oats, Corn Starch, Sugar, Salt, Tripotassium Phosphate, Vitamin E (mixed tocopherols), Calcium Carbonate, Iron, Zinc, Vitamin C (sodium ascorbate), A B Vitamin (niacinamide), Vitamin B6 (pyridoxine hydrochloride), Vitamin A (palmitate), Vitamin B1 (thiamin mononitrate), A B Vitamin (folic acid), Vitamin B12, Vitamin D3',
  'Water, sugar, CONTAINS 2% OR LESS OF: citric acid, sodium benzoate (preservative), calcium phosphate (mono-, di-, and tribasic), Red 40.',
  "Corn, Vegetable Oil (Corn, Canola, and/or Sunflower Oil), Maltodextrin (Made from Corn), Salt, Cheddar Cheese (Milk, Cheese Cultures, Salt, Enzymes), Whey, Monosodium Glutamate, Buttermilk, Whey Protein Concentrate, Onion Powder, Natural and Artificial Flavor, Dextrose, Lactose, Spices, Artificial Color (Yellow 6, Yellow 5, and Red 40), Lactic Acid, Citric Acid, Disodium Inosinate, Disodium Guanylate",
  'Sorbitol, gum base, glycerol, natural and artificial flavours, mannitol, xylitol, aspartame, acesulfame K, soy lecithin, BHT, colour (E171, E133), carnauba wax',
  'Wheat flour, palm oil, sugar, salt, flavour enhancers (E621, E635), acidity regulator (E501), colour (E150d), antioxidant (E319), INS 211',
  '',
];

const names = FULL.flatMap((r) => [r.canonical_name, ...r.aka]).filter((n) => n.length < 50);
const shape = (n) => {
  const k = rnd();
  if (k < 0.15) return n.toUpperCase();
  if (k < 0.25) return n + 's';
  if (k < 0.35) return 'contains 2% or less of: ' + n;
  if (k < 0.45) return n + ' (' + pick(names) + ')';
  if (k < 0.5) return n.replace(/ /g, '  ');
  return n;
};
const GENERATED = Array.from({ length: 3000 }, () =>
  Array.from({ length: 3 + Math.floor(rnd() * 20) }, () => shape(pick(names))).join(pick([', ', '; ', ', ', '. '])),
);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const view = (m) => ({
  runs: m.runs.map((r) => [r.text, r.ingredient_id, r.flagged, r.unmatched]),
  counts: [m.ingredient_count, m.flagged_count],
  unmatched: m.unmatched_names,
});

let checked = 0, mismatched = 0, maxPhrases = 0, maxRows = 0;
const examples = [];
for (const label of [...REAL, ...GENERATED]) {
  const phrases = candidatePhrases(label);
  maxPhrases = Math.max(maxPhrases, phrases.length);
  const fetched = lookup(phrases);
  maxRows = Math.max(maxRows, fetched.length);
  const merged = new Map(BUNDLED.map((r) => [r.id, r]));
  for (const r of fetched) merged.set(r.id, r);
  const a = view(matchLabel(label, FULL));
  const b = view(matchLabel(label, [...merged.values()]));
  checked++;
  if (!same(a, b)) { mismatched++; if (examples.length < 3) examples.push({ label: label.slice(0, 200), full: a.runs.filter((r) => r[1]).slice(0, 6), subset: b.runs.filter((r) => r[1]).slice(0, 6) }); }
}
console.log('R' + JSON.stringify({ checked, mismatched, examples, bundled: BUNDLED.length, bundledDrift, full: FULL.length, maxPhrases, maxRows }));
`,
);

let r;
try {
  const raw = execSync(`npx tsx ${DRIVER}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
  r = JSON.parse(raw.split('\n').find((l) => l.startsWith('R')).slice(1));
} finally {
  rmSync(DRIVER, { force: true });
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  — ${detail}`}`);
  if (!ok) failed++;
};

console.log(`── §7 cutover: subset + lookup ≡ full database  (${r.full} rows, ${r.bundled} bundled)`);
check(`${r.checked} labels match identically with lookup as with the full database`, r.mismatched === 0, `${r.mismatched} differ: ${JSON.stringify(r.examples, null, 1)}`);
check('every bundled row is identical to the database row', r.bundledDrift === 0, `${r.bundledDrift} bundled rows differ — re-run pipeline emit`);
check(`largest label needs ${r.maxPhrases} phrases, within one 2500-phrase call`, r.maxPhrases <= 2500, 'the client chunks, but check the label');
console.log(`   (largest lookup returned ${r.maxRows} rows)`);

console.log(failed ? `\nFAIL (${failed})` : '\nPASS');
process.exit(failed ? 1 : 0);
