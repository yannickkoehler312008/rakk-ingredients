/**
 * Typography — §5 / §9.
 *
 * The three-family split is a hard requirement, not a preference (§9:
 * "Consistent use of the mono font specifically for ingredient names/citations
 * and serif only for product names/headers — don't let these bleed together"):
 *
 *   serif (Newsreader 500–600) → headers, product names. Nothing else.
 *   sans  (Inter)              → UI chrome, explanation body, chat messages.
 *   mono  (IBM Plex Mono)      → the ingredient list + citation chips. It
 *                                should read like a chemical label.
 */

import { TextStyle } from 'react-native';
import { color } from './tokens';

export const font = {
  serif500: 'Newsreader_500Medium',
  serif600: 'Newsreader_600SemiBold',
  sans400: 'Inter_400Regular',
  sans500: 'Inter_500Medium',
  sans600: 'Inter_600SemiBold',
  sans700: 'Inter_700Bold',
  mono400: 'IBMPlexMono_400Regular',
  mono500: 'IBMPlexMono_500Medium',
  mono600: 'IBMPlexMono_600SemiBold',
} as const;

/** SERIF — headers and product names only. */
export const serif: Record<'display' | 'title' | 'productName' | 'cardTitle', TextStyle> = {
  display: { fontFamily: font.serif600, fontSize: 30, lineHeight: 37, color: color.text },
  title: { fontFamily: font.serif600, fontSize: 25, lineHeight: 31, color: color.text },
  productName: { fontFamily: font.serif600, fontSize: 19, lineHeight: 25, color: color.text },
  cardTitle: { fontFamily: font.serif500, fontSize: 17, lineHeight: 23, color: color.text },
};

/** SANS — UI chrome, body copy, chat. */
export const sans: Record<
  'body' | 'bodyStrong' | 'meta' | 'metaStrong' | 'button' | 'sectionLabel' | 'micro',
  TextStyle
> = {
  body: { fontFamily: font.sans400, fontSize: 15, lineHeight: 22, color: color.text },
  bodyStrong: { fontFamily: font.sans600, fontSize: 15, lineHeight: 22, color: color.text },
  meta: { fontFamily: font.sans400, fontSize: 13, lineHeight: 19, color: color.textMuted },
  metaStrong: { fontFamily: font.sans500, fontSize: 13, lineHeight: 19, color: color.text },
  button: { fontFamily: font.sans600, fontSize: 16, lineHeight: 21, color: color.surface },
  /** Small letterspaced uppercase label — the "reference document" texture. */
  sectionLabel: {
    fontFamily: font.sans600,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: color.textMuted,
  },
  micro: { fontFamily: font.sans400, fontSize: 12, lineHeight: 17, color: color.textMuted },
};

/** MONO — the ingredient list, ingredient names, citation chips. */
export const mono: Record<'label' | 'ingredientName' | 'citation' | 'chip' | 'data', TextStyle> = {
  /** The running ingredient list itself. Generous leading so underlines breathe. */
  label: { fontFamily: font.mono400, fontSize: 14.5, lineHeight: 27, color: color.text },
  ingredientName: { fontFamily: font.mono500, fontSize: 15, lineHeight: 21, color: color.text },
  citation: { fontFamily: font.mono400, fontSize: 11.5, lineHeight: 16, color: color.primary },
  chip: { fontFamily: font.mono500, fontSize: 11.5, lineHeight: 16 },
  data: { fontFamily: font.mono400, fontSize: 13, lineHeight: 19, color: color.text },
};
