import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { color, radius, space } from '../theme/tokens';
import { mono, sans } from '../theme/type';

/** Small letterspaced uppercase label. The "reference document" texture (§5). */
export function SectionLabel({ children, style }: { children: string; style?: ViewStyle }) {
  return (
    <View style={[{ marginBottom: space.sm }, style]}>
      <Text style={sans.sectionLabel}>{children}</Text>
    </View>
  );
}

/** A white card on the sage ground. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.primaryBtn, pressed && { backgroundColor: color.primaryBright }]}
    >
      {icon}
      <Text style={[sans.button, icon ? { marginLeft: space.sm } : null]}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.secondaryBtn, pressed && { backgroundColor: color.surface2 }]}
    >
      <Text style={[sans.button, { color: color.text }]}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={10}>
      <Text style={[sans.body, { color: color.primary, fontFamily: 'Inter_500Medium' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The count chip on Home and Compare.
 *
 * Two states only, and neither is a grade: a COUNT of ingredients worth
 * reading about, or "clear" when there are none. `flag` here means exactly
 * what §5 says it means — "here's something to read" — and `primary` means
 * "verified fact". There is deliberately no third, worse-looking state.
 */
export function CountChip({ count }: { count: number }) {
  if (count === 0) {
    return (
      <View style={[s.chip, { backgroundColor: color.primarySoft }]}>
        <Text style={[mono.chip, { color: color.primary }]}>clear</Text>
      </View>
    );
  }
  return (
    <View style={[s.chip, { backgroundColor: color.flagSoft }]}>
      <Text style={[mono.chip, { color: color.flag }]}>{count} flagged</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.base,
  },
  primaryBtn: {
    backgroundColor: color.primary,
    borderRadius: radius.sm,
    paddingVertical: 17,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: 16,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
});
