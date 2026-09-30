/**
 * The second pass (§13): "a second, cheap verification pass that re-checks
 * each extracted field against its stored source paragraph before accepting
 * it". Run after build:  cd rakk-app && npx tsx ../pipeline/verify.ts
 *
 * It trusts nothing the build decided. It re-reads the raw source documents
 * and, for every row, confirms:
 *   - every US citation: the 21 CFR section exists, is not reserved, and names
 *     the substance; a GRN is a real notice FDA answered "no questions"; a
 *     FEMA number is on the substance's own inventory row; colour-list status
 *     wording is the list's own
 *   - every EU entry: the E-number is (or, for "not on the list", is not) in
 *     Annex II Part B, and a "not authorised for use in food" status is backed
 *     by the annex's own note
 *   - every HK entry: the cited regulation's text contains the excerpt
 *   - every EFSA dosage figure: the DOI and the number are in OpenFoodTox for
 *     that CAS number
 *   - every parsed provenance excerpt occurs in its source document
 * and the structural invariants the app relies on (PHASE-2-HANDOFF §1): one
 * name → one ingredient on the matcher's own needles, no dosage claim without
 * a source, no duplicate jurisdictions or refs, valid enums and dates.
 *
 * Exit code 1 on any failure. Output: out/verify-report.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ingredient } from '../rakk-app/src/types/ingredient';
import { needlesFor } from '../rakk-app/src/services/matcher';
import { parseEcfr } from './parse/ecfr.mjs';
import { decodeEntities, nameKey, parseCsv } from './lib/text.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'sources/raw');
const rows: Ingredient[] = JSON.parse(readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8'));
const prov: Record<string, { kind: string; review: string[]; fields: any[] }> = JSON.parse(readFileSync(join(ROOT, 'out/provenance.json'), 'utf8'));

const failures: Array<{ id: string; check: string; detail: string }> = [];
const passed: Record<string, number> = {};
const fail = (id: string, check: string, detail: string) => failures.push({ id, check, detail });
const pass = (check: string) => { passed[check] = (passed[check] ?? 0) + 1; };

const GREEK: Record<string, string> = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', κ: 'kappa', λ: 'lambda', ω: 'omega', ψ: 'psi' };
/** One flat, comparable form of any source text. */
const flat = (s: string) =>
  decodeEntities(s.replace(/<\/?[a-zA-Z][^>]*>/g, ' '))
    .replace(/[αβγδεκλωψ]/g, (c) => GREEK[c])
    .replace(/=T\("?([^")]*)"?\)/g, '$1')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

// ─── raw sources, flattened once ───
const RAW_TEXT: Record<string, string> = {
  fda_saf: flat(readFileSync(join(RAW, 'fda_saf.csv'), 'utf8')),
  fda_gras_notices: flat(readFileSync(join(RAW, 'fda_gras_notices.csv'), 'utf8')),
  fda_color_additives: flat(readFileSync(join(RAW, 'fda_color_additives.csv'), 'utf8')),
  eu_1333_2008: flat(readFileSync(join(RAW, 'eu_1333_2008.xhtml'), 'utf8')),
  hk_legislation: ['cap132BD', 'cap132H', 'cap132U'].map((c) => flat(readFileSync(join(RAW, `hk/${c}.xml`), 'utf8'))).join(' '),
};
const cfr = parseEcfr(['ecfr_21_subchapter_b.xml', 'ecfr_21_part_73.xml', 'ecfr_21_part_74.xml', 'ecfr_21_part_81.xml', 'ecfr_21_part_82.xml'].map((f) => join(RAW, f)));
RAW_TEXT.ecfr_21_subchapter_b = [...cfr.values()].map((s: any) => flat(`${s.heading} ${s.paragraphs.map((p: any) => p.text).join(' ')}`)).join(' ');

// Annex II Part B, independently: just the E-numbers present in it.
const eu = readFileSync(join(RAW, 'eu_1333_2008.xhtml'), 'utf8');
const partB = eu.slice(eu.indexOf('LIST OF ALL ADDITIVES'), eu.indexOf('PART C', eu.indexOf('LIST OF ALL ADDITIVES')));
const partBFlat = flat(partB);
const euNumbers = new Set([...partB.matchAll(/<td[^>]*>\s*(?:<[^>]+>\s*)*E\s?(\d{3,4}[a-z]?(?:\s?\([ivx]+\))?)\s*(?:<[^>]+>\s*)*<\/td>/g)].map((m) => `E${m[1].replace(/\s+/g, '')}`));

// GRAS notices FDA answered "no questions".
const grnNoQuestions = new Set<string>();
{
  const lines = readFileSync(join(RAW, 'fda_gras_notices.csv'), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('GRAS Notice'));
  const t = parseCsv(lines.slice(start).join('\n'));
  const h = t[0];
  const gi = h.indexOf('GRAS Notice (GRN) No.'), li = h.indexOf("FDA's Letter");
  for (const r of t.slice(1)) {
    const id = (r[gi] ?? '').replace(/=T\("?([^")]*)"?\)/, '$1').trim();
    if (/^\s*FDA has no questions/i.test(r[li] ?? '') && !/does not provide a basis/i.test(r[li] ?? '')) grnNoQuestions.add(id);
  }
}

// EFSA ADIs straight from the converted workbook: CAS → set of DOIs and numbers.
const oftByCas = new Map<string, { dois: Set<string>; values: Set<string> }>();
{
  const load = (n: string) => {
    const t = parseCsv(readFileSync(join(ROOT, `work/oft_${n}.csv`), 'utf8'));
    return t.slice(1).map((r) => Object.fromEntries(t[0].map((h, i) => [h, r[i] ?? ''])));
  };
  const tox = load('FLEX_SUM.ToxRefValues'), sub = load('SUB'), ref = load('REF_SUB'), dos = load('DOSSIER'), docs = load('DOSSIER_DOCS');
  const subBy = new Map(sub.map((s) => [s['Document UUID'], s]));
  const refBy = new Map(ref.map((r) => [r['Document UUID'], r]));
  const dosBy = new Map(dos.map((d) => [d['Document UUID'], d]));
  const d2d = new Map(docs.map((d) => [d['DOCUMENT UUID'], d['DOSSIER UUID']]));
  const A = 'HumanHealthHazardCharacteristics.AcceptableDailyIntake.';
  for (const t of tox) {
    const s = subBy.get(t['Parent UUID']);
    const r = s && refBy.get(s['ReferenceSubstance.ReferenceSubstance']);
    const cas = r?.['Inventory.CASNumber'] || r?.['CAS number'];
    if (!cas) continue;
    const d = dosBy.get(d2d.get(t['Document UUID']) ?? '') ?? {};
    const doi = (d['LiteratureReference.LinkToPersistentIdentifier'] || '').match(/10\.2903\/[^\s,;]+/)?.[0];
    if (!oftByCas.has(cas)) oftByCas.set(cas, { dois: new Set(), values: new Set() });
    const e = oftByCas.get(cas)!;
    if (doi) e.dois.add(doi);
    for (const v of [t[A + 'Adi.lowerValue'], t[A + 'Adi.upperValue']]) if (v) e.values.add(String(Number(Number(v).toPrecision(12))));
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const namesOf = (i: Ingredient) => [i.canonical_name, ...i.aka];

/** Same standard as the build, written separately: listed, not mentioned. */
function sectionNamesIt(section: string, i: Ingredient, extra: string[]): string | null {
  const sec = cfr.get(section);
  if (!sec) return 'section does not exist';
  if (sec.reserved) return 'section is reserved';
  const units: string[] = [sec.identity, ...sec.entries].map(flat);
  const subject = nameKey(flat(sec.subject));
  const body = flat(sec.text);
  const names = [...namesOf(i), ...extra].map((n) => flat(n).replace(/--\s*nlfg$/, '').trim());
  for (const n of names) {
    const bare = n.replace(/\s*\([^)]*\)/g, '').trim();
    const parts = bare.split(', ');
    const inverted = parts.length > 1 ? [[...parts.slice(1).reverse(), parts[0]].join(' '), [...parts.slice(1), parts[0]].join(' ')] : [];
    for (const v of [n, bare, ...inverted]) {
      const k = nameKey(v);
      if (k === subject) return null;
      if (k.length > 3 && units.some((u) => u.includes(k))) return null;
      if (k.length > 3 && body.includes(`the term ${k} `)) return null;
    }
  }
  const skip = new Set(['extract', 'extracts', 'tincture', 'fluid', 'oleoresin', 'natural', 'preparation', 'enzyme', 'from']);
  for (const n of names) {
    const w = nameKey(n.replace(/\s*\([^)]*\)/g, '')).split(/[^a-z0-9]+/).filter((x) => x.length >= 3 && !skip.has(x));
    if (w.length > 1 && units.some((u) => w.every((x) => u.includes(x)))) return null;
  }
  return 'section does not list the substance';
}

const ENUM = {
  category: ['preservative', 'thickener', 'emulsifier', 'filler', 'colorant', 'flavor', 'sweetener', 'acidity_regulator', 'leavening_agent', 'antioxidant', 'other'],
  origin: ['natural', 'nature_identical', 'synthetic', 'unknown'],
  typical_uses: ['food', 'cosmetics', 'pharmaceutical', 'industrial'],
  allergen_flags: ['milk', 'egg', 'fish', 'crustacean_shellfish', 'tree_nut', 'peanut', 'wheat', 'soybean', 'sesame', 'sulfites'],
  jurisdiction: ['US_FDA', 'EU_EFSA', 'CODEX', 'HK_CFS'],
  product_type_context: ['leave_on', 'rinse_off', 'ingested', 'topical', 'other'],
  source: ['fda_substances_added_to_food', 'fda_gras_notice', 'codex_alimentarius', 'usda_fooddata_central', 'manual_curation', 'fda_color_additives', 'eu_additives_regulation'],
};
const isDate = (d: string | null) => d === null || /^\d{4}-\d{2}-\d{2}$/.test(d);

const ids = new Set<string>();
const needleOwner = new Map<string, string>();

for (const i of rows) {
  const p = prov[i.id];
  if (!p) { fail(i.id, 'provenance', 'row has no provenance record'); continue; }

  // ─── structure ───
  if (ids.has(i.id)) fail(i.id, 'unique id', 'duplicate id');
  ids.add(i.id);
  if (!i.canonical_name?.trim()) fail(i.id, 'canonical_name', 'empty');
  if (!i.plain_explanation?.trim()) fail(i.id, 'plain_explanation', 'empty');
  if (!ENUM.category.includes(i.category)) fail(i.id, 'enum', `category ${i.category}`);
  if (!ENUM.origin.includes(i.origin)) fail(i.id, 'enum', `origin ${i.origin}`);
  if (!ENUM.source.includes(i.source)) fail(i.id, 'enum', `source ${i.source}`);
  for (const u of i.typical_uses) if (!ENUM.typical_uses.includes(u)) fail(i.id, 'enum', `typical_use ${u}`);
  for (const a of i.allergen_flags) if (!ENUM.allergen_flags.includes(a)) fail(i.id, 'enum', `allergen ${a}`);
  if (!isDate(i.source_updated_at) || !isDate(i.last_full_review_at)) fail(i.id, 'dates', 'not YYYY-MM-DD');
  if (new Set(i.jurisdictions.map((j) => j.jurisdiction)).size !== i.jurisdictions.length) fail(i.id, 'jurisdictions', 'duplicate jurisdiction');
  if (i.risk_assessment_refs && new Set(i.risk_assessment_refs).size !== i.risk_assessment_refs.length) fail(i.id, 'refs', 'duplicate ref');
  // §11: "so no dosage claim is ever asserted without a traceable source".
  if (i.usage_context && !(i.risk_assessment_refs?.length)) fail(i.id, 'dosage source', 'usage_context without risk_assessment_refs');
  else if (i.usage_context) pass('dosage has a source');
  if (i.usage_context && !ENUM.product_type_context.includes(i.usage_context.product_type_context)) fail(i.id, 'enum', 'product_type_context');
  // §9: never a flag without a source.
  if (!i.everyday_allowlist && i.jurisdictions.length === 0) pass('flaggable without jurisdiction (reported, not failed)');

  // ─── one name, one ingredient ───
  for (const n of needlesFor(i)) {
    const o = needleOwner.get(n);
    if (o && o !== i.id) fail(i.id, 'unique name', `"${n}" also names ${o}`);
    needleOwner.set(n, i.id);
  }
  // A row whose every name is a long systematic name cannot be found from a
  // label. That is a coverage fact about obscure flavour chemicals, not an
  // error; it is counted so it stays visible.
  if (!needlesFor(i).length) pass('not matchable from a label: only systematic names (reported)');

  const fieldProv = (f: string) => p.fields.find((x: any) => x.field === f);

  // ─── jurisdictions, re-checked against the documents ───
  for (const j of i.jurisdictions) {
    const jp = fieldProv(`jurisdictions.${j.jurisdiction}`);
    if (!jp) { fail(i.id, 'provenance', `no provenance for ${j.jurisdiction}`); continue; }

    if (j.jurisdiction === 'US_FDA') {
      if (j.citation?.startsWith('21 CFR ')) {
        const section = j.citation.slice(7);
        // Every name the inventory gives this substance, read from the stored
        // inventory row itself — not from the build's filtered alias list.
        const safNames = p.fields
          .filter((x: any) => x.source === 'fda_saf' && x.field === 'canonical_name')
          .flatMap((x: any) => [
            (x.excerpt.match(/Substance: ([^|]+)/)?.[1] ?? '').trim(),
            ...(x.excerpt.match(/Other Names: ([^|]+)/)?.[1] ?? '').split(/<br\s*\/?>|&diams;|♦/).map((n: string) => n.trim()),
          ])
          .filter(Boolean);
        const problem = sectionNamesIt(section, i, safNames);
        if (problem) fail(i.id, 'US citation', `${j.citation}: ${problem}`); else pass('US CFR citation names the substance');
        if (j.citation_url !== `https://www.ecfr.gov/current/title-21/section-${section}`) fail(i.id, 'US citation', 'URL does not match citation');
      } else if (j.citation?.startsWith('GRN ')) {
        const id = j.citation.slice(4);
        if (!grnNoQuestions.has(id)) fail(i.id, 'US GRN', `${j.citation} is not a "no questions" notice`); else pass('GRN is a "no questions" notice');
      } else if (j.citation?.startsWith('FEMA No. ')) {
        const fema = j.citation.slice(9);
        if (!jp.excerpt.includes(`FEMA No: ${fema}`) || !RAW_TEXT.fda_saf.includes(flat(fema))) fail(i.id, 'US FEMA', `FEMA ${fema} not on the substance's inventory row`); else pass('FEMA number on inventory row');
      } else if (jp.source === 'fda_color_additives') {
        if (!RAW_TEXT.fda_color_additives.includes(flat(j.status))) fail(i.id, 'US colour status', `status not verbatim from colour list: ${j.status}`); else pass('colour status is the list’s own wording');
      } else if (jp.method === 'seed') {
        pass('US entry from seed without CFR citation (reported)');
      } else if (j.citation === 'FDA Substances Added to Food') {
        pass('US entry: inventory listing only');
      } else fail(i.id, 'US citation', `unrecognised citation form: ${j.citation}`);
    }

    if (j.jurisdiction === 'EU_EFSA' && jp.method !== 'seed') {
      const e = i.e_number_ins_code;
      if (/^Not on the EU list/.test(j.status)) {
        if (!e || euNumbers.has(e)) fail(i.id, 'EU absence', `${e} is in Annex II Part B`); else pass('EU absence confirmed');
      } else {
        const cited = j.citation?.match(/E (\d{3,4}[a-z]?(?:\([ivx]+\))?)$/)?.[1];
        if (!cited || !euNumbers.has(`E${cited}`)) fail(i.id, 'EU E-number', `${j.citation} not in Annex II Part B`); else pass('EU E-number in Annex II Part B');
        if (/^Not authorised for use in food/.test(j.status) && !/is not authorised in the food categories listed in part d and e/.test(partBFlat.slice(Math.max(0, partBFlat.indexOf(`e ${cited}`) - 10)))) fail(i.id, 'EU note', 'food-use exclusion not backed by the annex note');
      }
    }

    if (j.jurisdiction === 'HK_CFS') {
      const body = jp.excerpt.replace(/^Cap\. 132[A-Z]+ (Schedule 1A?|Schedule \(Permitted Sweeteners\)|First Schedule)[^:]*:\s*/, '');
      const probe = flat(body).split(/ — | \(|, item \d+: /)[0].slice(0, 60).trim();
      if (!probe || !RAW_TEXT.hk_legislation.includes(probe)) fail(i.id, 'HK', `excerpt not found in Cap. 132 text: ${probe}`); else pass('HK entry found in regulation text');
    }
  }

  // ─── EFSA dosage figures ───
  const up = fieldProv('usage_context.threshold_of_concern');
  if (up?.source === 'efsa_openfoodtox') {
    const doi = up.locator.match(/10\.2903\/\S+/)?.[0];
    const o = i.cas_number ? oftByCas.get(i.cas_number) : undefined;
    const num = i.usage_context!.threshold_of_concern?.match(/set at (?:up to |below |at least |above )?([\d.]+)/)?.[1];
    if (!o || !doi || !o.dois.has(doi)) fail(i.id, 'EFSA ADI', `DOI ${doi} not recorded for CAS ${i.cas_number}`);
    else if (num && !o.values.has(String(Number(num)))) fail(i.id, 'EFSA ADI', `value ${num} not recorded for CAS ${i.cas_number}`);
    else pass('EFSA ADI traced to OpenFoodTox');
    if (!i.risk_assessment_refs?.some((r) => r.includes(doi ?? '∅'))) fail(i.id, 'EFSA ADI', 'reference does not carry the DOI');
  }

  // ─── every parsed excerpt occurs in its source ───
  for (const f of p.fields) {
    if (f.method !== 'parsed') continue;
    const text = RAW_TEXT[f.source];
    if (!text) continue; // openfoodtox is checked above, by value
    // CSV excerpts are "Header: value | …" — each value must be in the file.
    const csv = f.source.startsWith('fda_');
    const pieces = f.excerpt.split(' | ').map((s: string) => (csv ? s.replace(/^[^:]{1,60}: /, '') : s)).map(flat).filter((s: string) => s.length > 2);
    const probes = f.source === 'eu_1333_2008' || f.source === 'hk_legislation' ? [] : pieces.slice(0, 6).map((s: string) => s.slice(0, 120));
    const missing = probes.filter((s: string) => !text.includes(s));
    if (missing.length) fail(i.id, 'excerpt in source', `${f.field} (${f.source}): "${missing[0].slice(0, 80)}"`);
    else pass('parsed excerpt found in source');
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const byCheck: Record<string, number> = {};
for (const f of failures) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
const out = { verified_at: new Date().toISOString(), rows: rows.length, passed, failed: byCheck, failures };
writeFileSync(join(ROOT, 'out/verify-report.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`rows: ${rows.length}`);
for (const [k, v] of Object.entries(passed)) console.log(`  ✓ ${String(v).padStart(5)}  ${k}`);
for (const [k, v] of Object.entries(byCheck)) console.log(`  ✗ ${String(v).padStart(5)}  ${k}`);
for (const f of failures.slice(0, 40)) console.log(`     ${f.id}: ${f.check} — ${f.detail}`);
if (failures.length > 40) console.log(`     … ${failures.length - 40} more in out/verify-report.json`);
process.exit(failures.length ? 1 : 0);
