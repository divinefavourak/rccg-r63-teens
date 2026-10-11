import { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { api, ApiError } from '../../src/api/client';
import { FormError, QuestionScreen } from '../../src/ui/AuthShell';
import { Button } from '../../src/ui/Button';
import { IconField } from '../../src/ui/inputs';

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Forgot password.
 *
 * Asks for the email on the account and has the server send a link to set a
 * new password. The link opens the website's reset page, so this is the whole
 * of it in the app: ask, then say where to look (06-user-flows.md, log in).
 *
 * Only accounts with a password have one to forget. A teen who joined in the
 * app signs in with a code instead, which is why the way back to that is
 * offered on both states.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const address = email.trim().toLowerCase();
  const valid = EMAIL.test(address);

  const onChange = useCallback((value: string) => {
    setEmail(value);
    setError(null);
  }, []);

  const send = useCallback(async () => {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password/', { email: address }, { anonymous: true });
      setSentTo(address);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 429) {
        setError('Too many tries. Wait a few minutes, then try again.');
      } else if (status === 0) {
        // Never reached the server, so nothing about any account was learned.
        setError('We could not send the link. Check your connection and try again.');
      } else {
        // The server answered with an error. It answers every address the same
        // way on purpose; if a failure that only a real account can cause (its
        // email would not send) showed differently here, this screen would say
        // which addresses have accounts. So it shows what it always shows.
        setSentTo(address);
      }
    } finally {
      setPending(false);
    }
  }, [valid, pending, address]);

  const back = useCallback(() => router.back(), [router]);

  if (sentTo) {
    return (
      <QuestionScreen
        onBack={back}
        title="Check your email"
        // The server answers the same whether or not the account exists, so
        // nobody can use this to test which emails are registered. Saying "if"
        // is honest about that.
        helper={`If there is an account for ${sentTo}, a link to set a new password is on its way.`}
        badge="lock"
        badgeColour="lime"
        footer={<Button label="Back to log in" onPress={back} className="w-full" />}
      >
        <Text className="font-ui text-[14px] leading-5 text-ink-2">
          It can take a minute to arrive. Look in spam too. The link opens in your browser; when
          you have set a new password, come back here and log in.
        </Text>
        <Text className="font-ui text-[14px] leading-5 text-ink-2">
          Nothing after a few minutes? Your account may not have a password. Go back and choose
          “No password? Get a code”.
        </Text>
      </QuestionScreen>
    );
  }

  return (
    <QuestionScreen
      onBack={back}
      title="Forgot your password?"
      helper="Enter the email on your account and we will send you a link to set a new one."
      badge="lock"
      badgeColour="amber"
      footer={
        <>
          <FormError>{error}</FormError>
          <Button
            label="Send reset link"
            onPress={send}
            disabled={!valid}
            loading={pending}
            className="w-full"
          />
        </>
      }
    >
      <IconField
        icon="mail"
        label="Email address"
        value={email}
        onChange={onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={send}
      />
    </QuestionScreen>
  );
}
