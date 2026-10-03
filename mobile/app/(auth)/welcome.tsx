import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../src/components/Icon';
import { LogoLockup } from '../../src/components/Logo';
import { Drawing, Object3D, type DrawingName, type ObjectName } from '../../src/ui/art';
import { Button } from '../../src/ui/Button';
import { POP_BG } from '../../src/ui/cards';
import { markWelcomed } from '../../src/state/welcome';
import { useTokens } from '../../src/theme/ThemeProvider';
import type { PopColour } from '../../src/theme/tokens';

interface Page {
  colour: PopColour;
  title: string;
  body: string;
  drawing: DrawingName;
  drawingWidth: number;
  /** Objects placed on the 360-wide stage, as drawn. */
  objects: { name: ObjectName; size: number; left: number; top: number }[];
}

const PAGES: Page[] = [
  {
    colour: 'green',
    title: 'A few minutes with God, every day',
    body: 'One short reading, one verse to keep, one small challenge. Then you are done.',
    drawing: 'reading-side',
    drawingWidth: 270,
    objects: [{ name: 'fire', size: 84, left: 248, top: 16 }],
  },
  {
    colour: 'amber',
    title: 'The whole Bible in your pocket',
    body: 'Read it in light, dark or warm paper. Save the verses that speak to you.',
    drawing: 'reading',
    drawingWidth: 233,
    objects: [
      { name: 'notebook', size: 96, left: 16, top: 150 },
      { name: 'star', size: 72, left: 262, top: 30 },
    ],
  },
  {
    colour: 'violet',
    title: 'Find your tribe',
    body: 'Events at your parish, tickets on your phone, and people cheering you on.',
    drawing: 'dancing',
    drawingWidth: 270,
    objects: [
      { name: 'chat-bubble', size: 88, left: 20, top: 24 },
      { name: 'crown', size: 80, left: 256, top: 170 },
    ],
  },
];

/** The design's stage is 360 wide; objects are placed relative to its centre. */
const STAGE_WIDTH = 360;

/**
 * First-launch welcome: three pages, then sign up, log in, or just read.
 *
 * Shown once. Every page has a way past it, and the last one offers today's
 * devotional with no account at all — the guest view is a preview of the real
 * product, never a wall (05-navigation.md).
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useTokens();
  const [index, setIndex] = useState(0);

  const page = PAGES[index];
  const last = index === PAGES.length - 1;

  const leave = useCallback(
    (to: 'sign-up' | 'log-in' | 'read') => {
      markWelcomed();
      if (to === 'read') router.replace('/');
      else if (to === 'log-in') router.push('/log-in');
      else router.push('/sign-up');
    },
    [router],
  );

  return (
    <View className={`flex-1 ${POP_BG[page.colour]}`} style={{ paddingTop: insets.top }}>
      {/* The page colours are light in both themes, so the status bar is dark. */}
      <StatusBar style="dark" />

      <View className="h-11 flex-row items-center justify-between px-5 pt-1">
        <LogoLockup size={44} />
        {!last && (
          <Pressable
            onPress={() => setIndex(PAGES.length - 1)}
            accessibilityRole="button"
            hitSlop={12}
          >
            <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">Skip</Text>
          </Pressable>
        )}
      </View>

      <View className="flex-1 items-center justify-center overflow-hidden">
        <View style={{ width: STAGE_WIDTH, height: 320, alignItems: 'center', justifyContent: 'center' }}>
          <View
            className="rounded-full bg-surf-raised"
            style={{ position: 'absolute', width: 260, height: 260, top: 20, left: 50 }}
          />
          <Drawing name={page.drawing} width={page.drawingWidth} />
          {page.objects.map((object) => (
            <View
              key={object.name}
              pointerEvents="none"
              style={{ position: 'absolute', left: object.left, top: object.top }}
            >
              <Object3D name={object.name} size={object.size} />
            </View>
          ))}
        </View>
      </View>

      <View
        className="items-center gap-4 rounded-t-[40px] bg-surf-raised p-6"
        style={{ paddingBottom: Math.max(insets.bottom, 24) }}
      >
        <View
          className="flex-row items-center gap-1.5"
          accessibilityLabel={`Page ${index + 1} of ${PAGES.length}`}
        >
          {PAGES.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${i === index ? 'w-6 bg-ink' : 'w-2 bg-line-strong'}`}
            />
          ))}
        </View>

        <Text
          accessibilityRole="header"
          className="text-center font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
        >
          {page.title}
        </Text>
        <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">{page.body}</Text>

        <Button
          label={last ? 'Get started' : 'Next'}
          onPress={() => (last ? leave('sign-up') : setIndex((i) => i + 1))}
          className="w-full"
        />
        <Button
          label="I already have an account"
          variant={last ? 'secondary' : 'tertiary'}
          onPress={() => leave('log-in')}
          className="w-full"
        />

        {last && (
          <Pressable
            onPress={() => leave('read')}
            accessibilityRole="link"
            className="h-11 flex-row items-center gap-1"
          >
            <Text className="font-ui-sb text-[14px] leading-5 text-green">
              Just want to read? Open today’s devotional
            </Text>
            <Icon name="chevronRight" size={16} color={tokens.green} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
