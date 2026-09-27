import React, { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../services/navigation';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { SectionLabel } from '../components/primitives';
import { AnnotatedLabel, LabelHint } from '../components/AnnotatedLabel';
import { ChatBar } from '../components/ChatBar';
import { ChatSheet } from '../components/ChatSheet';
import { ResolvedScan } from '../types/scan';
import { getScanById } from '../services/scanStore';
import { scanById as mockScanById } from '../data/mockScans';

/**
 * Label — the core screen (§4).
 *
 * Order on the screen follows §4 exactly:
 *   product name/brand → summary strip (total count, flagged count) →
 *   "the label, translated" as running text with flagged terms underlined →
 *   cards expanding in place → chat entry point at the bottom.
 *
 * §4: "No overall score, no color-graded verdict anywhere on this screen."
 * The only numbers here are counts, presented as counts.
 *
 * A scan can arrive in two conditions, and the screen must be honest about
 * which (see `scan.runs.length === 0`):
 *   - MATCHED — the full translated view.
 *   - NOT MATCHED YET — the label exactly as printed, no underlines, no
 *     counts. This is what build-order step 2 produces; matching is step 3.
 */
export default function Label() {
  const { scanId, mock } = useLocalSearchParams<{ scanId?: string; mock?: string }>();
  const [scan, setScan] = useState<ResolvedScan | null>(null);
  const [missing, setMissing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      // `mock=1` opens a step-1 design fixture from the dev gallery.
      if (mock === '1') {
        if (alive) setScan(mockScanById(scanId ?? ''));
        return;
      }
      const found = await getScanById(scanId ?? '');
      if (!alive) return;
      if (found) setScan(found);
      else setMissing(true);
    })();
    return () => {
      alive = false;
    };
  }, [scanId, mock]);

  if (missing) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <TopBar showCompare={false} />
        <View style={s.centre}>
          <Text style={serif.cardTitle}>That scan isn&apos;t here any more.</Text>
          <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>
            Scan the package again and it&apos;ll open straight away.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!scan) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <TopBar showCompare={false} />
      </SafeAreaView>
    );
  }

  const matched = scan.runs.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TopBar showCompare />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={serif.title}>{scan.product.name}</Text>
        {scan.product.brand ? (
          <Text style={[sans.meta, { marginTop: 4 }]}>{scan.product.brand}</Text>
        ) : null}

        {/* Counts only exist once matching has run. Showing "0 flagged" before
            then would state something we haven't established. */}
        {matched ? (
          <View style={s.summary}>
            <View style={s.summaryCell}>
              <Text style={[mono.ingredientName, { fontSize: 19 }]}>{scan.ingredient_count}</Text>
              <Text style={[sans.sectionLabel, { marginTop: 2 }]}>Ingredients</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryCell}>
              <Text style={[mono.ingredientName, { fontSize: 19, color: color.flag }]}>
                {scan.flagged_count}
              </Text>
              <Text style={[sans.sectionLabel, { marginTop: 2 }]}>Flagged</Text>
            </View>
            {scan.unmatched_names.length > 0 ? (
              <>
                <View style={s.summaryDivider} />
                <View style={s.summaryCell}>
                  <Text style={[mono.ingredientName, { fontSize: 19, color: color.textMuted }]}>
                    {scan.unmatched_names.length}
                  </Text>
                  <Text style={[sans.sectionLabel, { marginTop: 2 }]}>Not yet in db</Text>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: matched ? space.xxl : space.lg }}>
          <SectionLabel>{matched ? 'The label, translated' : 'The label, as printed'}</SectionLabel>
          <LabelHint scan={scan} />
          <AnnotatedLabel scan={scan} />
        </View>

        {scan.product.barcode ? (
          <Text style={[mono.citation, { marginTop: space.base, color: color.textMuted }]}>
            {scan.product.barcode} · Open Food Facts
          </Text>
        ) : null}
      </ScrollView>

      {/* §4: the chat entry point sits at the bottom of this screen, expanding
          into a thread scoped to this product. */}
      <View style={s.chatDock}>
        <ChatBar onPress={() => setChatOpen(true)} />
      </View>

      <Modal
        visible={chatOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setChatOpen(false)}
      >
        <ChatSheet scan={scan} onClose={() => setChatOpen(false)} />
      </Modal>
    </SafeAreaView>
  );
}

function TopBar({ showCompare }: { showCompare: boolean }) {
  return (
    <View style={s.topBar}>
      <Pressable onPress={() => goBack()} hitSlop={14} accessibilityRole="button">
        <Feather name="chevron-left" size={24} color={color.text} />
      </Pressable>
      {showCompare ? (
        <Pressable
          onPress={() => router.push('/compare')}
          hitSlop={14}
          accessibilityRole="button"
          style={s.compareBtn}
        >
          <Feather name="columns" size={14} color={color.primary} />
          <Text style={[sans.micro, { color: color.primary, marginLeft: 6 }]}>Compare</Text>
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: gutter },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingBottom: space.sm,
  },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
    marginTop: space.lg,
    paddingVertical: space.md,
  },
  summaryCell: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 30, backgroundColor: color.border },
  chatDock: {
    paddingHorizontal: gutter,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.bg,
  },
});
