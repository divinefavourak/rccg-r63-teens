import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';

import {
  useEvents,
  useMyRegistrations,
  useNotifications,
  useProfile,
  useUnreadCount,
} from '../../src/api/queries';
import type { EventListItem } from '../../src/api/types';
import { EventPhoto, EventRow, ROW_COLOURS } from '../../src/components/EventPieces';
import { Icon } from '../../src/components/Icon';
import { useNavClearance } from '../../src/components/useNavClearance';
import { PROVINCES } from '../../src/data/choices';
import { isClosed, isLive, isPast, priceLabel, startOf, whereLabel } from '../../src/data/events';
import { dayAgo } from '../../src/data/time';
import { useAuth } from '../../src/state/auth';
import { Object3D, RCCG_LOGO, type ObjectName } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { DateBadge, PopCard, PopEyebrow } from '../../src/ui/cards';
import { ChipRow } from '../../src/ui/inputs';
import { Press } from '../../src/ui/Press';
import {
  EmptyState,
  IconButton,
  OfflineBar,
  SectionTitle,
  Skeleton,
  TabHeader,
} from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import type { PopColour } from '../../src/theme/tokens';

type Section = 'events' | 'notices' | 'church';

const SECTIONS = [
  { value: 'events', label: 'Events' },
  { value: 'notices', label: 'Notices' },
  { value: 'church', label: 'My Church' },
] as const;

/**
 * Tribe — what is happening, what leaders have said, and where you belong.
 *
 * The one tab with real photography (09-design-principles.md). Three sections
 * behind chips rather than three screens, so the tab keeps one scroll position
 * and one back step.
 */
export default function TribeScreen() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const navClearance = useNavClearance(24);
  const [section, setSection] = useState<Section>('events');

  const events = useEvents();
  const unread = useUnreadCount(!isGuest);

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="Tribe">
        <IconButton icon="qr" label="My tickets" onPress={() => router.push('/tickets')} />
        <IconButton
          icon="bell"
          label={(unread.data?.unread_count ?? 0) > 0 ? 'Notifications, unread' : 'Notifications'}
          dot={(unread.data?.unread_count ?? 0) > 0}
          onPress={() => router.push('/notifications')}
        />
      </TabHeader>

      {section === 'events' && events.isError && !!events.data && <OfflineBar />}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: navClearance,
        }}
        refreshControl={
          <RefreshControl refreshing={events.isRefetching} onRefresh={events.refetch} />
        }
      >
        <ChipRow options={SECTIONS} value={section} onChange={setSection} />

        {section === 'events' && <Events />}
        {section === 'notices' && <Notices />}
        {section === 'church' && <MyChurch />}
      </ScrollView>
    </View>
  );
}

// ─── Events ────────────────────────────────────────────────────────────────

function Events() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const events = useEvents();
  const mine = useMyRegistrations(!isGuest);

  const registered = useMemo(
    () => new Set((mine.data ?? []).filter(isLive).map((r) => r.event)),
    [mine.data],
  );

  // What a teen can still turn up to, soonest first. Past events have their
  // own screen, so the tab opens on the next thing rather than the last one.
  const { upcoming, pastCount } = useMemo(() => {
    const all = (events.data ?? []).filter((e) => e.status !== 'cancelled');
    const now = Date.now();
    return {
      upcoming: all
        .filter((e) => !isPast(e, now))
        .sort((a, b) => startOf(a).getTime() - startOf(b).getTime()),
      pastCount: all.filter((e) => isPast(e, now)).length,
    };
  }, [events.data]);

  const open = useCallback(
    (id: string) => router.push({ pathname: '/event/[id]', params: { id } }),
    [router],
  );

  if (events.isPending) {
    return (
      <>
        <Skeleton height={340} radius={28} />
        <Skeleton width={160} height={24} radius={8} />
        <Skeleton height={84} />
        <Skeleton height={84} />
      </>
    );
  }

  if (events.isError && !events.data) {
    return (
      <View className="flex-1 justify-center">
        <EmptyState
          drawing="sitting"
          message="We couldn’t load events. Check your connection, then try again."
          actionLabel="Try again"
          onAction={() => events.refetch()}
        />
      </View>
    );
  }

  if (upcoming.length === 0) {
    return (
      <EmptyState
        drawing="strolling"
        message="Nothing is coming up yet. When your church plans something, it will show here."
        actionLabel={pastCount > 0 ? 'See past events' : undefined}
        onAction={() => router.push('/events/past')}
      />
    );
  }

  // The organiser's pick, otherwise simply the next thing on.
  const featured = upcoming.find((e) => e.is_featured) ?? upcoming[0];
  const rest = upcoming.filter((e) => e.id !== featured.id);

  return (
    <>
      <FeaturedEvent event={featured} registered={registered.has(featured.id)} onOpen={open} />

      {rest.length > 0 && (
        <>
          <SectionTitle>More coming up</SectionTitle>
          {rest.map((event, i) => (
            <EventRow
              key={event.id}
              event={event}
              colour={ROW_COLOURS[i % ROW_COLOURS.length]}
              registered={registered.has(event.id)}
              onOpen={open}
            />
          ))}
        </>
      )}

      {pastCount > 0 && (
        <Button
          label="See past events"
          variant="tertiary"
          onPress={() => router.push('/events/past')}
          className="h-12 self-center"
        />
      )}

      <PopCard colour="pink" className="mt-2 w-full gap-1">
        <PopEyebrow>Coming soon</PopEyebrow>
        <Text className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-pop-on">
          Community notes
        </Text>
        <Text className="pr-16 font-ui text-[14px] leading-5 text-pop-on">
          Share what God is doing with your tribe.
        </Text>
        <View pointerEvents="none" style={{ position: 'absolute', right: 6, top: -18 }}>
          <Object3D name="chat-bubble" size={76} />
        </View>
      </PopCard>
    </>
  );
}

/** The next big thing: a photo over an ink panel (Figma "featured event"). */
function FeaturedEvent({
  event,
  registered,
  onOpen,
}: {
  event: EventListItem;
  registered: boolean;
  onOpen: (id: string) => void;
}) {
  const tokens = useTokens();
  const where = whereLabel(event);
  const going = event.registration_count;
  const action = registered ? 'You’re in' : isClosed(event) ? 'Details' : 'Register';

  return (
    <Press
      onPress={() => onOpen(event.id)}
      scaleTo={0.985}
      accessibilityLabel={`${event.title}. ${[where, priceLabel(event), action].filter(Boolean).join('. ')}`}
      className="w-full overflow-hidden rounded-3xl"
    >
      <EventPhoto event={event} style={{ width: '100%', height: 196 }} />

      <View style={{ position: 'absolute', left: 16, top: 16 }}>
        <DateBadge date={startOf(event)} />
      </View>
      <View
        className="h-9 justify-center rounded-full bg-pop-amber px-[14px]"
        style={{ position: 'absolute', right: 16, top: 16 }}
      >
        <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">{priceLabel(event)}</Text>
      </View>

      <View className="w-full gap-3 bg-ink p-4">
        <Text
          numberOfLines={2}
          className="font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-on-ink"
        >
          {event.title}
        </Text>
        {!!where && (
          <View className="flex-row items-center gap-1.5">
            <Icon name="mapPin" size={16} color={tokens.onInk} />
            <Text numberOfLines={1} className="flex-1 font-ui text-[14px] leading-5 text-on-ink">
              {where}
            </Text>
          </View>
        )}
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 font-ui-sb text-[14px] leading-5 text-on-ink">
            {going > 0 ? `${going} going` : 'Be the first to register'}
          </Text>
          <View className="h-11 flex-row items-center gap-1 rounded-full bg-pop-green px-5">
            {registered && <Icon name="check" size={16} color="#1C1916" />}
            <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">{action}</Text>
          </View>
        </View>
      </View>
    </Press>
  );
}

// ─── Notices ───────────────────────────────────────────────────────────────

const NOTICE_LOOKS: { colour: PopColour; object: ObjectName }[] = [
  { colour: 'sky', object: 'bell' },
  { colour: 'amber', object: 'target' },
  { colour: 'lime', object: 'thumb-up' },
];

/**
 * What leaders have announced. These are the announcement notifications the
 * teen has been sent, shown here as a noticeboard rather than an inbox.
 */
function Notices() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const inbox = useNotifications(!isGuest);

  const notices = useMemo(
    () => (inbox.data ?? []).filter((n) => n.notification_type === 'announcement'),
    [inbox.data],
  );

  if (isGuest) {
    return (
      <EmptyState
        drawing="reading"
        message="Notices come from your own church’s leaders. Sign up and pick your parish to see them."
        actionLabel="Sign up"
        onAction={() => router.push('/sign-up')}
      />
    );
  }

  if (inbox.isPending) {
    return (
      <>
        <Skeleton height={144} />
        <Skeleton height={144} />
      </>
    );
  }

  if (inbox.isError && !inbox.data) {
    return (
      <EmptyState
        drawing="sitting"
        message="We couldn’t load notices. Check your connection, then try again."
        actionLabel="Try again"
        onAction={() => inbox.refetch()}
      />
    );
  }

  if (notices.length === 0) {
    return (
      <EmptyState
        drawing="plant"
        message="No notices yet. When a leader has something to tell your tribe, it will show here."
      />
    );
  }

  return (
    <>
      {notices.map((notice, i) => {
        const look = NOTICE_LOOKS[i % NOTICE_LOOKS.length];
        return (
          // Extra room above each card for the object that breaks out of it.
          <PopCard key={notice.id} colour={look.colour} className="mt-2 w-full gap-2">
            <Text className="pr-16 font-ui-md text-[12px] leading-4 text-pop-on">
              {dayAgo(notice.created_at)}
            </Text>
            <Text className="pr-12 font-ui-b text-[17px] leading-6 text-pop-on">{notice.title}</Text>
            {!!notice.body && (
              <Text className="font-ui text-[14px] leading-5 text-pop-on">{notice.body}</Text>
            )}
            <View pointerEvents="none" style={{ position: 'absolute', right: 8, top: -16 }}>
              <Object3D name={look.object} size={60} />
            </View>
          </PopCard>
        );
      })}
    </>
  );
}

// ─── My Church ─────────────────────────────────────────────────────────────

/**
 * Where the teen belongs in the church tree: the parish they picked at
 * sign-up and the levels above it.
 */
function MyChurch() {
  const router = useRouter();
  const { isGuest, user } = useAuth();
  const profile = useProfile(!isGuest);

  if (isGuest) {
    return (
      <EmptyState
        drawing="strolling"
        message="Sign up and pick your parish, and your church shows here."
        actionLabel="Sign up"
        onAction={() => router.push('/sign-up')}
      />
    );
  }

  if (profile.isPending) return <Skeleton height={216} radius={28} />;

  const parish = profile.data?.parish || user?.parish || '';
  const zone = profile.data?.zone || user?.zone || '';
  const provinceValue = profile.data?.province || user?.province || '';
  const province =
    PROVINCES.find((p) => p.value === provinceValue)?.label ?? user?.province_display ?? '';
  // Every parish this app serves is in the one region.
  const above = [zone, province, 'Region 63'].filter(Boolean).join(' · ');

  return (
    <>
      <View className="mt-3 w-full gap-2 rounded-3xl bg-pop-lime p-5">
        <Image
          source={RCCG_LOGO}
          contentFit="contain"
          accessibilityLabel="The Redeemed Christian Church of God"
          style={{ width: 60, height: 60 }}
        />
        <Text
          accessibilityRole="header"
          className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-pop-on"
        >
          {parish || 'Your church'}
        </Text>
        <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">
          {parish ? above : 'You have not picked a parish yet.'}
        </Text>
        <View pointerEvents="none" style={{ position: 'absolute', right: 4, top: -20 }}>
          <Object3D name="map-pin" size={92} />
        </View>
      </View>

      <Button
        label={parish ? 'Change my church' : 'Pick my parish'}
        variant="secondary"
        onPress={() => router.push('/settings/account')}
        className="w-full"
      />
    </>
  );
}
