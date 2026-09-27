/**
 * Ingredient parsing, matching and flagging — build-order step 3.
 *
 * WHERE THIS BELONGS EVENTUALLY: §7 says fuzzy matching "runs server-side as a
 * Postgres function using pg_trgm, not shipped to the client". It runs here
 * because step 3 has no backend. Everything below is deliberately confined to
 * this one module and returns the same `ResolvedScan` every screen already
 * reads, so moving it to Postgres later is a swap of this file, not a rewrite.
 *
 * §3's flagging rule, implemented literally:
 *   flagged = matched in the database AND NOT on the everyday allow-list.
 * §3 also says "config this, don't hardcode" — so the rule reads the data
 * (`everyday_allowlist`) and nothing here enumerates ingredients.
 */

import { Ingredient } from '../types/ingredient';
import { LabelRun, Product, ResolvedScan, ScanMethod } from '../types/scan';

/**
 * Label boilerplate that is not an ingredient. Without this, "CONTAINS 2% OR
 * LESS OF" is reported to the user as an ingredient we have no entry for,
 * which reads as a coverage gap when it is nothing of the kind.
 *
 * Config, not logic: add a phrase, change behaviour.
 */
export const LABEL_BOILERPLATE: string[] = [
  'contains',
  'contains 2% or less of',
  'contains less than 2% of',
  'less than 2% of',
  '2% or less of',
  'and/or',
  'may contain',
  'may contain traces of',
  'vitamins and minerals',
  'vitamins',
  'minerals',
  'added to preserve freshness',
  'to preserve freshness',
  'preserved with',
  'for color',
  'for colour',
  'color added',
  'colour added',
  'as a preservative',
  'as preservatives',
  'an anticaking agent',
  'anticaking agent',
  'to prevent caking',
  'emulsifier',
  'emulsifiers',
  'stabilizer',
  'stabiliser',
  'thickener',
  'preservative',
  'antioxidant',
  'acidity regulator',
  'raising agent',
  'ingredients',
  'organic',
  'each of the following',
  'one or more of the following',
];

/** Lowercase, collapse whitespace, normalise dash and quote variants. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface IndexEntry {
  needle: string;
  ingredient: Ingredient;
}

/**
 * Every name an ingredient can appear under, longest first so that
 * "whole grain oats" claims the text before "oats" can, and "soy lecithin"
 * before "lecithin".
 */
export function buildIndex(catalog: Ingredient[]): IndexEntry[] {
  const entries: IndexEntry[] = [];
  for (const ingredient of catalog) {
    const names = new Set<string>();
    for (const name of [ingredient.canonical_name, ...ingredient.aka]) {
      const n = normalize(name);
      if (!n) continue;
      names.add(n);
      // Labels pluralise freely — Nutella prints "lecithins", not "lecithin".
      if (!n.endsWith('s')) names.add(`${n}s`);
      if (n.endsWith('y')) names.add(`${n.slice(0, -1)}ies`);
    }
    for (const needle of names) entries.push({ needle, ingredient });
  }
  entries.sort((a, b) => b.needle.length - a.needle.length);
  return entries;
}

const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);

interface Claim {
  start: number;
  end: number;
  ingredient: Ingredient | null;
}

/**
 * Split the printed list into the spans a human would read as one ingredient.
 *
 * Depth-aware, because commas inside parentheses do not separate ingredients:
 * "calcium phosphate (mono-, di-, and tribasic)" is ONE ingredient, and
 * splitting naively on commas would invent three.
 */
function printedSpans(raw: string): Array<{ start: number; end: number; text: string }> {
  const spans: Array<{ start: number; end: number; text: string }> = [];
  let depth = 0;
  let start = 0;

  const push = (from: number, to: number) => {
    const text = raw.slice(from, to);
    const lead = text.length - text.trimStart().length;
    const trail = text.length - text.trimEnd().length;
    const s = from + lead;
    const e = to - trail;
    if (e > s) spans.push({ start: s, end: e, text: raw.slice(s, e) });
  };

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (c === ',' || c === ';' || c === '.')) {
      push(start, i);
      start = i + 1;
    }
  }
  push(start, raw.length);
  return spans;
}

/** Is this span label furniture rather than an ingredient? */
function isBoilerplate(text: string): boolean {
  const n = normalize(text).replace(/[:.]+$/, '');
  if (!n) return true;
  // Nothing but punctuation, digits or percentages.
  if (!/[a-z]{3}/.test(n)) return true;
  return LABEL_BOILERPLATE.some((b) => n === b || n.startsWith(`${b} `) || n.endsWith(` ${b}`));
}

export interface MatchResult {
  runs: LabelRun[];
  ingredients: Ingredient[];
  unmatched_names: string[];
  /** Distinct ingredients detected, matched or not — the summary strip's total. */
  ingredient_count: number;
  flagged_count: number;
}

export function matchLabel(raw: string, catalog: Ingredient[]): MatchResult {
  const index = buildIndex(catalog);
  const haystack = normalize(raw);

  // normalize() only changes characters in place (case, dash and quote
  // variants, whitespace runs). Whitespace collapsing can shift offsets, so
  // guard the assumption rather than silently mis-highlighting the label.
  const offsetsAligned = haystack.length === raw.length;
  const search = offsetsAligned ? haystack : raw.toLowerCase();

  const claims: Claim[] = [];
  const overlaps = (start: number, end: number) =>
    claims.some((c) => start < c.end && end > c.start);

  for (const { needle, ingredient } of index) {
    let from = 0;
    for (;;) {
      const at = search.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      if (
        !isWordChar(search[at - 1]) &&
        !isWordChar(search[end]) &&
        !overlaps(at, end)
      ) {
        claims.push({ start: at, end, ingredient });
      }
      from = at + 1;
    }
  }

  // Printed names nothing claimed become explicit unmatched spans, so the
  // Label screen can own up to the gap in place (§9) instead of hiding it.
  const spans = printedSpans(raw).filter((sp) => !isBoilerplate(sp.text));
  const unmatched_names: string[] = [];
  for (const span of spans) {
    if (overlaps(span.start, span.end)) continue;
    claims.push({ start: span.start, end: span.end, ingredient: null });
    unmatched_names.push(span.text);
  }

  claims.sort((a, b) => a.start - b.start);

  const runs: LabelRun[] = [];
  let cursor = 0;
  for (const c of claims) {
    if (c.start > cursor) {
      runs.push({ text: raw.slice(cursor, c.start), ingredient_id: null, flagged: false, unmatched: false });
    }
    runs.push({
      text: raw.slice(c.start, c.end),
      ingredient_id: c.ingredient?.id ?? null,
      // ═══ §3's rule, and the only place it is expressed ═══
      flagged: c.ingredient ? !c.ingredient.everyday_allowlist : false,
      unmatched: c.ingredient === null,
    });
    cursor = c.end;
  }
  if (cursor < raw.length) {
    runs.push({ text: raw.slice(cursor), ingredient_id: null, flagged: false, unmatched: false });
  }

  const matched = Array.from(
    new Set(claims.map((c) => c.ingredient).filter((i): i is Ingredient => i !== null)),
  );

  // ═══ COUNT WHAT THE LABEL PRINTS, NOT WHAT WE MATCHED ═══
  // A label glosses one ingredient with two names — "Vitamin C (sodium
  // ascorbate)" — and both halves match a record. Counting records would call
  // that two ingredients when every human reading the package counts one. So
  // the counts are per printed entry: a comma-separated span is one
  // ingredient, and it is flagged if anything inside it is flagged.
  const flaggedRuns = runs.filter((r) => r.flagged);
  const flagged_count = spans.filter((sp) =>
    flaggedRuns.some((r) => {
      const at = raw.indexOf(r.text, sp.start);
      return at !== -1 && at < sp.end;
    }),
  ).length;

  return {
    runs,
    ingredients: matched,
    unmatched_names,
    ingredient_count: spans.length,
    flagged_count,
  };
}

/** Assemble §7's one-response `ResolvedScan` for a product. */
export function resolveScan(
  product: Product,
  catalog: Ingredient[],
  method: ScanMethod = 'barcode',
): ResolvedScan {
  const m = matchLabel(product.raw_ingredient_text, catalog);
  return {
    scan_id: `scan_${product.barcode ?? product.id}_${Date.now()}`,
    scanned_at: new Date().toISOString(),
    method,
    product,
    runs: m.runs,
    ingredients: m.ingredients,
    ingredient_count: m.ingredient_count,
    flagged_count: m.flagged_count,
    unmatched_names: m.unmatched_names,
  };
}
