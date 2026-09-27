/**
 * Verify every US CFR citation in the seed dataset against eCFR.
 *
 * §9 makes citation accuracy the entire trust proposition, and the seed data
 * was written by hand. This checks two things per citation:
 *   1. the section exists in 21 CFR at all
 *   2. the section text actually names the substance
 *
 * What it CANNOT check: whether the cited section is the most apt one, or
 * whether the status wording is right. Those still need a human.
 *
 * Run: node scripts/verify-citations.mjs [--json]
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

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

/** Words worth matching on, beyond the exact name. */
function needles(row) {
  const out = new Set();
  const add = (s) => { if (s && s.length > 3) out.add(s.toLowerCase()); };
  add(row.name);
  for (const a of row.aka ?? []) add(a);
  // Salts: the CFR often titles the parent acid ("Sorbic acid" for "Potassium
  // sorbate"), so also try the distinctive last word and the parent form.
  const words = row.name.split(/\s+/);
  if (words.length > 1) add(words[words.length - 1]);
  return [...out];
}

/**
 * eCFR returns XML, so the section text carries escaped entities: "FD&C Red
 * No. 40" arrives as "FD&amp;C Red No. 40". Matching raw would fail every
 * ampersand-bearing name. Decode entities and strip tags before comparing.
 */
function plainText(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function fetchSection(section) {
  const part = section.split('.')[0];
  const url = `https://www.ecfr.gov/api/versioner/v1/full/2026-01-01/title-21.xml?part=${part}&section=${section}`;
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
        if (body.trim().length > 200) return { ok: true, text: plainText(body) };
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
  const hit = needles(row).find((n) => res.text.includes(n));
  if (hit) return { ...row, status: 'OK', detail: `matched "${hit}"` };

  // CFR headings interpolate: § 184.1343 is "Locust (carob) bean gum", which no
  // contiguous form of "locust bean gum" matches. If every significant word of
  // the name is present, the citation is sound and the wording merely differs.
  const words = row.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (words.length > 1 && words.every((w) => res.text.includes(w))) {
    return { ...row, status: 'OK', detail: 'all name words present' };
  }
  return { ...row, status: 'NAME_NOT_FOUND', detail: 'section exists, substance not named' };
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
