import '../global.css';

import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
// Each weight is imported from its own subpath rather than from the package
// barrel. The barrel re-exports all 14 Jakarta and 8 Lora weights, and Metro
// bundles every `.ttf` it can reach — so a barrel import ships ~22 font files
// for the 8 this app renders.
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { Lora_400Regular } from '@expo-google-fonts/lora/400Regular';
import { Lora_400Regular_Italic } from '@expo-google-fonts/lora/400Regular_Italic';
import { Lora_600SemiBold } from '@expo-google-fonts/lora/600SemiBold';

import { QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ChromeProvider } from '../src/state/chrome';
import { AuthProvider, useAuth } from '../src/state/auth';
import { installAppStateBridges, queryClient } from '../src/api/queryClient';

// Hold the native splash until fonts and the stored theme are both ready.
// Without this the first frame renders in the system font and the OS colour
// scheme, then visibly reflows — the opposite of the "calm" the product is
// built around (09-design-principles.md).
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or called twice under Fast Refresh. Not worth surfacing.
});

export default function RootLayout() {
  // Aliased to short names so Tailwind's `font-ui-*` families stay readable.
  // The two-face system is normative: geometric sans for UI, serene serif
  // offered in the Reader (09-design-principles.md).
  const [fontsLoaded, fontError] = useFonts({
    Jakarta_400Regular: PlusJakartaSans_400Regular,
    Jakarta_500Medium: PlusJakartaSans_500Medium,
    Jakarta_600SemiBold: PlusJakartaSans_600SemiBold,
    Jakarta_700Bold: PlusJakartaSans_700Bold,
    Jakarta_800ExtraBold: PlusJakartaSans_800ExtraBold,
    Lora_400Regular,
    Lora_400Regular_Italic,
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
                <AppShell fontsSettled={fontsSettled} />
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
  // Hold the splash until the stored session has been read too, so a signed-in
  // teen never sees the guest version of Today flash before their own.
  const canRender = fontsSettled && ready && authReady;

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
        <Stack.Screen
          name="notifications"
          options={{
            // A bottom sheet, so the Today screen stays visible behind the
            // scrim rather than being replaced.
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen name="event/[id]/index" />
        <Stack.Screen
          name="event/[id]/register"
          // A form, so it gets a modal presentation and its own cancel — backing
          // out must not drop the teen somewhere unexpected mid-registration.
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="events/past" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/feedback" />
        <Stack.Screen name="console" />
        <Stack.Screen
          name="register"
          // Sign-up is a modal for the same reason sign-in is: dismissing it
          // returns to the guest experience instead of trapping the teen.
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="sign-in"
          // A modal, not a route the app can get stuck on: dismissing it returns
          // to the guest experience rather than blocking the product
          // (05-navigation.md — signup prompts are contextual and dismissible).
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </View>
  );
}
