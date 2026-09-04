import { memo, useCallback, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, SlideInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import QRCode from 'react-native-qrcode-svg';

import { Icon, type IconName } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { GuestMark, LeafGlyph } from '../../src/components/BrandMarks';
import { Button, Card, Grabber, Pill, ProgressBar, Toggle } from '../../src/components/ui';
import { ErrorState, Skeleton } from '../../src/components/states';
import { useTheme, useTokens } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../src/state/auth';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useCan, useMyRegistrations, useProfile, useProgress, useSaved } from '../../src/api/queries';
import { PERM } from '../../src/api/types';
import { DURATION } from '../../src/theme/tokens';
import type { EventRegistration } from '../../src/api/types';

/**
 * Me — profile, progress, tickets and preferences.
 *
 * For a guest this screen *is* the auth surface (05-navigation.md), which is
 * why the signed-out state is a full replacement rather than a banner.
 */
export default function MeScreen() {
  const { isGuest } = useAuth();
  return isGuest ? <GuestMe /> : <MemberMe />;
}

// ─── Signed in ─────────────────────────────────────────────────────────────

function MemberMe() {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { scheme, setScheme } = useTheme();
  const { user, signOut } = useAuth();
  const navClearance = useNavClearance(24);

  const router = useRouter();
  const profile = useProfile();
  const progress = useProgress();
  const saved = useSaved('devotional');

  // Capability, never a role code (05-navigation.md). Leaders keep the whole
  // teen experience; the Console is an additional place, entered deliberately.
  const canManageContent = useCan(PERM.contentManage);
  const canManageEvents = useCan(PERM.eventsManage);

  const setDark = useCallback((on: boolean) => setScheme(on ? 'dark' : 'light'), [setScheme]);

  const refreshing = profile.isRefetching || progress.isRefetching;
  const refetch = useCallback(() => {
    profile.refetch();
    progress.refetch();
  }, [profile, progress]);

  const displayName =
    profile.data?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Friend';

  // The hierarchy the teen belongs to, most specific first (hierarchy app).
  const parish = profile.data
    ? [profile.data.parish, profile.data.area].filter(Boolean).join(', ')
    : '';

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: navClearance }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
    >
      {/* Cover + overlapping avatar */}
      <View className="border-b border-line">
        <View style={{ height: 140 + insets.top, backgroundColor: '#2D6340' }}>
          {profile.data?.avatar && (
            <Photo
              uri={profile.data.avatar}
              fallbackColor="#2D6340"
              accessibilityLabel="Profile cover"
              scrim={{ top: 0.2, bottom: 0.55 }}
              style={{ height: 140 + insets.top, width: '100%' }}
            />
          )}
        </View>
        <View className="absolute -bottom-9 left-5 rounded-full bg-surf-base p-1">
          <Initials name={displayName} size={72} />
        </View>
      </View>

      <View className="border-b border-line px-5 pb-5 pt-11">
        {profile.isPending ? (
          <View className="gap-2">
            <Skeleton width="60%" height={24} />
            <Skeleton width="45%" height={14} />
          </View>
        ) : (
          <>
            <Text className="mb-1 font-ui-b text-[22px] text-ink-1">{displayName}</Text>
            {!!parish && (
              <Text className="mb-2.5 font-ui text-[13px] text-ink-3">{parish}</Text>
            )}
            <View className="self-start">
              <Pill tone="green">
                <LeafGlyph size={11} color={tokens.green} />
                <Text className="font-ui-sb text-[11px] text-green">
                  {/* Roles add capability, they never fork the experience
                      (05-navigation.md). The tag is identity, not a gate. */}
                  {humanise(profile.data?.age_group) ?? 'Teen Member'}
                </Text>
              </Pill>
            </View>
          </>
        )}
      </View>

      {/* Stats */}
      <View className="flex-row gap-2.5 px-5 py-4">
        <StatCard
          label="Day streak"
          value={progress.data?.current_streak}
          sub={progress.data ? `Best: ${progress.data.longest_streak}` : undefined}
          color={tokens.amberBright}
          loading={progress.isPending}
        />
        <StatCard
          label="Devotionals"
          value={progress.data?.devotionals_completed}
          sub="Completed"
          color={tokens.green}
          loading={progress.isPending}
        />
        <StatCard
          label="Chapters"
          value={progress.data?.chapters_read}
          sub={progress.data ? `${progress.data.books_read} books` : undefined}
          loading={progress.isPending}
        />
      </View>

      {progress.isError && (
        <View className="px-5 pb-2">
          <ErrorState error={progress.error} onRetry={progress.refetch} compact />
        </View>
      )}

      {/* Grace — the non-shaming counterpart to a streak (12-gamification.md). */}
      {progress.data && progress.data.grace_balance > 0 && (
        <View className="px-5 pb-5">
          <Card className="flex-row items-center gap-3 p-4">
            <View className="h-9 w-9 items-center justify-center rounded-sm bg-green/10">
              <LeafGlyph size={18} color={tokens.green} />
            </View>
            <View className="flex-1">
              <Text className="font-ui-sb text-[14px] text-ink-1">
                {progress.data.grace_balance} grace {progress.data.grace_balance === 1 ? 'day' : 'days'}
              </Text>
              <Text className="mt-0.5 font-ui text-[12px] leading-4 text-ink-3">
                Life happens. These keep your streak safe when you miss a day.
              </Text>
            </View>
          </Card>
        </View>
      )}

      <GroupLabel>My content</GroupLabel>
      <MenuRow
        icon="bookmark"
        label="Saved"
        sub={saved.unavailable ? undefined : saved.loading ? 'Loading…' : `${saved.count} items`}
      />
      <MyTickets />

      <GroupLabel className="mt-4">Preferences</GroupLabel>
      <MenuRow
        icon={scheme === 'dark' ? 'moon' : 'sun'}
        label="Dark mode"
        action={<Toggle on={scheme === 'dark'} onChange={setDark} label="Toggle dark mode" />}
      />
      <MenuRow
        icon="bell"
        label="Notifications"
        sub="Reminders and event updates"
        onPress={() => router.push('/settings/notifications')}
      />
      <MenuRow
        icon="settings"
        label="Account settings"
        onPress={() => router.push('/settings/account')}
      />

      {/* Role-gated items are invisible, not disabled, to those without the
          capability — no locked doors to rattle (05-navigation.md). */}
      {(canManageContent || canManageEvents) && (
        <>
          <GroupLabel className="mt-4">Leading</GroupLabel>
          <MenuRow
            icon="school"
            label="Console"
            sub="Review and publish devotionals"
            onPress={() => router.push('/console')}
          />
        </>
      )}

      <GroupLabel className="mt-4">Support</GroupLabel>
      <MenuRow
        icon="chat"
        label="Give feedback"
        onPress={() => router.push('/settings/feedback')}
      />
      <MenuRow icon="book" label="About Faith Tribe" sub="RCCG Region 63 Teens" />

      <View className="px-5 pt-6">
        <Button label="Sign out" onPress={signOut} variant="secondary" height={48} />
      </View>

      <Text className="mt-5 px-5 text-center font-ui text-[11px] text-ink-3">
        Faith Tribe · RCCG Region 63 · v1.0.0
      </Text>
    </ScrollView>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────

/** Monogram, used until a real profile photo exists. */
const Initials = memo(function Initials({ name, size }: { name: string; size: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      accessibilityLabel={`Avatar for ${name}`}
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: '#2D6340' }}
    >
      <Text className="font-ui-b text-white" style={{ fontSize: size * 0.32 }}>
        {initials || '?'}
      </Text>
    </View>
  );
});

function StatCard({
  label,
  value,
  sub,
  color,
  loading,
}: {
  label: string;
  value?: number;
  sub?: string;
  color?: string;
  loading?: boolean;
}) {
  const tokens = useTokens();
  return (
    <Card className="flex-1 gap-0.5 px-3 py-3.5">
      {loading ? (
        <Skeleton width={40} height={26} />
      ) : (
        <Text
          className="font-ui-b text-[26px] leading-[28px]"
          style={{ color: color ?? tokens.text1 }}
        >
          {value ?? 0}
        </Text>
      )}
      <Text className="font-ui-sb text-[12px] text-ink-2">{label}</Text>
      {sub && <Text className="font-ui text-[11px] text-ink-3">{sub}</Text>}
    </Card>
  );
}

function GroupLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <Text
      className={`px-5 pb-1.5 pt-2 font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3 ${className}`}
    >
      {children}
    </Text>
  );
}

/** Standard list row — 56px minimum (10-design-system.md). */
const MenuRow = memo(function MenuRow({
  icon,
  label,
  sub,
  action,
  onPress,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  action?: React.ReactNode;
  onPress?: () => void;
}) {
  const tokens = useTokens();
  // A row with a trailing control is not itself tappable — otherwise the whole
  // row and the toggle inside it fight over the same touch.
  const Container = onPress && !action ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress && !action ? 'button' : undefined}
      accessibilityLabel={onPress && !action ? label : undefined}
      className="flex-row items-center gap-3.5 border-b border-line px-5 py-3.5"
    >
      <View className="h-9 w-9 items-center justify-center rounded-sm bg-surf-sunken">
        <Icon name={icon} size={18} color={tokens.text2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-ui-md text-[15px] text-ink-1">{label}</Text>
        {sub && <Text className="mt-px font-ui text-[12px] text-ink-3">{sub}</Text>}
      </View>
      {action ?? <Icon name="chevronRight" size={18} color={tokens.text3} />}
    </Container>
  );
});

// ─── Tickets ───────────────────────────────────────────────────────────────

/**
 * My tickets.
 *
 * A shortcut — 04-information-architecture.md puts the canonical home at
 * Tribe → Events — so it lists what the teen holds and defers detail to the QR.
 */
function MyTickets() {
  const tokens = useTokens();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<EventRegistration | null>(null);

  const registrations = useMyRegistrations();
  const tickets = registrations.data ?? [];

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: DURATION.base }) }],
  }));

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`My tickets, ${tickets.length} events`}
        className="flex-row items-center gap-3 px-5 py-3.5"
      >
        <View className="h-9 w-9 items-center justify-center rounded-sm bg-green-tonal">
          <Icon name="ticket" size={18} color={tokens.green} />
        </View>
        <View className="flex-1">
          <Text className="font-ui-sb text-[14px] text-ink-1">My tickets</Text>
          <Text className="mt-px font-ui text-[12px] text-ink-3">
            {registrations.isPending ? 'Loading…' : `${tickets.length} registered`}
          </Text>
        </View>
        <Animated.View style={chevron}>
          <Icon name="chevronDown" size={16} color={tokens.text3} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <View className="pb-2">
          {tickets.length === 0 ? (
            <Text className="px-5 pb-3 pl-[68px] font-ui text-[13px] text-ink-3">
              Nothing yet — register for an event in Tribe.
            </Text>
          ) : (
            tickets.map((ticket, i) => (
              <Animated.View key={ticket.id} entering={FadeInDown.delay(i * 60).duration(240)}>
                <Pressable
                  onPress={() => setActive(ticket)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show QR code for registration ${ticket.ticket_code ?? ticket.id}`}
                  className="flex-row items-center gap-3 py-2.5 pl-[68px] pr-5"
                >
                  <View className="flex-1">
                    <Text className="font-ui-sb text-[13px] text-ink-1">
                      {ticket.ticket_code ?? 'Registration'}
                    </Text>
                    <Text className="mt-px font-ui text-[12px] text-ink-3">
                      {humanise(ticket.status) ?? ticket.status}
                    </Text>
                  </View>
                  <View className="h-7 flex-row items-center gap-1 rounded-sm bg-green/10 px-2.5">
                    <Icon name="qr" size={13} color={tokens.green} />
                    <Text className="font-ui-sb text-[12px] text-green">QR</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>
      )}

      <TicketSheet ticket={active} onClose={() => setActive(null)} />
    </View>
  );
}

/**
 * The ticket QR.
 *
 * 10-design-system.md specs this as offline-capable with a brightness-boost
 * hint — a teen at a camp gate has no signal. The code shown here is the
 * registration's own code; rendering it as a real scannable symbol is still
 * outstanding (see mobile/README.md).
 */
function TicketSheet({
  ticket,
  onClose,
}: {
  ticket: EventRegistration | null;
  onClose: () => void;
}) {
  const tokens = useTokens();

  return (
    <Modal
      visible={!!ticket}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close ticket"
        style={{ flex: 1, backgroundColor: tokens.surfOverlay, justifyContent: 'flex-end' }}
      >
        {ticket && (
          <Animated.View
            entering={SlideInDown.duration(300)}
            onStartShouldSetResponder={() => true}
            className="rounded-t-2xl bg-surf-raised px-5 pb-10 pt-5"
          >
            <Grabber />
            <Text className="mb-1 text-center font-ui-b text-[20px] text-ink-1">Your ticket</Text>
            <Text className="mb-6 text-center font-ui text-[13px] text-ink-3">
              Show this at the gate
            </Text>

            {/* A real, scannable code — not the decorative glyph this used to
                be. Generated on the device from the registration's own code, so
                it works with no signal at the gate, which is exactly what
                10-design-system.md asks of the ticket QR.

                Always on white with a quiet zone regardless of theme: scanners
                need the contrast, and a dark-mode QR does not read. */}
            <View
              className="mx-auto items-center justify-center rounded-xl border-2 border-line bg-white"
              style={{ width: 220, height: 220 }}
            >
              <QRCode
                value={ticketPayload(ticket)}
                size={180}
                color="#1C1916"
                backgroundColor="#FFFFFF"
                // Medium correction tolerates a scuffed or half-lit screen
                // without inflating the module count.
                ecl="M"
              />
            </View>

            <Text className="mt-4 text-center font-ui-sb text-[13px] tracking-[2px] text-ink-3">
              {ticket.ticket_code ?? ticket.id}
            </Text>

            <View className="mt-5 flex-row items-center gap-3 rounded-md bg-green/10 px-4 py-3.5">
              <Icon name="check" size={18} color={tokens.green} />
              <View className="flex-1">
                <Text className="font-ui-sb text-[13px] text-green">
                  {humanise(ticket.status) ?? 'Registered'}
                </Text>
                <Text className="mt-0.5 font-ui text-[12px] text-ink-3">
                  Works offline — no data needed at the gate
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Modal>
  );
}

// ─── Signed out ────────────────────────────────────────────────────────────

function GuestMe() {
  const tokens = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center bg-surf-base px-6"
      style={{ paddingTop: insets.top }}
    >
      <View className="mb-6 h-24 w-24 items-center justify-center rounded-2xl bg-green/10">
        <GuestMark size={56} color={tokens.green} />
      </View>

      <Text className="mb-2 text-center font-ui-b text-[24px] leading-[31px] text-ink-1">
        Your faith journey{'\n'}starts here
      </Text>
      <Text className="mb-8 max-w-[300px] text-center font-ui text-[15px] leading-6 text-ink-3">
        Sign in to track your progress, save devotionals, and register for events.
      </Text>

      <View className="w-full max-w-[320px] gap-3">
        <Button label="Create a free account" onPress={() => router.push('/register')} height={52} />
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => router.push('/sign-in')}
          height={52}
        />
      </View>

      <Text className="mt-5 max-w-[280px] text-center font-ui text-[12px] leading-[18px] text-ink-3">
        For teens in RCCG Region 63. Ask your teen leader if you need an account.
      </Text>
    </View>
  );
}

/**
 * What the ticket QR encodes.
 *
 * The registration's own ticket code where it has one, falling back to its id —
 * both are what the check-in scanner resolves against
 * (`events.check_in`). Deliberately a bare identifier rather than a URL: the
 * gate scanner is looking one up, not opening a page.
 */
function ticketPayload(ticket: EventRegistration): string {
  return ticket.ticket_code ?? ticket.id;
}

/** "teen_member" -> "Teen member". Returns undefined for empty input. */
function humanise(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  if (!spaced) return undefined;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
