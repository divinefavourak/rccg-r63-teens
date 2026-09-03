import { memo, useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, SlideInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '../../src/components/Icon';
import { Photo } from '../../src/components/Photo';
import { GuestMark, LeafGlyph } from '../../src/components/BrandMarks';
import { Button, Card, Grabber, Pill, Press, ProgressBar, Toggle } from '../../src/components/ui';
import { useTheme, useTokens } from '../../src/theme/ThemeProvider';
import { useSession } from '../../src/state/session';
import { JOURNEY, MY_TICKETS, PROFILE, PROFILE_COVER, type Ticket } from '../../src/data/content';
import { DURATION } from '../../src/theme/tokens';

/**
 * Me — profile, progress, tickets and preferences.
 *
 * For a guest this screen *is* the auth surface (05-navigation.md), which is
 * why the signed-out state is a full replacement rather than a banner.
 */
export default function MeScreen() {
  const { isGuest } = useSession();
  return isGuest ? <GuestMe /> : <MemberMe />;
}

// ─── Signed in ─────────────────────────────────────────────────────────────

function MemberMe() {
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { scheme, setScheme } = useTheme();
  const { signOut, saved } = useSession();
  const [notifs, setNotifs] = useState(true);

  const setDark = useCallback((on: boolean) => setScheme(on ? 'dark' : 'light'), [setScheme]);

  return (
    <ScrollView
      className="flex-1 bg-surf-base"
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover + overlapping avatar */}
      <View className="border-b border-line">
        <Photo
          uri={PROFILE_COVER}
          fallbackColor="#2D6340"
          accessibilityLabel="Profile cover"
          scrim={{ top: 0.2, bottom: 0.55 }}
          style={{ height: 140 + insets.top, width: '100%' }}
        />
        <View className="absolute -bottom-9 left-5 rounded-full bg-surf-base p-1">
          <Initials name={PROFILE.fullName} size={72} />
        </View>
      </View>

      <View className="border-b border-line px-5 pb-5 pt-11">
        <Text className="mb-1 font-ui-b text-[22px] text-ink-1">{PROFILE.fullName}</Text>
        <Text className="mb-2.5 font-ui text-[13px] text-ink-3">{PROFILE.parish}</Text>
        <View className="self-start">
          <Pill tone="green">
            <LeafGlyph size={11} color={tokens.green} />
            <Text className="font-ui-sb text-[11px] text-green">Teen Member</Text>
          </Pill>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-2.5 px-5 py-4">
        <StatCard label="Day streak" value={PROFILE.streak} sub={`Best: ${PROFILE.bestStreak}`} color={tokens.amberBright} />
        <StatCard label="Days read" value={PROFILE.daysRead} sub="This month" color={tokens.green} />
        <StatCard label="Saved" value={saved.size || PROFILE.savedCount} sub="Items" />
      </View>

      {/* Journey */}
      <View className="px-5 pb-5">
        <Card className="p-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="font-ui-sb text-[15px] text-ink-1">{JOURNEY.title}</Text>
            <Text className="font-ui-b text-[13px] text-green">
              {Math.round((JOURNEY.day / JOURNEY.total) * 100)}%
            </Text>
          </View>
          <ProgressBar value={JOURNEY.day / JOURNEY.total} />
          <Text className="mt-2 font-ui text-[12px] text-ink-3">
            Day {JOURNEY.day} of {JOURNEY.total} — {JOURNEY.total - JOURNEY.day} days remaining
          </Text>
        </Card>
      </View>

      <GroupLabel>My content</GroupLabel>
      <MenuRow icon="bookmark" label="Saved" sub={`${saved.size || PROFILE.savedCount} items`} />
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
        sub="Daily reminders at 7:00 AM"
        action={<Toggle on={notifs} onChange={setNotifs} label="Toggle notifications" />}
      />
      <MenuRow icon="settings" label="Account settings" />

      <GroupLabel className="mt-4">Support</GroupLabel>
      <MenuRow icon="chat" label="Give feedback" />
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

/** Gradient monogram, used until a real profile photo exists. */
const Initials = memo(function Initials({ name, size }: { name: string; size: number }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);
  return (
    <View
      accessibilityLabel={`Avatar for ${name}`}
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: '#2D6340' }}
    >
      <Text className="font-ui-b text-white" style={{ fontSize: size * 0.32 }}>
        {initials}
      </Text>
    </View>
  );
});

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  color?: string;
}) {
  const tokens = useTokens();
  return (
    <Card className="flex-1 gap-0.5 px-3 py-3.5">
      <Text className="font-ui-b text-[26px] leading-[28px]" style={{ color: color ?? tokens.text1 }}>
        {value}
      </Text>
      <Text className="font-ui-sb text-[12px] text-ink-2">{label}</Text>
      {sub && <Text className="font-ui text-[11px] text-ink-3">{sub}</Text>}
    </Card>
  );
}

function GroupLabel({ children, className = '' }: { children: string; className?: string }) {
  return (
    <Text className={`px-5 pb-1.5 pt-2 font-ui-sb text-[12px] uppercase tracking-[1px] text-ink-3 ${className}`}>
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
}: {
  icon: IconName;
  label: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-center gap-3.5 border-b border-line px-5 py-3.5">
      <View className="h-9 w-9 items-center justify-center rounded-sm bg-surf-sunken">
        <Icon name={icon} size={18} color={tokens.text2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-ui-md text-[15px] text-ink-1">{label}</Text>
        {sub && <Text className="mt-px font-ui text-[12px] text-ink-3">{sub}</Text>}
      </View>
      {action ?? <Icon name="chevronRight" size={18} color={tokens.text3} />}
    </View>
  );
});

// ─── Tickets ───────────────────────────────────────────────────────────────

function MyTickets() {
  const tokens = useTokens();
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<Ticket | null>(null);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: DURATION.base }) }],
  }));

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`My tickets, ${MY_TICKETS.length} upcoming events`}
        className="flex-row items-center gap-3 px-5 py-3.5"
      >
        <View className="h-9 w-9 items-center justify-center rounded-sm bg-green-tonal">
          <Icon name="ticket" size={18} color={tokens.green} />
        </View>
        <View className="flex-1">
          <Text className="font-ui-sb text-[14px] text-ink-1">My tickets</Text>
          <Text className="mt-px font-ui text-[12px] text-ink-3">
            {MY_TICKETS.length} upcoming events
          </Text>
        </View>
        <Animated.View style={chevron}>
          <Icon name="chevronDown" size={16} color={tokens.text3} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <View className="pb-2">
          {MY_TICKETS.map((ticket, i) => (
            <Animated.View key={ticket.id} entering={FadeInDown.delay(i * 60).duration(240)}>
              <Pressable
                onPress={() => setActive(ticket)}
                accessibilityRole="button"
                accessibilityLabel={`Show QR code for ${ticket.name}`}
                className="flex-row items-center gap-3 py-2.5 pl-[68px] pr-5"
              >
                <View className="flex-1">
                  <Text className="font-ui-sb text-[13px] text-ink-1">{ticket.name}</Text>
                  <Text className="mt-px font-ui text-[12px] text-ink-3">{ticket.date}</Text>
                </View>
                <View className="h-7 flex-row items-center gap-1 rounded-sm bg-green/10 px-2.5">
                  <Icon name="qr" size={13} color={tokens.green} />
                  <Text className="font-ui-sb text-[12px] text-green">QR</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
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
 * hint — a teen at a camp gate has no signal and a dim screen. The code itself
 * is rendered from the ticket string, so it works with the app fully offline.
 */
function TicketSheet({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
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
            <Text className="mb-1 text-center font-ui-b text-[20px] text-ink-1">{ticket.name}</Text>
            <Text className="mb-1 text-center font-ui text-[13px] text-ink-3">{ticket.date}</Text>
            <Text className="mb-6 text-center font-ui text-[12px] text-ink-3">{ticket.location}</Text>

            <View
              className="mx-auto items-center justify-center rounded-xl border-2 border-line bg-white p-5"
              style={{ width: 220, height: 220 }}
            >
              <Icon name="qr" size={170} color="#1C1916" />
            </View>

            <Text className="mt-4 text-center font-ui-sb text-[13px] tracking-[2px] text-ink-3">
              {ticket.code}
            </Text>

            <View className="mt-5 flex-row items-center gap-3 rounded-md bg-green/10 px-4 py-3.5">
              <Icon name="check" size={18} color={tokens.green} />
              <View className="flex-1">
                <Text className="font-ui-sb text-[13px] text-green">Registration confirmed</Text>
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
  const { signIn } = useSession();
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
        Create an account to track your progress, save devotionals, and register for events.
      </Text>

      <View className="w-full max-w-[320px] gap-3">
        <Button label="Create a free account" onPress={signIn} height={52} />
        <Button label="I already have an account" onPress={signIn} variant="secondary" height={52} />
      </View>

      <Text className="mt-5 max-w-[280px] text-center font-ui text-[12px] leading-[18px] text-ink-3">
        For teens in RCCG Region 63. Sign up with your parish email or ask your teen leader for a
        code.
      </Text>
    </View>
  );
}
