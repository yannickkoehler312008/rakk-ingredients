/**
 * Verify every US CFR citation in the seed dataset against eCFR.
 *
 * §9 makes citation accuracy the entire trust proposition, and the seed data
 * was written by hand. This checks two things per citation:
 *   1. the section exists in 21 CFR at all
 *   2. the section LISTS the substance — as its subject, in its identity
 *      paragraph, or as one entry of a list section
 *
 * Phase 2 tightened (2): the first version accepted a name whose words
 * appeared anywhere in the section, which passed three wrong citations —
 * § 184.1434 is magnesium phosphate (it merely mentions potassium), and
 * § 182.90 lists substances migrating from paper packaging. The rule now
 * lives in pipeline/parse/ecfr.mjs and is shared with the database build.
 *
 * What it CANNOT check: whether the cited section is the most apt one, or
 * whether the status wording is right. Those still need a human.
 *
 * Run: node scripts/verify-citations.mjs [--json]
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { listsSubstance, parseSectionXml } from '../../pipeline/parse/ecfr.mjs';

const UA = 'RakkIngredients/0.1.0 (seed-data verification)';
const CONCURRENCY = 3;
const RETRIES = 3;

const raw = execSync(
  `npx tsx -e "
import { SEED_INGREDIENTS } from './src/data/seed/index';
const rows = [];
for (const i of SEED_INGREDIENTS) {
  for (const j of i.jurisdictions) {
    if (j.jurisdiction === 'US_FDA' && j.citation && j.citation.startsWith('21 CFR ')) {
      rows.push({ id: i.id, name: i.canonical_name, aka: i.aka, section: j.citation.replace('21 CFR ', '') });
    }
  }
}
console.log(JSON.stringify(rows));
"`,
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);

const rows = JSON.parse(raw.trim().split('\n').filter((l) => l.startsWith('[')).pop());
console.log(`Verifying ${rows.length} US CFR citations against eCFR…\n`);

async function fetchSection(section) {
  const part = section.split('.')[0];
  const url = `https://www.ecfr.gov/api/versioner/v1/full/2026-09-25/title-21.xml?part=${part}&section=${section}`;
  let last = 'no attempt';
  // eCFR throttles under concurrency; a single failed read is not evidence
  // that a section is missing, so retry with backoff before concluding.
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'application/xml', 'Accept-Encoding': 'gzip' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 404) return { ok: false, fatal: true, detail: 'HTTP 404' };
      if (!res.ok) { last = `HTTP ${res.status}`; }
      else {
        const body = await res.text();
        if (body.trim().length > 200) return { ok: true, section: parseSectionXml(body) };
        last = 'short body';
      }
    } catch (e) {
      last = e.message?.slice(0, 50) ?? 'fetch failed';
    }
    await new Promise((r) => setTimeout(r, 600 * attempt));
  }
  return { ok: false, fatal: false, detail: last };
}

async function check(row) {
  const res = await fetchSection(row.section);
  if (!res.ok) {
    return res.fatal
      ? { ...row, status: 'SECTION_MISSING', detail: res.detail }
      : { ...row, status: 'ERROR', detail: res.detail };
  }
  const v = listsSubstance(res.section, [row.name, ...(row.aka ?? [])]);
  if (v.ok) return { ...row, status: 'OK', detail: `${v.reason}: "${v.matched}"` };
  if (/does not exist|Reserved/.test(v.reason)) return { ...row, status: 'SECTION_MISSING', detail: v.reason };
  return { ...row, status: 'NAME_NOT_FOUND', detail: v.reason };
}

const results = [];
for (let i = 0; i < rows.length; i += CONCURRENCY) {
  const batch = rows.slice(i, i + CONCURRENCY);
  results.push(...(await Promise.all(batch.map(check))));
  process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`);
  await new Promise((r) => setTimeout(r, 120));
}
process.stdout.write('\r' + ' '.repeat(30) + '\r');

const by = (s) => results.filter((r) => r.status === s);
const ok = by('OK'), missing = by('SECTION_MISSING'), unnamed = by('NAME_NOT_FOUND'), errored = by('ERROR');

for (const r of [...missing, ...unnamed]) {
  console.log(`  ✗ ${r.status.padEnd(15)} 21 CFR ${r.section.padEnd(10)} ${r.name}`);
}
for (const r of errored) console.log(`  ? ERROR           21 CFR ${r.section.padEnd(10)} ${r.name} — ${r.detail}`);

const checked = results.length - errored.length;
console.log(`\n  verified   ${ok.length}/${checked}  (${((ok.length / checked) * 100).toFixed(1)}%)`);
console.log(`  bad section ${missing.length}`);
console.log(`  substance not named in section ${unnamed.length}`);
if (errored.length) console.log(`  could not check ${errored.length}`);

if (process.argv.includes('--json')) {
  writeFileSync('citation-report.json', JSON.stringify(results, null, 2));
  console.log('\n  wrote citation-report.json');
}
process.exit(missing.length + unnamed.length > 0 ? 1 : 0);
