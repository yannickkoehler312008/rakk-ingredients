/**
 * Matcher invariants (§3, §5, §12.C).
 *
 * These protect behaviour that is easy to break without noticing, and that
 * Phase 2 will touch when matching moves server-side (§7).
 *
 * Run: node scripts/test-matcher.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const DRIVER = '.matcher-driver.ts';

const LABELS = {
  nutella:
    'sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin',
  cheerios:
    'Whole Grain Oats, Corn Starch, Sugar, Salt, Tripotassium Phosphate, Vitamin E (mixed tocopherols), Calcium Carbonate, Iron, Zinc, Vitamin C (sodium ascorbate), A B Vitamin (niacinamide), Vitamin B6 (pyridoxine hydrochloride), Vitamin A (palmitate), Vitamin B1 (thiamin mononitrate), A B Vitamin (folic acid), Vitamin B12, Vitamin D3',
  boilerplate:
    'Water, sugar, CONTAINS 2% OR LESS OF: citric acid, sodium benzoate (preservative), calcium phosphate (mono-, di-, and tribasic), Red 40.',
  aliases: 'Vitamin C, ascorbic acid, sodium ascorbate, E300.',
  unicode: 'Water, sugar — citric acid, natural flavour.',
  empty: '',
};

writeFileSync(
  DRIVER,
  `
import { matchLabel } from './src/services/matcher';
import { SEED_INGREDIENTS } from './src/data/seed';
const labels = ${JSON.stringify(LABELS)};
const out = {};
for (const [name, raw] of Object.entries(labels)) {
  const m = matchLabel(raw, SEED_INGREDIENTS);
  out[name] = {
    raw,
    rebuilt: m.runs.map((r) => r.text).join(''),
    ingredient_count: m.ingredient_count,
    flagged_count: m.flagged_count,
    flagged: m.runs.filter((r) => r.flagged).map((r) => r.text),
    quiet: m.runs.filter((r) => r.ingredient_id && !r.flagged).map((r) => r.text),
    unmatched: m.unmatched_names,
    matchedIds: m.ingredients.map((i) => i.id),
  };
}
console.log('M' + JSON.stringify(out));
`,
);
const raw = execSync(`npx tsx ${DRIVER}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
rmSync(DRIVER, { force: true });
const r = JSON.parse(raw.split('\n').find((l) => l.startsWith('M')).slice(1));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  — ${detail}`}`);
  if (!ok) failed++;
};

console.log('── §5: runs must reconstruct the printed text exactly');
console.log('   (this is what lets the Label screen render real running text');
console.log('    rather than rebuilding a list from matched names)\n');
for (const [name, v] of Object.entries(r)) {
  check(`round-trip: ${name}`, v.rebuilt === v.raw, `rebuilt ${JSON.stringify(v.rebuilt).slice(0, 70)}`);
}

console.log('\n── §3: flagged = matched AND NOT on the everyday allow-list');
check(
  'everyday ingredients stay quiet',
  r.nutella.quiet.includes('sugar') && r.nutella.quiet.includes('hazelnuts'),
  `quiet was ${JSON.stringify(r.nutella.quiet)}`,
);
check(
  'additives are flagged',
  r.nutella.flagged.includes('palm oil') && r.nutella.flagged.includes('vanillin'),
  `flagged was ${JSON.stringify(r.nutella.flagged)}`,
);
check(
  'familiar nutrient names are quiet, chemical forms are flagged',
  r.cheerios.quiet.includes('Vitamin C') && r.cheerios.flagged.includes('sodium ascorbate'),
  `quiet=${JSON.stringify(r.cheerios.quiet)} flagged=${JSON.stringify(r.cheerios.flagged)}`,
);

console.log('\n── §12.C: aliases resolve to one record');
check(
  '"Vitamin C" is not the same record as "ascorbic acid"',
  r.aliases.matchedIds.includes('ing_name_vitamin_c') && r.aliases.matchedIds.includes('ing_ascorbic_acid'),
  JSON.stringify(r.aliases.matchedIds),
);
check(
  '"E300" resolves to ascorbic acid, not a separate entry',
  r.aliases.matchedIds.filter((i) => i === 'ing_ascorbic_acid').length === 1,
  JSON.stringify(r.aliases.matchedIds),
);

console.log('\n── counts follow PRINTED entries, not matched records');
check(
  'Cheerios counts 17 printed ingredients, not 22 matched records',
  r.cheerios.ingredient_count === 17,
  `got ${r.cheerios.ingredient_count}`,
);
check('Nutella counts 7', r.nutella.ingredient_count === 7, `got ${r.nutella.ingredient_count}`);

console.log('\n── parsing (§12.C, "the fiddly part")');
check(
  'label boilerplate is not reported as an ingredient',
  !r.boilerplate.unmatched.some((n) => /contains|2%/i.test(n)),
  JSON.stringify(r.boilerplate.unmatched),
);
check(
  'commas inside brackets do not split one ingredient into three',
  r.boilerplate.flagged.includes('calcium phosphate'),
  JSON.stringify(r.boilerplate.flagged),
);
check('an empty label does not throw', r.empty.ingredient_count === 0);

console.log(`\n${failed === 0 ? 'PASS' : `FAIL — ${failed} broken`}`);
process.exit(failed ? 1 : 0);
