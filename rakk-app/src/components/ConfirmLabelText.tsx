import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { PrimaryButton, SecondaryButton } from './primitives';

/**
 * Confirm what was read off the photo, before it is matched.
 *
 * ═══ THIS IS A DELIBERATE ADDITION TO §4's FLOW ═══
 *
 * §4 describes photo → OCR → parsed → Label, with no confirmation step, and
 * §4 also wants the shortest possible path to a result. This screen adds a tap.
 *
 * The reason is the OCR engine. §6 suggests a dedicated OCR service; we use a
 * vision model instead (one provider, one key). A dedicated OCR engine
 * transcribes and fails visibly; a language model can fail *invisibly*, by
 * producing plausible text where the photo was unclear. Everything downstream —
 * the matching, the flags, the citations — is built on this string being what
 * is actually printed on the package.
 *
 * So the user gets to see it and fix it. It is editable because a one-character
 * OCR slip otherwise turns a matched ingredient into an unmatched one, and the
 * user can see the package.
 *
 * If the OCR proves reliable in practice, this screen is the thing to remove.
 */
export function ConfirmLabelText({
  initialText,
  unreadableMarkers,
  onConfirm,
  onRetake,
  onCancel,
}: {
  initialText: string;
  unreadableMarkers: number;
  onConfirm: (text: string) => void;
  onRetake: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={onCancel} hitSlop={14} accessibilityRole="button">
            <Feather name="x" size={22} color={color.text} />
          </Pressable>
          <Text style={sans.bodyStrong}>Check the reading</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={serif.title}>Is this what the package says?</Text>
          <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>
            This was read from your photo. Everything after this — what gets flagged, and the
            citations — is built on it, so it is worth a glance. You can edit it.
          </Text>

          {unreadableMarkers > 0 ? (
            <View style={s.notice}>
              <Feather name="help-circle" size={15} color={color.flag} />
              <Text style={[sans.meta, { flex: 1, marginLeft: space.sm, color: color.text }]}>
                {unreadableMarkers === 1
                  ? 'One character could not be made out — it is marked [?].'
                  : `${unreadableMarkers} characters could not be made out — they are marked [?].`}
              </Text>
            </View>
          ) : null}

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            style={s.input}
            accessibilityLabel="The ingredient list read from your photo"
          />
        </ScrollView>

        <View style={s.footer}>
          <PrimaryButton label="Looks right" onPress={() => onConfirm(text.trim())} />
          <View style={{ height: space.md }} />
          <SecondaryButton label="Take another photo" onPress={onRetake} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  body: { paddingHorizontal: gutter, paddingTop: space.lg, paddingBottom: space.xl },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.flagSoft,
    borderRadius: radius.sm,
    padding: space.md,
    marginTop: space.base,
  },
  input: {
    marginTop: space.lg,
    minHeight: 220,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.base,
    textAlignVertical: 'top',
    ...mono.label,
  },
  footer: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
});
