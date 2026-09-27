/**
 * THE SEED DATASET — build-order step 3.
 *
 * ⚠️  THIS IS NOT THE DATABASE. §9 requires effectively complete coverage of
 *     the FDA/GRAS/Codex set at launch; this is a few hundred hand-written
 *     entries whose only job is to unblock the app build. Phase 2 replaces it.
 *     Every record has `source: 'manual_curation'` and `last_full_review_at:
 *     null` — Appendix A's own signal that a row has not been reviewed
 *     end-to-end against primary sources.
 *
 *     US CFR citations here are machine-checked against eCFR by
 *     `scripts/verify-citations.mjs`. That confirms the section exists and
 *     names the substance. It does NOT confirm that the cited section is the
 *     most apt one, or that the status wording is right. Those still need a
 *     human.
 */

import { Ingredient } from '../../types/ingredient';
import { SeedIngredient, expand } from './types';
import { PRESERVATION } from './preservation';
import { TEXTURE } from './texture';
import { TASTE } from './taste';
import { APPEARANCE } from './appearance';
import { NUTRIENTS } from './nutrients';
import { BULK } from './bulk';
import { EVERYDAY } from './everyday';
import { DOSAGE } from './dosage';

const RAW: SeedIngredient[] = [
  ...PRESERVATION,
  ...TEXTURE,
  ...TASTE,
  ...APPEARANCE,
  ...NUTRIENTS,
  ...BULK,
  ...EVERYDAY,
];

/**
 * Integrity problems found at load. A duplicate id silently shadows a record,
 * and an alias claimed by two ingredients makes matching non-deterministic —
 * both are invisible in the UI and corrosive to trust, so they are surfaced
 * rather than swallowed. `scripts/check-seed.mjs` fails the build on these.
 */
export interface SeedProblem {
  kind: 'duplicate_id' | 'duplicate_name' | 'orphan_dosage' | 'dosage_without_source';
  detail: string;
}

export const SEED_PROBLEMS: SeedProblem[] = [];

const byId = new Map<string, SeedIngredient>();
for (const s of RAW) {
  if (byId.has(s.id)) {
    SEED_PROBLEMS.push({ kind: 'duplicate_id', detail: s.id });
    continue;
  }
  byId.set(s.id, s);
}

// One name can only belong to one ingredient. First writer wins, and the
// collision is reported.
const claimed = new Map<string, string>();
for (const s of byId.values()) {
  for (const name of [s.canonical_name, ...(s.aka ?? [])]) {
    const key = name.trim().toLowerCase();
    const owner = claimed.get(key);
    if (owner && owner !== s.id) {
      SEED_PROBLEMS.push({ kind: 'duplicate_name', detail: `"${name}" claimed by ${owner} and ${s.id}` });
      continue;
    }
    claimed.set(key, s.id);
  }
}

/**
 * Merge the dosage layer onto the records. A dosage entry never overwrites one
 * written inline in a category file — those were authored with the record and
 * win, so the two layers can't silently disagree.
 */
export const SEED_INGREDIENTS: Ingredient[] = Array.from(byId.values()).map((s) => {
  const ingredient = expand(s);
  const dosage = DOSAGE[s.id];
  if (!dosage || ingredient.usage_context) return ingredient;
  return {
    ...ingredient,
    usage_context: dosage.usage_context,
    // §11: no dosage claim without a traceable source. Deduped — a record can
    // name the same assessment inline that the dosage layer also cites, and
    // listing it twice is both wrong on the card and a duplicate React key.
    risk_assessment_refs: Array.from(
      new Set([...(ingredient.risk_assessment_refs ?? []), ...dosage.refs]),
    ),
  };
});

/** Dosage entries whose ingredient id doesn't exist — a silent typo otherwise. */
export const ORPHAN_DOSAGE: string[] = Object.keys(DOSAGE).filter((id) => !byId.has(id));

for (const id of ORPHAN_DOSAGE) {
  SEED_PROBLEMS.push({ kind: 'orphan_dosage', detail: id });
}

export const SEED_COUNT = SEED_INGREDIENTS.length;
export const SEED_ALLOWLIST_COUNT = SEED_INGREDIENTS.filter((i) => i.everyday_allowlist).length;
