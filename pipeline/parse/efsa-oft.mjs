/**
 * EFSA OpenFoodTox — Acceptable Daily Intakes, per CAS number, each traced to
 * the EFSA opinion (by DOI) that set it.
 *
 * This is the real ADI source PHASE-2-HANDOFF §3.3 asked for: the seed's
 * dosage figures were hand-written and never machine-checked.
 *
 * Selection, when a substance has several ADI records (it usually does — feed,
 * pesticide and food-additive opinions all restate one):
 *   1. EFSA's own value over one EFSA merely quotes ("HBGV not from EFSA
 *      committees/panels" — that is SCF's or JECFA's number, restated)
 *   2. a food-additive or flavouring opinion over a feed or pesticide one
 *   3. the most recent evaluation — re-evaluations supersede (sorbates: a
 *      temporary 3 mg/kg bw in 2015, replaced by 11 mg/kg bw in 2019)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsv } from '../lib/text.mjs';

const SHEETS = ['FLEX_SUM.ToxRefValues', 'SUB', 'REF_SUB', 'DOSSIER', 'DOSSIER_DOCS'];

function sheet(book, name, workDir) {
  const out = join(workDir, `oft_${name}.csv`);
  if (!existsSync(out) || statSync(out).mtimeMs < statSync(book).mtimeMs) {
    const py = new URL('../lib/xlsx2csv.py', import.meta.url);
    const csv = execFileSync('python3', [decodeURIComponent(py.pathname), book, name], { maxBuffer: 1 << 30 });
    mkdirSync(workDir, { recursive: true });
    require_write(out, csv);
  }
  const rows = parseCsv(readFileSync(out, 'utf8'));
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// Local helper so the module has no top-level import cycle with fs/promises.
import { writeFileSync } from 'node:fs';
const require_write = (p, b) => writeFileSync(p, b);

const A = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.';
/**
 * Only opinions on a substance AS a food additive or flavouring say anything
 * about eating it in food. A pesticide residue ADI or a feed-additive opinion
 * is a real value but answers a different question, and citing it on a food
 * card would mislead.
 */
const FOOD_DOMAINS = ['food additives', 'flavourings'];

export function parseOpenFoodTox(book, workDir) {
  const [tox, sub, ref, dossier, docs] = SHEETS.map((s) => sheet(book, s, workDir));
  const subBy = new Map(sub.map((s) => [s['Document UUID'], s]));
  const refBy = new Map(ref.map((r) => [r['Document UUID'], r]));
  const dosBy = new Map(dossier.map((d) => [d['Document UUID'], d]));
  const docToDossier = new Map(docs.map((d) => [d['DOCUMENT UUID'], d['DOSSIER UUID']]));

  const byCas = new Map();
  for (const t of tox) {
    // Spreadsheet floats arrive as 7.0000000000000007; keep 12 significant digits.
    const num = (v) => (v ? String(Number(Number(v).toPrecision(12))) : '');
    const lower = num(t[A + 'Adi.lowerValue']);
    const upper = num(t[A + 'Adi.upperValue']);
    const notAllocated = t[A + 'NoAllocated'];
    if (!lower && !upper && !notAllocated) continue;

    const s = subBy.get(t['Parent UUID']);
    const r = s && refBy.get(s['ReferenceSubstance.ReferenceSubstance']);
    const cas = r?.['Inventory.CASNumber'] || r?.['CAS number'];
    if (!cas) continue;
    const d = dosBy.get(docToDossier.get(t['Document UUID'])) ?? {};

    const doi = (d['LiteratureReference.LinkToPersistentIdentifier'] || '').match(/10\.2903\/[^\s,;]+/)?.[0] ?? null;
    const title = (d['LiteratureReference.EFSAOutputTitle'] || '').replace(/^OPENFOODTOX_/, '').trim().replace(/\.+$/, '');
    const date = d['LiteratureReference.DateOfEvaluation'] || null;
    const domain = (d['Domain.FoodDomain'] || '').toLowerCase();
    const remarks = t[A + 'JustificationAndComments'] || '';
    const efsaOwn = !t[A + 'AssessmentBody.Other'] && !t[A + 'AssessmentBody'];

    const rec = {
      cas,
      substance: s['ChemicalName'],
      value: upper && lower && upper !== lower ? `${lower}–${upper}` : (upper || lower || null),
      qualifier: t[A + 'Adi.upperQualifier'] || t[A + 'Adi.lowerQualifier'] || null,
      unit: (t[A + 'Adi.Unit'] || '').replace('Âµ', 'µ') || null,
      not_allocated: notAllocated || null,
      group: /ADI \(group\)/i.test(remarks),
      // Only when THIS opinion makes the value temporary. Remarks also narrate
      // history ("changed the temporary group ADI of 3 … to a new group ADI of
      // 11"), and reading that as temporary would misstate the current value.
      temporary: /(should be considered temporary|(?:established|set|derived|allocated) a (?:new )?temporary|\bnew temporary)/i.test(remarks),
      efsa_own: efsaOwn,
      expert_group: d['Domain.ExpertGroup'] || null,
      domain,
      date,
      title,
      doi,
      remarks: remarks.slice(0, 600),
    };
    if (!byCas.has(cas)) byCas.set(cas, []);
    byCas.get(cas).push(rec);
  }

  const rank = (x) => [
    x.efsa_own ? 1 : 0,
    FOOD_DOMAINS.includes(x.domain) ? 1 : 0,
    x.date ?? '',
    x.doi ? 1 : 0,
  ];
  const cmp = (a, b) => {
    const ra = rank(a), rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? 1 : -1;
    return 0;
  };

  const best = new Map();
  for (const [cas, recs] of byCas) {
    const usable = recs.filter((r) => r.doi && FOOD_DOMAINS.includes(r.domain) && (r.value || r.not_allocated) && /kg bw/.test(r.unit ?? 'kg bw'));
    if (usable.length) best.set(cas, { chosen: usable.sort(cmp)[0], all: recs });
  }
  return best;
}

/** Plain-English threshold sentence, in the seed's established wording. */
export function adiSentence(rec) {
  if (rec.not_allocated && !rec.value) {
    return `EFSA did not set a numerical Acceptable Daily Intake (${rec.not_allocated.toLowerCase()}) (EFSA, ${rec.date?.slice(0, 4)})`;
  }
  const unit = (rec.unit ?? '').replace('mg/kg bw/day', 'mg per kg of body weight per day').replace('µg/kg bw/day', 'µg per kg of body weight per day').replace('mg/kg bw', 'mg per kg of body weight');
  const kind = [rec.temporary ? 'temporary' : null, rec.group ? 'group' : null].filter(Boolean).join(' ');
  const q = { '<=': 'up to ', '<': 'below ', '>=': 'at least ', '>': 'above ' }[rec.qualifier ?? ''] ?? '';
  return `Acceptable Daily Intake set at ${q}${rec.value} ${unit}${kind ? ` (${kind} ADI)` : ''} (EFSA, ${rec.date?.slice(0, 4)})`;
}

export function adiReference(rec) {
  return `EFSA${rec.expert_group ? ` ${rec.expert_group.replace(/^EFSA /, '')} Panel` : ''} (${rec.date?.slice(0, 4)}). ${rec.title}. doi:${rec.doi}`;
}
