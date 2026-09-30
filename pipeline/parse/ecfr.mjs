/**
 * 21 CFR, parsed into sections (§13: "the actual legal text behind Substances
 * Added to Food").
 *
 * Each section keeps its paragraphs individually, labelled "(a)", "(b)" …, so
 * that any fact taken from it can cite the exact paragraph — not just the
 * section — and the verification pass can re-read that paragraph.
 */
import { readFileSync } from 'node:fs';
import { decodeEntities, nameKey, plain } from '../lib/text.mjs';

function parseParts(xml, into) {
  for (const part of xml.matchAll(/<DIV5 N="(\d+)"[^>]*>([\s\S]*?)<\/DIV5>/g)) {
    const partTitle = plain(part[2].match(/<HEAD>([\s\S]*?)<\/HEAD>/)?.[1] ?? '');
    parseSections(part[2], part[1], partTitle, into);
  }
}

function parseSections(xml, partNo, partTitle, into) {
  for (const sec of xml.matchAll(/<DIV8 N="([\d.]+)"[^>]*TYPE="SECTION"[^>]*>([\s\S]*?)<\/DIV8>/g)) {
    into.set(sec[1], parseSection(sec[1], sec[2], partNo ?? sec[1].split('.')[0], partTitle ?? null));
  }
}

/** One <DIV8> section body → paragraphs, list entries, identity. */
export function parseSection(section, body, partNo, partTitle) {
      const heading = plain(body.match(/<HEAD>([\s\S]*?)<\/HEAD>/)?.[1] ?? '');
      const subject = heading.replace(/^§\s*[\d.]+\s*/, '').replace(/\.$/, '').trim();

      const paragraphs = [];
      // List sections (172.515) put each substance in its own <FP-1>/<FP-2>.
      for (const p of body.matchAll(/<(P|FP(?:-\d+)?)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
        const text = plain(p[2]);
        if (!text) continue;
        const label = text.match(/^((?:\([a-z0-9]+\)\s*)+)/i)?.[1].replace(/\s+/g, '') ?? null;
        // FP lines are list entries (one substance each); P are prose.
        paragraphs.push({ label, text, list_entry: p[1] !== 'P' });
      }

      const tableRows = [];
      // GPO tables (<ROW>/<ENT>) and HTML-style tables (<TR>/<TD>, as in the
      // 182.10 spice and 182.20 essential-oil lists) both occur.
      for (const row of body.matchAll(/<(ROW|TR)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
        const cells = [...row[2].matchAll(/<(ENT|TD|TH)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((c) => plain(c[2]));
        if (cells.some(Boolean)) tableRows.push(cells);
      }

      return {
        section,
        part: partNo,
        part_title: partTitle,
        heading,
        subject,
        reserved: /\[Reserved\]/i.test(heading),
        paragraphs,
        table_rows: tableRows,
        // Everything the section says, for "does this section name X?" checks.
        text: decodeEntities(plain(body)).toLowerCase(),
        // What the section is ABOUT: its heading and all of paragraph (a),
        // sub-items included (§ 184.1950's (a) only says "added to food as the
        // following"; the ingredients are (a)(1)–(3)).
        identity: expandSalts(decodeEntities(`${heading} ${identityText(paragraphs)}`).toLowerCase()),
        // What the section LISTS, one substance per entry.
        entries: [
          ...paragraphs.filter((p) => p.list_entry).map((p) => p.text),
          ...tableRows.map((r) => r.join(' ')),
        ].map((e) => decodeEntities(e).toLowerCase()),
      };
}

/**
 * The CFR writes a family of salts once: "calcium phosphate (mono-, di-, and
 * tribasic)". Labels print "monocalcium phosphate" or "dicalcium phosphate".
 * Spell out each member so a name can be found — this reads the regulation's
 * own notation, it does not widen what counts as a match.
 */
function expandSalts(text) {
  const extra = [];
  for (const m of text.matchAll(/\b([a-z]+) ([a-z]+) \(((?:mono|di|tri)-?,? ?(?:(?:mono|di|tri)-?,? ?)*(?:and )?(?:mono|di|tri)basic)\)/g)) {
    const [, cation, anion, spec] = m;
    for (const p of ['mono', 'di', 'tri'].filter((x) => spec.includes(x))) {
      extra.push(`${p}${cation} ${anion}`, `${cation} ${anion}, ${p}basic`, `${p}basic ${cation} ${anion}`);
    }
  }
  return extra.length ? `${text} ${extra.join('; ')}` : text;
}

function identityText(paragraphs) {
  const prose = paragraphs.filter((p) => !p.list_entry);
  const a = prose.findIndex((p) => p.label?.startsWith('(a)'));
  if (a < 0) return prose[0]?.text ?? '';
  const b = prose.findIndex((p, i) => i > a && /^\([b-z]\)/.test(p.label ?? ''));
  return prose.slice(a, b < 0 ? undefined : b).map((p) => p.text).join(' ');
}

export function parseEcfr(paths) {
  const sections = new Map();
  for (const p of paths) parseParts(readFileSync(p, 'utf8'), sections);
  return sections;
}

/** A single section as the eCFR API returns it (a bare <DIV8>). */
export function parseSectionXml(xml) {
  const m = xml.match(/<DIV8 N="([\d.]+)"[^>]*>([\s\S]*?)<\/DIV8>/);
  return m ? parseSection(m[1], m[2], m[1].split('.')[0], null) : null;
}

const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', κ: 'kappa', λ: 'lambda', ω: 'omega', ψ: 'psi' };
export const deGreek = (s) => s.replace(/[αβγδεκλωψ]/g, (c) => GREEK[c]);

/** Name forms worth looking for in regulation text. */
export function nameVariants(n) {
  const base = deGreek(decodeEntities(n)).replace(/--\s*NLFG\s*$/i, '').trim();
  const noParen = base.replace(/\s*\([^)]*\)/g, '').trim();
  const out = [base, noParen];
  // Inventory names are often inverted: "ALGAE, BROWN, EXTRACT".
  if (noParen.includes(', ')) {
    const parts = noParen.split(', ');
    out.push([...parts.slice(1).reverse(), parts[0]].join(' '));
    out.push(parts.slice(1).concat(parts[0]).join(' '));
  }
  return [...new Set(out)].filter(Boolean);
}

const NOT_DISTINCTIVE = new Set(['extract', 'extracts', 'tincture', 'fluid', 'oleoresin', 'natural', 'spp.', 'preparation', 'enzyme', 'from']);

/**
 * Does this section LIST the substance? (PHASE-2-HANDOFF §3.1–3.2)
 *
 * Being mentioned is not being listed. § 73.85 (caramel) mentions potassium
 * phosphate as a reactant; § 184.1434 (magnesium phosphate) mentions
 * potassium. Citing either for potassium phosphate would be the plausible,
 * checkable, wrong citation §3.1 warns about. So a name must be:
 *   - the section's subject, or in its identity (heading + paragraph (a)), or
 *   - one entry of a list section (172.515's lines, 182.20's table rows), or
 *   - a term the section defines ("The term natural flavor … means").
 */
export function listsSubstance(sec, names) {
  if (!sec) return { ok: false, reason: 'section does not exist in current eCFR' };
  if (sec.reserved) return { ok: false, reason: 'section is [Reserved]' };
  const units = [sec.identity, ...sec.entries].map(deGreek);
  const subject = nameKey(deGreek(sec.subject));
  const body = deGreek(sec.text);
  for (const n of names) {
    for (const v of nameVariants(n)) {
      const k = nameKey(v);
      // A short name ("BHA") counts only as the whole heading subject.
      if (k === subject) return { ok: true, reason: 'is the section subject', matched: n };
      if (k.length > 3 && units.some((u) => u.includes(k))) return { ok: true, reason: 'named', matched: n };
      if (k.length > 3 && body.includes(`the term ${k} `)) return { ok: true, reason: 'defined term', matched: n };
    }
  }
  // Headings interpolate ("Locust (carob) bean gum"): accept when every
  // distinctive word of a name is inside one unit.
  for (const n of names) {
    const words = nameKey(nameVariants(n)[1] ?? n).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !NOT_DISTINCTIVE.has(w));
    if (words.length > 1 && units.some((u) => words.every((w) => u.includes(w)))) return { ok: true, reason: 'all name words in one unit', matched: n };
  }
  return { ok: false, reason: 'section does not list the substance (mentioned at most)' };
}

export const ecfrUrl = (section) => `https://www.ecfr.gov/current/title-21/section-${section}`;
