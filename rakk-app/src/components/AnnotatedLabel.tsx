import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TextStyle, View } from 'react-native';
import { ResolvedScan, LabelRun, ingredientById } from '../types/scan';
import { color, radius, space } from '../theme/tokens';
import { mono, sans } from '../theme/type';
import { IngredientCard, UnmatchedIngredientCard } from './IngredientCard';
import { track } from '../services/analytics';

/**
 * ═══ THE SIGNATURE INTERACTION (§5) ═══
 *
 * "The ingredient list renders as real running text (like the actual label),
 *  with flagged ingredients underlined rather than pulled into a separate
 *  'watch list'. Tapping a flagged word expands an explanation card directly
 *  below it in the flow — the translation happens in place, on the label
 *  itself, not in a disconnected panel."
 *
 * How that is achieved here, and why it is built this way:
 *
 *  - Collapsed, the whole list is ONE <Text> with nested <Text> runs. That
 *    matters: nested Text keeps real text reflow, so it wraps and reads exactly
 *    like printed label copy. A flex-wrap row of word chips would look similar
 *    at a glance but would break long ingredient names across the layout.
 *
 *  - Expanded, the paragraph is split into exactly two flowing paragraphs at
 *    the tapped term, with the card between them. The line holding the tapped
 *    word ends early and the card opens underneath it — the label itself parts
 *    at that word. The separator that follows the term (", ") is pulled up onto
 *    the first paragraph so the continuation never opens on a stray comma.
 *
 *  - One term open at a time. Splitting at several points at once leaves the
 *    label visually shredded, which costs more than it gains.
 *
 * Underline colour: iOS honours `textDecorationColor`, Android does not and
 * draws the underline in the text colour. Rather than let the signal degrade,
 * the open term also takes a `flagSoft` wash, which renders identically on both
 * platforms and ties the term to its card.
 */

const flaggedText: TextStyle = {
  textDecorationLine: 'underline',
  ...Platform.select({
    ios: { textDecorationColor: color.flag },
    default: {},
  }),
};

const unmatchedText: TextStyle = {
  textDecorationLine: 'underline',
  textDecorationStyle: 'dotted',
  color: color.textMuted,
  ...Platform.select({
    ios: { textDecorationColor: color.textMuted },
    default: {},
  }),
};

/** Leading separator of a run, so a split never starts a paragraph on ", ". */
function splitSeparator(text: string): [string, string] {
  const m = /^[\s,;.]+/.exec(text);
  if (!m) return ['', text];
  return [m[0], text.slice(m[0].length)];
}

function Paragraph({
  runs,
  offset,
  openIndex,
  onPressRun,
}: {
  runs: LabelRun[];
  offset: number;
  openIndex: number | null;
  onPressRun: (index: number) => void;
}) {
  return (
    <Text style={mono.label}>
      {runs.map((run, localIndex) => {
        const index = offset + localIndex;
        const interactive = run.flagged || run.unmatched;

        if (!interactive) {
          // A comma must never start a line. Nested <Text> creates a break
          // opportunity at the element boundary, so a run that opens on
          // punctuation gets a WORD JOINER (U+2060) in front of it — a
          // standard Unicode "do not break here", honoured by CoreText, ICU
          // and browsers alike.
          const glued = /^[,;.)\]]/.test(run.text) ? `\u2060${run.text}` : run.text;
          return <Text key={index}>{glued}</Text>;
        }

        const isOpen = index === openIndex;
        return (
          <Text
            key={index}
            onPress={() => onPressRun(index)}
            suppressHighlighting
            accessible
            // Deliberately NOT accessibilityRole="button". A role here makes
            // react-native-web emit a <button>, which is an atomic inline-block
            // — the line can then break straight after the term and strand the
            // following comma at the start of the next line. A plain inline run
            // stays in the text flow, which is the whole point of rendering the
            // label as running text. The accessible label below carries the
            // affordance instead.
            accessibilityLabel={
              run.unmatched
                ? `${run.text}. Not in the database yet.`
                : `${run.text}. Tap to read what this is.`
            }
            style={[
              run.unmatched ? unmatchedText : flaggedText,
              isOpen ? { backgroundColor: color.flagSoft } : null,
            ]}
          >
            {run.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function AnnotatedLabel({ scan }: { scan: ResolvedScan }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    // §14: a card opening IS the scan-frequency signal that decides which
    // ingredients get dosage research first (§12.B2). The ingredient id only.
    const id = scan.runs[index]?.ingredient_id;
    if (id && openIndex !== index) track({ event: 'card_expanded', ingredient_id: id });
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  /**
   * THE INVARIANT: `runs: []` means this label has not been through matching.
   * It renders as the plain printed list — nothing underlined, nothing
   * tappable — which is exactly what build-order step 2 produces. Step 3 fills
   * `runs` in and this branch stops being taken, with no other code change.
   */
  if (scan.runs.length === 0) {
    return (
      <View style={s.sheet}>
        <Text style={mono.label}>{scan.product.raw_ingredient_text}</Text>
      </View>
    );
  }

  if (openIndex === null) {
    return (
      <View style={s.sheet}>
        <Paragraph runs={scan.runs} offset={0} openIndex={null} onPressRun={toggle} />
      </View>
    );
  }

  const openRun = scan.runs[openIndex];
  const head = scan.runs.slice(0, openIndex + 1);
  const rest = scan.runs.slice(openIndex + 1);

  // Pull the separator that follows the open term up onto the first paragraph.
  let leading = '';
  let tail = rest;
  if (rest.length > 0) {
    const [sep, remainder] = splitSeparator(rest[0].text);
    leading = sep;
    tail = remainder.length > 0 ? [{ ...rest[0], text: remainder }, ...rest.slice(1)] : rest.slice(1);
  }

  const ingredient = ingredientById(scan, openRun.ingredient_id);

  return (
    <View style={s.sheet}>
      <Text style={mono.label}>
        <Paragraph runs={head} offset={0} openIndex={openIndex} onPressRun={toggle} />
        {leading ? <Text>{leading.replace(/\s+$/, '')}</Text> : null}
      </Text>

      {ingredient ? (
        <IngredientCard ingredient={ingredient} />
      ) : (
        <UnmatchedIngredientCard name={openRun.text} />
      )}

      {tail.length > 0 ? (
        <Paragraph
          runs={tail}
          offset={openIndex + 1}
          openIndex={openIndex}
          onPressRun={toggle}
        />
      ) : null}
    </View>
  );
}

/** The instruction that makes the interaction discoverable without a tutorial. */
export function LabelHint({ scan }: { scan: ResolvedScan }) {
  // Not matched yet (step 2). Say what this is, and don't imply a conclusion
  // we haven't reached — "nothing to translate" would be a claim, not a fact.
  if (scan.runs.length === 0) {
    return (
      <Text style={[sans.meta, { marginBottom: space.md }]}>
        Exactly as printed on the package.
      </Text>
    );
  }
  if (scan.flagged_count === 0) {
    return (
      <Text style={[sans.meta, { marginBottom: space.md }]}>
        Nothing on this label needs a translation — it&apos;s all everyday ingredients.
      </Text>
    );
  }
  return (
    <Text style={[sans.meta, { marginBottom: space.md }]}>
      Tap any underlined ingredient to read what it is.
    </Text>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.base,
  },
});
