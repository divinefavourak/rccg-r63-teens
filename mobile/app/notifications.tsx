import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { LeafGlyph } from '../src/components/BrandMarks';
import { Grabber } from '../src/components/ui';
import { useTokens } from '../src/theme/ThemeProvider';
import {
  NOTIFICATIONS,
  NOTIFICATION_GROUP_LABELS,
  type AppNotification,
  type NotificationGroup,
} from '../src/data/content';

const GROUP_ORDER: NotificationGroup[] = ['today', 'week', 'earlier'];

/**
 * The notifications inbox, as a bottom sheet over Today.
 *
 * 05-navigation.md groups the inbox by day and caps the bell's badge at "9+".
 * Reminders are completion-aware upstream, so for a consistent user this list
 * stays short by design — the calm is a product decision, not a UI trick.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  const [notes, setNotes] = useState(NOTIFICATIONS);

  const unread = useMemo(() => notes.filter((n) => n.unread).length, [notes]);

  const sections = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        key: group,
        title: NOTIFICATION_GROUP_LABELS[group],
        data: notes.filter((n) => n.group === group),
      })).filter((s) => s.data.length > 0),
    [notes],
  );

  const markRead = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotes((prev) => (prev.some((n) => n.unread) ? prev.map((n) => ({ ...n, unread: false })) : prev));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <Row note={item} onRead={markRead} />,
    [markRead],
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
      {/* Tapping the scrim dismisses; the sheet itself swallows its own taps. */}
      <Pressable
        onPress={router.back}
        accessibilityLabel="Close notifications"
        style={{ flex: 1 }}
      />

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
                <Text className="font-ui-b text-[11px] text-white">
                  {/* Capped at 9+ (05-navigation.md) — the count informs, it
                      does not nag. */}
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </View>

          <View className="flex-row items-center gap-2">
            {unread > 0 && (
              <Pressable onPress={markAllRead} accessibilityRole="button" hitSlop={8}>
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

        {sections.length === 0 ? (
          <EmptyState />
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

/**
 * One notification. Memoised so marking a single item read re-renders that row
 * alone rather than the whole inbox.
 */
const Row = memo(function Row({
  note,
  onRead,
}: {
  note: AppNotification;
  onRead: (id: string) => void;
}) {
  const handle = useCallback(() => onRead(note.id), [note.id, onRead]);

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={`${note.unread ? 'Unread. ' : ''}${note.title} ${note.time}`}
      className="flex-row items-start gap-3 border-b border-line px-5 py-3.5"
    >
      {note.unread && (
        <View className="absolute bottom-3 left-0 top-3 w-1 rounded-r bg-green" />
      )}

      <View
        className="h-[38px] w-[38px] items-center justify-center rounded-md"
        style={{ backgroundColor: note.iconBg }}
      >
        <Text className="text-[18px]">{note.emoji}</Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text
          className={`mb-1 text-[14px] leading-[21px] ${
            note.unread ? 'font-ui-md text-ink-1' : 'font-ui text-ink-2'
          }`}
        >
          {note.title}
        </Text>
        <Text className="font-ui-md text-[11px] text-ink-3">{note.time}</Text>
      </View>

      {note.unread && <View className="mt-1.5 h-2 w-2 rounded-full bg-green" />}
    </Pressable>
  );
});

function EmptyState() {
  const tokens = useTokens();
  return (
    <View className="items-center gap-3.5 px-8 py-12">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-green/10">
        <LeafGlyph size={32} color={tokens.green} />
      </View>
      <Text className="font-ui-b text-[16px] text-ink-1">You're all caught up</Text>
      <Text className="text-center font-ui text-[13px] leading-5 text-ink-3">
        Check back later for updates from your tribe.
      </Text>
    </View>
  );
}
