/**
 * Barcode → product from USDA FoodData Central — the second product source.
 *
 * Phase 2 spec §12.A: "USDA FoodData Central … is a good secondary source for
 * US-branded products specifically." The app asks Open Food Facts first; this
 * runs only when Open Food Facts has no product, or no ingredient list for it.
 *
 * Server-side for the usual reason (§7): FoodData Central needs an API key,
 * and a key inside the app bundle can be extracted and its quota spent by
 * anyone. Set it with:   supabase secrets set FDC_API_KEY=…
 * (free, https://fdc.nal.usda.gov/api-key-signup). Until it is set, the
 * function uses api.data.gov's shared DEMO_KEY, which works but is limited to
 * a few dozen requests an hour — fine for testing, not for launch.
 *
 * FoodData Central stores barcodes in several lengths ("016000348516",
 * "00016000150195"), and its search matches the exact string, so each length
 * is tried and a hit is accepted only if it is the same barcode once leading
 * zeros are ignored.
 */

import { createClient } from 'npm:@supabase/supabase-js@^2';

const FDC = 'https://api.nal.usda.gov/fdc/v1/foods/search';
/** Per user, per hour: a lookup is a free public API call, but not unlimited. */
const RATE_LIMIT = 120;
const RATE_WINDOW = '1 hour';
const TIMEOUT_MS = 8000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

interface FdcFood {
  fdcId: number;
  gtinUpc?: string;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  publishedDate?: string;
}

/** "GENERAL MILLS, CHEERIOS" → "General Mills, Cheerios". Mixed case is left alone. */
function tidy(s: string | undefined): string {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /[a-z]/.test(t)) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

const core = (code: string) => code.replace(/\D/g, '').replace(/^0+/, '');

async function search(gtin: string, key: string): Promise<FdcFood[]> {
  const url = `${FDC}?dataType=Branded&pageSize=5&query=${encodeURIComponent(gtin)}&api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 429) throw new Error('rate_limited');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { foods?: FdcFood[] };
  return body.foods ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthenticated' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'unauthenticated' }, 401);

  const { data: remaining, error: quotaErr } = await supabase.rpc('consume_quota', {
    p_user_id: userData.user.id,
    p_kind: 'product_lookup',
    p_limit: RATE_LIMIT,
    p_window: RATE_WINDOW,
  });
  if (quotaErr) return json({ error: 'upstream', detail: 'quota check failed' }, 503);
  if (typeof remaining === 'number' && remaining < 0) return json({ error: 'rate_limited' }, 429);

  let barcode = '';
  try {
    barcode = String((await req.json())?.barcode ?? '');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const want = core(barcode);
  if (want.length < 6 || want.length > 14) return json({ error: 'bad_request', detail: 'not a barcode' }, 400);

  const key = Deno.env.get('FDC_API_KEY') || 'DEMO_KEY';
  const forms = [...new Set([barcode.replace(/\D/g, ''), want.padStart(12, '0'), want.padStart(13, '0'), want.padStart(14, '0')])];
  try {
    for (const form of forms) {
      const hit = (await search(form, key)).find((f) => f.gtinUpc && core(f.gtinUpc) === want);
      if (!hit) continue;
      const ingredients = (hit.ingredients ?? '').replace(/^\s*ingredients\s*:\s*/i, '').trim();
      return json({
        kind: ingredients ? 'found' : 'no_ingredients',
        product: {
          fdc_id: hit.fdcId,
          gtin: hit.gtinUpc,
          name: tidy(hit.description),
          brand: tidy(hit.brandName || hit.brandOwner),
          raw_ingredient_text: ingredients,
          published: hit.publishedDate ?? null,
        },
      });
    }
    return json({ kind: 'not_found' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (msg === 'rate_limited') return json({ error: 'rate_limited', detail: 'FoodData Central rate limit' }, 429);
    return json({ error: 'upstream', detail: msg }, 502);
  }
});
