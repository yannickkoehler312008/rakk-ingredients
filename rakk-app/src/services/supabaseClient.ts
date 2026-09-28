/**
 * Shared Supabase client and session handling.
 *
 * Both backend-mediated features — the chat assistant (§4) and photo OCR (§6)
 * — need the same thing: a session token to send with the request, because §7
 * rate-limits per user. That logic lives here once rather than in each.
 *
 * NOTHING HERE IS AN LLM KEY. The only credentials are the Supabase URL and
 * publishable key, which are public by design, ship inside the app bundle, and
 * are protected by row-level security.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Not configured is a designed state (§9), not a crash. */
export const isChatConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * §7 requires an auth session, because the limits are per user. Real one-tap
 * Apple/Google auth is §4's onboarding work and isn't built yet, so an
 * anonymous session stands in: it yields a durable user id to meter against
 * without inventing a sign-in flow ahead of the build order. Supabase can
 * later upgrade an anonymous account into a real one, so history carries over.
 */
export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  const { data } = await sb.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;

  const { data: signedIn, error } = await sb.auth.signInAnonymously();
  if (error || !signedIn.session) return null;
  return signedIn.session.access_token;
}
