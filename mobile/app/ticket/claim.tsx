import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useClaimTicket } from '../../src/api/queries';
import { useAuth } from '../../src/state/auth';
import { FormError } from '../../src/ui/AuthShell';
import { Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { TextField } from '../../src/ui/inputs';
import { BackHeader, EmptyState, KeyboardView } from '../../src/ui/screen';

/**
 * Claim a ticket: a seat a coordinator registered in a group, handed out as a
 * ticket number and a six-letter code. Claiming puts the seat on this account,
 * with the teen's own name, age and phone from their profile.
 */
export default function ClaimTicketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const claim = useClaimTicket();

  const [ticket, setTicket] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/tickets'));

  const submit = async () => {
    const registration_id = ticket.trim().toUpperCase();
    const claim_code = code.replace(/\s/g, '').toUpperCase();
    if (!registration_id || claim_code.length !== 6) {
      setError('Enter the ticket number and the six-letter code your coordinator gave you.');
      return;
    }
    setError(null);
    try {
      const seat = await claim.mutateAsync({ registration_id, claim_code });
      router.replace({ pathname: '/ticket/[id]', params: { id: seat.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
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
                Enter its number and code. Your name, age and phone go on it from your profile.
              </Text>
            </View>
            <Object3D name="star" size={56} />
          </View>

          <TextField
            label="Ticket number"
            value={ticket}
            onChange={(v) => setTicket(v.toUpperCase())}
            placeholder="As your coordinator wrote it"
            autoCapitalize="characters"
            autoComplete="off"
            returnKeyType="next"
          />
          <TextField
            label="Code"
            value={code}
            onChange={(v) => setCode(v.toUpperCase())}
            placeholder="6 letters and numbers"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
            large
            returnKeyType="done"
            onSubmitEditing={submit}
          />

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
