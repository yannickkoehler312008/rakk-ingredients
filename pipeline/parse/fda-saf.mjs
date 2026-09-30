/**
 * FDA Substances Added to Food — the authoritative US inventory (§12.B).
 *
 * One record per substance, carrying everything the export states and nothing
 * it does not. The raw CSV line is kept on each record as `excerpt`: §13 wants
 * every field traceable to the exact source text it came from.
 */
import { readFileSync } from 'node:fs';
import { decodeEntities, parseCsv, sentenceCase, stripTags, unT, validCas } from '../lib/text.mjs';

/** Which FDA regulation columns mean what. */
const REG_KIND = (col) => {
  if (col === 'Reg prohibited189') return 'prohibited';
  if (col.startsWith('regs Labeling')) return 'labeling_or_standard';
  if (col === 'Reg Administrative') return 'administrative';
  if (col.startsWith('Reg col')) return 'color';
  return 'additive';
};

export function parseFdaSaf(path) {
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('CAS Reg No'));
  const preamble = lines.slice(0, start).join('\n');
  const rows = parseCsv(lines.slice(start).join('\n'));
  const header = rows[0];
  const col = (name) => header.indexOf(name);

  const records = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 5) continue;
    const get = (name) => (row[col(name)] ?? '').trim();

    const rawName = decodeEntities(get('Substance')).trim();
    // "--NLFG" marks a flavouring that is No Longer FEMA GRAS.
    const nlfg = /--\s*NLFG\s*$/i.test(rawName);
    const upperName = rawName.replace(/--\s*NLFG\s*$/i, '').trim();

    const otherNames = decodeEntities(get('Other Names'))
      .split(/<br\s*\/?>/i)
      .map((s) => stripTags(s).replace(/^[\s♦]+/, '').trim())
      .filter(Boolean);

    const effects = stripTags(get('Used for (Technical Effect)').replace(/<br\s*\/?>/gi, '\n'))
      .split('\n')
      .map((s) => s.replace(/,\s*$/, '').trim())
      .filter(Boolean);

    const regs = [];
    header.forEach((h, i) => {
      if (!/^reg/i.test(h)) return;
      const cell = unT(row[i] ?? '');
      for (const m of cell.matchAll(/(\d{1,3})\.(\d{1,5})/g)) {
        regs.push({ section: `${m[1]}.${m[2]}`, kind: REG_KIND(h) });
      }
    });

    records.push({
      fda_id: get('CAS Reg No (or other ID)'),
      cas: validCas(get('CAS Reg No (or other ID)')),
      name_upper: upperName,
      name: sentenceCase(upperName),
      other_names: otherNames,
      effects,
      regs,
      nlfg,
      fema_no: unT(get('FEMA No')) || null,
      gras_pub_no: unT(get('GRAS Pub No')) || null,
      fema_status: get('FEMA status') || null,
      jecfa_flavor_no: unT(get('JECFA Flavor Number')) || null,
      // The export's own fields, verbatim, in column order.
      excerpt: header.map((h, i) => (row[i] ?? '').trim() && `${h}: ${unT(row[i]).trim()}`).filter(Boolean).join(' | '),
    });
  }

  const updated = preamble.match(/Last updated ([0-9/]+)/)?.[1] ?? null;
  return { updated, disclaimer: preamble.match(/"([^"]+)"/)?.[1] ?? null, records };
}
