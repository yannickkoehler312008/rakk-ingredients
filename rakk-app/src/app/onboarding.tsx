import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { PrimaryButton, SecondaryButton, TextButton } from '../components/primitives';
import { markOnboardingCompleted } from '../services/analytics';

/**
 * Sign up / Onboarding — §4, plus Appendix B's trial mechanics.
 *
 * §4's constraints, all load-bearing:
 *  - carousel capped at 2–3 screens, visible skip on EVERY screen
 *  - one-tap Apple/Google as the primary path, email as a fallback and never
 *    the default
 *  - no mandatory profile fields; nothing blocks the first scan
 *
 * Appendix B: the trial starts automatically at sign-up, card-free, so the
 * one-tap auth path doubles as the trial start. There is no "start trial" tap
 * and no paywall in this flow — billing is out of this phase's build order.
 *
 * STEP 1: the auth buttons are inert. Real Apple/Google auth is not in the
 * build order yet.
 */

interface Page {
  key: string;
  title: string;
  body: string;
}

const PAGES: Page[] = [
  {
    key: 'what',
    title: 'Every ingredient, in plain English.',
    body:
      'Scan a barcode or the ingredients panel. Rakk tells you what each ingredient on the label actually is, and why it is in the product.',
  },
  {
    key: 'promise',
    title: 'It explains. It does not judge.',
    body:
      'Every ingredient Rakk flags comes with its regulatory classification and the citation behind it — and, where the data exists, the dose that classification applies at. Rakk states what is established and leaves the conclusion to you.',
  },
];

function Dots({ index, count }: { index: number; count: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[s.dot, i === index ? s.dotActive : null]} />
      ))}
    </View>
  );
}

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Items in a horizontal FlatList need a definite height for vertical
  // centring to resolve; percentage heights don't on web.
  const [pageHeight, setPageHeight] = useState(0);
  const listRef = useRef<FlatList<Page>>(null);

  // Carousel pages + the auth page. Three cards total, inside §4's 2–3 cap.
  const total = PAGES.length + 1;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const advance = () => {
    if (index < total - 1) listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  const finish = () => {
    void markOnboardingCompleted();
    router.replace('/home');
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.topBar}>
        <Text style={s.wordmark}>Rakk</Text>
        {/* §4: a visible skip on every screen. */}
        <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
          <Text style={[sans.metaStrong, { color: color.textMuted }]}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={[...PAGES, { key: 'auth', title: '', body: '' }]}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        style={{ flex: 1 }}
        onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) =>
          item.key === 'auth' ? (
            <AuthPage onDone={finish} width={width} height={pageHeight} />
          ) : (
            <View style={[s.page, { width, height: pageHeight }]}>
              <View style={s.mark}>
                <Text style={[mono.data, { color: color.primary, fontSize: 11 }]}>
                  {item.key === 'what' ? 'SCAN' : 'CITE'}
                </Text>
              </View>
              <Text style={[serif.display, { marginTop: space.lg }]}>{item.title}</Text>
              <Text style={[sans.body, { marginTop: space.base, color: color.textMuted }]}>
                {item.body}
              </Text>
            </View>
          )
        }
      />

      <View style={s.footer}>
        <Dots index={index} count={total} />
        {index < total - 1 ? (
          <View style={{ marginTop: space.base }}>
            <PrimaryButton label="Continue" onPress={advance} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function AuthPage({
  onDone,
  width,
  height,
}: {
  onDone: () => void;
  width: number;
  height: number;
}) {
  return (
    <View style={[s.page, { width, height, justifyContent: 'flex-end', paddingBottom: space.base }]}>
      <Text style={serif.display}>Start scanning.</Text>
      <Text style={[sans.body, { marginTop: space.md, color: color.textMuted }]}>
        One tap and you are in. No profile to fill in, nothing to set up.
      </Text>

      <View style={{ marginTop: space.xl }}>
        {/* §4: one-tap auth is the primary path — no password to invent. */}
        <PrimaryButton
          label="Continue with Apple"
          onPress={onDone}
          icon={<Feather name="smartphone" size={17} color={color.surface} />}
        />
        <View style={{ height: space.md }} />
        <SecondaryButton label="Continue with Google" onPress={onDone} />
        {/* §4: email is a fallback, never the default. */}
        <View style={{ marginTop: space.lg, alignItems: 'center' }}>
          <TextButton label="Use email instead" onPress={onDone} />
        </View>
      </View>

      {/* Appendix B: trial starts automatically at sign-up, card-free. */}
      <View style={s.trialNote}>
        <Text style={[sans.metaStrong, { textAlign: 'center' }]}>
          Your 7-day free trial starts now.
        </Text>
        <Text style={[sans.meta, { textAlign: 'center', marginTop: 2 }]}>
          No card required. $2.50/month after that.
        </Text>
      </View>

      {/* §1's legal framing, stated once where a new user will see it. */}
      <Text style={[sans.micro, { textAlign: 'center', marginTop: space.base }]}>
        Rakk is an informational reference tool, not health advice.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  wordmark: { ...serif.productName, fontSize: 20 },
  page: { paddingHorizontal: gutter, justifyContent: 'center' },
  mark: {
    alignSelf: 'flex-start',
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  footer: { paddingHorizontal: gutter, paddingTop: space.base, paddingBottom: space.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.border },
  dotActive: { backgroundColor: color.primary, width: 18 },
  trialNote: {
    marginTop: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.base,
  },
});
