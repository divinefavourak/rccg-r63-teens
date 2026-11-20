import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../src/api/client';
import { useClaimTicket } from '../../src/api/queries';
import { useAuth } from '../../src/state/auth';
import { FormError } from '../../src/ui/AuthShell';
import { Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/inputs';
import { BackHeader, EmptyState, KeyboardView } from '../../src/ui/screen';

/** Letters and digits only, upper case: how a code is typed does not matter. */
const clean = (v: string) => v.replace(/[^0-9a-z]/gi, '').toUpperCase();

/** "K7Q2MX8B" as "K7Q2-MX8B", the way the ticket sheet prints it. */
const spaced = (v: string) => (v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v);

const CODE_LENGTH = 8;
/** Seats made before codes grew to eight characters: claimed with their ticket number too. */
const OLD_CODE_LENGTH = 6;

/**
 * Claim a ticket: a seat a coordinator registered in a group, handed out as a
 * code. Claiming puts the seat on this account, with the teen's own name, age
 * and phone from their profile. An older, six-character code also needs the
 * ticket number that came with it, so that field appears only then.
 *
 * Opened from My tickets or from an event, and by a link carrying `?code=`.
 */
export default function ClaimTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const claim = useClaimTicket();
  const params = useLocalSearchParams<{ code?: string }>();

  const [ticket, setTicket] = useState('');
  const [code, setCode] = useState(() => clean(params.code ?? '').slice(0, CODE_LENGTH));
  const [needTicket, setNeedTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The keyboard's Done can fire while a claim is still on its way; the
  // button's spinner does not stop that.
  const sending = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tickets'));

  const submit = async () => {
    if (sending.current) return;
    const registration_id = ticket.trim().toUpperCase();
    const claim_code = code;
    const older = claim_code.length === OLD_CODE_LENGTH;
    if (claim_code.length !== CODE_LENGTH && !older) {
      setError('Enter the 8-character code your coordinator gave you.');
      return;
    }
    if (older && !registration_id) {
      setNeedTicket(true);
      setError('That is one of the older, shorter codes. Enter the ticket number that came with it too.');
      return;
    }
    setError(null);
    sending.current = true;
    try {
      const seat = await claim.mutateAsync({
        claim_code,
        ...(registration_id ? { registration_id } : {}),
      });
      router.replace({ pathname: '/ticket/[id]', params: { id: seat.id } });
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.payload as { code?: string } | undefined)?.code === 'ticket_needed'
      ) {
        setNeedTicket(true);
      }
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      sending.current = false;
    }
  };

  if (isGuest) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Claim a ticket" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="strolling"
            message="Make an account first, then claim the ticket your coordinator gave you."
            actionLabel="Sign up"
            onAction={() => router.push('/sign-up')}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Claim a ticket" onBack={back} />
      <KeyboardView>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            gap: 16,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
        >
          <View className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-sky p-4">
            <View className="min-w-0 flex-1 gap-1">
              <Text className="font-ui-b text-[17px] leading-6 text-pop-on">
                Got a ticket from your coordinator?
              </Text>
              <Text className="font-ui text-[14px] leading-5 text-pop-on">
                Enter the code they gave you. Your name, age and phone go on the ticket from your
                profile.
              </Text>
            </View>
            <Object3D name="star" size={56} />
          </View>

          <TextField
            label="Code"
            value={spaced(code)}
            // Dashes and spaces out first, then eight: a code pasted as
            // "k7q2 mx8b" or "K7Q2-MX8B" fits the same.
            onChange={(v) => setCode(clean(v).slice(0, CODE_LENGTH))}
            placeholder="XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            large
            returnKeyType={needTicket ? 'next' : 'done'}
            onSubmitEditing={needTicket ? undefined : submit}
          />
          {needTicket && (
            <TextField
              label="Ticket number"
              value={ticket}
              onChange={(v) => setTicket(v.toUpperCase())}
              placeholder="As your coordinator wrote it"
              hint="Only older codes need this."
              autoCapitalize="characters"
              autoComplete="off"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}

          <View className="flex-1" />
          <View>
            <FormError>{error}</FormError>
            <Button
              label="Claim ticket"
              onPress={submit}
              loading={claim.isPending}
              className="w-full"
            />
          </View>
        </ScrollView>
      </KeyboardView>
    </View>
  );
}
