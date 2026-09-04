import { memo, useCallback, useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { Grabber } from '../src/components/ui';
import { EmptyState, ErrorState, ListSkeleton } from '../src/components/states';
import { useTokens } from '../src/theme/ThemeProvider';
import { useAuth } from '../src/state/auth';
import { useMarkNotificationsRead, useNotifications } from '../src/api/queries';
import type { AppNotification } from '../src/api/types';

/**
 * The notifications inbox, as a bottom sheet over Today.
 *
 * 05-navigation.md groups the inbox by day and caps the bell's badge at "9+".
 * Reminders are completion-aware upstream — they stop once today's devotional
 * is done — so for a consistent teen this list stays short by design.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { isGuest } = useAuth();

  const query = useNotifications(!isGuest);
  const markRead = useMarkNotificationsRead();

  const notes = query.data ?? [];
  const unread = notes.filter((n) => !n.is_read).length;

  /**
   * Grouped by day, from `created_at`.
   *
   * The backend returns a flat list ordered newest-first; the "Today / This
   * week / Earlier" split is presentation, so it belongs here rather than in a
   * query parameter.
   */
  const sections = useMemo(() => {
    const now = Date.now();
    const buckets: Record<string, AppNotification[]> = { Today: [], 'This week': [], Earlier: [] };

    for (const note of notes) {
      const age = now - new Date(note.created_at).getTime();
      const days = age / 86_400_000;
      if (days < 1) buckets.Today.push(note);
      else if (days < 7) buckets['This week'].push(note);
      else buckets.Earlier.push(note);
    }

    return Object.entries(buckets)
      .filter(([, data]) => data.length > 0)
      .map(([title, data]) => ({ title, data }));
  }, [notes]);

  const onRead = useCallback(
    (note: AppNotification) => {
      if (!note.is_read) markRead.mutate([note.id]);
      // Every item deep-links to its subject (05-navigation.md).
      if (note.deep_link) router.push(note.deep_link as never);
    },
    [markRead, router],
  );

  const markAll = useCallback(() => markRead.mutate(undefined), [markRead]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <Row note={item} onRead={onRead} />,
    [onRead],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <Text className="bg-surf-raised px-5 pb-1.5 pt-3.5 font-ui-b text-[11px] uppercase tracking-[1px] text-ink-3">
        {section.title}
      </Text>
    ),
    [],
  );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1, backgroundColor: tokens.surfOverlay }}>
      {/* Tapping the scrim dismisses; the sheet swallows its own taps. */}
      <Pressable onPress={router.back} accessibilityLabel="Close notifications" style={{ flex: 1 }} />

      <Animated.View
        entering={SlideInDown.duration(300)}
        className="rounded-t-2xl bg-surf-raised"
        style={{ maxHeight: '85%', paddingBottom: insets.bottom }}
      >
        <Grabber />

        <View className="flex-row items-center justify-between border-b border-line px-5 pb-3 pt-1">
          <View className="flex-row items-center gap-2.5">
            <Text className="font-ui-b text-[18px] text-ink-1">Notifications</Text>
            {unread > 0 && (
              <View className="h-[22px] min-w-[22px] items-center justify-center rounded-full bg-green px-1.5">
                {/* Capped at 9+ (05-navigation.md) — the count informs, it does
                    not nag. */}
                <Text className="font-ui-b text-[11px] text-white">
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            {unread > 0 && (
              <Pressable onPress={markAll} accessibilityRole="button" hitSlop={8}>
                <Text className="font-ui-sb text-[13px] text-green">Mark all read</Text>
              </Pressable>
            )}
            <Pressable
              onPress={router.back}
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              className="h-8 w-8 items-center justify-center rounded-sm bg-surf-sunken"
            >
              <Icon name="close" size={16} color={tokens.text2} />
            </Pressable>
          </View>
        </View>

        {isGuest ? (
          <EmptyState
            title="Nothing here yet"
            body="Sign in to get reminders, event updates and news from your tribe."
          />
        ) : query.isPending ? (
          <View className="py-4">
            <ListSkeleton rows={4} height={64} />
          </View>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={query.refetch} compact />
        ) : sections.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            body="Check back later for updates from your tribe."
          />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={keyOfNote}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

const keyOfNote = (n: AppNotification) => n.id;

/** Emoji per notification type — the backend sends a type, not an icon. */
const TYPE_EMOJI: Record<string, { emoji: string; bg: string }> = {
  devotional: { emoji: '🌱', bg: '#E8F3EC' },
  streak: { emoji: '🔥', bg: '#FDF5E4' },
  event: { emoji: '📅', bg: '#EEF0FD' },
  registration: { emoji: '✦', bg: '#E8F3EC' },
  content: { emoji: '📖', bg: '#F2EAE0' },
  milestone: { emoji: '🎉', bg: '#FDF5E4' },
};

const DEFAULT_EMOJI = { emoji: '🌱', bg: '#E8F3EC' };

/**
 * One notification. Memoised so marking a single item read re-renders that row
 * alone rather than the whole inbox.
 */
const Row = memo(function Row({
  note,
  onRead,
}: {
  note: AppNotification;
  onRead: (note: AppNotification) => void;
}) {
  const handle = useCallback(() => onRead(note), [note, onRead]);
  const look = TYPE_EMOJI[note.notification_type] ?? DEFAULT_EMOJI;
  const unread = !note.is_read;

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${note.title}. ${note.body} ${relativeTime(note.created_at)}`}
      className="flex-row items-start gap-3 border-b border-line px-5 py-3.5"
    >
      {unread && <View className="absolute bottom-3 left-0 top-3 w-1 rounded-r bg-green" />}

      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-md"
        style={{ backgroundColor: look.bg }}
      >
        <Text className="text-[18px]">{look.emoji}</Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text
          className={`mb-1 text-[14px] leading-[21px] ${
            unread ? 'font-ui-md text-ink-1' : 'font-ui text-ink-2'
          }`}
        >
          {note.title}
        </Text>
        {!!note.body && (
          <Text numberOfLines={2} className="mb-1 font-ui text-[13px] leading-[19px] text-ink-3">
            {note.body}
          </Text>
        )}
        <Text className="font-ui-md text-[11px] text-ink-3">{relativeTime(note.created_at)}</Text>
      </View>

      {unread && <View className="mt-1.5 h-2 w-2 rounded-full bg-green" />}
    </Pressable>
  );
});

/** "2m ago" / "3d ago" — short, so the row stays one glance. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
