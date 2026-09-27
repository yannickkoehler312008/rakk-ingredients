import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { color, radius, space } from '../theme/tokens';
import { sans } from '../theme/type';

/**
 * §4's "Ask about this product" bar, at the bottom of the Label screen.
 *
 * STEP 1: this is the affordance only — it is deliberately inert. The assistant
 * itself is build-order step 5, and §10 says to wire it up only once the card
 * data model is stable, because it is grounded in the same matched-ingredient
 * records the cards render. It sits here now because §4 places it on this
 * screen, so the screen's layout has to account for it.
 */
export function ChatBar({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.bar, pressed && { backgroundColor: color.surface2 }]}
    >
      <Feather name="message-circle" size={17} color={color.primary} />
      <Text style={[sans.body, { flex: 1, marginLeft: space.md, color: color.textMuted }]}>
        Ask about this product
      </Text>
      <Feather name="chevron-up" size={17} color={color.textMuted} />
    </Pressable>
  );
}

/**
 * §4 / §8: the assistant is a live network call by nature, so its offline state
 * has to say so plainly rather than hang or fail silently.
 */
export function ChatBarOffline() {
  return (
    <View style={[s.bar, { backgroundColor: color.surface2 }]}>
      <Feather name="cloud-off" size={17} color={color.textMuted} />
      <Text style={[sans.meta, { flex: 1, marginLeft: space.md }]}>
        No connection — the assistant needs one to answer. Everything above still works.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: 14,
    paddingHorizontal: space.base,
  },
});
