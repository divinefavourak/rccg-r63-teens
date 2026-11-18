import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View, type ListRenderItem } from 'react-native';
import { useRouter } from 'expo-router';

import { personName, usePeople, usePeopleRoles } from '../../../src/api/people';
import type { PersonMembership, PersonRole } from '../../../src/api/types';
import { Icon } from '../../../src/components/Icon';
import { useTeacherTools } from '../../../src/state/teacher';
import { Avatar, colourFor } from '../../../src/ui/cards';
import { SearchField } from '../../../src/ui/inputs';
import { Press } from '../../../src/ui/Press';
import { EmptyState, Skeleton, TabHeader } from '../../../src/ui/screen';
import { useTokens } from '../../../src/theme/ThemeProvider';

/**
 * People: everyone whose home is in this leader's part of the church, teens and
 * leaders alike, with the roles each holds. The web Console's People screen
 * on a phone (docs/CONSOLE-FIGMA-PROMPT.md, People).
 *
 * Searched and paged by the server, which also decides who is in scope; a
 * coordinator for one province never receives anyone from another. In order
 * of name, never of anything that would make it a ranking.
 */
export default function PeopleScreen() {
  const router = useRouter();
  const tools = useTeacherTools();

  const [text, setText] = useState('');
  const search = useDebounced(text.trim(), 350);
  const people = usePeople(search, tools.people);

  const rows = useMemo(
    () => people.data?.pages.flatMap((page) => page.results) ?? [],
    [people.data],
  );
  const total = people.data?.pages[0]?.count ?? 0;

  // Roles for the people loaded so far, one request for the lot.
  const roles = usePeopleRoles(
    rows.map((m) => m.user),
    tools.seeRoles,
  );
  const rolesByUser = useMemo(() => {
    const map = new Map<string, PersonRole[]>();
    for (const grant of roles.data ?? []) {
      map.set(grant.user, [...(map.get(grant.user) ?? []), grant]);
    }
    return map;
  }, [roles.data]);

  const open = useCallback(
    (membership: PersonMembership) =>
      router.push({ pathname: '/console/people/[id]', params: { id: membership.id } }),
    [router],
  );

  const renderPerson = useCallback<ListRenderItem<PersonMembership>>(
    ({ item, index }) => (
      <View
        className={`bg-surf-raised px-4 ${index === 0 ? 'rounded-t-2xl pt-1' : ''} ${
          index === rows.length - 1 ? 'rounded-b-2xl pb-1' : ''
        }`}
      >
        <PersonRow membership={item} roles={rolesByUser.get(item.user)} onPress={open} />
      </View>
    ),
    [open, rolesByUser, rows.length],
  );

  if (!tools.people) {
    return (
      <View className="flex-1 bg-surf-base">
        <TabHeader title="People" />
        <View className="flex-1 justify-center">
          <EmptyState drawing="sitting" message="The people list is for coordinators and leaders." />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="People" />

      <View className="px-5 pb-3">
        <SearchField label="Search by name or email" value={text} onChange={setText} />
      </View>

      {people.isPending ? (
        <View className="gap-3 px-5">
          <Skeleton height={392} />
        </View>
      ) : people.isError && rows.length === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load the people list. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => people.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(m) => m.id}
          renderItem={renderPerson}
          initialNumToRender={12}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (people.hasNextPage && !people.isFetchingNextPage) people.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={people.isRefetching && !people.isFetchingNextPage}
              onRefresh={people.refetch}
            />
          }
          ListEmptyComponent={
            <Text className="py-6 text-center font-ui text-[16px] leading-6 text-ink-2">
              {search ? `Nobody called “${search}” in your part of the church.` : 'Nobody here yet.'}
            </Text>
          }
          ListFooterComponent={
            people.isFetchingNextPage ? (
              <ActivityIndicator style={{ paddingVertical: 16 }} />
            ) : rows.length > 0 ? (
              <Text className="pt-3 text-center font-ui-md text-[12px] leading-4 text-ink-3">
                {total === 1 ? '1 person' : `${total} people`}
                {search ? ` matching “${search}”` : ''}. Only you and your leaders can see this.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const PersonRow = memo(function PersonRow({
  membership,
  roles,
  onPress,
}: {
  membership: PersonMembership;
  roles: PersonRole[] | undefined;
  onPress: (membership: PersonMembership) => void;
}) {
  const tokens = useTokens();
  const name = personName(membership);
  const home = membership.organization_node_detail?.name;
  const roleLabels = (roles ?? []).map((r) => r.role_detail?.label).filter(Boolean) as string[];
  const switchedOff = membership.user_detail?.is_active === false;
  const line = [roleLabels.join(', '), home].filter(Boolean).join(' · ');

  return (
    <Press
      onPress={() => onPress(membership)}
      scaleTo={0.985}
      accessibilityLabel={`${name}. ${line}${switchedOff ? '. Account switched off' : ''}`}
      className="h-16 w-full flex-row items-center gap-3"
    >
      <Avatar name={name} size={44} colour={colourFor(name)} />
      <View className="min-w-0 flex-1 gap-0.5" style={{ opacity: switchedOff ? 0.55 : 1 }}>
        <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
          {name}
        </Text>
        <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-3">
          {switchedOff ? `Switched off · ${line}` : line || 'Member'}
        </Text>
      </View>
      <Icon name="chevronRight" size={20} color={tokens.text3} />
    </Press>
  );
});

/** The value, once it has stopped changing for `ms`: one search per pause, not per letter. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
