/**
 * The "resolved scan" response shape — §7's API contract.
 *
 * §7: "define the exact JSON shape the app expects for a 'resolved scan'
 * (product + matched ingredients + flagged subset) as ONE assembled response,
 * rather than making the client stitch together multiple separate calls".
 *
 * Every screen in this app reads this shape and nothing else. In step 1 it is
 * satisfied by hand-written mock data; from step 2/3 it is satisfied by the
 * backend. No screen should ever need to know which.
 */

import { Ingredient } from './ingredient';

export interface Product {
  id: string;
  /** Null on the OCR path, where there is no barcode to key on. */
  barcode: string | null;
  name: string;
  brand: string;
  /** Null until we have imagery; screens must render without it. */
  image_url: string | null;
  /** The ingredient list exactly as printed on the package. */
  raw_ingredient_text: string;
}

/**
 * The ingredient list cut into contiguous runs. Concatenating every `text` in
 * order reproduces `raw_ingredient_text` byte-for-byte — that invariant is what
 * lets the Label screen render the list as REAL running text (§5's signature
 * interaction) instead of rebuilding it from a list of names.
 *
 * Runs that matched a database entry carry `ingredient_id`. Runs that matched
 * but sit on the everyday allow-list have `flagged: false` and render unstyled
 * (§3, step 4).
 */
export interface LabelRun {
  text: string;
  ingredient_id: string | null;
  flagged: boolean;
  /**
   * True when this span is a printed ingredient name that matched NOTHING in
   * the database. Carried per-run, not just in `unmatched_names`, so the Label
   * screen can own up to the gap in place on the label rather than hiding it
   * (§9: "ingredient not yet in database" needs its own designed state).
   */
  unmatched: boolean;
}

export type ScanMethod = 'barcode' | 'photo_ocr' | 'manual_search';

export interface ResolvedScan {
  scan_id: string;
  scanned_at: string;
  method: ScanMethod;
  product: Product;
  runs: LabelRun[];
  /** Matched Ingredient records, keyed off `LabelRun.ingredient_id`. */
  ingredients: Ingredient[];
  /** Ingredients detected in the list, total. */
  ingredient_count: number;
  /** How many of those are flagged. A COUNT — never a score (§4). */
  flagged_count: number;
  /**
   * Names parsed out of the list with no database match. Surfaced honestly
   * rather than silently dropped (§9's empty-state discipline).
   */
  unmatched_names: string[];
}

export function ingredientById(scan: ResolvedScan, id: string | null): Ingredient | undefined {
  if (!id) return undefined;
  return scan.ingredients.find((i) => i.id === id);
}
