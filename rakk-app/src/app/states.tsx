import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../services/navigation';
import Feather from '@expo/vector-icons/Feather';
import { color, gutter, space } from '../theme/tokens';
import { sans } from '../theme/type';
import { SecondaryButton, SectionLabel } from '../components/primitives';
import {
  OfflineLookupNotice,
  ScanProgress,
  StateBlock,
} from '../components/states';
import { ChatBarOffline } from '../components/ChatBar';
import { UnmatchedIngredientCard } from '../components/IngredientCard';
import { MOCK_SCANS } from '../data/mockScans';
import { clearAll } from '../services/scanStore';
import { serif } from '../theme/type';

/**
 * DEV GALLERY — not a shipping screen.
 *
 * §9 requires each of these to be a designed state rather than a generic error
 * toast. They are collected here so they can be reviewed in step 1; each one
 * moves to its real trigger point as the build order reaches it (barcode
 * lookup at step 2, OCR at step 6, chat at step 5).
 */
export default function States() {
  const [cleared, setCleared] = useState(false);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Pressable onPress={() => goBack()} hitSlop={14} accessibilityRole="button">
          <Feather name="chevron-left" size={24} color={color.text} />
        </Pressable>
        <Text style={sans.bodyStrong}>Empty &amp; loading states</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[sans.micro, { marginBottom: space.lg }]}>
          Dev reference. Each state lives on its own screen once the build order reaches it.
        </Text>

        <Divider label="Scan → parse → match (§9)" />
        <ScanProgress current="lookup" />

        <Divider label="Barcode not found (§9)" />
        <StateBlock
          icon="search"
          title="We don't have this barcode yet."
          body="It isn't in the product database. You can photograph the ingredients panel instead, and we'll read the list off the package."
          primary={{ label: 'Photograph the label' }}
          secondary={{ label: 'Search by name' }}
        />

        <Divider label="OCR failed (§9)" />
        <StateBlock
          icon="image"
          title="We couldn't read that label."
          body="The text came out too soft to parse. More light helps, and so does getting the whole panel square-on in the frame."
          primary={{ label: 'Retake the photo' }}
          secondary={{ label: 'Enter the barcode instead' }}
        />

        <Divider label="First lookup, no connection (§8)" />
        <OfflineLookupNotice />

        <Divider label="Ingredient not yet in database (§9)" />
        <UnmatchedIngredientCard name="rice flour" />

        <Divider label="Product found, no ingredient list (step 2)" />
        <Text style={[sans.micro, { marginBottom: space.md }]}>
          Not named in §9, but Open Food Facts hits this constantly: the product is on file,
          its label isn&apos;t. Lives on the Scan screen; shown here for reference.
        </Text>
        <StateBlock
          icon="file-text"
          title="We found the product, but not its ingredient list."
          body="Oat Crunch Granola · Northfield Mills is in the database, but nobody has added its label yet. Photographing the panel will read it straight off the package."
          primary={{ label: 'Photograph the label' }}
        />

        <Divider label="Chat assistant offline (§4, §8)" />
        <ChatBarOffline />

        <Divider label="Step 1 design fixtures" />
        <Text style={[sans.micro, { marginBottom: space.md }]}>
          Home now lists real scans, so the hand-written mock products live here. These are the
          only way to review the matched/flagged Label design until step 3 lands.
        </Text>
        {MOCK_SCANS.map((scan) => (
          <Pressable
            key={scan.scan_id}
            onPress={() =>
              router.push({ pathname: '/label', params: { scanId: scan.scan_id, mock: '1' } })
            }
            style={s.fixture}
          >
            <Text style={[serif.cardTitle, { flex: 1 }]} numberOfLines={1}>
              {scan.product.name}
            </Text>
            <Feather name="chevron-right" size={16} color={color.textMuted} />
          </Pressable>
        ))}

        <Divider label="Local cache (§8)" />
        <SecondaryButton
          label={cleared ? 'Cleared' : 'Clear scan history & cache'}
          onPress={() => {
            clearAll();
            setCleared(true);
          }}
        />

        <View style={{ height: space.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <View style={{ marginTop: space.xl, marginBottom: space.sm }}>
      <View style={s.rule} />
      <SectionLabel>{label}</SectionLabel>
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
  rule: { height: 1, backgroundColor: color.border, marginBottom: space.md },
  fixture: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    marginBottom: space.sm,
  },
});
