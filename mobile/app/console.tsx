import { useCallback } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Button, Card, Pill } from '../src/components/ui';
import { EmptyState, ErrorState, ListSkeleton } from '../src/components/states';
import { useTokens } from '../src/theme/ThemeProvider';
import {
  useCan,
  useDevotionalWorkflow,
  useDraftDevotionals,
} from '../src/api/queries';
import { PERM, type DevotionalListItem } from '../src/api/types';

/**
 * The Console.
 *
 * 05-navigation.md: "Leaders keep the full teen experience; a coordinator has a
 * streak too. The Console is an *additional* place, entered deliberately, never
 * mixed into teen surfaces." So this sits behind Me → Console rather than
 * becoming a sixth tab, and the teen Library stays pinned to published content
 * no matter who is signed in.
 *
 * Scope here is deliberately narrow: the unpublished queue, and the workflow
 * transitions the backend already models. People, events and analytics remain
 * the web Console's job.
 */
export default function ConsoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();

  const canManage = useCan(PERM.contentManage);
  const canPublish = useCan(PERM.contentPublish);

  const drafts = useDraftDevotionals(canManage);
  const workflow = useDevotionalWorkflow();

  const act = useCallback(
    (item: DevotionalListItem, action: 'submit_for_review' | 'approve' | 'publish') => {
      const verb = action === 'publish' ? 'Publish' : action === 'approve' ? 'Approve' : 'Submit';
      Alert.alert(
        `${verb} "${item.title}"?`,
        action === 'publish'
          ? 'Once published it appears on Today and in Library for every teen.'
          : 'This moves it to the next step of review.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: verb,
            onPress: () => workflow.mutate({ id: item.id, action }),
          },
        ],
      );
    },
    [workflow],
  );

  const header = (
    <View
      className="flex-row items-center gap-3 border-b border-line bg-surf-raised px-4 pb-3.5"
      style={{ paddingTop: insets.top + 10 }}
    >
      <Pressable
        onPress={router.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        className="h-10 w-10 items-center justify-center rounded-md border border-line"
      >
        <Icon name="chevronLeft" size={20} color={tokens.text2} />
      </Pressable>
      <View className="flex-1">
        <Text className="font-ui-b text-[16px] text-ink-1">Console</Text>
        <Text className="font-ui text-[12px] text-ink-3">Devotionals awaiting publication</Text>
      </View>
    </View>
  );

  // The entry point is already permission-gated, but a deep link is not.
  if (!canManage) {
    return (
      <View className="flex-1 bg-surf-base">
        {header}
        <EmptyState
          title="Not available"
          body="This area is for teen leaders and coordinators."
          actionLabel="Back to Me"
          onAction={() => router.replace('/me')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      {header}

      {drafts.isPending ? (
        <View className="pt-4">
          <ListSkeleton rows={4} height={96} />
        </View>
      ) : drafts.isError ? (
        <ErrorState error={drafts.error} onRetry={drafts.refetch} />
      ) : (
        <FlatList
          data={drafts.data ?? []}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, gap: 12 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={drafts.isRefetching} onRefresh={drafts.refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              title="Everything is published"
              body="No drafts are waiting. Nice work."
            />
          }
          renderItem={({ item }) => (
            <DraftRow
              item={item}
              canPublish={canPublish}
              busy={workflow.isPending}
              onOpen={() => router.push({ pathname: '/devotional', params: { id: item.id } })}
              onAct={act}
            />
          )}
        />
      )}

      {workflow.isError && (
        <Text
          accessibilityLiveRegion="polite"
          className="px-5 pb-4 font-ui-md text-[13px]"
          style={{ color: tokens.error }}
        >
          {workflow.error instanceof Error
            ? workflow.error.message
            : 'That did not work. Try again.'}
        </Text>
      )}
    </View>
  );
}

function DraftRow({
  item,
  canPublish,
  busy,
  onOpen,
  onAct,
}: {
  item: DevotionalListItem;
  canPublish: boolean;
  busy: boolean;
  onOpen: () => void;
  onAct: (item: DevotionalListItem, action: 'submit_for_review' | 'approve' | 'publish') => void;
}) {
  const inReview = item.status === 'in_review';

  return (
    <Card className="p-4">
      <View className="mb-2 flex-row items-start justify-between gap-3">
        <Pressable onPress={onOpen} accessibilityRole="button" className="flex-1">
          <Text className="font-ui-b text-[16px] leading-[21px] text-ink-1">{item.title}</Text>
          <Text className="mt-0.5 font-ui text-[12px] text-ink-3">{formatDate(item.date)}</Text>
        </Pressable>

        <Pill tone={inReview ? 'green' : 'neutral'}>
          <Text
            className={`font-ui-sb text-[11px] ${inReview ? 'text-green' : 'text-ink-3'}`}
          >
            {inReview ? 'In review' : 'Draft'}
          </Text>
        </Pill>
      </View>

      {!!item.memory_verse_passage && (
        <Text numberOfLines={1} className="mb-3 font-ui text-[13px] text-ink-2">
          {item.memory_verse_passage}
        </Text>
      )}

      <View className="flex-row gap-2">
        <Button
          label="Preview"
          variant="secondary"
          onPress={onOpen}
          height={44}
          className="flex-1"
        />
        {/* Publishing is its own permission: a teacher may draft without being
            able to put something in front of the whole region. */}
        {canPublish ? (
          <Button
            label="Publish"
            onPress={() => onAct(item, 'publish')}
            disabled={busy}
            height={44}
            className="flex-1"
          />
        ) : (
          <Button
            label={inReview ? 'Approve' : 'Submit'}
            onPress={() => onAct(item, inReview ? 'approve' : 'submit_for_review')}
            disabled={busy}
            height={44}
            className="flex-1"
          />
        )}
      </View>
    </Card>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
