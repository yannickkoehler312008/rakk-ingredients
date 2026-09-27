import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { sans, serif } from '../theme/type';
import { CountChip, PrimaryButton, SectionLabel } from '../components/primitives';
import { relativeTime } from '../data/relativeTime';
import { ResolvedScan } from '../types/scan';
import { getHistory, subscribe } from '../services/scanStore';

/**
 * Home — §4.
 *
 *  - "Scan a label" primary CTA
 *  - Recently scanned: name, brand, relative time, and either a flagged-COUNT
 *    chip or a "clear" badge. §4 is explicit: "no numeric score, just count".
 *
 * The trial line is Appendix B's "clear in-app countdown". It is a status
 * readout only — no upgrade prompt, no paywall, nothing to tap. Billing is out
 * of this phase's build order.
 */
export default function Home() {
  const [history, setHistory] = useState<ResolvedScan[] | null>(null);

  const load = useCallback(() => {
    getHistory().then(setHistory);
  }, []);

  // Re-read whenever a scan lands, and on every return to this screen.
  useEffect(() => {
    load();
    return subscribe(load);
  }, [load]);

  useFocusEffect(load);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <Text style={s.wordmark}>Rakk</Text>
          <View style={s.trialPill}>
            <Text style={[sans.micro, { color: color.primary }]}>Trial · 6 days left</Text>
          </View>
        </View>

        <Text style={[serif.display, { marginTop: space.lg }]}>
          What&apos;s on the label?
        </Text>
        <Text style={[sans.body, { marginTop: space.sm, color: color.textMuted }]}>
          Point the camera at a barcode or the ingredients panel.
        </Text>

        <View style={{ marginTop: space.lg }}>
          <PrimaryButton
            label="Scan a label"
            onPress={() => router.push('/scan')}
            icon={<Feather name="camera" size={18} color={color.surface} />}
          />
        </View>

        <View style={{ marginTop: space.xxl }}>
          <SectionLabel>Recently scanned</SectionLabel>
          {history === null ? null : history.length === 0 ? (
            <EmptyHistory />
          ) : (
            history.map((scan) => <RecentRow key={scan.scan_id} scan={scan} />)
          )}
        </View>

        {/* Dev-only entry point to §9's designed states. Not a shipping screen. */}
        <Pressable onPress={() => router.push('/states')} style={s.devLink}>
          <Feather name="layers" size={13} color={color.textMuted} />
          <Text style={[sans.micro, { marginLeft: 6 }]}>Dev: empty &amp; loading states</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecentRow({ scan }: { scan: ResolvedScan }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/label', params: { scanId: scan.scan_id } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: color.surface2 }]}
      accessibilityRole="button"
    >
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={serif.productName} numberOfLines={2}>
          {scan.product.name}
        </Text>
        <Text style={[sans.meta, { marginTop: 3 }]} numberOfLines={1}>
          {scan.product.brand} · {relativeTime(scan.scanned_at)}
        </Text>
      </View>
      {scan.runs.length > 0 ? <CountChip count={scan.flagged_count} /> : null}
      <Feather
        name="chevron-right"
        size={17}
        color={color.textMuted}
        style={{ marginLeft: space.sm }}
      />
    </Pressable>
  );
}

/**
 * §9's empty-state discipline applied to a first run: say what to do next
 * rather than showing a bare heading over nothing.
 */
function EmptyHistory() {
  return (
    <View style={s.empty}>
      <Feather name="maximize" size={18} color={color.textMuted} />
      <Text style={[sans.body, { marginTop: space.md, color: color.textMuted }]}>
        Nothing scanned yet.
      </Text>
      <Text style={[sans.meta, { marginTop: 4, textAlign: 'center' }]}>
        Scan a barcode and it&apos;ll show up here, ready to open without a connection.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { ...serif.productName, fontSize: 20 },
  trialPill: {
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.base,
    paddingHorizontal: space.base,
    marginBottom: space.md,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.base,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
  },
  devLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    paddingVertical: space.md,
    opacity: 0.6,
  },
});
