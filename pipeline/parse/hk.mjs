/**
 * Hong Kong CFS — the Cap. 132 food additive regulations (§13: "small enough
 * in scope … to hand a single document to an extraction pass directly").
 *
 * They are also small enough to parse outright, which is better: nothing here
 * is inferred. Preservatives and antioxidants are keyed by INS number, which is
 * the same key the rest of the database merges on (§11 `e_number_ins_code`).
 */
import { readFileSync } from 'node:fs';
import { plain } from '../lib/text.mjs';

const read = (path) => readFileSync(path, 'utf8');

function scheduleRows(xml, name) {
  const m = xml.match(new RegExp(`<schedule[^>]*name="${name}"[^>]*>([\\s\\S]*?)</schedule>`));
  if (!m) return [];
  return [...m[1].matchAll(/<(?:xhtml:)?tr[^>]*>([\s\S]*?)<\/(?:xhtml:)?tr>/g)].map((r) =>
    [...r[1].matchAll(/<(?:xhtml:)?td[^>]*>([\s\S]*?)<\/(?:xhtml:)?td>/g)].map((c) => plain(c[1])),
  );
}

const url = (cap) => `https://www.elegislation.gov.hk/hk/cap${cap}!en`;
const INS = /^(\d{3,4}[a-z]?(?:\([ivx]+\))?)$/;

export function parseHk(dir) {
  const entries = [];

  // ─── Cap. 132BD — preservatives and antioxidants, by INS number ───
  const bd = read(`${dir}/cap132BD.xml`);
  const seen = new Set();
  const addBd = (ins, name, excerpt) => {
    const key = `${ins}|${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({
      cap: '132BD', ins, name, category_hint: null,
      status: 'Permitted preservative or antioxidant; maximum levels set by food category',
      citation: 'Cap. 132BD, Schedule 1', citation_url: url('132BD'), excerpt,
    });
  };
  // Schedule 1A: "Sorbic acid (200) Sodium sorbate (201) …" per additive group.
  for (const row of scheduleRows(bd, 'sch1A')) {
    const members = row[2] ?? '';
    for (const m of members.matchAll(/([^()]+?(?:\([^()0-9]*\)[^()]*?)?)\s\((\d{3,4}[a-z]?(?:\([ivx]+\))?|–)\)/g)) {
      const name = m[1].trim();
      if (m[2] !== '–' && name) addBd(m[2], name, `Cap. 132BD Schedule 1A, ${row[1]}: ${name} (${m[2]})`);
    }
  }
  // Schedule 1: single additives listed directly against a food category.
  for (const row of scheduleRows(bd, 'sch1')) {
    if (row.length < 4) continue;
    const ins = row[row.length - 4];
    const name = row[row.length - 3];
    if (INS.test(ins ?? '') && name) addBd(ins, name, `Cap. 132BD Schedule 1: ${ins} ${name}`);
  }

  // ─── Cap. 132U — permitted sweeteners, by name ───
  const u = read(`${dir}/cap132U.xml`);
  const uSched = plain(u.match(/<schedule[^>]*>([\s\S]*?)<\/schedule>/)?.[1] ?? '');
  for (const m of uSched.matchAll(/(\d+)\.\s+([^(]+?)(?=\s*\(|\s+\d+\.\s|$)/g)) {
    const name = m[2].trim();
    if (!name || /^Permitted/i.test(name)) continue;
    entries.push({
      cap: '132U', ins: null, name, category_hint: 'sweetener',
      status: 'Permitted sweetener',
      citation: 'Cap. 132U, Schedule', citation_url: url('132U'),
      excerpt: `Cap. 132U Schedule (Permitted Sweeteners), item ${m[1]}: ${name}`,
    });
  }

  // ─── Cap. 132H — permitted colouring matter, by name and Colour Index ───
  const h = read(`${dir}/cap132H.xml`);
  const hRows = scheduleRows(h, 'sch1');
  for (const row of hRows) {
    const cells = row.filter(Boolean);
    if (cells.length < 2) continue;
    const name = cells[0].replace(/^\([a-z]\)\s*/, '');
    const ci = cells[cells.length - 1].match(/^(\d{5})$/)?.[1] ?? null;
    if (/^(Common Name|Description)/i.test(name) || name.length > 80) continue;
    entries.push({
      cap: '132H', ins: null, name, colour_index: ci, category_hint: 'colorant',
      status: 'Permitted colouring matter',
      citation: 'Cap. 132H, First Schedule', citation_url: url('132H'),
      excerpt: `Cap. 132H First Schedule: ${cells.join(' — ')}`,
    });
  }

  return { entries };
}
