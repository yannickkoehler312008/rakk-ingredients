/**
 * Do the committed database files agree with each other?
 *
 * Run: node pipeline/check-release.mjs   (CI runs it on every push)
 *
 * What ships is generated: out/ingredients.json → emit.ts → the newest
 * release migration + rakk-app/src/data/catalog/bundled.json. If someone
 * edits one by hand, or commits a build without emitting it, they disagree
 * silently — the app would bundle one dataset while Supabase serves another.
 * This fails the build instead. It needs no downloads, so it is cheap.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '..');
const problems = [];

const raw = readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8');
const rows = JSON.parse(raw);
const hash = createHash('sha256').update(raw).digest('hex').slice(0, 8);

const releases = readdirSync(join(REPO, 'supabase/migrations')).filter((f) => f.includes('_ingredient_release_')).sort();
const latest = releases.at(-1);
if (!latest?.endsWith(`_${hash}.sql`)) {
  problems.push(`newest release migration is ${latest ?? 'missing'}, but out/ingredients.json hashes to ${hash} — run pipeline/emit.ts`);
} else {
  const sql = readFileSync(join(REPO, 'supabase/migrations', latest), 'utf8');
  const n = Number(sql.match(/rows (\d+) ·/)?.[1]);
  if (n !== rows.length) problems.push(`${latest} says ${n} rows; out/ingredients.json has ${rows.length}`);
}

const bundled = JSON.parse(readFileSync(join(REPO, 'rakk-app/src/data/catalog/bundled.json'), 'utf8'));
if (!String(bundled.version).endsWith(`.${hash}`)) problems.push(`bundled.json is version ${bundled.version}, not this build (${hash})`);
const byId = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
const drift = bundled.rows.filter((r) => byId.get(r.id) !== JSON.stringify(r)).length;
if (drift) problems.push(`${drift} bundled rows differ from out/ingredients.json`);

const verify = JSON.parse(readFileSync(join(ROOT, 'out/verify-report.json'), 'utf8'));
if (verify.failures.length) problems.push(`verify-report.json records ${verify.failures.length} failures`);
if (verify.rows !== rows.length) problems.push(`verify-report.json checked ${verify.rows} rows; the build has ${rows.length}`);

if (problems.length) {
  console.error('Release files disagree:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`release ${bundled.version}: ${rows.length} rows — migration ${latest}, bundle and verification agree`);
