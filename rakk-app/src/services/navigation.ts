import { router } from 'expo-router';

/**
 * Go back, or fall back to Home.
 *
 * A screen is not always reached through the stack: the app registers the
 * `rakk://` scheme (app.json), so a deep link can open Label or Compare
 * directly with nothing behind it. A bare `router.back()` there does nothing
 * and the user is stranded on a screen with a dead back button.
 */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/home');
}
