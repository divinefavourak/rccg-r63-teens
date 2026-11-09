import type { ComponentProps } from 'react';
import { useEffect } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { ELEVATION } from '../theme/tokens';
import { Icon } from './Icon';

/**
 * One photo, as large as the screen allows.
 *
 * Events are the one place in the app with photography, and a teen tapping a
 * cover wants to see the faces in it, not a 208pt crop. The image is letterboxed
 * rather than cropped (`contain`), and every way out is kept: the close button,
 * a tap anywhere, and Android's back gesture through `onRequestClose`.
 *
 * Rendered in a `Modal` so it sits above the tab bar and the docked action,
 * whatever screen opened it.
 */
export function PhotoViewer({
  visible,
  source,
  label,
  onClose,
}: {
  visible: boolean;
  source: ComponentProps<typeof Image>['source'];
  /** Read out by a screen reader; not shown on screen. */
  label: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();

  // White controls over a black backdrop, whatever the app's theme. Restored
  // on close: expo-status-bar sets the style and does not pop it for us, and
  // this viewer is a modal inside a screen that stays mounted.
  useEffect(() => {
    if (!visible) return;
    setStatusBarStyle('light');
    return () => setStatusBarStyle(scheme === 'dark' ? 'light' : 'dark');
  }, [visible, scheme]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        <Image
          source={source}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          style={{ flex: 1 }}
          accessibilityLabel={label}
        />

        {/* Covers the image too: a tap on the photo closes it, which is what
            people try first in a viewer. The close button sits above this. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          className="absolute inset-0"
        />

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
          hitSlop={12}
          className="absolute h-12 w-12 items-center justify-center rounded-full bg-black/60"
          style={[{ top: insets.top + 12, right: 20 }, ELEVATION.card]}
        >
          <Icon name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}
