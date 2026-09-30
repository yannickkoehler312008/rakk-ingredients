/**
 * EU — Regulation (EC) No 1333/2008, Annex II Part B: the list of every
 * authorised food additive by E-number (§13).
 *
 * Footnotes are carried through, because they can reverse the headline: E 171
 * (titanium dioxide) is still in Part B, with a note that it "is not authorised
 * in the food categories listed in Part D and E" — i.e. it is kept on the list
 * for medicines only. Reading the row without its note would report the
 * opposite of the law.
 */
import { readFileSync } from 'node:fs';
import { plain } from '../lib/text.mjs';

const GROUP = { 1: 'colorant', 2: 'sweetener', 3: null };

export function parseEu1333(path, celex) {
  const x = readFileSync(path, 'utf8');
  const start = x.indexOf('LIST OF ALL ADDITIVES');
  const end = x.indexOf('PART C', start);
  if (start < 0 || end < 0) throw new Error('Annex II Part B not found — has the consolidated text changed shape?');
  const seg = x.slice(start, end);

  // Split Part B into its three lists so each row knows its group, and so a
  // footnote "(1)" resolves within its own list — each list numbers its notes
  // from 1, and the colours' "(1)" is about caramel, not benzoates.
  const heads = [...seg.matchAll(/<p class="title-gr-seq-level-3"[^>]*>\s*(\d)\./g)];
  const additives = [];
  const notesByGroup = {};
  heads.forEach((h, n) => {
    const group = Number(h[1]);
    const chunk = seg.slice(h.index, heads[n + 1]?.index ?? seg.length);
    for (const tr of chunk.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => plain(c[1])).filter(Boolean);
      if (!cells.length) continue;
      const e = cells[0].match(/^E\s?(\d{3,4}[a-z]?(?:\s?\([ivx]+\))?)$/i);
      if (e && cells[1]) {
        const rawName = cells[1];
        // Footnote markers trail the name; "(40)" inside "Polyoxyethylene (40)
        // stearate" is part of the name and must survive.
        const trailing = rawName.match(/(?:\s*\(\s*\*?\d+\s*\))+\s*$/)?.[0] ?? '';
        const markers = [...trailing.matchAll(/\(\s*(\*?\d+)\s*\)/g)].map((m) => m[1]);
        additives.push({
          e_number: `E${e[1].replace(/\s+/g, '')}`,
          name: rawName.slice(0, rawName.length - trailing.length).replace(/[►◄▼]\w*/g, '').replace(/\s+/g, ' ').trim(),
          group,
          category_hint: GROUP[group] ?? null,
          note_markers: markers,
          excerpt: `Annex II Part B, list ${group}: ${cells[0]} — ${rawName}`,
        });
      } else if (/^\(\s*\*?\d+\s*\)/.test(cells[0])) {
        notesByGroup[group] = (notesByGroup[group] ?? '') + ' ' + cells.join(' ');
      }
    }
  });
  if (heads.length !== 3) throw new Error(`expected 3 lists in Annex II Part B, found ${heads.length}`);

  // Resolve each footnote marker to its text within the same list.
  for (const a of additives) {
    a.notes = a.note_markers
      .map((m) => {
        const text = notesByGroup[a.group] ?? '';
        const re = new RegExp(`\\(\\s*${m.replace('*', '\\*')}\\s*\\)\\s*([\\s\\S]*?)(?=\\(\\s*\\*?\\d+\\s*\\)|$)`);
        return text.match(re)?.[1].replace(/[►◄▼]\w*/g, '').replace(/\s+/g, ' ').trim() ?? null;
      })
      .filter(Boolean);
    a.food_use_excluded = a.notes.some((n) => /is not authorised in the food categories listed in Part D and E/i.test(n));
  }

  return { celex, additives };
}

export const EU_REG_URL = 'https://eur-lex.europa.eu/eli/reg/2008/1333/oj';
