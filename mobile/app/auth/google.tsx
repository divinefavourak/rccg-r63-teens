import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { LogoLockup } from '../../src/components/Logo';
import { googleErrorMessage, useAuth } from '../../src/state/auth';
import { Button } from '../../src/ui/Button';

/**
 * The web/PWA landing point for Google sign-in.
 *
 * The phone app gets the result straight back from `WebBrowser`. On the web,
 * which is how an iPhone runs Faith Tribe, the whole window goes to Google and
 * comes back here with a one-time code or a sign-up ticket. A full-page round
 * trip is deliberate: a popup cannot share its result with a Home Screen app
 * on iOS, because Safari gives the standalone app separate storage.
 *
 * The code is exchanged here, then the browser replaces this history entry
 * with Today, so Back never returns to a spent code.
 */
export default function GoogleCallbackScreen() {
  const router = useRouter();
  const { completeGoogleRedirect } = useAuth();
  const { code, signup, error } = useLocalSearchParams<{
    code?: string;
    signup?: string;
    error?: string;
  }>();

  const [status, setStatus] = useState<'working' | 'failed'>('working');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Native hands the result to `useAuth`, not to a route.
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }
    if (started.current) return;
    started.current = true;

    if (typeof error === 'string' && error) {
      setStatus('failed');
      setMessage(googleErrorMessage(error));
      return;
    }

    if (typeof signup === 'string' && signup) {
      router.replace({ pathname: '/sign-up', params: { google: signup } });
      return;
    }

    if (typeof code !== 'string' || !code) {
      // Opened directly, or a reloaded old callback: nothing to exchange.
      router.replace('/');
      return;
    }

    completeGoogleRedirect(code)
      .then(() => router.replace('/'))
      .catch((err) => {
        setStatus('failed');
        setMessage(
          err instanceof Error
            ? err.message
            : 'Could not finish signing you in. Please try again.',
        );
      });
  }, [code, signup, error, completeGoogleRedirect, router]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surf-base px-6">
      <LogoLockup size={56} />
      <Text
        accessibilityRole="header"
        className="text-center font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
      >
        {status === 'failed' ? 'Sign-in did not finish' : 'Finishing sign-in…'}
      </Text>
      <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
        {status === 'failed'
          ? 'Return to Faith Tribe and try again.'
          : 'Please wait a moment.'}
      </Text>
      {status === 'failed' && (
        <>
          <Text className="text-center font-ui-md text-[12px] leading-4 text-ink-3">
            {message}
          </Text>
          <Button
            label="Back to log in"
            onPress={() => router.replace('/log-in')}
            className="mt-2 w-full"
          />
        </>
      )}
    </View>
  );
}
