import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DrawingIn, Object3D } from '../src/ui/art';
import { Button } from '../src/ui/Button';

/**
 * Catch-all for a deep link that no longer resolves.
 *
 * 05-navigation.md: "never trap the user" — a dead link lands on a working
 * back path into Today, not on a stack with nowhere to go. Links get forwarded
 * on WhatsApp for months, so this screen will be seen.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 items-center justify-center gap-4 bg-surf-base px-5"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}
    >
      {/* On a colour plate in both themes: the drawing is black line art. */}
      <View className="mb-2 h-[220px] w-[220px] items-center justify-center rounded-full bg-pop-lime">
        <DrawingIn name="strolling" box={176} />
        <View pointerEvents="none" style={{ position: 'absolute', right: -8, top: -4 }}>
          <Object3D name="map-pin" size={64} />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        className="text-center font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
      >
        We couldn’t find that page
      </Text>
      <Text className="text-center font-ui text-[16px] leading-6 text-ink-2">
        The link may be old, or what it pointed to may have moved.
      </Text>
      <Button label="Go to Today" onPress={() => router.replace('/')} className="mt-2 w-full" />
    </View>
  );
}
