/** Text helpers shared by every parser. No dependencies, on purpose. */

const NAMED = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', diams: '♦', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', deg: '°', micro: 'µ', reg: '®', trade: '™', eacute: 'é', egrave: 'è', ouml: 'ö', uuml: 'ü', auml: 'ä', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', omega: 'ω', middot: '·', ge: '≥', le: '≤', plusmn: '±', times: '×', frac12: '½', frac14: '¼', sup2: '²', sup3: '³', shy: '' };

/**
 * XML and HTML sources carry escaped entities: eCFR sends "FD&amp;C Red No. 40".
 * PHASE-2-HANDOFF §3.2 — matching raw failed every ampersand-bearing colour.
 */
export function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

// Real tags only: a literal "< 0.5% alcohol" in a notice is text, not markup.
export const stripTags = (s) => s.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');

/** Markup → one line of readable text. */
export const plain = (s) => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

/**
 * The lookup key for a name. Deliberately the same transformation as
 * `normalize()` in rakk-app/src/services/matcher.ts, so a key built here is a
 * key the matcher will produce from a label.
 */
export function nameKey(s) {
  return s
    .toLowerCase()
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A looser key used ONLY to join sources to each other ("Sodium benzoate" in
 * the EU annex ↔ "SODIUM BENZOATE" at the FDA). British/US spelling and
 * punctuation differences are folded; nothing is fuzzy.
 */
export function joinKey(s) {
  return nameKey(decodeEntities(s))
    .replace(/sulph/g, 'sulf')
    .replace(/aluminium/g, 'aluminum')
    .replace(/colour/g, 'color')
    .replace(/flavour/g, 'flavor')
    .replace(/caesium/g, 'cesium')
    .replace(/oe/g, 'e')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A real CAS Registry Number, check digit and all. FDA's 977… IDs are not. */
export function validCas(raw) {
  const s = (raw ?? '').trim();
  const m = s.match(/^(\d{2,7})-(\d{2})-(\d)$/);
  if (!m) return null;
  const digits = (m[1] + m[2]).split('').reverse();
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0);
  if (sum % 10 !== Number(m[3])) return null;
  // FDA assigns 977xxx-xx-x "other ID" numbers that happen to look like CAS.
  if (/^97[0-9]{4}-/.test(s)) return null;
  return s;
}

/**
 * FDA writes substance names in capitals ("SODIUM BENZOATE"). Sentence-case
 * them for display without mangling chemistry: locants and stereo prefixes
 * (L-, DL-, N,N-), colour designations (FD&C), roman numerals and element
 * symbols in formulas are preserved.
 */
const KEEP_UPPER = new Set(['fd&c', 'd&c', 'ext.', 'ii', 'iii', 'iv', 'vi', 'dna', 'rna', 'usp', 'nf', 'bht', 'bha', 'tbhq', 'edta', 'msg', 'ph', 'gmp', 'cas', 'pvp', 'peg', 'dha', 'epa', 'ara', 'hmb', 'amp', 'gmp', 'imp', 'ump', 'cmp', 'atp', 'nad', 'fad', 'coa', 'mct', 'dl', 'l', 'd', 'n', 'o', 's', 'e', 'z', 'r', 'p', 'b', 'c', 'k', 'a']);
export function sentenceCase(upper) {
  // Colour designations first, while the pattern is unambiguous:
  // "FD&C RED NO. 40" → "FD&C Red No. 40".
  const lower = upper
    .toLowerCase()
    .replace(/\b(fd&c|d&c|ext\. d&c) ([a-z]+) no\. /g, (_, a, c) => `${a.toUpperCase()} ${c[0].toUpperCase()}${c.slice(1)} No. `);
  const out = lower.replace(/[a-z&.]+/g, (w, at) => {
    const next = lower[at + w.length];
    const before = lower.slice(0, at);
    // Single letters and short tokens are kept upper only as locants/prefixes
    // ("L-", "N,N-", "vitamin B12") — i.e. when glued to a hyphen or comma.
    if (w.length <= 2 && KEEP_UPPER.has(w)) {
      if (next === '-' || next === ',' || next === "'" || /\d/.test(next ?? '') || w === 'ii') return w.toUpperCase();
      if (/vitamin $/.test(before)) return w.toUpperCase();
      return w;
    }
    if (KEEP_UPPER.has(w) && w.length > 2) return w.toUpperCase();
    return w;
  });
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** Minimal RFC 4180 CSV reader (quoted fields, embedded commas/newlines). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** FDA exports wrap codes as Excel formulas: =T("172.515"). */
// The CSV reader consumes the inner quotes, so both =T("172.515") and
// =T(172.515) occur.
export const unT = (s) => (s ?? '').replace(/=T\("?([^")]*)"?\)/g, '$1').trim();
