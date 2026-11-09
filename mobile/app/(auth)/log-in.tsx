import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { FaithTribeLogo } from '../../src/components/Logo';
import { codeDestination, useAuth } from '../../src/state/auth';
import { takeDestination } from '../../src/state/destination';
import { useReminderInvite } from '../../src/components/ReminderInvite';
import { markWelcomed } from '../../src/state/welcome';
import { FormError } from '../../src/ui/AuthShell';
import { Button } from '../../src/ui/Button';
import { Blob } from '../../src/ui/cards';
import { IconField } from '../../src/ui/inputs';
import { KeyboardView } from '../../src/ui/screen';
import { Press } from '../../src/ui/Press';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION } from '../../src/theme/tokens';

const GOOGLE = require('../../assets/art/google.svg');

/**
 * Log in.
 *
 * Three ways in, because there are three kinds of account. Teens who joined in
 * the app have no password and sign in with an emailed code; accounts made on
 * the website (and every leader) have a password; and anyone whose Google email
 * matches their account can use Google. The field takes an email or a phone for
 * a password, but a code only ever goes to an email address — the app no longer
 * offers a code by SMS. A forgotten password is reset by an emailed link
 * (`forgot-password.tsx`).
 *
 * Dismissible like every auth screen: "Read today's devotional without signing
 * in" goes back to the guest experience (05-navigation.md).
 */
export default function LogInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { signIn, signInWithGoogle, requestLoginCode, pending, error, clearError } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => clearError, [clearError]);

  const edit = useCallback(
    (setter: (v: string) => void) => (value: string) => {
      setter(value);
      setNotice(null);
      if (error) clearError();
    },
    [error, clearError],
  );

  const enter = useCallback(() => {
    markWelcomed();
    // Back to the event, saved item or page that asked them to sign in.
    router.dismissTo(takeDestination('/') as Href);
  }, [router]);
  // A new phone has never been asked about reminders, even for an old account.
  const invite = useReminderInvite(enter);

  const google = useCallback(async () => {
    if (pending) return;
    try {
      const result = await signInWithGoogle();
      if (result.status === 'signed-in') invite.begin();
      else if (result.status === 'new') {
        // Google verified who they are; the sign-up form still asks the
        // questions Google cannot answer (phone, birth date, parish).
        router.push({ pathname: '/sign-up', params: { google: result.ticket } });
      }
      // 'cancelled' is not an error: they closed Google's screen.
    } catch {
      // `useAuth` holds the message.
    }
  }, [pending, signInWithGoogle, invite, router]);

  const logIn = useCallback(async () => {
    if (!identifier.trim() || !password || pending) return;
    try {
      await signIn(identifier.trim(), password);
      invite.begin();
    } catch {
      // `useAuth` holds the message.
    }
  }, [identifier, password, pending, signIn, invite]);

  const sendCode = useCallback(async () => {
    if (pending) return;
    if (!codeDestination(identifier)) {
      setNotice('Enter your email address first, then we can send a code.');
      return;
    }
    try {
      await requestLoginCode(identifier);
      router.push({ pathname: '/verify', params: { to: identifier.trim() } });
    } catch {
      // `useAuth` holds the message.
    }
  }, [identifier, pending, requestLoginCode, router]);

  // The reset link goes by email, so an email already typed is carried over
  // and a phone number is not.
  const forgot = useCallback(() => {
    const typed = identifier.trim();
    router.push({
      pathname: '/forgot-password',
      params: typed.includes('@') ? { email: typed } : {},
    });
  }, [identifier, router]);

  const asGuest = useCallback(() => {
    markWelcomed();
    router.dismissTo('/');
  }, [router]);

  return (
    <KeyboardView
      className="flex-1 bg-surf-base"
    >
      {/* Soft colour circles, mostly off-screen. Behind everything and clipped
          by this view, so they never catch a touch or widen the page. */}
      <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
        <Blob colour="lime" size={300} style={{ left: -150, top: -90 }} />
        <Blob colour="violet" size={180} style={{ right: -90, top: 150 }} />
        <Blob colour="amber" size={260} style={{ left: -120, bottom: -100 }} />
        <Blob colour="sky" size={220} style={{ right: -110, bottom: -100 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          gap: 16,
          paddingHorizontal: 24,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <View
          className="h-[116px] w-[116px] items-center justify-center rounded-[36px] bg-surf-raised"
          style={ELEVATION.sheet}
        >
          <FaithTribeLogo size={96} />
        </View>

        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
        >
          Welcome back
        </Text>
        <Text className="text-center font-ui-md text-[12px] uppercase leading-4 tracking-[2.88px] text-ink-2">
          Sign in to continue
        </Text>

        <IconField
          icon="phone"
          label="Phone number or email"
          value={identifier}
          onChange={edit(setIdentifier)}
          keyboardType="email-address"
          autoComplete="username"
          returnKeyType="next"
        />
        <IconField
          icon="lock"
          label="Password"
          value={password}
          onChange={edit(setPassword)}
          secure
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={logIn}
        />

        {/* No "Remember me": a phone session always persists, so a checkbox
            would promise a choice that does not exist. */}
        <View className="w-full flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Pressable onPress={forgot} accessibilityRole="link" hitSlop={10}>
            <Text className="font-ui-sb text-[14px] leading-5 text-green">Forgot password?</Text>
          </Pressable>
          <Pressable onPress={sendCode} accessibilityRole="button" hitSlop={10}>
            <Text className="font-ui-sb text-[14px] leading-5 text-green">
              Email me a code
            </Text>
          </Pressable>
        </View>

        <View className="w-full">
          <FormError>{error ?? notice}</FormError>
          <Button
            label="Log in"
            onPress={logIn}
            disabled={!identifier.trim() || !password}
            loading={pending}
            className="w-full"
          />
        </View>

        <View className="w-full flex-row items-center gap-3">
          <View className="h-px flex-1 bg-line-strong" />
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[1.92px] text-ink-3">
            Or continue with
          </Text>
          <View className="h-px flex-1 bg-line-strong" />
        </View>

        <View className="flex-row gap-4">
          <Press
            onPress={google}
            disabled={pending}
            accessibilityLabel="Continue with Google"
            className="h-16 w-[72px] items-center justify-center rounded-xl border border-line bg-surf-raised"
            style={ELEVATION.card}
          >
            <Image source={GOOGLE} style={{ width: 28, height: 28 }} contentFit="contain" />
          </Press>
          <Press
            onPress={sendCode}
            accessibilityLabel="Continue with an emailed code"
            className="h-16 w-[72px] items-center justify-center rounded-xl border border-line bg-surf-raised"
            style={ELEVATION.card}
          >
            <Icon name="mail" size={28} color={tokens.text1} />
          </Press>
        </View>

        <View className="flex-1" />

        <View className="flex-row items-center gap-1">
          <Text className="font-ui text-[14px] leading-5 text-ink-2">New here?</Text>
          <Pressable
            onPress={() => router.replace('/sign-up')}
            accessibilityRole="link"
            hitSlop={10}
          >
            <Text className="font-ui-sb text-[14px] leading-5 text-green">Create an account</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={asGuest}
          accessibilityRole="link"
          className="h-11 flex-row items-center gap-1"
        >
          <Text className="font-ui-sb text-[14px] leading-5 text-green">
            Read today’s devotional without signing in
          </Text>
          <Icon name="chevronRight" size={16} color={tokens.green} />
        </Pressable>

        <Text className="text-center font-ui-md text-[12px] uppercase leading-4 tracking-[2.88px] text-ink-3">
          Read · Pray · Grow together
        </Text>
      </ScrollView>
      {invite.sheet}
    </KeyboardView>
  );
}
