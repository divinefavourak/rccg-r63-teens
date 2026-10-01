import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { LogoLockup } from '../src/components/Logo';
import { Button } from '../src/components/ui';
import { useTokens } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/state/auth';

/**
 * Sign in.
 *
 * Reached from a contextual prompt — an action that genuinely needs an account
 * — never from an interstitial on open (05-navigation.md). Dismissing it
 * returns to the guest experience rather than blocking the app.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { signIn, pending, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !pending;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    try {
      await signIn(username.trim(), password);
      // Back to wherever the prompt came from, now signed in.
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch {
      // `useAuth` already put a readable message in `error`; the screen stays
      // open so the teen can correct it.
    }
  }, [canSubmit, signIn, username, password, router]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surf-base"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={router.back}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          className="absolute left-6 h-10 w-10 items-center justify-center rounded-md border border-line bg-surf-raised"
          style={{ top: insets.top + 8 }}
        >
          <Icon name="close" size={18} color={tokens.text2} />
        </Pressable>

        <View className="mb-8 items-center">
          <View className="mb-5">
            <LogoLockup size={64} />
          </View>
          <Text className="mb-1.5 text-center font-ui-b text-[24px] text-ink-1">
            Welcome back
          </Text>
          <Text className="max-w-[300px] text-center font-ui text-[14px] leading-[22px] text-ink-3">
            Sign in to keep your streak, save devotionals and register for events.
          </Text>
        </View>

        <View className="gap-3">
          <Field label="Username">
            <TextInput
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                if (error) clearError();
              }}
              placeholder="Your username"
              placeholderTextColor={tokens.text3}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Username"
              className="h-12 flex-1 font-ui text-[15px] text-ink-1"
              style={{ paddingVertical: 0 }}
            />
          </Field>

          <Field label="Password">
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) clearError();
              }}
              placeholder="Your password"
              placeholderTextColor={tokens.text3}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
              className="h-12 flex-1 font-ui text-[15px] text-ink-1"
              style={{ paddingVertical: 0 }}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
            >
              <Icon name={showPassword ? 'moon' : 'sun'} size={18} color={tokens.text3} />
            </Pressable>
          </Field>

          {error && (
            // Inline, below the fields, specific — 11-content-strategy.md.
            <View className="flex-row items-start gap-2 rounded-sm px-1 py-1">
              <Text
                accessibilityLiveRegion="polite"
                className="flex-1 font-ui-md text-[13px] leading-5"
                style={{ color: tokens.error }}
              >
                {error}
              </Text>
            </View>
          )}

          <Button
            label="Sign in"
            onPress={submit}
            loading={pending}
            disabled={!canSubmit}
            height={52}
            className="mt-2"
          />
        </View>

        <Pressable
          onPress={() => router.replace('/register')}
          accessibilityRole="button"
          className="mt-6 items-center"
        >
          <Text className="font-ui text-[13px] text-ink-3">
            New here? <Text className="font-ui-sb text-green">Create an account</Text>
          </Text>
        </Pressable>

        <Text className="mt-4 text-center font-ui text-[12px] leading-[18px] text-ink-3">
          For teens in RCCG Region 63.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Label above the field — 10-design-system.md, 48px minimum height. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-1.5 font-ui-sb text-[13px] text-ink-2">{label}</Text>
      <View className="h-12 flex-row items-center gap-2 rounded-md border border-line bg-surf-raised px-3.5">
        {children}
      </View>
    </View>
  );
}
