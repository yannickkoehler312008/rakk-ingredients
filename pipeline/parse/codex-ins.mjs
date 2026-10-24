/**
 * Codex — CXG 36-1989, "Class names and the International Numbering System
 * for food additives" (2026 edition), Sections 2 and 3.
 *
 * WHAT AN INS NUMBER MEANS — and what it does not. The guideline's own
 * introduction: "Inclusion in the INS does not imply approval by Codex for use
 * as food additives." An INS number is an identifier, like a CAS number with a
 * functional class attached. The CODEX status the app shows is therefore
 * "has INS number N, functional class X", never anything that reads like an
 * authorisation — which is what the EU and HK entries are.
 *
 * The PDF is a ruled table with merged cells: an additive with several
 * functional classes gets one sub-row per class, and its INS number and name
 * are centred across all of them. Text spacing cannot tell a sub-row from a
 * row — both sit 22.7 pt apart. The drawn rules can: a real row boundary is a
 * rule that crosses the INS column; a sub-row boundary starts at the
 * functional-class column. Rows are read from those rules, and the parser
 * fails loudly if any row has no INS number or two of them, rather than
 * guessing.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Column left edges (pt) — Section 3: INS · name · functional class · purpose.
const COL3 = { ins: [80, 180], name: [180, 370], cls: [370, 458], purpose: [458, 1000] };
// Section 2: functional class · definition · technological purposes.
const COL2 = { cls: [80, 205], def: [205, 352], purpose: [352, 1000] };
/** A rule starting left of this x crosses the first column: a real row edge. */
const FIRST_COLUMN_X = 100;
const INS = /^\d{3,4}[a-z]?(?:\([ivx]+\))?$/;

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Horizontal rules on a page that cross the first column: row edges (y). */
function rowEdges(ol, OPS) {
  const edges = new Set();
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  ol.fnArray.forEach((fn, i) => {
    const a = ol.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.constructPath) {
      const [ops, args] = a;
      let k = 0;
      let start = null;
      for (const op of ops) {
        if (op === OPS.moveTo) { start = apply(ctm, args[k], args[k + 1]); k += 2; }
        else if (op === OPS.lineTo) {
          const end = apply(ctm, args[k], args[k + 1]);
          k += 2;
          if (start && Math.abs(end[1] - start[1]) < 0.5 && Math.min(start[0], end[0]) < FIRST_COLUMN_X && Math.abs(end[0] - start[0]) > 20) {
            edges.add(+start[1].toFixed(1));
          }
          start = end;
        } else if (op === OPS.rectangle) k += 4;
        else if (op === OPS.curveTo) k += 6;
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) k += 4;
      }
    }
  });
  return [...edges].sort((x, y) => y - x);
}

async function pagesOf(path) {
  const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((i) => i.str.trim())
      .map((i) => ({ x: i.transform[4], y: +i.transform[5].toFixed(1), s: i.str }));
    items.edges = rowEdges(await page.getOperatorList(), pdfjs.OPS);
    pages.push(items);
  }
  // The document's own date (PDF ModDate, e.g. "D:20260115…") — stable until
  // FAO changes the file, unlike the date the pipeline happens to run.
  const info = (await doc.getMetadata()).info ?? {};
  const d = String(info.ModDate || info.CreationDate || '').match(/D:(\d{4})(\d{2})(\d{2})/);
  pages.documentDate = d ? `${d[1]}-${d[2]}-${d[3]}` : null;
  return pages;
}

/**
 * The table's rows on a page: the text between consecutive row edges. The
 * band above the first edge after the header, if it has text, is the tail of
 * a row the previous page started.
 */
function rowsOf(items, headerY) {
  const edges = items.edges.filter((y) => y < headerY);
  const rows = [];
  for (let k = 0; k + 1 < edges.length; k++) {
    const row = items.filter((i) => i.y < edges[k] && i.y > edges[k + 1]);
    if (row.length) rows.push(row);
  }
  return rows;
}

/** Text of one column of a row, lines top to bottom, pieces left to right. */
function cell(row, [lo, hi]) {
  const lines = new Map();
  for (const it of row) if (it.x >= lo && it.x < hi) {
    if (!lines.has(it.y)) lines.set(it.y, []);
    lines.get(it.y).push(it);
  }
  return [...lines.keys()].sort((a, b) => b - a)
    .map((y) => lines.get(y).sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join(' '))
    .filter(Boolean);
}

const clean = (s) => s.replace(/\s+/g, ' ').replace(/\s+([,.)])/g, '$1').replace(/\(\s+/g, '(').replace(/[’‘]/g, "'").trim();

/** The table header line's y on a page, or null if the page has no table. */
function headerY(items, label) {
  return items.find((i) => i.s.trim() === label)?.y ?? null;
}

export async function parseCodexIns(path) {
  const pages = await pagesOf(path);
  const flat = pages.map((p) => p.map((i) => i.s).join(' '));

  // ─── Section 2: functional classes and their definitions ───
  const classes = [];
  for (let p = 0; p < pages.length; p++) {
    const items = pages[p];
    const hy = headerY(items, 'Definition');
    if (hy === null) continue;
    // The table's last page also opens Section 3; stop at its header.
    const section3 = headerY(items, 'INS No.');
    for (const row of rowsOf(items, hy)) {
      if (section3 !== null && row.some((i) => i.y <= section3)) continue;
      const cls = clean(cell(row, COL2.cls).join(' ')).replace(/^\d+\.\s*/, '');
      const def = clean(cell(row, COL2.def).join(' '));
      if (!cls || !def) continue;
      classes.push({ name: cls, definition: def, purposes: clean(cell(row, COL2.purpose).join(' ')) });
    }
  }
  const classNames = classes.map((c) => c.name).sort((a, b) => b.length - a.length);

  // ─── Section 3: the list in numerical order (stops where Section 4 begins) ───
  const entries = [];
  const problems = [];
  let pending = null; // a row that continues from the previous page
  for (let p = 0; p < pages.length; p++) {
    if (/List in alphabetical order/.test(flat[p]) && /^\s*4\s/.test(flat[p].split('CXG 36-1989)')[1] ?? '')) break;
    const items = pages[p];
    const hy = headerY(items, 'INS No.');
    if (hy === null) continue;
    if (/\b4\s+List in alphabetical order/.test(flat[p])) break;
    const rows = rowsOf(items, hy);
    rows.forEach((row, k) => {
      const ins = cell(row, COL3.ins).filter((s) => INS.test(s));
      if (ins.length === 0) {
        // Only the first block of a page may lack a number: it is the tail of
        // the previous page's last row.
        if (k === 0 && pending) { pending.push(...row); return; }
        problems.push(`page ${p + 1}: a row with no INS number: ${row.map((i) => i.s).join(' ').slice(0, 80)}`);
        return;
      }
      if (ins.length > 1) { problems.push(`page ${p + 1}: one row holds INS ${ins.join(', ')}`); return; }
      const r = [...row];
      r.ins = ins[0];
      r.page = p + 1;
      entries.push(r);
      pending = r;
    });
  }
  if (problems.length) throw new Error(`CXG 36 table did not parse cleanly:\n  ${problems.slice(0, 10).join('\n  ')}`);

  const parsed = entries.map((r) => {
    const name = clean(cell(r, COL3.name).join(' '));
    const clsText = clean(cell(r, COL3.cls).join(' '));
    // Class cells wrap ("Flour treatment / agent"), so classes are read as the
    // known Section 2 names, in the order they appear.
    const found = [];
    let rest = clsText;
    while (rest) {
      const hit = classNames.find((c) => rest.toLowerCase().startsWith(c.toLowerCase()));
      if (!hit) break;
      found.push(hit);
      rest = rest.slice(hit.length).replace(/^[\s,;]+/, '');
    }
    return {
      ins: r.ins,
      name,
      functional_classes: found,
      unparsed_class_text: rest || null,
      purposes: clean(cell(r, COL3.purpose).join(', ')).replace(/,\s*,/g, ','),
      page: r.page,
      excerpt: `CXG 36-1989 Section 3, p. ${r.page}: ${r.ins} | ${name} | ${clsText}`,
    };
  });

  return { classes, entries: parsed, flatText: flat.join(' '), documentDate: pages.documentDate };
}

export const CODEX_URL = 'https://openknowledge.fao.org/handle/20.500.14283/cd8953en';
