import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useBatches } from '../../../src/api/queries';
import type { BatchRow, BatchStatus } from '../../../src/api/types';
import { Icon } from '../../../src/components/Icon';
import { batchStatus, naira, StatusChip } from '../../../src/components/PaymentPieces';
import { dayLabel } from '../../../src/data/events';
import { useTeacherTools } from '../../../src/state/teacher';
import { Button } from '../../../src/ui/Button';
import { ChipRow } from '../../../src/ui/inputs';
import { Press } from '../../../src/ui/Press';
import { EmptyState, IconButton, Skeleton, TabHeader } from '../../../src/ui/screen';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { ELEVATION } from '../../../src/theme/tokens';

type Filter = '' | BatchStatus;

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'under_review', label: 'Being checked' },
  { value: 'part_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
] as const satisfies readonly { value: Filter; label: string }[];

/**
 * Groups: the teens a coordinator registered for an event as a headcount,
 * each with its payment. The same groups as Groups on the web Console.
 */
export default function GroupsScreen() {
  const router = useRouter();
  const tools = useTeacherTools();
  const [filter, setFilter] = useState<Filter>('');
  const groups = useBatches(filter, tools.groups);

  const create = () => router.push('/console/groups/new');

  if (!tools.groups) {
    return (
      <View className="flex-1 bg-surf-base">
        <TabHeader title="Groups" />
        <View className="flex-1 justify-center">
          <EmptyState drawing="sitting" message="Groups are for coordinators who run events." />
        </View>
      </View>
    );
  }

  const list = groups.data ?? [];

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="Groups">
        <IconButton icon="plus" label="New group" onPress={create} />
      </TabHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={groups.isRefetching} onRefresh={groups.refetch} />
        }
      >
        <ChipRow options={FILTERS} value={filter} onChange={setFilter} />

        {groups.isPending ? (
          <>
            <Skeleton height={104} />
            <Skeleton height={104} />
          </>
        ) : groups.isError && !groups.data ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="sitting"
              message="We couldn’t load your groups. Check your connection, then try again."
              actionLabel="Try again"
              onAction={() => groups.refetch()}
            />
          </View>
        ) : list.length === 0 ? (
          <View className="flex-1 justify-center">
            <EmptyState
              drawing="plant"
              message={
                filter
                  ? 'No groups here.'
                  : 'No groups yet. Register the teens from your area for an event, and hand each one a ticket.'
              }
              actionLabel={filter ? undefined : 'New group'}
              onAction={filter ? undefined : create}
            />
          </View>
        ) : (
          <>
            {list.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                onOpen={() =>
                  router.push({ pathname: '/console/groups/[id]', params: { id: group.id } })
                }
              />
            ))}
            <Button label="New group" variant="secondary" onPress={create} className="w-full" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function GroupRow({ group, onOpen }: { group: BatchRow; onOpen: () => void }) {
  const tokens = useTokens();
  const status = batchStatus(group.status);
  const free = Number(group.amount_due) === 0;
  return (
    <Press
      onPress={onOpen}
      scaleTo={0.985}
      accessibilityLabel={`${group.event_title}, ${group.headcount} seats, ${status.label}`}
      className="w-full gap-2 rounded-2xl bg-surf-raised p-4"
      style={ELEVATION.card}
    >
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={2} className="font-ui-sb text-[16px] leading-6 text-ink-1">
            {group.event_title}
          </Text>
          <Text numberOfLines={1} className="font-ui text-[14px] leading-5 text-ink-2">
            {[group.node_detail?.name, dayLabel(new Date(group.event_start))]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Icon name="chevronRight" size={20} color={tokens.text2} />
      </View>
      <Text className="font-ui-md text-[14px] leading-5 text-ink-1">
        {group.male_count} {group.male_count === 1 ? 'boy' : 'boys'} · {group.female_count}{' '}
        {group.female_count === 1 ? 'girl' : 'girls'}
        {free ? '' : ` · ${naira(group.amount_paid)} of ${naira(group.amount_due)} paid`}
      </Text>
      <View className="flex-row items-center gap-2">
        <StatusChip {...status} />
        <Text className="font-ui text-[12px] leading-4 text-ink-3">{group.reference}</Text>
      </View>
    </Press>
  );
}
