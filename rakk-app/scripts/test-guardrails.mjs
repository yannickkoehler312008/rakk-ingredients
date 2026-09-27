/**
 * Guardrail tests for the ingredient chat assistant.
 *
 * These run WITHOUT an API key, a Deno install, or a network — the rules that
 * keep this product out of unlicensed-health-claim territory (§1, §9) should be
 * testable on their own. What they cover: the deterministic layers (2 and 3).
 * What they cannot cover: whether the model obeys the system prompt. That needs
 * a real key — see README for how to run the live check once you have one.
 *
 * Run: node scripts/test-guardrails.mjs
 */
import { execSync } from 'node:child_process';

// The guardrails module sits outside the app's tsconfig (it targets Deno), so
// typecheck it here — it is the file the copy rules actually live in.
try {
  execSync(
    'npx tsc --noEmit --strict --target es2022 --module esnext ' +
      '--moduleResolution bundler --skipLibCheck --ignoreConfig ' +
      '../supabase/functions/ingredient-chat/guardrails.ts',
    { stdio: 'pipe' },
  );
  console.log('✓ guardrails.ts typechecks\n');
} catch (e) {
  console.log('✗ guardrails.ts failed to typecheck:\n' + (e.stdout?.toString() ?? e.message));
  process.exit(1);
}

const out = execSync(
  `npx tsx -e "
import { screenReply, classifyQuestion, buildContext } from '../supabase/functions/ingredient-chat/guardrails.ts';
const api = { screenReply, classifyQuestion, buildContext };
globalThis.__run = (name, arg) => api[name](arg);
import('node:fs').then(fs => {
  const cases = JSON.parse(fs.readFileSync('./scripts/fixtures/guardrail-cases.json','utf8'));
  const out = cases.map(c => c.fn === 'screenReply'
    ? { ...c, got: screenReply(c.input) }
    : { ...c, got: classifyQuestion(c.input) });
  console.log('RESULT' + JSON.stringify(out));
});
"`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);

const line = out.split('\n').find((l) => l.startsWith('RESULT'));
const results = JSON.parse(line.slice('RESULT'.length));

let pass = 0;
const failures = [];
for (const r of results) {
  let ok;
  if (r.fn === 'screenReply') ok = r.got.ok === r.expectOk;
  else ok = r.got === r.expect;
  if (ok) pass++;
  else failures.push(r);
}

const groups = {};
for (const r of results) (groups[r.group] ??= []).push(r);
for (const [group, rows] of Object.entries(groups)) {
  const bad = rows.filter((r) =>
    r.fn === 'screenReply' ? r.got.ok !== r.expectOk : r.got !== r.expect,
  );
  console.log(`${bad.length ? '✗' : '✓'} ${group}  (${rows.length - bad.length}/${rows.length})`);
}

if (failures.length) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  ✗ [${f.group}] ${JSON.stringify(f.input).slice(0, 96)}`);
    console.log(`     expected ${f.expectOk ?? f.expect}, got ${JSON.stringify(f.got).slice(0, 90)}`);
  }
}

console.log(`\n${pass}/${results.length} passed`);
process.exit(failures.length ? 1 : 0);
