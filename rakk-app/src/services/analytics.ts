/**
 * Instrumentation — §14.
 *
 * The point is one signal: which ingredients people actually open, so dosage
 * research (§12.B2) goes where the scans are. The rest shows where the scan
 * funnel breaks and whether first scan comes quickly after onboarding.
 *
 * PRIVACY (§14): an event carries a type and, at most, an ingredient id, a
 * product barcode, an outcome and a duration. No user or install id, no photo,
 * never chat text. Fire-and-forget: analytics can never delay or break a scan.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { isBackendConfigured, supabase } from './supabaseClient';

export type ScanOutcome =
  | 'barcode_resolved'
  | 'ocr_succeeded'
  | 'manual_search_used'
  | 'not_found'
  | 'no_ingredients'
  | 'offline'
  | 'ocr_unreadable'
  | 'lookup_failed';

type AppEvent =
  | { event: 'scan_outcome'; outcome: ScanOutcome; barcode?: string | null }
  | { event: 'card_expanded'; ingredient_id: string }
  | { event: 'chat_opened'; barcode?: string | null }
  | { event: 'chat_question'; barcode?: string | null }
  | { event: 'onboarding_completed' }
  | { event: 'first_scan_completed'; seconds: number };

const cleanBarcode = (b?: string | null) => (b && /^[0-9]{6,14}$/.test(b) ? b : null);

export function track(e: AppEvent): void {
  if (!isBackendConfigured()) return;
  void supabase()
    .rpc('record_app_event', {
      event: e.event,
      outcome: 'outcome' in e ? e.outcome : null,
      ingredient_id: 'ingredient_id' in e ? e.ingredient_id : null,
      barcode: 'barcode' in e ? cleanBarcode(e.barcode) : null,
      seconds: 'seconds' in e ? Math.max(0, Math.round(e.seconds)) : null,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

// §14: "sign-up completed, first scan completed, time between the two". The
// time is measured on the device and only the number of seconds is sent, so
// the two events never need to be linked by an identifier.
const ONBOARDED_AT = 'rakk.analytics.onboarded_at';
const FIRST_SCAN_SENT = 'rakk.analytics.first_scan_sent';

export async function markOnboardingCompleted(): Promise<void> {
  track({ event: 'onboarding_completed' });
  try {
    if (!(await AsyncStorage.getItem(ONBOARDED_AT))) await AsyncStorage.setItem(ONBOARDED_AT, String(Date.now()));
  } catch {
    // Losing this only loses one duration measurement.
  }
}

export async function markScanCompleted(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(FIRST_SCAN_SENT)) return;
    const at = Number(await AsyncStorage.getItem(ONBOARDED_AT));
    await AsyncStorage.setItem(FIRST_SCAN_SENT, '1');
    if (at > 0) track({ event: 'first_scan_completed', seconds: (Date.now() - at) / 1000 });
  } catch {
    // As above.
  }
}
