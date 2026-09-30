import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import {
  Newsreader_500Medium,
  Newsreader_600SemiBold,
} from '@expo-google-fonts/newsreader';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { color } from '../theme/tokens';
import { refreshCatalogIfStale } from '../services/catalog';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Navigation: a plain stack, no tab bar. Home is the root; "Scan a label"
 * pushes Scan, which pushes Label; Compare opens from Label. A Scan tab would
 * compete with Home's primary CTA (§4), and §4 describes no tab bar.
 */
export default function RootLayout() {
  // §5's three families. All bundled — no network fetch, no FOUT.
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // §7: cached ingredient rows are refreshed in the background when the
  // database publishes a new release, not only when the app updates.
  useEffect(() => {
    void refreshCatalogIfStale();
  }, []);

  // Hold the splash rather than flash the whole app in a fallback font — §9's
  // "premium, not vibe-coded" bar, and the three-family split is load-bearing.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade' }} />
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="label" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="states" />
      </Stack>
    </>
  );
}
