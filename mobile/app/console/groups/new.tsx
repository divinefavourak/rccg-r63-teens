import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useBatchQuote,
  useCreateBatch,
  useEvent,
  useGroupEvents,
  useIdentity,
} from '../../../src/api/queries';
import { naira } from '../../../src/components/PaymentPieces';
import { DEFAULT_COUNTRY, type Country } from '../../../src/data/countries';
import { dayLabel } from '../../../src/data/events';
import { toE164, useAuth } from '../../../src/state/auth';
import { FormError } from '../../../src/ui/AuthShell';
import { Button } from '../../../src/ui/Button';
import { OptionRow, TextField, Toggle } from '../../../src/ui/inputs';
import { PhoneField } from '../../../src/ui/PhoneField';
import { BackHeader, EmptyState, KeyboardView, Skeleton } from '../../../src/ui/screen';

const EMAIL = /^\S+@\S+\.\S+$/;

/** A count typed into a box: digits only, nothing silly. */
const count = (text: string) => Math.min(Number(text.replace(/\D/g, '')) || 0, 2000);

/**
 * New group: a headcount of boys and girls for one event, from one part of the
 * church. Each seat gets a ticket number and a code to hand out.
 */
export default function NewGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const identity = useIdentity();
  const events = useGroupEvents();
  const create = useCreateBatch();

  // Where this coordinator holds a role. The server checks they can register
  // groups there, and says so if not.
  const places = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of identity.data?.role_assignments ?? []) {
      if (a.is_active && a.node && !seen.has(a.node)) {
        seen.set(a.node, a.node_detail?.name ?? 'Your area');
      }
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [identity.data]);

  const [eventId, setEventId] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [boys, setBoys] = useState('');
  const [girls, setGirls] = useState('');
  // Started from the account but asked for every time: the email on some
  // coordinators' accounts is not one they read.
  const [email, setEmail] = useState(user?.email ?? '');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = events.data ?? [];
  useEffect(() => {
    if (!eventId && open.length === 1) setEventId(open[0].id);
  }, [eventId, open]);
  useEffect(() => {
    if (!nodeId && places.length > 0) setNodeId(places[0].id);
  }, [nodeId, places]);

  const male = count(boys);
  const female = count(girls);
  const event = open.find((e) => e.id === eventId);
  const detail = useEvent(eventId || undefined);
  const needsConsent = !!detail.data?.requires_guardian_consent;
  const quote = useBatchQuote(eventId, male, female);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/groups'));

  const submit = async () => {
    const number = toE164(phone, country.dial);
    if (!eventId) return setError('Choose the event.');
    if (!nodeId) return setError('There is no part of the church you register groups for.');
    if (male + female === 0) return setError('Enter how many boys and girls are coming.');
    if (!EMAIL.test(email.trim())) return setError('Enter an email address you read.');
    if (!number) return setError('Enter a phone number we can reach you on.');
    if (needsConsent && !consent) {
      return setError('This event needs a parent or guardian’s consent for every teen.');
    }
    setError(null);
    try {
      const group = await create.mutateAsync({
        event: eventId,
        node: nodeId,
        male_count: male,
        female_count: female,
        contact_email: email.trim(),
        contact_phone: number,
        consent_attested: consent,
      });
      router.replace({ pathname: '/console/groups/[id]', params: { id: group.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    }
  };

  if (events.isPending || identity.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="New group" onBack={back} />
        <View className="gap-3 px-5 pt-4">
          <Skeleton height={60} />
          <Skeleton height={60} />
          <Skeleton height={200} />
        </View>
      </View>
    );
  }

  if (open.length === 0) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="New group" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="plant"
            message={
              events.isError
                ? 'We couldn’t load the events. Check your connection, then try again.'
                : 'No event is taking group registrations right now.'
            }
            actionLabel={events.isError ? 'Try again' : 'Back'}
            onAction={events.isError ? () => events.refetch() : back}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="New group" onBack={back} />
      <KeyboardView>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            gap: 16,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
        >
          <Label>Event</Label>
          <View className="gap-2">
            {open.map((e) => (
              <OptionRow
                key={e.id}
                title={e.title}
                detail={dayLabel(new Date(e.start_datetime))}
                selected={e.id === eventId}
                onPress={() => setEventId(e.id)}
              />
            ))}
          </View>

          {places.length > 1 && (
            <>
              <Label>Registering for</Label>
              <View className="gap-2">
                {places.map((p) => (
                  <OptionRow
                    key={p.id}
                    title={p.name}
                    selected={p.id === nodeId}
                    onPress={() => setNodeId(p.id)}
                  />
                ))}
              </View>
            </>
          )}
          {places.length === 1 && (
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              Registering for {places[0].name}
            </Text>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField label="Boys" value={boys} onChange={setBoys} keyboardType="number-pad" maxLength={4} large />
            </View>
            <View className="flex-1">
              <TextField label="Girls" value={girls} onChange={setGirls} keyboardType="number-pad" maxLength={4} large />
            </View>
          </View>

          {event && male + female > 0 && (
            <View className="w-full gap-1 rounded-2xl bg-surf-sunken p-4">
              {quote.isPending ? (
                <Skeleton height={44} />
              ) : quote.data ? (
                <>
                  <Text className="font-ui-b text-[20px] leading-7 text-ink-1">
                    {event.is_free ? 'Free' : naira(quote.data.amount_due)}
                  </Text>
                  {!event.is_free && (
                    <Text className="font-ui text-[14px] leading-5 text-ink-2">
                      {quote.data.headcount} × {naira(quote.data.unit_price)}
                      {quote.data.group_discount_applied &&
                        ` (group price; ${naira(quote.data.regular_price)} each on its own)`}
                    </Text>
                  )}
                  <Text className="font-ui text-[12px] leading-4 text-ink-3">
                    {event.payment_method === 'manual'
                      ? 'Paid by bank transfer, with a photo of the receipt.'
                      : 'Paid online on Squad.'}
                  </Text>
                </>
              ) : (
                <Text className="font-ui text-[14px] leading-5 text-feedback-error">
                  {quote.error instanceof Error ? quote.error.message : 'The price did not load.'}
                </Text>
              )}
            </View>
          )}

          <TextField
            label="Your email for this group"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            hint="Check this is an email you read: everything about this group goes there."
          />
          <PhoneField country={country} onCountry={setCountry} value={phone} onChange={setPhone} />

          {needsConsent && (
            <View className="flex-row items-center gap-3 rounded-2xl bg-surf-sunken p-4">
              <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-1">
                A parent or guardian has agreed for every teen in this group to come.
              </Text>
              <Toggle on={consent} onChange={setConsent} label="Guardian consent given" />
            </View>
          )}

          <View>
            <FormError>{error}</FormError>
            <Button
              label="Register group"
              onPress={submit}
              loading={create.isPending}
              className="w-full"
            />
          </View>
        </ScrollView>
      </KeyboardView>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="-mb-2 font-ui-sb text-[14px] leading-5 text-ink-2">{children}</Text>;
}
