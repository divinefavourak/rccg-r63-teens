import { memo, useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCan, useDevotionalWorkflow, useDraftDevotionals } from '../../src/api/queries';
import { PERM, type DevotionalListItem } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import { Button } from '../../src/ui/Button';
import { Press } from '../../src/ui/Press';
import { BackHeader, EmptyState, Sheet, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION } from '../../src/theme/tokens';

type Action = 'submit_for_review' | 'approve' | 'publish';

/** The button on a draft, and the question the sheet asks before doing it. */
const ACTIONS: Record<Action, { verb: string; consequence: string }> = {
  submit_for_review: {
    verb: 'Submit for review',
    consequence: 'It goes to a reviewer, who can approve it for publishing.',
  },
  approve: {
    verb: 'Approve',
    consequence: 'It moves on to whoever publishes for your region.',
  },
  publish: {
    verb: 'Publish',
    consequence: 'It shows on Today and in Library for every teen straight away.',
  },
};

/**
 * The review queue: devotionals that are written but not yet published.
 *
 * Reached from Teacher home by someone who holds `content.manage`. It stays
 * narrow on purpose: the unpublished queue, and the workflow steps the backend
 * already models. Writing and editing a devotional is the web Console's job; a
 * phone is where a reviewer reads one through and lets it go.
 */
export default function ReviewQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const canManage = useCan(PERM.contentManage);
  const canPublish = useCan(PERM.contentPublish);

  const drafts = useDraftDevotionals(canManage);
  const workflow = useDevotionalWorkflow();

  /** The step waiting on a yes in the sheet. */
  const [asking, setAsking] = useState<{ item: DevotionalListItem; action: Action } | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console'));

  const onOpen = useCallback(
    (item: DevotionalListItem) => router.push({ pathname: '/devotional', params: { id: item.id } }),
    [router],
  );

  const onAct = useCallback(
    (item: DevotionalListItem, action: Action) => setAsking({ item, action }),
    [],
  );

  const confirm = () => {
    if (!asking) return;
    workflow.mutate({ id: asking.item.id, action: asking.action });
    setAsking(null);
  };

  const renderItem = useCallback(
    ({ item }: { item: DevotionalListItem }) => (
      <DraftCard
        item={item}
        canPublish={canPublish}
        busy={workflow.isPending}
        onOpen={onOpen}
        onAct={onAct}
      />
    ),
    [canPublish, workflow.isPending, onOpen, onAct],
  );

  // The entry on Teacher home is permission-gated, but a deep link is not.
  if (!canManage) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Review queue" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="Reviewing devotionals is for the people who write and publish them."
            actionLabel="Back"
            onAction={back}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Review queue" onBack={back} />

      {drafts.isPending ? (
        <View className="gap-3 px-5 pt-2">
          <Skeleton height={176} />
          <Skeleton height={176} />
          <Skeleton height={176} />
        </View>
      ) : (
        <FlatList
          data={drafts.data ?? []}
          keyExtractor={keyOfDraft}
          renderItem={renderItem}
          ListHeaderComponent={
            drafts.data?.length ? (
              <View className="gap-2 pb-1">
                <Text className="font-ui text-[16px] leading-6 text-ink-2">
                  Devotionals waiting to be published.
                </Text>
                {workflow.isError && (
                  <Text
                    accessibilityLiveRegion="polite"
                    className="font-ui-md text-[14px] leading-5 text-feedback-error"
                  >
                    {workflow.error instanceof Error
                      ? workflow.error.message
                      : 'That did not go through. Please try again.'}
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 justify-center">
              <EmptyState
                drawing={drafts.isError ? 'sitting' : 'jumping'}
                message={
                  drafts.isError
                    ? 'We couldn’t load the drafts. Check your connection, then try again.'
                    : 'Everything is published. Nothing is waiting on you.'
                }
                actionLabel={drafts.isError ? 'Try again' : undefined}
                onAction={() => drafts.refetch()}
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
          refreshControl={
            <RefreshControl refreshing={drafts.isRefetching} onRefresh={drafts.refetch} />
          }
        />
      )}

      <Sheet visible={!!asking} onClose={() => setAsking(null)}>
        {asking && (
          <View className="w-full gap-3 pt-2">
            <Text
              accessibilityRole="header"
              className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
            >
              {ACTIONS[asking.action].verb} “{asking.item.title}”?
            </Text>
            <Text className="font-ui text-[16px] leading-6 text-ink-2">
              {ACTIONS[asking.action].consequence}
            </Text>
            <Button label={ACTIONS[asking.action].verb} onPress={confirm} className="mt-1 w-full" />
            <Button
              label="Not yet"
              variant="tertiary"
              onPress={() => setAsking(null)}
              className="w-full"
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}

const keyOfDraft = (d: DevotionalListItem) => d.id;

/**
 * One unpublished devotional: tap the top to read it as a teen would, and one
 * button for the next step it can take.
 */
const DraftCard = memo(function DraftCard({
  item,
  canPublish,
  busy,
  onOpen,
  onAct,
}: {
  item: DevotionalListItem;
  canPublish: boolean;
  busy: boolean;
  onOpen: (item: DevotionalListItem) => void;
  onAct: (item: DevotionalListItem, action: Action) => void;
}) {
  const tokens = useTokens();
  const inReview = item.status === 'in_review';
  // Publishing is its own permission: a teacher may draft without being able
  // to put something in front of the whole region.
  const action: Action = canPublish ? 'publish' : inReview ? 'approve' : 'submit_for_review';

  return (
    <View className="w-full gap-3 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
      <Press
        onPress={() => onOpen(item)}
        scaleTo={0.985}
        accessibilityLabel={`Preview ${item.title}. ${inReview ? 'In review' : 'Draft'}`}
        className="flex-row items-center gap-3"
      >
        <View className="min-w-0 flex-1 gap-1">
          <View
            className={`self-start rounded-full px-3 py-1 ${
              inReview ? 'bg-green-tonal' : 'bg-surf-sunken'
            }`}
          >
            <Text
              className={`font-ui-sb text-[12px] leading-4 ${inReview ? 'text-green' : 'text-ink-2'}`}
            >
              {inReview ? 'In review' : 'Draft'}
            </Text>
          </View>
          <Text numberOfLines={2} className="font-ui-b text-[17px] leading-6 text-ink-1">
            {item.title}
          </Text>
          <Text numberOfLines={1} className="font-ui text-[14px] leading-5 text-ink-2">
            {[formatDate(item.date), item.memory_verse_passage].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Icon name="chevronRight" size={20} color={tokens.text1} />
      </Press>

      <Button
        label={ACTIONS[action].verb}
        onPress={() => onAct(item, action)}
        disabled={busy}
        className="w-full"
      />
    </View>
  );
});

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
