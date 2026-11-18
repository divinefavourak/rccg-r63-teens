import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  grantableRoles,
  personName,
  useGrantRole,
  usePeopleRoles,
  usePersonMembership,
  useRoleCatalogue,
} from '../../../../src/api/people';
import { useIdentity } from '../../../../src/api/queries';
import { useTeacherTools } from '../../../../src/state/teacher';
import { Button } from '../../../../src/ui/Button';
import { OptionRow } from '../../../../src/ui/inputs';
import { BackHeader, EmptyState, Skeleton } from '../../../../src/ui/screen';

/**
 * Give someone a role, such as Teacher (roles.assign).
 *
 * The role is held where they belong: their home in the tree. Only the roles
 * that both make sense there and carry nothing the leader does not hold
 * themselves are offered (`grantableRoles`); the server checks both again.
 * So a province coordinator can make a teen in their province a Teacher, but
 * is never shown Regional Coordinator.
 */
export default function GiveRoleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tools = useTeacherTools();

  const membership = usePersonMembership(id);
  const m = membership.data;
  const identity = useIdentity(tools.assignRoles);
  const catalogue = useRoleCatalogue(tools.assignRoles);
  const held = usePeopleRoles(m ? [m.user] : [], tools.assignRoles);
  const grant = useGrantRole();

  const [chosen, setChosen] = useState<string | null>(null);

  const home = m?.organization_node_detail ?? null;
  const offered = useMemo(() => {
    if (!catalogue.data || !identity.data || !home) return [];
    const already = new Set(
      (held.data ?? []).filter((g) => g.node === home.id).map((g) => g.role),
    );
    return grantableRoles(
      catalogue.data,
      home.node_type,
      { permissions: identity.data.permissions, isSuperuser: identity.data.is_superuser },
      already,
    );
  }, [catalogue.data, identity.data, held.data, home]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/people'));
  const role = offered.find((r) => r.id === chosen) ?? null;
  const name = personName(m);

  const give = async () => {
    if (!m || !home || !role) return;
    try {
      await grant.mutateAsync({ user: m.user, role: role.id, node: home.id });
      back();
    } catch {
      // Shown above the button.
    }
  };

  const loading = membership.isPending || catalogue.isPending || identity.isPending || held.isPending;

  if (!tools.assignRoles) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Give a role" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState drawing="sitting" message="Giving roles needs a coordinator." />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Give a role" onBack={back} />
        <View className="gap-3 px-5 pt-4">
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      </View>
    );
  }

  if (catalogue.isError || membership.isError) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Give a role" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load the roles. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => {
              catalogue.refetch();
              membership.refetch();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Give a role" onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        <Text className="font-ui text-[16px] leading-6 text-ink-2">
          {name} will hold it at {home?.name ?? 'their home'}, where they belong.
          {home ? '' : ' They need a place in the church first.'}
        </Text>

        {offered.length === 0 ? (
          <Text className="py-4 font-ui text-[16px] leading-6 text-ink-2">
            There is no role you can give at {home?.name ?? 'this place'}. A Teacher can be given at
            a province, area or parish; someone in a region or zone needs moving to one first, or a
            regional coordinator to appoint them.
          </Text>
        ) : (
          offered.map((r) => (
            <OptionRow
              key={r.id}
              title={r.label}
              detail={r.description || undefined}
              selected={chosen === r.id}
              onPress={() => setChosen(r.id)}
            />
          ))
        )}
      </ScrollView>

      <View className="gap-2 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        {grant.isError && (
          <Text
            accessibilityLiveRegion="polite"
            className="text-center font-ui-md text-[14px] leading-5 text-feedback-error"
          >
            {grant.error instanceof Error
              ? grant.error.message
              : 'That did not work. Check your connection and try again.'}
          </Text>
        )}
        <Button
          label={role ? `Make ${name.split(' ')[0]} ${withArticle(role.label)}` : 'Choose a role'}
          onPress={give}
          loading={grant.isPending}
          disabled={!role}
          className="w-full"
        />
      </View>
    </View>
  );
}

/** "a Teacher", "an Area Coordinator". */
function withArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}
