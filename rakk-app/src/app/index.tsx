import { Redirect } from 'expo-router';

/**
 * Step 1 entry point: straight into onboarding, so the flow can be reviewed
 * from its first screen. Once auth exists (not this step), this is where the
 * session check decides between onboarding and Home — §4: "Session persists by
 * default (no re-login on every app open)."
 */
export default function Index() {
  return <Redirect href="/onboarding" />;
}
