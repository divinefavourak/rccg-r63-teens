import { useCallback } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCheckInToday,
  useClassRoster,
  useCurrentLesson,
  useDraftDevotionals,
  useProfile,
} from '../../src/api/queries';
import type { CheckInEvent, ClassMember } from '../../src/api/types';
import { TeenRow } from '../../src/components/ClassPieces';
import { Icon } from '../../src/components/Icon';
import { timeLabel } from '../../src/data/events';
import { useAuth } from '../../src/state/auth';
import { useMyPhoto } from '../../src/state/photo';
import { useTeacherTools } from '../../src/state/teacher';
import { Object3D } from '../../src/ui/art';
import { Avatar, colourFor } from '../../src/ui/cards';
import { Press } from '../../src/ui/Press';
import { HEADER_GAP, SectionTitle, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION, POP } from '../../src/theme/tokens';

/**
 * Teacher home (Figma "Teacher home").
 *
 * `docs/CONSOLE-FIGMA-PROMPT.md`: "Three cards stacked: Today's check-in (or
 * 'No event today'), This week's manual, My class. This is the whole screen."
 * Each card is drawn only for someone who can use what is behind it, so a
 * content editor with no class sees a shorter screen, not a locked one.
 */
export default function TeacherHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const { user } = useAuth();
  const tools = useTeacherTools();
  const photo = useMyPhoto();

  const profile = useProfile();
  const lesson = useCurrentLesson(tools.lesson);
  const events = useCheckInToday(tools.checkIn);
  const roster = useClassRoster(tools.roster);
  const drafts = useDraftDevotionals(tools.review);

  const refetch = useCallback(() => {
    if (tools.lesson) lesson.refetch();
    if (tools.checkIn) events.refetch();
    if (tools.roster) roster.refetch();
    if (tools.review) drafts.refetch();
  }, [tools, lesson, events, roster, drafts]);

  const openTeen = useCallback(
    (member: ClassMember) =>
      router.push({ pathname: '/console/class/[id]', params: { id: member.id } }),
    [router],
  );

  const firstName = user?.first_name || profile.data?.full_name?.split(' ')[0] || 'there';
  const parish = profile.data?.parish || user?.parish || '';
  const name = profile.data?.full_name || firstName;

  const members = roster.data?.members ?? [];
  const waiting = drafts.data?.length ?? 0;

  return (
    <View className="flex-1 bg-surf-base">
      <View
        className="flex-row items-center gap-3 px-5 pb-2"
        style={{ paddingTop: insets.top + HEADER_GAP }}
      >
        <Avatar name={name} photo={photo} size={48} />
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
          >
            Hello, {firstName}
          </Text>
          {!!parish && (
            <Text numberOfLines={2} className="font-ui text-[14px] leading-5 text-ink-2">
              {parish}
            </Text>
          )}
        </View>
        {/* Back to the teen app. Replaces rather than pops, so it works however
            this screen was reached. */}
        <Press
          onPress={() => router.replace('/me')}
          accessibilityLabel="Exit teacher tools"
          className="h-10 flex-row items-center gap-1 rounded-full bg-surf-sunken pl-2.5 pr-3.5"
        >
          <Icon name="close" size={16} color={tokens.text1} />
          <Text className="font-ui-sb text-[14px] leading-5 text-ink-1">Exit</Text>
        </Press>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 20,
          // Room for the notebook that breaks out of the lesson card.
          paddingTop: tools.lesson ? 28 : 8,
          paddingBottom: 24,
        }}
        refreshControl={
          <RefreshControl
            refreshing={lesson.isRefetching || roster.isRefetching || events.isRefetching}
            onRefresh={refetch}
          />
        }
      >
        {/* ── This week's lesson ─────────────────────────────────────── */}
        {tools.lesson &&
          (lesson.isPending ? (
            <Skeleton height={196} radius={28} />
          ) : lesson.data ? (
            <View className="w-full gap-2 rounded-[28px] bg-pop-violet p-5">
              <Text className="pr-16 font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
                This week’s lesson · Week {lesson.data.week_number}
              </Text>
              <Text
                numberOfLines={3}
                accessibilityRole="header"
                className={`font-ui-xb text-pop-on ${
                  lesson.data.title.length > 22
                    ? 'text-[24px] leading-8 tracking-[-0.36px]'
                    : lesson.data.title.length > 11
                      ? 'pr-12 text-[32px] leading-10 tracking-[-0.64px]'
                      : 'pr-16 text-[40px] leading-[48px] tracking-[-1.2px]'
                }`}
              >
                {lesson.data.title}
              </Text>
              {!!lesson.data.memory_verse && (
                <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">
                  {lesson.data.memory_verse}
                </Text>
              )}
              {/* Always dark with light text: it sits on violet in both themes. */}
              <Press
                onPress={() => router.replace('/console/lesson')}
                accessibilityLabel={`Teach this lesson: ${lesson.data.title}`}
                className="h-12 flex-row items-center gap-2 self-start rounded-full bg-pop-on pl-5 pr-2"
              >
                <Text className="font-ui-sb text-[16px] leading-6" style={{ color: '#FDFAF5' }}>
                  Teach this lesson
                </Text>
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: '#FDFAF5' }}
                >
                  <Icon name="chevronRight" size={16} color={POP.on} />
                </View>
              </Press>
              <View pointerEvents="none" style={{ position: 'absolute', right: -8, top: -24 }}>
                <Object3D name="notebook" size={96} />
              </View>
            </View>
          ) : (
            <Notice
              icon="book"
              title={lesson.isError ? 'We couldn’t load the lesson' : 'No lesson this week yet'}
              detail={
                lesson.isError
                  ? 'Check your connection, then pull down to try again.'
                  : 'It will show here as soon as this week’s manual is published.'
              }
            />
          ))}

        {/* ── Today's event ──────────────────────────────────────────── */}
        {tools.checkIn &&
          (events.isPending ? (
            <Skeleton height={98} />
          ) : events.data?.length ? (
            events.data.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onCheckIn={() =>
                  router.push({ pathname: '/console/check-in', params: { event: event.id } })
                }
              />
            ))
          ) : (
            <Notice
              icon="calendar"
              title={events.isError ? 'We couldn’t check for events' : 'No event today'}
              detail={
                events.isError
                  ? 'Check your connection, then pull down to try again.'
                  : 'Check-in opens here on the day of an event.'
              }
            />
          ))}

        {/* ── My class ───────────────────────────────────────────────── */}
        {tools.roster && (
          <>
            <SectionTitle
              actionLabel={roster.data?.total ? `See all ${roster.data.total}` : undefined}
              onAction={() => router.replace('/console/class')}
            >
              My class
            </SectionTitle>

            {roster.isPending ? (
              <>
                <Skeleton height={60} />
                <Skeleton height={200} />
              </>
            ) : !roster.data ? (
              <Notice
                icon="people"
                title="We couldn’t load your class"
                detail="Check your connection, then pull down to try again."
              />
            ) : members.length === 0 ? (
              <Notice
                icon="people"
                title="Nobody in your class yet"
                detail="Teens show here once they join your parish in the app."
              />
            ) : (
              <>
                <View className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-amber py-3 pl-3 pr-4">
                  <View className="flex-row">
                    {members.slice(0, 3).map((member, i) => (
                      <View
                        key={member.id}
                        className="rounded-full border-[3px] border-pop-amber"
                        style={{ marginLeft: i === 0 ? 0 : -10 }}
                      >
                        <Avatar
                          name={member.name}
                          photo={member.photo}
                          size={30}
                          // Never amber here: it would vanish into the card.
                          colour={STACK_COLOURS[i]}
                        />
                      </View>
                    ))}
                  </View>
                  <Text className="flex-1 font-ui-sb text-[16px] leading-6 text-pop-on">
                    {roster.data.read_today} of {roster.data.total} have read today
                  </Text>
                </View>

                <View
                  className="w-full rounded-2xl bg-surf-raised px-4 py-1"
                  style={ELEVATION.card}
                >
                  {members.slice(0, 3).map((member) => (
                    <TeenRow key={member.id} member={member} onPress={openTeen} />
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── Review queue ───────────────────────────────────────────── */}
        {tools.review && (
          <Press
            onPress={() => router.push('/console/review')}
            scaleTo={0.985}
            accessibilityLabel={`Review queue, ${waiting} waiting`}
            className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-raised p-4"
            style={ELEVATION.card}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-pop-sky">
              <Icon name="text" size={20} color={POP.on} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">Review queue</Text>
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                {drafts.isPending
                  ? 'Checking for drafts'
                  : waiting === 0
                    ? 'Nothing is waiting on you'
                    : `${waiting} ${waiting === 1 ? 'devotional' : 'devotionals'} to publish`}
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={tokens.text1} />
          </Press>
        )}
      </ScrollView>
    </View>
  );
}

/** The three small faces on the amber card, as drawn. */
const STACK_COLOURS = ['lime', 'sky', 'violet'] as const;

/** An event that is on today, with the way in to check-in (Figma "today's event"). */
function EventCard({ event, onCheckIn }: { event: CheckInEvent; onCheckIn: () => void }) {
  const start = new Date(event.start_datetime);
  // An event that began on an earlier day (a camp) is simply "today".
  const startedToday = start.toDateString() === new Date().toDateString();

  return (
    <View className="w-full flex-row items-center gap-3 rounded-2xl bg-pop-lime py-4 pl-4 pr-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
          {startedToday ? `Today · ${timeLabel(start)}` : 'Today'}
        </Text>
        <Text numberOfLines={2} className="font-ui-sb text-[16px] leading-6 text-pop-on">
          {event.title}
        </Text>
        <Text className="font-ui-md text-[12px] leading-4 text-pop-on">
          {event.checked_in > 0
            ? `${event.checked_in} of ${event.registered} checked in`
            : `${event.registered} registered`}
        </Text>
      </View>
      {/* Always dark with light text: it sits on lime in both themes. */}
      <Press
        onPress={onCheckIn}
        accessibilityLabel={`Check in for ${event.title}`}
        className="h-11 flex-row items-center gap-1.5 rounded-full bg-pop-on pl-3 pr-4"
      >
        <Icon name="scan" size={18} color="#FDFAF5" />
        <Text className="font-ui-sb text-[14px] leading-5" style={{ color: '#FDFAF5' }}>
          Check in
        </Text>
      </Press>
    </View>
  );
}

/** A quiet card for "nothing here today" (Figma "no event today"). */
function Notice({
  icon,
  title,
  detail,
}: {
  icon: 'book' | 'calendar' | 'people';
  title: string;
  detail: string;
}) {
  const tokens = useTokens();
  return (
    <View className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-sunken p-4">
      <Icon name={icon} size={22} color={tokens.text1} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{title}</Text>
        <Text className="font-ui text-[14px] leading-5 text-ink-2">{detail}</Text>
      </View>
    </View>
  );
}
