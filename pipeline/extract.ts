/**
 * The grounded extraction pass (§13): "Run an LLM extraction pass … always
 * keeping the exact source paragraph attached … Run a second, cheap
 * verification pass that re-checks each extracted field against its stored
 * source paragraph before accepting it."
 *
 * Per ingredient, the model sees ONLY that ingredient's source excerpts and
 * returns, as JSON:
 *   - a 1–2 sentence plain explanation           (replaces the vocabulary sentence)
 *   - origin (natural / synthetic / …), if a source states it
 *   - numeric US use limits stated in its 21 CFR section
 * — every claim with a verbatim quote from a named excerpt. Nothing is
 * accepted unless each quote is found word-for-word in the excerpt it names,
 * every number in the text appears in the sources, and the copy rules hold.
 * Rejected results change nothing; the reason is recorded.
 *
 * Run from rakk-app/ (which has tsx). Needs ANTHROPIC_API_KEY in the
 * environment or in pipeline/.env.local (gitignored). Spends money only in
 * `pilot` and `submit`.
 *
 *   npx tsx ../pipeline/extract.ts prepare            build tasks, estimate cost (free)
 *   npx tsx ../pipeline/extract.ts pilot [n]          n live requests (default 30) → out/extract-pilot.md
 *   npx tsx ../pipeline/extract.ts submit             one Message Batch for every task (50% price)
 *   npx tsx ../pipeline/extract.ts collect            poll, verify, write curation/extracted.json
 *
 * Options: --model claude-opus-5-5 (default) · --effort low|medium|high (default medium)
 */
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Ingredient } from '../rakk-app/src/types/ingredient';
import { parseEcfr } from './parse/ecfr.mjs';
import { SYSTEM, BANNED } from './lib/extract-rules.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'sources/raw');
const WORK = join(ROOT, 'work');
const TASKS = join(WORK, 'extract-tasks.json');
const STATE = join(WORK, 'extract-state.json');
const OUTPUT = join(ROOT, 'curation/extracted.json');
mkdirSync(WORK, { recursive: true });

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const MODEL = opt('model', 'claude-opus-5-5');
const EFFORT = opt('effort', 'medium') as 'low' | 'medium' | 'high';
/** Per-ingredient evidence cap: a few CFR sections are pages long. */
const MAX_EVIDENCE_CHARS = 6000;

// ─── the contract with the model ─────────────────────────────────────────────

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation', 'explanation_quotes', 'origin', 'origin_quote', 'us_limits'],
  properties: {
    explanation: { type: 'string' },
    explanation_quotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['evidence', 'quote'],
        properties: { evidence: { type: 'string' }, quote: { type: 'string' } },
      },
    },
    origin: { type: 'string', enum: ['natural', 'nature_identical', 'synthetic', 'unknown'] },
    origin_quote: { type: 'string' },
    us_limits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'statement', 'evidence', 'quote'],
        properties: {
          kind: { type: 'string', enum: ['legal_limit', 'current_usage'] },
          statement: { type: 'string' },
          evidence: { type: 'string' },
          quote: { type: 'string' },
        },
      },
    },
  },
} as const;

interface Evidence { id: string; label: string; source: string; text: string }
interface Task { id: string; name: string; evidence: Evidence[]; hash: string; wants_limits: boolean }
interface Extracted {
  explanation: string;
  explanation_quotes: { evidence: string; quote: string }[];
  origin: 'natural' | 'nature_identical' | 'synthetic' | 'unknown';
  origin_quote: string;
  us_limits: { kind: 'legal_limit' | 'current_usage'; statement: string; evidence: string; quote: string }[];
}

// ─── evidence: only what this ingredient's sources say ──────────────────────

function prepare(): Task[] {
  const rows: Ingredient[] = JSON.parse(readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8'));
  const prov = JSON.parse(readFileSync(join(ROOT, 'out/provenance.json'), 'utf8'));
  const cfr = parseEcfr(['ecfr_21_subchapter_b.xml', 'ecfr_21_part_73.xml', 'ecfr_21_part_74.xml', 'ecfr_21_part_81.xml', 'ecfr_21_part_82.xml'].map((f) => join(RAW, f)));

  const tasks: Task[] = [];
  for (const r of rows) {
    const p = prov[r.id];
    // Curated (seed) rows keep the words a person wrote.
    if (!p || p.kind === 'seed') continue;
    const ev: Evidence[] = [];
    const add = (label: string, source: string, text: string) => {
      const t = text.replace(/\s+/g, ' ').trim();
      if (t && !ev.some((e) => e.text === t)) ev.push({ id: `E${ev.length + 1}`, label, source, text: t });
    };

    const us = r.jurisdictions.find((j) => j.jurisdiction === 'US_FDA');
    const section = us?.citation?.startsWith('21 CFR ') ? us.citation.slice(7) : null;
    const sec = section ? cfr.get(section) : null;
    // A list section (172.515: hundreds of flavourings, one line each) says
    // nothing about any one entry beyond its name.
    const listSection = sec ? sec.entries.length >= 5 : true;
    if (sec && !listSection) {
      add(`21 CFR ${section} — ${sec.subject}`, 'ecfr', [sec.heading, ...sec.paragraphs.filter((x: any) => !x.list_entry).map((x: any) => x.text)].join(' '));
    }
    for (const f of p.fields) {
      if (f.method !== 'parsed') continue;
      if (f.field === 'canonical_name' && f.source === 'fda_saf') add('FDA Substances Added to Food inventory', 'fda_saf', f.excerpt);
      if (f.field.startsWith('jurisdictions.') && f.source === 'fda_gras_notices') add('FDA GRAS notice', 'fda_gras_notices', f.excerpt);
      if (f.field.startsWith('jurisdictions.') && f.source === 'fda_color_additives') add('FDA Color Additive Status List', 'fda_color_additives', f.excerpt);
      if (f.field === 'jurisdictions.EU_EFSA' && f.source === 'eu_1333_2008') add('EU Regulation 1333/2008, Annex II', 'eu_1333_2008', f.excerpt);
      if (f.field === 'jurisdictions.CODEX' && f.source === 'codex_ins') add('Codex CXG 36-1989', 'codex_ins', f.excerpt);
    }
    // The explanation the vocabulary wrote is evidence of the technical effect.
    for (const f of p.fields) {
      if (f.field === 'plain_explanation' && f.method === 'vocabulary' && f.excerpt) add('Technical effect recorded by the source', f.source, f.excerpt);
    }
    if (!ev.length) continue;

    let used = 0;
    const kept = ev.filter((e) => (used += e.text.length) <= MAX_EVIDENCE_CHARS || e === ev[0]).map((e) => ({ ...e, text: e.text.slice(0, MAX_EVIDENCE_CHARS) }));
    const hash = createHash('sha256').update(JSON.stringify([r.canonical_name, kept])).digest('hex').slice(0, 16);
    tasks.push({ id: r.id, name: r.canonical_name, evidence: kept, hash, wants_limits: !!(sec && !listSection) });
  }
  writeFileSync(TASKS, JSON.stringify(tasks));
  return tasks;
}

const userMessage = (t: Task) =>
  `INGREDIENT: ${t.name}\n\n` +
  t.evidence.map((e) => `EVIDENCE ${e.id} — ${e.label}\n${e.text}`).join('\n\n') +
  (t.wants_limits ? '' : '\n\n(No single-substance CFR section is cited for this ingredient: us_limits should be empty.)');

const params = (t: Task): Anthropic.MessageCreateParamsNonStreaming => ({
  model: MODEL,
  max_tokens: 16000,
  system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: userMessage(t) }],
  output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
});

// ─── the second pass: accept only what the evidence carries ─────────────────

const flat = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
const numbers = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(',', '.'));

function check(t: Task, x: Extracted): { ok: Partial<Extracted>; rejected: string[] } {
  const rejected: string[] = [];
  const ev = new Map(t.evidence.map((e) => [e.id, flat(e.text)]));
  const all = flat(t.evidence.map((e) => e.text).join(' '));
  const quoted = (id: string, q: string) => q.trim().length >= 3 && (ev.get(id)?.includes(flat(q)) ?? false);
  const ok: Partial<Extracted> = {};

  const text = x.explanation.trim();
  if (text) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    const unsupported = x.explanation_quotes.filter((q) => !quoted(q.evidence, q.quote));
    const strayNumbers = numbers(text).filter((n) => !numbers(all).includes(n));
    if (BANNED.test(text)) rejected.push(`explanation uses a banned word: "${text.match(BANNED)![0]}"`);
    else if (sentences > 2 || text.length > 320) rejected.push('explanation longer than two short sentences');
    else if (!x.explanation_quotes.length) rejected.push('explanation has no supporting quote');
    else if (unsupported.length) rejected.push(`explanation quote not found in ${unsupported[0].evidence}: "${unsupported[0].quote.slice(0, 80)}"`);
    else if (strayNumbers.length) rejected.push(`explanation states a number not in the evidence: ${strayNumbers.join(', ')}`);
    else { ok.explanation = text; ok.explanation_quotes = x.explanation_quotes; }
  }

  if (x.origin !== 'unknown') {
    if (x.origin_quote && all.includes(flat(x.origin_quote))) { ok.origin = x.origin; ok.origin_quote = x.origin_quote; }
    else rejected.push(`origin "${x.origin}" without a matching quote`);
  }

  const limits = [];
  for (const l of x.us_limits) {
    const src = t.evidence.find((e) => e.id === l.evidence);
    if (!t.wants_limits || src?.source !== 'ecfr') { rejected.push('limit not from a single-substance CFR excerpt'); continue; }
    if (!quoted(l.evidence, l.quote)) { rejected.push(`limit quote not found: "${l.quote.slice(0, 80)}"`); continue; }
    const missing = numbers(l.statement).filter((n) => !numbers(l.quote).includes(n));
    if (missing.length) { rejected.push(`limit statement has numbers not in its quote: ${missing.join(', ')}`); continue; }
    limits.push(l);
  }
  if (limits.length) ok.us_limits = limits;
  return { ok, rejected };
}

// ─── plumbing ────────────────────────────────────────────────────────────────

function client(): Anthropic {
  const envFile = join(ROOT, '.env.local');
  if (!process.env.ANTHROPIC_API_KEY && existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const m = /^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
      if (m) process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, '');
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('No ANTHROPIC_API_KEY. Put it in pipeline/.env.local (gitignored) as ANTHROPIC_API_KEY=sk-ant-…');
    process.exit(2);
  }
  return new Anthropic();
}

/** Per million tokens; batch is half. Cache reads ~0.1×. Keep in step with the API price list. */
const PRICE: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
};

function parse(message: Anthropic.Message): Extracted | string {
  if (message.stop_reason === 'refusal') return 'refused';
  if (message.stop_reason === 'max_tokens') return 'ran out of tokens';
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  try { return JSON.parse(text) as Extracted; } catch { return 'not JSON'; }
}

interface Store { model: string; effort: string; extracted_at: string; rows: Record<string, { hash: string } & Partial<Extracted>>; rejected: Record<string, string[]> }
const loadStore = (): Store => (existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : { model: MODEL, effort: EFFORT, extracted_at: '', rows: {}, rejected: {} });

function record(store: Store, t: Task, result: Extracted | string) {
  if (typeof result === 'string') { store.rejected[t.id] = [result]; delete store.rows[t.id]; return; }
  const { ok, rejected } = check(t, result);
  // Each quote carries the source document it came from, so the verifier can
  // re-check it against the CURRENT download, not against this task file.
  const sourceOf = (id: string) => t.evidence.find((e) => e.id === id)?.source ?? '';
  if (ok.explanation_quotes) ok.explanation_quotes = ok.explanation_quotes.map((q) => ({ ...q, source: sourceOf(q.evidence) }));
  if (ok.origin_quote) (ok as any).origin_source = t.evidence.find((e) => flat(e.text).includes(flat(ok.origin_quote!)))?.source ?? '';
  if (ok.us_limits) ok.us_limits = ok.us_limits.map((l) => ({ ...l, source: 'ecfr', section: t.evidence.find((e) => e.id === l.evidence)!.label.match(/^21 CFR (\S+)/)![1] }));
  if (Object.keys(ok).length) store.rows[t.id] = { hash: t.hash, ...ok };
  else delete store.rows[t.id];
  if (rejected.length) store.rejected[t.id] = rejected; else delete store.rejected[t.id];
}

function saveStore(store: Store) {
  store.model = MODEL;
  store.effort = EFFORT;
  store.extracted_at = new Date().toISOString();
  mkdirSync(dirname(OUTPUT), { recursive: true });
  const ids = Object.keys(store.rows).sort();
  writeFileSync(OUTPUT, `{\n"model": ${JSON.stringify(store.model)},\n"effort": ${JSON.stringify(store.effort)},\n"extracted_at": ${JSON.stringify(store.extracted_at)},\n"rows": {\n${ids.map((id) => `${JSON.stringify(id)}: ${JSON.stringify(store.rows[id])}`).join(',\n')}\n},\n"rejected": ${JSON.stringify(store.rejected, null, 1)}\n}\n`);
}

// ─── commands ────────────────────────────────────────────────────────────────

if (cmd === 'prepare') {
  const tasks = prepare();
  const chars = tasks.reduce((s, t) => s + userMessage(t).length, 0);
  const inTok = chars / 3.6 + tasks.length * 40;
  const sysTok = SYSTEM.length / 3.6;
  // Measured on the pilot once it runs; until then a conservative guess that
  // includes thinking at the chosen effort.
  const outTok = tasks.length * (EFFORT === 'low' ? 450 : EFFORT === 'medium' ? 800 : 1400);
  console.log(`${tasks.length} ingredients to extract (${tasks.filter((t) => t.wants_limits).length} with a single-substance CFR section)`);
  console.log(`≈ ${(inTok / 1e6).toFixed(1)}M input tokens (+ a ${Math.round(sysTok)}-token cached system prompt), ≈ ${(outTok / 1e6).toFixed(1)}M output tokens at effort ${EFFORT}`);
  for (const [m, [i, o]] of Object.entries(PRICE)) {
    const full = (inTok * i + outTok * o) / 1e6;
    console.log(`  ${m.padEnd(18)} batch ≈ $${(full / 2).toFixed(0)}   (live ≈ $${full.toFixed(0)})`);
  }
  console.log(`\nwrote ${TASKS}. Next: pilot (≈30 live requests) to measure real cost and quality.`);
} else if (cmd === 'pilot') {
  const n = Number(args[1] && !args[1].startsWith('--') ? args[1] : 30);
  const tasks: Task[] = existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : prepare();
  // A spread: every tenth-ish task, CFR-section tasks over-represented.
  const withCfr = tasks.filter((t) => t.wants_limits);
  const without = tasks.filter((t) => !t.wants_limits);
  const pick = [...withCfr.filter((_, i) => i % Math.max(1, Math.floor(withCfr.length / Math.ceil(n / 2))) === 0).slice(0, Math.ceil(n / 2)),
    ...without.filter((_, i) => i % Math.max(1, Math.floor(without.length / Math.floor(n / 2))) === 0).slice(0, Math.floor(n / 2))];
  const c = client();
  const store = loadStore();
  let inT = 0, outT = 0, cacheR = 0, cacheW = 0;
  const lines = [`# Extraction pilot — ${MODEL}, effort ${EFFORT}, ${pick.length} ingredients`, ''];
  for (const t of pick) {
    const m = await c.messages.create(params(t));
    inT += m.usage.input_tokens; outT += m.usage.output_tokens;
    cacheR += m.usage.cache_read_input_tokens ?? 0; cacheW += m.usage.cache_creation_input_tokens ?? 0;
    const res = parse(m);
    record(store, t, res);
    const got = store.rows[t.id];
    lines.push(`## ${t.name} (\`${t.id}\`)`, '', `- **was:** ${JSON.parse(readFileSync(join(ROOT, 'out/ingredients.json'), 'utf8')).find((r: Ingredient) => r.id === t.id).plain_explanation}`);
    lines.push(`- **now:** ${got?.explanation ?? '(unchanged)'}`);
    if (got?.origin) lines.push(`- **origin:** ${got.origin} — "${got.origin_quote}"`);
    for (const l of got?.us_limits ?? []) lines.push(`- **US ${l.kind === 'legal_limit' ? 'limit' : 'reported usage'}:** ${l.statement} — "${l.quote}"`);
    for (const r of store.rejected[t.id] ?? []) lines.push(`- ✗ rejected: ${r}`);
    lines.push('');
    process.stdout.write('.');
  }
  const [pi, po] = PRICE[MODEL] ?? [0, 0];
  const cost = (inT * pi + cacheR * pi * 0.1 + cacheW * pi * 1.25 + outT * po) / 1e6;
  const all: Task[] = JSON.parse(readFileSync(TASKS, 'utf8'));
  const accepted = pick.filter((t) => store.rows[t.id]?.explanation).length;
  lines.splice(1, 0, `Measured: ${inT} input, ${cacheR} cache-read, ${outT} output tokens · $${cost.toFixed(2)} live · explanations accepted ${accepted}/${pick.length}.`,
    `Projected full run (${all.length} ingredients, batch at half price): ≈ $${((cost / pick.length) * all.length / 2).toFixed(0)}.`, '');
  writeFileSync(join(ROOT, 'out/extract-pilot.md'), lines.join('\n') + '\n');
  saveStore(store);
  console.log(`\n${lines[1]}\n${lines[2]}\nwrote out/extract-pilot.md and curation/extracted.json`);
} else if (cmd === 'submit') {
  const tasks: Task[] = existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : prepare();
  const store = loadStore();
  // Ingredients already extracted against identical evidence are skipped.
  const todo = tasks.filter((t) => store.rows[t.id]?.hash !== t.hash);
  const c = client();
  const batch = await c.messages.batches.create({ requests: todo.map((t) => ({ custom_id: t.id, params: params(t) })) });
  writeFileSync(STATE, JSON.stringify({ batch_id: batch.id, model: MODEL, effort: EFFORT, submitted_at: new Date().toISOString(), count: todo.length }));
  console.log(`submitted batch ${batch.id}: ${todo.length} ingredients (${tasks.length - todo.length} already current). Run "collect" in an hour or so.`);
} else if (cmd === 'collect') {
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  const tasks = new Map((JSON.parse(readFileSync(TASKS, 'utf8')) as Task[]).map((t) => [t.id, t]));
  const c = client();
  const batch = await c.messages.batches.retrieve(state.batch_id);
  if (batch.processing_status !== 'ended') {
    console.log(`batch ${batch.id}: ${batch.processing_status} — ${JSON.stringify(batch.request_counts)}. Try again later.`);
    process.exit(0);
  }
  const store = loadStore();
  let inT = 0, outT = 0, ok = 0, failed = 0;
  for await (const r of await c.messages.batches.results(state.batch_id)) {
    const t = tasks.get(r.custom_id);
    if (!t) continue;
    if (r.result.type !== 'succeeded') { store.rejected[t.id] = [`batch ${r.result.type}`]; failed++; continue; }
    inT += r.result.message.usage.input_tokens; outT += r.result.message.usage.output_tokens;
    record(store, t, parse(r.result.message));
    if (store.rows[t.id]?.explanation) ok++;
  }
  saveStore(store);
  const [pi, po] = PRICE[state.model] ?? [0, 0];
  console.log(`collected: ${ok} explanations accepted, ${Object.keys(store.rejected).length} with rejections, ${failed} failed requests`);
  console.log(`tokens: ${inT} in, ${outT} out ≈ $${((inT * pi + outT * po) / 2e6).toFixed(2)} at batch price`);
  console.log('wrote curation/extracted.json — rebuild, verify, emit to apply it.');
} else if (cmd === 'selftest') {
  // Free: proves the acceptance gate with made-up model outputs, no API call.
  const tasks: Task[] = existsSync(TASKS) ? JSON.parse(readFileSync(TASKS, 'utf8')) : prepare();
  const t = tasks.find((x) => x.wants_limits && /\d/.test(x.evidence[0].text) && /not to exceed|percent|parts per million/.test(x.evidence[0].text))!;
  const e1 = t.evidence[0];
  const realQuote = e1.text.slice(0, 60);
  const numQuote = e1.text.match(/[^.;]*(?:not to exceed|percent|parts per million)[^.;]*/)![0].trim();
  const base: Extracted = { explanation: 'A substance used in food.', explanation_quotes: [{ evidence: 'E1', quote: realQuote }], origin: 'unknown', origin_quote: '', us_limits: [] };
  const cases: [string, Extracted, (r: ReturnType<typeof check>) => boolean][] = [
    ['a grounded explanation is accepted', base, (r) => !!r.ok.explanation && !r.rejected.length],
    ['an invented quote is rejected', { ...base, explanation_quotes: [{ evidence: 'E1', quote: 'this sentence is not in the regulation' }] }, (r) => !r.ok.explanation],
    ['a quote cited to the wrong excerpt is rejected', { ...base, explanation_quotes: [{ evidence: 'E9', quote: realQuote }] }, (r) => !r.ok.explanation],
    ['a judgment word is rejected', { ...base, explanation: 'A safe substance used in food.' }, (r) => !r.ok.explanation],
    ['a number not in the evidence is rejected', { ...base, explanation: 'Used at 987654 percent in food.' }, (r) => !r.ok.explanation],
    ['three sentences are rejected', { ...base, explanation: 'One. Two. Three.' }, (r) => !r.ok.explanation],
    ['a quoted CFR limit is accepted', { ...base, us_limits: [{ kind: 'legal_limit', statement: `limited as stated (${(numQuote.match(/\d+(?:\.\d+)?/) ?? [''])[0]})`, evidence: 'E1', quote: numQuote }] }, (r) => (r.ok.us_limits?.length ?? 0) === 1],
    ['a limit whose number is not in its quote is rejected', { ...base, us_limits: [{ kind: 'legal_limit', statement: 'limited to 31337 percent', evidence: 'E1', quote: numQuote }] }, (r) => !r.ok.us_limits],
    ['an origin with no quote is rejected', { ...base, origin: 'synthetic', origin_quote: 'made in a lab, trust me' }, (r) => !r.ok.origin],
  ];
  let failed = 0;
  for (const [name, x, pass] of cases) {
    const ok = pass(check(t, x));
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${name}`);
  }
  console.log(failed ? `FAIL (${failed})` : `PASS — gate tested on ${t.name} (${e1.label})`);
  process.exit(failed ? 1 : 0);
} else {
  console.log('usage: npx tsx ../pipeline/extract.ts prepare | selftest | pilot [n] | submit | collect   [--model …] [--effort …]');
}
