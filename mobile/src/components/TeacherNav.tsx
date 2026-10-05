import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import type { TeacherTools } from '../state/teacher';
import { useTokens } from '../theme/ThemeProvider';
import { ELEVATION, NAV, POP } from '../theme/tokens';

const TAB_WIDTH = 76;

interface Tab {
  key: string;
  label: string;
  icon: IconName;
  href: Href;
  /** Whether this path belongs to the tab, for the highlight. */
  owns: (path: string) => boolean;
  show: (tools: TeacherTools) => boolean;
}

const TABS: Tab[] = [
  {
    key: 'home',
    label: 'Home',
    icon: 'sun',
    href: '/console',
    owns: (path) => path === '/console',
    show: () => true,
  },
  {
    key: 'lesson',
    label: 'Lesson',
    icon: 'book',
    href: '/console/lesson',
    owns: (path) => path.startsWith('/console/lesson'),
    show: (tools) => tools.lesson,
  },
  {
    key: 'class',
    label: 'My class',
    icon: 'people',
    href: '/console/class',
    owns: (path) => path.startsWith('/console/class'),
    show: (tools) => tools.roster,
  },
];

/**
 * The teacher tools' own bottom nav (Figma "App/Teacher Nav").
 *
 * A second pill rather than more tabs on the teen one: 05-navigation.md keeps
 * leader surfaces "entered deliberately, never mixed into teen surfaces".
 * Check in stays green whichever tab is showing, so on the morning of an event
 * it is always the first thing a thumb finds.
 *
 * Unlike the teen nav this one sits in the layout's flow, under the screens,
 * so no screen here has to pad its content clear of it.
 */
export function TeacherNav({ tools }: { tools: TeacherTools }) {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();

  const tabs = TABS.filter((tab) => tab.show(tools));

  return (
    <View
      style={{
        paddingTop: NAV.paddingTop,
        paddingHorizontal: NAV.paddingX,
        paddingBottom: Math.max(insets.bottom, NAV.paddingBottom),
      }}
    >
      <View
        accessibilityRole="tablist"
        style={[
          {
            height: NAV.barHeight,
            borderRadius: 999,
            padding: 6,
            backgroundColor: tokens.navBg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          ELEVATION.sheet,
        ]}
      >
        {tabs.map((tab) => {
          const focused = tab.owns(path);
          return (
            <NavTab
              key={tab.key}
              label={tab.label}
              icon={tab.icon}
              focused={focused}
              plate={focused ? tokens.onInk : 'transparent'}
              colour={focused ? tokens.ink : tokens.onInk}
              // Tabs swap in place: going Home → Lesson → My class must not
              // build a pile of screens for Back to unwind.
              onPress={() => !focused && router.replace(tab.href)}
            />
          );
        })}
        {tools.checkIn && (
          <NavTab
            label="Check in"
            icon="scan"
            focused={false}
            plate={POP.green}
            colour={POP.on}
            // Pushed, not swapped: the scanner is a full-screen task, and Back
            // from it should return to whichever tab it was opened from.
            onPress={() => router.push('/console/check-in')}
          />
        )}
      </View>
    </View>
  );
}

const NavTab = memo(function NavTab({
  label,
  icon,
  focused,
  plate,
  colour,
  onPress,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  plate: string;
  colour: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6 }}
      style={{
        width: TAB_WIDTH,
        height: NAV.tabHeight,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: plate,
        // Inactive tabs sit back, as drawn. The green one never does.
        opacity: focused || plate !== 'transparent' ? 1 : 0.75,
      }}
    >
      <Icon name={icon} size={22} color={colour} filled={focused} />
      <Text
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 16, color: colour, fontFamily: 'Inter_600SemiBold' }}
      >
        {label}
      </Text>
    </Pressable>
  );
});
