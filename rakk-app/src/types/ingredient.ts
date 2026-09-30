/**
 * Ingredient — Appendix A / §11 of rakk-phase1-app-build.md, field-for-field.
 *
 * Field names are the spec's snake_case names on purpose: §10.8 says swapping
 * the step-3 seed data for the Phase 2 database should be "a data cutover, not
 * a code change". Keeping these identical to the Postgres column names is what
 * makes that true.
 *
 * NOTE ON NAMING: there is no score, grade, rating, or verdict field here, and
 * there must never be one — not even as a placeholder. `risk_assessment_refs`
 * is Appendix A's own field name and holds CITATION LINKS to published FDA /
 * EFSA / JECFA assessments so that no dosage statement is made without a
 * traceable source. It is not a rating and carries no value judgment.
 */

export type IngredientCategory =
  | 'preservative'
  | 'thickener'
  | 'emulsifier'
  | 'filler'
  | 'colorant'
  | 'flavor'
  | 'sweetener'
  | 'acidity_regulator'
  | 'leavening_agent'
  | 'antioxidant'
  | 'other';

/** "How this is actually made" — a common user question a citation can't answer. */
export type IngredientOrigin = 'natural' | 'nature_identical' | 'synthetic' | 'unknown';

export type TypicalUse = 'food' | 'cosmetics' | 'pharmaceutical' | 'industrial';

/**
 * ASSUMPTION (flagged to the spec owner): Appendix A specifies
 * `allergen_flags` as "array of enum — recognized allergen categories" but does
 * not enumerate the set. This is the FDA's nine major food allergens plus
 * sulfites, which is declarable under 21 CFR 101.100(a)(4). Widen or replace
 * once the real set is decided.
 */
export type AllergenFlag =
  | 'milk'
  | 'egg'
  | 'fish'
  | 'crustacean_shellfish'
  | 'tree_nut'
  | 'peanut'
  | 'wheat'
  | 'soybean'
  | 'sesame'
  | 'sulfites';

/** §11 / §17.5: "US_FDA, EU_EFSA, CODEX, HK_CFS at minimum". */
export type JurisdictionCode = 'US_FDA' | 'EU_EFSA' | 'CODEX' | 'HK_CFS';

/**
 * One regulator's position on this ingredient. §11 replaced a single flat
 * status/citation pair with an array precisely so that "GRAS in the US,
 * restricted in the EU" surfaces as two facts instead of collapsing into one
 * answer.
 *
 * `status` is free text taken from the regulator's own wording — it is
 * deliberately NOT an enum, because normalising "GRAS" and "Authorised, with
 * restrictions in infant formula" onto one ordered scale would be exactly the
 * grading this product refuses to do.
 */
export interface JurisdictionEntry {
  jurisdiction: JurisdictionCode;
  status: string;
  citation: string | null;
  citation_url: string | null;
}

export type ProductTypeContext = 'leave_on' | 'rinse_off' | 'ingested' | 'topical' | 'other';

/**
 * §1 / §11 / §4 — dosage and exposure context. The single most defensible
 * reason a user picks this over a red/yellow/green scanner. Nullable only
 * where no dose-response data exists to responsibly populate it; nullable
 * means "backfill this", not "skip it".
 */
export interface UsageContext {
  threshold_of_concern: string | null;
  typical_concentration_range: string;
  product_type_context: ProductTypeContext;
}

/**
 * Where a row's core classification comes from. The last two were added in
 * Phase 2 (flagged to the spec owner): §11's list has no value for a row that
 * only the FDA colour-additive list or only the EU additives regulation
 * describes, and labelling those `manual_curation` would be false.
 */
export type IngredientSource =
  | 'fda_substances_added_to_food'
  | 'fda_gras_notice'
  | 'codex_alimentarius'
  | 'usda_fooddata_central'
  | 'manual_curation'
  | 'fda_color_additives'
  | 'eu_additives_regulation';

/** ISO 8601 date, `YYYY-MM-DD`. */
export type IsoDate = string;

export interface Ingredient {
  id: string;
  canonical_name: string;
  /** Alt names, common misspellings, trade/brand names. */
  aka: string[];
  cas_number: string | null;
  /** EU E-number / Codex INS code, structured so non-US labels can match (§12.A). */
  e_number_ins_code: string | null;
  chemical_formula: string | null;
  category: IngredientCategory;
  origin: IngredientOrigin;
  typical_uses: TypicalUse[];
  allergen_flags: AllergenFlag[];
  /** 1–2 sentences, plain English: what it is / why it's used. */
  plain_explanation: string;
  jurisdictions: JurisdictionEntry[];
  /** Citations backing any `usage_context` statement. Not a rating — see file header. */
  risk_assessment_refs: string[] | null;
  usage_context: UsageContext | null;
  source: IngredientSource;
  /** When the core classification fields were last verified against the source. */
  source_updated_at: IsoDate;
  /** When EVERY field on this row was last reviewed end-to-end. */
  last_full_review_at: IsoDate | null;
  /** The ~40–60 everyday ingredients that must never be flagged (§3, §8). */
  everyday_allowlist: boolean;
}
