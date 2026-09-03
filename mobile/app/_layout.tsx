import '../global.css';

import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Lora_400Regular, Lora_400Regular_Italic, Lora_600SemiBold } from '@expo-google-fonts/lora';

import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { SessionProvider } from '../src/state/session';
import { ChromeProvider } from '../src/state/chrome';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <ChromeProvider>
              <AppShell fontsSettled={fontsSettled} />
            </ChromeProvider>
          </SessionProvider>
        </ThemeProvider>
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
  const canRender = fontsSettled && ready;

  const onLayout = useCallback(() => {
    if (canRender) SplashScreen.hideAsync().catch(() => {});
  }, [canRender]);

  useEffect(() => {
    if (canRender) SplashScreen.hideAsync().catch(() => {});
  }, [canRender]);

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
        <Stack.Screen name="event/[id]" />
      </Stack>
    </View>
  );
}
