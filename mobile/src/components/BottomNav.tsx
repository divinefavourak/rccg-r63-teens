import { memo, useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Expo Router 57 vendors its own navigation core, so the tab-bar prop type
// comes from the router's `tabs` subpath rather than from @react-navigation.
import type { BottomTabBarProps } from 'expo-router/tabs';

import { Icon, type IconName } from './Icon';
import { BibleMark } from './BrandMarks';
import { useTokens } from '../theme/ThemeProvider';
import { useChrome } from '../state/chrome';
import { DURATION, NAV } from '../theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Geometry of the nav, in the design's own units (Figma canvas 393 x 98). */
const NAV_HEIGHT = NAV.height;
const BAR_HEIGHT = NAV.barHeight;
const BAR_TOP = NAV_HEIGHT - BAR_HEIGHT; // 30
const BUBBLE_SIZE = NAV.bubbleSize;
const BUBBLE_TOP = NAV.bubbleTop;

/** Notch shape. Half-width clears the bubble's 25px radius with ~5px of air. */
const NOTCH_HALF = 36;
const NOTCH_DEPTH = 30;
const NOTCH_SHOULDER = 14;

/**
 * Build the bar's outline with a scoop carved out of its top edge at `cx`.
 *
 * The web design ships one baked SVG path per active tab, each valid only at a
 * 393px canvas. Generating the path means it fits any screen width and — the
 * reason it is a worklet — Reanimated can recompute it on the UI thread every
 * frame, so the notch travels with the bubble instead of snapping.
 */
function notchPath(cx: number, width: number, height: number): string {
  'worklet';
  const l = cx - NOTCH_HALF;
  const r = cx + NOTCH_HALF;
  return (
    `M0 0 L${l - NOTCH_SHOULDER} 0 ` +
    `C${l} 0 ${l + 2} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH} ` +
    `C${r - 2} ${NOTCH_DEPTH} ${r} 0 ${r + NOTCH_SHOULDER} 0 ` +
    `L${width} 0 L${width} ${height} L0 ${height} Z`
  );
}

const LABELS: Record<string, string> = {
  index: 'Today',
  library: 'Library',
  bible: 'Bible',
  tribe: 'Tribe',
  me: 'Me',
};

const ICONS: Record<string, IconName> = {
  index: 'sun',
  library: 'book',
  tribe: 'people',
  me: 'person',
};

interface TabItemProps {
  routeKey: string;
  routeName: string;
  focused: boolean;
  width: number;
  index: number;
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
  width,
  index,
  onPress,
  activeColor,
  inactiveColor,
}: TabItemProps) {
  const label = LABELS[routeName] ?? routeName;
  const color = focused ? activeColor : inactiveColor;

  // The active icon rides up into the bubble; the inactive one sits low next to
  // its label. Animating one transform beats swapping flex layouts, which would
  // relayout the whole bar.
  const reduceMotion = useReducedMotion();
  const iconStyle = useAnimatedStyle(() => {
    const target = focused ? BUBBLE_TOP + BUBBLE_SIZE / 2 : 55;
    return {
      transform: [
        {
          translateY: reduceMotion
            ? target
            : withTiming(target, { duration: DURATION.slow, easing: Easing.out(Easing.cubic) }),
        },
      ],
    };
  }, [focused, reduceMotion]);

  return (
    <Pressable
      onPress={() => onPress(routeKey, routeName, focused)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      // 44px minimum touch target is a launch gate (09-design-principles.md);
      // the full-height press area gives us 98px.
      style={{
        position: 'absolute',
        left: width * index,
        top: 0,
        width,
        height: NAV_HEIGHT,
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, alignItems: 'center', marginTop: -12 },
          iconStyle,
        ]}
      >
        {routeName === 'bible' ? (
          <BibleMark size={focused ? 24 : 21} color={color} filled={focused} />
        ) : (
          <Icon name={ICONS[routeName]} size={focused ? 24 : 21} color={color} filled={focused} />
        )}
      </Animated.View>

      <Text
        // Labels are always shown, never icon-only: 05-navigation.md requires
        // it for younger and low-literacy readers.
        numberOfLines={1}
        style={{
          position: 'absolute',
          bottom: 13,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 10,
          lineHeight: 16,
          color,
          fontFamily: focused ? 'Jakarta_600SemiBold' : 'Jakarta_500Medium',
        }}
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
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();

  const tabWidth = width / state.routes.length;

  // The reader tucks the nav away on scroll-down (05-navigation.md). It drives
  // `navHidden` from a UI-thread scroll handler, so this reads the value
  // without ever waking the JS thread.
  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navHidden.value * (NAV_HEIGHT + insets.bottom) }],
  }));

  // A single derived value drives both the bubble and the notch, so they can
  // never drift apart mid-animation.
  //
  // The first pass lands before `onLayout` has reported a width, so it has to
  // settle on the real position without animating — otherwise the notch visibly
  // slides in from the left edge every time the nav mounts.
  const placed = useSharedValue(false);
  const centre = useDerivedValue(() => {
    if (tabWidth === 0) return 0;
    const target = tabWidth * (state.index + 0.5);
    if (reduceMotion || !placed.value) {
      placed.value = true;
      return target;
    }
    return withTiming(target, { duration: DURATION.slow, easing: Easing.out(Easing.cubic) });
  }, [state.index, tabWidth, reduceMotion]);

  const pathProps = useAnimatedProps(() => ({
    d: notchPath(centre.value, width, BAR_HEIGHT),
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: centre.value - BUBBLE_SIZE / 2 }],
  }));

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
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
      onLayout={onLayout}
      // Absolutely positioned, so the transparent region around the notch shows
      // the screen underneath instead of the navigator's own background.
      // `BottomTabView` lays the tab bar out as a flex sibling of the screens,
      // so left in flow this strip rendered the navigation theme's colour and
      // read as a band that did not match the app. Taking it out of the flow
      // means screens must pad their scroll content — see `useNavClearance`.
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: NAV_HEIGHT + insets.bottom,
          backgroundColor: 'transparent',
        },
        shellStyle,
      ]}
    >
      {/* The bar itself, with the scoop carved out of its top edge.
          Deliberately unelevated: a platform shadow is cast from the view's
          rectangle, so on Android it would draw a hard box behind the curve
          and undo the notch. The notch and bubble already separate the nav
          from the content. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: BAR_TOP,
          bottom: 0,
        }}
      >
        {width > 0 && (
          <Svg width={width} height={BAR_HEIGHT + insets.bottom} style={{ position: 'absolute' }}>
            <AnimatedPath animatedProps={pathProps} fill={tokens.navBg} />
          </Svg>
        )}
        {/* The safe-area strip below the bar's own height, so the nav reaches
            the physical bottom edge on gesture-nav devices. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: BAR_HEIGHT,
            height: insets.bottom,
            backgroundColor: tokens.navBg,
          }}
        />
      </View>

      {/* The floating bubble, riding the same derived centre as the notch. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: BUBBLE_TOP,
            left: 0,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: BUBBLE_SIZE / 2,
            backgroundColor: tokens.navBg,
          },
          bubbleStyle,
        ]}
      />

      {width > 0 &&
        state.routes.map((route, index) => (
          <TabItem
            key={route.key}
            routeKey={route.key}
            routeName={route.name}
            focused={state.index === index}
            width={tabWidth}
            index={index}
            onPress={onPress}
            activeColor={tokens.green}
            inactiveColor={tokens.text3}
          />
        ))}
    </Animated.View>
  );
}
