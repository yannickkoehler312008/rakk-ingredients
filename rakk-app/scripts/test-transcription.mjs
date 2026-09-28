/**
 * Tests for the OCR transcription safeguards (§6, §13).
 *
 * Runs without Deno, an API key or a network. What these cover: the parsing
 * layer that decides whether a model's reply is a usable transcription or a
 * failure. What they cannot cover: whether the model transcribes faithfully —
 * that needs a real photo and a real call.
 *
 * Run: node scripts/test-transcription.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';

const MOD = '../supabase/functions/read-label/transcription.ts';
const CASES_FILE = '.transcription-cases.json';
const DRIVER_FILE = '.transcription-driver.ts';

try {
  execSync(
    'npx tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler ' +
      '--skipLibCheck --ignoreConfig ../supabase/functions/read-label/transcription.ts',
    { stdio: 'pipe' },
  );
  console.log('✓ transcription.ts typechecks\n');
} catch (e) {
  console.log('✗ typecheck failed:\n' + (e.stdout?.toString() ?? e.message));
  process.exit(1);
}

const CASES = [
  // must be accepted as a usable transcription
  ['accept', 'text', 'Carbonated water, cane sugar, citric acid, sodium benzoate, sucralose.'],
  ['accept', 'text', 'WHOLE GRAIN OATS, SUGAR, SALT, TRIPOTASSIUM PHOSPHATE, VITAMIN E (MIXED TOCOPHEROLS)'],
  // a misprint must survive, not be "fixed" — that is the whole point
  ['accept', 'text', 'Water, sugar, sodum benzoate, natural flavour'],
  // a few unreadable characters are fine
  ['accept', 'text', 'Water, sugar, sodium ben[?]oate, citric acid, natural flavour'],

  // must be treated as a failure
  ['reject', 'cannot_read', 'CANNOT_READ: the panel is out of focus'],
  ['reject', 'cannot_read', 'CANNOT_READ'],
  ['reject', 'cannot_read', ''],
  ['reject', 'cannot_read', '   '],
  // conversational replies are not transcriptions
  ['reject', 'cannot_read', "I'm sorry, I can't make out the text in this image."],
  ['reject', 'cannot_read', 'This image shows a box of cereal on a kitchen counter.'],
  ['reject', 'cannot_read', 'The image appears to be too blurry to read.'],
  // too damaged to be worth matching
  ['reject', 'cannot_read', 'Water, [?] [?] [?] [?] [?] [?] [?] sugar, [?] [?]'],
  // a caption, not a panel
  ['reject', 'cannot_read', 'Ingredients'],
  ['reject', 'cannot_read', 'no text'],
];

// Write the driver to a file rather than passing it with -e: escaping a
// multi-line script through the shell mangles it.
const driver = `
import { parseTranscription } from '${MOD}';
import { readFileSync } from 'node:fs';
const cases = JSON.parse(readFileSync('${CASES_FILE}', 'utf8'));
console.log('R' + JSON.stringify(cases.map(([g, want, input]) => ({
  g, want, input, got: parseTranscription(input),
}))));
`;
writeFileSync(CASES_FILE, JSON.stringify(CASES));
writeFileSync(DRIVER_FILE, driver);
const out = execSync(`npx tsx ${DRIVER_FILE}`, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
rmSync(CASES_FILE, { force: true });
rmSync(DRIVER_FILE, { force: true });
const rows = JSON.parse(out.split('\n').find((l) => l.startsWith('R')).slice(1));

let pass = 0;
const fails = [];
for (const r of rows) {
  if (r.got.kind === r.want) pass++;
  else fails.push(r);
}
for (const r of rows) {
  const ok = r.got.kind === r.want;
  const label = r.g === 'accept' ? 'ACCEPT ' : 'REJECT ';
  console.log(`${ok ? '✓' : '✗'} ${label} ${JSON.stringify(r.input).slice(0, 62)}`);
  if (!ok) console.log(`    wanted ${r.want}, got ${r.got.kind}`);
}
console.log(`\n${pass}/${rows.length} passed`);

// The misprint case is the one that matters most — prove it survived verbatim.
const misprint = rows.find((r) => r.input.includes('sodum'));
if (misprint?.got.kind === 'text' && misprint.got.text.includes('sodum')) {
  console.log('✓ a misprint is preserved verbatim, not silently corrected');
} else {
  console.log('✗ misprint was not preserved');
  process.exit(1);
}
process.exit(fails.length ? 1 : 0);
