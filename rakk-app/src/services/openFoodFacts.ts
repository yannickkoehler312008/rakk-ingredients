/**
 * Open Food Facts lookup — build-order step 2.
 *
 * WHERE THIS SITS IN THE ARCHITECTURE: §7 puts product lookup on the backend
 * (Supabase), with ingredient matching running server-side in Postgres. This
 * client talks to Open Food Facts directly because step 2 has no backend yet.
 * When one exists, this file becomes the backend's ETL source (§6: "a scheduled
 * job that pulls incremental Open Food Facts updates") and the app calls the
 * backend instead. The app already only reads `ResolvedScan`, so that swap
 * doesn't touch any screen.
 *
 * ⚠️  BEFORE LAUNCH: Open Food Facts asks every API consumer to identify itself
 *     with a real contact in the User-Agent so they can reach you about traffic
 *     problems. `CONTACT` below is a placeholder and must be replaced with an
 *     address you actually monitor.
 */

import * as Network from 'expo-network';
import { Product } from '../types/scan';

const CONTACT = 'set-a-real-contact-before-launch@example.invalid';
const USER_AGENT = `RakkIngredients/0.1.0 (${CONTACT})`;

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

/** Only what the Label screen needs — keeps the response small on mobile data. */
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'ingredients_text',
  'ingredients_text_en',
  'image_url',
].join(',');

const TIMEOUT_MS = 10_000;

/**
 * Every way a lookup can end, as one discriminated union. §9 requires each of
 * these to get its own designed state rather than a generic error toast, so
 * they are distinct cases here rather than a nullable result plus a message.
 */
export type LookupResult =
  | { kind: 'found'; product: Product }
  /** In Open Food Facts, but with no ingredient list on the record. Common. */
  | { kind: 'no_ingredients'; product: Product }
  /** Not in Open Food Facts at all. */
  | { kind: 'not_found'; barcode: string }
  /** No network. §8 treats this as a designed state, not a failure. */
  | { kind: 'offline'; barcode: string }
  /** Reachable but something went wrong — bad status, malformed body, timeout. */
  | { kind: 'error'; barcode: string; detail: string };

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  ingredients_text?: string;
  ingredients_text_en?: string;
  image_url?: string;
}

function clean(value: string | undefined | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The two `_en` fields are NOT equally trustworthy, so they get opposite
 * preference. This is deliberate, not an inconsistency:
 *
 *   INGREDIENTS — prefer `_en`. It is the field Open Food Facts contributors
 *   actually curate, and it is usually the more complete record, with
 *   sub-ingredients and percentages spelled out; `ingredients_text` may also be
 *   in the packaging's original language.
 *
 *   NAME — prefer the plain field. `product_name_en` is free text that
 *   contributors sometimes fill with nonsense: barcode 0016000275287 is
 *   `product_name: "Cheerios"` but `product_name_en: "My Bff"`.
 *
 * Both rules come from a small hand-checked sample. Normalising crowd-sourced
 * data properly belongs in the backend ETL (§6's scheduled Open Food Facts
 * job), not on the client — revisit this there.
 */
function pickIngredientText(p: OffProduct): string {
  return clean(p.ingredients_text_en) || clean(p.ingredients_text);
}

function pickName(p: OffProduct): string {
  return clean(p.product_name) || clean(p.product_name_en);
}

/** Open Food Facts packs multiple brands into one comma-separated string. */
function pickBrand(p: OffProduct): string {
  const first = clean(p.brands).split(',')[0];
  return clean(first);
}

function toProduct(p: OffProduct, barcode: string, rawIngredientText: string): Product {
  return {
    id: `off_${p.code ?? barcode}`,
    barcode: clean(p.code) || barcode,
    name: pickName(p) || 'Unnamed product',
    brand: pickBrand(p),
    image_url: clean(p.image_url) || null,
    raw_ingredient_text: rawIngredientText,
  };
}

async function isOffline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    // `isInternetReachable` is undefined on some platforms; only trust a
    // definite false, and let the request itself fail otherwise.
    return state.isConnected === false || state.isInternetReachable === false;
  } catch {
    return false;
  }
}

export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  if (await isOffline()) return { kind: 'offline', barcode };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });

    // Open Food Facts answers 404 for an unknown barcode as well as signalling
    // it in the body, so treat both as the same designed state.
    if (res.status === 404) return { kind: 'not_found', barcode };
    if (!res.ok) return { kind: 'error', barcode, detail: `HTTP ${res.status}` };

    const body = (await res.json()) as { status?: number; product?: OffProduct };
    if (body.status !== 1 || !body.product) return { kind: 'not_found', barcode };

    const text = pickIngredientText(body.product);
    const product = toProduct(body.product, barcode, text);

    // Having the product but not its label is its own outcome: we still know
    // the name and brand, and the user can photograph the panel instead.
    if (!text) return { kind: 'no_ingredients', product };

    return { kind: 'found', product };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    if (aborted) return { kind: 'error', barcode, detail: 'timed out' };
    // fetch rejects on a dropped connection even when the pre-check passed.
    if (await isOffline()) return { kind: 'offline', barcode };
    return { kind: 'error', barcode, detail: err instanceof Error ? err.message : 'unknown' };
  } finally {
    clearTimeout(timer);
  }
}

