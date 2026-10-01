import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { codeDestination, useAuth } from '../../src/state/auth';
import { toDetails, useSignUp } from '../../src/state/signup';
import { FormError, QuestionScreen } from '../../src/ui/AuthShell';
import { Button } from '../../src/ui/Button';
import { OtpCells } from '../../src/ui/inputs';

const CODE_LENGTH = 6;
/** How long before "Send again" is offered. */
const RESEND_SECONDS = 45;

/** "+2348035550142" → "+234 803 555 0142". Anything else is shown as it is. */
function prettyPhone(phone: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

/**
 * Enter the code.
 *
 * Two callers share it:
 * - sign-up (no params): the code went to both the email and the phone, and
 *   either copy creates the account;
 * - log in (`?to=<email or phone>`): the code went to that one place.
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

  const submit = useCallback(async () => {
    if (code.length !== CODE_LENGTH || pending) return;
    try {
      if (isLogin) {
        await signInWithCode(to, code);
        router.dismissTo('/');
      } else {
        await completeSignUp(details, code);
        router.replace('/all-set');
      }
    } catch {
      // The message is in `error`; clear the cells so the next try starts clean.
      setCode('');
    }
  }, [code, pending, isLogin, signInWithCode, to, completeSignUp, details, router]);

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
  const helper = isLogin
    ? `We sent 6 digits to ${
        target?.channel === 'sms' ? prettyPhone(target.destination) : (target?.destination ?? to)
      }.`
    : `We sent the same 6 digits to ${details.email} and ${prettyPhone(details.phone)}. Use whichever arrives first.`;

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
    </QuestionScreen>
  );
}
