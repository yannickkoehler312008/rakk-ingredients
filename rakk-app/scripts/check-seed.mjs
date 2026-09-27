/**
 * Seed integrity check. Run: node scripts/check-seed.mjs
 * Fails on duplicate ids or aliases claimed by two ingredients.
 */
import { execSync } from 'node:child_process';

const out = execSync(
  `npx tsx -e "
import { SEED_INGREDIENTS, SEED_PROBLEMS, SEED_COUNT, SEED_ALLOWLIST_COUNT } from './src/data/seed/index';
const cfr = SEED_INGREDIENTS.flatMap(i => i.jurisdictions).filter(j => j.citation && j.citation.startsWith('21 CFR')).length;
const noJur = SEED_INGREDIENTS.filter(i => !i.everyday_allowlist && i.jurisdictions.length === 0).map(i => i.canonical_name);
const uc = SEED_INGREDIENTS.filter(i => i.usage_context);
// §11: 'so no dosage claim is ever asserted without a traceable source'
const unsourced = uc.filter(i => !i.risk_assessment_refs || i.risk_assessment_refs.length === 0).map(i => i.canonical_name);
// Duplicate refs render twice on the card and collide as React keys.
const dupRefs = SEED_INGREDIENTS.filter(i => i.risk_assessment_refs && new Set(i.risk_assessment_refs).size !== i.risk_assessment_refs.length).map(i => i.canonical_name);
// Two entries for one regulator would also collide as keys.
const dupJur = SEED_INGREDIENTS.filter(i => new Set(i.jurisdictions.map(j=>j.jurisdiction)).size !== i.jurisdictions.length).map(i => i.canonical_name);
console.log(JSON.stringify({ count: SEED_COUNT, allowlist: SEED_ALLOWLIST_COUNT, cfrCitations: cfr, problems: SEED_PROBLEMS, flaggableWithoutJurisdiction: noJur, usageContext: uc.length, unsourcedDosage: unsourced, dupRefs, dupJur }));
"`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);

const line = out.trim().split('\n').filter((l) => l.startsWith('{')).pop();
const r = JSON.parse(line);

console.log(`seed entries:        ${r.count}`);
console.log(`  everyday allow-list: ${r.allowlist}`);
console.log(`  flaggable:           ${r.count - r.allowlist}`);
console.log(`21 CFR citations:    ${r.cfrCitations}`);
console.log(`dosage context:      ${r.usageContext}`);

if (r.unsourcedDosage.length) {
  // §11 is explicit: no dosage claim without a traceable source.
  console.log(`\nDOSAGE CLAIMS WITH NO SOURCE (${r.unsourcedDosage.length}):`);
  for (const n of r.unsourcedDosage) console.log(`  ✗ ${n}`);
  process.exitCode = 1;
}

if (r.flaggableWithoutJurisdiction.length) {
  // §9: "never show a flag without a source". A flaggable ingredient with no
  // jurisdiction entry at all renders the honest "no regulatory entry on file
  // yet" chip, so it is a coverage gap to close, not a crash.
  console.log(`\nflaggable with NO jurisdiction entry (${r.flaggableWithoutJurisdiction.length}):`);
  for (const n of r.flaggableWithoutJurisdiction) console.log(`  · ${n}`);
}

for (const n of r.dupRefs) console.log(`  ✗ duplicate risk_assessment_refs: ${n}`);
for (const n of r.dupJur) console.log(`  ✗ duplicate jurisdiction entries: ${n}`);

if (r.problems.length || r.unsourcedDosage.length || r.dupRefs.length || r.dupJur.length) {
  console.log('\nINTEGRITY PROBLEMS:');
  for (const p of r.problems) console.log(`  ✗ ${p.kind}: ${p.detail}`);
  process.exit(1);
}
if (r.dupRefs.length || r.dupJur.length) process.exit(1);
console.log('\nPASS — no duplicate ids or alias collisions.');
