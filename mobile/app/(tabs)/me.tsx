import { memo, useCallback } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  useBookmarks,
  useCan,
  useFavorites,
  useMyRegistrations,
  useProfile,
  useProgress,
  useUnreadCount,
} from '../../src/api/queries';
import { PERM, type StreakState } from '../../src/api/types';
import { Icon, type IconName } from '../../src/components/Icon';
import { useNavClearance } from '../../src/components/useNavClearance';
import { isLive } from '../../src/data/events';
import { activeToday, streakWeek, streakWords } from '../../src/data/streak';
import { useAuth } from '../../src/state/auth';
import { useChangePhoto, useMyPhoto } from '../../src/state/photo';
import { DrawingIn, Object3D } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { Avatar, POP_BG, StatTile, StreakCard } from '../../src/ui/cards';
import { Press } from '../../src/ui/Press';
import { IconButton, Skeleton, TabHeader } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION, POP, type PopColour } from '../../src/theme/tokens';

/**
 * Me — who you are here, how you are doing, and the way to everything of yours.
 *
 * For a guest this tab is where an account is offered (05-navigation.md), so
 * signed out it is a different screen rather than this one with a banner.
 */
export default function MeScreen() {
  const { isGuest } = useAuth();
  return isGuest ? <GuestMe /> : <MemberMe />;
}

// ─── Signed in ─────────────────────────────────────────────────────────────

const AGE_GROUP: Record<string, string> = {
  toddler: 'Toddler',
  children: 'Child',
  pre_teen: 'Pre-teen',
  teen: 'Teen',
  superteen: 'Superteen',
};

function MemberMe() {
  const router = useRouter();
  const { user } = useAuth();
  const navClearance = useNavClearance(24);

  const profile = useProfile();
  const progress = useProgress();
  const favorites = useFavorites();
  const bookmarks = useBookmarks();
  const tickets = useMyRegistrations();
  const unread = useUnreadCount();
  const photo = useMyPhoto();
  const changePhoto = useChangePhoto();

  // What someone may do comes from their permissions, never from a role's
  // name (05-navigation.md). Leaders keep the whole teen app; the Console is
  // one more place to go, shown only to those who can use it.
  const canManageContent = useCan(PERM.contentManage);
  const canManageEvents = useCan(PERM.eventsManage);

  const refetch = useCallback(() => {
    profile.refetch();
    progress.refetch();
    favorites.refetch();
    bookmarks.refetch();
    tickets.refetch();
  }, [profile, progress, favorites, bookmarks, tickets]);

  const name =
    profile.data?.full_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
    user?.username ||
    'Friend';
  const role = [
    profile.data?.age_group ? (AGE_GROUP[profile.data.age_group] ?? null) : null,
    profile.data?.age ?? null,
  ]
    .filter(Boolean)
    .join(' · ');
  const parish = profile.data?.parish || user?.parish || '';

  const saved = (favorites.data?.length ?? 0) + (bookmarks.data?.length ?? 0);
  const ticketCount = (tickets.data ?? []).filter(isLive).length;
  const unreadCount = unread.data?.unread_count ?? 0;

  const streak: StreakState | null = progress.data
    ? {
        current_length: progress.data.current_streak,
        longest_length: progress.data.longest_streak,
        last_active_on: progress.data.last_active_on,
      }
    : null;
  const done = activeToday(streak);

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="Me">
        <IconButton
          icon="bell"
          label={unreadCount > 0 ? 'Notifications, unread' : 'Notifications'}
          dot={unreadCount > 0}
          onPress={() => router.push('/notifications')}
        />
        <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
      </TabHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: 20,
          // Room for the crown that breaks out of the profile card.
          paddingTop: 30,
          paddingBottom: navClearance,
        }}
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching || progress.isRefetching}
            onRefresh={refetch}
          />
        }
      >
        {/* ── Profile ─────────────────────────────────────────────────── */}
        <View className="w-full flex-row items-center gap-4 rounded-3xl bg-pop-violet p-5">
          <Press
            onPress={changePhoto.change}
            disabled={changePhoto.pending}
            accessibilityLabel={photo ? 'Change your photo' : 'Add a photo'}
            accessibilityState={{ busy: changePhoto.pending }}
            style={{ opacity: changePhoto.pending ? 0.6 : 1 }}
          >
            <Avatar name={name} photo={photo} size={84} ring={4} />
            {/* Always dark with a light mark: it sits on violet in both themes. */}
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-pop-violet bg-pop-on">
              <Icon name="camera" size={16} color="#FDFAF5" />
            </View>
          </Press>
          <View className="min-w-0 flex-1 gap-1.5">
            <Text
              numberOfLines={2}
              accessibilityRole="header"
              className="pr-10 font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-pop-on"
            >
              {name}
            </Text>
            {!!role && (
              // Always dark: it sits on violet in both themes.
              <View className="self-start rounded-full bg-pop-on px-3 py-1">
                <Text className="font-ui-sb text-[12px] leading-4" style={{ color: '#FDFAF5' }}>
                  {role}
                </Text>
              </View>
            )}
            {!!parish && (
              <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-pop-on">
                {parish}
              </Text>
            )}
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', right: 4, top: -26 }}>
            <Object3D name="crown" size={72} />
          </View>
        </View>

        {!!changePhoto.error && (
          <Text
            accessibilityLiveRegion="polite"
            className="font-ui-md text-[14px] leading-5 text-feedback-error"
          >
            {changePhoto.error}
          </Text>
        )}

        {/* ── Numbers ─────────────────────────────────────────────────── */}
        {progress.isPending ? (
          <View className="flex-row" style={{ gap: 10 }}>
            <Skeleton width="31%" height={84} />
            <Skeleton width="31%" height={84} />
            <Skeleton width="31%" height={84} />
          </View>
        ) : (
          // Extra room above for the objects that break out of each tile.
          <View className="mt-2 flex-row" style={{ gap: 10 }}>
            <StatTile
              value={String(progress.data?.devotionals_completed ?? 0)}
              label="Days read"
              colour="amber"
              object="fire"
            />
            <StatTile
              value={String(progress.data?.chapters_read ?? 0)}
              label="Chapters"
              colour="sky"
              object="notebook"
            />
            <StatTile value={String(saved)} label="Saved" colour="pink" object="star" />
          </View>
        )}

        {progress.isError && !progress.data && (
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            We couldn’t load your progress just now. Pull down to try again.
          </Text>
        )}

        {streak && <StreakCard {...streakWords(streak, done)} week={streakWeek(streak, done)} />}

        {/* ── Menu ────────────────────────────────────────────────────── */}
        <View className="w-full rounded-2xl bg-surf-raised px-4 py-1" style={ELEVATION.card}>
          <MenuRow
            icon="flame"
            colour="amber"
            label="Progress"
            onPress={() => router.push('/progress')}
          />
          <MenuRow
            icon="bookmark"
            colour="pink"
            label="Saved"
            meta={saved > 0 ? String(saved) : undefined}
            onPress={() => router.push('/saved')}
          />
          <MenuRow
            icon="qr"
            colour="lime"
            label="My tickets"
            meta={ticketCount > 0 ? String(ticketCount) : undefined}
            onPress={() => router.push('/tickets')}
          />
          <MenuRow
            icon="bell"
            colour="sky"
            label="Notifications"
            meta={unreadCount > 0 ? `${unreadCount > 9 ? '9+' : unreadCount} new` : undefined}
            onPress={() => router.push('/notifications')}
          />
          <MenuRow
            icon="more"
            colour="violet"
            label="Settings"
            onPress={() => router.push('/settings')}
          />
          {/* Missing, not locked, for anyone who cannot use it. */}
          {(canManageContent || canManageEvents) && (
            <MenuRow
              icon="school"
              colour="green"
              label="Console"
              onPress={() => router.push('/console')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** One line of the menu: a colour dot with an icon, a label, a count, a chevron. */
const MenuRow = memo(function MenuRow({
  icon,
  colour,
  label,
  meta,
  onPress,
}: {
  icon: IconName;
  colour: PopColour;
  label: string;
  /** A small count or "2 new", shown before the chevron. */
  meta?: string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  return (
    <Press
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={meta ? `${label}, ${meta}` : label}
      className="h-16 w-full flex-row items-center gap-3"
    >
      <View className={`h-10 w-10 items-center justify-center rounded-full ${POP_BG[colour]}`}>
        <Icon name={icon} size={20} color={POP.on} />
      </View>
      <Text className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-1">{label}</Text>
      {meta && (
        <View className="rounded-full bg-surf-sunken px-2.5 py-0.5">
          <Text className="font-ui-sb text-[12px] leading-4 text-ink-2">{meta}</Text>
        </View>
      )}
      <Icon name="chevronRight" size={20} color={tokens.text1} />
    </Press>
  );
});

// ─── Signed out ────────────────────────────────────────────────────────────

function GuestMe() {
  const router = useRouter();
  const navClearance = useNavClearance(24);

  return (
    <View className="flex-1 bg-surf-base">
      <TabHeader title="Me" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: navClearance,
        }}
      >
        <View className="h-[240px] w-[240px] items-center justify-center rounded-full bg-pop-sky">
          <DrawingIn name="strolling" box={206} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 190, top: 0 }}>
            <Object3D name="star" size={64} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: -10, top: 150 }}>
            <Object3D name="crown" size={60} />
          </View>
        </View>

        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
        >
          Make Faith Tribe yours
        </Text>
        <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
          Keep your streak, save what you love and get your event tickets. The Bible stays free to
          read either way.
        </Text>

        <Button label="Create account" onPress={() => router.push('/sign-up')} className="w-full" />
        <Button
          label="Log in"
          variant="secondary"
          onPress={() => router.push('/log-in')}
          className="w-full"
        />
      </ScrollView>
    </View>
  );
}
