/**
 * Build the ingredient database from the bulk sources (§12.C steps 1–2, §13).
 *
 * Run (from rakk-app/, which has tsx):  npx tsx ../pipeline/build.ts
 *
 * Output (pipeline/out/):
 *   ingredients.json   Ingredient[] — rows satisfying rakk-app/src/types/ingredient.ts
 *   provenance.json    for every row and field: which source, where in it, and
 *                      the exact source text the value was taken from
 *   build-report.json  counts, gaps, conflicts and everything that needs a human
 *
 * RULES THIS FILE HOLDS TO
 *  - Nothing is generated from model memory. A value is either parsed from a
 *    source document (and its excerpt kept), taken from the hand-curated seed,
 *    or produced by a fixed, reviewable vocabulary (lib/vocab.mjs) from a
 *    parsed code. Each provenance entry says which of the three it is.
 *  - Sources are joined on CAS number and E-number/INS code (§13), and on
 *    exact normalised names — never on fuzzy similarity.
 *  - A citation that cannot be confirmed against the regulation text is not
 *    emitted. PHASE-2-HANDOFF §3.1: plausible-but-wrong citations were 7% of
 *    the hand-written seed, and FDA's own inventory cites sections that no
 *    longer exist.
 *  - The seed wins on anything a human wrote (explanations, allow-list,
 *    dosage), because it was curated; bulk data fills in what it left empty.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AllergenFlag, Ingredient, IngredientCategory, JurisdictionEntry, TypicalUse } from '../rakk-app/src/types/ingredient';
import { SEED_INGREDIENTS } from '../rakk-app/src/data/seed';
import { needlesFor } from '../rakk-app/src/services/matcher';

import { parseFdaSaf } from './parse/fda-saf.mjs';
import { parseEcfr, ecfrUrl, listsSubstance } from './parse/ecfr.mjs';
import { parseGrasNotices, parseColorAdditives } from './parse/fda-other.mjs';
import { parseEu1333, EU_REG_URL } from './parse/eu-1333.mjs';
import { parseHk } from './parse/hk.mjs';
import { parseOpenFoodTox, adiSentence, adiReference } from './parse/efsa-oft.mjs';
import { joinKey, nameKey, sentenceCase, decodeEntities, parseCsv } from './lib/text.mjs';
import { EFFECT_BY_NAME, EFFECTS, US_PART_STATUS, US_PART_PRIORITY, ALLERGEN_RULES, GENERIC_NAMES } from './lib/vocab.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'sources/raw');
const OUT = join(ROOT, 'out');
const manifest = JSON.parse(readFileSync(join(ROOT, 'sources/manifest.json'), 'utf8'));

// ─────────────────────────────────────────────────────────────────────────────
// Provenance
// ─────────────────────────────────────────────────────────────────────────────

type Method = 'parsed' | 'seed' | 'vocabulary';
interface Prov {
  field: string;
  source: string; // a SOURCES id, or 'seed'
  locator: string; // where in the source: section, row, E-number …
  excerpt: string; // the source text the value came from, verbatim
  method: Method;
}

interface Row extends Ingredient {
  _prov: Prov[];
  _kind: 'seed' | 'fda_saf' | 'fda_color' | 'gras_notice' | 'eu';
  _keys: Set<string>; // joinKeys of every name, for cross-source joins
  _saf?: any;
  _color?: any;
  _review: string[]; // reasons a human should look at this row
}

const report: Record<string, any> = {
  built_at: new Date().toISOString(),
  sources: Object.fromEntries(Object.entries(manifest).map(([k, v]: any) => [k, { fetched_at: v.fetched_at ?? null, sha256: v.sha256 ?? null, ecfr_date: v.ecfr_date, celex: v.celex, source_last_updated: v.source_last_updated, present: v.present }])),
  counts: {},
  citations_rejected: [] as any[],
  eu_conflicts: [] as any[],
  names_dropped_ambiguous: [] as string[],
  rows_merged_on_name_collision: [] as any[],
  allergens_derived: [] as any[],
  seed_dosage_check: [] as any[],
  seed_unmatched_to_fda: [] as string[],
  hk_unmatched: [] as string[],
  eu_created: [] as string[],
  grn_skipped_generic: [] as string[],
  allowlist_added: [] as string[],
};

const today = new Date().toISOString().slice(0, 10);
const fdaDate = (mdy: string | null) => {
  if (!mdy) return today;
  const [m, d, y] = mdy.split('/').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse every source
// ─────────────────────────────────────────────────────────────────────────────

const saf = parseFdaSaf(join(RAW, 'fda_saf.csv'));
const cfr = parseEcfr(['ecfr_21_subchapter_b.xml', 'ecfr_21_part_73.xml', 'ecfr_21_part_74.xml', 'ecfr_21_part_81.xml', 'ecfr_21_part_82.xml'].map((f) => join(RAW, f)));
const grn = parseGrasNotices(join(RAW, 'fda_gras_notices.csv'));
const colors = parseColorAdditives(join(RAW, 'fda_color_additives.csv'));
const eu = parseEu1333(join(RAW, 'eu_1333_2008.xhtml'), manifest.eu_1333_2008?.celex);
const hk = parseHk(join(RAW, 'hk'));
const oft = parseOpenFoodTox(join(RAW, 'efsa_openfoodtox.xlsx'), join(ROOT, 'work'));

const SAF_DATE = fdaDate(saf.updated);
const GRN_DATE = fdaDate(grn.updated);
const COLOR_DATE = fdaDate(colors.updated);
const ECFR_DATE = manifest.ecfr_21_subchapter_b?.ecfr_date ?? today;
const EU_DATE = (eu.celex ?? '').match(/-(\d{4})(\d{2})(\d{2})$/)?.slice(1).join('-') ?? today;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const GREEK: Record<string, string> = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', κ: 'kappa', λ: 'lambda', ω: 'omega', ψ: 'psi' };
const deGreek = (s: string) => s.replace(/[αβγδεκλωψ]/g, (c) => GREEK[c]);
const keysOf = (names: string[]) => new Set(names.map((n) => joinKey(deGreek(n))).filter(Boolean));

/**
 * The inventory inverts names for alphabetising: "Basil, oil", "Ammonium
 * phosphate, dibasic", "2-hexenyl hexanoate, trans-". Labels print them in
 * natural order. Only these closed patterns are reordered; anything else is
 * left exactly as FDA wrote it.
 */
const SUFFIX_FORMS = /^(oil|extract|oleoresin|tincture|absolute|resin|concrete|balsam|fluid extract|extract solid|solid extract|essence|juice|gum|distillate|liquid)$/;
function naturalOrder(name: string, others: string[] = []): string {
  const parts = name.split(', ');
  if (parts.length !== 2) return name;
  const [head, tail] = parts;
  let natural: string | null = null;
  if (SUFFIX_FORMS.test(tail)) natural = `${head} ${tail}`;
  else if (/^(cis|trans|dl|d|l|n|alpha|beta|gamma|delta|endo|exo|e|z|r|s)-$/i.test(tail)) natural = `${tail}${head.charAt(0).toLowerCase()}${head.slice(1)}`;
  else if (/ of$/.test(tail)) natural = `${tail} ${head.charAt(0).toLowerCase()}${head.slice(1)}`;
  else if (/^[a-z]+( and [a-z]+)?$/.test(tail) && !/^vitamin/i.test(head)) natural = `${tail} ${head.charAt(0).toLowerCase()}${head.slice(1)}`;
  if (!natural) {
    // The inventory sometimes lists the natural order itself.
    const alt = others.find((o) => joinKey(o) === joinKey(`${tail} ${head}`));
    return alt ? sentenceCase(alt) : name;
  }
  return natural.charAt(0).toUpperCase() + natural.slice(1);
}

/** A display/alias name worth keeping: short, not an inverted CAS index name. */
function usableAlias(n: string): string | null {
  let s = deGreek(decodeEntities(n)).replace(/--\s*NLFG\s*$/i, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9)]+$/, '');
  if (!s || s.length > 60) return null;
  if (s.includes(', ') || /,[A-Za-z]/.test(s.replace(/\d,\d/g, ''))) return null; // "ACID, CITRIC"
  if ((s.match(/\(/g) ?? []).length !== (s.match(/\)/g) ?? []).length) return null;
  if ((s.match(/[A-Za-z0-9]+/g) ?? []).length > 8) return null;
  if (/^[\d\s.-]+$/.test(s)) return null;
  // The inventory's synonym column carries identifiers and debris: InChIKeys,
  // "q", "1/p-1". A name has at least three letters in a row.
  if (!/[A-Za-z]{3}/.test(s) || /^inchi/i.test(s) || /^[A-Z]{14}-[A-Z]{10}/.test(s)) return null;
  return /[a-z]/.test(s) ? s : sentenceCase(s);
}

const sectionNames = (section: string, names: string[]) => listsSubstance(cfr.get(section), names);

/** The paragraph of a section that best evidences the substance, for provenance. */
function sectionExcerpt(section: string, matched?: string): string {
  const sec = cfr.get(section)!;
  const k = matched ? nameKey(matched) : '';
  const p = sec.paragraphs.find((p: any) => p.text.toLowerCase().includes(k)) ?? sec.paragraphs[0];
  // Heading and paragraph are separate pieces: the paragraph is not always the
  // first one, so joined they would not be contiguous text in the source.
  return `${sec.heading} | ${p ? p.text.slice(0, 1100) : ''}`;
}

const isColorFoodSection = (s: string) => {
  const [part, minor] = s.split('.').map(Number);
  return (part === 73 || part === 74) && minor < 1000;
};

/** Part 182 also holds packaging-migration and pesticide-adjuvant lists. */
const INDIRECT_182 = new Set(['182.70', '182.90', '182.99']);
const isIndirect = (section: string) => INDIRECT_182.has(section) || ['175', '176', '177', '178', '186'].includes(section.split('.')[0]);

function usPriority(section: string): number {
  if (INDIRECT_182.has(section)) return 96;
  const part = section.split('.')[0];
  if ((part === '73' || part === '74') && !isColorFoodSection(section)) return 90; // drug/cosmetic listings
  const i = US_PART_PRIORITY.indexOf(part);
  if (i >= 0) return i;
  return Number(part) < 170 ? 50 : 95; // standards of identity / labeling
}

function usStatusFor(section: string): string {
  if (section === '182.99') return 'GRAS only as an adjuvant in pesticide formulations, not as a food ingredient';
  if (INDIRECT_182.has(section)) return 'GRAS only as a substance migrating from food packaging, not as a food ingredient';
  const part = section.split('.')[0];
  if (US_PART_STATUS[part]) {
    const [status] = US_PART_STATUS[part];
    // The one use-level statement that can be read mechanically without
    // interpretation: §184.1(b)(1)'s "no limitation other than current good
    // manufacturing practice". Anything numeric is left for the grounded
    // extraction pass (extract-limits), not guessed here.
    if (part === '184' && /no limitation other than current good manufacturing practice/.test(cfr.get(section)!.text)) {
      return `${status}, with no limit other than good manufacturing practice`;
    }
    return status;
  }
  if (Number(part) < 170) return 'Named in an FDA standard of identity or labeling regulation';
  return 'Named in FDA food regulations';
}

/** 170.3(o)(N) references in a section, in the order the regulation gives them. */
function sectionEffects(section: string): string[] {
  const sec = cfr.get(section);
  if (!sec) return [];
  const out: string[] = [];
  for (const m of sec.text.matchAll(/170\.3\(o\)\((\d+)\)/g)) {
    const e = EFFECTS.find((x: any) => x[1] === Number(m[1]));
    if (e && !out.includes(e[0])) out.push(e[0]);
  }
  return out;
}

function explanationFromEffects(effects: string[]): { text: string; effects: string[] } | null {
  const known = effects.filter((e) => EFFECT_BY_NAME.has(e));
  if (!known.length) return null;
  const onlyFlavour = known.every((e) => e === 'FLAVORING AGENT OR ADJUVANT' || e === 'FLAVOR ENHANCER');
  if (onlyFlavour) {
    return { text: 'A flavouring substance, used in food to add or help carry flavour.', effects: known.slice(0, 1) };
  }
  const food = known.filter((e) => e !== 'FLAVORING AGENT OR ADJUVANT' && e !== 'FLAVOR ENHANCER');
  const picked = food.slice(0, 2);
  const [a, b] = picked.map((e) => EFFECT_BY_NAME.get(e).purpose);
  return { text: b ? `Used in food to ${a}, and to ${b}.` : `Used in food to ${a}.`, effects: picked };
}

const byRank = (effects: string[]) =>
  [...new Set(effects)].sort((x, y) => (EFFECT_BY_NAME.get(x)?.rank ?? 99) - (EFFECT_BY_NAME.get(y)?.rank ?? 99));

function slug(s: string) {
  return deGreek(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

const ids = new Set(SEED_INGREDIENTS.map((i) => i.id));
function newId(name: string, disambiguator: string) {
  const base = `ing_${slug(name) || 'substance'}`;
  if (!ids.has(base)) { ids.add(base); return base; }
  const alt = `${base}_${slug(disambiguator)}`;
  if (!ids.has(alt)) { ids.add(alt); return alt; }
  let n = 2;
  while (ids.has(`${alt}_${n}`)) n++;
  ids.add(`${alt}_${n}`);
  return `${alt}_${n}`;
}

function blankRow(kind: Row['_kind']): Row {
  return {
    id: '', canonical_name: '', aka: [], cas_number: null, e_number_ins_code: null, chemical_formula: null,
    category: 'other', origin: 'unknown', typical_uses: ['food'], allergen_flags: [], plain_explanation: '',
    jurisdictions: [], risk_assessment_refs: null, usage_context: null, source: 'fda_substances_added_to_food',
    source_updated_at: today, last_full_review_at: null, everyday_allowlist: false,
    _prov: [], _kind: kind, _keys: new Set(), _review: [],
  };
}

function setJurisdiction(row: Row, entry: JurisdictionEntry, prov: Omit<Prov, 'field'>) {
  row.jurisdictions = row.jurisdictions.filter((j) => j.jurisdiction !== entry.jurisdiction);
  row.jurisdictions.push(entry);
  row._prov = row._prov.filter((p) => p.field !== `jurisdictions.${entry.jurisdiction}`);
  row._prov.push({ field: `jurisdictions.${entry.jurisdiction}`, ...prov });
}

const ORDER = ['US_FDA', 'EU_EFSA', 'CODEX', 'HK_CFS'];

// ─────────────────────────────────────────────────────────────────────────────
// 1. FDA Substances Added to Food → one row per substance
// ─────────────────────────────────────────────────────────────────────────────

const rows: Row[] = [];
const byCas = new Map<string, Row>();

for (const s of saf.records) {
  const row = blankRow('fda_saf');
  row._saf = s;
  row.canonical_name = s.name;
  row.canonical_name = naturalOrder(s.name, s.other_names);
  // Botanicals carry their Latin name: "Turmeric (curcuma longa l.)". Labels
  // print "turmeric"; the full form stays as an alias.
  const botanical = row.canonical_name.match(/^(.{3,}?) \(([^()]*\b(?:l|spp|linn|mill|dc|lam|willd|benth|hook|thunb|var|subsp|ex)\.?[^()]*)\)$/i);
  if (botanical && /^[a-z]+ [a-z]/i.test(botanical[2])) row.canonical_name = botanical[1];
  row.cas_number = s.cas;
  row.source = 'fda_substances_added_to_food';
  row.source_updated_at = SAF_DATE;
  row._keys = keysOf([s.name_upper, ...s.other_names]);
  row._prov.push({ field: 'canonical_name', source: 'fda_saf', locator: `FDA SAF id ${s.fda_id.trim()}`, excerpt: s.excerpt, method: 'parsed' });
  if (s.cas) row._prov.push({ field: 'cas_number', source: 'fda_saf', locator: `FDA SAF id ${s.fda_id.trim()}`, excerpt: s.excerpt, method: 'parsed' });

  // ── US jurisdiction: the best CITATION THAT VERIFIES ──
  const names = [s.name_upper, ...s.other_names];
  const verified: Array<{ section: string; matched?: string }> = [];
  for (const r of s.regs) {
    if (r.kind === 'administrative') continue;
    const v = sectionNames(r.section, names);
    if (v.ok) verified.push({ section: r.section, matched: v.matched });
    else report.citations_rejected.push({ substance: s.name, section: r.section, reason: v.reason, source: 'fda_saf' });
  }
  verified.sort((a, b) => usPriority(a.section) - usPriority(b.section));
  const primary = verified[0];
  if (primary) {
    setJurisdiction(row, {
      jurisdiction: 'US_FDA',
      status: usStatusFor(primary.section),
      citation: `21 CFR ${primary.section}`,
      citation_url: ecfrUrl(primary.section),
    }, { source: 'ecfr_21_subchapter_b', locator: `21 CFR ${primary.section}`, excerpt: sectionExcerpt(primary.section, primary.matched), method: 'parsed' });
  } else if (s.fema_no) {
    const former = s.nlfg || s.fema_status;
    setJurisdiction(row, {
      jurisdiction: 'US_FDA',
      status: former
        ? `No FDA regulation; formerly on the flavor industry's FEMA GRAS list${s.fema_status ? ` (${s.fema_status.replace(/^No longer FEMA GRAS\s*/, '').replace(/[()]/g, '').trim()})` : ''}`
        : "No FDA regulation; used as a flavoring under the flavor industry's own GRAS determination (FEMA GRAS)",
      citation: `FEMA No. ${s.fema_no}`,
      citation_url: null,
    }, { source: 'fda_saf', locator: `FDA SAF id ${s.fda_id.trim()}, FEMA No ${s.fema_no}`, excerpt: s.excerpt, method: 'parsed' });
  } else {
    setJurisdiction(row, {
      jurisdiction: 'US_FDA',
      status: "Listed in FDA's Substances Added to Food inventory; no FDA regulation is cited",
      citation: 'FDA Substances Added to Food',
      citation_url: 'https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=FoodSubstances',
    }, { source: 'fda_saf', locator: `FDA SAF id ${s.fda_id.trim()}`, excerpt: s.excerpt, method: 'parsed' });
  }

  // ── What it is / why it's used: the regulation's own 170.3(o) effects
  //    when the primary section states them, else the inventory's list ──
  const regEffects = primary ? sectionEffects(primary.section) : [];
  const effects = regEffects.length ? regEffects : byRank(s.effects);
  const indirectOnly = verified.length > 0 && verified.every((v) => isIndirect(v.section));
  let explanation = explanationFromEffects(effects);
  if (indirectOnly) explanation = { text: 'Used in food-contact materials such as packaging, rather than added to food as an ingredient.', effects: [] };
  if (primary?.section.startsWith('189.')) {
    explanation = { text: `${explanation ? explanation.text + ' ' : ''}The US FDA prohibits its use in human food.`, effects: explanation?.effects ?? [] };
  }
  row.plain_explanation = explanation?.text ?? 'Listed by the US FDA as a substance added to food; the inventory records no purpose for it.';
  row._prov.push({
    field: 'plain_explanation',
    source: regEffects.length ? 'ecfr_21_subchapter_b' : 'fda_saf',
    locator: regEffects.length ? `21 CFR ${primary!.section} (170.3(o) references)` : `FDA SAF "Used for (Technical Effect)"`,
    excerpt: regEffects.length ? sectionExcerpt(primary!.section) : s.effects.join('; '),
    method: 'vocabulary',
  });
  const first = explanation?.effects[0] ?? effects[0];
  row.category = (indirectOnly ? 'other' : (EFFECT_BY_NAME.get(first)?.category as IngredientCategory)) ?? 'other';
  row._prov.push({ field: 'category', source: regEffects.length ? 'ecfr_21_subchapter_b' : 'fda_saf', locator: first ?? 'none', excerpt: effects.join('; '), method: 'vocabulary' });

  rows.push(row);
  if (s.cas) byCas.set(s.cas, row);
}

// Name index across rows (joinKey → rows), rebuilt as rows are added.
const byKey = new Map<string, Row[]>();
const indexRow = (r: Row) => { for (const k of r._keys) { if (!byKey.has(k)) byKey.set(k, []); if (!byKey.get(k)!.includes(r)) byKey.get(k)!.push(r); } };
rows.forEach(indexRow);
const findByName = (names: string[]): Row | null => {
  for (const k of keysOf(names)) {
    const hits = byKey.get(k);
    if (hits?.length === 1) return hits[0];
    // Several rows answer to the name, but one is the curated seed row that
    // stands for it — that is the one a label reader means.
    const seeded = hits?.filter((h) => h._kind === 'seed');
    if (seeded?.length === 1) return seeded[0];
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FDA Color Additive Status List
// ─────────────────────────────────────────────────────────────────────────────

const byENumber = new Map<string, Row>();
for (const c of colors.colors) {
  // Only a colour listed for FOOD speaks to what an ingredient is. A delisted
  // or drug/cosmetic-only listing must not recast an existing substance as a
  // colour (aluminum stearate was once a colour; it is an emulsifier today).
  const colorNames = [...c.name.split(/\s+\/\s+/), ...c.other_names];
  let row = (c.cas && byCas.get(c.cas)) || findByName(colorNames);
  if (!c.food_use) {
    if (row || !c.e_number) {
      if (row && c.e_number && !row.e_number_ins_code) row.e_number_ins_code = c.e_number;
      continue;
    }
  }
  if (!row) {
    row = blankRow('fda_color');
    row.id = '';
    row.canonical_name = c.name.split(/\s+\/\s+/)[0];
    row.cas_number = c.cas;
    row.source = 'fda_color_additives' as any;
    row.source_updated_at = COLOR_DATE;
    row.category = 'colorant';
    row.plain_explanation = 'Used in food to add, keep or enhance colour.';
    row._keys = keysOf(colorNames);
    row._prov.push({ field: 'canonical_name', source: 'fda_color_additives', locator: `Color Additive Status List: ${c.name}`, excerpt: c.excerpt, method: 'parsed' });
    row._prov.push({ field: 'plain_explanation', source: 'fda_color_additives', locator: c.name, excerpt: c.excerpt, method: 'vocabulary' });
    rows.push(row);
    indexRow(row);
    if (c.cas) byCas.set(c.cas, row);
  }
  row._color = c;
  row.category = 'colorant';
  for (const k of keysOf(colorNames)) row._keys.add(k);
  indexRow(row);
  row.typical_uses = c.uses.length ? Array.from(new Set(c.uses)) as TypicalUse[] : row.typical_uses;
  if (c.e_number) {
    row.e_number_ins_code = c.e_number;
    byENumber.set(c.e_number, row);
    row._prov.push({ field: 'e_number_ins_code', source: 'fda_color_additives', locator: `EEC No ${c.e_number}`, excerpt: c.excerpt, method: 'parsed' });
  }
  // The colour list's own status wording is the regulator's, and it carries
  // what the CFR section alone does not (e.g. FD&C Red No. 3's food listing
  // ending on 2027-01-15). Cite the food-use section when one verifies.
  const foodSection = c.regs.map((r: any) => r.section).filter(isColorFoodSection).find((s: string) => sectionNames(s, [c.name, ...c.other_names]).ok);
  setJurisdiction(row, {
    jurisdiction: 'US_FDA',
    status: c.status,
    citation: foodSection ? `21 CFR ${foodSection}` : 'FDA Color Additive Status List',
    citation_url: foodSection ? ecfrUrl(foodSection) : 'https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=ColorAdditives',
  }, { source: 'fda_color_additives', locator: `Color Additive Status List: ${c.name}${foodSection ? `; 21 CFR ${foodSection}` : ''}`, excerpt: c.excerpt, method: 'parsed' });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Seed rows — curated content wins, bulk data fills the gaps
// ─────────────────────────────────────────────────────────────────────────────

const seedRows: Row[] = [];
for (const seed of SEED_INGREDIENTS) {
  const names = [seed.canonical_name, ...seed.aka];
  let bulk = (seed.cas_number && byCas.get(seed.cas_number)) || (seed.e_number_ins_code && byENumber.get(seed.e_number_ins_code)) || findByName(names);
  if (bulk && bulk._kind === 'seed') bulk = null;
  const row: Row = { ...structuredClone(seed), _prov: [], _kind: 'seed', _keys: keysOf(names), _review: [] };

  for (const f of ['canonical_name', 'aka', 'plain_explanation', 'category', 'origin', 'allergen_flags', 'everyday_allowlist', 'usage_context', 'risk_assessment_refs'] as const) {
    row._prov.push({ field: f, source: 'seed', locator: `rakk-app/src/data/seed (${seed.id})`, excerpt: JSON.stringify((seed as any)[f]), method: 'seed' });
  }

  if (bulk) {
    // Absorb the bulk row: identifiers, then any jurisdiction the seed lacks.
    row.cas_number ??= bulk.cas_number;
    row.e_number_ins_code ??= bulk.e_number_ins_code;
    row.chemical_formula ??= bulk.chemical_formula;
    row.source = bulk.source;
    row.source_updated_at = bulk.source_updated_at;
    if (bulk._color && row.typical_uses.length === 1) row.typical_uses = bulk.typical_uses;
    for (const k of bulk._keys) row._keys.add(k);
    row._saf = bulk._saf;
    row._color = bulk._color;
    for (const p of bulk._prov) if (['cas_number', 'e_number_ins_code'].includes(p.field)) row._prov.push(p);

    for (const j of seed.jurisdictions) {
      if (j.jurisdiction === 'US_FDA') continue;
      row._prov.push({ field: `jurisdictions.${j.jurisdiction}`, source: 'seed', locator: j.citation ?? 'seed', excerpt: j.status, method: 'seed' });
    }
    const seedUs = seed.jurisdictions.find((j) => j.jurisdiction === 'US_FDA');
    const bulkUs = bulk.jurisdictions.find((j) => j.jurisdiction === 'US_FDA');
    // The inventory's own row, so the verifier can re-check names independently.
    row._prov.push(...bulk._prov.filter((p) => p.field === 'canonical_name' && p.source === 'fda_saf'));
    const bulkUsSection = bulkUs?.citation?.startsWith('21 CFR ') ? bulkUs.citation.slice(7) : null;
    if (!seedUs && bulkUs && bulkUsSection && isIndirect(bulkUsSection)) {
      // "Coconut oil: permitted only in food-contact coatings" is true of the
      // regulation and false as a description of the food. Leave it out.
      row._review.push(`only US citation found is indirect (${bulkUs.citation}); not attached`);
    } else if (!seedUs && bulkUs) {
      setJurisdiction(row, bulkUs, bulk._prov.find((p) => p.field === 'jurisdictions.US_FDA')!);
    } else if (seedUs) {
      row._prov.push({ field: 'jurisdictions.US_FDA', source: 'seed', locator: seedUs.citation ?? 'seed', excerpt: seedUs.citation?.startsWith('21 CFR') ? sectionExcerpt(seedUs.citation.slice(7)) : seedUs.status, method: 'seed' });
    }
    // Retire the bulk row; the seed row now stands for the substance.
    const at = rows.indexOf(bulk);
    if (at >= 0) rows.splice(at, 1);
    if (bulk.cas_number && byCas.get(bulk.cas_number) === bulk) byCas.set(bulk.cas_number, row);
    if (bulk.e_number_ins_code && byENumber.get(bulk.e_number_ins_code) === bulk) byENumber.set(bulk.e_number_ins_code, row);
    for (const [k, list] of byKey) byKey.set(k, list.filter((r) => r !== bulk));
  } else {
    report.seed_unmatched_to_fda.push(seed.canonical_name);
    for (const j of seed.jurisdictions) {
      row._prov.push({ field: `jurisdictions.${j.jurisdiction}`, source: 'seed', locator: j.citation ?? 'seed', excerpt: j.citation?.startsWith('21 CFR') ? sectionExcerpt(j.citation.slice(7)) : j.status, method: 'seed' });
    }
  }
  if (row.cas_number && !byCas.has(row.cas_number)) byCas.set(row.cas_number, row);
  if (row.e_number_ins_code) byENumber.set(row.e_number_ins_code, row);
  seedRows.push(row);
  indexRow(row);
}
rows.unshift(...seedRows);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GRAS notices FDA closed with "no questions"
// ─────────────────────────────────────────────────────────────────────────────

/** "Transglutaminase from <i>S. mobaraense</i>" → "Transglutaminase". */
function noticeBaseName(s: string): string {
  return deGreek(decodeEntities(s))
    .replace(/\s+(from|produced by|derived from|obtained from|expressed in|produced in|produced using|isolated from|prepared from|extracted from|made from|containing|in the form of|for use|as an|as a)\b[\s\S]*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*;.*$/, '')
    .trim();
}

const noticesByName = new Map<string, any[]>();
for (const n of grn.notices) {
  if (!n.no_questions) continue;
  const base = noticeBaseName(n.substance);
  const k = joinKey(base);
  if (!k) continue;
  if (!noticesByName.has(k)) noticesByName.set(k, []);
  noticesByName.get(k)!.push({ ...n, base });
}
const grnUrl = (id: string) => `https://hfpappexternal.fda.gov/scripts/fdcc/index.cfm?set=GRASNotices&id=${id}`;

for (const [k, notices] of noticesByName) {
  notices.sort((a, b) => Number(b.grn) - Number(a.grn));
  const latest = notices[0];
  const existing = byKey.get(k)?.length === 1 ? byKey.get(k)![0] : null;
  const status = `Notified to FDA as GRAS for its intended use; FDA had no questions${notices.length > 1 ? ` (${notices.length} notices)` : ''}`;
  const prov = { source: 'fda_gras_notices', locator: `GRN ${notices.map((n) => n.grn).join(', ')}`, excerpt: latest.excerpt.slice(0, 1200), method: 'parsed' as Method };

  if (existing) {
    // A notice adds to a row that has no US regulation of its own.
    const us = existing.jurisdictions.find((j) => j.jurisdiction === 'US_FDA');
    // A seed row keeps its own (verified) US entry, but one with none at all
    // — enzymes, protein isolates (PHASE-2-HANDOFF §3.4) — takes the notice.
    const weak = !us || !us.citation?.startsWith('21 CFR');
    if (!us || (weak && existing._kind !== 'seed')) {
      setJurisdiction(existing, { jurisdiction: 'US_FDA', status, citation: `GRN ${latest.grn}`, citation_url: grnUrl(latest.grn) }, prov);
    }
    continue;
  }

  const words = k.split(' ');
  if (words.length > 6 || (words.length === 1 && GENERIC_NAMES.has(words[0])) || words.every((w) => GENERIC_NAMES.has(w) || w.length < 3)) {
    report.grn_skipped_generic.push(`${latest.base} (GRN ${notices.map((n) => n.grn).join(', ')})`);
    continue;
  }

  const row = blankRow('gras_notice');
  row.canonical_name = latest.base.charAt(0).toUpperCase() + latest.base.slice(1);
  row.source = 'fda_gras_notice';
  row.source_updated_at = GRN_DATE;
  const use = latest.intended_use.split(/(?<=\.)\s/)[0].replace(/\.$/, '');
  row.plain_explanation = `Notified to the US FDA as GRAS for this use: ${use.charAt(0).toLowerCase()}${use.slice(1)}.`.slice(0, 400);
  row._keys = new Set([k]);
  row._prov.push({ field: 'canonical_name', ...prov });
  row._prov.push({ field: 'plain_explanation', ...prov, excerpt: latest.intended_use.slice(0, 1200) });
  setJurisdiction(row, { jurisdiction: 'US_FDA', status, citation: `GRN ${latest.grn}`, citation_url: grnUrl(latest.grn) }, prov);
  rows.push(row);
  indexRow(row);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EU — Annex II Part B, joined by E-number, then exact name
// ─────────────────────────────────────────────────────────────────────────────

const euByE = new Map(eu.additives.map((a: any) => [a.e_number, a]));
const euBase = (e: string) => e.replace(/\([ivx]+\)$/, '');

for (const a of eu.additives) {
  // "Azorubine, Carmoisine" is two names; "Propane-1, 2-diol" is one. A
  // separator followed by a capital starts a new name.
  const names = a.name.split(/\s*\/\s*|, (?=[A-Z])/).map((s: string) => s.trim()).filter(Boolean);
  // Several rows can legitimately share an E-number — E322 is lecithin from
  // any source, and the seed keeps soy and sunflower lecithin apart for their
  // allergen claims. The EU entry belongs to each of them.
  let targets: Row[] = rows.filter((r) => r.e_number_ins_code === a.e_number);
  if (!targets.length) {
    let row = findByName(names) ?? findByName(names.map((n: string) => n.replace(/s$/, '')));
    if (row?.e_number_ins_code && euBase(row.e_number_ins_code) !== euBase(a.e_number)) {
      // The name matched a row that already carries a different E-number: two
      // additives share a name somewhere. Never merge them — this E-number
      // gets a row of its own, and the clash is reported.
      report.eu_conflicts.push({ e_number: a.e_number, eu_name: a.name, matched_row: row.id || row.canonical_name, row_e: row.e_number_ins_code });
      row = null;
    }
    if (!row) {
      row = blankRow('eu');
      row.canonical_name = names[0];
      row.source = 'eu_additives_regulation' as any;
      row.source_updated_at = EU_DATE;
      row.category = (a.category_hint ?? 'other') as IngredientCategory;
      row.plain_explanation = a.group === 1 ? 'Authorised in the EU as a food colour.' : a.group === 2 ? 'Authorised in the EU as a sweetener.' : 'Authorised in the EU as a food additive.';
      row._keys = keysOf(names);
      row._prov.push({ field: 'canonical_name', source: 'eu_1333_2008', locator: a.e_number, excerpt: a.excerpt, method: 'parsed' });
      row._prov.push({ field: 'plain_explanation', source: 'eu_1333_2008', locator: `Annex II Part B list ${a.group}`, excerpt: a.excerpt, method: 'vocabulary' });
      rows.push(row);
      report.eu_created.push(`${a.e_number} ${a.name}`);
    }
    targets = [row];
  }

  const status = a.food_use_excluded
    ? 'Not authorised for use in food; kept on the EU list only for use in medicines'
    : a.notes.length
      ? `Authorised food additive (Annex II), with the note: “${a.notes[0].replace(/\s*\(OJ [^)]*\)\.?/, '').slice(0, 220)}”`
      : 'Authorised food additive; permitted foods and maximum levels set in Annex II';

  for (const row of targets) {
    if (!row.e_number_ins_code) {
      row.e_number_ins_code = a.e_number;
      row._prov.push({ field: 'e_number_ins_code', source: 'eu_1333_2008', locator: a.e_number, excerpt: a.excerpt, method: 'parsed' });
    }
    if (!byENumber.has(a.e_number)) byENumber.set(a.e_number, row);
    for (const k of keysOf(names)) row._keys.add(k);
    indexRow(row);
    setJurisdiction(row, {
      jurisdiction: 'EU_EFSA',
      status,
      citation: `Reg. (EC) 1333/2008, Annex II — ${a.e_number.replace(/^E/, 'E ')}`,
      citation_url: EU_REG_URL,
    }, { source: 'eu_1333_2008', locator: `Annex II Part B, ${a.e_number}`, excerpt: [a.excerpt, ...a.notes].join(' | '), method: 'parsed' });
  }
}

// Rows that carry an E-number the current Annex II does not list: the EU has
// no authorisation for them (e.g. E 128 Red 2G, withdrawn in 2007). Only for
// E-numbers from a regulator's own record, never from a guess.
for (const row of rows) {
  const e = row.e_number_ins_code;
  if (!e || !/^E\d/.test(e) || euByE.has(e) || [...euByE.keys()].some((k) => euBase(k) === euBase(e) || k.startsWith(e))) continue;
  const seedEu = row.jurisdictions.find((j) => j.jurisdiction === 'EU_EFSA');
  if (seedEu) report.eu_conflicts.push({ e_number: e, row: row.id || row.canonical_name, note: `seed says "${seedEu.status}" but ${e} is not in the current Annex II Part B` });
  setJurisdiction(row, {
    jurisdiction: 'EU_EFSA',
    status: 'Not on the EU list of authorised food additives',
    citation: 'Reg. (EC) 1333/2008, Annex II',
    citation_url: EU_REG_URL,
  }, { source: 'eu_1333_2008', locator: `Annex II Part B (absence of ${e})`, excerpt: `${e} does not appear among the ${eu.additives.length} entries of Annex II Part B in ${eu.celex}`, method: 'parsed' });
}

// Seed EU entries that nothing verified stay, but are marked for review.
for (const row of seedRows) {
  const p = row._prov.find((x) => x.field === 'jurisdictions.EU_EFSA');
  if (row.jurisdictions.some((j) => j.jurisdiction === 'EU_EFSA') && (!p || p.source === 'seed')) row._review.push('EU status from seed, not confirmed against Annex II');
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Hong Kong — by INS number (preservatives), Colour Index and exact name
// ─────────────────────────────────────────────────────────────────────────────

const byColourIndex = new Map<string, Row>();
for (const r of rows) for (const ci of r._color?.colour_index ?? []) byColourIndex.set(ci, r);

for (const h of hk.entries) {
  let targets: Row[] = [];
  if (h.ins) {
    targets = rows.filter((r) => r.e_number_ins_code === `E${h.ins}`);
    if (!targets.length) targets = rows.filter((r) => r.e_number_ins_code === `E${h.ins.replace(/\([ivx]+\)$/, '')}`);
  }
  if (!targets.length && h.colour_index && byColourIndex.has(h.colour_index)) targets = [byColourIndex.get(h.colour_index)!];
  if (!targets.length) {
    const r = findByName([h.name, h.name.replace(/\s*\([^)]*\)/g, '')]);
    if (r) targets = [r];
  }
  if (!targets.length) { report.hk_unmatched.push(`${h.cap}: ${h.name}${h.ins ? ` (INS ${h.ins})` : ''}`); continue; }
  for (const row of targets) {
    if (row.jurisdictions.some((j) => j.jurisdiction === 'HK_CFS')) continue;
    setJurisdiction(row, { jurisdiction: 'HK_CFS', status: h.status, citation: h.citation, citation_url: h.citation_url },
      { source: 'hk_legislation', locator: `Cap. ${h.cap}${h.ins ? `, INS ${h.ins}` : ''}`, excerpt: h.excerpt, method: 'parsed' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Dosage — EFSA Acceptable Daily Intakes (§12.B2), and a check of the seed's
// ─────────────────────────────────────────────────────────────────────────────

const numbersIn = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

for (const row of rows) {
  if (!row.cas_number) continue;
  const hit = oft.get(row.cas_number);
  if (!hit) continue;
  const rec = hit.chosen;

  if (row.usage_context) {
    // The seed's figure stays (a human wrote and attributed it), but it is now
    // checked. A different EFSA number is not proof of error — JECFA and EFSA
    // set their own values — so this is reported, not overwritten.
    const seedNums = numbersIn(row.usage_context.threshold_of_concern ?? '');
    const efsaNums = numbersIn(rec.value ?? '');
    const agrees = efsaNums.length > 0 && efsaNums.every((n) => seedNums.includes(n));
    report.seed_dosage_check.push({
      id: row.id, name: row.canonical_name,
      seed: row.usage_context.threshold_of_concern,
      efsa: adiSentence(rec), efsa_ref: adiReference(rec),
      comparison: agrees ? 'same figure as EFSA' : 'differs from EFSA — check which body the seed cites',
    });
    continue;
  }
  row.usage_context = {
    threshold_of_concern: adiSentence(rec),
    typical_concentration_range: 'No typical-use figure on file yet.',
    product_type_context: 'ingested',
  };
  row.risk_assessment_refs = [adiReference(rec)];
  row._prov.push({ field: 'usage_context.threshold_of_concern', source: 'efsa_openfoodtox', locator: `CAS ${row.cas_number}; ${rec.doi}`, excerpt: `${rec.substance}: ADI ${rec.qualifier ?? ''} ${rec.value ?? rec.not_allocated} ${rec.unit ?? ''} — ${rec.remarks}`, method: 'parsed' });
  row._prov.push({ field: 'risk_assessment_refs', source: 'efsa_openfoodtox', locator: rec.doi, excerpt: `${rec.title} (${rec.date})`, method: 'parsed' });
}

// Chemical formulas: EFSA's reference-substance records, by CAS.
{
  const refSub = readFileSync(join(ROOT, 'work/oft_REF_SUB.csv'), 'utf8');
  const t = parseCsv(refSub);
  const h = t[0];
  const ci = h.indexOf('Inventory.CASNumber'), fi = h.indexOf('MolecularStructuralInfo.MolecularFormula');
  const formula = new Map<string, string>();
  for (const r of t.slice(1)) if (r[ci] && r[fi] && !formula.has(r[ci])) formula.set(r[ci], r[fi]);
  for (const row of rows) {
    if (row.chemical_formula || !row.cas_number) continue;
    const f = formula.get(row.cas_number);
    if (f && /^[A-Z][A-Za-z0-9.]*$/.test(f)) {
      row.chemical_formula = f;
      row._prov.push({ field: 'chemical_formula', source: 'efsa_openfoodtox', locator: `REF_SUB, CAS ${row.cas_number}`, excerpt: `${row.cas_number} ${f}`, method: 'parsed' });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Names, allergens, allow-list, ids
// ─────────────────────────────────────────────────────────────────────────────

for (const row of rows) {
  if (row._kind === 'seed') continue;
  const candidates: string[] = [];
  if (row.e_number_ins_code) candidates.push(row.e_number_ins_code, row.e_number_ins_code.replace(/^E/, 'E '));
  if (row._color) candidates.push(...row._color.name.split(/\s+\/\s+/), ...row._color.other_names);
  if (row._saf) candidates.push(row._saf.name, row._saf.name_upper, ...row._saf.other_names);
  const seen = new Set([nameKey(row.canonical_name)]);
  const aka: string[] = [];
  for (const c of candidates) {
    const a = /^E ?\d/.test(c) ? c : usableAlias(c);
    if (!a) continue;
    const k = nameKey(a);
    if (seen.has(k)) continue;
    seen.add(k);
    aka.push(a);
  }
  // Short names first: they are the ones printed on labels.
  row.aka = aka.sort((x, y) => x.length - y.length).slice(0, 12);
  // A display name that cannot be matched ("β-Apo-8'-carotenal") needs a
  // word-bounded alias that can.
  const translit = deGreek(row.canonical_name);
  if (translit !== row.canonical_name && !row.aka.some((a) => nameKey(a) === nameKey(translit))) row.aka.unshift(translit);

  // Allergens, only where the name states the source outright.
  const text = [row.canonical_name, ...row.aka].join(' | ').toLowerCase();
  const flags = new Set<AllergenFlag>();
  for (const [flag, yes, no] of ALLERGEN_RULES as any) {
    if (yes.test(text) && !(no && no.test(text))) flags.add(flag);
  }
  row.allergen_flags = [...flags];
  if (flags.size) {
    report.allergens_derived.push(`${row.canonical_name}: ${[...flags].join(', ')}`);
    row._prov.push({ field: 'allergen_flags', source: row._saf ? 'fda_saf' : row._kind, locator: 'derived from the name', excerpt: text.slice(0, 300), method: 'vocabulary' });
    row._review.push('allergen flags derived from the name');
  }

  // Spices and natural seasonings (21 CFR 182.10) are kitchen foods, not
  // additives; flagging "cinnamon" would make the underline mean nothing
  // (PHASE-2-HANDOFF §3.6). The regulation's own grouping decides it.
  const us = row.jurisdictions.find((j) => j.jurisdiction === 'US_FDA');
  if (us?.citation === '21 CFR 182.10' && row.canonical_name.split(' ').length <= 3) {
    row.everyday_allowlist = true;
    report.allowlist_added.push(row.canonical_name);
    row._prov.push({ field: 'everyday_allowlist', source: 'ecfr_21_subchapter_b', locator: '21 CFR 182.10 (spices and other natural seasonings and flavorings)', excerpt: sectionExcerpt('182.10', row.canonical_name), method: 'vocabulary' });
  }
}

for (const row of rows) {
  if (!row.id) row.id = newId(row.canonical_name, row.cas_number ?? row.e_number_ins_code ?? row._kind);
}

// Labels outside the US print "E 211" and "INS 211" as well as "E211"
// (§12.A). Added only where the row already answers to the compact form, so
// rows that share an E-number (the lecithins) never contest it.
for (const row of rows) {
  const e = row.e_number_ins_code;
  if (!e || !row.aka.some((a) => nameKey(a) === nameKey(e))) continue;
  const n = e.replace(/^E/, '');
  for (const form of [`E ${n}`, `INS ${n}`]) {
    if (!row.aka.some((a) => nameKey(a) === nameKey(form))) row.aka.push(form);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. One name, one ingredient (PHASE-2-HANDOFF §1). Checked on the matcher's
//    own needles — plural forms included — so the lookup table can key on them.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_RANK = { seed: 0, fda_saf: 1, fda_color: 2, eu: 3, gras_notice: 4 };
rows.sort((a, b) => KIND_RANK[a._kind] - KIND_RANK[b._kind]);

const owner = new Map<string, Row>();
const claimCount = new Map<string, number>();
for (const r of rows) for (const n of new Set([r.canonical_name, ...r.aka].flatMap((x) => needlesFor({ canonical_name: x, aka: [] })))) claimCount.set(n, (claimCount.get(n) ?? 0) + 1);

const dropped = new Set<Row>();
for (const row of rows) {
  // Canonical name first: it is not negotiable, so a collision there means two
  // rows describe one substance. The lower-priority row is folded in.
  const canon = needlesFor({ canonical_name: row.canonical_name, aka: [] });
  const clash = canon.map((n) => owner.get(n)).find((o) => o && o !== row);
  if (clash) {
    for (const j of row.jurisdictions) if (!clash.jurisdictions.some((x) => x.jurisdiction === j.jurisdiction)) {
      clash.jurisdictions.push(j);
      clash._prov.push(...row._prov.filter((p) => p.field === `jurisdictions.${j.jurisdiction}`));
    }
    clash.e_number_ins_code ??= row.e_number_ins_code;
    clash.cas_number ??= row.cas_number;
    report.rows_merged_on_name_collision.push({ kept: clash.id, folded: row.id, name: row.canonical_name, folded_kind: row._kind });
    dropped.add(row);
    continue;
  }
  for (const n of canon) owner.set(n, row);

  const keep: string[] = [];
  for (const a of row.aka) {
    const needles = needlesFor({ canonical_name: a, aka: [] });
    const taken = needles.some((n) => owner.has(n) && owner.get(n) !== row);
    // An alias two bulk rows both claim identifies neither — drop it from both
    // rather than letting row order pick a winner.
    const ambiguous = row._kind !== 'seed' && needles.some((n) => (claimCount.get(n) ?? 0) > 1 && !canon.includes(n));
    if (taken || ambiguous) { report.names_dropped_ambiguous.push(`${a} (${row.id})`); continue; }
    keep.push(a);
    for (const n of needles) owner.set(n, row);
  }
  row.aka = keep;
}
const final = rows.filter((r) => !dropped.has(r));

// ─────────────────────────────────────────────────────────────────────────────
// 10. Emit
// ─────────────────────────────────────────────────────────────────────────────

for (const r of final) r.jurisdictions.sort((a, b) => ORDER.indexOf(a.jurisdiction) - ORDER.indexOf(b.jurisdiction));

const strip = ({ _prov, _kind, _keys, _saf, _color, _review, ...i }: Row): Ingredient => i;
const ingredients = final.map(strip).sort((a, b) => a.id.localeCompare(b.id));
const provenance = Object.fromEntries(final.map((r) => [r.id, { kind: r._kind, review: r._review, fields: r._prov }]));

const count = (f: (i: Ingredient) => boolean) => ingredients.filter(f).length;
report.counts = {
  ingredients: ingredients.length,
  by_kind: Object.fromEntries(Object.keys(KIND_RANK).map((k) => [k, final.filter((r) => r._kind === k).length])),
  everyday_allowlist: count((i) => i.everyday_allowlist),
  with_cas: count((i) => !!i.cas_number),
  with_e_number: count((i) => !!i.e_number_ins_code),
  with_formula: count((i) => !!i.chemical_formula),
  us_cfr_citation: count((i) => i.jurisdictions.some((j) => j.jurisdiction === 'US_FDA' && j.citation?.startsWith('21 CFR'))),
  us_any: count((i) => i.jurisdictions.some((j) => j.jurisdiction === 'US_FDA')),
  eu: count((i) => i.jurisdictions.some((j) => j.jurisdiction === 'EU_EFSA')),
  codex: count((i) => i.jurisdictions.some((j) => j.jurisdiction === 'CODEX')),
  hk: count((i) => i.jurisdictions.some((j) => j.jurisdiction === 'HK_CFS')),
  no_jurisdiction_flaggable: count((i) => !i.everyday_allowlist && i.jurisdictions.length === 0),
  usage_context: count((i) => !!i.usage_context),
  usage_context_efsa: final.filter((r) => r._prov.some((p) => p.field === 'usage_context.threshold_of_concern' && p.source === 'efsa_openfoodtox')).length,
  allergen_flagged: count((i) => i.allergen_flags.length > 0),
  citations_rejected: report.citations_rejected.length,
  needs_review: final.filter((r) => r._review.length).length,
};
report.no_jurisdiction = ingredients.filter((i) => !i.everyday_allowlist && i.jurisdictions.length === 0).map((i) => i.canonical_name);
report.codex_status = manifest.codex_ins?.present?.length ? 'present but not yet parsed' : 'NOT PRESENT — manual download required (see sources.mjs)';

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'ingredients.json'), JSON.stringify(ingredients, null, 1) + '\n');
// One ingredient per line, so a new release reads as a diff of the rows that
// changed rather than one rewritten 9 MB line.
writeFileSync(join(OUT, 'provenance.json'), '{\n' + Object.entries(provenance).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
writeFileSync(join(OUT, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');

console.log(JSON.stringify(report.counts, null, 2));
