import { memo, useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Expo Router 57 vendors its own navigation core, so the tab-bar prop type
// comes from the router's `tabs` subpath rather than from @react-navigation.
import type { BottomTabBarProps } from 'expo-router/tabs';

import { Icon, type IconName } from './Icon';
import { useTokens } from '../theme/ThemeProvider';
import { useChrome } from '../state/chrome';
import { DURATION, ELEVATION, NAV } from '../theme/tokens';

/** Geometry of the pill (Figma "Bottom Nav"). */
const PILL_PADDING = 6;
const TAB_WIDTH = 60;
const TAB_HEIGHT = NAV.tabHeight;

const LABELS: Record<string, string> = {
  index: 'Today',
  bible: 'Bible',
  library: 'Library',
  tribe: 'Tribe',
  me: 'Me',
};

const ICONS: Record<string, IconName> = {
  index: 'sun',
  bible: 'book',
  library: 'library',
  tribe: 'people',
  me: 'person',
};

interface TabItemProps {
  routeKey: string;
  routeName: string;
  focused: boolean;
  onPress: (routeKey: string, routeName: string, focused: boolean) => void;
  activeColor: string;
  inactiveColor: string;
}

/**
 * One tab. Split out and memoised so that changing tabs re-renders exactly the
 * two items whose focus changed, not all five.
 */
const TabItem = memo(function TabItem({
  routeKey,
  routeName,
  focused,
  onPress,
  activeColor,
  inactiveColor,
}: TabItemProps) {
  const label = LABELS[routeName] ?? routeName;
  const color = focused ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={() => onPress(routeKey, routeName, focused)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      // 44px minimum touch target is a launch gate (09-design-principles.md);
      // the tab itself is 60 x 56 and the slop reaches the pill's edge.
      hitSlop={{ top: PILL_PADDING, bottom: PILL_PADDING }}
      style={{
        width: TAB_WIDTH,
        height: TAB_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        // Inactive tabs sit back at 72%, as drawn.
        opacity: focused ? 1 : 0.72,
      }}
    >
      <Icon name={ICONS[routeName]} size={24} color={color} filled={focused} />
      <Text
        // Labels are always shown, never icon-only: 05-navigation.md requires
        // it for younger and low-literacy readers.
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 16, color, fontFamily: 'Inter_600SemiBold' }}
      >
        {label}
      </Text>
    </Pressable>
  );
});

export default function BottomNav({ state, navigation }: BottomTabBarProps) {
  const tokens = useTokens();
  const insets = useSafeAreaInsets();
  const { navHidden } = useChrome();
  const [pillWidth, setPillWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  const height = NAV.height + insets.bottom;
  const count = state.routes.length;

  // The reader tucks the nav away on scroll-down (05-navigation.md). It drives
  // `navHidden` from a UI-thread scroll handler, so this reads the value
  // without ever waking the JS thread.
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navHidden.value * height }],
  }));

  // Tabs are spread edge to edge inside the pill, so tab `i` starts at an even
  // share of the space left over once one tab's width is taken out.
  const step = count > 1 ? (pillWidth - PILL_PADDING * 2 - TAB_WIDTH) / (count - 1) : 0;

  // The first pass lands before `onLayout` has reported a width, so it has to
  // settle on the real position without animating — otherwise the highlight
  // visibly slides in from the left edge every time the nav mounts.
  const placed = useSharedValue(false);
  const offset = useDerivedValue(() => {
    if (pillWidth === 0) return 0;
    const target = PILL_PADDING + step * state.index;
    if (reduceMotion || !placed.value) {
      placed.value = true;
      return target;
    }
    return withTiming(target, { duration: DURATION.slow, easing: Easing.out(Easing.cubic) });
  }, [state.index, step, pillWidth, reduceMotion]);

  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setPillWidth(e.nativeEvent.layout.width);
  }, []);

  const onPress = useCallback(
    (routeKey: string, routeName: string, focused: boolean) => {
      const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
      // Re-tapping the active tab pops to root rather than re-navigating, the
      // convention 05-navigation.md calls for.
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(routeName as never);
      }
    },
    [navigation],
  );

  return (
    <Animated.View
      // Absolutely positioned, so the screen shows around the floating pill
      // instead of the navigator's own background. `BottomTabView` lays the
      // tab bar out as a flex sibling of the screens, so left in flow this
      // strip rendered the navigation theme's colour and read as a band that
      // did not match the app. Taking it out of the flow means screens must
      // pad their scroll content — see `useNavClearance`.
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height,
          paddingTop: NAV.paddingTop,
          paddingHorizontal: NAV.paddingX,
          backgroundColor: 'transparent',
        },
        shellStyle,
      ]}
    >
      <View
        onLayout={onLayout}
        accessibilityRole="tablist"
        style={[
          {
            height: NAV.barHeight,
            borderRadius: 999,
            padding: PILL_PADDING,
            backgroundColor: tokens.navBg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          ELEVATION.sheet,
        ]}
      >
        {/* The active tab's plate. One view that slides, rather than a
            background on each tab, so the change of tab reads as movement. */}
        {pillWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: PILL_PADDING,
                left: 0,
                width: TAB_WIDTH,
                height: TAB_HEIGHT,
                borderRadius: 999,
                backgroundColor: tokens.onInk,
              },
              highlightStyle,
            ]}
          />
        )}

        {state.routes.map((route, index) => (
          <TabItem
            key={route.key}
            routeKey={route.key}
            routeName={route.name}
            focused={state.index === index}
            onPress={onPress}
            activeColor={tokens.ink}
            inactiveColor={tokens.onInk}
          />
        ))}
      </View>
    </Animated.View>
  );
}
