/**
 * The source registry — every document the ingredient database is built from.
 *
 * §13: "pull these bulk sources once … rather than scraping search tools
 * substance-by-substance". Each entry here is one bulk document. Nothing in the
 * pipeline reads from anywhere that is not listed here, so this file is also
 * the answer to "where did this row come from?".
 *
 * `terms` records what is known about reuse/redistribution, because §13 asks
 * for that to be confirmed rather than assumed. `confirmed: false` means a
 * human still has to read the licence before launch.
 */

export const ECFR_PARTS_SUBCHAPTER_A = ['73', '74', '81', '82'];

export const SOURCES = [
  {
    id: 'fda_saf',
    title: 'FDA Substances Added to Food inventory (formerly EAFUS) — full export',
    url: 'https://hfpappexternal.fda.gov/scripts/fdcc/cfc/XMLService.cfm?method=downloadxls&set=FoodSubstances',
    file: 'fda_saf.csv',
    publisher: 'US Food and Drug Administration',
    terms: {
      summary: 'US federal government work — public domain in the US (17 U.S.C. §105).',
      confirmed: true,
    },
  },
  {
    id: 'fda_gras_notices',
    title: 'FDA GRAS Notice Inventory — full export',
    url: 'https://hfpappexternal.fda.gov/scripts/fdcc/cfc/XMLService.cfm?method=downloadxls&set=GRASNotices',
    file: 'fda_gras_notices.csv',
    publisher: 'US Food and Drug Administration',
    terms: { summary: 'US federal government work — public domain in the US.', confirmed: true },
  },
  {
    id: 'fda_color_additives',
    title: 'FDA Color Additive Status List — full export',
    url: 'https://hfpappexternal.fda.gov/scripts/fdcc/cfc/XMLService.cfm?method=downloadxls&set=ColorAdditives',
    file: 'fda_color_additives.csv',
    publisher: 'US Food and Drug Administration',
    terms: { summary: 'US federal government work — public domain in the US.', confirmed: true },
  },
  {
    id: 'ecfr_21_subchapter_b',
    title: '21 CFR Chapter I Subchapter B (Parts 100–199), Food for Human Consumption',
    // The date segment is resolved at fetch time to eCFR's latest issue.
    url: 'https://www.ecfr.gov/api/versioner/v1/full/{date}/title-21.xml?subchapter=B',
    file: 'ecfr_21_subchapter_b.xml',
    publisher: 'Office of the Federal Register / eCFR',
    terms: { summary: 'US federal regulatory text — public domain.', confirmed: true },
  },
  ...ECFR_PARTS_SUBCHAPTER_A.map((part) => ({
    id: `ecfr_21_part_${part}`,
    title: `21 CFR Part ${part} (color additives)`,
    url: `https://www.ecfr.gov/api/versioner/v1/full/{date}/title-21.xml?part=${part}`,
    file: `ecfr_21_part_${part}.xml`,
    publisher: 'Office of the Federal Register / eCFR',
    terms: { summary: 'US federal regulatory text — public domain.', confirmed: true },
  })),
  {
    id: 'eu_1333_2008',
    title: 'Regulation (EC) No 1333/2008 on food additives — latest consolidated text',
    // Resolved at fetch time: the newest consolidated CELEX (02008R1333-YYYYMMDD)
    // from the Publications Office SPARQL endpoint, then fetched from Cellar.
    // EUR-Lex's own web front end sits behind a bot challenge; Cellar is the
    // Publications Office's documented machine interface to the same text.
    url: 'https://publications.europa.eu/resource/celex/{celex}',
    file: 'eu_1333_2008.xhtml',
    publisher: 'Publications Office of the European Union',
    terms: {
      summary:
        'EUR-Lex legal texts: reuse authorised provided the source is acknowledged (Commission Decision 2011/833/EU). Only the consolidated text is non-authentic — the Official Journal is.',
      confirmed: false,
    },
  },
  {
    id: 'efsa_openfoodtox',
    title: "EFSA OpenFoodTox 3.0 — chemical hazards database export",
    url: 'https://zenodo.org/api/records/19388272/files/OFT3.0%20export%20repository.xlsx/content',
    file: 'efsa_openfoodtox.xlsx',
    publisher: 'European Food Safety Authority (via Zenodo)',
    terms: {
      summary:
        'CC BY-ND 4.0. Used to VERIFY reference values and to cite the underlying EFSA opinion (by DOI). Whether displaying individual extracted values counts as a derivative needs a human read before launch.',
      confirmed: false,
    },
  },
  {
    id: 'hk_legislation',
    title: 'Hong Kong e-Legislation bulk XML, Caps. 1–300 (current) — Cap. 132BD, 132H, 132U, 132AR extracted',
    url: 'https://resource.data.one.gov.hk/doj/data/hkel_c_leg_cap_1_cap_300_en.zip',
    file: 'hk',
    publisher: 'Department of Justice, HKSAR (via DATA.GOV.HK)',
    terms: {
      summary: 'DATA.GOV.HK terms of use: free reuse, including commercial, with attribution.',
      confirmed: false,
    },
  },
  {
    id: 'codex_ins',
    title: 'Codex CXG 36-1989 — Class Names and the International Numbering System for Food Additives',
    url: 'https://www.fao.org/fao-who-codexalimentarius/sh-proxy/en/?lnk=1&url=https%253A%252F%252Fworkspace.fao.org%252Fsites%252Fcodex%252FStandards%252FCXG%2B36-1989%252FCXG_036e.pdf',
    file: null,
    manual: 'sources/manual/codex/',
    publisher: 'FAO/WHO Codex Alimentarius Commission',
    terms: {
      summary:
        'FAO/WHO copyright. FAO publications are commonly CC BY-NC-SA 3.0 IGO — the NC clause matters for a paid app. Must be confirmed before any Codex text ships.',
      confirmed: false,
    },
  },
];

export const byId = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
