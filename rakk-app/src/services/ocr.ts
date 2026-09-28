/**
 * Reading a photographed ingredient panel — build-order step 6.
 *
 * §6 puts OCR in the cloud because "on-device OCR quality on dense small-print
 * ingredient text is usually not good enough for v1". The call goes through a
 * backend endpoint for the same two reasons as the chat (§7): the key stays out
 * of the app bundle, and the per-user limit can be enforced.
 *
 * This file never sees an LLM key.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { accessToken, isChatConfigured, SUPABASE_URL } from './supabaseClient';

/**
 * Claude downsamples images above roughly 1568px on the long edge, so sending
 * anything larger costs upload time and tokens without reading any better.
 * 1600 leaves a little headroom for the crop.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;
const TIMEOUT_MS = 45_000;

export type OcrResult =
  | { kind: 'text'; raw_ingredient_text: string; unreadable_markers: number; remaining?: number }
  /** §9's "OCR failed" state, carrying the real reason so the screen can say it. */
  | { kind: 'unreadable'; reason: string }
  | { kind: 'offline' }
  | { kind: 'not_configured' }
  | { kind: 'rate_limited'; detail?: string }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; detail?: string };

/** Shrink and re-encode before upload. Returns base64 with no data: prefix. */
async function prepare(uri: string): Promise<{ base64: string; mediaType: string }> {
  const context = ImageManipulator.manipulate(uri).resize({ width: MAX_EDGE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });
  return { base64: saved.base64 ?? '', mediaType: 'image/jpeg' };
}

export async function readLabelPhoto(uri: string): Promise<OcrResult> {
  if (!isChatConfigured()) return { kind: 'not_configured' };

  let token: string | null;
  try {
    token = await accessToken();
  } catch {
    return { kind: 'offline' };
  }
  if (!token) return { kind: 'unauthenticated' };

  let prepared: { base64: string; mediaType: string };
  try {
    prepared = await prepare(uri);
  } catch (err) {
    return { kind: 'error', detail: err instanceof Error ? err.message : 'could not read the photo' };
  }
  if (!prepared.base64) return { kind: 'error', detail: 'the photo came back empty' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/read-label`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: prepared.base64, media_type: prepared.mediaType }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      raw_ingredient_text?: string;
      unreadable_markers?: number;
      remaining?: number;
      error?: string;
      detail?: string;
    };

    if (res.status === 422) {
      return { kind: 'unreadable', reason: body.detail ?? 'the panel could not be read' };
    }
    if (res.status === 429) return { kind: 'rate_limited', detail: body.detail };
    if (res.status === 401) return { kind: 'unauthenticated' };
    if (!res.ok || !body.raw_ingredient_text) {
      return { kind: 'error', detail: body.detail };
    }
    return {
      kind: 'text',
      raw_ingredient_text: body.raw_ingredient_text,
      unreadable_markers: body.unreadable_markers ?? 0,
      remaining: body.remaining,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    // §8: this path cannot complete offline, and that is designed around
    // rather than solved.
    return aborted ? { kind: 'error', detail: 'timed out' } : { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
