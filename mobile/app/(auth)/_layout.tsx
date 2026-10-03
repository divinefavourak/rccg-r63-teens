import { Stack } from 'expo-router';

import { SignUpProvider } from '../../src/state/signup';
import { useTokens } from '../../src/theme/ThemeProvider';

/**
 * Welcome, sign-up, the code screen and log in.
 *
 * The sign-up answers live in `SignUpProvider` here, above the steps, so they
 * survive going back and forward and are thrown away when the stack closes.
 */
export default function AuthLayout() {
  const tokens = useTokens();
  return (
    <SignUpProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.surfBase },
          animation: 'slide_from_right',
        }}
      />
    </SignUpProvider>
  );
}
