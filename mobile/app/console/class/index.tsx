import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useClassRoster } from '../../../src/api/queries';
import type { ClassMember } from '../../../src/api/types';
import { TeenRow } from '../../../src/components/ClassPieces';
import { useTeacherTools } from '../../../src/state/teacher';
import { ChipRow, SearchField } from '../../../src/ui/inputs';
import { EmptyState, IconButton, Skeleton, TabHeader } from '../../../src/ui/screen';
import { ELEVATION } from '../../../src/theme/tokens';

type Filter = 'all' | 'read' | 'not_yet';

/**
 * My class (Figma "My class").
 *
 * `docs/CONSOLE-FIGMA-PROMPT.md` C12: "the Teacher's only data screen". A list
 * of the teens in the room and how their week of reading is going, in the
 * order of their names. It is never sorted by who has read most: a class list
 * ranked that way is a leaderboard, and 12-gamification.md rules those out.
 */
export default function ClassScreen() {
  const router = useRouter();
  const tools = useTeacherTools();
  const roster = useClassRoster(tools.roster);

  const [filter, setFilter] = useState<Filter>('all');
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState('');

  const members = roster.data?.members ?? [];
  const total = roster.data?.total ?? 0;

  const shown = useMemo(() => {
    const query = text.trim().toLowerCase();
    return members.filter(
      (member) =>
        (filter === 'all' || (filter === 'read') === member.read_today) &&
        (!query || member.name.toLowerCase().includes(query)),
    );
  }, [members, filter, text]);

  const filters = useMemo(
    () =>
      [
        { value: 'all', label: `All ${total}` },
        { value: 'read', label: 'Read today' },
        { value: 'not_yet', label: 'Not yet' },
      ] as const,
    [total],
  );

  const openTeen = useCallback(
    (member: ClassMember) =>
      router.push({ pathname: '/console/class/[id]', params: { id: member.id } }),
    [router],
  );

  const toggleSearch = () => {
    if (searching) setText('');
    setSearching((on) => !on);
  };

  if (!tools.roster) {
    return (
      <View className="flex-1 bg-surf-base">
        <TabHeader title="My class" />
        <View className="flex-1 justify-center">
          <EmptyState drawing="sitting" message="A class list is for teachers and leaders." />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="My class">
        <IconButton
          icon={searching ? 'close' : 'search'}
          label={searching ? 'Close search' : 'Search your class'}
          onPress={toggleSearch}
        />
      </TabHeader>

      {roster.isPending ? (
        <View className="gap-3 px-5 pt-2">
          <Skeleton width="70%" height={40} radius={999} />
          <Skeleton height={392} />
        </View>
      ) : !roster.data ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load your class. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => roster.refetch()}
          />
        </View>
      ) : total === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="plant"
            message="Nobody in your class yet. Teens show here once they join your parish in the app."
          />
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={roster.isRefetching} onRefresh={roster.refetch} />
          }
        >
          {searching && (
            <SearchField label="Search by name" value={text} onChange={setText} autoFocus />
          )}
          <ChipRow wrap options={filters} value={filter} onChange={setFilter} />

          {shown.length > 0 ? (
            // One raised card holding every row, as drawn. A class is a room of
            // people (the server stops at 300), so the rows are simply rendered.
            <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
              {shown.map((member) => (
                <TeenRow key={member.id} member={member} onPress={openTeen} />
              ))}
            </View>
          ) : (
            <Text className="py-6 text-center font-ui text-[16px] leading-6 text-ink-2">
              {text.trim()
                ? `Nobody in your class is called “${text.trim()}”.`
                : filter === 'read'
                  ? 'Nobody has read yet today.'
                  : 'Everybody has read today.'}
            </Text>
          )}

          <Text className="text-center font-ui-md text-[12px] leading-4 text-ink-3">
            Dots show this week, Monday to Sunday. Only you and your leaders can see this.
            {total > members.length ? ` Showing the first ${members.length} of ${total}.` : ''}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
