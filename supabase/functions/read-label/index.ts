/**
 * Read a photographed ingredient panel — Supabase Edge Function (step 6).
 *
 * §6: "OCR for photographed ingredient lists: cloud OCR (Google Vision API or
 * similar) — on-device OCR quality on dense small-print ingredient text is
 * usually not good enough for v1."
 *
 * This is the "or similar": Claude's vision capability, chosen so the project
 * needs one provider and one key rather than a second cloud account. The cost
 * of that choice is that a language model will interpret unless told very
 * firmly not to — see ./transcription.ts for how that is handled.
 *
 * Server-side for the same two reasons as the chat (§7): the key stays out of
 * the app bundle, and the per-user limit can actually be enforced.
 *
 * Deploy: supabase functions deploy read-label
 */

import Anthropic from 'npm:@anthropic-ai/sdk@^0.70.0';
import { createClient } from 'npm:@supabase/supabase-js@^2';
import {
  TRANSCRIPTION_PROMPT,
  parseTranscription,
  type TranscriptionResult,
} from './transcription.ts';

/** Vision-capable and the cheapest available (§8). */
/**
 * Server setting (secret OCR_MODEL), changeable and reversible without a
 * deploy. On Claude Haiku 5.5 thinking is on by default and counts toward
 * max_tokens, so the cap is larger and effort is `low`: transcription needs
 * reading, not reasoning.
 */
const MODEL = Deno.env.get('OCR_MODEL') || 'claude-haiku-4-5';
const IS_HAIKU_45 = MODEL === 'claude-haiku-4-5';
const MAX_TOKENS = IS_HAIKU_45 ? 1500 : 4000;

/** Per user, per hour. Lower than chat: each call carries an image. */
const RATE_LIMIT = 20;
/** Rolling 24 hours (migration 0008). */
const DAILY_LIMIT = 40;

/**
 * Supabase Edge Functions cap the request body, and a large image costs more
 * without reading better — Claude downsamples above ~1568px anyway. The client
 * resizes to 1600px before sending; this is the backstop for a client that
 * doesn't.
 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp'] as const;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ErrorCode = 'unauthenticated' | 'rate_limited' | 'bad_request' | 'upstream' | 'unreadable';

function fail(code: ErrorCode, status: number, detail?: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ error: code, detail, ...extra }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('bad_request', 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return fail('unauthenticated', 401, 'no session token');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return fail('unauthenticated', 401, 'invalid session');

  const { data: quota, error: quotaErr } = await supabase.rpc('consume_quotas', {
    p_user_id: userData.user.id,
    p_kind: 'ocr',
    p_hour_limit: RATE_LIMIT,
    p_day_limit: DAILY_LIMIT,
  });
  if (quotaErr) return fail('upstream', 503, `quota check failed: ${quotaErr.message}`);
  const q = (Array.isArray(quota) ? quota[0] : quota) as { hour_left: number; day_left: number } | null;
  if (q && q.day_left < 0) {
    return fail('rate_limited', 429, `the limit is ${DAILY_LIMIT} label photos in 24 hours`, { window: 'day' });
  }
  if (q && q.hour_left < 0) {
    return fail('rate_limited', 429, `the limit is ${RATE_LIMIT} label photos an hour`, { window: 'hour' });
  }
  const remaining = q?.hour_left;

  let body: { image_base64?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400, 'malformed body');
  }

  const image = (body.image_base64 ?? '').replace(/^data:[^;]+;base64,/, '');
  if (!image) return fail('bad_request', 400, 'no image');
  // base64 is 4 chars per 3 bytes.
  if (image.length * 0.75 > MAX_IMAGE_BYTES) {
    return fail('bad_request', 413, 'image too large — resize before sending');
  }
  const mediaType = (body.media_type ?? 'image/jpeg') as (typeof ALLOWED_MEDIA)[number];
  if (!ALLOWED_MEDIA.includes(mediaType)) {
    return fail('bad_request', 400, `media type must be one of ${ALLOWED_MEDIA.join(', ')}`);
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  let raw: string;
  let usage: Record<string, number | null | undefined> = {};
  try {
    // deno-lint-ignore no-explicit-any
    const request: any = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      ...(IS_HAIKU_45 ? {} : { output_config: { effort: 'low' } }),
      system: TRANSCRIPTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Transcribe the ingredient panel in this photograph.' },
          ],
        },
      ],
    };
    const response = await anthropic.messages.create(request);
    usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };

    if (response.stop_reason === 'refusal') {
      return fail('unreadable', 422, 'the photo could not be read');
    }
    raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    if (status === 429) return fail('rate_limited', 429, 'upstream is busy');
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[upstream] ${status ?? '?'} ${reason}`);
    return fail('upstream', 502, `upstream ${status ?? ''}: ${reason}`.slice(0, 300));
  }

  const result: TranscriptionResult = parseTranscription(raw);
  if (result.kind === 'cannot_read') {
    // §9 wants "OCR failed" to be a designed state with a real reason, not a
    // generic error. The reason comes back so the screen can say what to fix.
    return fail('unreadable', 422, result.reason, { model: MODEL, usage });
  }

  return new Response(
    JSON.stringify({
      raw_ingredient_text: result.text,
      unreadable_markers: result.unreadableMarkers,
      remaining,
      model: MODEL,
      usage,
    }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
