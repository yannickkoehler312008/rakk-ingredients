/**
 * The two smaller FDA exports: the GRAS Notice Inventory and the Color
 * Additive Status List. Same export format as Substances Added to Food.
 */
import { readFileSync } from 'node:fs';
import { decodeEntities, parseCsv, plain, stripTags, unT, validCas } from '../lib/text.mjs';

function load(path, headerPrefix) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith(headerPrefix));
  const rows = parseCsv(lines.slice(start).join('\n'));
  const header = rows[0];
  return {
    updated: lines.slice(0, start).join(' ').match(/Last updated ([0-9/]+)/)?.[1] ?? null,
    rows: rows.slice(1).filter((r) => r.length > 3).map((r) => {
      const o = {};
      header.forEach((h, i) => { o[h.trim()] = unT(r[i] ?? '').trim(); });
      o.__excerpt = header.map((h, i) => (r[i] ?? '').trim() && `${h.trim()}: ${unT(r[i]).trim()}`).filter(Boolean).join(' | ');
      return o;
    }),
  };
}

/**
 * GRAS notices. Only a closed notice with FDA's "no questions" response says
 * anything about status; a notice FDA ceased to evaluate, or one that did not
 * provide a basis, is recorded but never becomes a status entry.
 */
export function parseGrasNotices(path) {
  const { updated, rows } = load(path, 'GRAS Notice');
  const notices = rows.map((o) => {
    const letter = plain(o["FDA's Letter"]).replace(/\s*\(in PDF\)\s*/gi, '').trim();
    const substance = plain(o.Substance);
    return {
      grn: o['GRAS Notice (GRN) No.'],
      substance,
      intended_use: plain(o['Intended Use']),
      basis: o.Basis,
      closed: o['Date of closure'] || null,
      response: letter,
      no_questions: /^FDA has no questions/i.test(letter) && !/does not provide a basis/i.test(letter),
      excerpt: plain(o.__excerpt),
    };
  });
  return { updated, notices };
}

const USE = { foods: 'food', drugs: 'pharmaceutical', cosmetics: 'cosmetics' };

export function parseColorAdditives(path) {
  const { updated, rows } = load(path, 'CAS Reg No');
  const colors = rows.map((o) => {
    const regs = Object.keys(o)
      .filter((k) => /^Regnum/.test(k) && o[k])
      .flatMap((k) => [...o[k].matchAll(/(\d{1,3})\.(\d{1,5})/g)].map((m) => ({ section: `${m[1]}.${m[2]}`, color: k.startsWith('RegnumCA') })));
    const otherNames = decodeEntities(o['Other names'] ?? '')
      .split(/<br\s*\/?>/i)
      .map((s) => stripTags(s).replace(/^[\s♦]+/, '').trim())
      .filter(Boolean);
    const e = (o['EEC No'] || '').replace(/\s+/g, '');
    return {
      fda_id: o['CAS Reg No or other ID code'],
      cas: validCas(o['CAS Reg No or other ID code']),
      name: plain(o.Color),
      e_number: /^E\d/.test(e) ? e : null,
      status: plain(o.Status),
      uses: (o.Use || '').split(',').map((u) => USE[u.trim().toLowerCase()]).filter(Boolean),
      food_use: /\bfoods?\b/i.test(o.Use || '') && !/^delisted/i.test(o.Status || ''),
      restrictions: plain(o.RESTRICTIONS || ''),
      other_names: otherNames,
      colour_index: otherNames.map((n) => n.match(/^C\.I\. (\d{5})$/)?.[1]).filter(Boolean),
      regs,
      excerpt: plain(o.__excerpt).slice(0, 1500),
    };
  });
  return { updated, colors };
}
