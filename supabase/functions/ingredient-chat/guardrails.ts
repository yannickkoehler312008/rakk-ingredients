/**
 * Guardrails for the ingredient chat assistant — §1, §4, §9, §13.
 *
 * This module is deliberately PURE and dependency-free: no Deno APIs, no fetch,
 * no SDK imports. The Edge Function imports it, and `scripts/test-guardrails.mjs`
 * runs it under Node. The rules that keep this product out of
 * unlicensed-health-claim territory should be testable without a network, an
 * API key, or a Deno install.
 *
 * §4 is explicit that the chatbot "inherits the exact copy discipline from
 * §1/§9 ... This needs its own explicit system-prompt-level guardrail, since a
 * chat interface is much easier to accidentally lead into 'so is this safe for
 * me?' territory than a static card is."
 *
 * A system prompt is a request, not a guarantee. So there are three layers:
 *   1. SYSTEM_PROMPT        — tells the model the rules
 *   2. screenReply()        — checks the reply and withholds it if broken
 *   3. classifyQuestion()   — routes personal-health questions without a call
 */

export interface ChatJurisdiction {
  jurisdiction: string;
  status: string;
  citation: string | null;
}

export interface ChatIngredient {
  canonical_name: string;
  e_number_ins_code: string | null;
  category: string;
  origin: string;
  plain_explanation: string;
  allergen_flags: string[];
  jurisdictions: ChatJurisdiction[];
  usage_context: {
    threshold_of_concern: string | null;
    typical_concentration_range: string;
    product_type_context: string;
  } | null;
  risk_assessment_refs: string[] | null;
  flagged: boolean;
}

export interface ChatContext {
  product_name: string;
  brand: string;
  raw_ingredient_text: string;
  ingredients: ChatIngredient[];
  unmatched_names: string[];
}

/* ────────────────────────────── LAYER 1 ────────────────────────────── */

export const SYSTEM_PROMPT = `You are the ingredient assistant inside Rakk Ingredients, an app that translates packaged-food ingredient labels into plain English.

WHAT YOU ARE
You are a more conversational way to explore facts the user is already looking at on an ingredient card. You are not a second product with looser rules.

YOUR ONLY SOURCE
Everything you say must come from the PRODUCT CONTEXT supplied in this conversation. You have no other source. You may explain, rephrase, compare and summarise what is in that context. You may use general chemistry or food-science knowledge only to make the supplied facts easier to understand — never to add new facts about this product, its ingredients, their regulatory status, or their dosage.

If the context does not contain what is needed to answer, say so plainly. For example: "The entry for that one doesn't have dosage data yet — all we have is its classification." Never fill a gap with something that sounds right. An unsourced answer is worse than no answer.

HOW YOU WRITE
State facts and classifications. Let the user draw the conclusion.

Never use these words about an ingredient or product: harmful, toxic, dangerous, unsafe, hazardous, risky, bad, nasty, scary, poison, carcinogen. This holds even if the user uses them first.

Never rate, score, grade or rank an ingredient or product, and never say one is better or worse than another. Rakk does not do verdicts. If asked which of two products is better, give the factual differences between them and stop there.

Do not reassure and do not alarm. "There's nothing to worry about" is a verdict just as much as "this is dangerous" is.

WHEN ASKED "IS THIS SAFE?"
Do not answer it as asked — it is a verdict question. Redirect to what is actually established: which regulators have classified the ingredient, how, at what levels, and what the citation is. Something like: "This is classified as GRAS by the FDA under 21 CFR 184.1733, limited to 0.1 percent by weight. That's the extent of what's regulatorily established — Rakk doesn't go beyond that."

WHEN ASKED FOR PERSONAL HEALTH ADVICE
Questions about pregnancy, medication, allergies, a diagnosed condition, or whether a person specifically should eat something are outside what this app does. Decline plainly, say why in one line, and point to a doctor, pharmacist or dietitian. Then offer what you can give: the facts on the label. Do not hedge your way into an answer anyway.

SHAPE
Two or three short paragraphs at most. Plain language a first-time label-reader can follow, precise enough that a chemist would not wince. Cite the regulation when you state a regulatory fact. No bullet lists unless the user asks for one.`;

/** Render the scan as the model's only source of truth. */
export function buildContext(ctx: ChatContext): string {
  const lines: string[] = [];
  lines.push('PRODUCT CONTEXT');
  lines.push(`Product: ${ctx.product_name}${ctx.brand ? ` — ${ctx.brand}` : ''}`);
  lines.push('');
  lines.push('Ingredient list exactly as printed on the package:');
  lines.push(ctx.raw_ingredient_text);
  lines.push('');

  if (ctx.ingredients.length === 0) {
    lines.push('No ingredients on this label matched a database entry.');
  } else {
    lines.push(`Database entries for ${ctx.ingredients.length} of them:`);
    for (const i of ctx.ingredients) {
      lines.push('');
      lines.push(`— ${i.canonical_name}${i.e_number_ins_code ? ` (${i.e_number_ins_code})` : ''}`);
      lines.push(`  flagged on the label: ${i.flagged ? 'yes' : 'no (everyday ingredient)'}`);
      lines.push(`  category: ${i.category}; origin: ${i.origin}`);
      lines.push(`  what it is: ${i.plain_explanation}`);
      if (i.allergen_flags.length) lines.push(`  derived from: ${i.allergen_flags.join(', ')}`);
      if (i.jurisdictions.length) {
        for (const j of i.jurisdictions) {
          lines.push(`  ${j.jurisdiction}: ${j.status}${j.citation ? ` [${j.citation}]` : ''}`);
        }
      } else {
        lines.push('  no regulatory entry on file yet');
      }
      if (i.usage_context) {
        lines.push(
          `  threshold of concern: ${i.usage_context.threshold_of_concern ?? 'none established'}`,
        );
        lines.push(`  typical use: ${i.usage_context.typical_concentration_range}`);
        lines.push(`  exposure: ${i.usage_context.product_type_context}`);
      } else {
        lines.push('  no dosage data on file yet');
      }
      if (i.risk_assessment_refs?.length) {
        lines.push(`  sources: ${i.risk_assessment_refs.join('; ')}`);
      }
    }
  }

  if (ctx.unmatched_names.length) {
    lines.push('');
    lines.push(
      `Printed on the label but with no database entry yet: ${ctx.unmatched_names.join(', ')}. ` +
        'We have nothing on these — say so rather than describing them.',
    );
  }

  return lines.join('\n');
}

/* ────────────────────────────── LAYER 2 ────────────────────────────── */

/**
 * Phrases that contain a banned word but are legitimate regulatory language.
 * "Generally Recognized as Safe" is the single most important fact this app
 * reports — a naive ban on "safe" would suppress every GRAS citation.
 */
const PROTECTED_PHRASES = [
  'generally recognized as safe',
  'generally recognised as safe',
  'gras',
  'food safety',
  'safety assessment',
  'european food safety authority',
  'risk assessment',
  'acceptable daily intake',
];

/** Neutral filler that protected phrases are swapped for before scanning. */
const REDACTED = ' xxprotectedxx ';

/** Judgment adjectives — §9 bans these outright in ingredient copy. */
const BANNED_WORDS = [
  'harmful', 'toxic', 'toxin', 'dangerous', 'unsafe', 'hazardous',
  'poison', 'poisonous', 'carcinogen', 'carcinogenic', 'nasty', 'scary', 'risky',
];

/** Verdict shapes — the thing §1 says the product exists NOT to do. */
const BANNED_PHRASES = [
  'is safe to', 'is safe for', 'perfectly safe', 'completely safe', 'safe to eat',
  'bad for you', 'good for you', 'worse than', 'better than', 'healthier',
  'you should avoid', 'i recommend', 'i would avoid', 'stay away from',
  'nothing to worry about', 'do not worry', 'no cause for concern',
  'if i were you',
];

export type ScreenVerdict =
  | { ok: true; reply: string }
  | { ok: false; matched: string; reason: 'banned_word' | 'banned_phrase' };

/**
 * Check a model reply before it reaches the user.
 *
 * §9's copy rule is absolute, and a system prompt is a request rather than a
 * guarantee. If a reply breaks the rule it is WITHHELD — the user sees a
 * designed fallback instead. Showing the banned copy and apologising for it
 * would be exactly the failure the rule exists to prevent.
 */
export function screenReply(reply: string): ScreenVerdict {
  let haystack = ` ${reply.toLowerCase().replace(/\s+/g, ' ')} `;
  haystack = haystack.replace(/[‘’]/g, "'");

  // Blank out legitimate regulatory language first, so "Generally Recognized
  // as Safe" can't trip the "safe" checks below.
  for (const phrase of PROTECTED_PHRASES) {
    haystack = haystack.split(phrase).join(REDACTED);
  }

  for (const word of BANNED_WORDS) {
    if (new RegExp(`[^a-z]${word}[^a-z]`).test(haystack)) {
      return { ok: false, matched: word, reason: 'banned_word' };
    }
  }
  for (const phrase of BANNED_PHRASES) {
    if (haystack.includes(phrase)) {
      return { ok: false, matched: phrase, reason: 'banned_phrase' };
    }
  }
  return { ok: true, reply };
}

/** Shown when a reply is withheld. States what happened; blames nobody. */
export const WITHHELD_REPLY =
  "I can't put that answer in the words it came out in — Rakk states classifications and citations rather than judgements. Ask me what a specific ingredient is, what its regulatory status says, or what dose that status applies at, and I can answer from the label.";

/* ────────────────────────────── LAYER 3 ────────────────────────────── */

const PERSONAL_HEALTH_PATTERNS: RegExp[] = [
  /\b(i'?m|i am|my wife|my partner|my husband|she'?s|he'?s)\s+(\d+\s+weeks\s+)?pregnan/i,
  /breast\s?feed|\bnursing\b/i,
  /\b(my|i have|i've got|diagnosed with)\s+(diabet|crohn|ibs|celiac|coeliac|kidney|liver|thyroid|cancer|hypertension|high blood pressure)/i,
  /\b(safe|ok|okay|alright|fine)\s+(for me|for my|to take|with my)\b/i,
  /\bi'?m allergic\b|\bmy allergy\b|\bmy child\b|\bmy son\b|\bmy daughter\b|\bmy baby\b|\bmy toddler\b/i,
  /\b(interact|interfere)\s+with\s+(my\s+)?(medication|meds|prescription|drug)/i,
  /\bshould i (eat|drink|avoid|stop|take|give)\b/i,
  /\bis (it|this) (safe|ok|okay) (for me|if i)\b/i,
];

export type QuestionKind = 'ordinary' | 'personal_health';

/**
 * Classify before spending a model call.
 *
 * §4 says the assistant should "decline to give personal health advice ...
 * the same way a card would, pointing to a professional instead". Deciding
 * that here rather than in the model makes the refusal deterministic — it
 * cannot be talked out of it — and costs nothing (§8's cost discipline).
 */
export function classifyQuestion(question: string): QuestionKind {
  return PERSONAL_HEALTH_PATTERNS.some((re) => re.test(question))
    ? 'personal_health'
    : 'ordinary';
}

export const PERSONAL_HEALTH_REPLY =
  "That one's outside what Rakk can answer — questions about your own health need someone who knows your situation, and that's a doctor, pharmacist or dietitian rather than a label-reading app.\n\nWhat I can do is tell you exactly what's on this label: what any ingredient is, which regulators have classified it and how, and the dose that classification applies at. Ask me about any of those and I'll pull it straight from the entry.";
