import { memo, useCallback } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMarkNotificationsRead, useNotifications } from '../src/api/queries';
import type { AppNotification } from '../src/api/types';
import { whenAgo } from '../src/data/time';
import { useAuth } from '../src/state/auth';
import { Object3D, type ObjectName } from '../src/ui/art';
import { Button } from '../src/ui/Button';
import { POP_BG } from '../src/ui/cards';
import { Press } from '../src/ui/Press';
import { BackHeader, EmptyState, Skeleton } from '../src/ui/screen';
import { ELEVATION, type PopColour } from '../src/theme/tokens';

/**
 * Notifications (Figma "Notifications").
 *
 * Reminders know when the day is done and stop (07-feature-specifications.md
 * #10), so for a teen who reads most days this list stays short on its own.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();

  const query = useNotifications(!isGuest);
  const markRead = useMarkNotificationsRead();

  const notes = query.data ?? [];
  const unread = notes.filter((n) => !n.is_read).length;

  const onOpen = useCallback(
    (note: AppNotification) => {
      if (!note.is_read) markRead.mutate([note.id]);
      const target = routeFor(note.deep_link);
      if (target) router.push(target);
    },
    [markRead, router],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <Row note={item} onOpen={onOpen} />,
    [onOpen],
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Notifications" onBack={back} />

      {isGuest ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="reading"
            message="Sign up to get a gentle reminder each day, and news about events."
            actionLabel="Sign up"
            onAction={() => router.push('/sign-up')}
          />
        </View>
      ) : query.isPending ? (
        <View className="gap-3 px-5 pt-2">
          <Skeleton height={92} />
          <Skeleton height={92} />
          <Skeleton height={92} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={keyOfNote}
          renderItem={renderItem}
          ListHeaderComponent={
            unread > 0 ? (
              <Button
                label="Mark all as read"
                variant="tertiary"
                onPress={() => markRead.mutate(undefined)}
                className="h-11 self-end"
              />
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center">
              <EmptyState
                drawing={query.isError ? 'sitting' : 'plant'}
                message={
                  query.isError
                    ? 'We couldn’t load your notifications. Check your connection, then try again.'
                    : 'Nothing new. Reminders and news from your church will show here.'
                }
                actionLabel={query.isError ? 'Try again' : undefined}
                onAction={() => query.refetch()}
              />
            </View>
          }
          contentContainerStyle={{
            flexGrow: 1,
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />}
        />
      )}
    </View>
  );
}

const keyOfNote = (n: AppNotification) => n.id;

/** The colour and object for each kind of notification the server sends. */
const LOOKS: Record<string, { colour: PopColour; object: ObjectName }> = {
  habit_reminder: { colour: 'amber', object: 'bell' },
  event: { colour: 'sky', object: 'calendar' },
  transactional: { colour: 'sky', object: 'calendar' },
  announcement: { colour: 'lime', object: 'chat-bubble' },
  system: { colour: 'violet', object: 'lock' },
};
const DEFAULT_LOOK = { colour: 'pink', object: 'fire' } as const;

/**
 * One notification. Unread is shown three ways — an outline, a dot and the
 * word "New" — so it never rests on colour alone. Memoised so marking one read
 * re-renders that card and not the list.
 */
const Row = memo(function Row({
  note,
  onOpen,
}: {
  note: AppNotification;
  onOpen: (note: AppNotification) => void;
}) {
  const look = LOOKS[note.notification_type] ?? DEFAULT_LOOK;
  const unread = !note.is_read;
  const when = whenAgo(note.created_at);

  return (
    <Press
      onPress={() => onOpen(note)}
      scaleTo={0.985}
      accessibilityLabel={`${unread ? 'New. ' : ''}${note.title}. ${note.body} ${when}`}
      className={`w-full flex-row items-center gap-3 rounded-2xl border-[1.5px] bg-surf-raised py-3 pl-3 pr-4 ${
        unread ? 'border-ink' : 'border-transparent'
      }`}
      style={ELEVATION.card}
    >
      <View className={`h-14 w-14 items-center justify-center rounded-full ${POP_BG[look.colour]}`}>
        <Object3D name={look.object} size={44} />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{note.title}</Text>
        {!!note.body && (
          <Text numberOfLines={3} className="font-ui text-[14px] leading-5 text-ink-2">
            {note.body}
          </Text>
        )}
        <Text className="font-ui-md text-[12px] leading-4 text-ink-3">
          {unread ? `New · ${when}` : when}
        </Text>
      </View>
      {unread && <View className="h-2.5 w-2.5 rounded-full bg-pop-green" />}
    </Press>
  );
});

/**
 * Where a notification leads.
 *
 * The server writes its links as web paths (`/events/<id>`), which are shared
 * with the website. The app's routes are named differently, so they are
 * translated here; anything unrecognised opens nothing rather than a dead page.
 */
function routeFor(link: string | null): Href | null {
  if (!link) return null;

  const ticket = /^\/events\/[^/]+\/ticket\/([^/]+)\/?$/.exec(link);
  if (ticket) return { pathname: '/ticket/[id]', params: { id: ticket[1] } };

  const event = /^\/events\/([^/]+)\/?$/.exec(link);
  if (event) return { pathname: '/event/[id]', params: { id: event[1] } };

  if (link.startsWith('/settings')) return '/settings';
  if (link.startsWith('/bible')) return '/bible';
  if (link.startsWith('/library')) return '/library';
  if (link.startsWith('/devotional')) return '/devotional';
  if (link === '/' || link.startsWith('/today')) return '/';
  return null;
}
