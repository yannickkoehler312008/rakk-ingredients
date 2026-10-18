/**
 * Hand-made joins — the cases no rule can make, each with its reason.
 *
 * Everything else in the build joins on numbers (CAS, E/INS, Colour Index)
 * or exact names. These are synonyms the sources themselves don't connect.
 * Keep this list short: every entry is a claim a human made, and the reason
 * is what a reviewer checks.
 */

/** Hong Kong regulation names → the row(s) they mean, by E/INS code or "name:<canonical name>". */
export const HK_LINKS = [
  {
    hk: 'Chocolate Brown HT',
    to: ['E155'],
    why: 'Cap. 132H lists "Chocolate Brown HT", Colour Index 20285. That is Brown HT (EU E 155, Codex INS 155), whose Colour Index number is 20285.',
  },
  {
    hk: 'Vegetable Black',
    to: ['E153'],
    why: '"Vegetable black" is the common name of vegetable carbon (EU E 153, Codex INS 153).',
  },
  {
    hk: 'Chlorophylls and Chlorophyllins including Copper complexes',
    to: ['E140', 'E141'],
    why: 'One Cap. 132H entry covers both groups the EU and Codex number separately: chlorophylls and chlorophyllins (140) and their copper complexes (141).',
  },
  {
    hk: 'Ortho-phenylphenol',
    to: ['name:O-phenylphenol'],
    why: '"Ortho-" and "o-" are the same locant; the database row is FDA\'s "O-phenylphenol" (2-phenylphenol). Cap. 132BD gives it INS 231.',
  },
];

/** Extra names for rows built from bulk data. */
export const ALIASES = [
  { id: 'ing_o_phenylphenol', add: ['ortho-phenylphenol'], why: 'Spelling used by HK Cap. 132BD and on labels.' },
];

/**
 * One substance the sources name differently, by exact wording, so the joins
 * that follow (EU by name, then Codex by number) land on one row. Applied to
 * the FDA inventory rows before any other source is joined.
 */
export const SAME_SUBSTANCE = [
  {
    name: 'Polyoxyethylene 40 monostearate',
    also: ['Polyoxyethylene (40) stearate'],
    why: 'FDA (21 CFR 173.340) names it polyoxyethylene 40 monostearate; EU E 431 and Codex INS 431 call the same substance polyoxyethylene (40) stearate.',
  },
];
