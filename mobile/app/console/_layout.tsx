import { View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';

import { TeacherNav } from '../../src/components/TeacherNav';
import { useAuth } from '../../src/state/auth';
import { useTeacherTools } from '../../src/state/teacher';
import { BackHeader, EmptyState, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';

/** Full-screen tasks, where the teacher nav would only be in the way. */
const WITHOUT_NAV = ['/console/check-in', '/console/review'];

/**
 * Teacher tools (Figma page "Console · Teacher on phone").
 *
 * 05-navigation.md: "Leaders keep the full teen experience; a coordinator has a
 * streak too. The Console is an *additional* place, entered deliberately, never
 * mixed into teen surfaces." So this is its own stack with its own nav, reached
 * from a card on Me, and the teen tabs know nothing about it.
 *
 * The nav lives here rather than in each screen, so it stays put while the
 * screens above it change.
 */
export default function ConsoleLayout() {
  const tokens = useTokens();
  const router = useRouter();
  const path = usePathname();
  const { isGuest } = useAuth();
  const tools = useTeacherTools();

  const leave = () => router.replace('/me');

  if (!tools.ready) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Teacher tools" onBack={leave} />
        <View className="gap-4 px-5 pt-4">
          <Skeleton height={196} radius={28} />
          <Skeleton height={98} />
          <Skeleton height={200} />
        </View>
      </View>
    );
  }

  // The card on Me is only drawn for someone with a tool to use, but a link
  // pasted into a chat reaches here without it.
  if (isGuest || !tools.any) {
    return (
      <View className="flex-1 bg-surf-base">
        <BackHeader title="Teacher tools" onBack={leave} />
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="This part is for teachers and leaders. Everything else in Faith Tribe is yours."
            actionLabel="Back to Me"
            onAction={leave}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surf-base">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.surfBase },
          // The tabs swap in place under a nav that does not move, so they
          // cross-fade. Screens that go deeper slide, as everywhere else.
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="lesson" />
        <Stack.Screen name="class/index" />
        <Stack.Screen name="class/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="review" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="check-in" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
      {!WITHOUT_NAV.some((prefix) => path.startsWith(prefix)) && <TeacherNav tools={tools} />}
    </View>
  );
}
