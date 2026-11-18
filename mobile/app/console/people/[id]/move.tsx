import { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { personName, useLeaderTree, useMovePerson, usePersonMembership } from '../../../../src/api/people';
import type { TreeNode } from '../../../../src/api/types';
import { useTeacherTools } from '../../../../src/state/teacher';
import { Button } from '../../../../src/ui/Button';
import { OptionRow, SearchField, TextField } from '../../../../src/ui/inputs';
import { BackHeader, EmptyState, KeyboardView, Skeleton } from '../../../../src/ui/screen';

/** treebeard's path segment width; must match `HierarchyNode.steplen`. */
const STEPLEN = 4;

const LEVEL: Record<string, string> = {
  national: 'National',
  region: 'Region',
  province: 'Province',
  zone: 'Zone',
  area: 'Area',
  parish: 'Parish',
  department: 'Department',
};

/**
 * Move someone to another part of the church (memberships.manage), as the web
 * Console's Move does. Only the places this leader leads are offered: the
 * server marks them `selectable`, and checks the move again at both ends. The
 * move is recorded with the reason, and any role they hold stays where it is.
 */
export default function MovePersonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tools = useTeacherTools();

  const membership = usePersonMembership(id);
  const tree = useLeaderTree(tools.movePeople);
  const move = useMovePerson(id ?? '');

  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const m = membership.data;
  const places = useMemo(() => {
    const nodes = tree.data ?? [];
    const names = new Map(nodes.map((n) => [n.path, n.name]));
    const q = query.trim().toLowerCase();
    return nodes
      .filter((n) => n.selectable && n.is_active !== false && n.id !== m?.organization_node)
      .filter((n) => !q || n.name.toLowerCase().includes(q))
      .map((n) => ({ node: n, under: names.get(n.path.slice(0, -STEPLEN)) }));
  }, [tree.data, query, m?.organization_node]);

  const target: TreeNode | null = tree.data?.find((n) => n.id === targetId) ?? null;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/people'));
  const name = personName(m);

  const go = async () => {
    if (!target) return;
    try {
      await move.mutateAsync({ to_node: target.id, reason: reason.trim() });
      back();
    } catch {
      // Shown above the button.
    }
  };

  if (!tools.movePeople) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Move" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState drawing="sitting" message="Moving people needs a coordinator." />
        </View>
      </View>
    );
  }

  if (membership.isPending || tree.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Move" onBack={back} />
        <View className="gap-3 px-5 pt-4">
          <Skeleton height={52} radius={999} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      </View>
    );
  }

  if (membership.isError || tree.isError) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Move" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load the church list. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => {
              membership.refetch();
              tree.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Move" onBack={back} />

      <KeyboardView>
        <FlatList
          data={places}
          keyExtractor={(p) => p.node.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
          ListHeaderComponent={
            <View className="gap-3 pb-2">
              <Text className="font-ui text-[16px] leading-6 text-ink-2">
                {name} belongs to {m?.organization_node_detail?.name ?? 'nowhere yet'}. Where should
                they belong now? Any role they hold stays where it is.
              </Text>
              <SearchField label="Find a province, zone, area or parish" value={query} onChange={setQuery} />
            </View>
          }
          renderItem={({ item }) => (
            <OptionRow
              title={item.node.name}
              detail={[LEVEL[item.node.node_type] ?? item.node.node_type, item.under && `in ${item.under}`]
                .filter(Boolean)
                .join(' ')}
              selected={targetId === item.node.id}
              onPress={() => setTargetId(item.node.id)}
            />
          )}
          ListEmptyComponent={
            <Text className="py-4 text-center font-ui text-[16px] leading-6 text-ink-2">
              {query.trim() ? `Nothing you lead is called “${query.trim()}”.` : 'There is nowhere else you lead.'}
            </Text>
          }
          ListFooterComponent={
            target ? (
              <View className="pt-3">
                <TextField
                  label="Why (optional)"
                  value={reason}
                  onChange={setReason}
                  hint="Kept with the move, for whoever looks later."
                />
              </View>
            ) : null
          }
        />

        <View className="gap-2 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          {move.isError && (
            <Text
              accessibilityLiveRegion="polite"
              className="text-center font-ui-md text-[14px] leading-5 text-feedback-error"
            >
              {move.error instanceof Error
                ? move.error.message
                : 'That did not work. Check your connection and try again.'}
            </Text>
          )}
          <Button
            label={target ? `Move to ${target.name}` : 'Choose where'}
            onPress={go}
            loading={move.isPending}
            disabled={!target}
            className="w-full"
          />
        </View>
      </KeyboardView>
    </View>
  );
}
