/**
 * Barcode → product, from every source the app has, in order.
 *
 * Phase 2 spec §12.A: Open Food Facts first ("the right starting point"), then
 * USDA FoodData Central as "a good secondary source for US-branded products
 * specifically". FoodData Central is asked only when Open Food Facts has no
 * product or no ingredient list for it, and a failure there never hides Open
 * Food Facts' own answer — the user just gets that answer's designed state.
 */

import { Product } from '../types/scan';
import { lookupBarcode, LookupResult } from './openFoodFacts';
import { accessToken, isBackendConfigured, SUPABASE_URL } from './supabaseClient';

const TIMEOUT_MS = 12_000;

type UsdaResult =
  | { kind: 'found' | 'no_ingredients'; product: Product }
  | { kind: 'not_found' | 'unavailable' };

async function lookupUsda(barcode: string): Promise<UsdaResult> {
  if (!isBackendConfigured()) return { kind: 'unavailable' };
  let token: string | null;
  try {
    token = await accessToken();
  } catch {
    return { kind: 'unavailable' };
  }
  if (!token) return { kind: 'unavailable' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/product-lookup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode }),
      signal: controller.signal,
    });
    if (!res.ok) return { kind: 'unavailable' };
    const body = (await res.json()) as {
      kind?: 'found' | 'no_ingredients' | 'not_found';
      product?: { fdc_id: number; gtin: string; name: string; brand: string; raw_ingredient_text: string };
    };
    if (body.kind === 'not_found' || !body.product) return { kind: 'not_found' };
    const p = body.product;
    return {
      kind: body.kind === 'found' ? 'found' : 'no_ingredients',
      product: {
        id: `fdc_${p.fdc_id}`,
        barcode,
        name: p.name || 'Unnamed product',
        brand: p.brand,
        image_url: null,
        raw_ingredient_text: p.raw_ingredient_text,
        source: 'usda_fooddata_central',
      },
    };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupProduct(barcode: string): Promise<LookupResult> {
  const off = await lookupBarcode(barcode);
  if (off.kind !== 'not_found' && off.kind !== 'no_ingredients') return off;

  const usda = await lookupUsda(barcode);
  if (usda.kind === 'found') return { kind: 'found', product: usda.product };
  // Open Food Facts knew nothing, FoodData Central knows the product but not
  // its label: better to show what we do know.
  if (usda.kind === 'no_ingredients' && off.kind === 'not_found') return { kind: 'no_ingredients', product: usda.product };
  return off;
}
