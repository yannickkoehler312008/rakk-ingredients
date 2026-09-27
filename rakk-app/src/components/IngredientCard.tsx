import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AllergenFlag,
  Ingredient,
  IngredientCategory,
  IngredientOrigin,
  ProductTypeContext,
} from '../types/ingredient';
import { color, radius, space } from '../theme/tokens';
import { mono, sans, serif } from '../theme/type';
import { CitationChip, NoCitationChip } from './CitationChip';

/**
 * The expandable explanation card (§4, build order step 4).
 *
 * Order on the card is deliberate: what it is → why it's used → who says what
 * about it → at what dose that matters. Fact first, never a conclusion.
 *
 * Nothing on this card ranks the ingredient. There is no summary line, no
 * takeaway, no "bottom line" — §1: the user draws the conclusion.
 */

const CATEGORY: Record<IngredientCategory, string> = {
  preservative: 'Preservative',
  thickener: 'Thickener',
  emulsifier: 'Emulsifier',
  filler: 'Filler',
  colorant: 'Colorant',
  flavor: 'Flavor',
  sweetener: 'Sweetener',
  acidity_regulator: 'Acidity regulator',
  leavening_agent: 'Leavening agent',
  antioxidant: 'Antioxidant',
  other: 'Other',
};

const ORIGIN: Record<IngredientOrigin, string> = {
  natural: 'Natural source',
  nature_identical: 'Nature-identical',
  synthetic: 'Synthetic',
  unknown: 'Origin not established',
};

const EXPOSURE: Record<ProductTypeContext, string> = {
  leave_on: 'Leave-on product',
  rinse_off: 'Rinse-off product',
  ingested: 'Ingested product',
  topical: 'Topical product',
  other: 'Other use',
};

const ALLERGEN: Record<AllergenFlag, string> = {
  milk: 'milk',
  egg: 'egg',
  fish: 'fish',
  crustacean_shellfish: 'crustacean shellfish',
  tree_nut: 'tree nuts',
  peanut: 'peanuts',
  wheat: 'wheat',
  soybean: 'soy',
  sesame: 'sesame',
  sulfites: 'sulfites',
};

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.dataRow}>
      <Text style={[sans.sectionLabel, { width: 74 }]}>{label}</Text>
      <Text style={[mono.data, { flex: 1 }]}>{value}</Text>
    </View>
  );
}

export function IngredientCard({ ingredient }: { ingredient: Ingredient }) {
  const i = ingredient;
  const meta = [CATEGORY[i.category], ORIGIN[i.origin]].join('  ·  ');

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Text style={[mono.ingredientName, { flex: 1 }]}>{i.canonical_name}</Text>
        {i.e_number_ins_code ? (
          <View style={s.ins}>
            <Text style={[mono.chip, { color: color.textMuted }]}>{i.e_number_ins_code}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[sans.sectionLabel, { marginTop: 6 }]}>{meta}</Text>

      <Text style={[sans.body, { marginTop: space.md }]}>{i.plain_explanation}</Text>

      {i.allergen_flags.length > 0 ? (
        <Text style={[sans.metaStrong, { marginTop: space.sm }]}>
          Derived from {i.allergen_flags.map((a) => ALLERGEN[a]).join(', ')}.
        </Text>
      ) : null}

      {/* §9: never a flag without a source. */}
      <View style={{ marginTop: space.md }}>
        {i.jurisdictions.length > 0 ? (
          i.jurisdictions.map((j) => <CitationChip key={j.jurisdiction} entry={j} />)
        ) : (
          <NoCitationChip />
        )}
      </View>

      {/* §1 / §4 / §11 — dosage and exposure context, where the data supports it.
          Absent `usage_context`, this block is omitted entirely: §4 says such a
          card "just shows the citation chip", and must never look broken. */}
      {i.usage_context ? (
        <View style={s.dosage}>
          <View style={s.dosageHead}>
            <Text style={sans.sectionLabel}>Dosage &amp; exposure</Text>
            <Text style={[mono.chip, { color: color.textMuted }]}>
              {EXPOSURE[i.usage_context.product_type_context]}
            </Text>
          </View>

          {/* §4 wants the threshold and the typical use readable AS a
              comparison. They are labelled and stacked so the reader can put
              one against the other themselves — the card never does the
              comparison for them, because that would be a verdict. */}
          <View style={{ marginTop: space.md }}>
            <Text style={sans.sectionLabel}>Threshold of concern</Text>
            <Text style={[sans.body, { marginTop: 3 }]}>
              {i.usage_context.threshold_of_concern ??
                'No threshold of concern has been established.'}
            </Text>
          </View>

          <View style={{ marginTop: space.md }}>
            <Text style={sans.sectionLabel}>Typical use in this kind of product</Text>
            <Text style={[sans.body, { marginTop: 3 }]}>
              {i.usage_context.typical_concentration_range}
            </Text>
          </View>

          {i.risk_assessment_refs && i.risk_assessment_refs.length > 0 ? (
            <View style={{ marginTop: space.md }}>
              <Text style={sans.sectionLabel}>Where these figures come from</Text>
              {/* Index in the key as well as the text: the seed guards against
                  duplicate refs, but the component shouldn't depend on that. */}
              {i.risk_assessment_refs.map((ref, index) => (
                <Text
                  key={`${index}-${ref}`}
                  style={[mono.citation, { marginTop: 4, color: color.textMuted }]}
                >
                  {ref}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={s.dataBlock}>
        {i.cas_number ? <DataRow label="CAS" value={i.cas_number} /> : null}
        {i.chemical_formula ? <DataRow label="Formula" value={i.chemical_formula} /> : null}
        {i.aka.length > 0 ? <DataRow label="Also" value={i.aka.join(', ')} /> : null}
      </View>
    </View>
  );
}

/**
 * §9's required state: "ingredient not yet in database". Shown in the same card
 * slot so the label never has a dead spot. Says what we don't have, and does
 * not speculate about the substance.
 */
export function UnmatchedIngredientCard({ name }: { name: string }) {
  return (
    <View style={[s.card, { borderStyle: 'dashed' }]}>
      <Text style={mono.ingredientName}>{name}</Text>
      <Text style={[sans.sectionLabel, { marginTop: 6 }]}>Not in the database yet</Text>
      <Text style={[sans.body, { marginTop: space.md }]}>
        We don&apos;t have a verified entry for this one, so there&apos;s nothing to show you
        yet. Entries are added continuously — check back after the next update.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.base,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  ins: {
    backgroundColor: color.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    marginLeft: space.sm,
  },
  dosageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dosage: {
    marginTop: space.base,
    paddingTop: space.base,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  dataBlock: {
    marginTop: space.base,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  dataRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
});
