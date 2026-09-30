/**
 * Keeping it current — §12.D.
 *
 * "Pair a lightweight automated re-scrape (diff the FDA/Codex/GRAS sources
 * against your stored jurisdictions and flag any row where the source has
 * changed) with a manual verification pass limited to whatever the diff
 * actually flags, plus a rolling last_full_review_at sweep so every row gets a
 * genuine human look at least once a year."
 *
 * Run after fetch + build + verify:   node diff.mjs [previous-ingredients.json]
 *
 * Compares the new build with the last COMMITTED one (git HEAD's
 * pipeline/out/ingredients.json by default) and writes out/change-review.md:
 *   - which source documents changed (sha256 against the committed manifest)
 *   - rows added and removed
 *   - rows whose regulatory status or citation changed — the manual pass
 *   - this month's slice of the annual full-review sweep
 * There is no webhook from any regulator (§12.D); this is the discipline that
 * stands in for one. Schedule it monthly.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });

const current = JSON.parse(readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8'));
let previous = [];
let previousLabel;
if (process.argv[2]) {
  previous = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  previousLabel = process.argv[2];
} else {
  try {
    previous = JSON.parse(git('show', 'HEAD:pipeline/out/ingredients.json'));
    previousLabel = `git HEAD (${git('rev-parse', '--short', 'HEAD').trim()})`;
  } catch {
    previousLabel = 'none — first release';
  }
}

// ─── sources ───
const manifest = JSON.parse(readFileSync(join(ROOT, 'sources/manifest.json'), 'utf8'));
let oldManifest = {};
try { oldManifest = JSON.parse(git('show', 'HEAD:pipeline/sources/manifest.json')); } catch {}
const sourceChanges = Object.keys(manifest)
  .filter((k) => manifest[k].sha256 && manifest[k].sha256 !== oldManifest[k]?.sha256)
  .map((k) => `${k}${oldManifest[k] ? '' : ' (new)'} — ${manifest[k].source_last_updated ?? manifest[k].ecfr_date ?? manifest[k].celex ?? manifest[k].fetched_at}`);

// ─── rows ───
const prevById = new Map(previous.map((r) => [r.id, r]));
const curById = new Map(current.map((r) => [r.id, r]));
const added = current.filter((r) => !prevById.has(r.id));
const removed = previous.filter((r) => !curById.has(r.id));

const jur = (r) => Object.fromEntries(r.jurisdictions.map((j) => [j.jurisdiction, `${j.status} [${j.citation ?? '—'}]`]));
const statusChanges = [];
const otherChanges = [];
for (const r of current) {
  const p = prevById.get(r.id);
  if (!p) continue;
  const a = jur(p), b = jur(r);
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[k] !== b[k]) statusChanges.push({ id: r.id, name: r.canonical_name, jurisdiction: k, was: a[k] ?? '(none)', now: b[k] ?? '(none)' });
  }
  for (const f of ['canonical_name', 'plain_explanation', 'usage_context', 'allergen_flags', 'everyday_allowlist', 'e_number_ins_code', 'cas_number']) {
    if (JSON.stringify(p[f]) !== JSON.stringify(r[f])) otherChanges.push({ id: r.id, name: r.canonical_name, field: f });
  }
}

// ─── annual sweep: oldest-reviewed first, one twelfth per month ───
const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
const due = current
  .filter((r) => !r.last_full_review_at || r.last_full_review_at < yearAgo)
  .sort((a, b) => (a.last_full_review_at ?? '').localeCompare(b.last_full_review_at ?? '') || a.id.localeCompare(b.id));
const monthly = Math.ceil(current.length / 12);
// Rows with a dosage claim or an allergen flag go first: §15 names them as
// the claims that most need a human.
const weight = (r) => (r.usage_context ? 0 : r.allergen_flags.length ? 1 : 2);
const slice = [...due].sort((a, b) => weight(a) - weight(b)).slice(0, monthly);

const lines = [
  `# Ingredient database — change review`,
  ``,
  `Compared with: ${previousLabel}  ·  generated ${new Date().toISOString().slice(0, 10)}`,
  ``,
  `## Source documents that changed (${sourceChanges.length})`,
  ...(sourceChanges.length ? sourceChanges.map((s) => `- ${s}`) : ['- none']),
  ``,
  `## Rows added (${added.length}) / removed (${removed.length})`,
  ...added.slice(0, 200).map((r) => `- + ${r.canonical_name} (\`${r.id}\`)`),
  ...(added.length > 200 ? [`- … ${added.length - 200} more`] : []),
  ...removed.map((r) => `- − ${r.canonical_name} (\`${r.id}\`) — check why it left the sources`),
  ``,
  `## Regulatory status changes — verify each by hand (${statusChanges.length})`,
  ``,
  `§12.D: the manual pass is limited to exactly this list. Check the citation, then`,
  `set \`last_full_review_at\` only if the whole row was reviewed.`,
  ``,
  ...statusChanges.map((c) => `- **${c.name}** (\`${c.id}\`) ${c.jurisdiction}\n  - was: ${c.was}\n  - now: ${c.now}`),
  ``,
  `## Other field changes (${otherChanges.length})`,
  ...otherChanges.slice(0, 300).map((c) => `- ${c.name}: ${c.field}`),
  ``,
  `## Annual full-review sweep`,
  ``,
  `${due.length} of ${current.length} rows have not had a full review in the last year.`,
  `This month's slice (${slice.length}, dosage and allergen claims first):`,
  ``,
  ...slice.map((r) => `- [ ] ${r.canonical_name} (\`${r.id}\`)${r.usage_context ? ' — dosage' : ''}${r.allergen_flags.length ? ' — allergen' : ''}`),
];
writeFileSync(join(ROOT, 'out/change-review.md'), lines.join('\n') + '\n');
console.log(`sources changed ${sourceChanges.length} · added ${added.length} · removed ${removed.length} · status changes ${statusChanges.length} · other ${otherChanges.length} · due for full review ${due.length}`);
console.log('wrote out/change-review.md');
