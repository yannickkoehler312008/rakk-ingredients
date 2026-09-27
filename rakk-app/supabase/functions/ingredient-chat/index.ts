/**
 * Ingredient chat assistant — Supabase Edge Function (build-order step 5).
 *
 * WHY THIS EXISTS AS A BACKEND ENDPOINT AT ALL (§7):
 *   "that call should go through a thin backend endpoint (e.g. a Supabase Edge
 *    Function), not directly from the client to the LLM provider, so API keys
 *    stay server-side and so per-user rate limiting (§8) can actually be
 *    enforced."
 *
 * Every other read in this app goes straight from the client to Supabase. This
 * one call does not, for exactly two reasons: the key, and the limit.
 *
 * Deploy:  supabase functions deploy ingredient-chat
 * Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *          (never in app.json, never in the bundle, never in git)
 */

import Anthropic from 'npm:@anthropic-ai/sdk@^0.70.0';
import { createClient } from 'npm:@supabase/supabase-js@^2';
import {
  SYSTEM_PROMPT,
  WITHHELD_REPLY,
  PERSONAL_HEALTH_REPLY,
  buildContext,
  classifyQuestion,
  screenReply,
  type ChatContext,
} from './guardrails.ts';

/* ─────────────────────────── Cost controls (§8) ─────────────────────────── */

/**
 * §8 requires this to be budgeted explicitly rather than treated as free.
 *
 * MODEL CHOICE: Haiku 4.5 is the cheapest model available ($1/MTok in,
 * $5/MTok out) and was chosen deliberately for this workload — the assistant
 * answers from context that is handed to it, which is the shape of task the
 * small model handles well. At these rates a grounded question costs roughly
 * $0.004, against a $2.50/month subscription that is materially less net of
 * store fees (Appendix B). That is a few hundred questions a month per
 * subscriber before the chat costs more than the subscription earns.
 *
 * THREE HAIKU-SPECIFIC RULES, all of which bite silently or loudly:
 *
 *  1. `output_config.effort` is REJECTED on Haiku 4.5 — it is not merely
 *     ignored, it returns a 400. There is no effort knob on this model.
 *
 *  2. Haiku 4.5 does not take adaptive thinking; it uses the older
 *     `thinking: {type: 'enabled', budget_tokens: N}` shape. We omit `thinking`
 *     entirely, which means no thinking — correct here, since the answer is a
 *     rephrasing of supplied facts rather than a reasoning problem, and
 *     thinking tokens are billed at output rates.
 *
 *  3. Haiku 4.5's MINIMUM CACHEABLE PREFIX IS 4096 TOKENS. Measured against
 *     real scans, the system prompt plus product context runs ~860–2100
 *     tokens, so the `cache_control` marker below is a NO-OP on this model —
 *     it fails silently, with no error and `cache_creation_input_tokens: 0`.
 *     The marker is kept because it is correct code that starts working if the
 *     model changes: Claude Opus 5's minimum is 512 tokens. Do not assume
 *     caching is saving anything here without checking that field.
 */
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 800;

/** Per user, per hour. Deliberately low until real usage is observed. */
const RATE_LIMIT = 30;
const RATE_WINDOW = '1 hour';

/** Input caps: a malformed or hostile client must not be able to run up a bill. */
const MAX_QUESTION_CHARS = 600;
const MAX_HISTORY_TURNS = 10;
const MAX_INGREDIENTS = 60;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  context: ChatContext;
  history: ChatTurn[];
  question: string;
}

/** Error shapes the client renders as designed states (§9), not a toast. */
type ErrorCode = 'unauthenticated' | 'rate_limited' | 'bad_request' | 'upstream';

function fail(code: ErrorCode, status: number, detail?: string): Response {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function ok(reply: string, meta: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ reply, ...meta }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('bad_request', 405);

  // ── Who is calling (§7: Supabase Auth session tokens) ───────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return fail('unauthenticated', 401, 'no session token');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return fail('unauthenticated', 401, 'invalid session');
  const userId = userData.user.id;

  // ── Budget (§8) ─────────────────────────────────────────────────────────
  // NOTE: entitlement gating belongs here too — Appendix B wants the chat
  // endpoint to check subscription status server-side rather than trust the
  // client. Billing is out of this phase's build order, so this is the hook
  // point, deliberately left empty.
  const { data: remaining, error: quotaErr } = await supabase.rpc('consume_chat_quota', {
    p_user_id: userId,
    p_limit: RATE_LIMIT,
    p_window: RATE_WINDOW,
  });
  if (quotaErr) return fail('upstream', 503, 'quota check failed');
  if (typeof remaining === 'number' && remaining < 0) {
    return fail('rate_limited', 429, `limit is ${RATE_LIMIT} questions an hour`);
  }

  // ── Parse and clamp ─────────────────────────────────────────────────────
  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400, 'malformed body');
  }

  const question = (body.question ?? '').trim();
  if (!question) return fail('bad_request', 400, 'empty question');
  if (question.length > MAX_QUESTION_CHARS) {
    return fail('bad_request', 400, `questions are capped at ${MAX_QUESTION_CHARS} characters`);
  }
  if (!body.context?.raw_ingredient_text) {
    return fail('bad_request', 400, 'no product context');
  }

  // ── Layer 3: refuse personal health advice without spending a call ──────
  if (classifyQuestion(question) === 'personal_health') {
    return ok(PERSONAL_HEALTH_REPLY, { refused: 'personal_health', spent_call: false });
  }

  const context: ChatContext = {
    ...body.context,
    ingredients: (body.context.ingredients ?? []).slice(0, MAX_INGREDIENTS),
  };
  const history = (body.history ?? []).slice(-MAX_HISTORY_TURNS);

  // ── Ask ─────────────────────────────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  let raw: string;
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // No `output_config.effort` and no `thinking` — see the notes above.
      // Both are model-specific on Haiku 4.5 and effort would 400.
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        {
          type: 'text',
          text: buildContext(context),
          // No-op below 4096 tokens on Haiku 4.5 (rule 3 above). Engages
          // automatically on a longer label, or on a model with a lower
          // minimum. Verify with `usage.cache_read_input_tokens` before
          // believing it is doing anything.
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user' as const, content: question },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return ok(WITHHELD_REPLY, { withheld: 'model_refusal' });
    }
    raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    if (status === 429) return fail('rate_limited', 429, 'upstream is busy');
    return fail('upstream', 502, 'the assistant could not be reached');
  }

  if (!raw) return fail('upstream', 502, 'empty reply');

  // ── Layer 2: check the reply before the user ever sees it ───────────────
  const screened = screenReply(raw);
  if (!screened.ok) {
    // §9's copy rule is absolute. A reply that breaks it is not shown, and the
    // match is reported so the system prompt can be tightened against it.
    console.warn(`[guardrail] withheld reply: ${screened.reason} "${screened.matched}"`);
    return ok(WITHHELD_REPLY, { withheld: screened.reason, matched: screened.matched });
  }

  return ok(screened.reply, { remaining });
});
