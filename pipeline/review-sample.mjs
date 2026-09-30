/**
 * The food-science sample review — §15 and §12.C step 3.
 *
 * "A representative sample (weighted toward highest-scan-frequency
 * ingredients and everything with a populated usage_context value) is a real
 * confidence check on the whole pipeline's error rate."
 *
 * Run: node review-sample.mjs     → out/review-sample.csv
 *
 * One line per CLAIM the app will show, with the source text it rests on, so
 * the reviewer checks claim against source and never has to hunt for either.
 *
 * Strata:
 *   A  every dosage claim (usage_context) — §15 names these explicitly
 *   B  every allergen flag derived from a name — §15's sharpest liability
 *   C  the curated common set (the seed), as the scan-frequency proxy until
 *      §14's analytics exist — a random 60
 *   D  a random 120 across the bulk rows, spread over every source kind, so
 *      the error rate measured is the pipeline's, not the seed's
 * Deterministic (seeded), so a re-run gives the reviewer the same sheet.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const rows = JSON.parse(readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8'));
const prov = JSON.parse(readFileSync(join(ROOT, 'out/provenance.json'), 'utf8'));

let seed = 20260929;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sample = (arr, n) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};

const kind = (r) => prov[r.id]?.kind;
const A = rows.filter((r) => r.usage_context);
const B = rows.filter((r) => kind(r) !== 'seed' && r.allergen_flags.length);
const C = sample(rows.filter((r) => kind(r) === 'seed' && !r.everyday_allowlist), 60);
const bulk = rows.filter((r) => kind(r) !== 'seed');
const kinds = [...new Set(bulk.map(kind))];
const D = kinds.flatMap((k) => sample(bulk.filter((r) => kind(r) === k), Math.max(8, Math.round(120 * bulk.filter((r) => kind(r) === k).length / bulk.length))));

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\s+/g, ' ').trim()}"`;
const out = [['stratum', 'ingredient_id', 'name', 'claim', 'value_shown_in_app', 'citation', 'citation_url', 'source_text', 'method', 'reviewer_check (ok / wrong / unclear)', 'reviewer_notes']];

const excerpt = (id, field) => prov[id]?.fields.find((f) => f.field === field);
const push = (stratum, r, claim, value, citation, url, field) => {
  const p = excerpt(r.id, field);
  out.push([stratum, r.id, r.canonical_name, claim, value, citation ?? '', url ?? '', p?.excerpt?.slice(0, 1500) ?? '', p ? `${p.method}: ${p.source} ${p.locator}` : '', '', '']);
};

const claims = (stratum, r, only) => {
  if (!only || only === 'explanation') push(stratum, r, 'what it is / why used', r.plain_explanation, null, null, 'plain_explanation');
  if (!only || only === 'jurisdictions') for (const j of r.jurisdictions) push(stratum, r, `status ${j.jurisdiction}`, j.status, j.citation, j.citation_url, `jurisdictions.${j.jurisdiction}`);
  if ((!only || only === 'dosage') && r.usage_context) {
    push(stratum, r, 'threshold of concern', r.usage_context.threshold_of_concern ?? '(none established)', (r.risk_assessment_refs ?? []).join(' ; '), null, 'usage_context.threshold_of_concern');
    push(stratum, r, 'typical use', r.usage_context.typical_concentration_range, null, null, 'usage_context');
  }
  if ((!only || only === 'allergen') && r.allergen_flags.length) push(stratum, r, 'allergen: derived from', r.allergen_flags.join(', '), null, null, 'allergen_flags');
};

for (const r of A) claims('A dosage', r, 'dosage');
for (const r of B) claims('B allergen', r, 'allergen');
for (const r of C) claims('C common', r);
for (const r of D) claims(`D ${kind(r)}`, r);

writeFileSync(join(ROOT, 'out/review-sample.csv'), out.map((l) => l.map(csv).join(',')).join('\n') + '\n');
console.log(`review sample: ${out.length - 1} claims from ${new Set(out.slice(1).map((l) => l[1])).size} ingredients`);
console.log(`  A dosage ${A.length} · B allergen ${B.length} · C common ${C.length} · D bulk ${D.length} (${kinds.join(', ')})`);
console.log('wrote out/review-sample.csv');
