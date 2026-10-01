import { Tabs } from 'expo-router';

import BottomNav from '../../src/components/BottomNav';
import { useTokens } from '../../src/theme/ThemeProvider';

/**
 * Five destinations, forever — Today · Library · Bible · Tribe · Me — with
 * Bible in the centre slot. Both rules are binding (05-navigation.md), and the
 * file order here is what puts Bible under the nav's notch.
 */
export default function TabsLayout() {
  const tokens = useTokens();

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: tokens.surfBase },
        // Each tab keeps its own state and scroll position when you switch
        // away and back (05-navigation.md), which requires the screen to stay
        // mounted rather than unmount on blur.
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="bible" options={{ title: 'Bible' }} />
      <Tabs.Screen name="tribe" options={{ title: 'Tribe' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
