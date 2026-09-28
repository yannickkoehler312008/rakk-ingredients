import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { SectionLabel } from '../components/primitives';
import { goBack } from '../services/navigation';
import { getHistory, getScanById } from '../services/scanStore';
import { relativeTime } from '../data/relativeTime';
import { ResolvedScan } from '../types/scan';

/**
 * Compare — §4, wired to real scans (build-order step 7).
 *
 *  - Two products side by side: name, brand, flagged count out of total
 *  - Shared vs. differing ingredients below, "each row with a colored dot per
 *    product showing which one(s) contain it — no ranking of 'better,' just
 *    factual overlap"
 *
 * §4's sentence is the whole design brief for this screen, and the second half
 * of it does more work than the first. Two deliberate consequences:
 *
 *  - THE DOTS ARE ONE COLOUR, filled or outlined. A second colour would read as
 *    a ranking; filled/outlined encodes presence and nothing else.
 *  - THE ROWS DO NOT MARK WHICH INGREDIENTS ARE FLAGGED. The per-product counts
 *    above already state that. Repeating it per row would invite the eye to
 *    total up two columns and decide a winner, which is the one thing this
 *    screen must not do.
 */

/** One ingredient as it appears across both products. */
interface Row {
  key: string;
  name: string;
  inLeft: boolean;
  inRight: boolean;
}

/**
 * Build the comparison.
 *
 * Unmatched printed names are included alongside matched records: an
 * ingredient the database doesn't know yet is still an ingredient the two
 * packages differ on, and dropping it would overstate how similar they are.
 */
function buildRows(left: ResolvedScan, right: ResolvedScan): Row[] {
  const rows = new Map<string, Row>();

  const add = (key: string, name: string, side: 'left' | 'right') => {
    const existing = rows.get(key);
    if (existing) {
      if (side === 'left') existing.inLeft = true;
      else existing.inRight = true;
      return;
    }
    rows.set(key, {
      key,
      name,
      inLeft: side === 'left',
      inRight: side === 'right',
    });
  };

  for (const [scan, side] of [
    [left, 'left'],
    [right, 'right'],
  ] as const) {
    for (const i of scan.ingredients) add(i.id, i.canonical_name, side);
    for (const n of scan.unmatched_names) add(`raw:${n.toLowerCase()}`, n, side);
  }

  return Array.from(rows.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export default function Compare() {
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  const [left, setLeft] = useState<ResolvedScan | null>(null);
  const [right, setRight] = useState<ResolvedScan | null>(null);
  const [history, setHistory] = useState<ResolvedScan[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const all = await getHistory();
      if (!alive) return;
      setHistory(all);
      const a = scanId ? await getScanById(scanId) : null;
      if (!alive) return;
      setLeft(a ?? all[0] ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [scanId]);

  const candidates = useMemo(
    () => (history ?? []).filter((h) => h.scan_id !== left?.scan_id),
    [history, left],
  );

  const rows = useMemo(() => (left && right ? buildRows(left, right) : []), [left, right]);
  const shared = rows.filter((r) => r.inLeft && r.inRight);
  const differing = rows.filter((r) => !(r.inLeft && r.inRight));

  const swap = useCallback(() => {
    setLeft(right);
    setRight(left);
  }, [left, right]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={goBack} hitSlop={14} accessibilityRole="button">
          <Feather name="chevron-left" size={24} color={color.text} />
        </Pressable>
        <Text style={sans.bodyStrong}>Compare</Text>
        {left && right ? (
          <Pressable onPress={swap} hitSlop={14} accessibilityRole="button" accessibilityLabel="Swap sides">
            <Feather name="repeat" size={18} color={color.primary} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {history === null ? null : !left ? (
          <Nothing
            title="Nothing to compare yet."
            body="Scan a product and it'll be available here."
          />
        ) : !right ? (
          <Picker left={left} candidates={candidates} onPick={setRight} />
        ) : (
          <>
            <View style={s.heads}>
              <ProductHead scan={left} marker="A" />
              <View style={{ width: space.md }} />
              <ProductHead scan={right} marker="B" />
            </View>

            <Pressable onPress={() => setRight(null)} style={s.changeBtn} accessibilityRole="button">
              <Feather name="refresh-cw" size={13} color={color.primary} />
              <Text style={[sans.micro, { color: color.primary, marginLeft: 6 }]}>
                Compare with something else
              </Text>
            </Pressable>

            <View style={s.legend}>
              <Dot filled />
              <Text style={[sans.micro, { marginLeft: 6 }]}>contains it</Text>
              <View style={{ width: space.base }} />
              <Dot filled={false} />
              <Text style={[sans.micro, { marginLeft: 6 }]}>doesn&apos;t</Text>
            </View>

            <View style={{ marginTop: space.lg }}>
              <SectionLabel>{`In both (${shared.length})`}</SectionLabel>
              {shared.length === 0 ? (
                <Text style={[sans.meta, { marginBottom: space.md }]}>
                  These two share no ingredients.
                </Text>
              ) : (
                shared.map((r) => <IngredientRow key={r.key} row={r} />)
              )}
            </View>

            <View style={{ marginTop: space.xl }}>
              <SectionLabel>{`In one only (${differing.length})`}</SectionLabel>
              {differing.length === 0 ? (
                <Text style={[sans.meta, { marginBottom: space.md }]}>
                  Both labels list exactly the same ingredients.
                </Text>
              ) : (
                differing.map((r) => <IngredientRow key={r.key} row={r} />)
              )}
            </View>

            <Text style={[sans.micro, { marginTop: space.lg }]}>
              Overlap only. Rakk doesn&apos;t rank one label against another.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Choose the second product from real scan history. */
function Picker({
  left,
  candidates,
  onPick,
}: {
  left: ResolvedScan;
  candidates: ResolvedScan[];
  onPick: (scan: ResolvedScan) => void;
}) {
  return (
    <View>
      <Text style={serif.title}>Compare {left.product.name} with…</Text>
      {candidates.length === 0 ? (
        <Nothing
          title="You've only scanned one thing so far."
          body="Scan another product and you'll be able to put the two labels side by side."
        />
      ) : (
        <View style={{ marginTop: space.lg }}>
          {candidates.map((scan) => (
            <Pressable
              key={scan.scan_id}
              onPress={() => onPick(scan)}
              style={({ pressed }) => [s.candidate, pressed && { backgroundColor: color.surface2 }]}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, paddingRight: space.md }}>
                <Text style={serif.productName} numberOfLines={2}>
                  {scan.product.name}
                </Text>
                <Text style={[sans.meta, { marginTop: 3 }]} numberOfLines={1}>
                  {scan.product.brand ? `${scan.product.brand} · ` : ''}
                  {relativeTime(scan.scanned_at)}
                </Text>
              </View>
              <Feather name="chevron-right" size={17} color={color.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function Nothing({ title, body }: { title: string; body: string }) {
  return (
    <View style={s.nothing}>
      <Feather name="columns" size={18} color={color.textMuted} />
      <Text style={[sans.bodyStrong, { marginTop: space.md, textAlign: 'center' }]}>{title}</Text>
      <Text style={[sans.meta, { marginTop: 4, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

function ProductHead({ scan, marker }: { scan: ResolvedScan; marker: string }) {
  const matched = scan.runs.length > 0;
  return (
    <View style={s.head}>
      <View style={s.marker}>
        <Text style={[mono.chip, { color: color.primary }]}>{marker}</Text>
      </View>
      <Text style={[serif.cardTitle, { marginTop: space.sm }]} numberOfLines={2}>
        {scan.product.name}
      </Text>
      {scan.product.brand ? (
        <Text style={[sans.meta, { marginTop: 2 }]} numberOfLines={1}>
          {scan.product.brand}
        </Text>
      ) : null}
      {/* §4: "flagged count out of total". Counts only — never a score. */}
      <Text style={[mono.data, { marginTop: space.md }]}>
        {matched ? (
          <>
            <Text style={{ color: color.flag }}>{scan.flagged_count}</Text>
            {` of ${scan.ingredient_count} flagged`}
          </>
        ) : (
          <Text style={{ color: color.textMuted }}>not matched yet</Text>
        )}
      </Text>
    </View>
  );
}

/** Filled = this product contains it. Outlined = it doesn't. No third state. */
function Dot({ filled }: { filled: boolean }) {
  return <View style={[s.dot, filled ? s.dotFilled : s.dotHollow]} />;
}

function IngredientRow({ row }: { row: Row }) {
  return (
    <View
      style={s.row}
      accessibilityLabel={`${row.name}. ${row.inLeft ? 'In A' : 'Not in A'}. ${
        row.inRight ? 'In B' : 'Not in B'
      }.`}
    >
      <View style={s.dots}>
        <Dot filled={row.inLeft} />
        <Dot filled={row.inRight} />
      </View>
      <Text style={[mono.data, { flex: 1 }]} numberOfLines={2}>
        {row.name}
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
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingVertical: space.sm,
  },
  legend: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  candidate: {
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
  nothing: {
    alignItems: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.base,
    marginTop: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
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
