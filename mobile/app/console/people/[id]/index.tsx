import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  personName,
  useDeclineTeaching,
  usePeopleRoles,
  usePersonAccount,
  usePersonMembership,
  useRevokeRole,
} from '../../../../src/api/people';
import type { PersonRole } from '../../../../src/api/types';
import { Icon, type IconName } from '../../../../src/components/Icon';
import { useTeacherTools } from '../../../../src/state/teacher';
import { Button } from '../../../../src/ui/Button';
import { Avatar, colourFor } from '../../../../src/ui/cards';
import { Press } from '../../../../src/ui/Press';
import { BackHeader, EmptyState, SectionTitle, Sheet, Skeleton } from '../../../../src/ui/screen';
import { useTokens } from '../../../../src/theme/ThemeProvider';
import { ELEVATION } from '../../../../src/theme/tokens';

const SCREENS = {
  edit: '/console/people/[id]/edit',
  role: '/console/people/[id]/role',
  move: '/console/people/[id]/move',
} as const;

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
 * One person, for a leader: where they belong, the roles they hold, and the
 * changes this leader may make (each shown only to someone who can make it).
 *
 * The route carries the membership, not the user: that is what People lists,
 * and what a move acts on.
 */
export default function PersonScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tools = useTeacherTools();

  const membership = usePersonMembership(id);
  const userId = membership.data?.user;
  const account = usePersonAccount(userId, tools.editPeople);
  const roles = usePeopleRoles(userId ? [userId] : [], tools.seeRoles);
  const revoke = useRevokeRole();
  const decline = useDeclineTeaching(id ?? '');
  const [removing, setRemoving] = useState<PersonRole | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/people'));

  if (membership.isError && !membership.data) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Person" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load this person. They may be outside your part of the church, or the connection dropped."
            actionLabel="Try again"
            onAction={() => membership.refetch()}
          />
        </View>
      </View>
    );
  }

  const m = membership.data;
  if (!m) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Person" onBack={back} />
        <View className="items-center gap-4 px-5 pt-4">
          <Skeleton width={88} height={88} radius={44} />
          <Skeleton height={120} />
          <Skeleton height={160} />
        </View>
      </View>
    );
  }

  const name = personName(m);
  const home = m.organization_node_detail;
  const a = account.data;
  const switchedOff = (a?.is_active ?? m.user_detail?.is_active) === false;
  const held = roles.data ?? [];

  const go = (screen: 'edit' | 'role' | 'move') =>
    router.push({ pathname: SCREENS[screen], params: { id: m.id } });

  const confirmRemove = async () => {
    if (!removing) return;
    setRevokeError(null);
    try {
      await revoke.mutateAsync(removing.id);
      setRemoving(null);
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    }
  };

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Person" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={membership.isRefetching}
            onRefresh={() => {
              membership.refetch();
              if (tools.editPeople) account.refetch();
              if (tools.seeRoles) roles.refetch();
            }}
          />
        }
      >
        {/* ── Who ───────────────────────────────────────────────────── */}
        <View className="items-center gap-2">
          <Avatar name={name} size={88} colour={colourFor(name)} />
          <Text
            accessibilityRole="header"
            className="text-center font-ui-b text-[22px] leading-7 text-ink-1"
          >
            {name}
          </Text>
          {!!home && (
            <Text className="text-center font-ui-md text-[14px] leading-5 text-ink-2">
              {home.name} · {LEVEL[home.node_type] ?? home.node_type}
            </Text>
          )}
          {switchedOff && (
            <View className="flex-row items-center gap-1.5 rounded-full bg-surf-sunken px-3 py-1">
              <Icon name="lock" size={14} color={tokens.text2} />
              <Text className="font-ui-sb text-[12px] leading-4 text-ink-2">Account switched off</Text>
            </View>
          )}
        </View>

        {/* ── Said "I teach" at sign-up, waiting for an answer ──────── */}
        {!!m.asked_to_teach_at && tools.assignRoles && (
          <View className="w-full gap-3 rounded-2xl bg-amber-tonal p-4">
            <View className="gap-1">
              <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
                {name} says they teach
              </Text>
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                They said so when they joined on {joinedOn(m.asked_to_teach_at)}. Giving them a
                role answers it; until then they see the app as a member.
              </Text>
            </View>
            <Button label="Give the Teacher role" onPress={() => go('role')} className="w-full" />
            <Button
              label="Not a teacher"
              variant="secondary"
              onPress={() => decline.mutate()}
              loading={decline.isPending}
              className="w-full"
            />
            {decline.isError && (
              <Text
                accessibilityLiveRegion="polite"
                className="font-ui-md text-[14px] leading-5 text-feedback-error"
              >
                {decline.error instanceof Error
                  ? decline.error.message
                  : 'That did not work. Please try again.'}
              </Text>
            )}
          </View>
        )}

        {/* ── Contact (only for someone who may correct it) ─────────── */}
        {tools.editPeople && (
          <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
            {account.isPending ? (
              <View className="py-3">
                <Skeleton height={64} radius={12} />
              </View>
            ) : a ? (
              <>
                <Line icon="mail" label="Email" value={a.email} />
                <Line icon="phone" label="Phone" value={a.phone} />
                <Line icon="person" label="Username" value={a.username} last />
              </>
            ) : (
              <Text className="py-3 font-ui text-[14px] leading-5 text-ink-2">
                Their contact details didn’t load. Pull down to try again.
              </Text>
            )}
          </View>
        )}

        {/* ── Roles ─────────────────────────────────────────────────── */}
        {tools.seeRoles && (
          <>
            <SectionTitle>Roles</SectionTitle>
            {roles.isPending ? (
              <Skeleton height={64} radius={16} />
            ) : held.length === 0 ? (
              <Text className="font-ui text-[14px] leading-5 text-ink-2">
                No role. They take part as a member{home ? ` of ${home.name}` : ''}.
              </Text>
            ) : (
              <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
                {held.map((grant, i) => (
                  <View
                    key={grant.id}
                    className={`flex-row items-center gap-3 py-3 ${i < held.length - 1 ? 'border-b border-line' : ''}`}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">
                        {grant.role_detail?.label ?? 'Role'}
                      </Text>
                      <Text className="font-ui-md text-[12px] leading-4 text-ink-3">
                        {grant.node_detail?.name ?? ''}
                      </Text>
                    </View>
                    {tools.assignRoles && (
                      <Press
                        onPress={() => {
                          setRevokeError(null);
                          setRemoving(grant);
                        }}
                        accessibilityLabel={`Remove ${grant.role_detail?.label ?? 'this role'}`}
                        className="h-9 justify-center rounded-full bg-surf-sunken px-3.5"
                      >
                        <Text className="font-ui-sb text-[14px] leading-5 text-ink-1">Remove</Text>
                      </Press>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── What this leader can do ───────────────────────────────── */}
        <View className="gap-2 pt-2">
          {tools.assignRoles && (
            <Button label="Give a role" onPress={() => go('role')} className="w-full" />
          )}
          {tools.editPeople && (
            <Button
              label="Edit details"
             
              variant="secondary"
              onPress={() => go('edit')}
              className="w-full"
            />
          )}
          {tools.movePeople && (
            <Button
              label="Move to another part of the church"
             
              variant="secondary"
              onPress={() => go('move')}
              className="w-full"
            />
          )}
          {tools.roster && (
            <Button
              label="Their reading this week"
             
              variant="tertiary"
              onPress={() =>
                router.push({ pathname: '/console/class/[id]', params: { id: m.user } })
              }
              className="w-full"
            />
          )}
        </View>
      </ScrollView>

      <Sheet visible={!!removing} onClose={() => setRemoving(null)}>
        <View className="gap-3">
          <Text accessibilityRole="header" className="font-ui-b text-[20px] leading-7 text-ink-1">
            Remove {removing?.role_detail?.label ?? 'this role'}?
          </Text>
          <Text className="font-ui text-[16px] leading-6 text-ink-2">
            {name} stops being {removing?.role_detail?.label ?? 'this'} at{' '}
            {removing?.node_detail?.name ?? 'this place'}. They stay a member, and the record of
            when they held it is kept.
          </Text>
          {!!revokeError && (
            <Text
              accessibilityLiveRegion="polite"
              className="font-ui-md text-[14px] leading-5 text-feedback-error"
            >
              {revokeError}
            </Text>
          )}
          <Button label="Remove role" onPress={confirmRemove} loading={revoke.isPending} className="w-full" />
          <Button label="Keep it" variant="tertiary" onPress={() => setRemoving(null)} className="w-full" />
        </View>
      </Sheet>
    </View>
  );
}

function joinedOn(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'sign-up'
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

function Line({
  icon,
  label,
  value,
  last = false,
}: {
  icon: IconName;
  label: string;
  value: string | null | undefined;
  last?: boolean;
}) {
  const tokens = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value || 'not set'}`}
      className={`flex-row items-center gap-3 py-3 ${last ? '' : 'border-b border-line'}`}
    >
      <Icon name={icon} size={18} color={tokens.text3} />
      <Text className="font-ui text-[14px] leading-5 text-ink-3">{label}</Text>
      <Text numberOfLines={1} className="flex-1 text-right font-ui-sb text-[14px] leading-5 text-ink-1">
        {value || 'Not set'}
      </Text>
    </View>
  );
}
