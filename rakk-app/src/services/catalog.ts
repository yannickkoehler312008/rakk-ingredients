/**
 * The ingredient catalog the matcher works against — §7 and §8.
 *
 * Phase 1 matched against the bundled seed. The Phase 2 database is ~4,700
 * rows, and §7 is explicit that "the client should never need the full
 * ingredient database bundled just to match names". So the catalog is:
 *
 *   BUNDLED  the offline subset (§8): the curated common additives plus the
 *            everyday allow-list, built by the pipeline from the same rows the
 *            server holds. Works with no network at all.
 *   FETCHED  rows the server returned for labels this device has scanned,
 *            persisted, so a product scanned once re-matches offline (§8) and
 *            history keeps re-matching on read (scanStore.ts).
 *
 * For each label the client sends every run of whole words it prints
 * (`candidatePhrases`) to `lookup_ingredients`, which answers with exactly the
 * rows the matcher would claim if it held the whole database. The matcher
 * itself is unchanged and still returns the same ResolvedScan, so no screen
 * knows where ingredients come from (PHASE-2-HANDOFF §1).
 *
 * §7: the bundled subset is "a cache, not the source of truth". When the
 * server's dataset version moves, cached rows are re-fetched.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ingredient } from '../types/ingredient';
import { Product, ResolvedScan, ScanMethod } from '../types/scan';
import { candidatePhrases, resolveScan } from './matcher';
import { isBackendConfigured, supabase } from './supabaseClient';
import bundledFile from '../data/catalog/bundled.json';

const BUNDLED = bundledFile as unknown as { version: string; rows: Ingredient[] };
const STORE_KEY = 'rakk.catalog.v1';
/** The SQL function reads at most this many phrases per call. */
const PHRASES_PER_CALL = 2500;
const LOOKUP_TIMEOUT_MS = 8000;

/** The app contract's columns — the table has one more (`dataset_version`). */
const COLUMNS = [
  'id', 'canonical_name', 'aka', 'cas_number', 'e_number_ins_code', 'chemical_formula',
  'category', 'origin', 'typical_uses', 'allergen_flags', 'plain_explanation',
  'jurisdictions', 'risk_assessment_refs', 'usage_context', 'source',
  'source_updated_at', 'last_full_review_at', 'everyday_allowlist',
] as const;

function toIngredient(row: Record<string, unknown>): Ingredient {
  const out: Record<string, unknown> = {};
  for (const c of COLUMNS) out[c] = row[c] ?? null;
  return out as unknown as Ingredient;
}

const known = new Map<string, Ingredient>(BUNDLED.rows.map((r) => [r.id, r]));
/**
 * The array handed to the matcher. Its identity changes only when a row is
 * added or replaced, because the matcher caches its index per catalog array.
 */
let snapshot: Ingredient[] = BUNDLED.rows;
let fetchedVersion: string | null = null;

export function currentCatalog(): Ingredient[] {
  return snapshot;
}

function merge(rows: Record<string, unknown>[]): boolean {
  let changed = false;
  for (const r of rows) {
    const next = toIngredient(r);
    const prev = known.get(next.id);
    if (!prev || JSON.stringify(prev) !== JSON.stringify(next)) {
      known.set(next.id, next);
      changed = true;
    }
  }
  if (changed) snapshot = Array.from(known.values());
  return changed;
}

/** Rows that came from the server (bundled ids included, once refreshed). */
const fetchedIds = new Set<string>();

async function persist(): Promise<void> {
  try {
    const rows = Array.from(known.values()).filter((r) => fetchedIds.has(r.id));
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify({ version: fetchedVersion, rows }));
  } catch {
    // Losing the cache costs a network lookup next time, nothing more.
  }
}

let hydration: Promise<void> | null = null;
/** Load rows fetched in earlier sessions. Safe to call repeatedly. */
export function hydrateCatalog(): Promise<void> {
  hydration ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { version: string | null; rows: Ingredient[] };
      fetchedVersion = stored.version;
      for (const r of stored.rows) fetchedIds.add(r.id);
      merge(stored.rows as unknown as Record<string, unknown>[]);
    } catch {
      // A corrupt cache must not stop a scan; the bundled subset still works.
    }
  })();
  return hydration;
}

function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)),
  ]);
}

/**
 * - `complete`    every ingredient this label names is now in the catalog
 * - `offline`     the lookup could not reach the database; matching falls
 *                 back to what is on the device, and unmatched names may just
 *                 be unfetched — callers must not report them as gaps
 * - `unconfigured` no backend configured (a designed state, §9)
 */
export type LookupOutcome = 'complete' | 'offline' | 'unconfigured';

/** Make sure every ingredient this label names is in the local catalog. */
export async function ensureCatalogFor(text: string): Promise<LookupOutcome> {
  await hydrateCatalog();
  if (!isBackendConfigured()) return 'unconfigured';
  const phrases = candidatePhrases(text);
  if (phrases.length === 0) return 'complete';
  try {
    const found: Record<string, unknown>[] = [];
    for (let i = 0; i < phrases.length; i += PHRASES_PER_CALL) {
      const { data, error } = await withTimeout(
        supabase().rpc('lookup_ingredients', { phrases: phrases.slice(i, i + PHRASES_PER_CALL) }),
      );
      if (error) return 'offline';
      found.push(...((data ?? []) as Record<string, unknown>[]));
    }
    for (const r of found) {
      fetchedIds.add(String(r.id));
      if (typeof r.dataset_version === 'string') fetchedVersion = r.dataset_version;
    }
    if (merge(found)) await persist();
    return 'complete';
  } catch {
    return 'offline';
  }
}

/**
 * §7: "refreshed periodically in the background rather than only at app
 * update time". If the server has published a new dataset since these rows
 * were fetched, re-fetch them — status changes, delistings and new citations
 * then reach history without a rescan.
 */
export async function refreshCatalogIfStale(): Promise<void> {
  await hydrateCatalog();
  if (!isBackendConfigured() || fetchedIds.size === 0) return;
  try {
    const { data } = await withTimeout(
      supabase().from('ingredient_dataset_releases').select('version').order('imported_at', { ascending: false }).limit(1),
    );
    const latest = (data?.[0] as { version?: string } | undefined)?.version;
    if (!latest || latest === fetchedVersion) return;
    const ids = Array.from(fetchedIds);
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: page, error } = await withTimeout(
        supabase().from('ingredients').select(COLUMNS.join(',')).in('id', ids.slice(i, i + 200)),
      );
      if (error) return;
      rows.push(...((page ?? []) as unknown as Record<string, unknown>[]));
    }
    // A row the new release dropped leaves the cache (the bundled copy, if
    // any, stays — it shipped with the app).
    const still = new Set(rows.map((r) => String(r.id)));
    for (const id of ids) {
      if (!still.has(id)) {
        fetchedIds.delete(id);
        const bundled = BUNDLED.rows.find((r) => r.id === id);
        if (bundled) known.set(id, bundled);
        else known.delete(id);
      }
    }
    snapshot = Array.from(known.values());
    merge(rows);
    fetchedVersion = latest;
    await persist();
  } catch {
    // Try again next launch.
  }
}

/**
 * §12.B / §14: log ingredients the database still does not match, so the
 * backlog is worked by real frequency. Only called after a `complete` lookup —
 * an offline miss is not a gap. Privacy (§14): the printed name and the
 * product barcode, nothing about the person.
 */
export function logUnmatched(names: string[], barcode: string | null, method: ScanMethod): void {
  if (!isBackendConfigured() || names.length === 0) return;
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 160).slice(0, 40);
  if (clean.length === 0) return;
  void supabase()
    .rpc('log_unmatched_ingredients', {
      names: clean,
      barcode: barcode && /^[0-9]{6,14}$/.test(barcode) ? barcode : null,
      scan_method: method,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/**
 * §7's one assembled response, against the live database: fetch what this
 * label names, match, and log what is still missing.
 */
export async function resolveWithDatabase(product: Product, method: ScanMethod): Promise<ResolvedScan> {
  const outcome = await ensureCatalogFor(product.raw_ingredient_text);
  const scan = resolveScan(product, currentCatalog(), method);
  if (outcome === 'complete') logUnmatched(scan.unmatched_names, product.barcode, method);
  return scan;
}

export const BUNDLED_CATALOG_VERSION = BUNDLED.version;
