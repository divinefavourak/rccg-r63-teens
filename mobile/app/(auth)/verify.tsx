import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { useReminderInvite } from '../../src/components/ReminderInvite';
import { codeDestination, useAuth } from '../../src/state/auth';
import { toDetails, useSignUp } from '../../src/state/signup';
import { FormError, QuestionScreen } from '../../src/ui/AuthShell';
import { Button } from '../../src/ui/Button';
import { OtpCells } from '../../src/ui/inputs';

const CODE_LENGTH = 6;
/** How long before "Send again" is offered. */
const RESEND_SECONDS = 45;

/**
 * Enter the code.
 *
 * Two callers share it:
 * - sign-up (no params): the code went to the email address on the form;
 * - log in (`?to=<email>`): the code went to that email address.
 *
 * A phone number is never a destination here. SMS codes were removed from the
 * app's interface; a link that still carries one goes back to log in.
 */
export default function VerifyScreen() {
  const router = useRouter();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const { form } = useSignUp();
  const {
    completeSignUp,
    signInWithCode,
    startSignUp,
    requestLoginCode,
    pending,
    error,
    clearError,
  } = useAuth();

  const [code, setCode] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);

  const isLogin = typeof to === 'string' && to.length > 0;
  const details = toDetails(form);

  useEffect(() => clearError, [clearError]);

  // A plain one-second tick. It only runs while there is something to count.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const onChange = useCallback(
    (value: string) => {
      setCode(value);
      if (error) clearError();
    },
    [error, clearError],
  );

  // Signing in with a code, on a phone that has never been asked about
  // reminders. Sign-up asks on the next screen, All set, instead.
  const invite = useReminderInvite(useCallback(() => router.dismissTo('/'), [router]));

  const submit = useCallback(async () => {
    if (code.length !== CODE_LENGTH || pending) return;
    try {
      if (isLogin) {
        await signInWithCode(to, code);
        invite.begin();
      } else {
        await completeSignUp(details, code);
        router.replace('/all-set');
      }
    } catch {
      // The message is in `error`; clear the cells so the next try starts clean.
      setCode('');
    }
  }, [code, pending, isLogin, signInWithCode, to, completeSignUp, details, router, invite]);

  const resend = useCallback(async () => {
    try {
      if (isLogin) await requestLoginCode(to);
      else await startSignUp(details.email, details.phone);
      setCode('');
      setWait(RESEND_SECONDS);
    } catch {
      // Shown through `error`.
    }
  }, [isLogin, requestLoginCode, to, startSignUp, details.email, details.phone]);

  // Reached without the answers that say where the code went (a reload, a
  // stray link): there is nothing to verify, so start again.
  if (!isLogin && (!details.email || !details.phone)) return <Redirect href="/sign-up" />;

  const target = isLogin ? codeDestination(to) : null;
  // A code to a phone number is no longer offered. An old link that still
  // points at one has nowhere to send a new code, so send the teen back to the
  // form rather than showing cells that can never be filled.
  if (isLogin && !target) return <Redirect href="/log-in" />;

  // Log in cannot say "we sent it": the server answers the same whether or not
  // the account exists, so nobody can test which emails are registered. Saying
  // so plainly beats leaving someone waiting for a code that is not coming.
  const helper = isLogin
    ? `If there is an account for ${target?.destination ?? to}, we have sent it 6 digits.`
    : `We sent 6 digits to ${details.email}.`;

  const seconds = String(wait % 60).padStart(2, '0');

  return (
    <QuestionScreen
      onBack={() => router.back()}
      title="Enter the code"
      helper={helper}
      badge="lock"
      badgeColour="amber"
      footer={
        <>
          <FormError>{error}</FormError>
          <Button
            label="Verify"
            onPress={submit}
            disabled={code.length !== CODE_LENGTH}
            loading={pending}
            className="w-full"
          />
        </>
      }
    >
      <OtpCells value={code} onChange={onChange} length={CODE_LENGTH} error={!!error} />

      {wait > 0 ? (
        <Text className="pt-1 text-center font-ui text-[14px] leading-5 text-ink-2">
          Didn’t get it? Send again in {Math.floor(wait / 60)}:{seconds}
        </Text>
      ) : (
        <Pressable
          onPress={resend}
          disabled={pending}
          accessibilityRole="button"
          hitSlop={12}
          className="items-center pt-1"
        >
          <Text className="font-ui-sb text-[14px] leading-5 text-green">Send the code again</Text>
        </Pressable>
      )}

      {isLogin && (
        <Pressable
          onPress={() => router.replace('/sign-up')}
          accessibilityRole="link"
          hitSlop={12}
          className="items-center pt-2"
        >
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            New here? <Text className="font-ui-sb text-green">Create an account</Text>
          </Text>
        </Pressable>
      )}
      {invite.sheet}
    </QuestionScreen>
  );
}
