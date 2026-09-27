import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../services/navigation';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { SectionLabel } from '../components/primitives';
import { MOCK_SCANS } from '../data/mockScans';
import { ResolvedScan } from '../types/scan';

/**
 * Compare — §4.
 *
 *  - Two products side by side: name, brand, flagged count out of total
 *  - Shared vs. differing ingredients below, "each row with a colored dot per
 *    product showing which one(s) contain it — no ranking of 'better', just
 *    factual overlap"
 *
 * On the dots: one shape in `primary`, filled where the product contains the
 * ingredient and outlined where it does not. A second colour would risk reading
 * as a ranking, which §4's own sentence rules out. Filled/outlined encodes
 * presence and nothing else.
 *
 * STEP 1: the two products are fixed mock scans. Product selection is build
 * order step 7.
 */
export default function Compare() {
  const left = MOCK_SCANS[0];
  const right = MOCK_SCANS[2];

  const leftIds = new Set(left.ingredients.map((i) => i.id));
  const rightIds = new Set(right.ingredients.map((i) => i.id));

  const all = [...left.ingredients, ...right.ingredients].filter(
    (ing, index, arr) => arr.findIndex((o) => o.id === ing.id) === index,
  );
  all.sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));

  const shared = all.filter((i) => leftIds.has(i.id) && rightIds.has(i.id));
  const differing = all.filter((i) => !(leftIds.has(i.id) && rightIds.has(i.id)));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={14} accessibilityRole="button">
          <Feather name="chevron-left" size={24} color={color.text} />
        </Pressable>
        <Text style={[sans.bodyStrong]}>Compare</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.heads}>
          <ProductHead scan={left} marker="A" />
          <View style={{ width: space.md }} />
          <ProductHead scan={right} marker="B" />
        </View>

        <View style={{ marginTop: space.xxl }}>
          <SectionLabel>{`In both (${shared.length})`}</SectionLabel>
          {shared.map((ing) => (
            <Row key={ing.id} name={ing.canonical_name} inLeft inRight />
          ))}
        </View>

        <View style={{ marginTop: space.xl }}>
          <SectionLabel>{`In one only (${differing.length})`}</SectionLabel>
          {differing.map((ing) => (
            <Row
              key={ing.id}
              name={ing.canonical_name}
              inLeft={leftIds.has(ing.id)}
              inRight={rightIds.has(ing.id)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProductHead({ scan, marker }: { scan: ResolvedScan; marker: string }) {
  return (
    <View style={s.head}>
      <View style={s.marker}>
        <Text style={[mono.chip, { color: color.primary }]}>{marker}</Text>
      </View>
      <Text style={[serif.cardTitle, { marginTop: space.sm }]} numberOfLines={2}>
        {scan.product.name}
      </Text>
      <Text style={[sans.meta, { marginTop: 2 }]} numberOfLines={1}>
        {scan.product.brand}
      </Text>
      <Text style={[mono.data, { marginTop: space.md }]}>
        <Text style={{ color: color.flag }}>{scan.flagged_count}</Text>
        {` of ${scan.ingredient_count} flagged`}
      </Text>
    </View>
  );
}

/** Filled = this product contains it. Outlined = it does not. No third state. */
function Dot({ filled }: { filled: boolean }) {
  return <View style={[s.dot, filled ? s.dotFilled : s.dotHollow]} />;
}

function Row({
  name,
  inLeft,
  inRight,
}: {
  name: string;
  inLeft: boolean;
  inRight: boolean;
}) {
  return (
    <View
      style={s.row}
      accessibilityLabel={`${name}. ${inLeft ? 'In A' : 'Not in A'}. ${
        inRight ? 'In B' : 'Not in B'
      }.`}
    >
      <View style={s.dots}>
        <Dot filled={inLeft} />
        <Dot filled={inRight} />
      </View>
      <Text style={[mono.data, { flex: 1 }]} numberOfLines={1}>
        {name}
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
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxl },
  heads: { flexDirection: 'row', marginTop: space.md },
  head: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.base,
  },
  marker: {
    alignSelf: 'flex-start',
    backgroundColor: color.primarySoft,
    borderRadius: radius.pill,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  dots: { flexDirection: 'row', width: 46, gap: 10 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  dotFilled: { backgroundColor: color.primary },
  dotHollow: { borderWidth: 1.5, borderColor: color.border },
});
