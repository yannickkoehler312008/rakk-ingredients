/**
 * Compact authoring shape for the seed dataset.
 *
 * WHY THIS ISN'T JUST `Ingredient[]`: Appendix A is deliberately wide, and
 * writing a few hundred full records by hand would be mostly `null`s and
 * repeated boilerplate — which is where transcription errors breed. Authors
 * write only what varies; `expand()` fills the rest and derives the things that
 * can be derived (citation strings, eCFR URLs, E-number citations).
 *
 * Every field here maps onto an Appendix A field. Nothing is invented.
 */

import {
  AllergenFlag,
  Ingredient,
  IngredientCategory,
  IngredientOrigin,
  TypicalUse,
  UsageContext,
} from '../../types/ingredient';

export interface SeedRegulation {
  status: string;
  /** Bare 21 CFR section, e.g. "184.1733". The citation and URL are derived. */
  cfr?: string;
}

export interface SeedIngredient {
  id: string;
  canonical_name: string;
  /** Alt names, trade names, common label spellings, misspellings. */
  aka?: string[];
  cas_number?: string;
  e_number_ins_code?: string;
  chemical_formula?: string;
  category: IngredientCategory;
  origin: IngredientOrigin;
  /** Defaults to `['food']`. */
  typical_uses?: TypicalUse[];
  allergen_flags?: AllergenFlag[];
  plain_explanation: string;
  us?: SeedRegulation;
  eu?: SeedRegulation;
  codex?: SeedRegulation;
  risk_assessment_refs?: string[];
  usage_context?: UsageContext;
  /** §3: the ~40–60 everyday ingredients that must never be flagged. */
  everyday?: boolean;
}

/**
 * When these records were written. They have NOT been reviewed end-to-end
 * against primary sources, so `last_full_review_at` stays null — that field is
 * exactly the distinction Appendix A draws, and leaving it null is the honest
 * signal that this is seed data.
 */
export const SEED_WRITTEN_AT = '2026-09-27';

const cfrUrl = (section: string) =>
  `https://www.ecfr.gov/current/title-21/section-${section}`;

export function expand(s: SeedIngredient): Ingredient {
  const jurisdictions: Ingredient['jurisdictions'] = [];

  if (s.us) {
    jurisdictions.push({
      jurisdiction: 'US_FDA',
      status: s.us.status,
      citation: s.us.cfr ? `21 CFR ${s.us.cfr}` : null,
      citation_url: s.us.cfr ? cfrUrl(s.us.cfr) : null,
    });
  }
  if (s.eu) {
    jurisdictions.push({
      jurisdiction: 'EU_EFSA',
      status: s.eu.status,
      citation: s.e_number_ins_code ?? null,
      citation_url: null,
    });
  }
  if (s.codex) {
    jurisdictions.push({
      jurisdiction: 'CODEX',
      status: s.codex.status,
      citation: s.e_number_ins_code ? `INS ${s.e_number_ins_code.replace(/^E/, '')}` : null,
      citation_url: null,
    });
  }

  return {
    id: s.id,
    canonical_name: s.canonical_name,
    aka: s.aka ?? [],
    cas_number: s.cas_number ?? null,
    e_number_ins_code: s.e_number_ins_code ?? null,
    chemical_formula: s.chemical_formula ?? null,
    category: s.category,
    origin: s.origin,
    typical_uses: s.typical_uses ?? ['food'],
    allergen_flags: s.allergen_flags ?? [],
    plain_explanation: s.plain_explanation,
    jurisdictions,
    risk_assessment_refs: s.risk_assessment_refs ?? null,
    usage_context: s.usage_context ?? null,
    source: 'manual_curation',
    source_updated_at: SEED_WRITTEN_AT,
    last_full_review_at: null,
    everyday_allowlist: s.everyday ?? false,
  };
}
