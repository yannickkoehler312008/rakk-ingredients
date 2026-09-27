import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { color, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { PrimaryButton, SecondaryButton } from './primitives';

/**
 * §9: "Real empty/error states: barcode not found, OCR failed, ingredient not
 * yet in database, chat assistant unavailable offline — each needs its own
 * designed state, not a generic error toast."
 *
 * Each of these names what happened, then gives the user a way forward (§4:
 * "always give the user an out"). None of them uses an alarmed tone, and none
 * blames the user.
 */

export function StateBlock({
  icon,
  title,
  body,
  primary,
  secondary,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
  primary?: { label: string; onPress?: () => void };
  secondary?: { label: string; onPress?: () => void };
}) {
  return (
    <View style={s.block}>
      <View style={s.iconWrap}>
        <Feather name={icon} size={20} color={color.primary} />
      </View>
      <Text style={[serif.title, { marginTop: space.base }]}>{title}</Text>
      <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>{body}</Text>
      {primary ? (
        <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>
          <PrimaryButton label={primary.label} onPress={primary.onPress} />
        </View>
      ) : null}
      {secondary ? (
        <View style={{ marginTop: space.md, alignSelf: 'stretch' }}>
          <SecondaryButton label={secondary.label} onPress={secondary.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * §9: "Loading state for scan → parse → match should show real progress, not a
 * spinner, since OCR/lookup can take a couple of seconds."
 *
 * Named steps with a determinate bar, so the wait is legible rather than blank.
 */
export type ScanStep = 'read' | 'lookup' | 'match';

const STEPS: Array<{ key: ScanStep; label: string }> = [
  { key: 'read', label: 'Reading the barcode' },
  { key: 'lookup', label: 'Looking up the product' },
  { key: 'match', label: 'Matching ingredients' },
];

export function ScanProgress({ current }: { current: ScanStep }) {
  const currentIndex = STEPS.findIndex((st) => st.key === current);
  const fraction = (currentIndex + 1) / (STEPS.length + 1);

  return (
    <View style={s.progressWrap}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.round(fraction * 100)}%` }]} />
      </View>
      <View style={{ marginTop: space.lg }}>
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <View key={step.key} style={s.stepRow}>
              <View style={{ width: 22 }}>
                {done ? (
                  <Feather name="check" size={14} color={color.primary} />
                ) : (
                  <View
                    style={[
                      s.dot,
                      active
                        ? { backgroundColor: color.primary, borderColor: color.primary }
                        : null,
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  mono.data,
                  { color: done || active ? color.text : color.textMuted },
                ]}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** §8: the first-time unfamiliar-barcode lookup, with no connection. */
export function OfflineLookupNotice() {
  return (
    <View style={s.notice}>
      <Feather name="cloud-off" size={16} color={color.textMuted} />
      <Text style={[sans.meta, { flex: 1, marginLeft: space.md }]}>
        No connection — we&apos;ll look this up as soon as you&apos;re back online.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  block: { alignItems: 'flex-start', paddingVertical: space.xl },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: color.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { paddingVertical: space.xl },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.surface2,
    overflow: 'hidden',
  },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: color.primary },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface2,
    borderRadius: radius.sm,
    padding: space.md,
  },
});
