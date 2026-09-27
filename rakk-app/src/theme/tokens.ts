/**
 * Design tokens — §5 of rakk-phase1-app-build.md, replicated exactly.
 *
 * Do not introduce a color outside this file. In particular:
 *  - `primary` marks VERIFIED FACT (citation chips, primary CTA, the "clear"
 *    state). It never means "good".
 *  - `flag` means ONLY "here's an ingredient worth reading about". It never
 *    means "warning" or "danger", and it is never graded against another color.
 *
 * There is deliberately no scale of severity colors here, and there must
 * never be one.
 */

export const color = {
  bg: '#F4F6F3', // pale sage-white — NOT cream/#FFF8F0
  surface: '#FFFFFF',
  surface2: '#EDF1EC',
  border: '#DCE3D9',
  text: '#1E2A22', // deep forest-black-green, not pure black
  textMuted: '#6E7A70',
  primary: '#2F6B5E', // deep teal-green — "verified fact" elements
  primaryBright: '#3E8A78',
  primarySoft: 'rgba(47,107,94,0.10)',
  flag: '#B07A2C', // muted amber — "worth reading about", never "danger"
  flagSoft: 'rgba(176,122,44,0.12)',
} as const;

/** §5: "Radius: 14–22px, pills fully rounded" */
export const radius = {
  sm: 14,
  md: 18,
  lg: 22,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

/** Horizontal gutter used by every screen. */
export const gutter = space.lg;

/**
 * Camera-overlay scrims. The Scan screen is the one screen that inverts, since
 * it sits over a dark camera preview; these are translucent whites on that
 * ground, not new brand colours. Kept here so the colour-discipline guard in
 * scripts/check-copy.sh has nothing to miss.
 */
export const scrim = {
  frameFill: 'rgba(255,255,255,0.04)',
  controlBg: 'rgba(255,255,255,0.12)',
  placeholder: 'rgba(255,255,255,0.32)',
  shutterRing: 'rgba(255,255,255,0.5)',
  onDarkMuted: 'rgba(255,255,255,0.72)',
} as const;
