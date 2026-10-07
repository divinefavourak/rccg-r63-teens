import { Linking, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useClassMember } from '../../../src/api/queries';
import type { ClassMemberDetail } from '../../../src/api/types';
import { WeekDots } from '../../../src/components/ClassPieces';
import { Icon } from '../../../src/components/Icon';
import { Avatar, colourFor } from '../../../src/ui/cards';
import { Press } from '../../../src/ui/Press';
import { BackHeader, EmptyState, Skeleton } from '../../../src/ui/screen';
import { useTokens } from '../../../src/theme/ThemeProvider';
import { ELEVATION } from '../../../src/theme/tokens';

/**
 * One teen, read-only (Figma "Teen profile (read-only)").
 *
 * What a teacher needs in order to care for someone: how the week is going,
 * and a guardian to call. The wording about a quiet week is an invitation to
 * say hello, never a report of a failure (12-gamification.md).
 */
export default function ClassMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const tokens = useTokens();
  const member = useClassMember(id);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/console/class'));
  const teen = member.data;

  if (member.isPending) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="" onBack={back} />
        <View className="gap-3.5 px-5 pt-2">
          <Skeleton height={120} radius={28} />
          <Skeleton height={116} />
          <Skeleton height={104} />
        </View>
      </View>
    );
  }

  if (!teen) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="" onBack={back} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t open this profile. They may have moved to another parish, or your connection dropped."
            actionLabel="Try again"
            onAction={() => member.refetch()}
          />
        </View>
      </View>
    );
  }

  const week = weekWords(teen);
  const guardian = [teen.guardian_name, teen.guardian_relationship].filter(Boolean);

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title={teen.name} onBack={back} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        <View className="w-full flex-row items-center gap-4 rounded-[28px] bg-pop-sky p-5">
          <Avatar name={teen.name} photo={teen.photo} size={80} ring={3} colour={colourFor(teen.name)} />
          <View className="min-w-0 flex-1 gap-1">
            <Text
              numberOfLines={2}
              className="font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-pop-on"
            >
              {teen.name}
            </Text>
            <Text numberOfLines={2} className="font-ui text-[14px] leading-5 text-pop-on">
              {[teen.age, teen.parish].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        <View className="w-full gap-2 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
          <View className="flex-row items-center">
            <Text className="flex-1 font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
              This week
            </Text>
            <WeekDots week={teen.week} />
          </View>
          <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{week.title}</Text>
          <Text className="font-ui text-[14px] leading-5 text-ink-2">{week.detail}</Text>
        </View>

        <View className="w-full gap-2 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
            Parent or guardian
          </Text>
          {teen.guardian_name || teen.guardian_phone ? (
            <View className="flex-row items-center gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={2} className="font-ui-sb text-[16px] leading-6 text-ink-1">
                  {guardian.length ? guardian.join(' · ') : 'No name given'}
                </Text>
                <Text selectable className="font-ui text-[14px] leading-5 text-ink-2">
                  {teen.guardian_phone || 'No phone number given'}
                </Text>
              </View>
              {!!teen.guardian_phone && (
                <Press
                  onPress={() => Linking.openURL(`tel:${dialable(teen.guardian_phone)}`).catch(() => {})}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${teen.guardian_name || 'their guardian'}`}
                  className="h-11 flex-row items-center gap-1.5 rounded-full bg-ink pl-3 pr-4"
                >
                  <Icon name="phone" size={18} color={tokens.onInk} />
                  <Text className="font-ui-sb text-[14px] leading-5 text-on-ink">Call</Text>
                </Press>
              )}
            </View>
          ) : (
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              {firstName(teen.name)} has not added a parent or guardian yet. They can do it from
              their profile in Settings.
            </Text>
          )}
        </View>

        <View className="w-full flex-row items-center gap-2 rounded-[20px] bg-surf-sunken py-3 pl-3 pr-3.5">
          <Icon name="lock" size={16} color={tokens.text2} />
          <Text className="flex-1 font-ui text-[14px] leading-5 text-ink-2">
            You can view this profile. Only {firstName(teen.name)} can change it.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'They';
}

/** Digits and a leading plus only, so "0805 555 0166" dials. */
function dialable(phone: string): string {
  return phone.replace(/(?!^\+)[^\d]/g, '');
}

/** The week in a headline and one kind sentence. */
function weekWords(teen: ClassMemberDetail): { title: string; detail: string } {
  const days = teen.days_this_week;
  const name = firstName(teen.name);

  if (days > 0) {
    return {
      title: `Read on ${days} of 7 days this week`,
      detail: teen.read_today
        ? `${name} has read today.`
        : `${name} has not read yet today. There is still time.`,
    };
  }

  const last = teen.last_read_on ? daysBetween(teen.last_read_on, teen.today) : null;
  if (last === null) {
    return {
      title: 'Hasn’t read yet this week',
      detail: `${name} has not started reading in the app yet. A word of welcome on Sunday could help.`,
    };
  }
  return {
    title: 'Hasn’t read yet this week',
    detail: `Last read ${last === 1 ? 'yesterday' : `${last} days ago`}. Might be worth a hello on Sunday.`,
  };
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}
