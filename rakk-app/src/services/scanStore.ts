/**
 * On-device scan cache and history — §8.
 *
 * §8: "Cache every product a user has successfully scanned before, so
 * re-scanning something already looked up works with zero network."
 *
 * Two things live here, and the distinction matters:
 *   - CACHE, keyed by barcode: the answer for a product we have already
 *     resolved. Re-scanning it needs no network at all.
 *   - HISTORY, newest first: what Home's "recently scanned" list shows.
 *
 * §7 is explicit that the cache is "a cache, not the source of truth" — the
 * ingredient database keeps being backfilled after launch, so a cached scan can
 * go stale. `CACHE_TTL_MS` is what stops a stale copy being served forever;
 * once there is a backend, this becomes a background refresh rather than a
 * hard expiry.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResolvedScan } from '../types/scan';

// v2: step 2 cached scans with `runs: []` (unmatched). Step 3 always matches,
// so the key is bumped rather than serving stale unmatched copies forever.
const HISTORY_KEY = 'rakk.history.v2';
const CACHE_PREFIX = 'rakk.product.v2.';

/** Home shows the most recent scans; older entries fall off the list. */
const HISTORY_LIMIT = 50;

/** A cached product older than this is re-fetched when the network allows. */
export const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Screens re-read history on change rather than polling. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export async function getHistory(): Promise<ResolvedScan[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ResolvedScan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt store must not brick Home. Start clean rather than throw.
    return [];
  }
}

export async function getCached(barcode: string): Promise<ResolvedScan | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + barcode);
    if (!raw) return null;
    const { scan, cached_at } = JSON.parse(raw) as { scan: ResolvedScan; cached_at: number };
    if (!scan) return null;
    if (Date.now() - cached_at > CACHE_TTL_MS) return null;
    return scan;
  } catch {
    return null;
  }
}

/**
 * Record a resolved scan. The product is cached by barcode, and the scan goes
 * to the top of history — re-scanning something moves it up rather than
 * creating a duplicate row.
 */
export async function recordScan(scan: ResolvedScan): Promise<void> {
  try {
    if (scan.product.barcode) {
      await AsyncStorage.setItem(
        CACHE_PREFIX + scan.product.barcode,
        JSON.stringify({ scan, cached_at: Date.now() }),
      );
    }
    const history = await getHistory();
    const deduped = history.filter((h) => h.product.id !== scan.product.id);
    const next = [scan, ...deduped].slice(0, HISTORY_LIMIT);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    emit();
  } catch {
    // Losing a history write is not worth interrupting a successful scan.
  }
}

export async function getScanById(scanId: string): Promise<ResolvedScan | null> {
  const history = await getHistory();
  return history.find((h) => h.scan_id === scanId) ?? null;
}

/** Dev affordance, reachable from the states gallery. */
export async function clearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k === HISTORY_KEY || k.startsWith(CACHE_PREFIX));
    // AsyncStorage v3 dropped the multi* helpers.
    await Promise.all(ours.map((k) => AsyncStorage.removeItem(k)));
    emit();
  } catch {
    // no-op
  }
}
