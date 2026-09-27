import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { JurisdictionEntry, JurisdictionCode } from '../types/ingredient';
import { color, radius, space } from '../theme/tokens';
import { mono, sans } from '../theme/type';

/**
 * §9: "Every flagged ingredient must show its regulatory citation chip — never
 * show a flag without a source, that's the whole trust proposition."
 *
 * Mono type (§5), `primary` colour because this is a VERIFIED FACT element —
 * not because the fact is reassuring. All jurisdictions render identically;
 * there is no styling that makes one regulator's position look better or worse
 * than another's (§11, §17.4).
 */

const LABEL: Record<JurisdictionCode, string> = {
  US_FDA: 'US FDA',
  EU_EFSA: 'EU EFSA',
  CODEX: 'CODEX',
  HK_CFS: 'HK CFS',
};

export function CitationChip({ entry }: { entry: JurisdictionEntry }) {
  return (
    <View style={s.chip}>
      <View style={s.jurisdiction}>
        <Text style={[mono.chip, { color: color.surface }]}>{LABEL[entry.jurisdiction]}</Text>
      </View>
      <View style={s.body}>
        {/* No line clamp. A truncated regulatory status ("limited to 1 …")
            is worse than none — §9 makes the citation the trust proposition,
            and a status the reader can't finish reading isn't one. */}
        <Text style={[sans.meta, { color: color.text }]}>{entry.status}</Text>
        {entry.citation ? <Text style={mono.citation}>{entry.citation}</Text> : null}
      </View>
    </View>
  );
}

/** A flagged ingredient with no jurisdiction data must say so, not show nothing. */
export function NoCitationChip() {
  return (
    <View style={[s.chip, { borderStyle: 'dashed' }]}>
      <View style={s.body}>
        <Text style={sans.meta}>No regulatory entry on file yet.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 4,
    overflow: 'hidden',
    marginTop: space.sm,
    backgroundColor: color.surface,
  },
  jurisdiction: {
    backgroundColor: color.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    justifyContent: 'center',
  },
});
