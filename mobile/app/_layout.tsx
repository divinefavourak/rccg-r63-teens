import '../global.css';

import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
// Each weight is imported from its own subpath rather than from the package
// barrel. The barrel re-exports all 18 Inter and 8 Lora faces, and Metro
// bundles every `.ttf` it can reach — so a barrel import ships ~26 font files
// for the 8 this app renders.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_400Regular_Italic } from '@expo-google-fonts/lora/400Regular_Italic';
import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';

import { QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ChromeProvider } from '../src/state/chrome';
import { AuthProvider, useAuth } from '../src/state/auth';
import { PlayerProvider } from '../src/state/player';
import { ReaderProvider, useReader } from '../src/state/reader';
import { installAppStateBridges, queryClient } from '../src/api/queryClient';
import { loadWelcomed } from '../src/state/welcome';

// Hold the native splash until fonts and the stored theme are both ready.
// Without this the first frame renders in the system font and the OS colour
// scheme, then visibly reflows — the opposite of the "calm" the product is
// built around (09-design-principles.md).
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or called twice under Fast Refresh. Not worth surfacing.
});

export default function RootLayout() {
  // The two-face system is normative: Inter for UI, Lora offered in the Reader
  // (09-design-principles.md). Tailwind's `font-ui-*` families name these keys.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Lora_400Regular,
    Lora_400Regular_Italic,
    Lora_500Medium,
    Lora_600SemiBold,
  });

  // A font that fails to download must not wedge the app on the splash screen
  // for ever — render with the system fallback instead.
  const fontsSettled = fontsLoaded || !!fontError;

  // React Query's focus and online managers default to DOM APIs that do not
  // exist in React Native. Installed once, for the life of the app.
  useEffect(installAppStateBridges, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            {/* Auth sits inside QueryClientProvider because signing in and out
                clears the cache — guest and member get different payloads from
                the same endpoints. */}
            <AuthProvider>
              <ChromeProvider>
                {/* The reader's choices and the audio player sit above the
                    navigator: Settings and the Bible tab share the first, and
                    sound has to outlive the screen that started it. */}
                <ReaderProvider>
                  <PlayerProvider>
                    <AppShell fontsSettled={fontsSettled} />
                  </PlayerProvider>
                </ReaderProvider>
              </ChromeProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Split from `RootLayout` because it needs `useTheme`, which only exists below
 * the provider.
 */
function AppShell({ fontsSettled }: { fontsSettled: boolean }) {
  const { scheme, tokens, ready } = useTheme();
  const { ready: authReady } = useAuth();
  const { ready: readerReady } = useReader();
  // Hold the splash until the stored session has been read too, so a signed-in
  // teen never sees the guest version of Today flash before their own.
  // ...and until the "seen the welcome pages?" flag is known, so a first
  // launch opens on Welcome rather than flashing Today first.
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  useEffect(() => {
    loadWelcomed().then(() => setWelcomeLoaded(true));
  }, []);
  // ...and until the reader knows its page, so the Bible tab never opens on
  // the default chapter and then jumps to the one last read.
  const canRender = fontsSettled && ready && authReady && welcomeLoaded && readerReady;

  // Hidden from `onLayout` rather than an effect: the effect fires in the same
  // commit as the render, which can tear down the splash a frame before the
  // tree has actually laid out and flash an empty screen. onLayout runs after.
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!canRender) return null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.surfBase }} onLayout={onLayout}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.surfBase },
          // Subtle slide, consistent with the platform back gesture
          // (09-design-principles.md).
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="devotional"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="article/[id]" />
        <Stack.Screen
          name="player"
          // Rises over the Library and closes downwards, like the docked
          // player it grows out of.
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="watch/[id]" />
        <Stack.Screen name="event/[id]/index" />
        <Stack.Screen name="event/[id]/register" />
        <Stack.Screen name="events/past" />
        <Stack.Screen name="ticket/[id]" />
        <Stack.Screen name="tickets" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/feedback" />
        <Stack.Screen name="console" />
        <Stack.Screen name="dev/kit" />
        {/* Welcome, sign-up and log in. Full screens rather than modals: the
            sign-up steps push onto each other, and a modal stack inside a modal
            loses the back gesture on Android. Every one of them offers a way
            out to the guest experience (05-navigation.md — never a wall). */}
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack>
    </View>
  );
}
