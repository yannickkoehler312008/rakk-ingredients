/**
 * Client for the ingredient chat assistant — build-order step 5.
 *
 * This file never sees an LLM API key, and never will. §7 routes this one call
 * through a backend endpoint precisely so the key stays server-side; anything
 * in `src/` ships inside the app bundle and is readable by anyone who downloads
 * it. The only credentials here are the Supabase URL and anon key, which are
 * designed to be public and are protected by row-level security.
 */

import { ResolvedScan } from '../types/scan';
import { accessToken, isChatConfigured, SUPABASE_URL } from './supabaseClient';

export { isChatConfigured };

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Every outcome the chat can have. §4 and §9 want each of these to be its own
 * designed state rather than one generic failure.
 */
export type ChatResult =
  | { kind: 'reply'; text: string; remaining?: number }
  | { kind: 'offline' }
  | { kind: 'not_configured' }
  | { kind: 'rate_limited'; detail?: string }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; detail?: string };

/**
 * Trim the scan down to what the assistant is allowed to know.
 *
 * §4: the chat is "given the product's full parsed ingredient list and the
 * matched `Ingredient` records (including `jurisdictions`, `usage_context`, and
 * citations) as context, not open-ended internet access, so every answer can be
 * grounded in data already on the card or in the database".
 *
 * Sending the scan from the client is a step-5 shape: the client already holds
 * it and there is no server-side scan store yet. Once scans live in Postgres
 * (step 8), the function should look this up by scan id instead, so the
 * grounding cannot be tampered with in transit.
 */
export function buildChatContext(scan: ResolvedScan) {
  const flaggedIds = new Set(scan.runs.filter((r) => r.flagged).map((r) => r.ingredient_id));
  return {
    product_name: scan.product.name,
    brand: scan.product.brand,
    raw_ingredient_text: scan.product.raw_ingredient_text,
    unmatched_names: scan.unmatched_names,
    ingredients: scan.ingredients.map((i) => ({
      canonical_name: i.canonical_name,
      e_number_ins_code: i.e_number_ins_code,
      category: i.category,
      origin: i.origin,
      plain_explanation: i.plain_explanation,
      allergen_flags: i.allergen_flags,
      jurisdictions: i.jurisdictions.map((j) => ({
        jurisdiction: j.jurisdiction,
        status: j.status,
        citation: j.citation,
      })),
      usage_context: i.usage_context,
      risk_assessment_refs: i.risk_assessment_refs,
      flagged: flaggedIds.has(i.id),
    })),
  };
}

const TIMEOUT_MS = 30_000;

export async function askAboutProduct(
  scan: ResolvedScan,
  history: ChatTurn[],
  question: string,
): Promise<ChatResult> {
  if (!isChatConfigured()) return { kind: 'not_configured' };

  let token: string | null;
  try {
    token = await accessToken();
  } catch {
    return { kind: 'offline' };
  }
  if (!token) return { kind: 'unauthenticated' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ingredient-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: buildChatContext(scan),
        history,
        question,
      }),
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as {
      reply?: string;
      error?: string;
      detail?: string;
      remaining?: number;
    };

    if (res.status === 429) return { kind: 'rate_limited', detail: body.detail };
    if (res.status === 401) return { kind: 'unauthenticated' };
    if (!res.ok || !body.reply) return { kind: 'error', detail: body.detail };

    return { kind: 'reply', text: body.reply, remaining: body.remaining };
  } catch (err) {
    // §4/§8: the assistant needs a network by nature. Say so plainly rather
    // than hanging or failing silently.
    const aborted = err instanceof Error && err.name === 'AbortError';
    return aborted ? { kind: 'error', detail: 'timed out' } : { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
