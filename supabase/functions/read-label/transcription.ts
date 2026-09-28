/**
 * Transcription rules for reading a photographed ingredient panel — §6, §13.
 *
 * Pure and dependency-free so it can be tested under Node without Deno, an API
 * key, or a network — same arrangement as the chat guardrails.
 *
 * ═══ WHY THIS FILE IS CAREFUL ═══
 *
 * §6 suggests "Google Vision API or similar". A dedicated OCR engine
 * TRANSCRIBES: it reports the glyphs it saw, and when it is unsure it produces
 * garbage that is obviously garbage. A language model INTERPRETS: shown a
 * blurry "sodium ben?oate" it will helpfully write "sodium benzoate", and shown
 * a half-cut list it may complete it from what such lists usually contain.
 *
 * For this product that failure is severe. The whole proposition (§1, §9) is
 * that the app reports what is actually on the package, with citations. An
 * invented ingredient is worse than no reading at all — it is a confident
 * false statement about a real product someone is holding.
 *
 * Three defences, in order:
 *   1. the prompt below, which forbids completion and correction outright
 *   2. `parseTranscription()`, which treats any refusal marker as a failure
 *      rather than trying to salvage text
 *   3. the app shows the transcription to the user for confirmation before it
 *      is matched (a deliberate addition to §4's flow — see the README)
 */

export const TRANSCRIPTION_PROMPT = `You transcribe ingredient panels from photographs of food packaging. You are acting as an OCR engine, not as an assistant.

Return ONLY the ingredient list, exactly as printed. Nothing else — no preamble, no explanation, no markdown.

TRANSCRIBE, DO NOT INTERPRET. This is the whole job:

- Copy the characters you can actually see. Keep the original spelling, capitalisation, punctuation, percentages and brackets.
- Do NOT correct anything. If the package prints "MONOSODIUM GLUTAMATE (MSG)", write that. If it appears to say "sodum benzoate", write "sodum benzoate" — a misprint or a smudge is information, and correcting it destroys it.
- Do NOT complete anything. If the list runs off the edge of the photo or is hidden by a fold, stop where the text stops. Never add an ingredient because lists like this usually contain it.
- Do NOT reorder, deduplicate or tidy. Order is meaningful on an ingredient label.
- Do NOT translate.

WHERE TO START AND STOP
Ingredient panels usually begin with a heading like "INGREDIENTS:" or "INGREDIENTS". Start after that heading. Stop before allergen statements ("Contains: milk"), nutrition tables, storage instructions or marketing copy. If an allergen line is woven into the list itself, keep it where it appears.

IF A CHARACTER IS GENUINELY UNREADABLE
Write it as [?]. One marker per unreadable word. Do not guess.

IF YOU CANNOT DO THIS AT ALL
If the photograph shows no ingredient panel, or the text is too small, blurred, dark or angled to read, reply with exactly:

CANNOT_READ: <a short plain reason>

Use that for a genuinely unusable photo. Do not use it because a word or two is unclear — use [?] for those and transcribe the rest.`;

export type TranscriptionResult =
  | { kind: 'text'; text: string; unreadableMarkers: number }
  | { kind: 'cannot_read'; reason: string };

/** How many [?] markers before the reading is too damaged to be worth matching. */
export const MAX_UNREADABLE_MARKERS = 6;

export function parseTranscription(raw: string): TranscriptionResult {
  const text = raw.trim();

  if (!text) return { kind: 'cannot_read', reason: 'nothing came back from the photo' };

  const refusal = /^CANNOT_READ\s*:?\s*(.*)$/is.exec(text);
  if (refusal) {
    const reason = (refusal[1] ?? '').trim().replace(/\s+/g, ' ');
    return { kind: 'cannot_read', reason: reason || 'the panel could not be read' };
  }

  // A model asked to transcribe sometimes answers conversationally instead.
  // That is not a transcription, and passing it to the matcher would put a
  // sentence about the photo where the ingredient list should be.
  if (/^(i'm sorry|i am sorry|i cannot|i can't|sorry,|unfortunately|this image|the image)/i.test(text)) {
    return { kind: 'cannot_read', reason: 'the photo could not be read as an ingredient list' };
  }

  const unreadableMarkers = (text.match(/\[\?\]/g) ?? []).length;
  if (unreadableMarkers > MAX_UNREADABLE_MARKERS) {
    return { kind: 'cannot_read', reason: 'too much of the text was unreadable' };
  }

  // An ingredient list is a comma-separated run of words. A couple of words is
  // a caption or a stray heading, not a panel.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) {
    return { kind: 'cannot_read', reason: 'too little text to be an ingredient list' };
  }

  return { kind: 'text', text, unreadableMarkers };
}
