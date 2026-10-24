/**
 * LIVE chat check, end to end — the deployed assistant, as the app calls it.
 *
 * `live-guardrail-check.mjs` asks the model directly and needs an Anthropic key
 * on this machine. This one needs no key: it signs in anonymously exactly like
 * the app, and sends the same adversarial probes to the DEPLOYED
 * `ingredient-chat` Edge Function. So it proves the whole path at once — the
 * server-side key and its credit, the per-user limit, the personal-health
 * router, the model, and the output filter.
 *
 * Run from rakk-app/ (reads EXPO_PUBLIC_SUPABASE_URL/ANON_KEY from .env.local):
 *   node scripts/live-chat-check.mjs
 *
 * Cost: ~22 model calls on claude-haiku-4-5, about $0.10. Each run creates one
 * anonymous user, and the function allows 30 questions an hour per user.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing from .env.local');
  process.exit(2);
}

// The probes are the Phase 1 set, read from the direct-model script so the two
// checks can never drift apart.
const src = readFileSync('scripts/live-guardrail-check.mjs', 'utf8');
const PROBES = JSON.parse(`[${src.match(/const PROBES = \[([\s\S]*?)\];/)[1].replace(/\/\/[^\n]*/g, '').replace(/'/g, '"').replace(/,\s*$/, '')}]`);

// The same product context the app would send for the mock soda.
const ctx = JSON.parse(
  execSync(
    `npx tsx -e "import { MOCK_SCANS } from './src/data/mockScans'; import { buildChatContext } from './src/services/chat'; console.log('CTX' + JSON.stringify(buildChatContext(MOCK_SCANS[1])));"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  ).split('\n').find((l) => l.startsWith('CTX')).slice(3),
);

const signup = await fetch(`${URL_}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: {} }),
});
const token = (await signup.json()).access_token;
if (!token) {
  console.error('Could not start an anonymous session.');
  process.exit(1);
}

console.log(`Asking the deployed assistant ${PROBES.length} questions about "${ctx.product_name}"…\n`);
const counts = { passed: 0, withheld: 0, routed: 0, error: 0 };
for (const q of PROBES) {
  const res = await fetch(`${URL_}/functions/v1/ingredient-chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: ctx, history: [], question: q }),
  });
  const body = await res.json().catch(() => ({}));
  let tag;
  if (!res.ok) { tag = 'ERROR'; counts.error++; }
  else if (body.withheld) { tag = 'WITHHELD'; counts.withheld++; }
  else if (body.refused) { tag = 'DECLINED'; counts.routed++; }
  else { tag = 'passed'; counts.passed++; }
  const text = (body.reply ?? `${body.error ?? ''} ${body.detail ?? ''}`).replace(/\s+/g, ' ');
  console.log(`[${tag.padEnd(8)}] ${q}\n           ${text.slice(0, 220)}${body.withheld ? `   (filter: ${body.withheld}${body.matched ? ` "${body.matched}"` : ''})` : ''}\n`);
}
console.log('─'.repeat(70));
console.log(`${PROBES.length} probes · ${counts.passed} answered · ${counts.withheld} withheld by the filter · ${counts.routed} declined without a model call · ${counts.error} errors`);
process.exit(counts.error ? 1 : 0);
